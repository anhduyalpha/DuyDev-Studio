/**
 * Quiz Classifier Service
 * Manages the lifecycle of the local Python multilingual-e5-small ONNX daemon (port 3005).
 * Features:
 * - On-demand startup when semantic understanding is needed
 * - Sub-50ms inference latency
 * - Active memory release (POST /shutdown) before heavy PDF compilation jobs
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { logger } from '../lib/logger.js';

export interface QuizClassificationResult {
  intent: string;
  confidence: number;
  scores?: Record<string, number>;
  pages: string;
  pages_list: number[];
  count: number;
  start: number;
  end: number | null;
  relative: string | null;
  section_filter: 'all' | 'part_i' | 'part_ii' | 'part_iii';
  parity_filter: 'all' | 'odd' | 'even';
  topic: string | null;
  title: string;
  prefix: string;
  is_page_bounded: boolean;
  latency_ms?: number;
  source: string;
}

export class QuizClassifierService {
  private static instance: QuizClassifierService | null = null;
  private daemonProcess: ChildProcess | null = null;
  private readonly port: number;
  private readonly daemonUrl: string;
  private isStarting = false;

  public static getInstance(): QuizClassifierService {
    if (!QuizClassifierService.instance) {
      QuizClassifierService.instance = new QuizClassifierService();
    }
    return QuizClassifierService.instance;
  }

  private constructor() {
    this.port = Number(process.env.QUIZ_CLASSIFIER_PORT) || 3005;
    this.daemonUrl = `http://127.0.0.1:${this.port}`;
  }

  private resolvePythonBin(): string {
    const envPython = process.env.PYTHON_BIN;
    if (envPython && existsSync(envPython)) return envPython;

    const candidates = [
      path.resolve(process.cwd(), '.venv/bin/python'),
      path.resolve(process.cwd(), '.venv/Scripts/python.exe'),
      path.resolve(process.cwd(), 'venv/bin/python'),
      path.resolve(process.cwd(), 'venv/Scripts/python.exe'),
      '/home/anhduy/dd-studio/engines/document/venv/bin/python',
      '/home/anhduy/dd-studio/.benchmark_classifier/venv/bin/python',
      '/home/anhduy/dd-studio/engines/quiz/venv/bin/python',
      '/usr/bin/python3',
      'python3',
      'python'
    ];
    for (const c of candidates) {
      if (c.includes('/') || c.includes('\\')) {
        if (existsSync(c)) return c;
      }
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  private resolveDaemonScript(): string {
    const candidates = [
      path.resolve(process.cwd(), 'engines/quiz/recognition/classifier_daemon.py'),
      path.resolve(process.cwd(), '../engines/quiz/recognition/classifier_daemon.py'),
      '/home/anhduy/dd-studio/engines/quiz/recognition/classifier_daemon.py'
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
    return path.resolve(process.cwd(), 'engines/quiz/recognition/classifier_daemon.py');
  }

  public async isDaemonHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.daemonUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json() as any;
        return json.status === 'ok';
      }
      return false;
    } catch {
      return false;
    }
  }

  public async ensureDaemonRunning(): Promise<boolean> {
    if (await this.isDaemonHealthy()) {
      return true;
    }

    if (this.isStarting) {
      // Wait for ongoing start
      for (let i = 0; i < 25; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (await this.isDaemonHealthy()) return true;
      }
      return false;
    }

    this.isStarting = true;
    try {
      const pythonBin = this.resolvePythonBin();
      const daemonScript = this.resolveDaemonScript();

      if (!existsSync(daemonScript)) {
        logger.warn({ daemonScript }, 'Classifier daemon script not found on disk');
        return false;
      }

      logger.info({ pythonBin, daemonScript, port: this.port }, 'Starting Quiz Classifier Daemon on-demand...');

      const child = spawn(pythonBin, [daemonScript, '--port', String(this.port), '--ttl', '45'], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          QUIZ_CLASSIFIER_PORT: String(this.port),
          QUIZ_CLASSIFIER_TTL_SEC: '45'
        }
      });

      this.daemonProcess = child;

      child.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) logger.debug({ daemon: msg }, '[Classifier Daemon stdout]');
      });

      child.stderr?.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) logger.debug({ daemon: msg }, '[Classifier Daemon stderr]');
      });

      child.on('exit', (code, signal) => {
        logger.info({ code, signal }, '[Classifier Daemon] Process exited cleanly (RAM released)');
        this.daemonProcess = null;
      });

      // Poll until healthy or 15s timeout
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 300));
        if (await this.isDaemonHealthy()) {
          logger.info({ port: this.port }, '[Classifier Daemon] Healthy and ready for inference');
          return true;
        }
      }

      logger.warn('Classifier daemon startup timed out after 15s');
      return false;
    } catch (err) {
      logger.error({ err }, 'Failed to spawn classifier daemon');
      return false;
    } finally {
      this.isStarting = false;
    }
  }

  public async classifyPrompt(text: string): Promise<QuizClassificationResult | null> {
    const isReady = await this.ensureDaemonRunning();
    if (!isReady) {
      logger.warn('Classifier daemon unavailable, cannot perform semantic classification');
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`${this.daemonUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        logger.warn({ status: res.status }, 'Classifier daemon returned non-200');
        return null;
      }

      const json = await res.json() as any;
      if (json && json.success && json.data) {
        return json.data as QuizClassificationResult;
      }
      return null;
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Failed to call classifier daemon /classify');
      return null;
    }
  }

  public async releaseMemory(): Promise<void> {
    try {
      const isUp = await this.isDaemonHealthy();
      if (!isUp) {
        if (this.daemonProcess && !this.daemonProcess.killed) {
          this.daemonProcess.kill();
          this.daemonProcess = null;
        }
        return;
      }

      logger.info('Releasing Classifier Daemon memory before heavy PDF compilation...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      await fetch(`${this.daemonUrl}/shutdown`, {
        method: 'POST',
        signal: controller.signal
      }).catch(() => {});
      clearTimeout(timeoutId);

      if (this.daemonProcess && !this.daemonProcess.killed) {
        setTimeout(() => {
          if (this.daemonProcess && !this.daemonProcess.killed) {
            this.daemonProcess.kill();
            this.daemonProcess = null;
          }
        }, 500);
      }
    } catch (err) {
      logger.debug({ err }, 'Error during classifier releaseMemory (non-critical)');
    }
  }
}

export const quizClassifierService = QuizClassifierService.getInstance();
