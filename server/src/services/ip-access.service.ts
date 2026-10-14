/**
 * IP Access Control & Rate Limiting Service
 * Manages persistent IP rules (Block/Blacklist, Whitelist, Custom RPM Limits, Aliases)
 * with in-memory caching and 0ms sliding-window rate evaluation.
 */

import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { telemetryTracker } from '../api/middleware/telemetry.middleware.js';
import { deviceRegistryService } from './device-registry.service.js';

export interface IpRuleDto {
  id: string;
  ip: string;
  alias: string | null;
  note: string | null;
  status: 'active' | 'blocked' | 'whitelisted' | 'rate_limited';
  rateLimitRpm: number;
  createdAt: Date;
  updatedAt: Date;
}

export class IpAccessService {
  private static instance: IpAccessService;
  private rulesCache: Map<string, IpRuleDto> = new Map();
  private ipRollingHits: Map<string, number[]> = new Map();
  private isInitialized = false;

  private constructor() {
    // Periodic garbage collection of rolling timestamps older than 60s
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - 60_000;
      for (const [ip, timestamps] of this.ipRollingHits.entries()) {
        const filtered = timestamps.filter(t => t > cutoff);
        if (filtered.length === 0) {
          this.ipRollingHits.delete(ip);
        } else {
          this.ipRollingHits.set(ip, filtered);
        }
      }
    }, 15_000).unref();
  }

  public static getInstance(): IpAccessService {
    if (!IpAccessService.instance) {
      IpAccessService.instance = new IpAccessService();
    }
    return IpAccessService.instance;
  }

  /**
   * Initializes in-memory cache from database
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const rules = await prisma.ipAccessRule.findMany();
      this.rulesCache.clear();
      for (const r of rules) {
        this.rulesCache.set(r.ip, {
          id: r.id,
          ip: r.ip,
          alias: r.alias,
          note: r.note,
          status: r.status as IpRuleDto['status'],
          rateLimitRpm: r.rateLimitRpm,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        });
      }
      this.isInitialized = true;
      logger.info({ ruleCount: rules.length }, 'IP Access Control rules loaded into memory');
    } catch (err) {
      logger.warn({ err }, 'Failed to initialize IP Access Control rules from database');
    }
  }

  /**
   * Evaluates if an IP address or device is allowed to proceed
   * Returns status code and reason if blocked or rate limited
   */
  public checkAccess(ip: string, deviceId?: string): { allowed: boolean; status: number; reason?: string } {
    // 0. Check Device ID block
    if (deviceId && deviceRegistryService.isBlocked(deviceId)) {
      return {
        allowed: false,
        status: 403,
        reason: 'Thiết bị này đã bị Quản trị viên chặn truy cập toàn hệ thống.'
      };
    }

    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!cleanIp) return { allowed: true, status: 200 };

    const rule = this.rulesCache.get(cleanIp);
    if (!rule) {
      // Default unthrottled personal server behavior
      return { allowed: true, status: 200 };
    }

    // 1. Hard Block (Blacklist)
    if (rule.status === 'blocked') {
      return {
        allowed: false,
        status: 403,
        reason: 'Địa chỉ IP này đã bị Quản trị viên chặn truy cập toàn hệ thống.'
      };
    }

    // 2. Whitelist (Always bypass any checks)
    if (rule.status === 'whitelisted') {
      return { allowed: true, status: 200 };
    }

    // 3. Custom Rate Limit (RPM)
    if (rule.rateLimitRpm > 0) {
      const now = Date.now();
      const cutoff = now - 60_000;
      let hits = this.ipRollingHits.get(cleanIp) || [];
      hits = hits.filter(t => t > cutoff);
      this.ipRollingHits.set(cleanIp, hits);

      if (hits.length >= rule.rateLimitRpm) {
        return {
          allowed: false,
          status: 429,
          reason: `Vượt quá giới hạn tần suất yêu cầu (${rule.rateLimitRpm} req/phút) do Quản trị viên quy định. Vui lòng thử lại sau.`
        };
      }
    }

    return { allowed: true, status: 200 };
  }

  /**
   * Records a valid request hit in the rolling window for rate calculation
   */
  public recordHit(ip: string): void {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!cleanIp) return;
    const now = Date.now();
    const hits = this.ipRollingHits.get(cleanIp) || [];
    hits.push(now);
    this.ipRollingHits.set(cleanIp, hits);
  }

  /**
   * Lists all configured IP rules with live hit stats
   */
  public async listRules(): Promise<Array<IpRuleDto & { currentRpm: number }>> {
    await this.init();
    const rules = Array.from(this.rulesCache.values());
    const now = Date.now();
    const cutoff = now - 60_000;

    return rules.map(r => {
      const hits = (this.ipRollingHits.get(r.ip) || []).filter(t => t > cutoff);
      return {
        ...r,
        currentRpm: hits.length
      };
    }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Upserts an IP access rule
   */
  public async upsertRule(
    ip: string,
    data: {
      alias?: string | null;
      note?: string | null;
      status?: 'active' | 'blocked' | 'whitelisted' | 'rate_limited';
      rateLimitRpm?: number;
    }
  ): Promise<IpRuleDto> {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!cleanIp) throw new Error('Địa chỉ IP không được để trống');

    const status = data.status || (data.rateLimitRpm && data.rateLimitRpm > 0 ? 'rate_limited' : 'active');
    const rateLimitRpm = Math.max(0, parseInt(String(data.rateLimitRpm || 0), 10) || 0);

    const record = await prisma.ipAccessRule.upsert({
      where: { ip: cleanIp },
      update: {
        alias: data.alias !== undefined ? data.alias : undefined,
        note: data.note !== undefined ? data.note : undefined,
        status,
        rateLimitRpm
      },
      create: {
        ip: cleanIp,
        alias: data.alias || null,
        note: data.note || null,
        status,
        rateLimitRpm
      }
    });

    const dto: IpRuleDto = {
      id: record.id,
      ip: record.ip,
      alias: record.alias,
      note: record.note,
      status: record.status as IpRuleDto['status'],
      rateLimitRpm: record.rateLimitRpm,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };

    this.rulesCache.set(cleanIp, dto);
    logger.info({ ip: cleanIp, status, rateLimitRpm }, 'IP Access rule updated');
    return dto;
  }

  /**
   * Deletes an IP rule (reverting to default active unthrottled)
   */
  public async deleteRule(ip: string): Promise<boolean> {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    if (!cleanIp) return false;

    try {
      const res = await prisma.ipAccessRule.deleteMany({ where: { ip: cleanIp } });
      this.rulesCache.delete(cleanIp);
      this.ipRollingHits.delete(cleanIp);
      logger.info({ ip: cleanIp, count: res.count }, 'IP Access rule deleted');
      return res.count > 0;
    } catch (err) {
      logger.warn({ err, ip: cleanIp }, 'Failed to delete IP access rule');
      return false;
    }
  }

  /**
   * Toggles blocking status for an IP
   */
  public async toggleBlock(ip: string): Promise<IpRuleDto> {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    const existing = this.rulesCache.get(cleanIp);
    const nextStatus = existing?.status === 'blocked' ? 'active' : 'blocked';
    return this.upsertRule(cleanIp, {
      alias: existing?.alias,
      note: existing?.note,
      status: nextStatus,
      rateLimitRpm: existing?.rateLimitRpm || 0
    });
  }

  /**
   * Sets rate limit (RPM) for an IP
   */
  public async setRateLimit(ip: string, rateLimitRpm: number): Promise<IpRuleDto> {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    const existing = this.rulesCache.get(cleanIp);
    const rpm = Math.max(0, rateLimitRpm);
    const nextStatus = rpm > 0 ? 'rate_limited' : (existing?.status === 'blocked' ? 'blocked' : 'active');
    return this.upsertRule(cleanIp, {
      alias: existing?.alias,
      note: existing?.note,
      status: nextStatus,
      rateLimitRpm: rpm
    });
  }

  /**
   * Resets rolling hits and clears log stats for an IP
   */
  public resetIpStats(ip: string): void {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    this.ipRollingHits.delete(cleanIp);
    // Also remove from in-memory telemetry if desired
    logger.info({ ip: cleanIp }, 'Reset traffic counters for IP');
  }

  /**
   * Gets rule by IP (if exists)
   */
  public getRule(ip: string): IpRuleDto | undefined {
    const cleanIp = (ip || '').replace(/^::ffff:/, '').trim();
    return this.rulesCache.get(cleanIp);
  }
}

export const ipAccessService = IpAccessService.getInstance();
