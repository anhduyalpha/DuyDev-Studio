import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TikTokService } from '../../src/services/tiktok.service.js';
import { DriveService } from '../../src/services/drive.service.js';
import { StorageManager } from '../../src/storage/storage.manager.js';
import { buildApp } from '../../src/app.js';

describe('TikTok Storage Grid & Duplicate Detection', () => {
  const testTikTokDir = StorageManager.getDrivePath('tiktok');
  const dummyVideoId = '999888777666';
  const dummyFileName = `tiktok_${dummyVideoId}_test.mp4`;
  const dummyFilePath = path.join(testTikTokDir, dummyFileName);
  const dummyMetaPath = path.join(testTikTokDir, `tiktok_${dummyVideoId}_test.meta.json`);
  const dummyThumbPath = path.join(testTikTokDir, `tiktok_${dummyVideoId}_test.thumb.jpg`);

  beforeEach(() => {
    if (!fs.existsSync(testTikTokDir)) {
      fs.mkdirSync(testTikTokDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
    if (fs.existsSync(dummyMetaPath)) fs.unlinkSync(dummyMetaPath);
    if (fs.existsSync(dummyThumbPath)) fs.unlinkSync(dummyThumbPath);
  });

  describe('Duplicate Detection with Physical File Verification', () => {
    it('should return exists: false when video does not exist in Drive', async () => {
      const check = await TikTokService.checkExistingInDrive(dummyVideoId, 'https://www.tiktok.com/@user/video/' + dummyVideoId);
      expect(check.exists).toBe(false);
      expect(check.item).toBeUndefined();
    });

    it('should detect existing video when physical file and metadata exist', async () => {
      // Create physical video file and sidecars
      fs.writeFileSync(dummyFilePath, 'dummy-video-content-mp4');
      fs.writeFileSync(
        dummyMetaPath,
        JSON.stringify({
          tiktokVideoId: dummyVideoId,
          originalUrl: 'https://www.tiktok.com/@user/video/' + dummyVideoId,
          author: '@cooluser',
          title: 'Awesome Dance Routine',
          duration: 15
        })
      );

      const check = await TikTokService.checkExistingInDrive(dummyVideoId);
      expect(check.exists).toBe(true);
      expect(check.item).toBeDefined();
      expect(check.item?.fileName).toBe(dummyFileName);
      expect(check.item?.relPath).toBe(`/tiktok/${dummyFileName}`);
      expect(check.item?.author).toBe('@cooluser');
      expect(check.item?.duration).toBe(15);
    });

    it('should return exists: false if metadata exists but physical video file was deleted', async () => {
      // Create only sidecar metadata without video file
      fs.writeFileSync(
        dummyMetaPath,
        JSON.stringify({
          tiktokVideoId: dummyVideoId,
          originalUrl: 'https://www.tiktok.com/@user/video/' + dummyVideoId
        })
      );

      const check = await TikTokService.checkExistingInDrive(dummyVideoId);
      expect(check.exists).toBe(false);
      expect(check.item).toBeUndefined();
    });
  });

  describe('DriveService Sidecar Filtering and Loading', () => {
    it('should exclude .meta.json and .thumb.jpg from file listing while populating item.metadata', async () => {
      fs.writeFileSync(dummyFilePath, 'sample-mp4-data');
      fs.writeFileSync(
        dummyMetaPath,
        JSON.stringify({
          tiktokVideoId: dummyVideoId,
          author: '@tester',
          thumbnail: 'data:image/jpeg;base64,sample'
        })
      );
      fs.writeFileSync(dummyThumbPath, 'sample-thumb-binary');

      const listing = await DriveService.listFiles('/tiktok');
      const files = listing.items;

      // Ensure sidecar files are filtered out of listing
      const metaItem = files.find(f => f.name.endsWith('.meta.json'));
      const thumbItem = files.find(f => f.name.endsWith('.thumb.jpg'));
      expect(metaItem).toBeUndefined();
      expect(thumbItem).toBeUndefined();

      // Ensure the video item loaded metadata from .meta.json
      const videoItem = files.find(f => f.name === dummyFileName);
      expect(videoItem).toBeDefined();
      expect(videoItem?.metadata?.tiktokVideoId).toBe(dummyVideoId);
      expect(videoItem?.metadata?.author).toBe('@tester');
    });

    it('should delete sidecar .meta.json and .thumb.jpg when deleting the video', async () => {
      fs.writeFileSync(dummyFilePath, 'sample-mp4-data');
      fs.writeFileSync(dummyMetaPath, JSON.stringify({ tiktokVideoId: dummyVideoId }));
      fs.writeFileSync(dummyThumbPath, 'dummy-thumb');

      expect(fs.existsSync(dummyFilePath)).toBe(true);
      expect(fs.existsSync(dummyMetaPath)).toBe(true);
      expect(fs.existsSync(dummyThumbPath)).toBe(true);

      await DriveService.deleteItem(`/tiktok/${dummyFileName}`);

      expect(fs.existsSync(dummyFilePath)).toBe(false);
      expect(fs.existsSync(dummyMetaPath)).toBe(false);
      expect(fs.existsSync(dummyThumbPath)).toBe(false);
    });
  });

  describe('API Endpoint POST /api/v1/tiktok/check-duplicate', () => {
    it('should check duplicate via Fastify route', async () => {
      const app = await buildApp();

      // Check when not existing
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/tiktok/check-duplicate',
        payload: {
          id: dummyVideoId,
          url: 'https://www.tiktok.com/@user/video/' + dummyVideoId
        }
      });
      expect(res1.statusCode).toBe(200);
      const json1 = res1.json();
      expect(json1.success).toBe(true);
      expect(json1.data.exists).toBe(false);

      // Create dummy file
      fs.writeFileSync(dummyFilePath, 'video-binary');
      fs.writeFileSync(
        dummyMetaPath,
        JSON.stringify({
          tiktokVideoId: dummyVideoId,
          originalUrl: 'https://www.tiktok.com/@user/video/' + dummyVideoId,
          author: '@apitest'
        })
      );

      // Check when existing
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/tiktok/check-duplicate',
        payload: {
          id: dummyVideoId
        }
      });
      expect(res2.statusCode).toBe(200);
      const json2 = res2.json();
      expect(json2.success).toBe(true);
      expect(json2.data.exists).toBe(true);
      expect(json2.data.item.fileName).toBe(dummyFileName);
      expect(json2.data.item.author).toBe('@apitest');
    });
  });
});
