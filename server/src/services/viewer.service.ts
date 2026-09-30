/**
 * ViewerService (< 150 lines)
 * Universal document preview service with headless LibreOffice rasterization and SHA-256 caching
 */

import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { resolvedStoragePaths } from '../config/env.config.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

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
          child.kill('SIGKILL');
          reject(new BadRequestError('Chuyển đổi tệp sang PDF vượt quá thời gian chờ (60s)'));
        }, 60_000);

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(new BadRequestError(`Không thể khởi chạy LibreOffice: ${err.message}`));
        });

        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve();
          } else {
            reject(new BadRequestError(`LibreOffice conversion failed (exit code ${code}): ${stderr}`));
          }
        });
      });

      const files = await fs.readdir(tempJobDir);
      const generatedPdf = files.find((f) => f.toLowerCase().endsWith('.pdf'));

      if (!generatedPdf) {
        throw new BadRequestError('LibreOffice hoàn tất nhưng không tạo ra tệp PDF kết quả');
      }

      await fs.rename(path.join(tempJobDir, generatedPdf), outputPath);
      logger.info({ outputPath }, 'LibreOffice conversion completed successfully');
    } finally {
      await fs.rm(tempJobDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
