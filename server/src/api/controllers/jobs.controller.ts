import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { enqueuePdfJobSchema, jobIdParamSchema } from '../../schemas/jobs.schema.js';
import { enqueueJob, createRedisSubscriber } from '../../queues/task.queue.js';
import { isPermanentRetention } from '../../config/limits.config.js';
import { logger } from '../../lib/logger.js';

export async function enqueuePdfJob(request: FastifyRequest, reply: FastifyReply) {
  const body = enqueuePdfJobSchema.parse(request.body);
  const { fileId, operation, options } = body;

  const fileRecord = await prisma.fileRecord.findUnique({
    where: { id: fileId }
  });

  if (!fileRecord || fileRecord.isPurged || (!isPermanentRetention && fileRecord.expiresAt <= new Date())) {
    throw new NotFoundError(`Source file ${fileId} does not exist or has expired`);
  }

  const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const job = await prisma.job.create({
    data: {
      id: jobId,
      type: `pdf_${operation}`,
      status: 'QUEUED',
      progress: 0,
      optionsJson: JSON.stringify({ fileId, operation, options })
    }
  });

  try {
    await enqueueJob('pdf_process', {
      jobId: job.id,
      fileId,
      operation,
      options
    });
  } catch (queueErr) {
    logger.warn({ jobId: job.id, queueErr }, 'Queue enqueue failed, job remains QUEUED in database');
  }

  return reply.status(202).send({
    success: true,
    data: {
      jobId: job.id,
      status: job.status,
      eventsUrl: `/api/v1/jobs/${job.id}/events`,
      pollUrl: `/api/v1/jobs/${job.id}`
    }
  });
}

