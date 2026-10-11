/**
 * Telemetry Middleware - Real-Time In-Memory Traffic & HTTP Metrics Tracker
 * Rolling 60-second window with zero external overhead
 */

import { FastifyRequest, FastifyReply } from 'fastify';

interface SecondBucket {
  timestamp: number; // Unix seconds
  requests: number;
  bytesIn: number;
  bytesOut: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  totalLatencyMs: number;
  status4xxNoise: number;
  status4xxValid: number;
}

export interface IpRequestLogItem {
  timestamp: string;
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  contentLengthIn: number;
  contentLengthOut: number;
}

export interface IpClientProfile {
  ip: string;
  isLan: boolean;
  country: string;
  userAgent: string;
  deviceSummary: string;
  totalRequests: number;
  bytesIn: number;
  bytesOut: number;
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  firstSeenAt: string;
  lastActiveAt: string;
  recentLogs: IpRequestLogItem[];
}

export function parseDeviceSummary(ua: string): string {
  if (!ua || ua === 'Unknown') return 'Unknown Device';
  let os = 'Unknown OS';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/curl|python|wget|postman/i.test(ua)) browser = 'CLI/Bot';

  return `${os} · ${browser}`;
}

/**
 * Distinguishes automated web bot scanning probes (such as .env, wp-login, phpmyadmin, or 403 blocked probes)
 * from genuine application user requests.
 */
export function isBotScannerNoise(url: string, statusCode: number): boolean {
  if (statusCode !== 404 && statusCode !== 403 && statusCode !== 400) {
    return false;
  }
  // All 403 Forbidden responses (IP block rules, blocked crawlers) are noise isolation candidates
  if (statusCode === 403) {
    return true;
  }

  const clean = (url || '').toLowerCase().split('?')[0];

  const scannerPatterns = [
    '.env',
    'wp-login',
    'wp-admin',
    'wp-content',
    'wp-includes',
    'phpmyadmin',
    'pma',
    'mysql',
    '.git',
    '.svn',
    '.hg',
    'xmlrpc.php',
    'actuator',
    'swagger',
    'api-docs',
    'boaform',
    'shell',
    'setup.cgi',
    '.aws',
    '.ssh',
    'config.json',
    'eval-stdin',
    'solr',
    'telescope',
    'phpunit',
    'vendor',
    'cgi-bin',
    'autodiscover',
    'webdav',
    'hnap1',
    'wlwmanifest',
    'geoserver',
    'jenkins',
    'remote/login'
  ];
  if (scannerPatterns.some(pat => clean.includes(pat))) {
    return true;
  }

  // Detect probes targeting server-side script files or database/backup dumps
  if (/\.(php|asp|aspx|jsp|cgi|pl|sh|action|do|bak|old|sql|zip|tar|gz|rar|7z|ini|conf|yml|yaml)$/i.test(clean)) {
    return true;
  }

  // For 404 on routes completely outside DD Studio's SPA frontend & API routes:
  // Legitimate routes are under /api/, /src/, /static/, /pdfjs/, /q/, /share-target, or standard root assets.
  const isAppRoute = clean.startsWith('/api/') ||
    clean.startsWith('/src/') ||
    clean.startsWith('/static/') ||
    clean.startsWith('/pdfjs/') ||
    clean.startsWith('/q/') ||
    clean.startsWith('/share-target') ||
    clean.startsWith('/webhook/') ||
    clean.startsWith('/webhooks/') ||
    clean === '/' ||
    clean === '/index.html' ||
    clean === '/sw.js' ||
    clean === '/manifest.webmanifest' ||
    clean === '/favicon.ico' ||
    clean === '/robots.txt' ||
    clean === '/sitemap.xml' ||
    clean === '/apple-touch-icon.png';

  if (!isAppRoute) {
    return true;
  }

  return false;
}

export class TelemetryTracker {
  private static instance: TelemetryTracker;
  private readonly WINDOW_SECONDS = 60;
  private buckets: Map<number, SecondBucket> = new Map();

  // In-memory registry of active client IPs (up to 300 recent IPs)
  private ipClientRegistry: Map<string, IpClientProfile> = new Map();
  private readonly MAX_CLIENT_IPS = 300;
  private readonly MAX_LOGS_PER_IP = 30;

  // Cumulative totals
  private totalRequests = 0;
  private totalBytesIn = 0;
  private totalBytesOut = 0;
  private lanRequests = 0;
  private wanRequests = 0;

