import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TelemetryTracker,
  getIpClientsList,
  getIpRequestLogs,
  clearIpRegistry
} from '../../src/api/middleware/telemetry.middleware.js';

describe('Admin User & IP Traffic Telemetry Unit Tests', () => {
  beforeEach(() => {
    clearIpRegistry();
  });

  it('should track client profile with IP, device summary and CF country tag', () => {
    const tracker = TelemetryTracker.getInstance();

    const mockReq = {
      headers: {
        'cf-connecting-ip': '113.161.45.10',
        'cf-ipcountry': 'VN',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'content-length': '512'
      },
      url: '/api/v1/files/upload',
      method: 'POST',
      ip: '113.161.45.10'
    } as any;

    const mockReply = {
      statusCode: 200,
      getHeader: vi.fn().mockReturnValue('1024')
    } as any;

    tracker.recordRequest(mockReq, mockReply, 150);

    const clients = getIpClientsList();
    expect(clients.length).toBe(1);

    const client = clients[0];
    expect(client.ip).toBe('113.161.45.10');
    expect(client.isLan).toBe(false);
    expect(client.country).toBe('VN');
    expect(client.deviceSummary).toContain('Windows');
    expect(client.deviceSummary).toContain('Chrome');
    expect(client.totalRequests).toBe(1);
    expect(client.status2xx).toBe(1);
    expect(client.bytesIn).toBe(512);
    expect(client.bytesOut).toBe(1024);
  });

  it('should identify LAN client without Cloudflare headers', () => {
    const tracker = TelemetryTracker.getInstance();

    const mockReq = {
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
      },
      url: '/api/v1/health',
      method: 'GET',
      ip: '192.168.2.55'
    } as any;

    const mockReply = {
      statusCode: 200,
      getHeader: vi.fn().mockReturnValue('64')
    } as any;

    tracker.recordRequest(mockReq, mockReply, 12);

    const clients = getIpClientsList();
    expect(clients.length).toBe(1);
    expect(clients[0].ip).toBe('192.168.2.55');
    expect(clients[0].isLan).toBe(true);
    expect(clients[0].country).toBe('LAN');
    expect(clients[0].deviceSummary).toContain('iOS');
  });

  it('should maintain per-IP request log ring buffer capped at 30 items', () => {
    const tracker = TelemetryTracker.getInstance();
    const testIp = '14.161.20.5';

    for (let i = 1; i <= 35; i++) {
      const mockReq = {
        headers: { 'cf-connecting-ip': testIp },
        url: `/api/v1/test-route-${i}`,
        method: i % 2 === 0 ? 'POST' : 'GET',
        ip: testIp
      } as any;

      const mockReply = {
        statusCode: i === 30 ? 500 : 200,
        getHeader: vi.fn().mockReturnValue('100')
      } as any;

      tracker.recordRequest(mockReq, mockReply, i * 5);
    }

    const { logs, profile } = getIpRequestLogs(testIp);
    // Ring buffer max 30
    expect(logs.length).toBe(30);

    // Latest request should be first (sorted descending)
    expect(logs[0].route).toBe('/api/v1/test-route-35');
    // Oldest should be route-6 (1-5 were evicted)
    expect(logs[29].route).toBe('/api/v1/test-route-6');

    // Status code count verification on client profile
    expect(profile).toBeDefined();
    expect(profile!.totalRequests).toBe(35);
    expect(profile!.status5xx).toBe(1);
    expect(profile!.status2xx).toBe(34);
  });

  it('should return empty logs for unknown IP', () => {
    const { logs, profile } = getIpRequestLogs('99.99.99.99');
    expect(logs).toEqual([]);
    expect(profile).toBeNull();
  });

  it('should support search and sorting in getIpClientsList', () => {
    const tracker = TelemetryTracker.getInstance();

    const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3'];
    ips.forEach((ip) => {
      const mockReq = {
        headers: {},
        url: '/ping',
        method: 'GET',
        ip
      } as any;
      const mockReply = {
        statusCode: 200,
        getHeader: vi.fn().mockReturnValue('10')
      } as any;

      tracker.recordRequest(mockReq, mockReply, 5);
    });

    const clients = getIpClientsList();
    expect(clients.length).toBe(3);
    expect(clients.map(c => c.ip)).toContain('192.168.1.1');
    expect(clients.map(c => c.ip)).toContain('192.168.1.2');
    expect(clients.map(c => c.ip)).toContain('192.168.1.3');
  });
});
