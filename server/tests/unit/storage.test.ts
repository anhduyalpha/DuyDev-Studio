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
});
