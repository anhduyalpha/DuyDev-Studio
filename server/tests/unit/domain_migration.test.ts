import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import {
  isDeprecatedDomain,
  getCanonicalDestinationUrl,
  DEPRECATED_DOMAINS,
  CANONICAL_TARGET_DOMAIN
} from '../../../src/components/common/MigrationNoticeModal.js';

describe('Domain Migration Suite (duydev.studio.alphadaniel.io.vn -> studio.duydev.cloud)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Client-Side Domain Detection & URL Resolution', () => {
    it('defines deprecated domains and canonical target correctly', () => {
      expect(DEPRECATED_DOMAINS).toContain('duydev.studio.alphadaniel.io.vn');
      expect(DEPRECATED_DOMAINS).toContain('alphadaniel.io.vn');
      expect(CANONICAL_TARGET_DOMAIN).toBe('https://studio.duydev.cloud');
    });

    it('identifies deprecated domain correctly using window.location simulation', () => {
      // Simulate deprecated host
      const origWindow = global.window;
      // @ts-ignore
      global.window = {
        location: {
          hostname: 'duydev.studio.alphadaniel.io.vn',
          pathname: '/#tool/pdf',
          search: '',
          hash: '#tool/pdf'
        }
      };

      expect(isDeprecatedDomain()).toBe(true);

      // Simulate canonical host
      // @ts-ignore
      global.window = {
        location: {
          hostname: 'studio.duydev.cloud',
          pathname: '/',
          search: '',
          hash: ''
        }
      };
      expect(isDeprecatedDomain()).toBe(false);

      // Simulate testing trigger on any host
      // @ts-ignore
      global.window = {
        location: {
          hostname: 'localhost',
          pathname: '/',
          search: '?migration=1',
          hash: ''
        }
      };
      expect(isDeprecatedDomain()).toBe(true);

      // Restore
      global.window = origWindow;
    });

    it('constructs destination URL preserving route and hash', () => {
      const origWindow = global.window;
      // @ts-ignore
      global.window = {
        location: {
          hostname: 'duydev.studio.alphadaniel.io.vn',
          pathname: '/',
          search: '?ref=bookmark&migration=1',
          hash: '#admin'
        }
      };

      const target = getCanonicalDestinationUrl();
      expect(target).toBe('https://studio.duydev.cloud/?ref=bookmark#admin');

      global.window = origWindow;
    });
  });

  describe('2. Backend Request Headers & Domain Migration Detection', () => {
    it('sets X-Domain-Migration headers when request originates from deprecated domain', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          host: 'duydev.studio.alphadaniel.io.vn'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-domain-migration']).toBe('https://studio.duydev.cloud');
      expect(response.headers['x-canonical-domain']).toBe('studio.duydev.cloud');
    });

    it('does NOT set X-Domain-Migration headers on canonical domain', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          host: 'studio.duydev.cloud'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-domain-migration']).toBeUndefined();
      expect(response.headers['x-canonical-domain']).toBeUndefined();
    });
  });

  describe('3. PWA Cache Version Synchronization (v22.47)', () => {
    it('synchronizes v22.47 across sw.js, pwa.js and index.html', () => {
      const projectRoot = path.resolve(__dirname, '../../../');
      const swContent = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf-8');
      const pwaContent = fs.readFileSync(path.join(projectRoot, 'src/utilities/pwa.js'), 'utf-8');
      const indexContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');

      expect(swContent).toContain("CACHE_NAME = 'duydev-studio-v22.47'");
      expect(swContent).toContain("MigrationNoticeModal.js");
      expect(pwaContent).toContain("CURRENT_PWA_VERSION = 'duydev-studio-v22.47'");
      expect(indexContent).toContain("stitch-tokens.css?v=22.47");
      expect(indexContent).toContain("app.js?v=22.47");
    });
  });
});
