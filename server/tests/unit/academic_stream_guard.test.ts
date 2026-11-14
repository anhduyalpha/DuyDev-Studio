/**
 * academic_stream_guard.test.ts - Unit tests for SSRF/Redirect guard, MIME validation,
 * and direct PDF device download stream in Academia & ResearchGate services.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AcademiaService } from '../../src/services/academia.service.js';
import { ResearchGateService } from '../../src/services/researchgate.service.js';
import { AppError } from '../../src/lib/errors.js';

describe('Academic Stream Guard & Direct Download Suite', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function createMockReply() {
    let statusCode = 200;
    const headersObj: Record<string, string | number> = {};
    let sentData: any = null;

    const reply: any = {
      code: vi.fn((code: number) => {
        statusCode = code;
        return reply;
      }),
      headers: vi.fn((h: Record<string, string | number>) => {
        Object.assign(headersObj, h);
        return reply;
      }),
      send: vi.fn((data: any) => {
        sentData = data;
        return Promise.resolve(reply);
      }),
      getHeader: (name: string) => headersObj[name],
      get statusCode() {
        return statusCode;
      },
      get headersObj() {
        return headersObj;
      },
      get sentData() {
        return sentData;
      }
    };
    return reply;
  }

  describe('AcademiaService.proxyStream Redirect & SSRF Guard', () => {
    it('follows valid HTTPS OA redirects from openalex.org to publisher PDF stream', async () => {
      const mockFetch = vi.fn(async (url: string, init?: any) => {
        if (url === 'https://openalex.org/oa/paper123') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://www.nature.com/articles/paper123.pdf' }
          });
        }
        if (url === 'https://www.nature.com/articles/paper123.pdf') {
          return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Length': '4'
            }
          });
        }
        return new Response(null, { status: 404 });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await AcademiaService.proxyStream(
        'https://openalex.org/oa/paper123',
        true,
        'nature_paper.pdf',
        undefined,
        mockReply
      );

      expect(mockReply.statusCode).toBe(200);
      expect(mockReply.headersObj['Content-Type']).toBe('application/pdf');
      expect(mockReply.headersObj['Content-Disposition']).toContain('attachment');
      expect(mockReply.headersObj['Content-Disposition']).toContain('nature_paper.pdf');
      expect(mockReply.sentData).toBeDefined();
    });

    it('rejects intermediate hop redirecting to internal SSRF target (169.254.169.254 or 127.0.0.1)', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://openalex.org/oa/malicious') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'http://169.254.169.254/latest/meta-data/' }
          });
        }
        return new Response(null, { status: 200 });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await expect(
        AcademiaService.proxyStream(
          'https://openalex.org/oa/malicious',
          true,
          'malicious.pdf',
          undefined,
          mockReply
        )
      ).rejects.toThrow(/SSRF Protection|Truy cập mạng nội bộ bị từ chối|Chỉ cho phép liên kết HTTPS bảo mật/);

      // Verify the AWS metadata IP was never requested
      expect(mockFetch).not.toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/', expect.anything());
    });

    it('rejects redirect to plain HTTP non-secure URL', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://openalex.org/oa/insecure') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'http://core.ac.uk/download/pdf/123.pdf' }
          });
        }
        return new Response(null, { status: 200 });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await expect(
        AcademiaService.proxyStream(
          'https://openalex.org/oa/insecure',
          false,
          'insecure.pdf',
          undefined,
          mockReply
        )
      ).rejects.toThrow(/HTTPS/i);
    });

    it('throws AppError with HTTP 422 when upstream returns text/html login wall instead of PDF', async () => {
      let cancelCalled = false;
      const mockFetch = vi.fn(async (url: string) => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html><body>Please log in to Academia</body></html>'));
            controller.close();
          },
          cancel() {
            cancelCalled = true;
          }
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8'
          }
        });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await expect(
        AcademiaService.proxyStream(
          'https://www.academia.edu/attachments/12345/download_file',
          true,
          'login_wall.pdf',
          undefined,
          mockReply
        )
      ).rejects.toMatchObject({
        statusCode: 422
      });

      expect(cancelCalled).toBe(true);
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('AcademiaService.saveToDrive rejects upstream HTML login wall with HTTP 422', async () => {
      let cancelCalled = false;
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://www.academia.edu/123456/sample_paper') {
          return new Response(`<html><title>Sample Paper - Academia.edu</title><meta name="citation_pdf_url" content="https://www.academia.edu/attachments/123/download_file"></html>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html><body>HTML Paywall</body></html>'));
            controller.close();
          },
          cancel() {
            cancelCalled = true;
          }
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      });

      globalThis.fetch = mockFetch as any;

      await expect(
        AcademiaService.saveToDrive(
          'https://www.academia.edu/123456/sample_paper',
          'Sample Paper',
          '123456'
        )
      ).rejects.toMatchObject({
        statusCode: 422
      });

      expect(cancelCalled).toBe(true);
    });
  });

  describe('ResearchGateService.proxyStream Redirect & SSRF Guard', () => {
    it('follows valid HTTPS OA redirects from doi.org to sciencedirect OA PDF', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://doi.org/10.1016/j.sample.2026.01') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'https://www.sciencedirect.com/science/article/pii/S12345/pdfft' }
          });
        }
        if (url === 'https://www.sciencedirect.com/science/article/pii/S12345/pdfft') {
          return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Length': '4'
            }
          });
        }
        return new Response(null, { status: 404 });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await ResearchGateService.proxyStream(
        'https://doi.org/10.1016/j.sample.2026.01',
        true,
        'sciencedirect_paper.pdf',
        undefined,
        mockReply
      );

      expect(mockReply.statusCode).toBe(200);
      expect(mockReply.headersObj['Content-Type']).toBe('application/pdf');
      expect(mockReply.headersObj['Content-Disposition']).toContain('attachment');
      expect(mockReply.headersObj['Content-Disposition']).toContain('sciencedirect_paper.pdf');
    });

    it('rejects hop to 127.0.0.1 loopback target', async () => {
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://doi.org/10.1016/sample-bad') {
          return new Response(null, {
            status: 302,
            headers: { Location: 'http://127.0.0.1:3000/api/v1/admin/secrets' }
          });
        }
        return new Response(null, { status: 200 });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await expect(
        ResearchGateService.proxyStream(
          'https://doi.org/10.1016/sample-bad',
          true,
          'exploit.pdf',
          undefined,
          mockReply
        )
      ).rejects.toThrow(/SSRF Protection|Truy cập mạng nội bộ bị từ chối|Chỉ cho phép liên kết HTTPS bảo mật/);

      expect(mockFetch).not.toHaveBeenCalledWith('http://127.0.0.1:3000/api/v1/admin/secrets', expect.anything());
    });

    it('throws AppError with HTTP 422 when upstream returns text/html error page', async () => {
      let cancelCalled = false;
      const mockFetch = vi.fn(async (url: string) => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html><body>Error: Login required to view ResearchGate paper</body></html>'));
            controller.close();
          },
          cancel() {
            cancelCalled = true;
          }
        });
        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8'
          }
        });
      });

      globalThis.fetch = mockFetch as any;

      const mockReply = createMockReply();
      await expect(
        ResearchGateService.proxyStream(
          'https://www.researchgate.net/publication/345678/download',
          true,
          'rg_paper.pdf',
          undefined,
          mockReply
        )
      ).rejects.toMatchObject({
        statusCode: 422
      });

      expect(cancelCalled).toBe(true);
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('ResearchGateService.saveToDrive rejects upstream HTML login wall with HTTP 422', async () => {
      let cancelCalled = false;
      const mockFetch = vi.fn(async (url: string) => {
        if (url === 'https://www.researchgate.net/publication/123456_Sample_Article') {
          return new Response(`<html><title>Sample Article - ResearchGate</title><meta name="citation_pdf_url" content="https://www.researchgate.net/publication/123456/download"></html>`, {
            status: 200,
            headers: { 'Content-Type': 'text/html' }
          });
        }
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('<html><body>HTML Paywall</body></html>'));
            controller.close();
          },
          cancel() {
            cancelCalled = true;
          }
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      });

      globalThis.fetch = mockFetch as any;

      await expect(
        ResearchGateService.saveToDrive(
          'https://www.researchgate.net/publication/123456_Sample_Article',
          'Sample Article',
          '123456'
        )
      ).rejects.toMatchObject({
        statusCode: 422
      });

      expect(cancelCalled).toBe(true);
    });
  });

  describe('Frontend Workspaces "Tải về máy" UI Template Verification', () => {
    const rootDir = path.resolve(__dirname, '../../..');
    const academiaWorkspacePath = path.join(rootDir, 'src/components/tools/academia/AcademiaWorkspace.js');
    const rgWorkspacePath = path.join(rootDir, 'src/components/tools/researchgate/ResearchgateWorkspace.js');

    it('AcademiaWorkspace.js renders "Tải về máy" button/link wired to /api/v1/academia/stream?download=true', () => {
      const content = fs.readFileSync(academiaWorkspacePath, 'utf8');

      // Must have "Tải về máy" text
      expect(content).toContain('Tải về máy');

      // Must wire to /api/v1/academia/stream or getStreamUrl with download: true
      expect(content).toMatch(/getStreamUrl\([^)]*true\)/);

      // Must have disabled state or check for !this\.data\.pdfUrl or !paper\.pdfUrl with "Chưa có PDF trực tiếp"
      expect(content).toContain('Chưa có PDF trực tiếp');

      // Must NOT fall back to originalUrl for direct download
      expect(content).not.toMatch(/getStreamUrl\(this\.data\.pdfUrl\s*\|\|\s*this\.data\.originalUrl/);
    });

    it('ResearchgateWorkspace.js renders "Tải về máy" button/link wired to /api/v1/researchgate/stream?download=true', () => {
      const content = fs.readFileSync(rgWorkspacePath, 'utf8');

      // Must have "Tải về máy" text
      expect(content).toContain('Tải về máy');

      // Must wire to getStreamUrl with download: true
      expect(content).toMatch(/getStreamUrl\([^)]*true\)/);

      // Must have disabled state with "Chưa có PDF trực tiếp"
      expect(content).toContain('Chưa có PDF trực tiếp');

      // Must NOT fall back to originalUrl for direct download
      expect(content).not.toMatch(/getStreamUrl\(this\.data\.pdfUrl\s*\|\|\s*this\.data\.originalUrl/);
    });
  });
});