  private constructor() {
    // Periodic cleanup of stale buckets older than 70s
    setInterval(() => {
      const cutoff = Math.floor(Date.now() / 1000) - this.WINDOW_SECONDS - 10;
      for (const sec of this.buckets.keys()) {
        if (sec < cutoff) {
          this.buckets.delete(sec);
        }
      }
    }, 10_000).unref();
  }

  public static getInstance(): TelemetryTracker {
    if (!TelemetryTracker.instance) {
      TelemetryTracker.instance = new TelemetryTracker();
    }
    return TelemetryTracker.instance;
  }

  public recordRequest(req: FastifyRequest, reply: FastifyReply, latencyMs: number) {
    const nowSec = Math.floor(Date.now() / 1000);
    this.totalRequests++;

    const contentLengthIn = parseInt(String(req.headers['content-length'] || '0'), 10) || 0;
    const contentLengthOut = parseInt(String(reply.getHeader('content-length') || '0'), 10) || 0;

    this.totalBytesIn += contentLengthIn;
    this.totalBytesOut += contentLengthOut;

    // Detect LAN vs WAN
    const cfIp = req.headers['cf-connecting-ip'] as string;
    const clientIp = req.ip || '';
    const isLan = !cfIp && (
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('172.16.')
    );

    if (isLan) {
      this.lanRequests++;
    } else {
      this.wanRequests++;
    }

    const statusCode = reply.statusCode;
    const route = req.raw?.url || req.url || '/';
    const isNoise = isBotScannerNoise(route, statusCode);

    let bucket = this.buckets.get(nowSec);
    if (!bucket) {
      bucket = {
        timestamp: nowSec,
        requests: 0,
        bytesIn: 0,
        bytesOut: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        totalLatencyMs: 0,
        status4xxNoise: 0,
        status4xxValid: 0
      };
      this.buckets.set(nowSec, bucket);
    }

    bucket.requests++;
    bucket.bytesIn += contentLengthIn;
    bucket.bytesOut += contentLengthOut;
    bucket.totalLatencyMs += latencyMs;

    if (statusCode >= 200 && statusCode < 300) bucket.status2xx++;
    else if (statusCode >= 300 && statusCode < 400) bucket.status3xx++;
    else if (statusCode >= 400 && statusCode < 500) {
      bucket.status4xx++;
      if (isNoise) {
        bucket.status4xxNoise++;
      } else {
        bucket.status4xxValid++;
      }
    }
    else if (statusCode >= 500) bucket.status5xx++;

    // Record per-IP tracking
    const rawIp = cfIp ||
      ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) ||
      clientIp ||
      '127.0.0.1';
    const cleanIp = rawIp.replace(/^::ffff:/, '');
    const countryHeader = req.headers['cf-ipcountry'] as string;
    const country = countryHeader || (isLan ? 'LAN' : 'VN');
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown';
    const method = req.method || 'GET';
    const nowIso = new Date().toISOString();

    let profile = this.ipClientRegistry.get(cleanIp);
    if (!profile) {
      if (this.ipClientRegistry.size >= this.MAX_CLIENT_IPS) {
        let oldestIp: string | null = null;
        let oldestTime = Infinity;
        for (const [key, p] of this.ipClientRegistry.entries()) {
          const t = new Date(p.lastActiveAt).getTime();
          if (t < oldestTime) {
            oldestTime = t;
            oldestIp = key;
          }
        }
        if (oldestIp) this.ipClientRegistry.delete(oldestIp);
      }

      profile = {
        ip: cleanIp,
        isLan,
        country,
        userAgent,
        deviceSummary: parseDeviceSummary(userAgent),
        totalRequests: 0,
        bytesIn: 0,
        bytesOut: 0,
        status2xx: 0,
        status3xx: 0,
        status4xx: 0,
        status5xx: 0,
        firstSeenAt: nowIso,
        lastActiveAt: nowIso,
        recentLogs: []
      };
      this.ipClientRegistry.set(cleanIp, profile);
    }

    profile.totalRequests++;
    profile.bytesIn += contentLengthIn;
    profile.bytesOut += contentLengthOut;
    profile.lastActiveAt = nowIso;
    if (countryHeader && profile.country !== countryHeader) {
      profile.country = countryHeader;
    }
    if (userAgent !== 'Unknown') {
      profile.userAgent = userAgent;
      profile.deviceSummary = parseDeviceSummary(userAgent);
    }

    if (statusCode >= 200 && statusCode < 300) profile.status2xx++;
    else if (statusCode >= 300 && statusCode < 400) profile.status3xx++;
    else if (statusCode >= 400 && statusCode < 500) profile.status4xx++;
    else if (statusCode >= 500) profile.status5xx++;

