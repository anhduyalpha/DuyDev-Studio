import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { createQuizJobSchema, parsePromptSchema } from '../../schemas/quiz.schema.js';
import { enqueueQuizJob as enqueueQuizTask } from '../../queues/task.queue.js';
import { isPermanentRetention } from '../../config/limits.config.js';
import { logger } from '../../lib/logger.js';

export async function enqueueQuizJob(request: FastifyRequest, reply: FastifyReply) {
  const body = createQuizJobSchema.parse(request.body);
  const { fileId, gdriveUrl, pages, count, startNum, title, subtitle, prefix, stylePresetId } = body;

  let originalSizeBytes = 0;

  if (fileId) {
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId }
    });

    if (!fileRecord || fileRecord.isPurged || (!isPermanentRetention && fileRecord.expiresAt <= new Date())) {
      throw new NotFoundError(`Source file ${fileId} does not exist or has expired`);
    }

    originalSizeBytes = Number(fileRecord.sizeBytes);
  }

  const jobId = `job_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

  const job = await prisma.job.create({
    data: {
      id: jobId,
      type: 'quiz_generate',
      status: 'QUEUED',
      progress: 0,
      optionsJson: JSON.stringify({
        fileId,
        gdriveUrl,
        pages,
        count,
        startNum,
        title,
        subtitle,
        prefix,
        stylePresetId: stylePresetId || 'blue_black_classic',
        originalSizeBytes
      })
    }
  });

  try {
    await enqueueQuizTask({
      jobId: job.id,
      fileId,
      gdriveUrl,
      pages,
      count,
      startNum,
      title,
      subtitle,
      prefix,
      stylePresetId: stylePresetId || 'blue_black_classic'
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
  const body = parsePromptSchema.parse(request.body);
  const text = (body.instruction || body.prompt || '').trim();

  // Helper for deterministic regex parsing
  function extractWithRegex(input: string) {
    let pages = '';
    let count = 20;
    let start = 1;
    let end: number | null = null;

    let s = input.replace(/\b(?:trang|page)\s+(\d)\s+(\d)\b/gi, 'trang $1$2');

    // 1. Regex parsing for pages
    const pageRangeMatch = s.match(/(?:(?:ở|tại|từ)?\s*(?:trang|page|p\.?)(?:\s*số|\s*:)?)[\s:]*(\d+)\s*(?:đến|tới|[-–—]|->)\s*(\d+)(?!\s*câu)/i);
    if (pageRangeMatch) {
      pages = `${pageRangeMatch[1]}-${pageRangeMatch[2]}`;
    } else {
      const pageListMatch = s.match(/(?:(?:ở|tại|từ)?\s*(?:trang|page|p\.?)(?:\s*số|\s*:)?)[\s:]*(\d+(?:\s*[-–—]\s*\d+|\s*,\s*\d+(?!\d*\s*câu))*)/i);
      if (pageListMatch) {
        pages = pageListMatch[1].replace(/\s+/g, '');
      }
    }

    // 2. Regex parsing for question range
    const rangeMatch = s.match(/(?:từ\s*)?câu\s*(\d+)\s*(?:đến|tới|-|–|—|->)\s*(?:câu\s*)?(\d+)/i);
    if (rangeMatch) {
      start = parseInt(rangeMatch[1], 10);
      end = parseInt(rangeMatch[2], 10);
      if (start > end) {
        const tmp = start;
        start = end;
        end = tmp;
      }
      count = Math.max(1, end - start + 1);
    } else {
      const countMatch = s.match(/(?:lấy|làm|tạo|trích)?\s*(\d+)\s*câu/i);
      if (countMatch) {
        count = parseInt(countMatch[1], 10);
      }
      const startMatch = s.match(/(?:bắt\s*đầu\s*)?(?:từ\s*)?câu\s*(\d+)/i);
      if (startMatch) {
        start = parseInt(startMatch[1], 10);
      }
    }

    // 3. Regex parsing for prefix/topic
    let prefix = '';
    const topicMatch = s.match(/(?:tên\s*file|file|chủ\s*đề|chuyên\s*đề|bài\s*tập|đề)\s*[:=]?\s*([a-zA-Z0-9À-ỹ_\s-]+?)(?:,|$|\.|\n)/i);
    if (topicMatch) {
      prefix = topicMatch[1].trim();
    } else {
      const parts = s.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        if (
          !part.match(/(?:trang|page)/i) &&
          !part.match(/(?:câu|cau)/i) &&
          !part.match(/(?:bắt\s*đầu|lấy|làm|tạo|trích)/i) &&
          part.length >= 2 &&
          !part.match(/^\d+$/)
        ) {
          prefix = part;
          break;
        }
      }
    }

    const sanitizedPrefix = prefix ? prefix.replace(/[\\/*?:"<>|]/g, '').trim().replace(/\s+/g, '_') : '';
    const title = pages
      ? `BÀI TẬP TRẮC NGHIỆM TRANG ${pages}`
      : (prefix ? `BÀI TẬP TRẮC NGHIỆM ${prefix.toUpperCase()}` : 'BÀI TẬP TRẮC NGHIỆM');

    return {
      pages,
      count,
      start,
      title,
      prefix: sanitizedPrefix,
      confidence: 1.0,
      warnings: [] as string[],
      source: 'regex'
    };
  }

  // 1. AI fallback if configured
  const apiKey = process.env.AGNES_AI_API_KEY || process.env.AGNES_API_KEY;
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
        signal: AbortSignal.timeout(3500),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are an expert Vietnamese exam parameter extractor for a quiz generator tool. Given a user request, extract parameters and respond strictly with JSON having this schema:\n' +
                '{\n' +
                '  "pages": string (e.g. "11", "11-15", "4,5,6" - only the page number(s) or ranges. Never confuse question numbers with page numbers. In "trang 11 câu 1 đến 16", the page is "11", NOT "1"),\n' +
                '  "start": int (starting question number, default 1, e.g. "câu 18 đến 28" -> 18),\n' +
                '  "count": int (total number of questions, default 20. If a range "câu X đến Y" is given, count = Y - X + 1),\n' +
                '  "title": string (formal Vietnamese exam uppercase title),\n' +
                '  "prefix": string (optional short clean topic or file name if explicitly mentioned, otherwise "")\n' +
                '}'
            },
            {
              role: 'user',
              content: `Parse this quiz generation request: "${text}"`
            }
          ]
        })
      });

      if (res.ok) {
        const json = (await res.json()) as any;
        const rawContent = json.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          const regexDefaults = extractWithRegex(text);
          let pagesRes = String(parsed.pages ?? regexDefaults.pages ?? '').trim();

          if (regexDefaults.pages && regexDefaults.pages !== pagesRes) {
            if (regexDefaults.pages.includes(pagesRes) || pagesRes === '1' || !pagesRes) {
              logger.info({ aiPages: pagesRes, regexPages: regexDefaults.pages }, 'Correcting AI page misparse using regex');
              pagesRes = regexDefaults.pages;
            }
          }

          let startRes = Math.max(1, Number(parsed.start) || regexDefaults.start || 1);
          let countRes = Math.max(1, Number(parsed.count) || regexDefaults.count || 20);
          if (regexDefaults.start && regexDefaults.start < startRes) {
            startRes = regexDefaults.start;
            countRes = regexDefaults.count;
          }

          let titleRes = pagesRes
            ? `BÀI TẬP TRẮC NGHIỆM TRANG ${pagesRes}`
            : (regexDefaults.title || 'BÀI TẬP TRẮC NGHIỆM');
          if (text.match(/(?:tiêu\s*đề|title)/i) && parsed.title) {
            titleRes = String(parsed.title).trim();
          }

          const rawPrefix = String(parsed.prefix || regexDefaults.prefix || '').trim();
          const prefixRes = rawPrefix ? rawPrefix.replace(/[\\/*?:"<>|]/g, '').replace(/\s+/g, '_') : '';

          logger.info({ prompt: text, result: { pages: pagesRes, count: countRes, start: startRes, title: titleRes } }, 'Quiz prompt parsed via AI');

          return reply.send({
            success: true,
            data: {
              pages: pagesRes,
              count: countRes,
              start: startRes,
              title: titleRes,
              prefix: prefixRes,
              confidence: 0.95,
              warnings: [],
              source: 'ai'
            }
          });
        }
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, 'Agnes AI prompt parsing failed or timed out, falling back to regex parser');
    }
  }

  // 2. Offline / Deterministic Regex
  const regexResult = extractWithRegex(text);
  return reply.send({
    success: true,
    data: regexResult
  });
}
