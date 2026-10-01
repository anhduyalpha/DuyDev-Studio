import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import { BadRequestError } from '../../lib/errors.js';

const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(4, 'New password must be at least 4 characters')
});

export async function verifyPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = verifyPasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError('Mật khẩu không được để trống');
  }

  const { password } = parseResult.data;
  const isValid = await AuthService.verifyPassword(password);

  if (!isValid) {
    return reply.status(401).send({
      success: false,
      message: 'Mật khẩu quản trị không chính xác'
    });
  }

  const token = AuthService.generateSessionToken();
  return reply.send({
    success: true,
    data: {
      authenticated: true,
      token
    }
  });
}

export async function changePasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = changePasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    const msg = parseResult.error.errors[0]?.message || 'Dữ liệu không hợp lệ';
    throw new BadRequestError(msg);
  }

  const { oldPassword, newPassword } = parseResult.data;
  const result = await AuthService.changePassword(oldPassword, newPassword);

  if (!result.success) {
    return reply.status(400).send({
      success: false,
      message: result.error || 'Đổi mật khẩu thất bại'
    });
  }

  const token = AuthService.generateSessionToken();
  return reply.send({
    success: true,
    data: {
      message: 'Đổi mật khẩu quản trị thành công',
      token
    }
  });
}

export async function authStatusHandler(_request: FastifyRequest, reply: FastifyReply) {
  const customHash = await AuthService.getStoredPasswordHash();
  return reply.send({
    success: true,
    data: {
      hasCustomPassword: Boolean(customHash),
      isProtected: true
    }
  });
}

/**
 * Authentication PreHandler Guard for Admin & Telemetry Endpoints
 */
export async function adminAuthGuard(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = (request.headers['x-storage-auth'] as string) || (request.headers.authorization as string) || '';
  const queryToken = (request.query as Record<string, string>)?.auth || (request.query as Record<string, string>)?.token || '';
  const candidate = authHeader || queryToken;

  if (candidate) {
    if (AuthService.validateToken(candidate)) {
      return;
    }
    const isPasswordValid = await AuthService.verifyPassword(candidate.replace(/^Bearer\s+/i, '').trim());
    if (isPasswordValid) {
      return;
    }
  }

  return reply.status(401).send({
    success: false,
    error: 'UNAUTHORIZED',
    message: 'Yêu cầu quyền Quản trị viên để truy cập thông số này.'
  });
}

/**
 * R2 Telemetry and Quota Inspector Handler
 */
export async function r2StatsHandler(_request: FastifyRequest, reply: FastifyReply) {
  const { R2Service } = await import('../../services/r2.service.js');
  const stats = await R2Service.getTelemetrySummary();
  return reply.send({
    success: true,
    data: stats
  });
}

