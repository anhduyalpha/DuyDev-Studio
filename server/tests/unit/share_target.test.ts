import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { classifySharedPayload, SharePayloadType } from '../../../src/utilities/shareTargetHelper.js';

describe('Web Share Target & Classifier Suite', () => {
  describe('Server Fallback Endpoints (/share-target)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('POST /share-target should return 303 See Other redirecting to /#share-target', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/share-target'
      });

      expect(res.statusCode).toBe(303);
      expect(res.headers.location).toBe('/#share-target');
    });

    it('GET /share-target without query params should redirect to /#share-target', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/share-target'
      });

      expect(res.statusCode).toBe(303);
      expect(res.headers.location).toBe('/#share-target');
    });

    it('GET /share-target with Studocu URL should encode params into hash fragment', async () => {
      const targetUrl = 'https://www.studocu.com/vn/document/dai-hoc-kinh-te/12345';
      const res = await app.inject({
        method: 'GET',
        url: `/share-target?url=${encodeURIComponent(targetUrl)}`
      });

      expect(res.statusCode).toBe(303);
      expect(res.headers.location).toBe(`/#share-target?url=${encodeURIComponent(targetUrl)}`);
    });

    it('GET /share-target with text and title should preserve all query fields', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/share-target?title=MyDoc&text=Check+this+out'
      });

      expect(res.statusCode).toBe(303);
      const location = res.headers.location as string;
      expect(location).toContain('/#share-target?');
      expect(location).toContain('title=MyDoc');
      expect(location).toContain('text=Check+this+out');
    });
  });

  describe('classifySharedPayload Unit Tests', () => {
    it('should classify image files and prioritize QR scan & image to PDF', () => {
      const result = classifySharedPayload({
        files: [{ name: 'receipt.png', type: 'image/png' } as any]
      });

      expect(result.type).toBe(SharePayloadType.IMAGE_FILES);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].isPrimary).toBe(true);
      expect(result.recommendations[0].route).toBe('#tool/qr-scan');
    });

    it('should classify image by extension even if MIME type is missing', () => {
      const result = classifySharedPayload({
        files: [{ name: 'photo.WEBP', type: '' } as any]
      });

      expect(result.type).toBe(SharePayloadType.IMAGE_FILES);
      expect(result.recommendations[0].route).toBe('#tool/qr-scan');
    });

    it('should classify PDF files and prioritize PDF compress', () => {
      const result = classifySharedPayload({
        files: [{ name: 'document.pdf', type: 'application/pdf' } as any]
      });

      expect(result.type).toBe(SharePayloadType.PDF_FILES);
      expect(result.recommendations[0].isPrimary).toBe(true);
      expect(result.recommendations[0].route).toBe('#tool/pdf-studio');
      expect(result.recommendations[0].mode).toBe('compress');
      expect(result.recommendations.some(r => r.mode === 'pdf_to_docx')).toBe(true);
    });

    it('should classify archive files (.zip, .rar, .7z) and prioritize archive inspect', () => {
      const zipResult = classifySharedPayload({
        files: [{ name: 'backup.zip', type: 'application/zip' } as any]
      });
      expect(zipResult.type).toBe(SharePayloadType.ARCHIVE_FILES);
      expect(zipResult.recommendations[0].route).toBe('#tool/archive-inspect');

      const rarResult = classifySharedPayload({
        files: [{ name: 'archive.rar', type: '' } as any]
      });
      expect(rarResult.type).toBe(SharePayloadType.ARCHIVE_FILES);
      expect(rarResult.recommendations[0].route).toBe('#tool/archive-inspect');

      const sevenZResult = classifySharedPayload({
        files: [{ name: 'package.7z', type: '' } as any]
      });
      expect(sevenZResult.type).toBe(SharePayloadType.ARCHIVE_FILES);
      expect(sevenZResult.recommendations[0].route).toBe('#tool/archive-inspect');
    });

    it('should classify generic/unknown files and route to universal converter', () => {
      const result = classifySharedPayload({
        files: [{ name: 'data.unknown', type: 'application/octet-stream' } as any]
      });

      expect(result.type).toBe(SharePayloadType.GENERIC_FILES);
      expect(result.recommendations[0].route).toBe('#tool/universal-converter');
    });

    it('should classify Studocu URLs and recommend Studocu downloader', () => {
      const domains = ['studocu.com', 'www.studocu.com', 'studocu.vn', 'www.studocu.vn'];
      for (const d of domains) {
        const result = classifySharedPayload({
          url: `https://${d}/vn/document/truong-dai-hoc-bach-khoa/de-thi-giua-ky/12345`
        });
        expect(result.type).toBe(SharePayloadType.STUDOCU_URL);
        expect(result.recommendations[0].isPrimary).toBe(true);
        expect(result.recommendations[0].route).toBe('#tool/studocu-dl');
      }
    });

    it('should classify generic URLs and recommend QR generator', () => {
      const result = classifySharedPayload({
        url: 'https://github.com/alphadaniel/duydev-studio'
      });

      expect(result.type).toBe(SharePayloadType.GENERIC_URL);
      expect(result.recommendations[0].route).toBe('#tool/qr-multi');
    });

    it('should extract URL embedded inside text and classify accordingly', () => {
      const result = classifySharedPayload({
        text: 'Này bạn ơi tải thử tài liệu này nhé https://studocu.vn/vn/document/12345 hay lắm'
      });

      expect(result.type).toBe(SharePayloadType.STUDOCU_URL);
      expect(result.recommendations[0].route).toBe('#tool/studocu-dl');
    });

    it('should classify pure text without URLs as PLAIN_TEXT', () => {
      const result = classifySharedPayload({
        text: 'Chỉ là một đoạn văn bản ghi chú bình thường'
      });

      expect(result.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(result.recommendations[0].route).toBe('#tool/qr-multi');
      expect(result.recommendations[1].route).toBe('#tool/hash-checksum');
    });

    it('should handle empty or null payload gracefully', () => {
      const emptyResult = classifySharedPayload({});
      expect(emptyResult.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(emptyResult.recommendations).toEqual([]);

      const nullResult = classifySharedPayload(null as any);
      expect(nullResult.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(nullResult.recommendations).toEqual([]);
    });
  });
});
