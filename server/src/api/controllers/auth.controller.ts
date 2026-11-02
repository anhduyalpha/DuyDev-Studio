import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import { BadRequestError } from '../../lib/errors.js';
import {
  appendSetCookie,
  serializeCookie,
  parseCookies,
  isRequestSecure
} from '../middleware/security.middleware.js';

const verifyPasswordSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(4, 'New password must be at least 4 characters')
});

function getClientIp(req: FastifyRequest): string {
  const cfIp = req.headers['cf-connecting-ip'] as string;
  return (cfIp || ((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()) || req.ip || '127.0.0.1').replace(/^::ffff:/, '');
}

export async function verifyPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const ip = getClientIp(request);
  const lockoutCheck = AuthService.checkLoginAllowed(ip);

  if (!lockoutCheck.allowed) {
    if (lockoutCheck.retryAfterSec) {
      reply.header('Retry-After', String(lockoutCheck.retryAfterSec));
    }
    return reply.status(429).send({
      success: false,
      error: 'TOO_MANY_FAILED_ATTEMPTS',
      message: `Bạn đã nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${lockoutCheck.retryAfterSec || 900} giây.`
    });
  }

  const parseResult = verifyPasswordSchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError('Mật khẩu không được để trống');
  }

  const { password } = parseResult.data;
  const isValid = await AuthService.verifyPassword(password);

  if (!isValid) {
    const attemptResult = AuthService.recordLoginAttempt(ip, false);
    if (!attemptResult.allowed) {
      reply.header('Retry-After', String(attemptResult.retryAfterSec || 900));
      return reply.status(429).send({
        success: false,
        error: 'TOO_MANY_FAILED_ATTEMPTS',
        message: 'Bạn đã nhập sai mật khẩu 5 lần liên tiếp. Tài khoản quản trị bị tạm khóa trong 15 phút.'
      });
    }

    return reply.status(401).send({
      success: false,
      error: 'INVALID_CREDENTIALS',
      message: `Mật khẩu quản trị không chính xác (Còn ${attemptResult.remainingAttempts} lần thử)`
    });
  }

  // Clear failed attempt record on successful login
  AuthService.recordLoginAttempt(ip, true);

  const token = AuthService.generateSessionToken();
  const secure = isRequestSecure(request);

  // Set secure HttpOnly cookie for admin session (30 days)
  appendSetCookie(
    reply,
    serializeCookie('ds_admin_session', token, {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/'
    })
  );

  return reply.send({
    success: true,
    data: {
      authenticated: true,
      token
    }
  });
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const secure = isRequestSecure(request);
  appendSetCookie(
    reply,
    serializeCookie('ds_admin_session', '', {
      maxAge: 0,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/'
    })
  );

  return reply.send({
    success: true,
    message: 'Đã đăng xuất phiên Quản trị viên thành công'
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
  const cookies = parseCookies(request.headers.cookie);
  const adminCookie = cookies['ds_admin_session'];
  const candidate = authHeader || queryToken || adminCookie;

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

