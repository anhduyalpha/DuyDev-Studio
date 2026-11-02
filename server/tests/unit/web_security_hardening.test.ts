/**
 * web_security_hardening.test.ts - Enterprise Defense-in-Depth Security Suite
 * Tests cookie HMAC signatures, login brute-force rate limiter,
 * SSRF URL validator, CSRF tokens, and origin gatekeeping.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service.js';
import {
  parseCookies,
  serializeCookie,
  validateSafeMediaUrl,
  isAllowedOrigin
} from '../../src/api/middleware/security.middleware.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Web Security Hardening Suite', () => {
  describe('Visitor Cookie HMAC Signing & Verification', () => {
    it('generates a signed cookie that verifies successfully', () => {
      const deviceId = 'dev_test_device_12345';
      const { sessionCookie, csrfToken, deviceId: returnedId } = AuthService.generateVisitorCookie(deviceId);

      expect(returnedId).toBe(deviceId);
      expect(typeof csrfToken).toBe('string');
      expect(sessionCookie).toContain('.');
      const parts = sessionCookie.split('.');
      expect(parts.length).toBe(3);

      const result = AuthService.verifyVisitorCookie(sessionCookie);
      expect(result.valid).toBe(true);
      expect(result.deviceId).toBe(deviceId);
    });

    it('rejects tampered cookie payload or signature', () => {
      const { sessionCookie } = AuthService.generateVisitorCookie('dev_real_user');
      const parts = sessionCookie.split('.');

      // Tamper signature
      const tamperedSig = `${parts[0]}.${parts[1]}.fake_signature_abc123`;
      expect(AuthService.verifyVisitorCookie(tamperedSig).valid).toBe(false);

      // Tamper payload
      const tamperedPayload = `tampered_payload.${parts[1]}.${parts[2]}`;
      expect(AuthService.verifyVisitorCookie(tamperedPayload).valid).toBe(false);

      // Malformed cookie
      expect(AuthService.verifyVisitorCookie('no_dot_here').valid).toBe(false);
      expect(AuthService.verifyVisitorCookie('').valid).toBe(false);
    });
  });

  describe('CSRF Token Generation & Verification', () => {
    it('generates a deterministic HMAC token matching the device ID', () => {
      const deviceId = 'dev_browser_client_999';
      const token = AuthService.generateCsrfToken(deviceId);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
      expect(AuthService.verifyCsrfToken(token, deviceId)).toBe(true);
      expect(AuthService.verifyCsrfToken(token, 'dev_different_device')).toBe(false);
      expect(AuthService.verifyCsrfToken('invalid_token', deviceId)).toBe(false);
    });
  });

  describe('Admin Login Brute-Force Rate Limiter', () => {
    const testIp = '198.51.100.42';

    beforeEach(() => {
      AuthService.resetLoginLockout(testIp);
    });

    it('allows attempts initially and locks out after 5 consecutive failures', () => {
      expect(AuthService.checkLoginAllowed(testIp).allowed).toBe(true);

      // Fail 4 times
      for (let i = 1; i <= 4; i++) {
        AuthService.recordLoginAttempt(testIp, false);
        const check = AuthService.checkLoginAllowed(testIp);
        expect(check.allowed).toBe(true);
      }

      // 5th failure triggers lockout
      AuthService.recordLoginAttempt(testIp, false);
      const lockedCheck = AuthService.checkLoginAllowed(testIp);
      expect(lockedCheck.allowed).toBe(false);
      expect(lockedCheck.retryAfterSec).toBeGreaterThan(0);
      expect(lockedCheck.retryAfterSec).toBeLessThanOrEqual(900);
    });

    it('resets failure counter upon successful login', () => {
      AuthService.recordLoginAttempt(testIp, false);
      AuthService.recordLoginAttempt(testIp, false);
      expect(AuthService.checkLoginAllowed(testIp).allowed).toBe(true);

      // Successful login resets
      AuthService.recordLoginAttempt(testIp, true);
      // Can fail again without locking out immediately
      for (let i = 1; i <= 4; i++) {
        AuthService.recordLoginAttempt(testIp, false);
      }
      expect(AuthService.checkLoginAllowed(testIp).allowed).toBe(true);
    });
  });

  describe('SSRF Protection (validateSafeMediaUrl)', () => {
    const allowedDomains = ['fbcdn.net', 'facebook.com', 'fbsbx.com'];

    it('allows valid CDN URLs on whitelisted domains', () => {
      expect(() => {
        validateSafeMediaUrl('https://scontent.fhan2-3.fna.fbcdn.net/v/t39.30808-6/video.mp4', allowedDomains);
      }).not.toThrow();

      expect(() => {
        validateSafeMediaUrl('https://video.facebook.com/reel/12345.mp4', allowedDomains);
      }).not.toThrow();
    });

    it('blocks loopback and private IP SSRF targets', () => {
      // Localhost
      expect(() => validateSafeMediaUrl('http://localhost:3000/secret', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('http://127.0.0.1:8080/data', allowedDomains)).toThrow(BadRequestError);

      // Private LAN
      expect(() => validateSafeMediaUrl('http://192.168.1.1/admin', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('http://10.0.0.1/status', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('http://172.16.0.5/api', allowedDomains)).toThrow(BadRequestError);

      // AWS/Cloud Metadata IP
      expect(() => validateSafeMediaUrl('http://169.254.169.254/latest/meta-data/', allowedDomains)).toThrow(BadRequestError);
    });

    it('blocks non-whitelisted foreign domains', () => {
      expect(() => validateSafeMediaUrl('https://evil-attacker.com/malicious.mp4', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('https://google.com', allowedDomains)).toThrow(BadRequestError);
    });

    it('blocks non-HTTP protocols', () => {
      expect(() => validateSafeMediaUrl('file:///etc/passwd', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('ftp://example.com/file', allowedDomains)).toThrow(BadRequestError);
      expect(() => validateSafeMediaUrl('gopher://127.0.0.1/', allowedDomains)).toThrow(BadRequestError);
    });
  });

  describe('Origin Whitelisting & Cookie Serialization', () => {
    it('verifies allowed origins and rejects foreign ones', () => {
      expect(isAllowedOrigin('https://studio.duydev.cloud')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true);
      expect(isAllowedOrigin('http://192.168.2.171:3000')).toBe(true);

      expect(isAllowedOrigin('https://malicious-phishing.com')).toBe(false);
      expect(isAllowedOrigin('https://facebook.com')).toBe(false);
      expect(isAllowedOrigin('null')).toBe(false);
      expect(isAllowedOrigin(null)).toBe(false);
    });

    it('parses cookies accurately', () => {
      const header = 'ds_session=abc.123; ds_csrf=token_xyz; ds_device_id=dev_1';
      const parsed = parseCookies(header);
      expect(parsed.ds_session).toBe('abc.123');
      expect(parsed.ds_csrf).toBe('token_xyz');
      expect(parsed.ds_device_id).toBe('dev_1');
    });

    it('serializes cookies with security attributes', () => {
      const cookie = serializeCookie('ds_test', 'val123', {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 3600,
        path: '/'
      });
      expect(cookie).toContain('ds_test=val123');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=3600');
    });
  });
});
