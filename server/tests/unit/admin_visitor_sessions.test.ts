import { describe, it, expect, beforeEach } from 'vitest';
import { VisitorSessionManager, extractClientIp } from '../../src/api/middleware/telemetry.middleware.js';
import { AdminTelemetryService } from '../../src/services/admin-telemetry.service.js';

describe('VisitorSessionManager & Telemetry', () => {
  beforeEach(() => {
    // Reset sessions and events before each test
    VisitorSessionManager.clearSessions();
    VisitorSessionManager.clearEvents();
  });

  it('extractClientIp should prioritize Cloudflare headers and correctly tag LAN vs WAN', () => {
    const mockReqCf = {
      headers: {
        'cf-connecting-ip': '113.161.72.15',
        'x-forwarded-for': '127.0.0.1'
      },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' }
    } as any;
    const cfIp = extractClientIp(mockReqCf);
    expect(cfIp.ip).toBe('113.161.72.15');
    expect(cfIp.isLan).toBe(false);

    const mockReqLan = {
      headers: {},
      ip: '192.168.2.55',
      socket: { remoteAddress: '192.168.2.55' }
    } as any;
    const lanIp = extractClientIp(mockReqLan);
    expect(lanIp.ip).toBe('192.168.2.55');
    expect(lanIp.isLan).toBe(true);
  });

  it('should register visitor entry, track session as ONLINE, and log ENTER event', () => {
    const session = VisitorSessionManager.registerEnter({
      sessionId: 'sess_test_1',
      visitorId: 'vis_test_1',
      ip: '192.168.2.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
      entryRoute: '#dashboard',
      screenResolution: '1920x1080',
      pwaMode: false,
      country: 'LAN',
      deviceSummary: 'Windows / Chrome'
    });

    expect(session.sessionId).toBe('sess_test_1');
    expect(session.status).toBe('ONLINE');
    expect(session.entryRoute).toBe('#dashboard');
    expect(session.currentRoute).toBe('#dashboard');
    expect(session.isLan).toBe(true);

    const activeSessions = VisitorSessionManager.getAllSessions();
    expect(activeSessions.length).toBe(1);

    const events = VisitorSessionManager.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('ENTER');
    expect(events[0].ip).toBe('192.168.2.100');
  });

  it('should register route changes via heartbeat and log ROUTE_CHANGE event', () => {
    VisitorSessionManager.registerEnter({
      sessionId: 'sess_test_2',
      visitorId: 'vis_test_2',
      ip: '113.161.72.20',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
      entryRoute: '#dashboard',
      country: 'VN',
      deviceSummary: 'iPhone / Safari'
    });

    const updated = VisitorSessionManager.registerHeartbeat({
      sessionId: 'sess_test_2',
      currentRoute: '#tool/pdf',
      activeDurationSec: 25
    });

    expect(updated).not.toBeNull();
    expect(updated?.currentRoute).toBe('#tool/pdf');
    expect(updated?.routeHistory.length).toBe(2);
    expect(updated?.routeHistory[1].route).toBe('#tool/pdf');

    const events = VisitorSessionManager.getEvents();
    const routeEvent = events.find(e => e.eventType === 'ROUTE_CHANGE');
    expect(routeEvent).toBeDefined();
    expect(routeEvent?.description).toContain('#tool/pdf');
  });

  it('should register session leave on page exit and mark status as LEFT', () => {
    VisitorSessionManager.registerEnter({
      sessionId: 'sess_test_3',
      visitorId: 'vis_test_3',
      ip: '42.112.30.10',
      userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/122.0.0.0',
      entryRoute: '#dashboard',
      country: 'VN',
      deviceSummary: 'Android / Chrome'
    });

    const leftSession = VisitorSessionManager.registerLeave({
      sessionId: 'sess_test_3',
      reason: 'page_exit',
      lastRoute: '#dashboard'
    });

    expect(leftSession).not.toBeNull();
    expect(leftSession?.status).toBe('LEFT');
    expect(leftSession?.leftAt).toBeDefined();

    const stats = VisitorSessionManager.getSessionStats();
    expect(stats.leftCount).toBe(1);
    expect(stats.onlineCount).toBe(0);

    const events = VisitorSessionManager.getEvents();
    const leaveEvent = events.find(e => e.eventType === 'LEAVE');
    expect(leaveEvent).toBeDefined();
  });

  it('should update session stats accurately', () => {
    VisitorSessionManager.registerEnter({
      sessionId: 's1',
      visitorId: 'v1',
      ip: '192.168.2.10',
      userAgent: 'Chrome',
      entryRoute: '#dashboard'
    });
    VisitorSessionManager.registerEnter({
      sessionId: 's2',
      visitorId: 'v2',
      ip: '192.168.2.11',
      userAgent: 'Safari',
      entryRoute: '#storage'
    });

    VisitorSessionManager.registerLeave({
      sessionId: 's2',
      reason: 'tab_closed'
    });

    const stats = VisitorSessionManager.getSessionStats();
    expect(stats.totalTracked).toBe(2);
    expect(stats.onlineCount).toBe(1);
    expect(stats.leftCount).toBe(1);
  });
});

describe('AdminTelemetryService Multi-Format Export', () => {
  it('exportErrorLogsAsJson should return valid JSON object and headers', async () => {
    const service = AdminTelemetryService.getInstance();
    const result = await service.exportErrorLogsAsJson();

    expect(result).toBeDefined();
    expect(result.fileName).toMatch(/\.json$/);
    expect(typeof result.json).toBe('object');
    expect(result.json.metadata).toBeDefined();
    expect(Array.isArray(result.json.groups)).toBe(true);
    expect(Array.isArray(result.json.rawJobs)).toBe(true);
  });

  it('exportErrorLogsAsMarkdown should return structured Markdown document', async () => {
    const service = AdminTelemetryService.getInstance();
    const result = await service.exportErrorLogsAsMarkdown();

    expect(result).toBeDefined();
    expect(result.fileName).toMatch(/\.md$/);
    expect(typeof result.markdown).toBe('string');
    expect(result.markdown).toContain('DUYDEV STUDIO');
  });
});
