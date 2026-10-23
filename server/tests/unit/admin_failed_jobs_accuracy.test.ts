import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSemanticErrorDetails, AdminTelemetryService } from '../../src/services/admin-telemetry.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Admin Failed Jobs Classification & Duration Accuracy Tests', () => {
  describe('1. Semantic Module Classification', () => {
    it('should classify convert_pdf and converter jobs as Universal Converter', () => {
      const sem1 = extractSemanticErrorDetails('Error converting presentation', 'convert_pdf');
      expect(sem1.category).toBe('Universal Converter');

      const sem2 = extractSemanticErrorDetails('Unsupported image format', 'convert_docx');
      expect(sem2.category).toBe('Universal Converter');

      const sem3 = extractSemanticErrorDetails('FFmpeg encoding failed', 'media_transcode');
      expect(sem3.category).toBe('Universal Converter');
    });

    it('should classify pdf_ operations as PDF Studio Pro', () => {
      const sem1 = extractSemanticErrorDetails('pdf2docx library is missing', 'pdf_compress');
      expect(sem1.category).toBe('PDF Studio Pro');

      const sem2 = extractSemanticErrorDetails('Engine worker process crashed with exit code 1', 'pdf_merge');
      expect(sem2.category).toBe('PDF Studio Pro');

      const sem3 = extractSemanticErrorDetails('Split page range out of bounds', 'pdf_split');
      expect(sem3.category).toBe('PDF Studio Pro');
    });

    it('should classify quiz operations as Quiz Generator', () => {
      const sem1 = extractSemanticErrorDetails('No questions detected on pages', 'quiz_generate');
      expect(sem1.category).toBe('Quiz Generator');
    });
  });

  describe('2. Failed Jobs Duration Accuracy & Bogus Elimination', () => {
    let telemetryService: AdminTelemetryService;

    beforeEach(() => {
      telemetryService = new AdminTelemetryService();
    });

    it('should return null duration for FAILED jobs without completedAt (eliminating bogus 150h+ duration)', async () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000);
      const mockJobs = [
        {
          id: 'job_ancient_failed_123',
          type: 'convert_pdf',
          status: 'FAILED',
          progress: 25,
          errorMessage: 'Presentation conversion failed',
          optionsJson: '{}',
          createdAt: twentyDaysAgo,
          startedAt: twentyDaysAgo,
          completedAt: null
        }
      ];

      vi.spyOn(prisma.job, 'findMany').mockResolvedValue(mockJobs as any);

      const failedJobs = await telemetryService.getFailedJobs(10);
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].id).toBe('job_ancient_failed_123');
      expect(failedJobs[0].durationMs).toBeNull();
    });

    it('should compute exact duration when completedAt is provided', async () => {
      const started = new Date('2026-10-20T10:00:00Z');
      const completed = new Date('2026-10-20T10:00:05.500Z');
      const mockJobs = [
        {
          id: 'job_proper_duration_456',
          type: 'convert_pdf',
          status: 'FAILED',
          progress: 50,
          errorMessage: 'Timeout converting page',
          optionsJson: '{}',
          createdAt: started,
          startedAt: started,
          completedAt: completed
        }
      ];

      vi.spyOn(prisma.job, 'findMany').mockResolvedValue(mockJobs as any);

      const failedJobs = await telemetryService.getFailedJobs(10);
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].durationMs).toBe(5500);
    });

    it('should cap / set null for durations exceeding 48 hours (sanity clamp)', async () => {
      const started = new Date('2026-10-01T10:00:00Z');
      const completed = new Date('2026-10-10T10:00:00Z'); // 9 days later
      const mockJobs = [
        {
          id: 'job_skewed_clock',
          type: 'pdf_compress',
          status: 'FAILED',
          progress: 10,
          errorMessage: 'Unknown error',
          optionsJson: '{}',
          createdAt: started,
          startedAt: started,
          completedAt: completed
        }
      ];

      vi.spyOn(prisma.job, 'findMany').mockResolvedValue(mockJobs as any);

      const failedJobs = await telemetryService.getFailedJobs(10);
      expect(failedJobs).toHaveLength(1);
      expect(failedJobs[0].durationMs).toBeNull();
    });
  });

  describe('3. Client-Side Category and Timeout Helpers', () => {
    // Pure logic simulation matching isJobOfCategory and isJobTimeout in AdminFailedJobsInspector.js
    function isJobOfCategory(j: { type: string }, cat: string) {
      const t = String(j?.type || '').toLowerCase();
      if (cat === 'conv') {
        return t.startsWith('convert_') || t.includes('conv') || t.includes('media') || t.includes('format');
      }
      if (cat === 'pdf') {
        return (t.startsWith('pdf_') || t === 'pdf') && !t.startsWith('convert_');
      }
      if (cat === 'quiz') {
        return t.startsWith('quiz_') || t.includes('quiz');
      }
      return false;
    }

    function isJobTimeout(j: { errorMessage?: string }) {
      const msg = String(j?.errorMessage || '').toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('etimedout') ||
        msg.includes('hết giờ') ||
        msg.includes('zaman aşımı') ||
        msg.includes('quá thời gian')
      );
    }

    it('should isolate convert_pdf from pdf tab and place it in conv tab', () => {
      const job1 = { type: 'convert_pdf' };
      const job2 = { type: 'pdf_compress' };

      expect(isJobOfCategory(job1, 'conv')).toBe(true);
      expect(isJobOfCategory(job1, 'pdf')).toBe(false);

      expect(isJobOfCategory(job2, 'pdf')).toBe(true);
      expect(isJobOfCategory(job2, 'conv')).toBe(false);
    });

    it('should correctly identify true timeout jobs and reject non-timeout errors', () => {
      expect(isJobTimeout({ errorMessage: 'Command timed out after 60000ms' })).toBe(true);
      expect(isJobTimeout({ errorMessage: 'ETIMEDOUT: Connection lost' })).toBe(true);
      expect(isJobTimeout({ errorMessage: 'Tác vụ đã hết giờ quy định' })).toBe(true);

      // Non-timeout errors should NOT be treated as timeout even if they took a long time
      expect(isJobTimeout({ errorMessage: 'LibreOffice binary not found in PATH' })).toBe(false);
      expect(isJobTimeout({ errorMessage: 'cairosvg is not installed' })).toBe(false);
      expect(isJobTimeout({ errorMessage: 'User aborted task' })).toBe(false);
    });
  });
});
