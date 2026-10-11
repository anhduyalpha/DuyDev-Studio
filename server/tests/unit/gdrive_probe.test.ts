import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { probeGoogleDriveFile } from '../../src/services/drive-download.service.js';

describe('Google Drive Pre-flight Probe Service (Ticket #06)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects invalid or non-drive URLs immediately', async () => {
    const res = await probeGoogleDriveFile('https://example.com/not-drive');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('INVALID_URL');
  });

  it('returns valid: true for publicly accessible files', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({
        'content-type': 'application/pdf',
        'content-length': '2048576',
        'content-disposition': 'attachment; filename="de_thi_hoa.pdf"'
      }),
      text: async () => ''
    } as any);

    const res = await probeGoogleDriveFile('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
    expect(res.valid).toBe(true);
    expect(res.driveId).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
    expect(res.fileName).toBe('de_thi_hoa.pdf');
    expect(res.mimeType).toBe('application/pdf');
    expect(res.fileSize).toBe(2048576);
  });

  it('detects private files redirecting to Google Login / access denied', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers({
        'content-type': 'text/html; charset=utf-8'
      }),
      text: async () => '<html><body><form action="https://accounts.google.com/ServiceLogin">Sign in to continue</form></body></html>'
    } as any);

    const res = await probeGoogleDriveFile('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('PRIVATE_ACCESS_REQUIRED');
    expect(res.message).toContain('chưa được mở quyền');
  });

  it('detects 404 Not Found deleted or non-existent files', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 404,
      ok: false,
      headers: new Headers({
        'content-type': 'text/html'
      }),
      text: async () => '404 Not Found'
    } as any);

    const res = await probeGoogleDriveFile('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('NOT_FOUND');
    expect(res.message).toContain('không tồn tại');
  });

  it('handles probe timeout gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted due to timeout'));

    const res = await probeGoogleDriveFile('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('PROBE_TIMEOUT');
    expect(res.message).toContain('vượt quá 3 giây');
  });
});
