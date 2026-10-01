import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import {
  classifySharedPayload,
  SharePayloadType,
  peekPendingSharedPayload,
  consumePendingSharedPayload,
  pollPendingSharedData,
  retrievePendingSharedData
} from '../../../src/utilities/shareTargetHelper.js';

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

    it('POST /share-target with query params should preserve params in 303 redirect', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/share-target?url=https%3A%2F%2Fexample.com&title=MyTitle'
      });

      expect(res.statusCode).toBe(303);
      const location = res.headers.location as string;
      expect(location).toContain('/#share-target?');
      expect(location).toContain('url=https%3A%2F%2Fexample.com');
      expect(location).toContain('title=MyTitle');
    });

    it('POST /share-target with multipart form data should extract fields, drain files, and 303 redirect', async () => {
      const boundary = '----WebKitFormBoundaryTest123456';
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="url"',
        '',
        'https://studocu.com/vn/document/12345',
        `--${boundary}`,
        'Content-Disposition: form-data; name="title"',
        '',
        'Shared Studocu Title',
        `--${boundary}`,
        'Content-Disposition: form-data; name="shared_files"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'sample file content to drain',
        `--${boundary}--`
      ].join('\r\n');

      const res = await app.inject({
        method: 'POST',
        url: '/share-target',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload: body
      });

      expect(res.statusCode).toBe(303);
      const location = res.headers.location as string;
      expect(location).toContain('/#share-target?');
      expect(location).toContain('url=https%3A%2F%2Fstudocu.com%2Fvn%2Fdocument%2F12345');
      expect(location).toContain('title=Shared+Studocu+Title');
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

    it('should classify archive files by MIME type even if filename has no extension', () => {
      const zipMimeResult = classifySharedPayload({
        files: [{ name: 'download_blob', type: 'application/x-zip-compressed' } as any]
      });
      expect(zipMimeResult.type).toBe(SharePayloadType.ARCHIVE_FILES);
      expect(zipMimeResult.recommendations[0].route).toBe('#tool/archive-inspect');

      const rarMimeResult = classifySharedPayload({
        files: [{ name: 'content', type: 'application/x-rar-compressed' } as any]
      });
      expect(rarMimeResult.type).toBe(SharePayloadType.ARCHIVE_FILES);

      const gzipMimeResult = classifySharedPayload({
        files: [{ name: 'archive_blob', type: 'application/gzip' } as any]
      });
      expect(gzipMimeResult.type).toBe(SharePayloadType.ARCHIVE_FILES);
    });

    it('should classify international Studocu subdomains correctly', () => {
      const subdomains = ['id.studocu.com', 'fr.studocu.com', 'es.studocu.com', 'it.studocu.com', 'de.studocu.com'];
      for (const d of subdomains) {
        const result = classifySharedPayload({
          url: `https://${d}/document/universitas-indonesia/lecture-notes/99887`
        });
        expect(result.type).toBe(SharePayloadType.STUDOCU_URL);
        expect(result.recommendations[0].isPrimary).toBe(true);
        expect(result.recommendations[0].route).toBe('#tool/studocu-dl');
      }
    });

    it('should classify Google Images URL containing imgurl parameter as IMAGE_URL with QR scan', () => {
      const googleImgUrl = 'https://www.google.com/imgres?q=qr%20code&imgurl=https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2Fd%2Fd0%2FQR_code_for_mobile_English_Wikipedia.svg&imgrefurl=https%3A%2F%2Fen.wikipedia.org';
      const result = classifySharedPayload({
        url: googleImgUrl
      });

      expect(result.type).toBe(SharePayloadType.IMAGE_URL);
      expect(result.recommendations[0].isPrimary).toBe(true);
      expect(result.recommendations[0].route).toBe('#tool/qr-scan');
      expect(result.recommendations[0].imageUrl).toContain('QR_code_for_mobile_English_Wikipedia.svg');
    });

    it('should classify direct image URL as IMAGE_URL with QR scan', () => {
      const directImageUrl = 'https://example.com/assets/wifi_qr_code.png?v=2';
      const result = classifySharedPayload({
        url: directImageUrl
      });

      expect(result.type).toBe(SharePayloadType.IMAGE_URL);
      expect(result.recommendations[0].route).toBe('#tool/qr-scan');
    });

    it('should handle null elements in files array gracefully', () => {
      const nullFileResult = classifySharedPayload({
        files: [null as any]
      });
      expect(nullFileResult.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(nullFileResult.recommendations).toEqual([]);
    });

    it('should handle empty or null payload gracefully', () => {
      const emptyResult = classifySharedPayload({});
      expect(emptyResult.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(emptyResult.recommendations).toEqual([]);

      const nullResult = classifySharedPayload(null as any);
      expect(nullResult.type).toBe(SharePayloadType.PLAIN_TEXT);
      expect(nullResult.recommendations).toEqual([]);
    });

    it('isShareTargetModalOpen should accurately reflect __FAST_PATH_SHARE_ACTIVE flag', async () => {
      const { isShareTargetModalOpen } = await import('../../../src/components/common/ShareTargetModal.js');
      (global as any).window = (global as any).window || {};
      (global as any).window.__FAST_PATH_SHARE_ACTIVE = false;
      expect(isShareTargetModalOpen()).toBe(false);

      (global as any).window.__FAST_PATH_SHARE_ACTIVE = true;
      expect(isShareTargetModalOpen()).toBe(true);

      (global as any).window.__FAST_PATH_SHARE_ACTIVE = false;
      expect(isShareTargetModalOpen()).toBe(false);
    });
  });

  describe('IndexedDB Lock-Free & Polling Suite', () => {
    it('should return null gracefully when indexedDB is undefined (Node.js environment)', async () => {
      const originalIDB = (global as any).indexedDB;
      delete (global as any).indexedDB;

      const peek = await peekPendingSharedPayload();
      expect(peek).toBeNull();

      const consumed = await consumePendingSharedPayload();
      expect(consumed).toBeNull();

      const retrieved = await retrievePendingSharedData();
      expect(retrieved).toBeNull();

      const polled = await pollPendingSharedData(50);
      expect(polled).toBeNull();

      if (originalIDB !== undefined) {
        (global as any).indexedDB = originalIDB;
      }
    });

    it('peekPendingSharedPayload should read without deleting, and consumePendingSharedPayload should clear', async () => {
      const store: any[] = [];
      const mockDb = {
        close: () => {},
        transaction: (_names: string, mode: string) => {
          const tx: any = {
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              getAll: () => {
                const req: any = {};
                setTimeout(() => {
                  req.result = [...store];
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              clear: () => {
                store.length = 0;
              }
            })
          };
          if (mode === 'readwrite') {
            setTimeout(() => {
              if (tx.oncomplete) tx.oncomplete();
            }, 5);
          }
          return tx;
        }
      };

      const originalIDB = (global as any).indexedDB;
      (global as any).indexedDB = {
        open: () => {
          const req: any = {};
          setTimeout(() => {
            req.result = mockDb;
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }
      };

      try {
        // Initially empty
        expect(await peekPendingSharedPayload()).toBeNull();

        // Add an item
        store.push({ title: 'Test 1', url: 'https://example.com' });

        // Peek should return the item without removing it
        const peek1 = await peekPendingSharedPayload();
        expect(peek1).toEqual({ title: 'Test 1', url: 'https://example.com' });
        expect(store.length).toBe(1);

        // Second peek should still return the item
        const peek2 = await peekPendingSharedPayload();
        expect(peek2).toEqual({ title: 'Test 1', url: 'https://example.com' });
        expect(store.length).toBe(1);

        // Consume should return the item AND clear the store
        const consumed = await consumePendingSharedPayload();
        expect(consumed).toEqual({ title: 'Test 1', url: 'https://example.com' });
        expect(store.length).toBe(0);

        // Subsequent peek should return null
        expect(await peekPendingSharedPayload()).toBeNull();
      } finally {
        if (originalIDB !== undefined) {
          (global as any).indexedDB = originalIDB;
        } else {
          delete (global as any).indexedDB;
        }
      }
    });

    it('pollPendingSharedData should wake up immediately via BroadcastChannel PAYLOAD_READY', async () => {
      const store: any[] = [];
      const mockDb = {
        close: () => {},
        transaction: (_names: string, mode: string) => {
          const tx: any = {
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              getAll: () => {
                const req: any = {};
                setTimeout(() => {
                  req.result = [...store];
                  if (req.onsuccess) req.onsuccess();
                }, 0);
                return req;
              },
              clear: () => {
                store.length = 0;
              }
            })
          };
          if (mode === 'readwrite') {
            setTimeout(() => {
              if (tx.oncomplete) tx.oncomplete();
            }, 5);
          }
          return tx;
        }
      };

      const originalIDB = (global as any).indexedDB;
      const originalBC = (global as any).BroadcastChannel;

      (global as any).indexedDB = {
        open: () => {
          const req: any = {};
          setTimeout(() => {
            req.result = mockDb;
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }
      };

      const channelSubscribers = new Set<any>();
      (global as any).BroadcastChannel = class {
        name: string;
        onmessage: any = null;
        constructor(name: string) {
          this.name = name;
          channelSubscribers.add(this);
        }
        postMessage(data: any) {
          for (const sub of channelSubscribers) {
            if (sub !== this && sub.onmessage) {
              sub.onmessage({ data });
            }
          }
        }
        close() {
          channelSubscribers.delete(this);
        }
      };

      try {
        const pollPromise = pollPendingSharedData(3000);

        // Simulate SW finishing save after 25ms and broadcasting PAYLOAD_READY
        setTimeout(() => {
          store.push({ title: 'Shared via SW', url: 'https://sw-shared.com' });
          const swBc = new (global as any).BroadcastChannel('ds_share_channel');
          swBc.postMessage({ type: 'PAYLOAD_READY' });
          swBc.close();
        }, 25);

        const result = await pollPromise;
        expect(result).toEqual({ title: 'Shared via SW', url: 'https://sw-shared.com' });
      } finally {
        if (originalIDB !== undefined) (global as any).indexedDB = originalIDB;
        else delete (global as any).indexedDB;

        if (originalBC !== undefined) (global as any).BroadcastChannel = originalBC;
        else delete (global as any).BroadcastChannel;
      }
    });

    it('pollPendingSharedData should resolve to null on timeout if no data arrives', async () => {
      const originalIDB = (global as any).indexedDB;
      (global as any).indexedDB = {
        open: () => {
          const req: any = {};
          setTimeout(() => {
            req.result = {
              close: () => {},
              transaction: () => ({
                objectStore: () => ({
                  getAll: () => {
                    const r: any = {};
                    setTimeout(() => {
                      r.result = [];
                      if (r.onsuccess) r.onsuccess();
                    }, 0);
                    return r;
                  }
                })
              })
            };
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        }
      };

      try {
        const result = await pollPendingSharedData(80);
        expect(result).toBeNull();
      } finally {
        if (originalIDB !== undefined) (global as any).indexedDB = originalIDB;
        else delete (global as any).indexedDB;
      }
    });
  });
});
