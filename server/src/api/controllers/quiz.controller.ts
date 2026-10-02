import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { createQuizJobSchema, parsePromptSchema } from '../../schemas/quiz.schema.js';
import { enqueueQuizJob as enqueueToQuizQueue } from '../../queues/task.queue.js';
import { logger } from '../../lib/logger.js';

export async function enqueueQuizJob(request: FastifyRequest, reply: FastifyReply) {
  const body = createQuizJobSchema.parse(request.body);
  const { fileId, gdriveUrl, pages, count, startNum, title, subtitle, prefix, apiKey } = body;

  if (fileId && typeof fileId === 'string' && fileId.trim() !== '') {
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
    await enqueueToQuizQueue({
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

  // Helper for deterministic offline regex extraction
  function extractWithRegex(input: string) {
    let pages = '';
    let count = 20;
    let start = 1;
    let end: number | null = null;

    // 1. Regex parsing for pages: "trang 11", "trang 11,12", "trang 4,5,6", "trang 36-38", "page 12"
    const pageMatch = input.match(/(?:trang|page)\s*(\d+(?:\s*[-–,]\s*\d+)*)/i);
    if (pageMatch) {
      pages = pageMatch[1].replace(/\s+/g, '');
    }

    // 2. Regex parsing for question range: "từ câu 18 đến 28", "câu 18 đến câu 28", "câu 18 tới 28", "câu 18 - câu 28"
    const rangeMatch = input.match(/(?:từ\s*)?câu\s*(\d+)\s*(?:đến|tới|-|–|—|->)\s*(?:câu\s*)?(\d+)/i);
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
      // Regex for question count: "20 câu", "lấy 25 câu", "làm 15 câu"
      const countMatch = input.match(/(?:lấy|làm|tạo|trích)?\s*(\d+)\s*câu/i);
      if (countMatch) {
        count = parseInt(countMatch[1], 10);
      }
      // Regex for start number: "bắt đầu từ câu 5", "từ câu 5"
      const startMatch = input.match(/(?:bắt\s*đầu\s*)?(?:từ\s*)?câu\s*(\d+)/i);
      if (startMatch) {
        start = parseInt(startMatch[1], 10);
      }
    }

    // Auto-generate prefix
    let prefix = '';
    if (pages && end !== null) {
      prefix = `Trang_${pages.replace(/,/g, '_')}_Cau_${start}_${end}`;
    } else if (pages && start > 1) {
      prefix = `Trang_${pages.replace(/,/g, '_')}_Cau_${start}_${start + count - 1}`;
    } else if (pages) {
      prefix = `Trang_${pages.replace(/,/g, '_')}_${count}Cau`;
    }

    const title = pages ? `BÀI TẬP TRẮC NGHIỆM TRANG ${pages}` : 'BÀI TẬP TRẮC NGHIỆM';

    return {
      pages,
      count,
      start,
      title,
      prefix,
      source: 'regex'
    };
  }

  // 1. AI-First: Delegate parsing to Agnes AI (agnes-3.0-flash)
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
                '  "pages": string (e.g. "12", "12-15", "4,5,6" - only the page number(s) or ranges, empty string if not mentioned),\n' +
                '  "start": int (starting question number, default 1, e.g. "câu 18 đến 28" -> 18),\n' +
                '  "count": int (total number of questions, default 20. If a range "câu X đến Y" is given, calculate count = Y - X + 1, e.g. from 18 to 28 inclusive is 11),\n' +
                '  "title": string (formal Vietnamese exam uppercase title, e.g. "BÀI TẬP TRẮC NGHIỆM TRANG 12"),\n' +
                '  "prefix": string (short clean file identifier without spaces or special characters, e.g. "Trang_12_Cau_18_28")\n' +
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
          const pagesRes = String(parsed.pages ?? regexDefaults.pages ?? '').trim();
          const startRes = Math.max(1, Number(parsed.start) || regexDefaults.start || 1);
          const countRes = Math.max(1, Number(parsed.count) || regexDefaults.count || 20);
          const titleRes = String(parsed.title || regexDefaults.title || 'BÀI TẬP TRẮC NGHIỆM').trim();
          const rawPrefix = String(parsed.prefix || regexDefaults.prefix || (pagesRes ? `Trang_${pagesRes}` : 'BaiTap')).trim();
          const prefixRes = rawPrefix.replace(/[\\/*?:"<>|]/g, '').replace(/\s+/g, '_') || 'BaiTap';

          return reply.send({
            success: true,
            data: {
              pages: pagesRes,
              count: countRes,
              start: startRes,
              title: titleRes,
              prefix: prefixRes,
              source: 'ai'
            }
          });
        }
      }
    } catch (aiErr) {
      logger.warn({ aiErr }, 'Agnes AI prompt parsing failed or timed out, falling back to regex parser');
    }
  }

  // 2. Offline / Timeout Fallback: Enhanced Regex
  const regexResult = extractWithRegex(text);
  return reply.send({
    success: true,
    data: regexResult
  });
}
