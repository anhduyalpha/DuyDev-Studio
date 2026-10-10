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
}

export class TelemetryTracker {
  private static instance: TelemetryTracker;
  private readonly WINDOW_SECONDS = 60;
  private buckets: Map<number, SecondBucket> = new Map();

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
        totalLatencyMs: 0
      };
      this.buckets.set(nowSec, bucket);
    }

    bucket.requests++;
    bucket.bytesIn += contentLengthIn;
    bucket.bytesOut += contentLengthOut;
    bucket.totalLatencyMs += latencyMs;

    if (statusCode >= 200 && statusCode < 300) bucket.status2xx++;
    else if (statusCode >= 300 && statusCode < 400) bucket.status3xx++;
    else if (statusCode >= 400 && statusCode < 500) bucket.status4xx++;
    else if (statusCode >= 500) bucket.status5xx++;
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
        wanRequests: this.wanRequests
      },
      statusCodes: {
        c2xx: status2xxLast60,
        c3xx: status3xxLast60,
        c4xx: status4xxLast60,
        c5xx: status5xxLast60
      },
      last60s: {
        totalRequests: sumRequestsLast60,
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
}

export const telemetryTracker = TelemetryTracker.getInstance();
