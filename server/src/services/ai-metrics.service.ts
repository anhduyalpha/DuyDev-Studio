/**
 * AI Metrics & Agent Key Management Service
 * Manages AI provider credentials, token consumption counters, live RPM/TPM rate limits, and invocation logs.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger.js';

export interface AiKeyConfig {
  id: string;
  name: string;
  provider: 'agnes' | 'gemini' | 'openai' | 'custom';
  baseUrl: string;
  model: string;
  apiKey: string;
  isActive: boolean;
  lastPingMs?: number;
  lastPingStatus?: 'ok' | 'error' | 'rate_limited';
  lastPingAt?: string;
}

export interface AiCallLog {
  id: string;
  timestamp: string;
  module: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  statusCode: number;
  errorMsg?: string;
}

interface StoredAiMetrics {
  keys: AiKeyConfig[];
  cumulative: {
    totalCalls: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    errorCalls: number;
    rateLimitedCalls: number;
  };
  daily: {
    date: string; // YYYY-MM-DD
    calls: number;
    tokens: number;
  };
  recentLogs: AiCallLog[];
}

export class AiMetricsService {
  private static instance: AiMetricsService;
  private readonly dataPath: string;
  private metrics: StoredAiMetrics;

  // In-memory 60s rolling window for live RPM & TPM
  private rollingCalls: Array<{ timestamp: number; tokens: number }> = [];

  private constructor() {
    this.dataPath = path.resolve(process.cwd(), 'data', 'ai_metrics.json');
    this.metrics = this.loadMetrics();
  }

  public static getInstance(): AiMetricsService {
    if (!AiMetricsService.instance) {
      AiMetricsService.instance = new AiMetricsService();
    }
    return AiMetricsService.instance;
  }

  private loadMetrics(): StoredAiMetrics {
    const today = new Date().toISOString().split('T')[0];
    const defaultData: StoredAiMetrics = {
      keys: [
        {
          id: 'agnes-primary',
          name: 'Agnes AI (Primary)',
          provider: 'agnes',
          baseUrl: process.env.AGNES_AI_BASE_URL || 'https://apihub.agnes-ai.com/v1',
          model: process.env.AGNES_AI_MODEL || 'agnes-3.0-flash',
          apiKey: process.env.AGNES_AI_API_KEY || process.env.AGNES_API_KEY || '',
          isActive: true
        }
      ],
      cumulative: {
        totalCalls: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        errorCalls: 0,
        rateLimitedCalls: 0
      },
      daily: {
        date: today,
        calls: 0,
        tokens: 0
      },
      recentLogs: []
    };

    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure default Agnes key is synchronized if not yet set
        if (!parsed.keys || parsed.keys.length === 0) {
          parsed.keys = defaultData.keys;
        } else {
          // Sync env key if empty in file
          const agnesKey = parsed.keys.find((k: AiKeyConfig) => k.id === 'agnes-primary');
          if (agnesKey && !agnesKey.apiKey && (process.env.AGNES_AI_API_KEY || process.env.AGNES_API_KEY)) {
            agnesKey.apiKey = process.env.AGNES_AI_API_KEY || process.env.AGNES_API_KEY || '';
          }
        }
        return {
          ...defaultData,
          ...parsed,
          daily: parsed.daily?.date === today ? parsed.daily : { date: today, calls: 0, tokens: 0 }
        };
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to read ai_metrics.json, initializing fresh store');
    }

    this.saveMetrics(defaultData);
    return defaultData;
  }

  private saveMetrics(data = this.metrics) {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      logger.error({ err }, 'Failed to persist ai_metrics.json');
    }
  }

  public maskKey(key: string): string {
    if (!key || key.length < 8) return key ? '****' : '';
    const prefix = key.slice(0, 4);
    const suffix = key.slice(-4);
    return `${prefix}...${suffix}`;
  }

  public recordCall(data: {
    module: string;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs: number;
    statusCode: number;
    errorMsg?: string;
  }) {
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    const pTokens = data.promptTokens || 0;
    const cTokens = data.completionTokens || 0;
    const tTokens = pTokens + cTokens;

    // Rolling 60s window
    this.rollingCalls.push({ timestamp: now, tokens: tTokens });
    const cutoff = now - 60_000;
    this.rollingCalls = this.rollingCalls.filter(c => c.timestamp >= cutoff);

    // Cumulative
    this.metrics.cumulative.totalCalls++;
    this.metrics.cumulative.totalPromptTokens += pTokens;
    this.metrics.cumulative.totalCompletionTokens += cTokens;
    this.metrics.cumulative.totalTokens += tTokens;

    if (data.statusCode >= 400) {
      this.metrics.cumulative.errorCalls++;
      if (data.statusCode === 429) {
        this.metrics.cumulative.rateLimitedCalls++;
      }
    }

    // Daily reset check
    if (this.metrics.daily.date !== today) {
      this.metrics.daily = { date: today, calls: 0, tokens: 0 };
    }
    this.metrics.daily.calls++;
    this.metrics.daily.tokens += tTokens;

    // Log entry (keep up to 20 recent logs)
    const logItem: AiCallLog = {
      id: `ai_${now}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(now).toISOString(),
      module: data.module,
      provider: data.provider || 'agnes',
      model: data.model || 'agnes-3.0-flash',
      promptTokens: pTokens,
      completionTokens: cTokens,
      totalTokens: tTokens,
      latencyMs: data.latencyMs,
      statusCode: data.statusCode,
      errorMsg: data.errorMsg
    };

    this.metrics.recentLogs.unshift(logItem);
    if (this.metrics.recentLogs.length > 20) {
      this.metrics.recentLogs = this.metrics.recentLogs.slice(0, 20);
    }

    this.saveMetrics();
  }

  public getLiveRateLimits() {
    const now = Date.now();
    const cutoff = now - 60_000;
    this.rollingCalls = this.rollingCalls.filter(c => c.timestamp >= cutoff);

    const liveRpm = this.rollingCalls.length;
    const liveTpm = this.rollingCalls.reduce((acc, c) => acc + c.tokens, 0);

    // Standard limits: 60 RPM, 100,000 TPM, 1,500 RPD
    const rpmLimit = 60;
    const tpmLimit = 100_000;
    const dailyLimit = 1500;

    return {
      liveRpm,
      rpmLimit,
      rpmPercent: Math.min(100, Math.round((liveRpm / rpmLimit) * 100)),
      liveTpm,
      tpmLimit,
      tpmPercent: Math.min(100, Math.round((liveTpm / tpmLimit) * 100)),
      dailyCalls: this.metrics.daily.calls,
      dailyTokens: this.metrics.daily.tokens,
      dailyLimit,
      dailyPercent: Math.min(100, Math.round((this.metrics.daily.calls / dailyLimit) * 100))
    };
  }

  public getTelemetryData() {
    const rateLimits = this.getLiveRateLimits();

    return {
      keys: this.metrics.keys.map(k => ({
        id: k.id,
        name: k.name,
        provider: k.provider,
        baseUrl: k.baseUrl,
        model: k.model,
        apiKeyMasked: this.maskKey(k.apiKey),
        hasKey: Boolean(k.apiKey),
        isActive: k.isActive,
        lastPingMs: k.lastPingMs,
        lastPingStatus: k.lastPingStatus,
        lastPingAt: k.lastPingAt
      })),
      rateLimits,
      cumulative: this.metrics.cumulative,
      daily: this.metrics.daily,
      recentLogs: this.metrics.recentLogs
    };
  }

  public updateKey(data: {
    id: string;
    name?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    isActive?: boolean;
  }) {
    let key = this.metrics.keys.find(k => k.id === data.id);
    if (!key) {
      key = {
        id: data.id,
        name: data.name || data.id,
        provider: 'custom',
        baseUrl: data.baseUrl || 'https://apihub.agnes-ai.com/v1',
        model: data.model || 'agnes-3.0-flash',
        apiKey: data.apiKey || '',
        isActive: data.isActive !== false
      };
      this.metrics.keys.push(key);
    } else {
      if (data.name !== undefined) key.name = data.name;
      if (data.baseUrl !== undefined) key.baseUrl = data.baseUrl;
      if (data.model !== undefined) key.model = data.model;
      if (data.apiKey !== undefined && data.apiKey !== '') key.apiKey = data.apiKey;
      if (data.isActive !== undefined) key.isActive = data.isActive;
    }

    // If updating primary agnes key, also sync process.env
    if (data.id === 'agnes-primary' && data.apiKey) {
      process.env.AGNES_AI_API_KEY = data.apiKey;
      process.env.AGNES_API_KEY = data.apiKey;
      if (data.baseUrl) process.env.AGNES_AI_BASE_URL = data.baseUrl;
      if (data.model) process.env.AGNES_AI_MODEL = data.model;
    }

    this.saveMetrics();
    return key;
  }

  public async testPingKey(keyId: string): Promise<{
    success: boolean;
    latencyMs: number;
    statusCode: number;
    statusText: string;
    message: string;
  }> {
    const key = this.metrics.keys.find(k => k.id === keyId);
    if (!key) {
      throw new Error(`Key with ID ${keyId} not found`);
    }

    if (!key.apiKey) {
      return {
        success: false,
        latencyMs: 0,
        statusCode: 400,
        statusText: 'No Key',
        message: 'Chưa cấu hình API Key cho provider này'
      };
    }

    const start = Date.now();
    try {
      const endpoint = `${key.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key.apiKey}`
        },
        body: JSON.stringify({
          model: key.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - start;
      const ok = resp.ok;

      key.lastPingMs = latency;
      key.lastPingStatus = ok ? 'ok' : resp.status === 429 ? 'rate_limited' : 'error';
      key.lastPingAt = new Date().toISOString();
      this.saveMetrics();

      if (ok) {
        return {
          success: true,
          latencyMs: latency,
          statusCode: resp.status,
          statusText: 'Active',
          message: `Kết nối thành công (${latency}ms)`
        };
      } else {
        const errorBody = await resp.text().catch(() => '');
        let errMsg = `Lỗi HTTP ${resp.status}`;
        if (resp.status === 429) errMsg = 'Đã chạm hạn ngạch (Rate Limit Exceeded - 429)';
        else if (resp.status === 401 || resp.status === 403) errMsg = 'API Key không hợp lệ hoặc đã hết hạn';

        return {
          success: false,
          latencyMs: latency,
          statusCode: resp.status,
          statusText: resp.statusText || 'Error',
          message: `${errMsg}: ${errorBody.slice(0, 100)}`
        };
      }
    } catch (err: any) {
      const latency = Date.now() - start;
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout ? 'Hết thời gian chờ (Timeout > 8s)' : (err?.message || 'Không thể kết nối máy chủ AI');

      key.lastPingMs = latency;
      key.lastPingStatus = 'error';
      key.lastPingAt = new Date().toISOString();
      this.saveMetrics();

      return {
        success: false,
        latencyMs: latency,
        statusCode: 504,
        statusText: isTimeout ? 'Timeout' : 'Network Error',
        message: msg
      };
    }
  }
}

export const aiMetricsService = AiMetricsService.getInstance();
