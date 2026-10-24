/**
 * Telemetry Middleware - Real-Time In-Memory Traffic & HTTP Metrics Tracker
 * Rolling 60-second window with zero external overhead
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { deviceRegistryService, StoredDeviceInfo } from '../../services/device-registry.service.js';

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

export interface VisitorSession {
  sessionId: string;
  visitorId?: string;
  deviceId?: string;
  alias?: string;
  isOwner?: boolean;
  ip: string;
  isLan: boolean;
  country: string;
  userAgent: string;
  deviceSummary: string;
  status: 'ONLINE' | 'IDLE' | 'LEFT';
  enteredAt: string;
  lastActiveAt: string;
  leftAt?: string;
  durationSec: number;
  entryRoute: string;
  currentRoute: string;
  routeHistory: Array<{ route: string; timestamp: string }>;
  totalHeartbeats: number;
  pwaMode: boolean;
  screenResolution?: string;
}

export interface DeviceSubItem {
  deviceId: string;
  deviceSummary: string;
  userAgent: string;
  ip: string;
  lastSeenAt: string;
  firstSeenAt: string;
  status: 'ONLINE' | 'IDLE' | 'LEFT';
  isOnline: boolean;
  pwaMode: boolean;
}

export interface AggregatedDeviceSession {
  deviceId: string;
  userId?: string;
  alias?: string;
  avatar?: string;
  isOwner: boolean;
  isBlocked: boolean;
  status: 'ONLINE' | 'IDLE' | 'LEFT';
  ip: string;
  lastIp: string;
  ipHistory: string[];
  isLan: boolean;
  country: string;
  userAgent: string;
  deviceSummary: string;
  pwaMode: boolean;
  screenResolution?: string;
  currentRoute: string;
  latestSessionEnteredAt: string;
  latestSessionLeftAt?: string;
  latestSessionLastActiveAt: string;
  latestSessionDurationSec: number;
  latestSessionRouteHistory: Array<{ route: string; timestamp: string }>;
  totalSessionsCount: number;
  totalAccumulatedDurationSec: number;
  devicesCount?: number;
  devices?: DeviceSubItem[];
  pastSessions: Array<{
    sessionId: string;
    enteredAt: string;
    leftAt?: string;
    durationSec: number;
    entryRoute: string;
    currentRoute: string;
    ip: string;
    isLan: boolean;
  }>;
}

export interface SessionLifecycleEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  ip: string;
  isLan: boolean;
  country: string;
  eventType: 'ENTER' | 'ROUTE_CHANGE' | 'HEARTBEAT' | 'LEAVE' | 'TIMEOUT';
  route: string;
  durationSec?: number;
  deviceSummary: string;
  description: string;
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

export function extractClientIp(req: FastifyRequest): { ip: string; isLan: boolean } {
  const cfIp = req.headers['cf-connecting-ip'] as string;
  const trueClientIp = req.headers['true-client-ip'] as string;
  const xRealIp = req.headers['x-real-ip'] as string;
  const xForwardedFor = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();
  const directIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';

  const rawIp = cfIp || trueClientIp || xRealIp || xForwardedFor || directIp;
  const ip = (rawIp || '127.0.0.1').replace(/^::ffff:/, '').trim() || '127.0.0.1';

  const isLan =
    !cfIp &&
    !trueClientIp &&
    (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.20.') ||
      ip.startsWith('172.21.') ||
      ip.startsWith('172.22.') ||
      ip.startsWith('172.23.') ||
      ip.startsWith('172.24.') ||
      ip.startsWith('172.25.') ||
      ip.startsWith('172.26.') ||
      ip.startsWith('172.27.') ||
      ip.startsWith('172.28.') ||
      ip.startsWith('172.29.') ||
      ip.startsWith('172.30.') ||
      ip.startsWith('172.31.')
    );

  return { ip, isLan };
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

    // Detect LAN vs WAN and extract robust client IP
    const { ip: cleanIp, isLan } = extractClientIp(req);

    if (isLan) {
      this.lanRequests++;
    } else {
      this.wanRequests++;
    }

    const statusCode = reply.statusCode;
    const route = req.raw?.url || req.url || '/';
    const isNoise = isBotScannerNoise(route, statusCode);

    // Touch active visitor session if session ID is provided
    const sessionId = (req.headers['x-session-id'] as string) || (req.headers['x-ds-session-id'] as string);
    if (sessionId) {
      visitorSessionManager.touchFromRequest(sessionId, req.headers['x-client-route'] as string);
    }

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

/**
 * Visitor Session Manager - Tracks Full Visitor Lifecycle ("Vào web ra web cũng log được")
 * Records Session Entry, Active Navigation & Heartbeats, and Session Exits (pagehide/beforeunload)
 */
