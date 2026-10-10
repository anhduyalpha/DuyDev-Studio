/**
 * Centralized Admin & Storage Authentication Service
 * Supports cross-machine password verification, persistence, and stateless HMAC tokens.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { env, resolvedStoragePaths } from '../config/env.config.js';
import { logger } from '../lib/logger.js';

// Default SHA-256 hashes matching frontend adminAuth.js
const DEFAULT_HASH_ANHDUY = 'a40c326dd366739719ecbb8380f0534093cf6916b9b63114a71e885d20692ccc'; // "anhduy123"
const DEFAULT_HASH_DUYDEV = '3bc00dd78427db6937b4606a8e593ec3560c4343665d9fba311b103612baf8fb'; // "duydev"
const DEFAULT_HASH_ADMIN = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'; // "admin"

const PWD_FILE_PATH = path.resolve(resolvedStoragePaths.root, 'admin_pwd.hash');
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days valid for authenticated machines
const HMAC_SECRET = env.API_KEY || 'duydev_studio_master_secret_2026';

export class AuthService {
  /**
   * Computes SHA-256 hex string
   */
  static sha256(val: string): string {
    return crypto.createHash('sha256').update(val.trim()).digest('hex');
  }

  /**
   * Retrieves active password hash (custom or default)
   */
  static async getStoredPasswordHash(): Promise<string | null> {
    try {
      if (existsSync(PWD_FILE_PATH)) {
        const content = await fs.readFile(PWD_FILE_PATH, 'utf-8');
        return content.trim();
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to read admin password hash file');
    }
    return null;
  }

  /**
   * Verifies an input password
   */
  static async verifyPassword(password: string): Promise<boolean> {
    if (!password || typeof password !== 'string') return false;
    const inputHash = this.sha256(password);

    // Primary default password: "anhduy123"
    if (inputHash === DEFAULT_HASH_ANHDUY) {
      return true;
    }

    const storedHash = await this.getStoredPasswordHash();
    if (storedHash) {
      return inputHash === storedHash;
    }
    return inputHash === DEFAULT_HASH_DUYDEV || inputHash === DEFAULT_HASH_ADMIN;
  }

  /**
   * Changes the admin password
   */
  static async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const isOldValid = await this.verifyPassword(oldPassword);
    if (!isOldValid) {
      return { success: false, error: 'Mật khẩu hiện tại không chính xác' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Mật khẩu mới phải có tối thiểu 4 ký tự' };
    }

    const newHash = this.sha256(newPassword);
    try {
      const parentDir = path.dirname(PWD_FILE_PATH);
      if (!existsSync(parentDir)) {
        await fs.mkdir(parentDir, { recursive: true });
      }
      await fs.writeFile(PWD_FILE_PATH, newHash, 'utf-8');
      logger.info('Admin password updated successfully');
      return { success: true };
    } catch (err) {
      logger.error({ err }, 'Failed to write new admin password hash');
      return { success: false, error: 'Không thể lưu mật khẩu mới vào máy chủ' };
    }
  }

  /**
   * Generates a tamper-proof stateless session token
   */
  static generateSessionToken(): string {
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const signature = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(String(expiresAt))
      .digest('hex');
    return `${expiresAt}.${signature}`;
  }

  /**
   * Validates a session token or direct API key
   */
  static validateToken(token?: string | null): boolean {
    if (!token || typeof token !== 'string') return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

    // Direct API key bypass
    if (cleanToken === env.API_KEY) return true;

    // Validate HMAC token: <expiresAt>.<signature>
    const parts = cleanToken.split('.');
    if (parts.length !== 2) return false;

    const [expStr, signature] = parts;
    const expiresAt = Number(expStr);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

    const expected = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(String(expiresAt))
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return false;

    return crypto.timingSafeEqual(sigBuf, expBuf);
  }
}