export async function getJobEvents(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = jobIdParamSchema.parse(request.params);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true }
  });

  if (!job) {
    throw new NotFoundError(`Job with ID ${jobId} not found`);
  }

  // Set SSE Headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  reply.raw.flushHeaders?.();

  // Helper to build completed event payload
  const buildCompletedPayload = (targetJob: typeof job) => {
    const artifact = targetJob.files.find((f) => f.purpose === 'PROCESSED_ARTIFACT') || targetJob.files[0];
    const inputFile = targetJob.files.find((f) => f.purpose !== 'PROCESSED_ARTIFACT');
    const artifactSize = artifact ? Number(artifact.sizeBytes) : 0;
    const inputSize = inputFile ? Number(inputFile.sizeBytes) : 0;

    let payload: Record<string, unknown> = {
      jobId,
      percentage: 100,
      resultFileId: artifact?.id || null,
      resultFileName: artifact?.originalName || null,
      resultSizeBytes: artifactSize,
      originalSizeBytes: inputSize > 0 ? inputSize : null,
      downloadUrl: artifact ? `/api/v1/files/download/${artifact.id}` : null
    };

    if (inputSize > 0 && artifactSize > 0) {
      payload.savingsPct = Number(Math.max(0, ((inputSize - artifactSize) / inputSize) * 100).toFixed(1));
    }

    try {
      const opts = JSON.parse(targetJob.optionsJson || '{}');
      if (opts.result) {
        payload = {
          ...payload,
          ...opts.result
        };
      }
    } catch {}

    return payload;
  };

  // Send initial connected event
  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ jobId, status: job.status, progress: job.progress })}\n\n`);

  // If already completed or failed, emit current state and exit immediately
  if (job.status === 'COMPLETED') {
    const completedPayload = buildCompletedPayload(job);
    reply.raw.write(`event: completed\ndata: ${JSON.stringify(completedPayload)}\n\n`);
    reply.raw.end();
    return;
  }

  if (job.status === 'FAILED') {
    reply.raw.write(
      `event: failed\ndata: ${JSON.stringify({
        jobId,
        error: job.errorMessage || 'Job execution failed',
        timestamp: Math.floor(Date.now() / 1000)
      })}\n\n`
    );
    reply.raw.end();
    return;
  }

  const subscriber = createRedisSubscriber();
  const channel = `job:events:${jobId}`;

  const messageHandler = (chan: string, message: string) => {
    if (chan === channel) {
      try {
        const parsed = JSON.parse(message);
        reply.raw.write(`event: ${parsed.event || 'message'}\ndata: ${JSON.stringify(parsed.data)}\n\n`);

        if (parsed.event === 'completed' || parsed.event === 'failed') {
          cleanup();
          reply.raw.end();
        }
      } catch {
        reply.raw.write(`data: ${message}\n\n`);
      }
    }
  };

  subscriber.on('message', messageHandler);

  let isCleanedUp = false;
  const keepAliveTimer = setInterval(() => {
    try {
      reply.raw.write(': keepalive\n\n');
    } catch {
      cleanup();
    }
  }, 5000);

  // Maximum SSE connection lifetime (5 minutes) with automatic graceful termination
  const maxTimeout = setTimeout(() => {
    cleanup();
    try {
      reply.raw.end();
    } catch {}
  }, 5 * 60 * 1000);

  const cleanup = async () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    clearInterval(keepAliveTimer);
    clearTimeout(maxTimeout);
    try {
      subscriber.off('message', messageHandler);
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    } catch {
      subscriber.disconnect();
    }
  };

  request.raw.on('close', () => {
    cleanup();
  });

  try {
    if (!isCleanedUp) {
      await subscriber.subscribe(channel);
    }
  } catch (subErr) {
    logger.warn({ jobId, subErr }, 'Failed to subscribe to Redis events channel');
  }

  // POST-SUBSCRIPTION RE-CHECK: Eliminate TOCTOU race condition window
  try {
    const postSubJob = await prisma.job.findUnique({
      where: { id: jobId },
      include: { files: true }
    });

    if (postSubJob && !isCleanedUp && !reply.raw.writableEnded) {
      if (postSubJob.status === 'COMPLETED') {
        const completedPayload = buildCompletedPayload(postSubJob);
        reply.raw.write(`event: completed\ndata: ${JSON.stringify(completedPayload)}\n\n`);
        await cleanup();
        reply.raw.end();
        return;
      }

      if (postSubJob.status === 'FAILED') {
        reply.raw.write(
          `event: failed\ndata: ${JSON.stringify({
            jobId,
            error: postSubJob.errorMessage || 'Job execution failed',
            timestamp: Math.floor(Date.now() / 1000)
          })}\n\n`
        );
        await cleanup();
        reply.raw.end();
        return;
      }
    }
  } catch (recheckErr) {
    logger.warn({ jobId, recheckErr }, 'Post-subscription job status re-check error');
  }
}

export async function getJobStatus(request: FastifyRequest, reply: FastifyReply) {
  const { jobId } = jobIdParamSchema.parse(request.params);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { files: true }
  });

  if (!job) {
    throw new NotFoundError(`Job with ID ${jobId} not found`);
  }

  let resultPayload: unknown = null;
  try {
    const opts = JSON.parse(job.optionsJson || '{}');
    if (opts.result) {
      resultPayload = opts.result;
    }
  } catch {}

  // If quiz job completed but result not in optionsJson, reconstruct from files
  if (!resultPayload && job.status === 'COMPLETED' && job.type === 'quiz_generate') {
    const wsFile = job.files.find((f) => f.originalName.includes('_DeBai') || f.id.endsWith('_ws'));
    const ansFile = job.files.find((f) => f.originalName.includes('_DapAn') || f.id.endsWith('_ans'));
    if (wsFile && ansFile) {
      resultPayload = {
        jobId: job.id,
        percentage: 100,
        worksheet: {
          fileId: wsFile.id,
          fileName: wsFile.originalName,
          sizeBytes: Number(wsFile.sizeBytes),
          pages: 1,
          downloadUrl: `/api/v1/files/download/${wsFile.id}`,
          viewUrl: `/api/v1/files/view/${wsFile.id}`
        },
        answer: {
          fileId: ansFile.id,
          fileName: ansFile.originalName,
          sizeBytes: Number(ansFile.sizeBytes),
          pages: 1,
          downloadUrl: `/api/v1/files/download/${ansFile.id}`,
          viewUrl: `/api/v1/files/view/${ansFile.id}`
        }
      };
    }
  }

  return reply.send({
    success: true,
    data: {
      jobId: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      result: resultPayload,
      files: job.files.map((file) => ({
        fileId: file.id,
        purpose: file.purpose,
        originalName: file.originalName,
        sizeBytes: Number(file.sizeBytes),
        mimeType: file.mimeType,
        downloadUrl: `/api/v1/files/download/${file.id}`
      }))
    }
  });
}
