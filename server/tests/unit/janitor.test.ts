import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../src/lib/prisma.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { JanitorService } from '../../src/services/janitor.service.js';

describe('JanitorService Unit Tests', () => {
  const expiredFileId = `fil_test_exp_${Date.now()}`;
  const activeFileId = `fil_test_act_${Date.now()}`;
  let expiredFilePath: string;
  let activeFilePath: string;

  beforeAll(async () => {
    await StorageManager.initStorage();

    expiredFilePath = StorageManager.getUploadPath(expiredFileId, '.txt');
    activeFilePath = StorageManager.getUploadPath(activeFileId, '.txt');

    const expiredContent = 'Expired File Content To Be Purged';
    const activeContent = 'Active File Content Preserved';

    await fs.writeFile(expiredFilePath, expiredContent);
    await fs.writeFile(activeFilePath, activeContent);

    // Create DB records
    await prisma.fileRecord.create({
      data: {
        id: expiredFileId,
        purpose: 'UPLOAD',
        originalName: 'expired.txt',
        storagePath: expiredFilePath,
        mimeType: 'text/plain',
        sizeBytes: BigInt(Buffer.from(expiredContent).length),
        hashSha256: crypto.createHash('sha256').update(expiredContent).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() - 60_000) // Expired 1 minute ago
      }
    });

    await prisma.fileRecord.create({
      data: {
        id: activeFileId,
        purpose: 'UPLOAD',
        originalName: 'active.txt',
        storagePath: activeFilePath,
        mimeType: 'text/plain',
        sizeBytes: BigInt(Buffer.from(activeContent).length),
        hashSha256: crypto.createHash('sha256').update(activeContent).digest('hex'),
        isPurged: false,
        expiresAt: new Date(Date.now() + 600_000) // Expires in 10 minutes
      }
    });
  });

  afterAll(async () => {
    await StorageManager.unlinkSafe(expiredFilePath);
    await StorageManager.unlinkSafe(activeFilePath);
    await prisma.fileRecord.deleteMany({
      where: { id: { in: [expiredFileId, activeFileId] } }
    });
  });

  it('should respect permanent retention and purge when forced or expired', async () => {
    // 1. In default mode with permanent retention, expired files are preserved
    const defaultResult = await JanitorService.runJanitorOnce();
    expect(defaultResult.purgedCount).toBe(0);
    expect(existsSync(expiredFilePath)).toBe(true);

    // 2. When forced, expired files are purged while active files remain untouched
    const forcedResult = await JanitorService.runJanitorOnce({ forceExpiredCheck: true });
    expect(forcedResult.purgedCount).toBeGreaterThanOrEqual(1);

    // Verify expired file on disk was unlinked
    expect(existsSync(expiredFilePath)).toBe(false);

    // Verify active file still exists on disk
    expect(existsSync(activeFilePath)).toBe(true);

    // Verify database record updated
    const expiredRecord = await prisma.fileRecord.findUnique({
      where: { id: expiredFileId }
    });
    expect(expiredRecord?.isPurged).toBe(true);
    expect(expiredRecord?.storagePath).toBe('');

    const activeRecord = await prisma.fileRecord.findUnique({
      where: { id: activeFileId }
    });
    expect(activeRecord?.isPurged).toBe(false);
  });
});
