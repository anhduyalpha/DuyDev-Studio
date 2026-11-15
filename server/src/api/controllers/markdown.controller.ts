import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { prisma } from '../../lib/prisma.js';
import { StorageManager } from '../../storage/storage.manager.js';
import { computeExpiresAt } from '../../config/limits.config.js';
import { BadRequestError, AppError } from '../../lib/errors.js';
import { markdownExportSchema, sanitizeMarkdownFilename } from '../../schemas/markdown.schema.js';
import { ViewerService } from '../../services/viewer.service.js';
import { logger } from '../../lib/logger.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN && existsSync(process.env.PYTHON_BIN)) return process.env.PYTHON_BIN;
  const candidates = [
    path.resolve(process.cwd(), 'engines/document/venv/bin/python3'),
    path.resolve(process.cwd(), '../engines/document/venv/bin/python3'),
    path.resolve(process.cwd(), '../engines/document/venv/Scripts/python.exe'),
    '/home/anhduy/dd-studio/engines/document/venv/bin/python3',
    '/home/anhduy/dd-studio/engines/document/venv/bin/python'
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolvePythonScript(): string {
  const candidates = [
    path.resolve(process.cwd(), 'engines/document/markdown_to_docx.py'),
    path.resolve(process.cwd(), '../engines/document/markdown_to_docx.py'),
    path.resolve(__dirname, '../../../../engines/document/markdown_to_docx.py'),
    path.resolve(__dirname, '../../../engines/document/markdown_to_docx.py')
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

function resolveChromiumBin(): string | null {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  if (process.env.CHROMIUM_BIN && existsSync(process.env.CHROMIUM_BIN)) return process.env.CHROMIUM_BIN;
  if (process.env.EDGE_BIN && existsSync(process.env.EDGE_BIN)) return process.env.EDGE_BIN;

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

/**
 * Sanitizes markdown string and converts it to self-contained printable HTML
 * with zero raw executable script tags or inline event attributes.
 */
function renderPrintableHtml(markdown: string, title: string): string {
  // Pre-strip active injection attacks
  let safeMd = markdown
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
    .replace(/href\s*=\s*['"]?(?:javascript:|data:text\/html)[^'">\s]*/gi, '');

  // HTML entity encode remaining raw angle brackets and special chars
  let bodyHtml = safeMd
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Headings
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold / Italic
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Blockquote
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    // Fenced Code Blocks
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    // Unordered lists
    .replace(/^[\*\-]\s+(.*$)/gim, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\.\s+(.*$)/gim, '<li>$1</li>')
    // Tables
    .replace(/\|(.*)\|/gim, (match) => {
      const cells = match.split('|').filter((c) => c.trim() !== '');
      if (cells.some((c) => c.includes('---'))) {
        return '';
      }
      return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join('')}</tr>`;
    })
    // Line breaks
    .replace(/\n\n/gim, '<p></p>');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      font-weight: 700;
      margin-top: 0;
      margin-bottom: 12pt;
      padding-bottom: 6pt;
      border-bottom: 1.5pt solid #e2e8f0;
      color: #0f172a;
    }
    h2 {
      font-size: 15pt;
      font-weight: 700;
      margin-top: 18pt;
      margin-bottom: 8pt;
      padding-bottom: 4pt;
      border-bottom: 1pt solid #e2e8f0;
      color: #1e293b;
    }
    h3 {
      font-size: 12pt;
      font-weight: 600;
      margin-top: 14pt;
      margin-bottom: 6pt;
      color: #334155;
    }
    p {
      margin-top: 0;
      margin-bottom: 8pt;
    }
    strong {
      font-weight: 600;
      color: #0f172a;
    }
    em {
      font-style: italic;
    }
    blockquote {
      margin: 8pt 0;
      padding: 6pt 12pt;
      border-left: 3.5pt solid #4f46e5;
      background-color: #f8fafc;
      color: #475569;
      font-style: italic;
    }
    pre {
      background-color: #f1f5f9;
      border: 1pt solid #e2e8f0;
      border-radius: 6pt;
      padding: 8pt 10pt;
      font-family: Consolas, Monaco, "Courier New", monospace;
      font-size: 9pt;
      line-height: 1.4;
      overflow-x: auto;
      margin: 10pt 0;
    }
    code {
      font-family: Consolas, Monaco, "Courier New", monospace;
      font-size: 9.5pt;
      background-color: #f1f5f9;
      color: #4f46e5;
      padding: 1pt 3pt;
      border-radius: 3pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 10pt;
    }
    th, td {
      border: 1pt solid #cbd5e1;
      padding: 6pt 8pt;
      text-align: left;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    li {
      margin-bottom: 4pt;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

export async function exportMarkdownHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = markdownExportSchema.safeParse(request.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors.map((e) => e.message).join(', ');
    throw new BadRequestError(`Validation failed: ${errorMsg}`);
  }

  const { format, markdown, filename } = parseResult.data;
  const safeBaseName = sanitizeMarkdownFilename(filename);

  const deviceId =
    (request.headers['x-device-id'] as string) ||
    (request.headers['x-client-device-id'] as string) ||
    null;

  // Sandbox temp workspace for artifact generation
  const tempId = `md_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const tempDir = StorageManager.getTempPath(tempId);
  await fs.mkdir(tempDir, { recursive: true });

  const inputMdPath = path.join(tempDir, 'source.md');
  const tempDocxPath = path.join(tempDir, `${safeBaseName}.docx`);
  const tempPdfPath = path.join(tempDir, `${safeBaseName}.pdf`);
  const tempHtmlPath = path.join(tempDir, `${safeBaseName}.html`);

  await fs.writeFile(inputMdPath, markdown, 'utf-8');

  try {
    const pythonBin = resolvePythonBin();
    const pythonScript = resolvePythonScript();

    if (format === 'docx') {
      await execFileAsync(
        pythonBin,
        [pythonScript, inputMdPath, tempDocxPath, '--title', safeBaseName],
        { timeout: 45000 }
      );

      if (!existsSync(tempDocxPath)) {
        throw new AppError('DOCX export failed to produce output file', 500);
      }
    } else if (format === 'pdf') {
      const chromiumBin = resolveChromiumBin();
      let pdfGenerated = false;

      if (chromiumBin) {
        try {
          const htmlContent = renderPrintableHtml(markdown, safeBaseName);
          await fs.writeFile(tempHtmlPath, htmlContent, 'utf-8');

          // Strict Chromium headless invocation with network disabled
          const chromeArgs = [
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-background-networking',
            '--host-resolver-rules="MAP * ~NOTFOUND"',
            `--print-to-pdf=${tempPdfPath}`,
            tempHtmlPath
          ];

          await execFileAsync(chromiumBin, chromeArgs, { timeout: 45000 });
          if (existsSync(tempPdfPath)) {
            const stat = await fs.stat(tempPdfPath);
            if (stat.size > 0) {
              pdfGenerated = true;
            }
          }
        } catch (chromeErr) {
          logger.warn({ chromeErr }, 'Chromium PDF conversion failed, attempting LibreOffice fallback');
        }
      }

      // Fallback: DOCX via markdown_to_docx.py -> LibreOffice PDF
      if (!pdfGenerated) {
        await execFileAsync(
          pythonBin,
          [pythonScript, inputMdPath, tempDocxPath, '--title', safeBaseName],
          { timeout: 45000 }
        );
        if (!existsSync(tempDocxPath)) {
          throw new AppError('Intermediate DOCX generation failed for PDF conversion', 500);
        }
        await ViewerService.convertDocToPdf(tempDocxPath, tempPdfPath);
        if (!existsSync(tempPdfPath)) {
          throw new AppError('PDF conversion via LibreOffice fallback failed', 500);
        }
      }
    }

    const sourceArtifact = format === 'docx' ? tempDocxPath : tempPdfPath;
    const finalExt = format === 'docx' ? '.docx' : '.pdf';
    const finalMime =
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
    const finalFileName = `${safeBaseName}${finalExt}`;

    const fileId = `fil_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const destinationPath = StorageManager.getProcessedPath(fileId, finalExt);

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourceArtifact, destinationPath);
    const stats = await fs.stat(destinationPath);
    const sha256Hash = await StorageManager.computeSha256(destinationPath);
    const expiresAt = computeExpiresAt();

    const fileRecord = await prisma.fileRecord.create({
      data: {
        id: fileId,
        purpose: 'PROCESSED_ARTIFACT',
        originalName: finalFileName,
        storagePath: destinationPath,
        mimeType: finalMime,
        sizeBytes: BigInt(stats.size),
        hashSha256: sha256Hash,
        isPurged: false,
        expiresAt
      }
    });

    try {
      await prisma.historyRecord.create({
        data: {
          deviceId,
          toolId: 'markdown-docs',
          toolTitle: 'Markdown Editor',
          fileName: finalFileName,
          originalSize: BigInt(Buffer.byteLength(markdown, 'utf-8')),
          resultSize: BigInt(stats.size),
          resultFileId: fileRecord.id,
          downloadUrl: `/api/v1/files/download/${fileRecord.id}`,
          status: 'success',
          detailsJson: JSON.stringify({
            format,
            title: safeBaseName
          })
        }
      });
    } catch (histErr) {
      logger.warn({ histErr }, 'Failed to record HistoryRecord for Markdown export');
    }

    logger.info(
      { fileId: fileRecord.id, fileName: finalFileName, sizeBytes: stats.size, format },
      'Markdown exported successfully'
    );

    return reply.status(201).send({
      fileId: fileRecord.id,
      downloadUrl: `/api/v1/files/download/${fileRecord.id}`,
      fileName: finalFileName,
      sizeBytes: Number(stats.size)
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
