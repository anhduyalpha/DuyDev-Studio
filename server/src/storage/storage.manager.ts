/**
 * Storage Manager Service
 * Manages physical filesystem I/O, directory lifecycle, and security path sanitization.
 */

import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolvedStoragePaths } from '../config/env.config.js';
import { logger } from '../lib/logger.js';
import { SecurityException } from '../lib/errors.js';

export class StorageManager {
  /**
   * Ensure root and subdirectories exist on disk
   */
  static async initStorage(): Promise<void> {
    const dirs = [
      resolvedStoragePaths.root,
      resolvedStoragePaths.uploads,
      resolvedStoragePaths.processed,
      resolvedStoragePaths.temp,
      resolvedStoragePaths.drive
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        logger.info({ dir }, 'Created storage directory');
      }
    }
  }

  /**
   * Returns sanitized safe absolute path within user drive sandbox
   */
  static getDrivePath(userRelPath = ''): string {
    const cleanRel = userRelPath.replace(/^\/+/, '').replace(/\\/g, '/');
    return StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, cleanRel);
  }


  /**
   * Returns path for raw uploaded file
   */
  static getUploadPath(fileId: string, ext = '.bin'): string {
    return path.join(resolvedStoragePaths.uploads, `${fileId}${ext}`);
  }

  /**
   * Returns path for processed artifact
   */
  static getProcessedPath(fileId: string, ext: string): string {
    const sanitizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    return path.join(resolvedStoragePaths.processed, `${fileId}${sanitizedExt}`);
  }

  /**
   * Returns path for temporary scratch file
   */
  static getTempPath(tempId: string, ext = '.tmp'): string {
    return path.join(resolvedStoragePaths.temp, `${tempId}${ext}`);
  }

  /**
   * Computes SHA-256 hash of a file on disk via streaming
   */
  static async computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Path Traversal Sanitizer
   * Validates that requested relative path does not escape destination sandbox
   */
  static sanitizeSafePath(destinationDir: string, userPath: string): string {
    const dest = path.resolve(destinationDir);
    const resolved = path.resolve(dest, userPath);

    if (!resolved.startsWith(dest + path.sep) && resolved !== dest) {
      throw new SecurityException(`Path traversal violation: ${userPath}`);
    }

    return resolved;
  }

  /**
   * Safely deletes file from disk
   */
  static async unlinkSafe(filePath: string): Promise<boolean> {
    try {
      if (existsSync(filePath)) {
        await fs.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn({ filePath, err: error }, 'Failed to unlink file');
      return false;
    }
  }

  /**
   * Recursively computes total size and file/folder counts in a directory
   */
  static async getDirectoryStats(dirPath: string): Promise<{ sizeBytes: number; fileCount: number; dirCount: number }> {
    let sizeBytes = 0;
    let fileCount = 0;
    let dirCount = 0;

    async function walk(curr: string) {
      if (!existsSync(curr)) return;
      const entries = await fs.readdir(curr, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(curr, entry.name);
        if (entry.isDirectory()) {
          dirCount++;
          await walk(full);
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const st = await fs.stat(full);
            sizeBytes += st.size;
          } catch {}
        }
      }
    }

    await walk(dirPath);
    return { sizeBytes, fileCount, dirCount };
  }

  /**
   * Gets filesystem disk free/total stats for a directory
   */
  static async getDiskStats(targetDir = resolvedStoragePaths.drive): Promise<{ freeBytes: number; totalBytes: number }> {
    try {
      if (typeof fs.statfs === 'function' && existsSync(targetDir)) {
        const stat = await fs.statfs(targetDir);
        const freeBytes = Number(stat.bavail) * Number(stat.bsize);
        const totalBytes = Number(stat.blocks) * Number(stat.bsize);
        return { freeBytes, totalBytes };
      }
    } catch (err) {
      logger.debug({ err }, 'statfs not supported or failed');
    }
    return { freeBytes: 100 * 1024 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 * 1024 };
  }
}

