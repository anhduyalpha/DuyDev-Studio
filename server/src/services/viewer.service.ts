/**
 * ViewerService (< 150 lines)
 * Universal document preview service with headless LibreOffice rasterization and SHA-256 caching
 */

import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { resolvedStoragePaths } from '../config/env.config.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN && existsSync(process.env.PYTHON_BIN)) {
    return process.env.PYTHON_BIN;
  }
  const candidateVenvs = [
    '/home/anhduy/dd-studio/engines/document/venv/bin/python',
    '/home/anhduy/dd-studio/engines/document/venv/bin/python3',
    '/home/anhduy/dd-studio/engines/converter/file_conversor_core/venv/bin/python'
  ];
  for (const v of candidateVenvs) {
    if (existsSync(v)) return v;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function resolveLibreOfficeBin(): string {
  if (process.env.LIBREOFFICE_BIN && existsSync(process.env.LIBREOFFICE_BIN)) {
    return process.env.LIBREOFFICE_BIN;
  }
  const candidates = [
    '/usr/bin/soffice',
    '/usr/bin/libreoffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    'soffice',
    'libreoffice'
  ];
  for (const c of candidates) {
    if (path.isAbsolute(c) && existsSync(c)) return c;
  }
  return 'soffice';
}

export class ViewerService {
  /**
   * Resolves or converts source file to a PDF for preview
   */
  static async getPreviewPdfPath(sourcePath: string): Promise<string> {
    if (!existsSync(sourcePath)) {
      throw new NotFoundError(`Physical file not found: ${sourcePath}`);
    }

    // Direct passthrough for PDF files
    if (sourcePath.toLowerCase().endsWith('.pdf')) {
      return sourcePath;
    }

    // Fast-path: serve pre-compiled sibling .pdf if it exists alongside the source file (e.g. SlideShare PDF + PPTX pair)
    const siblingPdfPath = sourcePath.replace(/\.[^.\\/]+$/, '.pdf');
    if (siblingPdfPath !== sourcePath && existsSync(siblingPdfPath)) {
      const siblingStat = await fs.stat(siblingPdfPath);
      if (siblingStat.size > 0) {
        logger.debug({ sourcePath, siblingPdfPath }, 'Serving existing sibling PDF for preview');
        return siblingPdfPath;
      }
    }

    const stat = await fs.stat(sourcePath);
    const hash = crypto.createHash('sha256').update(`${sourcePath}:${stat.mtimeMs}:${stat.size}`).digest('hex');
    const cacheDir = path.join(resolvedStoragePaths.temp, 'previews');
    await fs.mkdir(cacheDir, { recursive: true });
    const cachedPdfPath = path.join(cacheDir, `${hash}.pdf`);

    if (existsSync(cachedPdfPath)) {
      const cacheStat = await fs.stat(cachedPdfPath);
      if (cacheStat.size > 0) {
        logger.debug({ sourcePath, cachedPdfPath }, 'Serving PDF preview from cache');
        return cachedPdfPath;
      }
    }

    await ViewerService.convertDocToPdf(sourcePath, cachedPdfPath);
    return cachedPdfPath;
  }

  /**
   * Converts a document to PDF using headless LibreOffice
   */
  static async convertDocToPdf(inputPath: string, outputPath: string): Promise<void> {
    const bin = resolveLibreOfficeBin();
    const tempJobDir = path.join(
      resolvedStoragePaths.temp,
      'previews',
      `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );
    await fs.mkdir(tempJobDir, { recursive: true });

    logger.info({ bin, inputPath, tempJobDir }, 'Starting LibreOffice PDF conversion');

    try {
      const userProfileUrl = `file:///${path.resolve(tempJobDir, 'profile').replace(/\\/g, '/')}`;
      await new Promise<void>((resolve, reject) => {
        const child = spawn(bin, [
          '--headless',
          '--invisible',
          '--nologo',
          '--nodefault',
          '--nofirststartwizard',
          '--nolockcheck',
          '--norestore',
          `-env:UserInstallation=${userProfileUrl}`,
          '--convert-to',
          'pdf',
          '--outdir',
          tempJobDir,
          inputPath
        ]);

        let stderr = '';
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        const timer = setTimeout(() => {
          try {
            if (process.platform === 'win32' && child.pid) {
              spawn('taskkill', ['/pid', child.pid.toString(), '/T', '/F']);
            } else if (child.pid) {
              try {
                process.kill(-child.pid, 'SIGKILL');
              } catch {
                child.kill('SIGKILL');
              }
            } else {
              child.kill();
            }
          } catch {}
          reject(new BadRequestError('Chuyển đổi tệp sang PDF vượt quá thời gian chờ (30s)'));
        }, 30_000);

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(new BadRequestError(`Không thể khởi chạy LibreOffice: ${err.message}`));
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve();
          } else {
            const isPasswordOrCorrupt = /password|encrypted|corrupt|damaged|unsupported/i.test(stderr);
            const msg = isPasswordOrCorrupt
              ? 'Tệp tài liệu bị hỏng hoặc có mật khẩu bảo vệ không thể chuyển đổi'
              : `LibreOffice conversion failed (exit code ${code}): ${stderr || 'Lỗi không xác định'}`;
            reject(new BadRequestError(msg));
          }
        });
      });

      const files = await fs.readdir(tempJobDir);
      const generatedPdf = files.find((f) => f.toLowerCase().endsWith('.pdf'));

      if (!generatedPdf) {
        if (/\.pptx$/i.test(inputPath)) {
          await ViewerService.convertPptxToPdfPython(inputPath, outputPath);
          return;
        }
        throw new BadRequestError('LibreOffice hoàn tất nhưng không tạo ra tệp PDF kết quả');
      }

      await fs.rename(path.join(tempJobDir, generatedPdf), outputPath);
      logger.info({ outputPath }, 'LibreOffice conversion completed successfully');
    } catch (err) {
      if (/\.pptx$/i.test(inputPath)) {
        try {
          await ViewerService.convertPptxToPdfPython(inputPath, outputPath);
          return;
        } catch (pyErr) {
          logger.warn({ pyErr }, 'Python PPTX to PDF fallback also failed');
        }
      }
      throw err;
    } finally {
      await fs.rm(tempJobDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Fallback converter for .pptx to .pdf using python-pptx + PyMuPDF when LibreOffice Impress is missing
   */
  static async convertPptxToPdfPython(inputPath: string, outputPath: string): Promise<void> {
    const pyBin = resolvePythonBin();
    const pyCode = [
      'import sys, fitz, pptx',
      'prs = pptx.Presentation(sys.argv[1])',
      'doc = fitz.open()',
      'w = float(prs.slide_width or 12192000) / 12700.0',
      'h = float(prs.slide_height or 6858000) / 12700.0',
      'for slide in prs.slides:',
      '    page = doc.new_page(width=w, height=h)',
      '    for shape in slide.shapes:',
      '        l = float(getattr(shape, "left", 0) or 0) / 12700.0',
      '        t = float(getattr(shape, "top", 0) or 0) / 12700.0',
      '        sw = float(getattr(shape, "width", 0) or 0) / 12700.0',
      '        sh = float(getattr(shape, "height", 0) or 0) / 12700.0',
      '        rect = fitz.Rect(l, t, max(l + 1, l + sw), max(t + 1, t + sh))',
      '        if hasattr(shape, "image"):',
      '            try: page.insert_image(rect, stream=shape.image.blob)',
      '            except Exception: pass',
      '        elif getattr(shape, "has_text_frame", False) and shape.text.strip():',
      '            try: page.insert_textbox(rect, shape.text.strip(), fontsize=14)',
      '            except Exception: pass',
      'if len(doc) == 0: sys.exit(2)',
      'doc.save(sys.argv[2])',
      'doc.close()'
    ].join('\n');

    await execFileAsync(pyBin, ['-c', pyCode, inputPath, outputPath], { timeout: 30_000 });
    if (!existsSync(outputPath)) {
      throw new BadRequestError('Không thể chuyển đổi tệp PowerPoint sang PDF xem trước');
    }
    logger.info({ inputPath, outputPath }, 'Converted PPTX to PDF via Python fallback');
  }
}
