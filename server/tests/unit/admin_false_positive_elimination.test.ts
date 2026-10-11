import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSemanticErrorDetails, AdminTelemetryService } from '../../src/services/admin-telemetry.service.js';
import { AiMetricsService } from '../../src/services/ai-metrics.service.js';
import { TelemetryTracker, isBotScannerNoise } from '../../src/api/middleware/telemetry.middleware.js';

describe('Admin False-Positive Elimination & Mission Control Telemetry Tests', () => {

  describe('R1. Accurate Classification in Failed Jobs Diagnostics', () => {
    it('classifies user cancellations as USER_ACTION, not SYSTEM_ERROR', () => {
      const details1 = extractSemanticErrorDetails('USER_CANCELLED: Client closed the connection', 'pdf_merge');
      expect(details1.errorClass).toBe('USER_ACTION');
      expect(details1.severity).toBe('USER_ACTION');
      expect(details1.rootCauseTitle).toContain('Người dùng chủ động hủy tác vụ');

      const details2 = extractSemanticErrorDetails('Job aborted by user cancellation token', 'universal_convert');
      expect(details2.errorClass).toBe('USER_ACTION');
      expect(details2.severity).toBe('USER_ACTION');
    });

    it('classifies invalid input and empty files as USER_ACTION', () => {
      const detailsEmpty = extractSemanticErrorDetails('Tệp đầu vào rỗng (0 bytes) hoặc không có dữ liệu', 'universal_convert');
      expect(detailsEmpty.errorClass).toBe('USER_ACTION');
      expect(detailsEmpty.severity).toBe('USER_ACTION');
      expect(detailsEmpty.rootCauseTitle).toContain('Tệp đầu vào rỗng hoặc sai cấu trúc');

      const detailsBadInput = extractSemanticErrorDetails('BAD_INPUT: Unsupported file format or corrupt header', 'pdf_compress');
      expect(detailsBadInput.errorClass).toBe('USER_ACTION');
      expect(detailsBadInput.severity).toBe('USER_ACTION');
    });

    it('classifies private/restricted external storage links as USER_ACTION', () => {
      const detailsRestricted = extractSemanticErrorDetails('ACCESS_RESTRICTED: Link Google Drive ở chế độ riêng tư, không có quyền truy cập', 'drive_download');
      expect(detailsRestricted.errorClass).toBe('USER_ACTION');
      expect(detailsRestricted.severity).toBe('USER_ACTION');
      expect(detailsRestricted.suggestedFix).toContain('chia sẻ');
    });

    it('classifies quiz content/format mismatches as USER_ACTION', () => {
      const detailsQuiz = extractSemanticErrorDetails('Số câu trắc nghiệm AI trích xuất không khớp với cấu hình', 'quiz_generate');
      expect(detailsQuiz.errorClass).toBe('USER_ACTION');
      expect(detailsQuiz.severity).toBe('USER_ACTION');
    });

    it('classifies core engine crashes, missing dependencies, and timeouts as SYSTEM_ERROR', () => {
      const detailsCrash = extractSemanticErrorDetails('Segmentation fault: PyMuPDF core pointer exception at 0x0000', 'pdf_split');
      expect(detailsCrash.errorClass).toBe('SYSTEM_ERROR');
      expect(detailsCrash.severity).toBe('CRITICAL');

      const detailsMissingDep = extractSemanticErrorDetails('libreoffice: command not found in PATH', 'universal_convert');
      expect(detailsMissingDep.errorClass).toBe('SYSTEM_ERROR');
      expect(detailsMissingDep.severity).toBe('CRITICAL');
      expect(detailsMissingDep.suggestedFix).toContain('LibreOffice');

      const detailsTimeout = extractSemanticErrorDetails('Process timed out after 300000ms watchdog trigger', 'universal_convert');
      expect(detailsTimeout.errorClass).toBe('SYSTEM_ERROR');
      expect(detailsTimeout.severity).toBe('TIMEOUT');
    });

    it('formats exportErrorLogsAsText with separated system defects and user actions', async () => {
      const service = AdminTelemetryService.getInstance();
      const exportResult = await service.exportErrorLogsAsText({ dedupe: true });
      expect(exportResult).toHaveProperty('text');
      expect(exportResult).toHaveProperty('fileName');
      expect(exportResult).toHaveProperty('totalErrors');

      if (exportResult.totalErrors > 0) {
        expect(exportResult.text).toContain('System Core Defects');
        expect(exportResult.text).toContain('User Actions / Input');
      }
    });
  });

  describe('R2. Telemetry & AI Agents Card (Fallback Recovery)', () => {
    let aiService: AiMetricsService;

    beforeEach(() => {
      aiService = AiMetricsService.getInstance();
      // Deactivate any other keys to ensure predictable priority order
      aiService.getTelemetryData().keys.forEach(k => {
        if (k.id !== 'agnes-primary' && k.id !== 'gemini-fallback') {
          aiService.updateKey({ id: k.id, isActive: false });
        }
      });
      // Ensure primary key and fallback key are active
      aiService.updateKey({
        id: 'agnes-primary',
        name: 'Agnes AI Primary',
        baseUrl: 'https://apihub.agnes-ai.com/v1',
        model: 'agnes-3.0-flash',
        apiKey: 'sk-test-primary-active-key',
        priority: 1,
        isActive: true
      });
      aiService.updateKey({
        id: 'gemini-fallback',
        name: 'Google Gemini Backup',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.0-flash',
        apiKey: 'sk-test-gemini-backup-key',
        priority: 2,
        isActive: true
      });
    });

    it('marks failed primary key attempts as FALLBACK_RECOVERED and does not increment errorCalls on success', async () => {
      const initialMetrics = aiService.getTelemetryData();
      const initialErrorCalls = initialMetrics.cumulative.errorCalls;

      const mockFn = vi.fn().mockImplementation(async (key) => {
        if (key.id === 'agnes-primary') {
          const err = new Error('504 Gateway Timeout: Upstream did not respond within 3500ms') as any;
          err.statusCode = 504;
          throw err;
        }
        return `Success via ${key.name}`;
      });

      const { result, usedKey } = await aiService.executeWithFallback(mockFn, { module: 'test-fallback-recovery' });

      expect(result).toBe('Success via Google Gemini Backup');
      expect(usedKey.id).toBe('gemini-fallback');

      const afterMetrics = aiService.getTelemetryData();
      // Error calls should NOT increment because the operation was recovered by fallback
      expect(afterMetrics.cumulative.errorCalls).toBe(initialErrorCalls);

      // Verify the log was marked as FALLBACK_RECOVERED while preserving 504 statusCode
      const recoveredLog = afterMetrics.recentLogs.find(l => l.module === 'test-fallback-recovery' && l.keyId === 'agnes-primary');
      expect(recoveredLog).toBeDefined();
      expect(recoveredLog?.statusCode).toBe(504);
      expect(recoveredLog?.isFallbackRecovered).toBe(true);
      expect(recoveredLog?.status).toBe('FALLBACK_RECOVERED');
      expect(recoveredLog?.recoveredByKey).toBe('Google Gemini Backup');
    });

    it('increments errorCalls when ALL configured keys fail', async () => {
      const initialMetrics = aiService.getTelemetryData();
      const initialErrorCalls = initialMetrics.cumulative.errorCalls;

      const mockFn = vi.fn().mockImplementation(async (key) => {
        const err = new Error(`All keys failed from ${key.name}`) as any;
        err.statusCode = 500;
        throw err;
      });

      await expect(aiService.executeWithFallback(mockFn, { module: 'test-all-failed' })).rejects.toThrow();

      const afterMetrics = aiService.getTelemetryData();
      expect(afterMetrics.cumulative.errorCalls).toBeGreaterThan(initialErrorCalls);
    });
  });

  describe('R3. Noise Isolation for Bot Scanners', () => {
    it('detects automated bot scanner probes correctly', () => {
      expect(isBotScannerNoise('/.env', 404)).toBe(true);
      expect(isBotScannerNoise('/wp-login.php', 404)).toBe(true);
      expect(isBotScannerNoise('/phpmyadmin/index.php', 404)).toBe(true);
      expect(isBotScannerNoise('/.git/config', 404)).toBe(true);
      expect(isBotScannerNoise('/actuator/health', 404)).toBe(true);
      expect(isBotScannerNoise('/setup.cgi?next_file=netgear.cfg', 400)).toBe(true);
      expect(isBotScannerNoise('/any/blocked/url', 403)).toBe(true);

      // Legitimate requests should NOT be considered scanner noise
      expect(isBotScannerNoise('/api/v1/jobs/non-existent-id', 404)).toBe(false);
      expect(isBotScannerNoise('/api/v1/auth/login', 200)).toBe(false);
      expect(isBotScannerNoise('/api/v1/files/upload', 500)).toBe(false);
    });

    it('isolates bot noise so errorRatePercent remains 0.0% and systemHealth is HEALTHY', () => {
      const tracker = TelemetryTracker.getInstance();

      // Record legitimate 200 OK requests
      const okReq = { headers: {}, ip: '127.0.0.1', raw: { url: '/api/v1/health' } } as any;
      const okReply = { statusCode: 200, getHeader: () => '100' } as any;
      tracker.recordRequest(okReq, okReply, 10);
      tracker.recordRequest(okReq, okReply, 15);

      // Record 10 malicious scanner probes (e.g. /.env, /wp-login)
      const scannerProbe1 = { headers: {}, ip: '185.220.101.5', raw: { url: '/.env' } } as any;
      const probeReply404 = { statusCode: 404, getHeader: () => '50' } as any;
      for (let i = 0; i < 5; i++) {
        tracker.recordRequest(scannerProbe1, probeReply404, 5);
      }

      const scannerProbe2 = { headers: {}, ip: '185.220.101.5', raw: { url: '/wp-login.php' } } as any;
      for (let i = 0; i < 5; i++) {
        tracker.recordRequest(scannerProbe2, probeReply404, 5);
      }

      const snapshot = tracker.getSnapshot();

      // Scanner noise must be isolated
      expect(snapshot.statusCodes.c4xxNoise).toBeGreaterThanOrEqual(10);
      expect(snapshot.health.scannerNoiseIsolated).toBeGreaterThanOrEqual(10);

      // System health and error rate must NOT be contaminated by scanner probes
      expect(snapshot.health.systemHealth).toBe('HEALTHY');
      expect(snapshot.health.errorRatePercent).toBe(0);

      // c4xx still reports total for backward compatibility
      expect(snapshot.statusCodes.c4xx).toBeGreaterThanOrEqual(snapshot.statusCodes.c4xxNoise);
    });
  });

  describe('R4. Queue & Ancillary Idle Display', () => {
    it('reports IDLE / READY when queues have 0 active jobs', async () => {
      const service = AdminTelemetryService.getInstance();
      const telemetry = await service.getCompleteTelemetry();

      expect(telemetry.queues).toBeDefined();
      expect(telemetry.queues.pdf).toBeDefined();
      expect(telemetry.queues.converter).toBeDefined();
      expect(telemetry.queues.quiz).toBeDefined();

      if (telemetry.queues.pdf.active === 0) {
        expect(telemetry.queues.pdf.status).toBe('IDLE / READY');
      }
      if (telemetry.queues.converter.active === 0) {
        expect(telemetry.queues.converter.status).toBe('IDLE / READY');
      }
      if (telemetry.queues.quiz.active === 0) {
        expect(telemetry.queues.quiz.status).toBe('IDLE / READY');
      }

      // Redis status
      expect(telemetry.storage.redis).toBeDefined();
      expect(['READY', 'OFFLINE']).toContain(telemetry.storage.redis.displayStatus);
    });
  });
});
