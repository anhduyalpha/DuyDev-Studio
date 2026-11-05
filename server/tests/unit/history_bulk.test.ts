/**
 * history_bulk.test.ts - Bulk History Schema & Ingestion Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { bulkHistorySchema, createHistorySchema } from '../../src/schemas/history.schema.js';

describe('Bulk History Schema Validation', () => {
  it('validates a valid array of history records with media metadata', () => {
    const payload = {
      items: [
        {
          id: 'fb-test-12345',
          deviceId: 'dev_phone_123',
          toolId: 'facebook-downloader',
          toolTitle: 'Facebook Downloader',
          fileName: 'fb_video_1.mp4',
          originalSize: 0,
          resultSize: 1048576,
          downloadUrl: 'https://cdn.example.com/fb1.mp4',
          status: 'success',
          detailsJson: JSON.stringify({
            title: 'Sample FB Video',
            cover: 'https://cdn.example.com/cover.jpg',
            quality: 'HD Video',
            author: '@duydev'
          })
        },
        {
          id: 'fb-test-67890',
          deviceId: 'dev_phone_123',
          toolId: 'facebook-downloader',
          toolTitle: 'Facebook Downloader',
          fileName: 'fb_video_2.mp4',
          originalSize: 0,
          resultSize: 2097152,
          downloadUrl: 'https://cdn.example.com/fb2.mp4',
          status: 'success',
          detailsJson: null
        }
      ]
    };

    const parsed = bulkHistorySchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items.length).toBe(2);
      expect(parsed.data.items[0].toolId).toBe('facebook-downloader');
      expect(parsed.data.items[0].resultSize).toBe(1048576);
    }
  });

  it('rejects empty items array', () => {
    const payload = { items: [] };
    const parsed = bulkHistorySchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects items with missing fileName or toolId', () => {
    const payload = {
      items: [
        {
          toolTitle: 'Facebook Downloader',
          originalSize: 0
        }
      ]
    };
    const parsed = bulkHistorySchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('accepts single item schema with valid defaults', () => {
    const single = {
      toolId: 'facebook-downloader',
      toolTitle: 'Facebook Downloader',
      fileName: 'clip.mp4'
    };
    const parsed = createHistorySchema.parse(single);
    expect(parsed.originalSize).toBe(0);
    expect(parsed.resultSize).toBe(0);
    expect(parsed.status).toBe('success');
  });
});
