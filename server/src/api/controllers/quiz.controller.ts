import { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import { createQuizJobSchema, parsePromptSchema } from '../../schemas/quiz.schema.js';
import { enqueueQuizJob as enqueueQuizTask } from '../../queues/task.queue.js';
import { isPermanentRetention } from '../../config/limits.config.js';
import { logger } from '../../lib/logger.js';
import { aiMetricsService } from '../../services/ai-metrics.service.js';
import { adminTelemetryService } from '../../services/admin-telemetry.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePythonBin(): string {
  const candidateVenvs = [
    path.resolve(process.cwd(), '../engines/converter/file_conversor_core/venv/Scripts/python.exe'),
    path.resolve(process.cwd(), 'engines/converter/file_conversor_core/venv/Scripts/python.exe'),
    path.resolve(process.cwd(), '../engines/quiz/venv/Scripts/python.exe'),
    path.resolve(process.cwd(), 'engines/quiz/venv/Scripts/python.exe'),
    '/home/anhduy/dd-studio/engines/converter/file_conversor_core/venv/bin/python',
    '/home/anhduy/dd-studio/engines/quiz/venv/bin/python'
  ];
  for (const v of candidateVenvs) {
    if (existsSync(v)) return v;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveInspectScript(): string {
  const candidates = [
    path.resolve(process.cwd(), '../engines/quiz/recognition/inspect_cli.py'),
    path.resolve(process.cwd(), 'engines/quiz/recognition/inspect_cli.py'),
    path.resolve(__dirname, '../../../../engines/quiz/recognition/inspect_cli.py'),
    path.resolve(__dirname, '../../../engines/quiz/recognition/inspect_cli.py'),
    '/home/anhduy/dd-studio/engines/quiz/recognition/inspect_cli.py'
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

export async function enqueueQuizJob(request: FastifyRequest, reply: FastifyReply) {
  const body = createQuizJobSchema.parse(request.body);
  const {
    fileId,
    gdriveUrl,
    pages,
    count,
    startNum,
    title,
    subtitle,
    prefix,
    stylePresetId,
    parity_filter,
    parityFilter,
    section_filter,
    sectionFilter,
    detected_questions,
    detectedQuestions,
    instruction
  } = body;

  let originalSizeBytes = 0;

  if (fileId && typeof fileId === 'string' && fileId.trim() !== '') {
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId.trim() }
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
        originalSizeBytes,
        parity_filter,
        parityFilter,
        section_filter,
        sectionFilter,
        detected_questions,
        detectedQuestions,
        instruction
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
      stylePresetId: stylePresetId || 'blue_black_classic',
      parity_filter,
      parityFilter,
      section_filter,
      sectionFilter,
      detected_questions,
      detectedQuestions,
      instruction
    });
  } catch (queueErr) {
    logger.warn({ jobId: job.id, queueErr }, 'Queue enqueue failed, job remains QUEUED in database');
    if (process.env.NODE_ENV !== 'test') {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: 'Không thể xếp hàng tạo bài tập trắc nghiệm. Vui lòng thử lại.'
        }
      });
      return reply.status(503).send({
        success: false,
        error: 'Dịch vụ xử lý bài tập trắc nghiệm tạm thời gián đoạn. Vui lòng thử lại.'
      });
    }
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

  // 0. Ground-Truth Page Inspection if source PDF or Google Drive is available
  let targetPdfPath: string | null = null;
  if (body.fileId && typeof body.fileId === 'string' && body.fileId.trim() !== '') {
    try {
      const fileRecord = await prisma.fileRecord.findUnique({
        where: { id: body.fileId.trim() }
      });
      if (fileRecord && fileRecord.storagePath) {
        let absStoragePath = fileRecord.storagePath;
        if (!existsSync(absStoragePath)) {
          const cand1 = path.resolve(process.cwd(), fileRecord.storagePath);
          const cand2 = path.resolve(process.cwd(), '..', fileRecord.storagePath);
          if (existsSync(cand1)) {
            absStoragePath = cand1;
          } else if (existsSync(cand2)) {
            absStoragePath = cand2;
          }
        }

        if (existsSync(absStoragePath)) {
          targetPdfPath = absStoragePath;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Error resolving fileId for inspection');
    }
  } else if (body.gdriveUrl && typeof body.gdriveUrl === 'string' && body.gdriveUrl.trim() !== '') {
    // Feature 16: Cache Google Drive downloads by hash in data/temp/gdrive_cache
    try {
      const gdriveHash = crypto.createHash('sha256').update(body.gdriveUrl.trim()).digest('hex').substring(0, 16);
      const cacheDir = path.resolve(process.cwd(), 'data/temp/gdrive_cache');
      const fsSync = await import('fs');
      if (!fsSync.existsSync(cacheDir)) {
        fsSync.mkdirSync(cacheDir, { recursive: true });
      }
      const cachedPdfPath = path.join(cacheDir, `gdrive_${gdriveHash}.pdf`);
      if (fsSync.existsSync(cachedPdfPath)) {
        targetPdfPath = cachedPdfPath;
      } else {
        const { downloadGoogleDriveFile } = await import('../../services/drive-download.service.js');
        const dlResult = await downloadGoogleDriveFile(body.gdriveUrl.trim());
        if (dlResult && dlResult.buffer && dlResult.buffer.length >= 100) {
          fsSync.writeFileSync(cachedPdfPath, dlResult.buffer);
          targetPdfPath = cachedPdfPath;
        }
      }
    } catch (gdriveErr) {
      logger.warn({ gdriveErr }, 'Failed to cache Google Drive PDF for inspection');
    }
  }

  if (targetPdfPath && existsSync(targetPdfPath)) {
    try {
      const inspectScript = resolveInspectScript();
      const pythonBin = resolvePythonBin();
      const inspectRes = spawnSync(pythonBin, [inspectScript, targetPdfPath, '--query', text], {
        encoding: 'utf-8',
        timeout: 4000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      if (inspectRes.status === 0 && inspectRes.stdout) {
        try {
          const inspected = JSON.parse(inspectRes.stdout.trim());
          if (inspected && inspected.success) {
            logger.info({ prompt: text, result: inspected }, 'Quiz prompt parsed via ground-truth inspect CLI');
            return reply.send({
              success: true,
              data: {
                pages: inspected.pages || '',
                count: inspected.count || 20,
                start: inspected.start || 1,
                end: inspected.end,
                title: inspected.title || 'BÀI TẬP TRẮC NGHIỆM',
                prefix: inspected.prefix || '',
                confidence: 1.0,
                warnings: [],
                source: 'inspect',
                detected_questions: inspected.detected_questions,
                parity_filter: inspected.parity_filter || 'all',
                section_filter: inspected.section_filter || 'all',
                has_part_i: inspected.has_part_i,
                has_part_ii: inspected.has_part_ii,
                has_part_iii: inspected.has_part_iii,
                part_ii_start: inspected.part_ii_start,
                part_iii_start: inspected.part_iii_start
              }
            });
          }
        } catch (jsonErr) {
          logger.warn({ jsonErr, stdout: inspectRes.stdout }, 'Failed to parse inspect_cli JSON stdout');
        }
      }
    } catch (inspectErr) {
      logger.warn({ inspectErr }, 'Ground-truth inspection failed, falling back to AI/regex parser');
    }
  }

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

  // 1. Sequential Multi-Key AI fallback pipeline
  try {
    const engineTimeouts = await adminTelemetryService.getEngineTimeouts().catch(() => ({
      aiCallSec: 45
    }));
    const aiTimeoutMs = Math.max(12_000, (engineTimeouts.aiCallSec || 45) * 1000);

    const { result, usedKey, latencyMs } = await aiMetricsService.executeWithFallback(async (key) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), aiTimeoutMs);

      try {
        const res = await fetch(`${key.baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key.apiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: key.model,
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

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          const error: any = new Error(`${res.status} ${res.statusText}: ${errBody.slice(0, 150)}`);
          error.status = res.status;
          throw error;
        }

        const json = (await res.json()) as any;
        return json;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          const timeoutErr: any = new Error(`504 Gateway Timeout: Upstream did not respond within ${Math.round(aiTimeoutMs / 1000)}s`);
          timeoutErr.status = 504;
          throw timeoutErr;
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }, { module: 'quiz-prompt', promptSnippet: text.slice(0, 100) });

    const usage = result?.usage;
    aiMetricsService.recordCall({
      module: 'quiz-prompt',
      provider: usedKey.provider,
      model: usedKey.model,
      promptTokens: usage?.prompt_tokens || 120,
      completionTokens: usage?.completion_tokens || 40,
      latencyMs,
      statusCode: 200,
      keyId: usedKey.id,
      keyName: usedKey.name,
      promptSnippet: text.slice(0, 100)
    });

    const rawContent = result.choices?.[0]?.message?.content;
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

      logger.info({ prompt: text, result: { pages: pagesRes, count: countRes, start: startRes, title: titleRes } }, 'Quiz prompt parsed via AI fallback pipeline');

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
  } catch (aiErr: any) {
    logger.warn({ aiErr: aiErr?.message }, 'All AI prompt parsing keys failed or timed out, falling back to deterministic regex parser');
  }

  // 2. Offline / Deterministic Regex
  const regexResult = extractWithRegex(text);
  return reply.send({
    success: true,
    data: regexResult
  });
}
