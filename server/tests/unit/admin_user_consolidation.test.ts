import { describe, it, expect, beforeEach } from 'vitest';
import { VisitorSessionManager } from '../../src/api/middleware/telemetry.middleware.js';
import { deviceRegistryService } from '../../src/services/device-registry.service.js';

describe('Admin User & Device Consolidation', () => {
  beforeEach(() => {
    VisitorSessionManager.clearSessions();
    VisitorSessionManager.clearEvents();

    // Reset device registry by clearing devices map
    const devices = (deviceRegistryService as any).devices;
    if (devices && typeof devices.clear === 'function') {
      devices.clear();
    }
  });

  it('should consolidate multiple owner devices into a single owner user card', () => {
    // Register 3 owner devices
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_owner_pc',
      isOwner: true,
      lastIp: '192.168.2.10',
      deviceSummary: 'Windows / Chrome',
      userAgent: 'Chrome on Win10',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_owner_mac',
      isOwner: true,
      lastIp: '192.168.2.11',
      deviceSummary: 'Mac / Safari',
      userAgent: 'Safari on macOS',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_owner_phone',
      isOwner: true,
      lastIp: '192.168.2.12',
      deviceSummary: 'Android / Chrome',
      userAgent: 'Chrome on Android',
      country: 'VN'
    });

    // Register active session for phone
    VisitorSessionManager.registerEnter({
      sessionId: 'sess_owner_phone',
      deviceId: 'dev_owner_phone',
      ip: '192.168.2.12',
      userAgent: 'Chrome on Android',
      entryRoute: '#dashboard',
      deviceSummary: 'Android / Chrome',
      country: 'VN'
    });

    const aggregated = VisitorSessionManager.getAggregatedDevices();

    // Must be exactly 1 consolidated card for Owner
    expect(aggregated.stats.totalDevices).toBe(3);
    expect(aggregated.stats.totalUsers).toBe(1);
    expect(aggregated.devices.length).toBe(1);

    const ownerCard = aggregated.devices[0];
    expect(ownerCard.isOwner).toBe(true);
    expect(ownerCard.userId).toBe('owner:duy');
    expect(ownerCard.devicesCount).toBe(3);
    expect(ownerCard.devices.length).toBe(3);
    expect(ownerCard.status).toBe('ONLINE'); // Because phone is online
    expect(ownerCard.alias).toBe('Máy của Duy');
  });

  it('should consolidate devices sharing the same custom alias into a single user card', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_alex_work',
      alias: 'Alex Rider',
      isOwner: false,
      lastIp: '42.112.1.1',
      deviceSummary: 'Windows / Edge',
      userAgent: 'Edge on Windows',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_alex_mobile',
      alias: 'Alex Rider',
      isOwner: false,
      lastIp: '42.112.1.2',
      deviceSummary: 'iPhone / Safari',
      userAgent: 'Safari on iOS',
      country: 'VN'
    });

    const aggregated = VisitorSessionManager.getAggregatedDevices();
    expect(aggregated.devices.length).toBe(1);

    const userCard = aggregated.devices[0];
    expect(userCard.userId).toBe('alias:alex rider');
    expect(userCard.alias).toBe('Alex Rider');
    expect(userCard.devicesCount).toBe(2);
    expect(userCard.devices.map(d => d.deviceId)).toContain('dev_alex_work');
    expect(userCard.devices.map(d => d.deviceId)).toContain('dev_alex_mobile');
  });

  it('should keep anonymous guest devices partitioned per deviceId', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_guest_alpha',
      isOwner: false,
      lastIp: '14.241.10.1',
      deviceSummary: 'Linux / Firefox',
      userAgent: 'Firefox on Ubuntu',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_guest_beta',
      isOwner: false,
      lastIp: '113.161.5.2',
      deviceSummary: 'Android / Chrome',
      userAgent: 'Chrome on Android',
      country: 'VN'
    });

    const aggregated = VisitorSessionManager.getAggregatedDevices();
    expect(aggregated.devices.length).toBe(2);

    const devIds = aggregated.devices.map(d => d.deviceId);
    expect(devIds).toContain('dev_guest_alpha');
    expect(devIds).toContain('dev_guest_beta');
    expect(aggregated.devices.every(d => d.devicesCount === 1)).toBe(true);
  });

  it('should prune duplicate devices for the same user, keeping latest 2', () => {
    // Add 4 devices for user
    const now = Date.now();
    for (let i = 1; i <= 4; i++) {
      deviceRegistryService.upsertDevice({
        deviceId: `dev_multi_${i}`,
        alias: 'Bob',
        isOwner: false,
        lastIp: `10.0.0.${i}`,
        deviceSummary: `Device ${i}`,
        userAgent: `UA ${i}`,
        country: 'VN'
      });
      // Stagger lastSeenAt
      const dev = deviceRegistryService.getDevice(`dev_multi_${i}`);
      if (dev) {
        dev.lastSeenAt = new Date(now + i * 1000).toISOString();
      }
    }

    expect(deviceRegistryService.listDevices().length).toBe(4);

    const prunedCount = deviceRegistryService.pruneDuplicateDevices(2);
    expect(prunedCount).toBe(2);

    const remaining = deviceRegistryService.listDevices();
    expect(remaining.length).toBe(2);
    // Should keep latest active (dev_multi_3 and dev_multi_4)
    expect(remaining.map(d => d.deviceId)).toContain('dev_multi_3');
    expect(remaining.map(d => d.deviceId)).toContain('dev_multi_4');
  });

  it('should delete a single device and remove its active sessions', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_to_delete',
      alias: 'Temp Device',
      isOwner: false,
      lastIp: '1.2.3.4',
      deviceSummary: 'Temp',
      userAgent: 'Temp',
      country: 'VN'
    });

    VisitorSessionManager.registerEnter({
      sessionId: 'sess_temp',
      deviceId: 'dev_to_delete',
      ip: '1.2.3.4',
      userAgent: 'Temp',
      entryRoute: '#dashboard',
      country: 'VN'
    });

    expect(deviceRegistryService.getDevice('dev_to_delete')).toBeDefined();
    expect(VisitorSessionManager.getAllSessions().some(s => s.deviceId === 'dev_to_delete')).toBe(true);

    const deleted = deviceRegistryService.deleteDevice('dev_to_delete');
    expect(deleted).toBe(true);
    VisitorSessionManager.removeDeviceSessions('dev_to_delete');

    expect(deviceRegistryService.getDevice('dev_to_delete')).toBeUndefined();
    expect(VisitorSessionManager.getAllSessions().some(s => s.deviceId === 'dev_to_delete')).toBe(false);
  });

  it('should delete all devices belonging to a user identifier', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_charlie_1',
      alias: 'Charlie',
      isOwner: false,
      lastIp: '5.5.5.1',
      deviceSummary: 'PC',
      userAgent: 'PC',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_charlie_2',
      alias: 'Charlie',
      isOwner: false,
      lastIp: '5.5.5.2',
      deviceSummary: 'Tablet',
      userAgent: 'Tablet',
      country: 'VN'
    });

    const deletedCount = deviceRegistryService.deleteUserDevices('alias:charlie');
    expect(deletedCount).toBe(2);
    expect(deviceRegistryService.getDevice('dev_charlie_1')).toBeUndefined();
    expect(deviceRegistryService.getDevice('dev_charlie_2')).toBeUndefined();
  });

  it('should propagate alias updates across sibling devices of the same user', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_sib_1',
      alias: 'Original Name',
      isOwner: false,
      lastIp: '7.7.7.1',
      deviceSummary: 'D1',
      userAgent: 'D1',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_sib_2',
      alias: 'Original Name',
      isOwner: false,
      lastIp: '7.7.7.2',
      deviceSummary: 'D2',
      userAgent: 'D2',
      country: 'VN'
    });

    deviceRegistryService.setAlias('dev_sib_1', 'New Brand Name');

    expect(deviceRegistryService.getDevice('dev_sib_1')?.alias).toBe('New Brand Name');
    expect(deviceRegistryService.getDevice('dev_sib_2')?.alias).toBe('New Brand Name');
  });

  it('should purge all anonymous guest devices while preserving owners and named users', () => {
    // 1. Owner device (no alias)
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_owner_preserve',
      isOwner: true,
      lastIp: '192.168.2.1',
      deviceSummary: 'Owner PC',
      userAgent: 'Chrome',
      country: 'VN'
    });

    // 2. Named user
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_named_preserve',
      alias: 'Hải Nam',
      isOwner: false,
      lastIp: '115.76.93.10',
      deviceSummary: 'Windows / Chrome',
      userAgent: 'Chrome',
      country: 'VN'
    });

    // 3. Guest device 1 (no alias, not owner)
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_guest_1',
      isOwner: false,
      lastIp: '14.254.28.12',
      deviceSummary: 'iOS Safari',
      userAgent: 'Safari',
      country: 'VN'
    });

    // 4. Guest device 2 (empty whitespace alias, not owner)
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_guest_2',
      alias: '   ',
      isOwner: false,
      lastIp: '115.73.237.190',
      deviceSummary: 'iPhone',
      userAgent: 'Safari',
      country: 'VN'
    });

    // Register active sessions
    VisitorSessionManager.registerEnter({
      sessionId: 'sess_guest_1',
      deviceId: 'dev_guest_1',
      ip: '14.254.28.12',
      userAgent: 'Safari',
      entryRoute: '#dashboard',
      deviceSummary: 'iOS Safari',
      country: 'VN'
    });

    const result = deviceRegistryService.purgeAllGuestDevices();
    expect(result.purgedCount).toBe(2);
    expect(result.purgedDeviceIds).toContain('dev_guest_1');
    expect(result.purgedDeviceIds).toContain('dev_guest_2');

    // Clean active sessions like controller does
    result.purgedDeviceIds.forEach(id => VisitorSessionManager.removeDeviceSessions(id));

    // Verify preservation
    expect(deviceRegistryService.getDevice('dev_owner_preserve')).toBeDefined();
    expect(deviceRegistryService.getDevice('dev_named_preserve')).toBeDefined();
    expect(deviceRegistryService.getDevice('dev_guest_1')).toBeUndefined();
    expect(deviceRegistryService.getDevice('dev_guest_2')).toBeUndefined();
  });

  it('should batch block and unblock multiple users across different identifier formats', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_batch_1',
      alias: 'User One',
      isOwner: false,
      lastIp: '1.1.1.1',
      deviceSummary: 'PC',
      userAgent: 'Chrome',
      country: 'VN'
    });

    deviceRegistryService.upsertDevice({
      deviceId: 'dev_batch_guest',
      isOwner: false,
      lastIp: '2.2.2.2',
      deviceSummary: 'Phone',
      userAgent: 'Safari',
      country: 'VN'
    });

    // Batch block both: one with alias: format, one with guest: format
    const blockedCount = deviceRegistryService.batchToggleBlock(['alias:user one', 'guest:dev_batch_guest'], true);
    expect(blockedCount).toBe(2);
    expect(deviceRegistryService.getDevice('dev_batch_1')?.isBlocked).toBe(true);
    expect(deviceRegistryService.getDevice('dev_batch_guest')?.isBlocked).toBe(true);

    // Batch unblock
    const unblockedCount = deviceRegistryService.batchToggleBlock(['alias:user one', 'guest:dev_batch_guest'], false);
    expect(unblockedCount).toBe(2);
    expect(deviceRegistryService.getDevice('dev_batch_1')?.isBlocked).toBe(false);
    expect(deviceRegistryService.getDevice('dev_batch_guest')?.isBlocked).toBe(false);
  });

  it('should batch delete multiple users and their associated devices', () => {
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_del_a1',
      alias: 'Group A',
      isOwner: false,
      lastIp: '1.1.1.1',
      deviceSummary: 'PC',
      userAgent: 'Chrome',
      country: 'VN'
    });
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_del_a2',
      alias: 'Group A',
      isOwner: false,
      lastIp: '1.1.1.2',
      deviceSummary: 'Phone',
      userAgent: 'Chrome',
      country: 'VN'
    });
    deviceRegistryService.upsertDevice({
      deviceId: 'dev_del_guest',
      isOwner: false,
      lastIp: '3.3.3.3',
      deviceSummary: 'Guest',
      userAgent: 'Safari',
      country: 'VN'
    });

    const result = deviceRegistryService.batchDeleteUsers(['alias:group a', 'guest:dev_del_guest']);
    expect(result.deletedUsers).toBe(2);
    expect(result.deletedCount).toBe(3);
    expect(deviceRegistryService.getDevice('dev_del_a1')).toBeUndefined();
    expect(deviceRegistryService.getDevice('dev_del_a2')).toBeUndefined();
    expect(deviceRegistryService.getDevice('dev_del_guest')).toBeUndefined();
  });
});
