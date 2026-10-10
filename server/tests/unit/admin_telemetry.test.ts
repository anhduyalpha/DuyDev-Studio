import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryTracker } from '../../src/api/middleware/telemetry.middleware.js';
import { AiMetricsService } from '../../src/services/ai-metrics.service.js';
import { AdminTelemetryService } from '../../src/services/admin-telemetry.service.js';

describe('Admin Telemetry & AI Metrics Unit Tests', () => {
  describe('1. TelemetryTracker', () => {
    it('should be a singleton instance', () => {
      const tracker1 = TelemetryTracker.getInstance();
      const tracker2 = TelemetryTracker.getInstance();
      expect(tracker1).toBe(tracker2);
    });

    it('should record request telemetry with status codes and bytes', () => {
      const tracker = TelemetryTracker.getInstance();
      const mockReq = {
        headers: { 'content-length': '1024' },
        ip: '127.0.0.1'
      } as any;
      const mockReply = {
        statusCode: 200,
        getHeader: vi.fn().mockReturnValue('2048')
      } as any;

      tracker.recordRequest(mockReq, mockReply, 45);

      const snapshot = tracker.getSnapshot();
      expect(snapshot).toHaveProperty('summary');
      expect(snapshot).toHaveProperty('timeline');
      expect(snapshot).toHaveProperty('statusCodes');
      expect(snapshot.summary.totalRequests).toBeGreaterThanOrEqual(1);
      expect(snapshot.statusCodes.c2xx).toBeGreaterThanOrEqual(1);
    });

    it('should differentiate LAN vs WAN clients', () => {
      const tracker = TelemetryTracker.getInstance();
      const mockLanReq = {
        headers: {},
        ip: '192.168.1.100'
      } as any;
      const mockWanReq = {
        headers: { 'cf-connecting-ip': '103.20.5.1' },
        ip: '103.20.5.1'
      } as any;
      const mockReply = {
        statusCode: 200,
        getHeader: vi.fn().mockReturnValue('100')
      } as any;

      const prevLan = tracker.getSnapshot().summary.lanRequests;
      const prevWan = tracker.getSnapshot().summary.wanRequests;

      tracker.recordRequest(mockLanReq, mockReply, 10);
      tracker.recordRequest(mockWanReq, mockReply, 15);

      const after = tracker.getSnapshot();
      expect(after.summary.lanRequests).toBe(prevLan + 1);
      expect(after.summary.wanRequests).toBe(prevWan + 1);
    });
  });

  describe('2. AiMetricsService', () => {
    it('should correctly mask sensitive API keys', () => {
      const aiService = AiMetricsService.getInstance();
      expect(aiService.maskKey('')).toBe('');
      expect(aiService.maskKey('short')).toBe('****');
      expect(aiService.maskKey('sk-agnes-1234567890abcdef')).toBe('sk-a...cdef');
    });

    it('should record AI calls and calculate rate limits', () => {
      const aiService = AiMetricsService.getInstance();
      const initialMetrics = aiService.getTelemetryData();
      const initialCalls = initialMetrics.cumulative.totalCalls;

      aiService.recordCall({
        module: 'quiz-test',
        provider: 'agnes',
        model: 'agnes-3.0-flash',
        promptTokens: 120,
        completionTokens: 80,
        latencyMs: 320,
        statusCode: 200
      });

      const updated = aiService.getTelemetryData();
      expect(updated.cumulative.totalCalls).toBe(initialCalls + 1);
      expect(updated.rateLimits.liveRpm).toBeGreaterThanOrEqual(1);
      expect(updated.recentLogs.length).toBeGreaterThan(0);
      expect(updated.recentLogs[0].module).toBe('quiz-test');
      expect(updated.recentLogs[0].totalTokens).toBe(200);
    });

    it('should update and register new AI key configurations', () => {
      const aiService = AiMetricsService.getInstance();
      const newKey = aiService.updateKey({
        id: 'test-provider',
        name: 'Test AI Provider',
        baseUrl: 'https://api.test-ai.com/v1',
        model: 'test-model-1',
        apiKey: 'sk-test-secret-123456789',
        isActive: true
      });

      expect(newKey.id).toBe('test-provider');
      expect(newKey.name).toBe('Test AI Provider');

      const telemetry = aiService.getTelemetryData();
      const found = telemetry.keys.find(k => k.id === 'test-provider');
      expect(found).toBeDefined();
      expect(found?.apiKeyMasked).toBe('sk-t...6789');
    });
  });

  describe('3. AdminTelemetryService', () => {
    it('should be a singleton and provide complete telemetry snapshot', async () => {
      const service = AdminTelemetryService.getInstance();
      const data = await service.getCompleteTelemetry();

      expect(data).toHaveProperty('host');
      expect(data).toHaveProperty('storage');
      expect(data).toHaveProperty('queues');
      expect(data).toHaveProperty('cloudflare');
      expect(data).toHaveProperty('ai');
      expect(data).toHaveProperty('traffic');

      expect(data.host).toHaveProperty('memory');
      expect(data.host).toHaveProperty('loadAverage');
      expect(data.host).toHaveProperty('cpuCores');
      expect(data.storage).toHaveProperty('breakdown');
      expect(data.storage.database).toHaveProperty('records');
    });

    it('should execute cleanTempStorage without throwing errors', async () => {
      const service = AdminTelemetryService.getInstance();
      const res = await service.cleanTempStorage();
      expect(res).toHaveProperty('cleanedFiles');
      expect(res).toHaveProperty('freedMb');
      expect(res.cleanedFiles).toBeGreaterThanOrEqual(0);
    });

    it('should execute cleanQueues without throwing errors', async () => {
      const service = AdminTelemetryService.getInstance();
      const res = await service.cleanQueues();
      expect(res).toHaveProperty('cleanedJobs');
      expect(res.cleanedJobs).toBeGreaterThanOrEqual(0);
    });
  });
});
