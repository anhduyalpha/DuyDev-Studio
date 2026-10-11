/**
 * Admin User Accounts Management Service
 * Supports CRUD, role assignment, custom rate limits, notes, and API key regeneration for database users.
 */

import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AuthService } from './auth.service.js';
import { logger } from '../lib/logger.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

export interface UserSummaryDto {
  id: string;
  username: string;
  role: string;
  status: string;
  rateLimitRpm: number;
  notes: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  totalJobs: number;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminUsersService {
  private static instance: AdminUsersService;

  public static getInstance(): AdminUsersService {
    if (!AdminUsersService.instance) {
      AdminUsersService.instance = new AdminUsersService();
    }
    return AdminUsersService.instance;
  }

  /**
   * Generates a secure random API key
   */
  public generateApiKey(): string {
    return `ds_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Lists all registered user accounts with aggregate job counts
   */
  public async listUsers(): Promise<UserSummaryDto[]> {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { jobs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role || 'user',
      status: u.status || 'active',
      rateLimitRpm: u.rateLimitRpm || 0,
      notes: u.notes || null,
      hasApiKey: Boolean(u.apiKey),
      apiKeyPreview: u.apiKey ? `${u.apiKey.slice(0, 7)}...${u.apiKey.slice(-4)}` : null,
      totalJobs: u._count.jobs,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));
  }

  /**
   * Creates a new user account
   */
  public async createUser(input: {
    username: string;
    password: string;
    role?: string;
    rateLimitRpm?: number;
    notes?: string;
    generateApiKey?: boolean;
  }): Promise<UserSummaryDto> {
    const username = input.username?.trim();
    const password = input.password?.trim();

    if (!username || username.length < 3) {
      throw new BadRequestError('Tên đăng nhập phải có tối thiểu 3 ký tự');
    }
    if (!password || password.length < 4) {
      throw new BadRequestError('Mật khẩu phải có tối thiểu 4 ký tự');
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new BadRequestError(`Tên người dùng '${username}' đã tồn tại trong hệ thống`);
    }

    const passwordHash = AuthService.sha256(password);
    const apiKey = input.generateApiKey ? this.generateApiKey() : null;
    const role = (input.role === 'admin' ? 'admin' : 'user');
    const rateLimitRpm = Math.max(0, parseInt(String(input.rateLimitRpm || 0), 10) || 0);

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        apiKey,
        role,
        status: 'active',
        rateLimitRpm,
        notes: input.notes?.trim() || null
      }
    });

    logger.info({ userId: user.id, username: user.username, role }, 'Admin created new user account');

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      rateLimitRpm: user.rateLimitRpm,
      notes: user.notes,
      hasApiKey: Boolean(user.apiKey),
      apiKeyPreview: user.apiKey ? `${user.apiKey.slice(0, 7)}...${user.apiKey.slice(-4)}` : null,
      totalJobs: 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }

  /**
   * Updates an existing user account
   */
  public async updateUser(
    id: string,
    input: {
      username?: string;
      password?: string;
      role?: string;
      status?: string;
      rateLimitRpm?: number;
      notes?: string;
      resetApiKey?: boolean;
      removeApiKey?: boolean;
    }
  ): Promise<UserSummaryDto> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`Không tìm thấy người dùng với ID '${id}'`);
    }

    const data: Record<string, any> = {};

    if (input.username !== undefined) {
      const u = input.username.trim();
      if (u.length < 3) throw new BadRequestError('Tên đăng nhập phải có ít nhất 3 ký tự');
      if (u !== user.username) {
        const conflict = await prisma.user.findUnique({ where: { username: u } });
        if (conflict) throw new BadRequestError(`Tên đăng nhập '${u}' đã được sử dụng`);
        data.username = u;
      }
    }

    if (input.password !== undefined && input.password.trim()) {
      const pwd = input.password.trim();
      if (pwd.length < 4) throw new BadRequestError('Mật khẩu mới phải có tối thiểu 4 ký tự');
      data.passwordHash = AuthService.sha256(pwd);
    }

    if (input.role !== undefined) {
      data.role = input.role === 'admin' ? 'admin' : 'user';
    }

    if (input.status !== undefined) {
      data.status = input.status === 'blocked' ? 'blocked' : 'active';
    }

    if (input.rateLimitRpm !== undefined) {
      data.rateLimitRpm = Math.max(0, parseInt(String(input.rateLimitRpm), 10) || 0);
    }

    if (input.notes !== undefined) {
      data.notes = input.notes?.trim() || null;
    }

    if (input.resetApiKey) {
      data.apiKey = this.generateApiKey();
    } else if (input.removeApiKey) {
      data.apiKey = null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { jobs: true }
        }
      }
    });

    logger.info({ userId: updated.id, username: updated.username }, 'Admin updated user account');

    return {
      id: updated.id,
      username: updated.username,
      role: updated.role,
      status: updated.status,
      rateLimitRpm: updated.rateLimitRpm,
      notes: updated.notes,
      hasApiKey: Boolean(updated.apiKey),
      apiKeyPreview: updated.apiKey ? `${updated.apiKey.slice(0, 7)}...${updated.apiKey.slice(-4)}` : null,
      totalJobs: updated._count.jobs,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
  }

  /**
   * Deletes a user account
   */
  public async deleteUser(id: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`Không tìm thấy người dùng với ID '${id}'`);
    }

    await prisma.user.delete({ where: { id } });
    logger.info({ userId: id, username: user.username }, 'Admin deleted user account');
    return true;
  }

  /**
   * Resets/Generates a new API key for a user and returns the full key
   */
  public async resetApiKey(id: string): Promise<{ apiKey: string }> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundError(`Không tìm thấy người dùng với ID '${id}'`);
    }

    const newKey = this.generateApiKey();
    await prisma.user.update({
      where: { id },
      data: { apiKey: newKey }
    });

    logger.info({ userId: id, username: user.username }, 'Admin generated new API key for user');
    return { apiKey: newKey };
  }
}

export const adminUsersService = AdminUsersService.getInstance();
