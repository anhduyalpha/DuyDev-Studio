import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AdminTelemetryService,
  normalizeErrorMessageToEnglish
} from '../../src/services/admin-telemetry.service.js';
import { prisma } from '../../src/lib/prisma.js';
import { aiMetricsService } from '../../src/services/ai-metrics.service.js';

describe('Admin Error Logs Export & Deduplication Unit Tests', () => {
  let telemetryService: AdminTelemetryService;

  beforeEach(() => {
    telemetryService = AdminTelemetryService.getInstance();
    vi.restoreAllMocks();
  });

  describe('1. exportErrorLogsAsText deduplication algorithm', () => {
    it('should deduplicate repeated error messages and calculate reduction stats', async () => {
      const now = new Date();
      const mockJobs = [
        {
          id: 'job-1',
          type: 'converter',
          status: 'FAILED',
          errorMessage: 'cairosvg yüklü değil: SVG dönüşümü için CairoSVG gereklidir (pip install cairosvg)',
          optionsJson: JSON.stringify({ fileName: 'logo.svg', sourceFormat: 'svg', targetFormat: 'png' }),
          createdAt: new Date(now.getTime() - 10000),
          startedAt: new Date(now.getTime() - 9500),
          completedAt: new Date(now.getTime() - 9300),
          files: [{ originalName: 'logo.svg', mimeType: 'image/svg+xml', sizeBytes: BigInt(2048) }]
        },
        {
          id: 'job-2',
          type: 'converter',
          status: 'FAILED',
          errorMessage: 'cairosvg yüklü değil: SVG dönüşümü için CairoSVG gereklidir (pip install cairosvg)',
          optionsJson: JSON.stringify({ fileName: 'icon.svg', sourceFormat: 'svg', targetFormat: 'jpg' }),
          createdAt: new Date(now.getTime() - 5000),
          startedAt: new Date(now.getTime() - 4800),
          completedAt: new Date(now.getTime() - 4600),
          files: [{ originalName: 'icon.svg', mimeType: 'image/svg+xml', sizeBytes: BigInt(4096) }]
        },
        {
          id: 'job-3',
          type: 'converter',
          status: 'FAILED',
          errorMessage: 'cairosvg yüklü değil: SVG dönüşümü için CairoSVG gereklidir (pip install cairosvg)',
          optionsJson: JSON.stringify({ fileName: 'badge.svg', sourceFormat: 'svg', targetFormat: 'webp' }),
          createdAt: now,
          startedAt: new Date(now.getTime() - 200),
          completedAt: now,
          files: []
        },
        {
          id: 'job-4',
          type: 'pdf',
          status: 'FAILED',
          errorMessage: 'Sayfa dönüştürülemedi: 1. sayfa işlenirken hata oluştu',
          optionsJson: JSON.stringify({ fileName: 'document.pdf', mode: 'split' }),
          createdAt: new Date(now.getTime() - 2000),
          startedAt: new Date(now.getTime() - 1800),
          completedAt: new Date(now.getTime() - 1500),
          files: []
        }
      ];

      vi.spyOn(prisma.job, 'findMany').mockResolvedValue(mockJobs as any);

      const result = await telemetryService.exportErrorLogsAsText({ dedupe: true });

      expect(result.totalErrors).toBe(4);
      expect(result.uniqueErrors).toBe(2);
      expect(result.duplicateCount).toBe(2);
      expect(result.reductionPercentage).toBe(50.0);
      expect(result.fileName).toMatch(/^duydev-studio-error-logs-\d{4}-\d{2}-\d{2}/);

      // Verify TXT document sections
      expect(result.text).toContain('DUYDEV STUDIO - SYSTEM ERROR DIAGNOSTICS & AUDIT LOG REPORT');
      expect(result.text).toContain('[DEDUPLICATED & CONSOLIDATED LOG EXPORT]');
      expect(result.text).toContain('Total Raw Failures   : 4 records');
      expect(result.text).toContain('Unique Root Causes   : 2 distinct error signatures');
      expect(result.text).toContain('Duplicates Merged    : 2 redundant records eliminated (50% noise reduction)');

      // Verify Table & Root Cause Section
      expect(result.text).toContain('CairoSVG library is not installed');
      expect(result.text).toContain('Page rendering error: Could not convert document page');
      expect(result.text).toContain('logo.svg');
      expect(result.text).toContain('icon.svg');
      expect(result.text).toContain('badge.svg');
      expect(result.text).toContain('document.pdf');
    });

    it('should handle zero error records gracefully', async () => {
      vi.spyOn(prisma.job, 'findMany').mockResolvedValue([]);
      vi.spyOn(aiMetricsService, 'getTelemetryData').mockReturnValue({
        recentLogs: []
      } as any);

      const result = await telemetryService.exportErrorLogsAsText();

      expect(result.totalErrors).toBe(0);
      expect(result.uniqueErrors).toBe(0);
      expect(result.duplicateCount).toBe(0);
      expect(result.reductionPercentage).toBe(0);
      expect(result.text).toContain('TRẠNG THÁI HỆ THỐNG HOÀN TOÀN KHỎE MẠNH (ALL SYSTEMS HEALTHY)');
    });

    it('should include failed AI invocations in report when available', async () => {
      vi.spyOn(prisma.job, 'findMany').mockResolvedValue([
        {
          id: 'job-1',
          type: 'quiz',
          status: 'FAILED',
          errorMessage: 'Queue failure: Unable to enqueue quiz generation task. Please try again.',
          optionsJson: '{}',
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          files: []
        }
      ] as any);

      vi.spyOn(aiMetricsService, 'getTelemetryData').mockReturnValue({
        keys: [],
        rateLimits: {} as any,
        tokenUsage: {} as any,
        cumulative: {} as any,
        daily: {} as any,
        recentLogs: [
          {
            timestamp: new Date().toISOString(),
            provider: 'agnes',
            model: 'agnes-3.0-flash',
            keyName: 'Agnes AI (Primary)',
            keyId: 'agnes-1',
            promptTokens: 50,
            completionTokens: 0,
            totalTokens: 50,
            latencyMs: 3500,
            statusCode: 504,
            errorDetails: '504 Gateway Timeout: Upstream did not respond within 3500ms',
            promptSnippet: 'trang 10 câu 1 đến 5'
          }
        ]
      });

      const result = await telemetryService.exportErrorLogsAsText();

      expect(result.text).toContain('NHẬT KÝ LỖI GỌI AI AGENT / MÔ HÌNH NGÔN NGỮ (AI INVOCATIONS - DEDUPLICATED)');
      expect(result.text).toContain('Agnes AI (Primary)');
      expect(result.text).toContain('504 Gateway Timeout');
    });
  });

  describe('2. normalizeErrorMessageToEnglish', () => {
    it('should translate Turkish and foreign errors accurately', () => {
      expect(normalizeErrorMessageToEnglish('cairosvg yüklü değil')).toContain('CairoSVG library is not installed');
      expect(normalizeErrorMessageToEnglish('resim dönüşüm hatası: test')).toContain('Image conversion error');
      expect(normalizeErrorMessageToEnglish('ffmpeg hatası: codec error')).toContain('FFmpeg encoding error');
      expect(normalizeErrorMessageToEnglish('sayfa dönüştürülemedi')).toContain('Page rendering error');
      expect(normalizeErrorMessageToEnglish('dosya bulunamadı')).toContain('File not found');
      expect(normalizeErrorMessageToEnglish('geçersiz dosya formatı')).toContain('Invalid file format');
      expect(normalizeErrorMessageToEnglish('bellek yetersiz')).toContain('Out of memory');
      expect(normalizeErrorMessageToEnglish('zaman aşımı')).toContain('Operation timed out');
      expect(normalizeErrorMessageToEnglish('không thể xếp hàng tạo bài tập trắc nghiệm')).toContain('Queue failure');
    });
  });
});
