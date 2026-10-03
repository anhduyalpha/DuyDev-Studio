/**
 * Studocu Downloader Companion Daemon Supervisor
 * Manages Python web engine lifecycle on port 8090
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.config.js';

export class StudocuDaemonService {
  private static process: ChildProcess | null = null;
  private static get port(): number {
    try {
      const parsedPort = new URL(env.STUDOCU_API_URL).port;
      return parsedPort ? parseInt(parsedPort, 10) : 8090;
    } catch {
      return 8090;
    }
  }

  private static getEngineDir(): string {
    const candidates = [
      path.resolve(process.cwd(), '../engines/studocu'),
      path.resolve(process.cwd(), 'engines/studocu'),
      path.resolve(process.cwd(), '../../engines/studocu')
    ];
    for (const dir of candidates) {
      if (existsSync(path.join(dir, 'studocu_dl', 'server.py'))) {
        return dir;
      }
    }
    return candidates[0];
  }

  static async isPortOpen(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${this.port}/api/files`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  static async ensureDaemonRunning(): Promise<boolean> {
    if (await this.isPortOpen()) {
      logger.info(`⚡ Studocu Downloader Engine already active on port ${this.port}`);
      return true;
    }

    const engineDir = this.getEngineDir();
    if (!existsSync(engineDir)) {
      logger.warn({ engineDir }, 'Studocu engine directory not found');
      return false;
    }

    logger.info(`🚀 Starting Studocu Downloader Engine daemon on port ${this.port}...`);
    try {
      this.process = spawn('python', ['-m', 'studocu_dl.server', '--host', '0.0.0.0', '--port', String(this.port)], {
        cwd: engineDir,
        stdio: 'ignore',
        detached: process.platform !== 'win32'
      });

      this.process.on('error', (err) => {
        logger.error({ err }, 'Studocu daemon process error');
        this.process = null;
      });

      this.process.on('exit', (code) => {
        logger.info(`Studocu daemon exited with code ${code}`);
        this.process = null;
      });

      // Poll until port responds or timeout (8 seconds)
      for (let i = 0; i < 16; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.isPortOpen()) {
          logger.info(`✅ Studocu Downloader Engine is UP on port ${this.port}`);
          return true;
        }
      }
      return false;
    } catch (err) {
      logger.error({ err }, 'Failed to launch Studocu daemon');
      return false;
    }
  }

  static async stopDaemon(): Promise<void> {
    if (this.process && this.process.pid) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
        } else {
          this.process.kill('SIGTERM');
        }
      } catch (err) {
        logger.warn({ err }, 'Error stopping Studocu daemon process');
      }
      this.process = null;
    }
  }

  static async getStatus(): Promise<{ status: string; port: number; online: boolean }> {
    const online = await this.isPortOpen();
    return {
      status: online ? 'UP' : 'DOWN',
      port: this.port,
      online
    };
  }
}
