import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { AuthService } from '../../src/services/auth.service.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { toolLayoutService, DEFAULT_TOOL_LAYOUT } from '../../src/services/tool-layout.service.js';

describe('ToolLayoutService & Admin Tool Manager Suite', () => {
  const baseDir = process.cwd().endsWith('server') ? process.cwd() : path.join(process.cwd(), 'server');
  const rootDir = path.resolve(__dirname, '../../..');
  const configPath = path.join(baseDir, 'data', 'tool_layout_config.json');

  let app: FastifyInstance;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    adminToken = AuthService.generateSessionToken();
  });

  afterAll(async () => {
    await closeTaskQueue();
    await app.close();
  });

  beforeEach(async () => {
    await toolLayoutService.resetLayout();
  });

  afterEach(async () => {
    await toolLayoutService.resetLayout();
  });

  it('1. Returns default layout when no override config exists', async () => {
    const layout = await toolLayoutService.getLayout();
    expect(layout.items.length).toBe(DEFAULT_TOOL_LAYOUT.length);
    expect(layout.items[0].id).toBe('pdf-studio');
    expect(layout.items.find(t => t.id === 'view-split')?.category).toBe('advanced');
  });

  it('2. Updates tool category and custom order, persisting to disk', async () => {
    const customItems = [
      { id: 'view-split', category: 'system', order: 1 },
      { id: 'pdf-studio', category: 'pdf', order: 2 }
    ];

    const updated = await toolLayoutService.updateLayout(customItems as any);
    expect(updated.items[0].id).toBe('view-split');
    expect(updated.items[0].category).toBe('system');
    expect(updated.items[0].order).toBe(1);

    // Verify disk persistence
    expect(fs.existsSync(configPath)).toBe(true);

    // Verify getLayout loads the saved items
    const reloaded = await toolLayoutService.getLayout();
    expect(reloaded.items[0].id).toBe('view-split');
    expect(reloaded.items[0].category).toBe('system');

    // Ensure all 15 tools are preserved (no data loss)
    expect(reloaded.items.length).toBe(DEFAULT_TOOL_LAYOUT.length);
  });

  it('3. Safely sanitizes invalid category by falling back', async () => {
    const customItems = [
      { id: 'storage', category: 'invalid-cat', order: 1 }
    ];

    const updated = await toolLayoutService.updateLayout(customItems as any);
    const storageItem = updated.items.find(t => t.id === 'storage');
    expect(storageItem).toBeDefined();
    // Falls back to default category 'advanced'
    expect(storageItem?.category).toBe('advanced');
  });

  it('4. Resets layout back to system defaults cleanly', async () => {
    await toolLayoutService.updateLayout([
      { id: 'view-split', category: 'system', order: 1 }
    ] as any);

    expect(fs.existsSync(configPath)).toBe(true);

    const resetResult = await toolLayoutService.resetLayout();
    expect(resetResult.items[0].id).toBe('pdf-studio');
    expect(fs.existsSync(configPath)).toBe(false);
  });

  it('5. Public endpoint GET /api/v1/system/tool-layout returns layout without auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/system/tool-layout'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBe(DEFAULT_TOOL_LAYOUT.length);
  });

  it('6. Admin endpoint rejects unauthenticated requests', async () => {
    const resGet = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/tool-layout'
    });
    expect(resGet.statusCode).toBe(401);

    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/tool-layout',
      payload: { items: [{ id: 'view-split', category: 'system' }] }
    });
    expect(resPut.statusCode).toBe(401);

    const resReset = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/tool-layout/reset'
    });
    expect(resReset.statusCode).toBe(401);
  });

  it('7. Admin endpoints allow authenticated updates and reset', async () => {
    // 1. Update layout
    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/tool-layout',
      headers: {
        'x-storage-auth': adminToken
      },
      payload: {
        items: [
          { id: 'view-split', category: 'system', order: 1 },
          { id: 'hash-checksum', category: 'pdf', order: 2 }
        ]
      }
    });

    expect(resPut.statusCode).toBe(200);
    const bodyPut = JSON.parse(resPut.payload);
    expect(bodyPut.success).toBe(true);
    expect(bodyPut.data.items[0].id).toBe('view-split');
    expect(bodyPut.data.items[0].category).toBe('system');
    expect(bodyPut.data.items[1].id).toBe('hash-checksum');
    expect(bodyPut.data.items[1].category).toBe('pdf');

    // 2. GET admin tool layout
    const resGet = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/tool-layout',
      headers: {
        'x-storage-auth': adminToken
      }
    });

    expect(resGet.statusCode).toBe(200);
    const bodyGet = JSON.parse(resGet.payload);
    expect(bodyGet.data.items[0].id).toBe('view-split');

    // 3. Reset layout
    const resReset = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/tool-layout/reset',
      headers: {
        'x-storage-auth': adminToken
      }
    });

    expect(resReset.statusCode).toBe(200);
    const bodyReset = JSON.parse(resReset.payload);
    expect(bodyReset.success).toBe(true);
    expect(bodyReset.data.items[0].id).toBe('pdf-studio');
  });

  it('8. Verifies AdminPage.js and AdminToolCardManager.js integration integrity', () => {
    const adminPagePath = path.join(rootDir, 'src/pages/AdminPage.js');
    const adminContent = fs.readFileSync(adminPagePath, 'utf-8');

    expect(adminContent).toContain('adminTabToolManager');
    expect(adminContent).toContain('adminToolManagerViewContainer');
    expect(adminContent).toContain('renderAdminToolCardManager');
    expect(adminContent).toContain('attachAdminToolCardManagerListeners');

    const componentPath = path.join(rootDir, 'src/components/admin/AdminToolCardManager.js');
    expect(fs.existsSync(componentPath)).toBe(true);
    const compContent = fs.readFileSync(componentPath, 'utf-8');
    expect(compContent).toContain('renderAdminToolCardManager');
    expect(compContent).toContain('attachAdminToolCardManagerListeners');
    expect(compContent).toContain('btnSaveToolLayout');
    expect(compContent).toContain('btnResetToolLayout');
    expect(compContent).toContain('btnOpenAddTab');
    expect(compContent).toContain('btnSubmitNewTab');
    expect(compContent).toContain('inputNewTabColor');
  });

  it('9. Supports custom tabs creation, dot color selection, and card assignment', async () => {
    const customCategories = [
      { id: 'media-lab', label: 'Media Lab', color: '#EC4899' },
      { id: 'pdf', label: 'PDF Custom', color: '#F59E0B' }
    ];

    const customItems = [
      { id: 'tiktok-downloader', category: 'media-lab', order: 1 },
      { id: 'pdf-studio', category: 'pdf', order: 2 }
    ];

    const resPut = await app.inject({
      method: 'PUT',
      url: '/api/v1/admin/tool-layout',
      headers: {
        'x-storage-auth': adminToken
      },
      payload: {
        items: customItems,
        categories: customCategories
      }
    });

    expect(resPut.statusCode).toBe(200);
    const body = JSON.parse(resPut.payload);
    expect(body.success).toBe(true);
    expect(body.data.items[0].id).toBe('tiktok-downloader');
    expect(body.data.items[0].category).toBe('media-lab');

    // Verify custom tab exists and default tabs are preserved
    const mediaLab = body.data.categories.find((c: any) => c.id === 'media-lab');
    expect(mediaLab).toBeDefined();
    expect(mediaLab.label).toBe('Media Lab');
    expect(mediaLab.color).toBe('#EC4899');

    // Verify disk persistence
    const reloaded = await toolLayoutService.getLayout();
    expect(reloaded.categories.some(c => c.id === 'media-lab')).toBe(true);
    expect(reloaded.items.find(i => i.id === 'tiktok-downloader')?.category).toBe('media-lab');

    // Verify public endpoint returns the new tab & dot color
    const resPublic = await app.inject({
      method: 'GET',
      url: '/api/v1/system/tool-layout'
    });
    expect(resPublic.statusCode).toBe(200);
    const pubBody = JSON.parse(resPublic.payload);
    expect(pubBody.data.categories.some((c: any) => c.id === 'media-lab')).toBe(true);
  });
});
