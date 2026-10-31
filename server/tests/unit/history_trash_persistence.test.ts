import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';

describe('History & Trash Persistence with Custom IDs & Tool Filtering', () => {
  let app: FastifyInstance;
  const testDeviceId = 'test-device-uuid-' + Date.now();
  const testTrackId = 'sp-test-' + Date.now();
  const testFbId = 'fb-test-' + Date.now();

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    // Cleanup test records
    await prisma.historyRecord.deleteMany({
      where: { deviceId: testDeviceId }
    }).catch(() => {});
    await app.close();
  });

  it('1. Successfully creates history records with client-provided custom IDs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/history',
      headers: {
        'x-device-id': testDeviceId
      },
      payload: {
        id: testTrackId,
        toolId: 'spotify-downloader',
        toolTitle: 'Spotify Downloader',
        fileName: 'Test Track.mp3',
        originalSize: 5000000,
        resultSize: 4500000,
        downloadUrl: `/api/v1/media/spotify/stream?id=test123`,
        detailsJson: JSON.stringify({ trackId: 'test123', artist: 'Artist Test' })
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(testTrackId);
    expect(body.data.toolId).toBe('spotify-downloader');

    // Create a Facebook record too
    const resFb = await app.inject({
      method: 'POST',
      url: '/api/v1/history',
      headers: {
        'x-device-id': testDeviceId
      },
      payload: {
        id: testFbId,
        toolId: 'facebook-downloader',
        toolTitle: 'Facebook Downloader',
        fileName: 'Test Video.mp4',
        downloadUrl: 'https://video.fbcdn.net/test.mp4'
      }
    });
    expect(resFb.statusCode).toBe(201);
    expect(resFb.json().data.id).toBe(testFbId);
  });

  it('2. getHistory returns the active items scoped by deviceId and toolId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/history?toolId=spotify`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.some((i: any) => i.id === testTrackId)).toBe(true);
    expect(body.data.items.some((i: any) => i.id === testFbId)).toBe(false);
  });

  it('3. Soft delete using custom ID marks record as isDeleted=true and moves to trash', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/history/${encodeURIComponent(testTrackId)}`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.isDeleted).toBe(true);

    // Verify item is NOT returned by getHistory
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/history`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.items.some((i: any) => i.id === testTrackId)).toBe(false);

    // Verify item IS returned by getTrashItems
    const trashRes = await app.inject({
      method: 'GET',
      url: `/api/v1/trash`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(trashRes.statusCode).toBe(200);
    expect(trashRes.json().data.items.some((i: any) => i.id === testTrackId)).toBe(true);
  });

  it('4. Restoring item from trash by custom ID works seamlessly', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/trash/${encodeURIComponent(testTrackId)}/restore`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(res.json().data.isDeleted).toBe(false);

    // Verify item is back in history
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/history`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(getRes.json().data.items.some((i: any) => i.id === testTrackId)).toBe(true);
  });

  it('5. Clear tool history to trash filters by toolId', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/history?toolId=spotify`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(res.statusCode).toBe(200);

    // Track should now be deleted, but FB video should remain active
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/history`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(getRes.json().data.items.some((i: any) => i.id === testTrackId)).toBe(false);
    expect(getRes.json().data.items.some((i: any) => i.id === testFbId)).toBe(true);
  });

  it('6. Empty trash permanently deletes items scoped by toolId', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/trash?toolId=spotify`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(res.statusCode).toBe(200);

    // Track should no longer exist even in trash
    const trashRes = await app.inject({
      method: 'GET',
      url: `/api/v1/trash`,
      headers: { 'x-device-id': testDeviceId }
    });
    expect(trashRes.json().data.items.some((i: any) => i.id === testTrackId)).toBe(false);
  });
});
