import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { ipAccessService } from '../../src/services/ip-access.service.js';
import { adminUsersService } from '../../src/services/admin-users.service.js';
import { AuthService } from '../../src/services/auth.service.js';
import { prisma } from '../../src/lib/prisma.js';

describe('Admin User Accounts & IP Access Rules Service Tests', () => {
  let app: FastifyInstance;
  let adminToken: string;
  const TEST_IP = '198.51.100.99';
  const TEST_USERNAME = `test_user_${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    adminToken = AuthService.generateSessionToken();
  });

  afterAll(async () => {
    // Cleanup test artifacts
    await ipAccessService.deleteRule(TEST_IP).catch(() => null);
    await prisma.user.deleteMany({ where: { username: { startsWith: 'test_user_' } } }).catch(() => null);
    await app.close();
  });

  describe('IP Access Control & Rate Limiting Engine', () => {
    it('should default to allowed (200) for unconfigured IPs', () => {
      const result = ipAccessService.checkAccess(TEST_IP);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
    });

    it('should block an IP when rule status is "blocked" (403)', async () => {
      await ipAccessService.upsertRule(TEST_IP, {
        alias: 'Test Malicious Bot',
        note: 'Blocking for security audit',
        status: 'blocked'
      });

      const check = ipAccessService.checkAccess(TEST_IP);
      expect(check.allowed).toBe(false);
      expect(check.status).toBe(403);
      expect(check.reason).toContain('chặn truy cập');
    });

    it('should toggle block status cleanly back to active', async () => {
      const unblocked = await ipAccessService.toggleBlock(TEST_IP);
      expect(unblocked.status).toBe('active');

      const check = ipAccessService.checkAccess(TEST_IP);
      expect(check.allowed).toBe(true);
      expect(check.status).toBe(200);
    });

    it('should enforce custom RPM rate limiting (429)', async () => {
      // Set rate limit of 3 req/minute
      await ipAccessService.setRateLimit(TEST_IP, 3);

      ipAccessService.resetIpStats(TEST_IP);

      // Hit 1: allowed
      expect(ipAccessService.checkAccess(TEST_IP).allowed).toBe(true);
      ipAccessService.recordHit(TEST_IP);

      // Hit 2: allowed
      expect(ipAccessService.checkAccess(TEST_IP).allowed).toBe(true);
      ipAccessService.recordHit(TEST_IP);

      // Hit 3: allowed
      expect(ipAccessService.checkAccess(TEST_IP).allowed).toBe(true);
      ipAccessService.recordHit(TEST_IP);

      // Hit 4: blocked with 429
      const check4 = ipAccessService.checkAccess(TEST_IP);
      expect(check4.allowed).toBe(false);
      expect(check4.status).toBe(429);
      expect(check4.reason).toContain('giới hạn tần suất');
    });

    it('should allow whitelisted IP to bypass rate limits', async () => {
      await ipAccessService.upsertRule(TEST_IP, {
        status: 'whitelisted',
        rateLimitRpm: 3
      });

      const check = ipAccessService.checkAccess(TEST_IP);
      expect(check.allowed).toBe(true);
      expect(check.status).toBe(200);
    });

    it('should delete rule and reset IP back to default', async () => {
      const deleted = await ipAccessService.deleteRule(TEST_IP);
      expect(deleted).toBe(true);
      expect(ipAccessService.checkAccess(TEST_IP).allowed).toBe(true);
    });
  });

  describe('User Accounts Management (Prisma User)', () => {
    let createdUserId: string;

    it('should create a new user account with hashed password and role', async () => {
      const user = await adminUsersService.createUser({
        username: TEST_USERNAME,
        password: 'password123',
        role: 'user',
        rateLimitRpm: 60,
        notes: 'Test QA Account',
        generateApiKey: true
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe(TEST_USERNAME);
      expect(user.role).toBe('user');
      expect(user.status).toBe('active');
      expect(user.rateLimitRpm).toBe(60);
      expect(user.notes).toBe('Test QA Account');
      expect(user.hasApiKey).toBe(true);
      expect(user.apiKeyPreview).toBeDefined();

      createdUserId = user.id;
    });

    it('should list all users including the new user', async () => {
      const list = await adminUsersService.listUsers();
      const found = list.find(u => u.id === createdUserId);
      expect(found).toBeDefined();
      expect(found?.username).toBe(TEST_USERNAME);
    });

    it('should update user fields (role, rateLimit, status, notes)', async () => {
      const updated = await adminUsersService.updateUser(createdUserId, {
        role: 'admin',
        status: 'blocked',
        rateLimitRpm: 120,
        notes: 'Promoted to admin'
      });

      expect(updated.role).toBe('admin');
      expect(updated.status).toBe('blocked');
      expect(updated.rateLimitRpm).toBe(120);
      expect(updated.notes).toBe('Promoted to admin');
    });

    it('should regenerate API key for the user', async () => {
      const { apiKey } = await adminUsersService.resetApiKey(createdUserId);
      expect(apiKey).toBeDefined();
      expect(apiKey.startsWith('ds_')).toBe(true);
    });

    it('should delete user cleanly', async () => {
      const deleted = await adminUsersService.deleteUser(createdUserId);
      expect(deleted).toBe(true);

      const list = await adminUsersService.listUsers();
      expect(list.find(u => u.id === createdUserId)).toBeUndefined();
    });
  });

  describe('Fastify Admin Endpoints Integration', () => {
    it('GET /api/v1/admin/users should require auth guard', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users'
      });
      expect(res.statusCode).toBe(401);
    });

    it('GET /api/v1/admin/users with token should return 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users',
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('POST /api/v1/admin/traffic/rules should upsert an IP rule', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/traffic/rules',
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          ip: '203.0.113.50',
          alias: 'Endpoint Test IP',
          status: 'rate_limited',
          rateLimitRpm: 45
        }
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.ip).toBe('203.0.113.50');
      expect(json.data.rateLimitRpm).toBe(45);

      // Cleanup
      await ipAccessService.deleteRule('203.0.113.50');
    });
  });
});
