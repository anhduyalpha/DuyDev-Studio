import { describe, it, expect } from 'vitest';
import { AuthService } from '../../src/services/auth.service.js';

describe('Admin Authentication & Highway Guard Service', () => {
  const EXPECTED_ANHDUY_HASH = 'a40c326dd366739719ecbb8380f0534093cf6916b9b63114a71e885d20692ccc';

  it('correctly hashes anhduy123 with SHA-256', () => {
    const hash = AuthService.sha256('anhduy123');
    expect(hash).toBe(EXPECTED_ANHDUY_HASH);
  });

  it('accepts anhduy123 as the primary admin password', async () => {
    const isValid = await AuthService.verifyPassword('anhduy123');
    expect(isValid).toBe(true);
  });

  it('accepts legacy fallback passwords duydev and admin when no custom hash file is set', async () => {
    const isDuyDev = await AuthService.verifyPassword('duydev');
    const isAdmin = await AuthService.verifyPassword('admin');
    expect(isDuyDev).toBe(true);
    expect(isAdmin).toBe(true);
  });

  it('rejects incorrect passwords or invalid inputs', async () => {
    expect(await AuthService.verifyPassword('wrongpass')).toBe(false);
    expect(await AuthService.verifyPassword('123456')).toBe(false);
    expect(await AuthService.verifyPassword('')).toBe(false);
    // @ts-expect-error test invalid type
    expect(await AuthService.verifyPassword(null)).toBe(false);
    // @ts-expect-error test invalid type
    expect(await AuthService.verifyPassword(undefined)).toBe(false);
  });

  it('generates valid stateless HMAC session tokens', () => {
    const token = AuthService.generateSessionToken();
    expect(token).toBeDefined();
    expect(token.includes('.')).toBe(true);

    const isValid = AuthService.validateToken(token);
    expect(isValid).toBe(true);

    const isBearerValid = AuthService.validateToken(`Bearer ${token}`);
    expect(isBearerValid).toBe(true);
  });

  it('rejects tampered, corrupted or expired tokens', () => {
    expect(AuthService.validateToken('invalid.token')).toBe(false);
    expect(AuthService.validateToken('123456')).toBe(false);
    expect(AuthService.validateToken('')).toBe(false);
    expect(AuthService.validateToken(undefined)).toBe(false);

    // Tampered payload
    const token = AuthService.generateSessionToken();
    const [exp, sig] = token.split('.');
    const tamperedExp = `${Number(exp) + 1000}.${sig}`;
    expect(AuthService.validateToken(tamperedExp)).toBe(false);

    // Expired timestamp
    const expiredTimestamp = Date.now() - 10000;
    const expiredToken = `${expiredTimestamp}.${sig}`;
    expect(AuthService.validateToken(expiredToken)).toBe(false);
  });
});