    profile.recentLogs.unshift({
      timestamp: nowIso,
      method,
      route,
      statusCode,
      latencyMs,
      contentLengthIn,
      contentLengthOut
    });

    if (profile.recentLogs.length > this.MAX_LOGS_PER_IP) {
      profile.recentLogs = profile.recentLogs.slice(0, this.MAX_LOGS_PER_IP);
    }
  }

  public getSnapshot() {
    const currentSec = Math.floor(Date.now() / 1000);
    const timeline: Array<{
      time: number;
      rps: number;
      kbIn: number;
      kbOut: number;
      avgLatencyMs: number;
      status2xx: number;
      status3xx: number;
      status4xx: number;
      status5xx: number;
    }> = [];

    let sumRequestsLast60 = 0;
    let sumBytesInLast60 = 0;
    let sumBytesOutLast60 = 0;
    let sumLatencyLast60 = 0;
    let status2xxLast60 = 0;
    let status3xxLast60 = 0;
    let status4xxLast60 = 0;
    let status5xxLast60 = 0;

    let status4xxNoiseLast60 = 0;
    let status4xxValidLast60 = 0;

    // Build timeline for the last 60 seconds (oldest to newest)
    for (let i = this.WINDOW_SECONDS - 1; i >= 0; i--) {
      const sec = currentSec - i;
      const bucket = this.buckets.get(sec);
      if (bucket) {
        sumRequestsLast60 += bucket.requests;
        sumBytesInLast60 += bucket.bytesIn;
        sumBytesOutLast60 += bucket.bytesOut;
        sumLatencyLast60 += bucket.totalLatencyMs;
        status2xxLast60 += bucket.status2xx;
        status3xxLast60 += bucket.status3xx;
        status4xxLast60 += bucket.status4xx;
        status5xxLast60 += bucket.status5xx;
        status4xxNoiseLast60 += bucket.status4xxNoise || 0;
        status4xxValidLast60 += bucket.status4xxValid || 0;

        const avgLat = bucket.requests > 0 ? Math.round(bucket.totalLatencyMs / bucket.requests) : 0;
        timeline.push({
          time: sec,
          rps: bucket.requests,
          kbIn: Math.round((bucket.bytesIn / 1024) * 10) / 10,
          kbOut: Math.round((bucket.bytesOut / 1024) * 10) / 10,
          avgLatencyMs: avgLat,
          status2xx: bucket.status2xx,
          status3xx: bucket.status3xx,
          status4xx: bucket.status4xx,
          status5xx: bucket.status5xx
        });
      } else {
        timeline.push({
          time: sec,
          rps: 0,
          kbIn: 0,
          kbOut: 0,
          avgLatencyMs: 0,
          status2xx: 0,
          status3xx: 0,
          status4xx: 0,
          status5xx: 0
        });
      }
    }

    // Instant RPS (last 5 seconds average)
    const last5SecRequests = timeline.slice(-5).reduce((acc, t) => acc + t.rps, 0);
    const liveRps = Math.round((last5SecRequests / 5) * 10) / 10;

    // Instant Bandwidth in/out (KB/s)
    const last5SecBytesIn = timeline.slice(-5).reduce((acc, t) => acc + t.kbIn, 0);
    const last5SecBytesOut = timeline.slice(-5).reduce((acc, t) => acc + t.kbOut, 0);
    const liveKbInPerSec = Math.round((last5SecBytesIn / 5) * 10) / 10;
    const liveKbOutPerSec = Math.round((last5SecBytesOut / 5) * 10) / 10;

    const avgLatency = sumRequestsLast60 > 0 ? Math.round(sumLatencyLast60 / sumRequestsLast60) : 0;

    // System Health & Error Rate isolates bot scanner noise (genuine requests only)
    const validRequestsLast60 = Math.max(0, sumRequestsLast60 - status4xxNoiseLast60);
    const errorRatePercent = validRequestsLast60 > 0
      ? Math.round((status5xxLast60 / validRequestsLast60) * 1000) / 10
      : 0;

    const systemHealth = status5xxLast60 === 0
      ? 'HEALTHY'
      : status5xxLast60 < 5
      ? 'DEGRADED'
      : 'UNHEALTHY';

    return {
      live: {
        rps: liveRps,
        kbInPerSec: liveKbInPerSec,
        kbOutPerSec: liveKbOutPerSec,
        avgLatencyMs: avgLatency
      },
      summary: {
        liveRps,
        kbInPerSec: liveKbInPerSec,
        kbOutPerSec: liveKbOutPerSec,
        avgLatencyMs: avgLatency,
        totalRequests: this.totalRequests,
        totalBytesIn: this.totalBytesIn,
        totalBytesOut: this.totalBytesOut,
        lanRequests: this.lanRequests,
        wanRequests: this.wanRequests,
        errorRatePercent,
        systemHealth,
        scannerNoiseIsolated: status4xxNoiseLast60,
        validRequests: validRequestsLast60
      },
      statusCodes: {
        c2xx: status2xxLast60,
        c3xx: status3xxLast60,
        c4xx: status4xxLast60,
        c4xxValid: status4xxValidLast60,
        c4xxNoise: status4xxNoiseLast60,
        c5xx: status5xxLast60
      },
      health: {
        systemHealth,
        errorRatePercent,
        scannerNoiseIsolated: status4xxNoiseLast60,
        validRequests: validRequestsLast60
      },
      last60s: {
        totalRequests: sumRequestsLast60,
        validRequests: validRequestsLast60,
        scannerNoiseIsolated: status4xxNoiseLast60,
        mbIn: Math.round((sumBytesInLast60 / (1024 * 1024)) * 100) / 100,
        mbOut: Math.round((sumBytesOutLast60 / (1024 * 1024)) * 100) / 100,
        status: {
          '2xx': status2xxLast60,
          '3xx': status3xxLast60,
          '4xx': status4xxLast60,
          '5xx': status5xxLast60
        }
      },
      cumulative: {
        totalRequests: this.totalRequests,
        totalMbIn: Math.round((this.totalBytesIn / (1024 * 1024)) * 100) / 100,
        totalMbOut: Math.round((this.totalBytesOut / (1024 * 1024)) * 100) / 100,
        lanRequests: this.lanRequests,
        wanRequests: this.wanRequests
      },
      timeline
    };
  }

  /**
   * Retrieves list of recently active client IPs and their aggregate metrics
   */
  public getIpClientsList(): Array<Omit<IpClientProfile, 'recentLogs'> & { recentLogsCount: number }> {
    const list = Array.from(this.ipClientRegistry.values()).map(p => ({
      ip: p.ip,
      isLan: p.isLan,
      country: p.country,
      userAgent: p.userAgent,
      deviceSummary: p.deviceSummary,
      totalRequests: p.totalRequests,
      bytesIn: p.bytesIn,
      bytesOut: p.bytesOut,
      status2xx: p.status2xx,
      status3xx: p.status3xx,
      status4xx: p.status4xx,
      status5xx: p.status5xx,
      firstSeenAt: p.firstSeenAt,
      lastActiveAt: p.lastActiveAt,
      recentLogsCount: p.recentLogs.length
    }));

    return list.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }

  /**
   * Retrieves detailed request stream logs for a specific client IP
   */
  public getIpRequestLogs(ip: string): { profile: Omit<IpClientProfile, 'recentLogs'> | null; logs: IpRequestLogItem[] } {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    const profile = this.ipClientRegistry.get(cleanIp);
    if (!profile) {
      return { profile: null, logs: [] };
    }
    const { recentLogs, ...meta } = profile;
    return {
      profile: meta,
      logs: recentLogs
    };
  }

  /**
   * Resets rolling buckets and counters (for testing and administrative resets)
   */
  public resetBuckets() {
    this.buckets.clear();
    this.totalRequests = 0;
    this.totalBytesIn = 0;
    this.totalBytesOut = 0;
    this.lanRequests = 0;
    this.wanRequests = 0;
  }

  /**
   * Resets and clears the in-memory profile and logs for a specific client IP
   */
  public resetClientIp(ip: string): boolean {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    return this.ipClientRegistry.delete(cleanIp);
  }

  /**
   * Clears the in-memory client IP registry
   */
  public clearIpRegistry(): { clearedCount: number } {
    const count = this.ipClientRegistry.size;
    this.ipClientRegistry.clear();
    return { clearedCount: count };
  }
}

export const telemetryTracker = TelemetryTracker.getInstance();

export function getIpClientsList() {
  return telemetryTracker.getIpClientsList();
}

export function getIpRequestLogs(ip: string) {
  return telemetryTracker.getIpRequestLogs(ip);
}

export function clearIpRegistry() {
  return telemetryTracker.clearIpRegistry();
}

export function resetClientIp(ip: string) {
  return telemetryTracker.resetClientIp(ip);
}
