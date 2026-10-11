import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AdminTelemetryService,
  normalizeErrorMessageToEnglish
} from '../../src/services/admin-telemetry.service.js';
import { AiMetricsService } from '../../src/services/ai-metrics.service.js';

describe('Admin Operations Inspection & Fallback Unit Tests', () => {
  describe('1. normalizeErrorMessageToEnglish', () => {
    it('should map Turkish CairoSVG missing error to clean English', () => {
      const input = 'cairosvg yüklü değil: SVG dönüşümü için CairoSVG gereklidir (pip install cairosvg)';
      const output = normalizeErrorMessageToEnglish(input);
      expect(output).toContain('CairoSVG library is not installed');
      expect(output).toContain('pip install cairosvg');
    });

    it('should map Turkish image conversion error to clean English', () => {
      const input = 'Resim dönüşüm hatası: Kaynak dosya bozuk veya okunamıyor';
      const output = normalizeErrorMessageToEnglish(input);
      expect(output).toContain('Image conversion error');
      expect(output).toContain('Failed to process source image');
    });

    it('should map Turkish FFmpeg error to clean English', () => {
      const input = 'FFmpeg hatası: Codec h264 bulunamadı';
      const output = normalizeErrorMessageToEnglish(input);
      expect(output).toContain('FFmpeg encoding error');
      expect(output).toContain('Media stream conversion failed');
    });

    it('should map Turkish page conversion error to clean English', () => {
      const input = 'Sayfa dönüştürülemedi: 3. sayfa işlenirken hata oluştu';
      const output = normalizeErrorMessageToEnglish(input);
      expect(output).toContain('Page rendering error');
      expect(output).toContain('Could not convert document page');
    });

    it('should preserve standard English error messages', () => {
      const input = 'Connection refused at 127.0.0.1:6379';
      const output = normalizeErrorMessageToEnglish(input);
      expect(output).toBe('Connection refused at 127.0.0.1:6379');
    });

    it('should handle undefined or empty message gracefully', () => {
      expect(normalizeErrorMessageToEnglish(undefined)).toBe('Unknown error occurred.');
      expect(normalizeErrorMessageToEnglish('')).toBe('Unknown error occurred.');
    });
  });

  describe('2. Multi-Key Fallback Pipeline in AiMetricsService', () => {
    let aiService: AiMetricsService;

    beforeEach(() => {
      aiService = AiMetricsService.getInstance();
      // Clear internal metrics.keys to isolate tests
      (aiService as any).metrics.keys = [];
      aiService.updateKey({
        id: 'agnes-primary',
        name: 'Agnes AI (Primary)',
        baseUrl: 'https://apihub.agnes-ai.com/v1',
        model: 'agnes-3.0-flash',
        apiKey: 'sk-agnes-test-primary-key',
        priority: 1
      });
    });

    it('should successfully execute with primary key when primary succeeds', async () => {
      const mockFn = vi.fn().mockImplementation(async (key) => {
        return `Success from ${key.name}`;
      });

      const { result, usedKey } = await aiService.executeWithFallback(mockFn, { module: 'test-module' });
      expect(result).toBe('Success from Agnes AI (Primary)');
      expect(usedKey.id).toBe('agnes-primary');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should fall back to secondary key when primary fails with 504 Gateway Timeout', async () => {
      // Add a secondary fallback key with priority 2
      aiService.updateKey({
        id: 'gemini-fallback',
        name: 'Google Gemini 2.0 Flash Backup',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.0-flash',
        apiKey: 'sk-gemini-backup-key',
        priority: 2
      });

      const mockFn = vi.fn().mockImplementation(async (key) => {
        if (key.id === 'agnes-primary') {
          const err = new Error('504 Gateway Timeout: Upstream did not respond within 3500ms') as any;
          err.statusCode = 504;
          throw err;
        }
        return `Recovered via ${key.name}`;
      });

      const { result, usedKey } = await aiService.executeWithFallback(mockFn, { module: 'test-quiz-fallback' });
      expect(result).toBe('Recovered via Google Gemini 2.0 Flash Backup');
      expect(usedKey.id).toBe('gemini-fallback');
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Verify that call log recorded the failed key with error details
      const telemetry = aiService.getTelemetryData();
      const failedLog = telemetry.recentLogs.find(l => l.statusCode === 504);
      expect(failedLog).toBeDefined();
      expect(failedLog?.keyId).toBe('agnes-primary');
      expect(failedLog?.errorDetails).toContain('504 Gateway Timeout');
    });

    it('should throw last error when all configured keys fail', async () => {
      const mockFn = vi.fn().mockImplementation(async (key) => {
        const err = new Error(`Exhausted error from ${key.name}`) as any;
        err.statusCode = 500;
        throw err;
      });

      await expect(aiService.executeWithFallback(mockFn, { module: 'test-fail-all' })).rejects.toThrow(
        /Exhausted error/
      );
    });

    it('should allow deleting fallback key but prevent deleting primary key', () => {
      // Add temporary fallback key
      aiService.updateKey({
        id: 'temp-custom-key',
        name: 'Temporary Custom Key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        apiKey: 'sk-test-temp-12345',
        priority: 5
      });

      // Deleting primary should throw
      expect(() => aiService.deleteKey('agnes-primary')).toThrow(
        /Không thể xóa API key chính/
      );

      // Deleting secondary should succeed
      const deleteResult = aiService.deleteKey('temp-custom-key');
      expect(deleteResult.success).toBe(true);

      const allKeys = aiService.getTelemetryData().keys;
      expect(allKeys.some(k => k.id === 'temp-custom-key')).toBe(false);
    });
  });

  describe('3. Admin Operations Inspection Endpoints', () => {
    it('should inspect SQLite Database and return dev.db details', async () => {
      const adminService = AdminTelemetryService.getInstance();
      const dbInfo = await adminService.inspectSqliteDatabase();

      expect(dbInfo).toHaveProperty('files');
      expect(Array.isArray(dbInfo.files)).toBe(true);
      expect(dbInfo).toHaveProperty('tables');
      expect(dbInfo).toHaveProperty('pragma');
      expect(typeof dbInfo.tables.jobs).toBe('number');
      expect(typeof dbInfo.tables.files).toBe('number');
    });

    it('should inspect BullMQ Queues and return job listings', async () => {
      const adminService = AdminTelemetryService.getInstance();
      const queueInspect = await adminService.inspectBullMqQueues();

      expect(queueInspect).toHaveProperty('jobs');
      expect(Array.isArray(queueInspect.jobs)).toBe(true);
      expect(queueInspect).toHaveProperty('countsByQueue');
      expect(typeof queueInspect.countsByQueue.pdf).toBe('number');
      expect(typeof queueInspect.countsByQueue.converter).toBe('number');
      expect(typeof queueInspect.countsByQueue.quiz).toBe('number');
    });

    it('should inspect R2 Transit objects safely', async () => {
      const adminService = AdminTelemetryService.getInstance();
      const r2Transit = await adminService.inspectR2Transit();

      expect(r2Transit).toHaveProperty('objects');
      expect(Array.isArray(r2Transit.objects)).toBe(true);
      expect(typeof r2Transit.totalCount).toBe('number');
      expect(typeof r2Transit.totalSizeBytes).toBe('number');
    });

    it('should inspect Trash History safely', async () => {
      const adminService = AdminTelemetryService.getInstance();
      const trash = await adminService.inspectTrashHistory();

      expect(trash).toHaveProperty('records');
      expect(Array.isArray(trash.records)).toBe(true);
      expect(typeof trash.totalCount).toBe('number');
    });
  });
});
