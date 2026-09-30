/**
 * DriveService - Core logic for CasaOS-style Personal File Storage
 * Handles directory traversal, file metadata, safe file management, and folder archiving.
 */

import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { getMimeTypeForExt } from '../schemas/converter.schema.js';
import { BadRequestError, NotFoundError, SecurityException } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export interface DriveItem {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  updatedAt: string;
  mimeType: string;
  extension: string;
}

export interface DriveListResult {
  currentPath: string;
  items: DriveItem[];
  stats: {
    totalItems: number;
    totalFiles: number;
    totalDirs: number;
    driveUsedBytes: number;
    diskFreeBytes: number;
    diskTotalBytes: number;
  };
}

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const homeserverVenv = '/home/anhduy/dd-studio/engines/document/venv/bin/python3';
  if (existsSync(homeserverVenv)) return homeserverVenv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export class DriveService {
  /**
   * Normalizes incoming user relative path to a clean POSIX path
   */
  static normalizeRelativePath(rawPath = ''): string {
    if (!rawPath || typeof rawPath !== 'string') return '/';
    let clean = rawPath.replace(/\\/g, '/').trim();
    if (!clean.startsWith('/')) clean = '/' + clean;
    // Remove duplicate slashes and path traversal sequences
    const parts = clean.split('/').filter(p => p && p !== '.');
    const safeParts: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        safeParts.pop();
      } else {
        safeParts.push(part);
      }
    }
    return '/' + safeParts.join('/');
  }

  /**
   * Returns absolute disk path safe within drive sandbox
   */
  static getDiskPath(relPath = ''): string {
    const normalized = this.normalizeRelativePath(relPath);
    return StorageManager.getDrivePath(normalized.replace(/^\//, ''));
  }

  /**
   * Lists items and stats for a given drive directory
   */
  static async listFiles(userRelPath = '/'): Promise<DriveListResult> {
    const normalizedRel = this.normalizeRelativePath(userRelPath);
    const diskPath = this.getDiskPath(normalizedRel);

    if (!existsSync(diskPath)) {
      if (normalizedRel === '/') {
        await fs.mkdir(diskPath, { recursive: true });
      } else {
        throw new NotFoundError(`Thư mục '${normalizedRel}' không tồn tại`);
      }
    }

    const stat = await fs.stat(diskPath);
    if (!stat.isDirectory()) {
      throw new BadRequestError(`Đường dẫn '${normalizedRel}' không phải là thư mục`);
    }

    const entries = await fs.readdir(diskPath, { withFileTypes: true });
    const items: DriveItem[] = [];

    for (const entry of entries) {
      const entryDiskPath = path.join(diskPath, entry.name);
      const itemRelPath = normalizedRel === '/' ? `/${entry.name}` : `${normalizedRel}/${entry.name}`;
      try {
        const itemStat = await fs.stat(entryDiskPath);
        const isDir = entry.isDirectory();
        const ext = isDir ? '' : path.extname(entry.name).toLowerCase().replace(/^\./, '');
        const mimeType = isDir ? 'inode/directory' : getMimeTypeForExt(ext);

        items.push({
          name: entry.name,
          path: itemRelPath,
          isDirectory: isDir,
          sizeBytes: isDir ? 0 : itemStat.size,
          updatedAt: itemStat.mtime.toISOString(),
          mimeType,
          extension: ext
        });
      } catch (err) {
        logger.debug({ entryDiskPath, err }, 'Failed to stat drive entry');
      }
    }

    // Sort folders first alphabetically, then files alphabetically
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    const dirStats = await StorageManager.getDirectoryStats(diskPath);
    const driveTotalStats = await StorageManager.getDirectoryStats(resolvedStoragePaths.drive);
    const diskStats = await StorageManager.getDiskStats(resolvedStoragePaths.drive);

    return {
      currentPath: normalizedRel,
      items,
      stats: {
        totalItems: items.length,
        totalFiles: dirStats.fileCount,
        totalDirs: dirStats.dirCount,
        driveUsedBytes: driveTotalStats.sizeBytes,
        diskFreeBytes: diskStats.freeBytes,
        diskTotalBytes: diskStats.totalBytes
      }
    };
  }

  /**
   * Creates a new subdirectory safely
   */
  static async createFolder(parentRelPath: string, folderName: string): Promise<DriveItem> {
    if (!folderName || typeof folderName !== 'string') {
      throw new BadRequestError('Tên thư mục không được để trống');
    }
    const trimmed = folderName.trim();
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..') || /[<>:"|?*]/.test(trimmed)) {
      throw new BadRequestError('Tên thư mục không hợp lệ hoặc chứa ký tự bị cấm');
    }
    const cleanName = trimmed;
    if (!cleanName || cleanName === '.') {
      throw new BadRequestError('Tên thư mục không hợp lệ');
    }

    const normalizedParent = this.normalizeRelativePath(parentRelPath);
    const newRelPath = normalizedParent === '/' ? `/${cleanName}` : `${normalizedParent}/${cleanName}`;
    const newDiskPath = this.getDiskPath(newRelPath);

    if (existsSync(newDiskPath)) {
      throw new BadRequestError(`Thư mục '${cleanName}' đã tồn tại`);
    }

    await fs.mkdir(newDiskPath, { recursive: true });
    const stat = await fs.stat(newDiskPath);

    return {
      name: cleanName,
      path: newRelPath,
      isDirectory: true,
      sizeBytes: 0,
      updatedAt: stat.mtime.toISOString(),
      mimeType: 'inode/directory',
      extension: ''
    };
  }

  /**
   * Deletes a file or directory recursively
   */
  static async deleteItem(userRelPath: string): Promise<boolean> {
    const normalized = this.normalizeRelativePath(userRelPath);
    if (normalized === '/' || normalized === '') {
      throw new BadRequestError('Không thể xóa thư mục gốc lưu trữ');
    }

    const diskPath = this.getDiskPath(normalized);
    if (!existsSync(diskPath)) {
      throw new NotFoundError(`Mục '${normalized}' không tồn tại`);
    }

    const stat = await fs.stat(diskPath);
    if (stat.isDirectory()) {
      await fs.rm(diskPath, { recursive: true, force: true });
    } else {
      await fs.unlink(diskPath);
    }
    return true;
  }

  /**
   * Renames a file or directory
   */
  static async renameItem(userRelPath: string, newName: string): Promise<DriveItem> {
    const normalized = this.normalizeRelativePath(userRelPath);
    if (normalized === '/' || normalized === '') {
      throw new BadRequestError('Không thể đổi tên thư mục gốc');
    }

    if (!newName || typeof newName !== 'string') {
      throw new BadRequestError('Tên mới không được để trống');
    }
    const trimmed = newName.trim();
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..') || /[<>:"|?*]/.test(trimmed)) {
      throw new BadRequestError('Tên mới không hợp lệ hoặc chứa ký tự bị cấm');
    }
    const cleanName = trimmed;
    if (!cleanName || cleanName === '.') {
      throw new BadRequestError('Tên mới không hợp lệ');
    }


    const oldDiskPath = this.getDiskPath(normalized);
    if (!existsSync(oldDiskPath)) {
      throw new NotFoundError(`Mục '${normalized}' không tồn tại`);
    }

    const parentDir = path.dirname(oldDiskPath);
    const newDiskPath = path.join(parentDir, cleanName);

    // Verify sandbox integrity
    StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, newDiskPath));

    if (existsSync(newDiskPath)) {
      throw new BadRequestError(`Đã tồn tại mục có tên '${cleanName}' trong cùng thư mục`);
    }

    await fs.rename(oldDiskPath, newDiskPath);
    const stat = await fs.stat(newDiskPath);
    const isDir = stat.isDirectory();
    const ext = isDir ? '' : path.extname(cleanName).toLowerCase().replace(/^\./, '');
    const parentRel = path.dirname(normalized);
    const newRelPath = parentRel === '/' ? `/${cleanName}` : `${parentRel}/${cleanName}`;

    return {
      name: cleanName,
      path: newRelPath,
      isDirectory: isDir,
      sizeBytes: isDir ? 0 : stat.size,
      updatedAt: stat.mtime.toISOString(),
      mimeType: isDir ? 'inode/directory' : getMimeTypeForExt(ext),
      extension: ext
    };
  }

  /**
   * Archives an entire folder to a temporary ZIP file and returns its path
   */
  static async archiveFolderToZip(userRelPath: string): Promise<{ zipPath: string; zipName: string }> {
    const normalized = this.normalizeRelativePath(userRelPath);
    const diskPath = this.getDiskPath(normalized);

    if (!existsSync(diskPath)) {
      throw new NotFoundError(`Thư mục '${normalized}' không tồn tại`);
    }

    const folderName = normalized === '/' ? 'Storage_Root' : path.basename(diskPath);
    const zipName = `${folderName}_${Date.now().toString(36)}.zip`;
    const tempZipPath = path.join(resolvedStoragePaths.temp, zipName);

    const pythonBin = resolvePythonBin();
    const script = `
import zipfile, os, sys
folder = sys.argv[1]
out_zip = sys.argv[2]
with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(folder):
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, folder)
            zf.write(full, rel)
print("OK")
`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonBin, ['-c', script, diskPath, tempZipPath]);
      let errStr = '';
      proc.stderr.on('data', d => (errStr += d.toString()));
      proc.on('close', code => {
        if (code === 0 && existsSync(tempZipPath)) {
          resolve();
        } else {
          reject(new Error(`Failed to zip folder: ${errStr}`));
        }
      });
      proc.on('error', reject);
    });

    return { zipPath: tempZipPath, zipName: `${folderName}.zip` };
  }

  /**
   * Returns drive stats
   */
  static async getDriveStats() {
    const driveDir = resolvedStoragePaths.drive;
    const dirStats = await StorageManager.getDirectoryStats(driveDir);
    const diskStats = await StorageManager.getDiskStats(driveDir);
    return {
      usedBytes: dirStats.sizeBytes,
      fileCount: dirStats.fileCount,
      dirCount: dirStats.dirCount,
      diskFreeBytes: diskStats.freeBytes,
      diskTotalBytes: diskStats.totalBytes
    };
  }
}
