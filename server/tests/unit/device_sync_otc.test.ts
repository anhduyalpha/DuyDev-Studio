/**
 * device_sync_otc.test.ts - Multi-Device One-Time Code Synchronization Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { deviceRegistryService } from '../../src/services/device-registry.service.js';

describe('DeviceRegistryService - One-Time Code Synchronization', () => {
  const devA = 'dev_test_alpha_11111';
  const devB = 'dev_test_beta_22222';
  const devC = 'dev_test_gamma_33333';

  beforeEach(() => {
    // Unlink test devices before each test
    deviceRegistryService.unlinkDevice(devA);
    deviceRegistryService.unlinkDevice(devB);
    deviceRegistryService.unlinkDevice(devC);
  });

  it('generates a 6-digit numeric one-time code with 300s TTL', () => {
    const res = deviceRegistryService.generateSyncCode(devA);
    expect(res.code).toMatch(/^\d{6}$/);
    expect(res.expiresInSec).toBe(300);

    const status = deviceRegistryService.getSyncStatus(devA);
    expect(status.activeCode?.code).toBe(res.code);
    expect(status.isLinked).toBe(false);
  });

  it('prevents self-redemption when redeeming code on the same device', () => {
    const res = deviceRegistryService.generateSyncCode(devA);
    const redeemRes = deviceRegistryService.redeemSyncCode(devA, res.code);

    expect(redeemRes.success).toBe(false);
    expect(redeemRes.message).toContain('chính thiết bị này');
  });

  it('rejects invalid or non-6-digit codes', () => {
    const res = deviceRegistryService.redeemSyncCode(devB, '1234');
    expect(res.success).toBe(false);
    expect(res.message).toContain('6 chữ số');

    const res2 = deviceRegistryService.redeemSyncCode(devB, '999999');
    expect(res2.success).toBe(false);
    expect(res2.message).toContain('không hợp lệ');
  });

  it('links two devices into the same sync group and invalidates code upon use', () => {
    const codeRes = deviceRegistryService.generateSyncCode(devA);
    const redeemRes = deviceRegistryService.redeemSyncCode(devB, codeRes.code);

    expect(redeemRes.success).toBe(true);
    expect(redeemRes.syncGroupId).toBeDefined();

    // Group IDs must match for both devices
    const groupA = deviceRegistryService.getSyncGroupDeviceIds(devA);
    const groupB = deviceRegistryService.getSyncGroupDeviceIds(devB);

    expect(groupA.sort()).toEqual([devA, devB].sort());
    expect(groupB.sort()).toEqual([devA, devB].sort());

    // Single-use: redeeming same code again must fail
    const replayRes = deviceRegistryService.redeemSyncCode(devB, codeRes.code);
    expect(replayRes.success).toBe(false);
  });

  it('transitively links a 3rd device into an existing sync group', () => {
    // 1. Link devA + devB
    const code1 = deviceRegistryService.generateSyncCode(devA);
    deviceRegistryService.redeemSyncCode(devB, code1.code);

    // 2. devB generates code for devC
    const code2 = deviceRegistryService.generateSyncCode(devB);
    const redeem3 = deviceRegistryService.redeemSyncCode(devC, code2.code);

    expect(redeem3.success).toBe(true);

    const groupA = deviceRegistryService.getSyncGroupDeviceIds(devA);
    const groupB = deviceRegistryService.getSyncGroupDeviceIds(devB);
    const groupC = deviceRegistryService.getSyncGroupDeviceIds(devC);

    const expected = [devA, devB, devC].sort();
    expect(groupA.sort()).toEqual(expected);
    expect(groupB.sort()).toEqual(expected);
    expect(groupC.sort()).toEqual(expected);
  });

  it('unlinks a device cleanly and disbands group if fewer than 2 members remain', () => {
    const code = deviceRegistryService.generateSyncCode(devA);
    deviceRegistryService.redeemSyncCode(devB, code.code);

    expect(deviceRegistryService.getSyncGroupDeviceIds(devA).length).toBe(2);

    // devB leaves
    const unlinkRes = deviceRegistryService.unlinkDevice(devB);
    expect(unlinkRes.success).toBe(true);

    // devB should now be alone
    expect(deviceRegistryService.getSyncGroupDeviceIds(devB)).toEqual([devB]);
    // devA had only 1 member left so group was disbanded
    expect(deviceRegistryService.getSyncGroupDeviceIds(devA)).toEqual([devA]);

    const statusA = deviceRegistryService.getSyncStatus(devA);
    expect(statusA.isLinked).toBe(false);
  });
});
