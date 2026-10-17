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
  priority: number;
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
  keyId?: string;
  keyName?: string;
  errorDetails?: string;
  promptSnippet?: string;
  errorMsg?: string;
  isFallbackRecovered?: boolean;
  status?: string;
  recoveredByKey?: string;
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
    this.syncActiveEnvironment();
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
          priority: 1,
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
          // Normalize existing keys with priority & upgrade deprecated models
          parsed.keys = parsed.keys.map((k: AiKeyConfig, idx: number) => {
            let model = k.model;
            let baseUrl = k.baseUrl;
            if (model === 'gemini-1.5-flash') {
              model = 'gemini-2.5-flash';
            }
            if ((k.provider === 'gemini' || baseUrl?.includes('generativelanguage.googleapis.com') || k.apiKey?.startsWith('AIzaSy')) && baseUrl && !baseUrl.includes('/openai')) {
              baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
            }
            return {
              ...k,
              model,
              baseUrl,
              priority: typeof k.priority === 'number' ? k.priority : idx + 1,
              provider: k.provider || (k.id === 'agnes-primary' ? 'agnes' : 'custom')
            };
          });

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
    totalTokens?: number;
    latencyMs: number;
    statusCode: number;
    errorMsg?: string;
    keyId?: string;
    keyName?: string;
    errorDetails?: string;
    promptSnippet?: string;
    isFallbackRecovered?: boolean;
    status?: string;
    recoveredByKey?: string;
    isIntermediateAttempt?: boolean;
  }): AiCallLog {
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

    if (data.statusCode >= 400 && !data.isFallbackRecovered && data.status !== 'FALLBACK_RECOVERED' && !data.isIntermediateAttempt) {
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

    // Log entry (keep up to 50 recent logs)
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
      keyId: data.keyId,
      keyName: data.keyName,
      errorDetails: data.errorDetails,
      promptSnippet: data.promptSnippet,
      errorMsg: data.errorMsg,
      isFallbackRecovered: data.isFallbackRecovered,
      status: data.status,
      recoveredByKey: data.recoveredByKey
    };

    this.metrics.recentLogs.unshift(logItem);
    if (this.metrics.recentLogs.length > 50) {
      this.metrics.recentLogs = this.metrics.recentLogs.slice(0, 50);
    }

    this.saveMetrics();
    return logItem;
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
        priority: k.priority ?? 1,
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
    provider?: 'agnes' | 'gemini' | 'openai' | 'custom';
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    priority?: number;
    isActive?: boolean;
  }) {
    let key = this.metrics.keys.find(k => k.id === data.id);
    let model = data.model;
    let baseUrl = data.baseUrl;
    const prov = data.provider || (key ? key.provider : 'custom');
    const keyVal = data.apiKey !== undefined && data.apiKey !== '' ? data.apiKey : (key ? key.apiKey : '');
    
    if (model === 'gemini-1.5-flash') {
      model = 'gemini-2.5-flash';
    }
    if ((prov === 'gemini' || baseUrl?.includes('generativelanguage.googleapis.com') || keyVal?.startsWith('AIzaSy')) && baseUrl && !baseUrl.includes('/openai')) {
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    }

    if (!key) {
      key = {
        id: data.id,
        name: data.name || data.id,
        provider: data.provider || 'custom',
        baseUrl: baseUrl || 'https://apihub.agnes-ai.com/v1',
        model: model || 'agnes-3.0-flash',
        apiKey: data.apiKey || '',
        priority: typeof data.priority === 'number' ? data.priority : this.metrics.keys.length + 1,
        isActive: data.isActive !== false
      };
      this.metrics.keys.push(key);
    } else {
      if (data.name !== undefined) key.name = data.name;
      if (data.provider !== undefined) key.provider = data.provider;
      if (baseUrl !== undefined) key.baseUrl = baseUrl;
      if (model !== undefined) key.model = model;
      if (data.apiKey !== undefined && data.apiKey !== '') key.apiKey = data.apiKey;
      if (data.priority !== undefined) key.priority = data.priority;
      if (data.isActive !== undefined) key.isActive = data.isActive;
    }

    this.syncActiveEnvironment();
    this.saveMetrics();
    return key;
  }

  /**
   * Returns the highest-priority active AI key that has a non-empty API key.
   */
  public getPrimaryActiveKey(): AiKeyConfig | null {
    const activeKeys = this.metrics.keys
      .filter(k => k.isActive && Boolean(k.apiKey))
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));
    return activeKeys[0] || null;
  }

  /**
   * Synchronizes the currently active primary AI key into process.env so that
   * subprocess engines (Python, Chromium) immediately adopt the active provider.
   */
  public syncActiveEnvironment(): void {
    const primaryActive = this.getPrimaryActiveKey();
    if (primaryActive) {
      process.env.AGNES_AI_API_KEY = primaryActive.apiKey;
      process.env.AGNES_API_KEY = primaryActive.apiKey;
      process.env.AGNES_AI_BASE_URL = primaryActive.baseUrl;
      process.env.AGNES_AI_MODEL = primaryActive.model;
      logger.info(
        { keyId: primaryActive.id, name: primaryActive.name, model: primaryActive.model, baseUrl: primaryActive.baseUrl },
        'Synchronized active AI key to process.env'
      );
    } else {
      process.env.AGNES_AI_API_KEY = '';
      process.env.AGNES_API_KEY = '';
      logger.warn('No active AI keys configured in aiMetricsService');
    }
  }

  /**
   * Toggles the active status of any key (including primary or fallback keys).
   */
  public toggleKey(id: string, desiredActive?: boolean): AiKeyConfig {
    const key = this.metrics.keys.find(k => k.id === id);
    if (!key) {
      throw new Error(`Không tìm thấy API key với ID: ${id}`);
    }
    key.isActive = typeof desiredActive === 'boolean' ? desiredActive : !key.isActive;
    this.syncActiveEnvironment();
    this.saveMetrics();
    return key;
  }

  public deleteKey(id: string): { success: boolean; message: string } {
    if (id === 'agnes-primary') {
      throw new Error('Không thể xóa API key chính (Agnes AI Primary). Bạn chỉ có thể tắt hoặc cập nhật thông tin key.');
    }
    const idx = this.metrics.keys.findIndex(k => k.id === id);
    if (idx === -1) {
      throw new Error(`Không tìm thấy API key với ID: ${id}`);
    }
    this.metrics.keys.splice(idx, 1);
    this.syncActiveEnvironment();
    this.saveMetrics();
    return { success: true, message: `Đã xóa cấu hình API key ${id} thành công` };
  }

  /**
   * Sequential Multi-Key Fallback Pipeline
   * Tries active keys sorted by priority (Primary first, then Fallback 1, Fallback 2...).
   * Detailed upstream errors (504, 429, timeouts) are captured into AiCallLog per key.
   */
  public async executeWithFallback<T>(
    fn: (key: AiKeyConfig) => Promise<T>,
    context?: { module?: string; promptSnippet?: string }
  ): Promise<{ result: T; usedKey: AiKeyConfig; latencyMs: number }> {
    const activeKeys = this.metrics.keys
      .filter(k => k.isActive && Boolean(k.apiKey))
      .sort((a, b) => (a.priority || 1) - (b.priority || 1));

    if (activeKeys.length === 0) {
      throw new Error('Không có API key nào đang hoạt động và có khóa API');
    }

    let lastError: any = null;
    const failedAttemptLogs: AiCallLog[] = [];

    for (const key of activeKeys) {
      const startTime = Date.now();
      try {
        const result = await fn(key);
        const latencyMs = Date.now() - startTime;

        // If prior attempts failed but current fallback key succeeded:
        if (failedAttemptLogs.length > 0) {
          for (const failedLog of failedAttemptLogs) {
            failedLog.isFallbackRecovered = true;
            failedLog.status = 'FALLBACK_RECOVERED';
            failedLog.recoveredByKey = key.name;
          }
          this.saveMetrics();
        }

        return { result, usedKey: key, latencyMs };
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        lastError = err;
        const isTimeout = err?.name === 'AbortError' || err?.code === 'ETIMEDOUT' || err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
        const statusCode = Number(err?.status || err?.statusCode || err?.response?.status) || (isTimeout ? 504 : 500);
        const errorDetails = err?.message || 'Upstream did not respond or returned error';

        const callLog = this.recordCall({
          module: context?.module || 'ai-execution',
          provider: key.provider,
          model: key.model,
          latencyMs,
          statusCode,
          errorMsg: errorDetails,
          keyId: key.id,
          keyName: key.name,
          errorDetails,
          promptSnippet: context?.promptSnippet,
          isIntermediateAttempt: true
        });
        failedAttemptLogs.push(callLog);

        logger.warn(
          { keyId: key.id, keyName: key.name, latencyMs, statusCode, errorDetails },
          'AI multi-key execution failed on key, attempting next fallback key'
        );
      }
    }

    // If all keys failed, ensure cumulative.errorCalls reflects the global failure
    for (const failedLog of failedAttemptLogs) {
      if (failedLog.statusCode >= 400 && !failedLog.isFallbackRecovered) {
        this.metrics.cumulative.errorCalls++;
        if (failedLog.statusCode === 429) {
          this.metrics.cumulative.rateLimitedCalls++;
        }
      }
    }
    this.saveMetrics();

    throw lastError || new Error('Tất cả API key dự phòng đều thất bại');
  }

  public async testPingKey(target: string | {
    keyId?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    provider?: string;
  }): Promise<{
    success: boolean;
    latencyMs: number;
    statusCode: number;
    statusText: string;
    message: string;
  }> {
    let keyId = typeof target === 'string' ? target : target.keyId;
    let key = keyId ? this.metrics.keys.find(k => k.id === keyId) : null;

    let apiKey = typeof target === 'object' && target.apiKey ? target.apiKey : (key ? key.apiKey : '');
    let baseUrl = typeof target === 'object' && target.baseUrl ? target.baseUrl : (key ? key.baseUrl : '');
    let model = typeof target === 'object' && target.model ? target.model : (key ? key.model : '');
    let provider = typeof target === 'object' && target.provider ? target.provider : (key ? key.provider : 'custom');

    // Auto-detect provider if missing
    if (apiKey?.startsWith('AIzaSy')) provider = 'gemini';

    // Upgrade deprecated Gemini 1.5 Flash
    if (model === 'gemini-1.5-flash' || (!model && provider === 'gemini')) {
      model = 'gemini-2.5-flash';
      if (key) key.model = model;
    }

    // Normalize Gemini OpenAI base URL
    if ((provider === 'gemini' || baseUrl?.includes('generativelanguage.googleapis.com') || apiKey?.startsWith('AIzaSy')) && (!baseUrl || !baseUrl.includes('/openai'))) {
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      if (key) key.baseUrl = baseUrl;
    }

    if (!baseUrl) {
      baseUrl = provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai/'
        : 'https://apihub.agnes-ai.com/v1';
    }

    if (!apiKey) {
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
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const latency = Date.now() - start;
      const ok = resp.ok;

      if (key) {
        key.lastPingMs = latency;
        key.lastPingStatus = ok ? 'ok' : resp.status === 429 ? 'rate_limited' : 'error';
        key.lastPingAt = new Date().toISOString();
        this.saveMetrics();
      }

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
        else if (resp.status === 404) errMsg = 'Không tìm thấy model hoặc endpoint (404 - Hãy kiểm tra tên Model)';

        return {
          success: false,
          latencyMs: latency,
          statusCode: resp.status,
          statusText: resp.statusText || 'Error',
          message: `${errMsg}: ${errorBody.slice(0, 120)}`
        };
      }
    } catch (err: any) {
      const latency = Date.now() - start;
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout ? 'Hết thời gian chờ (Timeout > 8s)' : (err?.message || 'Không thể kết nối máy chủ AI');

      if (key) {
        key.lastPingMs = latency;
        key.lastPingStatus = 'error';
        key.lastPingAt = new Date().toISOString();
        this.saveMetrics();
      }

      return {
        success: false,
        latencyMs: latency,
        statusCode: 504,
        statusText: isTimeout ? 'Timeout' : 'Network Error',
        message: msg
      };
    }
  }

  /**
   * Fetches list of available models from the provider via /models endpoint.
   * Cleans IDs and falls back to curated models on failure.
   */
  public async fetchAvailableModels(params: {
    keyId?: string;
    apiKey?: string;
    baseUrl?: string;
    provider?: string;
  }): Promise<{
    success: boolean;
    provider: string;
    models: Array<{ id: string; name: string }>;
    message?: string;
  }> {
    let key = params.keyId ? this.metrics.keys.find(k => k.id === params.keyId) : null;

    let apiKey = params.apiKey || (key ? key.apiKey : '');
    let baseUrl = params.baseUrl || (key ? key.baseUrl : '');
    let provider = params.provider || (key ? key.provider : 'custom');

    // Auto-detect provider if missing
    if (apiKey?.startsWith('AIzaSy')) provider = 'gemini';

    // Normalize Gemini OpenAI base URL
    if ((provider === 'gemini' || baseUrl?.includes('generativelanguage.googleapis.com') || apiKey?.startsWith('AIzaSy')) && (!baseUrl || !baseUrl.includes('/openai'))) {
      baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
    }

    if (!baseUrl) {
      if (provider === 'gemini') baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      else if (provider === 'openai') baseUrl = 'https://api.openai.com/v1';
      else if (provider === 'agnes') baseUrl = 'https://apihub.agnes-ai.com/v1';
      else baseUrl = 'https://api.openai.com/v1';
    }

    // Curated models fallback
    const curatedModels: Record<string, Array<{ id: string; name: string }>> = {
      gemini: [
        { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash (Khuyên dùng - Nhanh & Mới nhất)' },
        { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro (Tư duy sâu)' },
        { id: 'gemini-flash-latest', name: 'gemini-flash-latest (Bản Flash ổn định)' },
        { id: 'gemini-pro-latest', name: 'gemini-pro-latest (Bản Pro ổn định)' },
        { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash' },
        { id: 'gemini-2.0-flash-lite', name: 'gemini-2.0-flash-lite' }
      ],
      agnes: [
        { id: 'agnes-3.0-flash', name: 'agnes-3.0-flash (Khuyên dùng)' },
        { id: 'agnes-3.0-pro', name: 'agnes-3.0-pro' },
        { id: 'agnes-2.5-flash', name: 'agnes-2.5-flash' }
      ],
      openai: [
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Khuyên dùng - Nhanh & Tiết kiệm)' },
        { id: 'gpt-4o', name: 'gpt-4o (Đa năng mạnh mẽ)' },
        { id: 'o3-mini', name: 'o3-mini (Lý luận cao cấp)' },
        { id: 'gpt-4-turbo', name: 'gpt-4-turbo' }
      ],
      custom: [
        { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini' },
        { id: 'custom-model', name: 'custom-model' }
      ]
    };

    const fallbackList = curatedModels[provider] || curatedModels.custom;

    if (!apiKey) {
      return {
        success: true,
        provider,
        models: fallbackList,
        message: 'Chưa có API key, hiển thị danh sách model gợi ý'
      };
    }

    try {
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/models`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        return {
          success: false,
          provider,
          models: fallbackList,
          message: `Không thể lấy danh sách từ máy chủ (${resp.status} ${resp.statusText}). Đã tải model mặc định.`
        };
      }

      const json: any = await resp.json();
      let rawList: any[] = [];
      if (Array.isArray(json?.data)) rawList = json.data;
      else if (Array.isArray(json?.models)) rawList = json.models;

      if (!rawList || rawList.length === 0) {
        return {
          success: true,
          provider,
          models: fallbackList,
          message: 'Không tìm thấy model nào từ phản hồi, sử dụng danh sách gợi ý'
        };
      }

      // Filter and clean IDs
      const filtered: Array<{ id: string; name: string }> = [];
      const seen = new Set<string>();

      for (const item of rawList) {
        let id = String(item.id || item.name || '').trim();
        if (!id) continue;
        if (id.startsWith('models/')) {
          id = id.replace(/^models\//, '');
        }

        const lower = id.toLowerCase();
        // Skip non-chat utilities
        if (
          lower.includes('embed') ||
          lower.includes('tts') ||
          lower.includes('audio') ||
          lower.includes('whisper') ||
          lower.includes('dall-e') ||
          lower.includes('imagen') ||
          lower.includes('babbage') ||
          lower.includes('davinci') ||
          lower.includes('curie') ||
          lower.includes('realtime') ||
          lower.includes('moderation') ||
          lower.includes('robotics') ||
          lower.includes('aqa') ||
          lower.includes('computer-use')
        ) {
          continue;
        }

        // For Gemini, only include gemini models
        if (provider === 'gemini' && !lower.startsWith('gemini')) {
          continue;
        }

        if (!seen.has(id)) {
          seen.add(id);
          filtered.push({ id, name: id });
        }
      }

      // Sort models: prioritize flash and latest
      filtered.sort((a, b) => {
        const aId = a.id.toLowerCase();
        const bId = b.id.toLowerCase();
        // Priority 1: gemini-2.5-flash / gpt-4o-mini
        const aTop = aId.includes('2.5-flash') || aId.includes('4o-mini');
        const bTop = bId.includes('2.5-flash') || bId.includes('4o-mini');
        if (aTop && !bTop) return -1;
        if (!aTop && bTop) return 1;

        // Priority 2: 2.5-pro or 4o
        const aMid = aId.includes('2.5-pro') || aId === 'gpt-4o';
        const bMid = bId.includes('2.5-pro') || bId === 'gpt-4o';
        if (aMid && !bMid) return -1;
        if (!aMid && bMid) return 1;

        // Priority 3: latest
        const aLat = aId.includes('latest');
        const bLat = bId.includes('latest');
        if (aLat && !bLat) return -1;
        if (!aLat && bLat) return 1;

        return aId.localeCompare(bId);
      });

      const finalModels = filtered.length > 0 ? filtered : fallbackList;

      return {
        success: true,
        provider,
        models: finalModels,
        message: `Đã tìm thấy ${finalModels.length} model khả dụng từ ${provider}`
      };
    } catch (err: any) {
      return {
        success: false,
        provider,
        models: fallbackList,
        message: `Lỗi kết nối khi quét models (${err?.message || 'Timeout'}). Đã tải danh sách mặc định.`
      };
    }
  }
}

export const aiMetricsService = AiMetricsService.getInstance();
