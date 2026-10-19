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
  metadata?: Record<string, any>;
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

interface DriveStatsCache {
  usedBytes: number;
  fileCount: number;
  dirCount: number;
  diskFreeBytes: number;
  diskTotalBytes: number;
}

let cachedDriveStats: { data: DriveStatsCache; timestamp: number } | null = null;
const STATS_CACHE_TTL_MS = 5000;

function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  const homeserverVenv = '/home/anhduy/dd-studio/engines/document/venv/bin/python3';
  if (existsSync(homeserverVenv)) return homeserverVenv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

export class DriveService {
  /**
   * Invalidates cached drive telemetry stats
   */
  static invalidateStatsCache(): void {
    cachedDriveStats = null;
  }

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
    let diskPath = this.getDiskPath(normalizedRel);

    if (!existsSync(diskPath)) {
      if (normalizedRel.toLowerCase() === '/youtube') {
        const altPath = this.getDiskPath('/YouTube');
        if (existsSync(altPath)) {
          diskPath = altPath;
        } else {
          await fs.mkdir(diskPath, { recursive: true });
        }
      } else if (normalizedRel === '/' || normalizedRel === '/tiktok') {
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
      if (
        entry.name.includes('.tmp_') ||
        entry.name.endsWith('.tmp') ||
        entry.name.endsWith('.meta.json') ||
        entry.name.endsWith('.thumb.jpg') ||
        (entry.name.startsWith('.') && entry.name !== '.' && entry.name !== '..')
      ) {
        continue;
      }

      const entryDiskPath = path.join(diskPath, entry.name);
      const itemRelPath = normalizedRel === '/' ? `/${entry.name}` : `${normalizedRel}/${entry.name}`;
      try {
        const itemStat = await fs.stat(entryDiskPath);
        const isDir = itemStat.isDirectory();
        const ext = isDir ? '' : path.extname(entry.name).toLowerCase().replace(/^\./, '');
        const mimeType = isDir ? 'inode/directory' : getMimeTypeForExt(ext);

        let metadata: Record<string, any> | undefined = undefined;
        if (!isDir) {
          const metaPath = path.join(diskPath, `${entry.name.replace(/\.[^.]+$/, '')}.meta.json`);
          if (existsSync(metaPath)) {
            try {
              const rawMeta = await fs.readFile(metaPath, 'utf8');
              metadata = JSON.parse(rawMeta);
            } catch {
              // ignore parse errors
            }
          }
        }

        items.push({
          name: entry.name,
          path: itemRelPath,
          isDirectory: isDir,
          sizeBytes: isDir ? 0 : itemStat.size,
          updatedAt: itemStat.mtime.toISOString(),
          mimeType,
          extension: ext,
          ...(metadata ? { metadata } : {})
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

    const driveStats = await this.getDriveStats();
    const isRoot = normalizedRel === '/';
    const fileCount = isRoot ? driveStats.fileCount : items.filter(i => !i.isDirectory).length;
    const dirCount = isRoot ? driveStats.dirCount : items.filter(i => i.isDirectory).length;

    return {
      currentPath: normalizedRel,
      items,
      stats: {
        totalItems: items.length,
        totalFiles: fileCount,
        totalDirs: dirCount,
        driveUsedBytes: driveStats.usedBytes,
        diskFreeBytes: driveStats.diskFreeBytes,
        diskTotalBytes: driveStats.diskTotalBytes
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
    DriveService.invalidateStatsCache();
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
      const baseName = diskPath.replace(/\.[^.]+$/, '');
      const metaPath = `${baseName}.meta.json`;
      if (existsSync(metaPath)) await fs.unlink(metaPath).catch(() => {});
      const thumbPath = `${baseName}.thumb.jpg`;
      if (existsSync(thumbPath)) await fs.unlink(thumbPath).catch(() => {});
    }
    DriveService.invalidateStatsCache();
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

    const oldDiskPath = this.getDiskPath(normalized);
    if (!existsSync(oldDiskPath)) {
      throw new NotFoundError(`Mục '${normalized}' không tồn tại`);
    }

    const oldName = path.basename(oldDiskPath);
    const cleanName = trimmed;
    if (!cleanName || cleanName === '.') {
      throw new BadRequestError('Tên mới không hợp lệ');
    }

    if (oldName === cleanName) {
      throw new BadRequestError('Tên mới trùng với tên hiện tại');
    }

    const parentDir = path.dirname(oldDiskPath);
    const newDiskPath = path.join(parentDir, cleanName);

    // Verify sandbox integrity
    StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, newDiskPath));

    const isSameCaseInsensitive = oldName.toLowerCase() === cleanName.toLowerCase();
    if (!isSameCaseInsensitive && existsSync(newDiskPath)) {
      throw new BadRequestError(`Đã tồn tại mục có tên '${cleanName}' trong cùng thư mục`);
    }

    // On Windows NTFS, case-change rename requires a two-step rename via temp file
    if (process.platform === 'win32' && isSameCaseInsensitive) {
      const tempIntermediate = `${oldDiskPath}.tmp_case_${Date.now()}`;
      await fs.rename(oldDiskPath, tempIntermediate);
      await fs.rename(tempIntermediate, newDiskPath);
    } else {
      await fs.rename(oldDiskPath, newDiskPath);
    }

    const oldBase = oldDiskPath.replace(/\.[^.]+$/, '');
    const newBase = newDiskPath.replace(/\.[^.]+$/, '');
    const oldMeta = `${oldBase}.meta.json`;
    const newMeta = `${newBase}.meta.json`;
    if (existsSync(oldMeta)) await fs.rename(oldMeta, newMeta).catch(() => {});
    const oldThumb = `${oldBase}.thumb.jpg`;
    const newThumb = `${newBase}.thumb.jpg`;
    if (existsSync(oldThumb)) await fs.rename(oldThumb, newThumb).catch(() => {});

    DriveService.invalidateStatsCache();

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
   * Moves a file or directory into a destination directory
   */
  static async moveItem(userRelPath: string, destinationDirRelPath: string): Promise<DriveItem> {
    const normSource = this.normalizeRelativePath(userRelPath);
    if (normSource === '/' || normSource === '') {
      throw new BadRequestError('Không thể di chuyển thư mục gốc');
    }
    const normDest = this.normalizeRelativePath(destinationDirRelPath);

    const sourceDiskPath = this.getDiskPath(normSource);
    if (!existsSync(sourceDiskPath)) {
      throw new NotFoundError(`Mục nguồn '${normSource}' không tồn tại`);
    }

    const destDirDiskPath = this.getDiskPath(normDest);
    if (!existsSync(destDirDiskPath)) {
      throw new NotFoundError(`Thư mục đích '${normDest}' không tồn tại`);
    }
    const destStat = await fs.stat(destDirDiskPath);
    if (!destStat.isDirectory()) {
      throw new BadRequestError(`Đích đến '${normDest}' phải là một thư mục`);
    }

    // Prevent moving a directory into itself or a subdirectory of itself
    if (normDest === normSource || normDest.startsWith(normSource + '/')) {
      throw new BadRequestError('Không thể di chuyển thư mục vào chính nó hoặc vào thư mục con của nó');
    }

    // Prevent moving item into its current parent folder
    const sourceParentDir = this.normalizeRelativePath(path.posix.dirname(normSource));
    if (normDest === sourceParentDir) {
      throw new BadRequestError('Mục đã nằm trong thư mục đích');
    }

    const itemName = path.basename(sourceDiskPath);
    let finalTargetName = itemName;
    let targetDiskPath = path.join(destDirDiskPath, finalTargetName);

    // If item already exists at destination, handle conflict by appending (1), (2), etc.
    if (existsSync(targetDiskPath)) {
      const ext = path.extname(itemName);
      const base = path.basename(itemName, ext);
      let counter = 1;
      while (existsSync(targetDiskPath)) {
        finalTargetName = `${base} (${counter})${ext}`;
        targetDiskPath = path.join(destDirDiskPath, finalTargetName);
        counter++;
      }
    }

    // Verify sandbox integrity
    StorageManager.sanitizeSafePath(resolvedStoragePaths.drive, path.relative(resolvedStoragePaths.drive, targetDiskPath));

    await fs.rename(sourceDiskPath, targetDiskPath);

    const sourceBase = sourceDiskPath.replace(/\.[^.]+$/, '');
    const targetBase = targetDiskPath.replace(/\.[^.]+$/, '');
    const srcMeta = `${sourceBase}.meta.json`;
    const dstMeta = `${targetBase}.meta.json`;
    if (existsSync(srcMeta)) await fs.rename(srcMeta, dstMeta).catch(() => {});
    const srcThumb = `${sourceBase}.thumb.jpg`;
    const dstThumb = `${targetBase}.thumb.jpg`;
    if (existsSync(srcThumb)) await fs.rename(srcThumb, dstThumb).catch(() => {});

    DriveService.invalidateStatsCache();
    const stat = await fs.stat(targetDiskPath);
    const isDir = stat.isDirectory();
    const ext = isDir ? '' : path.extname(finalTargetName).toLowerCase().replace(/^\./, '');
    const newRelPath = normDest === '/' ? `/${finalTargetName}` : `${normDest}/${finalTargetName}`;

    return {
      name: finalTargetName,
      path: newRelPath,
      isDirectory: isDir,
      sizeBytes: isDir ? 0 : stat.size,
      updatedAt: stat.mtime.toISOString(),
      mimeType: isDir ? 'inode/directory' : getMimeTypeForExt(ext),
      extension: ext
    };
  }

  /**
   * Copies a file or directory into a destination directory
   */
  static async copyItem(userRelPath: string, destinationDirRelPath: string): Promise<DriveItem> {
    const normSource = this.normalizeRelativePath(userRelPath);
    if (normSource === '/' || normSource === '') {
      throw new BadRequestError('Không thể sao chép thư mục gốc');
    }
    const normDest = this.normalizeRelativePath(destinationDirRelPath);

    const sourceDiskPath = this.getDiskPath(normSource);
    if (!existsSync(sourceDiskPath)) {
      throw new NotFoundError(`Mục nguồn '${normSource}' không tồn tại`);
    }

    const destDirDiskPath = this.getDiskPath(normDest);
    if (!existsSync(destDirDiskPath)) {
      throw new NotFoundError(`Thư mục đích '${normDest}' không tồn tại`);
    }
    const destStat = await fs.stat(destDirDiskPath);
    if (!destStat.isDirectory()) {
      throw new BadRequestError(`Đích đến '${normDest}' phải là một thư mục`);
    }

    // Prevent copying a directory into itself or a subdirectory of itself
    if (normDest === normSource || normDest.startsWith(normSource + '/')) {
      throw new BadRequestError('Không thể sao chép thư mục vào chính nó hoặc vào thư mục con của nó');
    }

    const itemName = path.basename(sourceDiskPath);
    let finalTargetName = itemName;
    let targetDiskPath = path.join(destDirDiskPath, finalTargetName);

    // If item exists at destination, handle conflict
    if (existsSync(targetDiskPath)) {
      const ext = path.extname(itemName);
      const base = path.basename(itemName, ext);
      let counter = 1;
      finalTargetName = `${base} - Copy${ext}`;
      targetDiskPath = path.join(destDirDiskPath, finalTargetName);
      while (existsSync(targetDiskPath)) {
        finalTargetName = `${base} - Copy (${counter})${ext}`;
        targetDiskPath = path.join(destDirDiskPath, finalTargetName);
        counter++;
      }
    }

    await fs.cp(sourceDiskPath, targetDiskPath, { recursive: true });

    const sourceBase = sourceDiskPath.replace(/\.[^.]+$/, '');
    const targetBase = targetDiskPath.replace(/\.[^.]+$/, '');
    const srcMeta = `${sourceBase}.meta.json`;
    const dstMeta = `${targetBase}.meta.json`;
    if (existsSync(srcMeta)) await fs.copyFile(srcMeta, dstMeta).catch(() => {});
    const srcThumb = `${sourceBase}.thumb.jpg`;
    const dstThumb = `${targetBase}.thumb.jpg`;
    if (existsSync(srcThumb)) await fs.copyFile(srcThumb, dstThumb).catch(() => {});

    DriveService.invalidateStatsCache();
    const stat = await fs.stat(targetDiskPath);
    const isDir = stat.isDirectory();
    const ext = isDir ? '' : path.extname(finalTargetName).toLowerCase().replace(/^\./, '');
    const newRelPath = normDest === '/' ? `/${finalTargetName}` : `${normDest}/${finalTargetName}`;

    return {
      name: finalTargetName,
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

    const stat = await fs.stat(diskPath);
    if (!stat.isDirectory()) {
      throw new BadRequestError(`Đường dẫn '${normalized}' không phải là thư mục`);
    }

    if (!existsSync(resolvedStoragePaths.temp)) {
      await fs.mkdir(resolvedStoragePaths.temp, { recursive: true });
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
        for d in dirs:
            full_dir = os.path.join(root, d)
            rel_dir = os.path.relpath(full_dir, folder).replace(os.sep, '/').strip('/') + '/'
            zf.writestr(rel_dir, '')
        for f in files:
            full = os.path.join(root, f)
            rel = os.path.relpath(full, folder).replace(os.sep, '/')
            zf.write(full, rel)
print("OK")
`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonBin, ['-c', script, diskPath, tempZipPath], {
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8'
        }
      });
      let errStr = '';
      proc.stderr.on('data', d => (errStr += d.toString()));
      proc.on('close', code => {
        if (code === 0 && existsSync(tempZipPath)) {
          resolve();
        } else {
          StorageManager.unlinkSafe(tempZipPath).catch(() => {});
          reject(new Error(`Failed to zip folder: ${errStr}`));
        }
      });
      proc.on('error', err => {
        StorageManager.unlinkSafe(tempZipPath).catch(() => {});
        reject(err);
      });
    });

    return { zipPath: tempZipPath, zipName: `${folderName}.zip` };
  }

  /**
   * Archives multiple files and directories into a temporary ZIP file and returns its path
   */
  static async archiveItemsToZip(userRelPaths: string[]): Promise<{ zipPath: string; zipName: string }> {
    if (!existsSync(resolvedStoragePaths.temp)) {
      await fs.mkdir(resolvedStoragePaths.temp, { recursive: true });
    }

    const validItems: Array<{ diskPath: string; arcName: string }> = [];
    for (const rel of userRelPaths) {
      const norm = this.normalizeRelativePath(rel);
      const disk = this.getDiskPath(norm);
      if (existsSync(disk)) {
        const baseName = norm === '/' ? 'Storage_Root' : path.basename(disk);
        validItems.push({ diskPath: disk, arcName: baseName });
      }
    }

    if (validItems.length === 0) {
      throw new NotFoundError('Không tìm thấy tệp hoặc thư mục nào tồn tại để nén');
    }

    const zipName = `Storage_Export_${Date.now().toString(36)}.zip`;
    const tempZipPath = path.join(resolvedStoragePaths.temp, zipName);

    const pythonBin = resolvePythonBin();
    const script = `
import zipfile, os, sys, json
items = json.loads(sys.stdin.read())
out_zip = sys.argv[1]

seen_arcs = set()
def get_unique_arc(name):
    if name not in seen_arcs:
        seen_arcs.add(name)
        return name
    base, ext = os.path.splitext(name)
    counter = 1
    while f"{base} ({counter}){ext}" in seen_arcs:
        counter += 1
    unique_name = f"{base} ({counter}){ext}"
    seen_arcs.add(unique_name)
    return unique_name

with zipfile.ZipFile(out_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
    for item in items:
        p = item['diskPath']
        raw_arc = item['arcName']
        arc = get_unique_arc(raw_arc)
        if os.path.isdir(p):
            zf.writestr(arc.replace(os.sep, '/').strip('/') + '/', '')
            for root, dirs, files in os.walk(p):
                for d in dirs:
                    full_d = os.path.join(root, d)
                    rel_d = os.path.relpath(full_d, p).replace(os.sep, '/').strip('/') + '/'
                    zf.writestr(f"{arc}/{rel_d}", '')
                for f in files:
                    full = os.path.join(root, f)
                    rel = os.path.relpath(full, p).replace(os.sep, '/')
                    zf.write(full, f"{arc}/{rel}")
        elif os.path.isfile(p):
            zf.write(p, arc.replace(os.sep, '/'))
print("OK")
`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonBin, ['-c', script, tempZipPath], {
        env: {
          ...process.env,
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8'
        }
      });
      let errStr = '';
      proc.stderr.on('data', d => (errStr += d.toString()));
      proc.on('close', code => {
        if (code === 0 && existsSync(tempZipPath)) {
          resolve();
        } else {
          StorageManager.unlinkSafe(tempZipPath).catch(() => {});
          reject(new Error(`Failed to zip items: ${errStr}`));
        }
      });
      proc.on('error', err => {
        StorageManager.unlinkSafe(tempZipPath).catch(() => {});
        reject(err);
      });

      proc.stdin.write(JSON.stringify(validItems), 'utf-8');
      proc.stdin.end();
    });

    const exportName = validItems.length === 1 ? `${validItems[0].arcName}.zip` : 'Storage_Archive.zip';
    return { zipPath: tempZipPath, zipName: exportName };
  }

  /**
   * Returns drive stats with smart memoization
   */
  static async getDriveStats(): Promise<DriveStatsCache> {
    const now = Date.now();
    if (cachedDriveStats && now - cachedDriveStats.timestamp < STATS_CACHE_TTL_MS) {
      return cachedDriveStats.data;
    }

    const driveDir = resolvedStoragePaths.drive;
    const dirStats = await StorageManager.getDirectoryStats(driveDir);
    const diskStats = await StorageManager.getDiskStats(driveDir);
    const data: DriveStatsCache = {
      usedBytes: dirStats.sizeBytes,
      fileCount: dirStats.fileCount,
      dirCount: dirStats.dirCount,
      diskFreeBytes: diskStats.freeBytes,
      diskTotalBytes: diskStats.totalBytes
    };
    cachedDriveStats = { data, timestamp: now };
    return data;
  }
}
