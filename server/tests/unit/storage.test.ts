import { describe, it, expect } from 'vitest';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { SecurityException } from '../../src/lib/errors.js';
import path from 'path';

describe('StorageManager Sanitization & Path Tests', () => {
  it('should generate correct upload and processed paths', () => {
    const uploadPath = StorageManager.getUploadPath('file_123');
    expect(uploadPath).toContain('file_123.bin');

    const processedPath = StorageManager.getProcessedPath('file_123', 'pdf');
    expect(processedPath).toContain('file_123.pdf');
  });

  it('should prevent path traversal attempts', () => {
    const sandboxDir = path.resolve('data/storage/temp');

    // Attempt traversal
    expect(() => {
      StorageManager.sanitizeSafePath(sandboxDir, '../../../../windows/system32/cmd.exe');
    }).toThrow(SecurityException);
  });

  it('should safely handle paths with or without leading slashes within sandbox', () => {
    const sandboxDir = path.resolve('data/storage/drive');

    const path1 = StorageManager.sanitizeSafePath(sandboxDir, 'documents/notes.txt');
    const path2 = StorageManager.sanitizeSafePath(sandboxDir, '/documents/notes.txt');
    const path3 = StorageManager.sanitizeSafePath(sandboxDir, '\\documents\\notes.txt');

    expect(path1).toBe(path2);
    expect(path1).toBe(path3);
    expect(path1.startsWith(sandboxDir)).toBe(true);

    const rootPath = StorageManager.sanitizeSafePath(sandboxDir, '/');
    expect(rootPath).toBe(sandboxDir);
  });

  it('should generate safe drive paths', () => {
    const drivePath = StorageManager.getDrivePath('/my_folder/file.pdf');
    expect(drivePath).toContain('my_folder');
    expect(drivePath).toContain('file.pdf');

    const rootDrive = StorageManager.getDrivePath('/');
    expect(rootDrive).toBeDefined();
  });
});