export class VisitorSessionManager {
  private static instance: VisitorSessionManager;
  private sessions: Map<string, VisitorSession> = new Map();
  private lifecycleEvents: SessionLifecycleEvent[] = [];
  private readonly MAX_SESSIONS = 500;
  private readonly MAX_EVENTS = 250;

  private constructor() {
    // Watchdog timer: checks every 15s for idle / timed-out sessions
    setInterval(() => {
      this.checkSessionTimeouts();
    }, 15_000).unref();
  }

  public static getInstance(): VisitorSessionManager {
    if (!VisitorSessionManager.instance) {
      VisitorSessionManager.instance = new VisitorSessionManager();
    }
    return VisitorSessionManager.instance;
  }

  public registerEnter(params: {
    sessionId: string;
    visitorId?: string;
    deviceId?: string;
    isAdmin?: boolean;
    ip: string;
    isLan: boolean;
    country: string;
    userAgent: string;
    route?: string;
    pwaMode?: boolean;
    screen?: string;
  }): VisitorSession {
    const nowIso = new Date().toISOString();
    const route = params.route || '#dashboard';
    const deviceSummary = parseDeviceSummary(params.userAgent);
    const deviceId = params.deviceId || params.visitorId || `dev_ip_${params.ip.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Update / register device in persistent DeviceRegistryService
    const storedDevice = deviceRegistryService.upsertDevice({
      deviceId,
      ip: params.ip,
      userAgent: params.userAgent,
      deviceSummary,
      country: params.country,
      isLan: params.isLan,
      isAdmin: params.isAdmin
    });

    const isOwner = Boolean(storedDevice.isOwner || params.isLan || params.isAdmin);
    const alias = storedDevice.alias;

    // 5-Minute (300 seconds) Session Resume Window:
    // If the same deviceId reconnects within 5 minutes of leaving (or tab refresh/switch),
    // merge the activity into the existing session instead of creating fragmented rows.
    const RESUME_WINDOW_MS = 5 * 60 * 1000;
    let session = this.sessions.get(params.sessionId);

    if (!session && deviceId) {
      for (const s of this.sessions.values()) {
        if (s.deviceId === deviceId) {
          const lastActiveMs = new Date(s.lastActiveAt).getTime();
          if (Date.now() - lastActiveMs < RESUME_WINDOW_MS) {
            session = s;
            break;
          }
        }
      }
    }

    if (!session) {
      if (this.sessions.size >= this.MAX_SESSIONS) {
        // Evict oldest LEFT or inactive session
        let oldestKey: string | null = null;
        let oldestTime = Infinity;
        for (const [key, s] of this.sessions.entries()) {
          const t = new Date(s.lastActiveAt).getTime();
          if (s.status === 'LEFT') {
            oldestKey = key;
            break;
          }
          if (t < oldestTime) {
            oldestTime = t;
            oldestKey = key;
          }
        }
        if (oldestKey) this.sessions.delete(oldestKey);
      }

      session = {
        sessionId: params.sessionId,
        visitorId: params.visitorId,
        deviceId,
        alias,
        isOwner,
        ip: params.ip,
        isLan: params.isLan,
        country: params.country,
        userAgent: params.userAgent,
        deviceSummary,
        status: 'ONLINE',
        enteredAt: nowIso,
        lastActiveAt: nowIso,
        durationSec: 0,
        entryRoute: route,
        currentRoute: route,
        routeHistory: [{ route, timestamp: nowIso }],
        totalHeartbeats: 1,
        pwaMode: Boolean(params.pwaMode),
        screenResolution: params.screen || 'Unknown'
      };
      this.sessions.set(session.sessionId, session);

      this.addEvent({
        sessionId: session.sessionId,
        ip: params.ip,
        isLan: params.isLan,
        country: params.country,
        eventType: 'ENTER',
        route,
        durationSec: 0,
        deviceSummary,
        description: `Truy cập website (${route})`
      });
    } else {
      // Re-entered / resumed session within 5-minute window!
      session.status = 'ONLINE';
      session.lastActiveAt = nowIso;
      session.leftAt = undefined;
      session.currentRoute = route;
      session.ip = params.ip;
      session.isLan = params.isLan;
      session.isOwner = isOwner;
      session.deviceId = deviceId;
      if (alias) session.alias = alias;
      if (params.pwaMode !== undefined) session.pwaMode = Boolean(params.pwaMode);
      if (params.screen) session.screenResolution = params.screen;

      // Consecutive Route Deduplication:
      const lastRouteItem = session.routeHistory[session.routeHistory.length - 1];
      if (!lastRouteItem || lastRouteItem.route !== route) {
        session.routeHistory.push({ route, timestamp: nowIso });
        if (session.routeHistory.length > 50) {
          session.routeHistory = session.routeHistory.slice(-50);
        }
      }

      this.addEvent({
        sessionId: session.sessionId,
        ip: params.ip,
        isLan: params.isLan,
        country: params.country,
        eventType: 'ENTER',
        route,
        durationSec: session.durationSec,
        deviceSummary,
        description: `Tiếp tục phiên làm việc (${route})`
      });
    }

    return session;
  }

  public registerHeartbeat(params: {
    sessionId: string;
    route?: string;
    ip?: string;
    deviceId?: string;
    isAdmin?: boolean;
    activeDurationSec?: number;
  }): VisitorSession | null {
    const nowIso = new Date().toISOString();
    let session = this.sessions.get(params.sessionId);

    // Fallback: look up by deviceId if session not found by sessionId
    if (!session && params.deviceId) {
      for (const s of this.sessions.values()) {
        if (s.deviceId === params.deviceId) {
          session = s;
          break;
        }
      }
    }

    if (!session) {
      return null;
    }

    const previousRoute = session.currentRoute;
    const newRoute = params.route || session.currentRoute;
    const duration = params.activeDurationSec != null
      ? params.activeDurationSec
      : Math.max(0, Math.floor((Date.now() - new Date(session.enteredAt).getTime()) / 1000));

    session.lastActiveAt = nowIso;
    session.durationSec = duration;
    session.totalHeartbeats++;

    if (session.status !== 'ONLINE') {
      session.status = 'ONLINE';
    }

    if (session.deviceId) {
      const dev = deviceRegistryService.getDevice(session.deviceId);
      if (dev?.alias) session.alias = dev.alias;
      if (dev?.isOwner) session.isOwner = true;
    }

    if (newRoute && newRoute !== previousRoute) {
      session.currentRoute = newRoute;
      const lastRouteItem = session.routeHistory[session.routeHistory.length - 1];
      if (!lastRouteItem || lastRouteItem.route !== newRoute) {
        session.routeHistory.push({ route: newRoute, timestamp: nowIso });
        if (session.routeHistory.length > 50) {
          session.routeHistory = session.routeHistory.slice(-50);
        }
      }

      this.addEvent({
        sessionId: session.sessionId,
        ip: session.ip,
        isLan: session.isLan,
        country: session.country,
        eventType: 'ROUTE_CHANGE',
        route: newRoute,
        durationSec: duration,
        deviceSummary: session.deviceSummary,
        description: `Chuyển sang ${newRoute}`
      });
    }

    return session;
  }

  public registerLeave(params: {
    sessionId: string;
    durationSec?: number;
    lastRoute?: string;
  }): VisitorSession | null {
    const nowIso = new Date().toISOString();
    const session = this.sessions.get(params.sessionId);
    if (!session) return null;

    const finalDuration = params.durationSec != null
      ? params.durationSec
      : Math.max(0, Math.floor((Date.now() - new Date(session.enteredAt).getTime()) / 1000));

    session.status = 'LEFT';
    session.leftAt = nowIso;
    session.lastActiveAt = nowIso;
    session.durationSec = finalDuration;
    if (params.lastRoute) session.currentRoute = params.lastRoute;

    const m = Math.floor(finalDuration / 60);
    const s = finalDuration % 60;
    const durStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

    this.addEvent({
      sessionId: session.sessionId,
      ip: session.ip,
      isLan: session.isLan,
      country: session.country,
      eventType: 'LEAVE',
      route: session.currentRoute,
      durationSec: finalDuration,
      deviceSummary: session.deviceSummary,
      description: `Rời khỏi website (Thời lượng: ${durStr})`
    });

    return session;
  }

  public touchFromRequest(sessionId: string, route?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const nowIso = new Date().toISOString();
    session.lastActiveAt = nowIso;
    session.durationSec = Math.max(0, Math.floor((Date.now() - new Date(session.enteredAt).getTime()) / 1000));
    if (session.status !== 'ONLINE') {
      session.status = 'ONLINE';
    }
    if (route && route.startsWith('#') && route !== session.currentRoute) {
      session.currentRoute = route;
      session.routeHistory.push({ route, timestamp: nowIso });
    }
  }

  private checkSessionTimeouts() {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.status === 'LEFT') continue;

      const lastActive = new Date(session.lastActiveAt).getTime();
      const elapsedSec = Math.floor((now - lastActive) / 1000);

      if (session.status === 'ONLINE' && elapsedSec > 45) {
        session.status = 'IDLE';
      }

      if (session.status === 'IDLE' && elapsedSec > 90) {
        session.status = 'LEFT';
        session.leftAt = session.lastActiveAt;
        const finalDur = Math.max(0, Math.floor((lastActive - new Date(session.enteredAt).getTime()) / 1000));
        session.durationSec = finalDur;

        const m = Math.floor(finalDur / 60);
        const s = finalDur % 60;
        const durStr = m > 0 ? `${m}m ${s}s` : `${s}s`;

        this.addEvent({
          sessionId: session.sessionId,
          ip: session.ip,
          isLan: session.isLan,
          country: session.country,
          eventType: 'TIMEOUT',
          route: session.currentRoute,
          durationSec: finalDur,
          deviceSummary: session.deviceSummary,
          description: `Mất tín hiệu / Tự động kết thúc phiên (Thời lượng: ${durStr})`
        });
      }
    }
  }

  private addEvent(event: Omit<SessionLifecycleEvent, 'id' | 'timestamp'>) {
    const entry: SessionLifecycleEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.lifecycleEvents.unshift(entry);
    if (this.lifecycleEvents.length > this.MAX_EVENTS) {
      this.lifecycleEvents = this.lifecycleEvents.slice(0, this.MAX_EVENTS);
    }
  }

  public getSessionsData(): {
    sessions: VisitorSession[];
    stats: {
      totalTracked: number;
      onlineCount: number;
      idleCount: number;
      leftCount: number;
      avgDurationSec: number;
    };
  } {
    const all = Array.from(this.sessions.values()).map(s => {
      if (s.deviceId) {
        const dev = deviceRegistryService.getDevice(s.deviceId);
        if (dev?.alias) s.alias = dev.alias;
        if (dev?.isOwner) s.isOwner = true;
      }
      return s;
    });
    const online = all.filter(s => s.status === 'ONLINE').length;
    const idle = all.filter(s => s.status === 'IDLE').length;
    const left = all.filter(s => s.status === 'LEFT').length;

    const totalDur = all.reduce((sum, s) => sum + s.durationSec, 0);
    const avgDuration = all.length > 0 ? Math.round(totalDur / all.length) : 0;

    const statusOrder: Record<string, number> = { ONLINE: 0, IDLE: 1, LEFT: 2 };
    all.sort((a, b) => {
      const diffStatus = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (diffStatus !== 0) return diffStatus;
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });

    return {
      sessions: all,
      stats: {
        totalTracked: all.length,
        onlineCount: online,
        idleCount: idle,
        leftCount: left,
        avgDurationSec: avgDuration
      }
    };
  }

  public getAggregatedDevices(): {
    devices: AggregatedDeviceSession[];
    stats: {
      totalDevices: number;
      totalUsers: number;
      onlineDevices: number;
      ownerDevices: number;
      lanDevices: number;
      wanDevices: number;
      avgDurationSec: number;
    };
  } {
    // 1. Group active in-memory sessions by deviceId
    const deviceSessionsMap = new Map<string, VisitorSession[]>();
    for (const s of this.sessions.values()) {
      const devKey = s.deviceId || s.visitorId || `ip_${s.ip}`;
      if (!deviceSessionsMap.has(devKey)) deviceSessionsMap.set(devKey, []);
      deviceSessionsMap.get(devKey)!.push(s);
    }

    // Include all persistent registered devices
    for (const dev of deviceRegistryService.listDevices()) {
      if (!deviceSessionsMap.has(dev.deviceId)) {
        deviceSessionsMap.set(dev.deviceId, []);
      }
    }

    const totalUniqueDevicesCount = deviceSessionsMap.size;

    // 2. Group devices into User Entities (userKey)
    // - All owner devices merge into 'owner:duy'
    // - Devices with the same custom alias merge into 'alias:' + alias.toLowerCase()
    // - Anonymous devices (no alias, not owner) stay partitioned as 'guest:' + deviceId
    interface DeviceEntry {
      deviceId: string;
      devMeta?: StoredDeviceInfo;
      devSessions: VisitorSession[];
    }

    const userMap = new Map<string, DeviceEntry[]>();

    for (const [deviceId, devSessions] of deviceSessionsMap.entries()) {
      const devMeta = deviceRegistryService.getDevice(deviceId);
      const isOwner = Boolean(devMeta?.isOwner || devSessions.some(s => s.isLan));
      const aliasClean = devMeta?.alias ? devMeta.alias.trim() : '';

      let userKey: string;
      if (isOwner) {
        userKey = 'owner:duy';
      } else if (aliasClean) {
        userKey = `alias:${aliasClean.toLowerCase()}`;
      } else {
        userKey = `guest:${deviceId}`;
      }

      if (!userMap.has(userKey)) userMap.set(userKey, []);
      userMap.get(userKey)!.push({ deviceId, devMeta, devSessions });
    }

    const aggregatedList: AggregatedDeviceSession[] = [];
    let totalDurSum = 0;
    let totalDurCount = 0;

    for (const [userKey, entries] of userMap.entries()) {
      // Collect all sessions belonging to this user
      const allSessions: VisitorSession[] = [];
      for (const entry of entries) {
        allSessions.push(...entry.devSessions);
      }
      allSessions.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
      const latestSession = allSessions[0];

      // Find the latest active device entry
      entries.sort((a, b) => {
        const timeA = new Date(a.devSessions[0]?.lastActiveAt || a.devMeta?.lastSeenAt || 0).getTime();
        const timeB = new Date(b.devSessions[0]?.lastActiveAt || b.devMeta?.lastSeenAt || 0).getTime();
        return timeB - timeA;
      });
      const primaryEntry = entries[0];
      const primaryDeviceId = primaryEntry.deviceId;

      // User meta (avatar, alias) from whichever entry has it defined
      const metaWithAvatar = entries.find(e => e.devMeta?.avatar)?.devMeta;
      const metaWithAlias = entries.find(e => e.devMeta?.alias)?.devMeta;
      const avatar = metaWithAvatar?.avatar;

      const isOwner = entries.some(e => Boolean(e.devMeta?.isOwner || e.devSessions.some(s => s.isLan)));
      const isBlocked = entries.some(e => Boolean(e.devMeta?.isBlocked));

      let alias = metaWithAlias?.alias;
      if (!alias && isOwner) {
        alias = 'Máy của Duy';
      }

      // User status: ONLINE if any device is ONLINE, IDLE if any is IDLE, else LEFT
      let overallStatus: 'ONLINE' | 'IDLE' | 'LEFT' = 'LEFT';
      if (entries.some(e => e.devSessions.some(s => s.status === 'ONLINE'))) {
        overallStatus = 'ONLINE';
      } else if (entries.some(e => e.devSessions.some(s => s.status === 'IDLE'))) {
        overallStatus = 'IDLE';
      }

      // Total duration accumulated across all sessions of this user
      const totalAccumulatedDuration = allSessions.reduce((acc, s) => acc + (s.durationSec || 0), 0);
      if (totalAccumulatedDuration > 0) {
        totalDurSum += totalAccumulatedDuration;
        totalDurCount++;
      }

      // IP History union across all devices
      const ipSet = new Set<string>();
      for (const e of entries) {
        if (e.devMeta?.ipHistory) {
          e.devMeta.ipHistory.forEach((ip: string) => ipSet.add(ip));
        }
        e.devSessions.forEach(s => { if (s.ip) ipSet.add(s.ip); });
      }
      const primaryIp = latestSession?.ip || primaryEntry.devMeta?.lastIp || '127.0.0.1';
      ipSet.add(primaryIp);
      const ipHistory = Array.from(ipSet);

      const isLan = entries.some(e => e.devSessions.some(s => s.isLan) || (e.devMeta?.lastIp && (e.devMeta.lastIp.startsWith('192.168.') || e.devMeta.lastIp === '127.0.0.1' || e.devMeta.lastIp === '::1')));

      // Build Sub-Devices list
      const subDevices: DeviceSubItem[] = entries.map(e => {
        const devSess = e.devSessions;
        const isDevOnline = devSess.some(s => s.status === 'ONLINE');
        const isDevIdle = devSess.some(s => s.status === 'IDLE');
        const devStatus: 'ONLINE' | 'IDLE' | 'LEFT' = isDevOnline ? 'ONLINE' : (isDevIdle ? 'IDLE' : 'LEFT');
        const s0 = devSess[0];
        const m = e.devMeta;
        return {
          deviceId: e.deviceId,
          deviceSummary: s0?.deviceSummary || m?.deviceSummary || 'Web Client',
          userAgent: s0?.userAgent || m?.userAgent || 'Unknown',
          ip: s0?.ip || m?.lastIp || '127.0.0.1',
          lastSeenAt: s0?.lastActiveAt || m?.lastSeenAt || new Date().toISOString(),
          firstSeenAt: m?.firstSeenAt || s0?.enteredAt || new Date().toISOString(),
          status: devStatus,
          isOnline: isDevOnline,
          pwaMode: Boolean(s0?.pwaMode)
        };
      });

      // Sort sub-devices: online first, then by lastSeenAt desc
      subDevices.sort((a, b) => {
        if (a.isOnline && !b.isOnline) return -1;
        if (!a.isOnline && b.isOnline) return 1;
        return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
      });

      const deviceSummary = entries.length > 1
        ? `${subDevices[0]?.deviceSummary || 'Web'} (+${entries.length - 1} thiết bị khác)`
        : (subDevices[0]?.deviceSummary || 'Unknown Device');

      const pastSessions = allSessions.slice(1).map(s => ({
        sessionId: s.sessionId,
        enteredAt: s.enteredAt,
        leftAt: s.leftAt,
        durationSec: s.durationSec,
        entryRoute: s.entryRoute,
        currentRoute: s.currentRoute,
        ip: s.ip,
        isLan: s.isLan
      }));

      aggregatedList.push({
        deviceId: primaryDeviceId,
        userId: userKey,
        alias,
        avatar,
        isOwner,
        isBlocked,
        status: overallStatus,
        ip: primaryIp,
        lastIp: primaryEntry.devMeta?.lastIp || primaryIp,
        ipHistory,
        isLan,
        country: latestSession?.country || primaryEntry.devMeta?.country || (isLan ? 'LAN' : 'VN'),
        userAgent: latestSession?.userAgent || primaryEntry.devMeta?.userAgent || 'Unknown',
        deviceSummary,
        pwaMode: entries.some(e => e.devSessions.some(s => s.pwaMode)),
        screenResolution: latestSession?.screenResolution || 'Unknown',
        currentRoute: latestSession?.currentRoute || '#dashboard',
        latestSessionEnteredAt: latestSession?.enteredAt || primaryEntry.devMeta?.firstSeenAt || new Date().toISOString(),
        latestSessionLeftAt: latestSession?.leftAt,
        latestSessionLastActiveAt: latestSession?.lastActiveAt || primaryEntry.devMeta?.lastSeenAt || new Date().toISOString(),
        latestSessionDurationSec: latestSession?.durationSec || 0,
        latestSessionRouteHistory: latestSession?.routeHistory || [{ route: '#dashboard', timestamp: new Date().toISOString() }],
        totalSessionsCount: allSessions.length,
        totalAccumulatedDurationSec: totalAccumulatedDuration,
        devicesCount: entries.length,
        devices: subDevices,
        pastSessions
      });
    }

    // Sort: ONLINE first, then IDLE, then LEFT; tie-break by latestSessionLastActiveAt desc
    const statusWeight = { ONLINE: 0, IDLE: 1, LEFT: 2 };
    aggregatedList.sort((a, b) => {
      const diff = statusWeight[a.status] - statusWeight[b.status];
      if (diff !== 0) return diff;
      return new Date(b.latestSessionLastActiveAt).getTime() - new Date(a.latestSessionLastActiveAt).getTime();
    });

    const onlineDevices = aggregatedList.filter(d => d.status === 'ONLINE').length;
    const ownerDevices = aggregatedList.filter(d => d.isOwner).length;
    const lanDevices = aggregatedList.filter(d => d.isLan).length;
    const wanDevices = aggregatedList.filter(d => !d.isLan).length;
    const avgDuration = totalDurCount > 0 ? Math.round(totalDurSum / totalDurCount) : 0;

    return {
      devices: aggregatedList,
      stats: {
        totalDevices: totalUniqueDevicesCount,
        totalUsers: aggregatedList.length,
        onlineDevices,
        ownerDevices,
        lanDevices,
        wanDevices,
        avgDurationSec: avgDuration
      }
    };
  }

  public getEvents(limit = 100): SessionLifecycleEvent[] {
    return this.lifecycleEvents.slice(0, limit);
  }

  public clearEvents(): { clearedCount: number } {
    const count = this.lifecycleEvents.length;
    this.lifecycleEvents = [];
    return { clearedCount: count };
  }

  public clearAllSessions(): { clearedCount: number } {
    const count = this.sessions.size;
    this.sessions.clear();
    this.lifecycleEvents = [];
    return { clearedCount: count };
  }

  public removeDeviceSessions(deviceId: string): void {
    for (const [key, s] of this.sessions.entries()) {
      if (s.deviceId === deviceId) {
        this.sessions.delete(key);
      }
    }
  }

  // --- Static Convenience Proxies ---
  public static clearSessions(): { clearedCount: number } {
    return VisitorSessionManager.getInstance().clearAllSessions();
  }

  public static removeDeviceSessions(deviceId: string): void {
    VisitorSessionManager.getInstance().removeDeviceSessions(deviceId);
  }

  public static clearEvents(): { clearedCount: number } {
    return VisitorSessionManager.getInstance().clearEvents();
  }

  public static registerEnter(params: {
    sessionId: string;
    visitorId?: string;
    deviceId?: string;
    isAdmin?: boolean;
    ip: string;
    isLan?: boolean;
    country?: string;
    userAgent: string;
    entryRoute?: string;
    route?: string;
    pwaMode?: boolean;
    screenResolution?: string;
    screen?: string;
    deviceSummary?: string;
  }): VisitorSession {
    const isLan = params.isLan !== undefined
      ? params.isLan
      : (params.ip.startsWith('192.168.') || params.ip === '127.0.0.1' || params.ip === '::1');
    return VisitorSessionManager.getInstance().registerEnter({
      sessionId: params.sessionId,
      visitorId: params.visitorId,
      deviceId: params.deviceId,
      isAdmin: params.isAdmin,
      ip: params.ip,
      isLan,
      country: params.country || (isLan ? 'LAN' : 'VN'),
      userAgent: params.userAgent,
      route: params.entryRoute || params.route || '#dashboard',
      pwaMode: params.pwaMode,
      screen: params.screenResolution || params.screen
    });
  }

  public static registerHeartbeat(params: {
    sessionId: string;
    deviceId?: string;
    isAdmin?: boolean;
    currentRoute?: string;
    route?: string;
    ip?: string;
    activeDurationSec?: number;
  }): VisitorSession | null {
    return VisitorSessionManager.getInstance().registerHeartbeat({
      sessionId: params.sessionId,
      deviceId: params.deviceId,
      isAdmin: params.isAdmin,
      route: params.currentRoute || params.route,
      ip: params.ip,
      activeDurationSec: params.activeDurationSec
    });
  }

  public static registerLeave(params: {
    sessionId: string;
    reason?: string;
    lastRoute?: string;
    durationSec?: number;
  }): VisitorSession | null {
    return VisitorSessionManager.getInstance().registerLeave({
      sessionId: params.sessionId,
      durationSec: params.durationSec,
      lastRoute: params.lastRoute
    });
  }

  public static getAllSessions(): VisitorSession[] {
    return VisitorSessionManager.getInstance().getSessionsData().sessions;
  }

  public static getAggregatedDevices() {
    return VisitorSessionManager.getInstance().getAggregatedDevices();
  }

  public static getEvents(limit = 100): SessionLifecycleEvent[] {
    return VisitorSessionManager.getInstance().getEvents(limit);
  }

  public static getSessionStats() {
    return VisitorSessionManager.getInstance().getSessionsData().stats;
  }
}

export const visitorSessionManager = VisitorSessionManager.getInstance();

export function getVisitorSessionsData() {
  return visitorSessionManager.getSessionsData();
}

export function getAggregatedDevicesData() {
  return visitorSessionManager.getAggregatedDevices();
}

export function getSessionLifecycleEvents(limit = 100) {
  return visitorSessionManager.getEvents(limit);
}

export function clearSessionLifecycleEvents() {
  return visitorSessionManager.clearEvents();
}
