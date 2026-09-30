import StreamZip from 'node-stream-zip';
import path from 'path';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { FileCorruptedError, NotFoundError, SecurityException, BadRequestError } from '../lib/errors.js';
import { StorageManager } from '../storage/storage.manager.js';
import { ArchiveFileEntry, ArchiveInspectionResult } from '../types/index.js';
import { logger } from '../lib/logger.js';

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const homeserverVenv = '/home/anhduy/dd-studio/engines/document/venv/bin/python3';
  if (existsSync(homeserverVenv)) return homeserverVenv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function resolveArchiveEngine(): string {
  const candidates = [
    path.resolve(process.cwd(), 'engines/converter/archive_engine.py'),
    path.resolve(process.cwd(), '../engines/converter/archive_engine.py'),
    '/home/anhduy/dd-studio/engines/converter/archive_engine.py'
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

export class ArchiveService {
  /**
   * Inspects archive Central Directory with StreamZip, falling back to archive_engine.py
   */
  static async inspectArchive(filePath: string): Promise<ArchiveInspectionResult> {
    if (!existsSync(filePath)) {
      throw new NotFoundError('Archive file does not exist on disk');
    }

    // 1. Fast in-process inspection for standard ZIP
    let zip: InstanceType<typeof StreamZip.async> | null = null;
    try {
      zip = new StreamZip.async({ file: filePath });
      const entries = await zip.entries();

      const tree: ArchiveFileEntry[] = Object.values(entries).map((entry) => {
        const normalizedPath = '/' + entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
        const size = entry.size;
        const compressed = entry.compressedSize;
        const ratio = size > 0 ? Number((compressed / size).toFixed(2)) : 1.0;
        const crcHex = entry.crc !== undefined ? entry.crc.toString(16).toUpperCase().padStart(8, '0') : undefined;

        return {
          path: normalizedPath,
          name: path.basename(entry.name) || entry.name,
          isDirectory: entry.isDirectory,
          sizeBytes: size,
          compressedBytes: compressed,
          compressionRatio: ratio,
          crc32: crcHex,
          lastModified: entry.time ? new Date(entry.time).toISOString() : undefined
        };
      });

      const totalFiles = tree.filter((item) => !item.isDirectory).length;
      const totalUncompressedBytes = tree.reduce((acc, item) => acc + (item.isDirectory ? 0 : item.sizeBytes), 0);
      const totalCompressedBytes = tree.reduce((acc, item) => acc + (item.isDirectory ? 0 : item.compressedBytes), 0);
      const ext = path.extname(filePath).toUpperCase().replace('.', '') || 'ZIP';

      return {
        archiveName: path.basename(filePath),
        totalFiles,
        totalUncompressedBytes,
        totalCompressedBytes,
        format: ext,
        tree,
        entries: tree
      };
    } catch {
      // Not a standard zip or corrupted zip header; proceed to fallback
    } finally {
      if (zip) await zip.close().catch(() => {});
    }

    // 2. Delegate to Universal Archive Engine (7z / tarfile / py7zr)
    try {
      const pythonBin = resolvePythonBin();
      const scriptPath = resolveArchiveEngine();

      const result = await new Promise<ArchiveInspectionResult>((resolve, reject) => {
        const proc = spawn(pythonBin, [scriptPath, 'inspect', '--file', filePath]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => (stdout += d.toString()));
        proc.stderr.on('data', (d) => (stderr += d.toString()));

        proc.on('close', (code) => {
          if (code === 0) {
            try {
              const parsed = JSON.parse(stdout);
              if (parsed.success) resolve(parsed.data);
              else reject(new FileCorruptedError(parsed.error || 'Failed to inspect archive'));
            } catch {
              reject(new FileCorruptedError('Invalid inspection output from archive engine'));
            }
          } else {
            reject(new FileCorruptedError(`Failed to parse archive central directory: ${stderr || stdout}`));
          }
        });
        proc.on('error', (err) => reject(new FileCorruptedError(`Cannot start archive engine: ${err.message}`)));
      });

      return result;
    } catch (err: unknown) {
      if (err instanceof NotFoundError || err instanceof SecurityException || err instanceof FileCorruptedError) {
        throw err;
      }
      logger.warn({ filePath, err }, 'Failed to inspect archive central directory');
      throw new FileCorruptedError(`Failed to parse archive central directory: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Streams a single entry directly with Zip Slip protection
   */
  static async extractSingleMember(
    archivePath: string,
    memberPath: string
  ): Promise<{ stream: Readable; name: string; sizeBytes: number; close: () => Promise<void> }> {
    if (!existsSync(archivePath)) {
      throw new NotFoundError('Archive file does not exist on disk');
    }

    const normalizedMember = memberPath.replace(/\\/g, '/').trim();
    if (
      !normalizedMember ||
      normalizedMember.includes('..') ||
      normalizedMember.startsWith('/') ||
      path.isAbsolute(normalizedMember) ||
      /^[a-zA-Z]:/.test(normalizedMember)
    ) {
      throw new SecurityException(`Zip Slip traversal attempt: ${memberPath}`);
    }

    const virtualDest = path.resolve('virtual_archive_root');
    try {
      StorageManager.sanitizeSafePath(virtualDest, normalizedMember);
    } catch {
      throw new SecurityException(`Path traversal attack detected: ${memberPath}`);
    }

    // 1. Try StreamZip if archive is valid ZIP
    let zip: InstanceType<typeof StreamZip.async> | null = null;
    try {
      zip = new StreamZip.async({ file: archivePath });
      const entries = await zip.entries();
      const targetClean = normalizedMember.replace(/^\/+/, '');
      const entryKey = Object.keys(entries).find((k) => k.replace(/\\/g, '/').replace(/^\/+/, '') === targetClean);

      if (!entryKey) {
        await zip.close();
        throw new NotFoundError(`Member '${memberPath}' not found inside archive`);
      }

      const entry = entries[entryKey];
      if (entry.isDirectory) {
        await zip.close();
        throw new BadRequestError(`Target member '${memberPath}' is a directory, not a file`);
      }
      const stream = (await zip.stream(entry)) as unknown as Readable;
      let isClosed = false;
      const close = async () => {
        if (!isClosed && zip) {
          isClosed = true;
          await zip.close().catch(() => {});
        }
      };
      stream.on('end', () => close());
      stream.on('close', () => close());
      stream.on('error', () => close());
      return { stream, name: path.basename(entry.name), sizeBytes: entry.size, close };
    } catch (zipErr: unknown) {
      if (zip) await zip.close().catch(() => {});
      if (zipErr instanceof NotFoundError || zipErr instanceof BadRequestError) throw zipErr;
    }

    // 2. Stream via Universal Archive Engine
    const pythonBin = resolvePythonBin();
    const scriptPath = resolveArchiveEngine();
    const proc = spawn(pythonBin, [scriptPath, 'extract', '--file', archivePath, '--member', normalizedMember]);

    return {
      stream: proc.stdout,
      name: path.basename(normalizedMember),
      sizeBytes: 0,
      close: async () => {
        try {
          proc.kill();
        } catch {}
      }
    };
  }

  /**
   * Compresses multiple files into an archive (ZIP, TAR, 7Z, TAR.GZ)
   */
  static async compressFiles(
    items: { filePath: string; originalName: string }[],
    outputPath: string,
    format = 'zip',
    compressionLevel = 'normal'
  ): Promise<{ sizeBytes: number }> {
    const pythonBin = resolvePythonBin();
    const scriptPath = resolveArchiveEngine();

    return new Promise((resolve, reject) => {
      const proc = spawn(pythonBin, [
        scriptPath,
        'compress',
        '--output',
        outputPath,
        '--format',
        format,
        '--level',
        compressionLevel,
        '--files',
        JSON.stringify(items)
      ]);

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed.data || { sizeBytes: 0 });
          } catch {
            reject(new Error('Invalid response from archive compression engine'));
          }
        } else {
          reject(new Error(`Compression failed: ${stderr || stdout}`));
        }
      });
      proc.on('error', (err) => reject(new Error(`Failed to start compression engine: ${err.message}`)));
    });
  }
}
