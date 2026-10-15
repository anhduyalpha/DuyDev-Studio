/**
 * Scribd Archiver Companion Daemon Supervisor
 * Manages Python web engine lifecycle on port 8091
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.config.js';

export class ScribdDaemonService {
  private static process: ChildProcess | null = null;
  private static get port(): number {
    try {
      const parsedPort = new URL(env.SCRIBD_API_URL).port;
      return parsedPort ? parseInt(parsedPort, 10) : 8091;
    } catch {
      return 8091;
    }
  }

  private static getEngineDir(): string {
    const candidates = [
      path.resolve(process.cwd(), '../engines/scribd'),
      path.resolve(process.cwd(), 'engines/scribd'),
      path.resolve(process.cwd(), '../../engines/scribd')
    ];
    for (const dir of candidates) {
      if (existsSync(path.join(dir, 'scribd_dl', 'server.py'))) {
        return dir;
      }
    }
    return candidates[0];
  }

  static async isPortOpen(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${this.port}/api/status`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      return res.status === 200;
    } catch {
      return false;
    }
  }

  private static resolvePythonBin(): string {
    const candidates = [
      path.resolve(process.cwd(), 'engines/scribd/venv/bin/python'),
      path.resolve(process.cwd(), '../engines/scribd/venv/bin/python'),
      path.resolve(process.cwd(), 'engines/scribd/venv/Scripts/python.exe'),
      path.resolve(process.cwd(), '../engines/scribd/venv/Scripts/python.exe'),
      '/home/anhduy/dd-studio/engines/scribd/venv/bin/python',
      '/home/anhduy/dd-studio/engines/document/venv/bin/python3',
      '/usr/bin/python3',
      '/usr/bin/python'
    ];
    for (const bin of candidates) {
      if (existsSync(bin)) return bin;
    }
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  static async ensureDaemonRunning(): Promise<boolean> {
    if (await this.isPortOpen()) {
      logger.info(`⚡ Scribd Archiver Engine already active on port ${this.port}`);
      return true;
    }

    const engineDir = this.getEngineDir();
    if (!existsSync(engineDir)) {
      logger.warn({ engineDir }, 'Scribd engine directory not found');
      return false;
    }

    const pythonBin = this.resolvePythonBin();
    try {
      const scriptPath = path.join(engineDir, 'daemon.py');
      this.process = spawn(pythonBin, [scriptPath, '--host', '0.0.0.0', '--port', String(this.port)], {
        cwd: engineDir,
        stdio: 'ignore',
        detached: process.platform !== 'win32'
      });

      if (this.process && process.platform !== 'win32') {
        this.process.unref();
      }

      this.process.on('error', (err) => {
        logger.error({ err }, 'Scribd daemon process error');
        this.process = null;
      });

      this.process.on('exit', (code) => {
        logger.info(`Scribd daemon exited with code ${code}`);
        this.process = null;
      });

      // Poll until port responds or timeout (10 seconds)
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.isPortOpen()) {
          logger.info(`✅ Scribd Archiver Engine is UP on port ${this.port}`);
          return true;
        }
      }
      return false;
    } catch (err) {
      logger.error({ err }, 'Failed to launch Scribd daemon');
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
        logger.warn({ err }, 'Error stopping Scribd daemon process');
      }
      this.process = null;
    }
  }

  static async getStatus(): Promise<{ active: boolean; port: number }> {
    const active = await this.isPortOpen();
    return { active, port: this.port };
  }
}
