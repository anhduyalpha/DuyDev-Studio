import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { createQuizJobSchema, parsePromptSchema } from '../../schemas/quiz.schema.js';
import { enqueueJob } from '../../queues/task.queue.js';
import { logger } from '../../lib/logger.js';

export async function enqueueQuizJob(request: FastifyRequest, reply: FastifyReply) {
  const body = createQuizJobSchema.parse(request.body);
  const { fileId, gdriveUrl, pages, count, startNum, title, subtitle, prefix, apiKey } = body;

  if (fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId }
    });
    if (!fileRecord || fileRecord.isPurged) {
      throw new NotFoundError(`Source file ${fileId} does not exist or has been deleted`);
    }
  }

  const jobId = `job_quiz_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const job = await prisma.job.create({
    data: {
      id: jobId,
      type: 'quiz_generate',
      status: 'QUEUED',
      progress: 0,
      optionsJson: JSON.stringify(body)
    }
  });

  try {
    await enqueueJob('quiz_process', {
      jobId: job.id,
      fileId,
      gdriveUrl,
      pages,
      count,
      startNum,
      title,
      subtitle,
      prefix,
      apiKey
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

export async function parsePromptIntent(request: FastifyRequest, reply: FastifyReply) {
  const { prompt } = parsePromptSchema.parse(request.body);
  const text = prompt.trim();

  let pages = '';
  let count = 20;
  let start = 1;

  // 1. Regex parsing for pages: "trang 11", "trang 11,12", "trang 4,5,6", "trang 36-38"
  const pageMatch = text.match(/trang\s*(\d+(?:\s*[-–,]\s*\d+)*)/i);
  if (pageMatch) {
    pages = pageMatch[1].replace(/\s+/g, '');
  }

  // 2. Regex parsing for question range: "từ câu 1 đến 20", "từ câu 1 - 25"
  const rangeMatch = text.match(/từ\s*câu\s*(\d+)\s*(?:đến|-|–)\s*(\d+)/i);
  if (rangeMatch) {
    start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    count = Math.max(1, end - start + 1);
  } else {
    // Regex for question count: "20 câu", "lấy 25 câu", "làm 15 câu"
    const countMatch = text.match(/(?:lấy|làm|tạo|trích)?\s*(\d+)\s*câu/i);
    if (countMatch) {
      count = parseInt(countMatch[1], 10);
    }
    // Regex for start number: "bắt đầu từ câu 5"
    const startMatch = text.match(/bắt\s*đầu\s*(?:từ)?\s*(?:câu)?\s*(\d+)/i);
    if (startMatch) {
      start = parseInt(startMatch[1], 10);
    }
  }

  // Return immediately if regex matched pages
  if (pages) {
    return reply.send({
      success: true,
      data: {
        pages,
        count,
        start,
        source: 'regex'
      }
    });
  }

  // Fallback to Agnes AI lightweight intent extraction
  const apiKey = process.env.AGNES_AI_API_KEY;
  const baseUrl = process.env.AGNES_AI_BASE_URL || 'https://apihub.agnes-ai.com/v1';
  const model = process.env.AGNES_AI_MODEL || 'agnes-3.0-flash';

  if (apiKey) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a parameter extractor. Given a user request for quiz generation, output JSON with "pages" (string, e.g. "11" or "11,12"), "count" (int), "start" (int).'
            },
            {
              role: 'user',
              content: `Parse this request into JSON: "${text}"`
            }
          ]
        })
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          return reply.send({
            success: true,
            data: {
              pages: String(parsed.pages || ''),
              count: Number(parsed.count) || count,
              start: Number(parsed.start) || start,
              source: 'ai'
            }
          });
        }
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, 'Agnes AI prompt parsing fallback failed, returning defaults');
    }
  }

  return reply.send({
    success: true,
    data: {
      pages,
      count,
      start,
      source: 'default'
    }
  });
}
