import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger.js';

export interface StoredDeviceInfo {
  deviceId: string;
  alias?: string;
  avatar?: string;
  isOwner: boolean;
  isBlocked: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  userAgent: string;
  deviceSummary: string;
  country: string;
  lastIp: string;
  ipHistory: string[];
}

export class DeviceRegistryService {
  private static instance: DeviceRegistryService;
  private filePath: string;
  private devices: Map<string, StoredDeviceInfo> = new Map();
  private saveTimer: NodeJS.Timeout | null = null;

  private constructor() {
    const baseDir = process.cwd().endsWith('server') ? process.cwd() : path.join(process.cwd(), 'server');
    const dataDir = path.join(baseDir, 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // Fallback to local data dir
      }
    }
    this.filePath = path.join(dataDir, 'device_registry.json');
    this.loadFromDisk(baseDir);
  }

  public static getInstance(): DeviceRegistryService {
    if (!DeviceRegistryService.instance) {
      DeviceRegistryService.instance = new DeviceRegistryService();
    }
    return DeviceRegistryService.instance;
  }

  private loadFromDisk(baseDir?: string) {
    try {
      // Migrate from nested server/server/data if target filePath does not exist
      if (!fs.existsSync(this.filePath) && baseDir) {
        const legacyPath = path.join(baseDir, 'server', 'data', 'device_registry.json');
        if (fs.existsSync(legacyPath)) {
          try {
            fs.copyFileSync(legacyPath, this.filePath);
          } catch {}
        }
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: StoredDeviceInfo[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            if (item && item.deviceId) {
              this.devices.set(item.deviceId, item);
            }
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Failed to read device registry from ${this.filePath}: ${err?.message}`);
    }
  }

  private scheduleSave() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      try {
        const list = Array.from(this.devices.values());
        fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
      } catch (err: any) {
        logger.error(`Failed to save device registry to ${this.filePath}: ${err?.message}`);
      }
    }, 1000);
  }

  public getDevice(deviceId: string): StoredDeviceInfo | undefined {
    return this.devices.get(deviceId);
  }

  public isBlocked(deviceId: string): boolean {
    return this.devices.get(deviceId)?.isBlocked === true;
  }

  public isOwner(deviceId: string): boolean {
    return this.devices.get(deviceId)?.isOwner === true;
  }

  public upsertDevice(params: {
    deviceId: string;
    ip?: string;
    lastIp?: string;
    alias?: string;
    avatar?: string;
    isOwner?: boolean;
    userAgent: string;
    deviceSummary: string;
    country: string;
    isLan?: boolean;
    isAdmin?: boolean;
  }): StoredDeviceInfo {
    const nowIso = new Date().toISOString();
    let dev = this.devices.get(params.deviceId);
    const resolvedIp = params.ip || params.lastIp || '127.0.0.1';

    const shouldBeOwner = Boolean(
      dev?.isOwner ||
      params.isOwner ||
      params.isLan ||
      params.isAdmin ||
      (resolvedIp && (resolvedIp.startsWith('192.168.') || resolvedIp === '127.0.0.1' || resolvedIp === '::1'))
    );

    if (!dev) {
      dev = {
        deviceId: params.deviceId,
        alias: params.alias,
        avatar: params.avatar,
        isOwner: shouldBeOwner,
        isBlocked: false,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        userAgent: params.userAgent,
        deviceSummary: params.deviceSummary,
        country: params.country,
        lastIp: resolvedIp,
        ipHistory: [resolvedIp]
      };
      this.devices.set(params.deviceId, dev);
    } else {
      dev.lastSeenAt = nowIso;
      dev.lastIp = resolvedIp;
      if (params.alias !== undefined) dev.alias = params.alias;
      if (params.avatar !== undefined) dev.avatar = params.avatar;
      if (params.isOwner !== undefined) {
        dev.isOwner = params.isOwner;
      } else if (shouldBeOwner && !dev.isOwner) {
        dev.isOwner = true;
      }
      if (params.userAgent && params.userAgent !== 'Unknown') dev.userAgent = params.userAgent;
      if (params.deviceSummary) dev.deviceSummary = params.deviceSummary;
      if (params.country && params.country !== 'Unknown') dev.country = params.country;

      if (!dev.ipHistory) dev.ipHistory = [];
      if (!dev.ipHistory.includes(resolvedIp)) {
        dev.ipHistory.push(resolvedIp);
        if (dev.ipHistory.length > 10) {
          dev.ipHistory = dev.ipHistory.slice(-10);
        }
      }
    }

    this.scheduleSave();
    return dev;
  }

  public setAlias(deviceId: string, alias: string): StoredDeviceInfo | null {
    const dev = this.devices.get(deviceId);
    if (!dev) return null;
    const oldAlias = dev.alias;
    const newAlias = alias ? alias.trim() : undefined;
    dev.alias = newAlias;

    // Propagate alias change across all sibling devices with same old alias or owner
    if (oldAlias && oldAlias !== newAlias) {
      for (const other of this.devices.values()) {
        if (other.alias && other.alias.toLowerCase() === oldAlias.toLowerCase()) {
          other.alias = newAlias;
        }
      }
    } else if (dev.isOwner) {
      for (const other of this.devices.values()) {
        if (other.isOwner) {
          other.alias = newAlias;
        }
      }
    }

    this.scheduleSave();
    return dev;
  }

  public setProfile(deviceId: string, data: { alias?: string; avatar?: string }): StoredDeviceInfo | null {
    let dev = this.devices.get(deviceId);
    if (!dev) {
      dev = {
        deviceId,
        isOwner: false,
        isBlocked: false,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        userAgent: '',
        deviceSummary: 'Web Client',
        country: 'VN',
        lastIp: '127.0.0.1',
        ipHistory: []
      };
      this.devices.set(deviceId, dev);
    }
    if (data.alias !== undefined) {
      dev.alias = data.alias ? data.alias.trim() : undefined;
    }
    if (data.avatar !== undefined) {
      dev.avatar = data.avatar ? data.avatar.trim() : undefined;
    }
    this.scheduleSave();
    return dev;
  }

  public toggleBlock(deviceId: string, blocked?: boolean): StoredDeviceInfo | null {
    const dev = this.devices.get(deviceId);
    if (!dev) return null;
    const targetState = blocked !== undefined ? blocked : !dev.isBlocked;
    dev.isBlocked = targetState;

    if (dev.alias) {
      for (const other of this.devices.values()) {
        if (other.alias && other.alias.toLowerCase() === dev.alias.toLowerCase()) {
          other.isBlocked = targetState;
        }
      }
    } else if (dev.isOwner) {
      for (const other of this.devices.values()) {
        if (other.isOwner) {
          other.isBlocked = targetState;
        }
      }
    }

    this.scheduleSave();
    return dev;
  }

  public setOwner(deviceId: string, isOwner = true): StoredDeviceInfo | null {
    const dev = this.devices.get(deviceId);
    if (!dev) return null;
    dev.isOwner = isOwner;
    this.scheduleSave();
    return dev;
  }

  public deleteDevice(deviceId: string): boolean {
    const existed = this.devices.delete(deviceId);
    if (existed) {
      this.scheduleSave();
    }
    return existed;
  }

  public deleteUserDevices(userIdentifier: string): number {
    let deletedCount = 0;
    const ident = userIdentifier.trim().toLowerCase();

    if (ident === 'owner:duy' || ident === 'owner') {
      const ownerDevs = Array.from(this.devices.values())
        .filter(d => d.isOwner)
        .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());

      // Keep only the single latest owner device, delete all other owner duplicates
      for (let i = 1; i < ownerDevs.length; i++) {
        this.devices.delete(ownerDevs[i].deviceId);
        deletedCount++;
      }
    } else if (ident.startsWith('alias:')) {
      const targetAlias = ident.replace('alias:', '').trim();
      for (const [id, d] of this.devices.entries()) {
        if (d.alias && d.alias.toLowerCase() === targetAlias) {
          this.devices.delete(id);
          deletedCount++;
        }
      }
    } else if (ident.startsWith('guest:')) {
      const targetDeviceId = userIdentifier.slice('guest:'.length).trim();
      if (this.devices.delete(targetDeviceId)) {
        deletedCount++;
      }
    } else {
      if (this.devices.delete(userIdentifier)) {
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.scheduleSave();
    }
    return deletedCount;
  }

  /**
   * Completely removes all anonymous guest devices that have no alias/name configured
   * Owner devices are strictly preserved.
   */
  public purgeAllGuestDevices(): { purgedCount: number; purgedDeviceIds: string[] } {
    const purgedDeviceIds: string[] = [];
    for (const [id, dev] of this.devices.entries()) {
      if (!dev.isOwner && (!dev.alias || !dev.alias.trim())) {
        this.devices.delete(id);
        purgedDeviceIds.push(id);
      }
    }

    if (purgedDeviceIds.length > 0) {
      this.scheduleSave();
      logger.info({ purgedCount: purgedDeviceIds.length }, 'Purged anonymous guest devices from registry');
    }

    return { purgedCount: purgedDeviceIds.length, purgedDeviceIds };
  }

  /**
   * Batch toggles block state for an array of user/device identifiers
   */
  public batchToggleBlock(userIdentifiers: string[], blocked: boolean): number {
    let modifiedCount = 0;
    for (const rawIdent of userIdentifiers) {
      if (!rawIdent || typeof rawIdent !== 'string') continue;
      const ident = rawIdent.trim().toLowerCase();

      if (ident === 'owner:duy' || ident === 'owner') {
        for (const dev of this.devices.values()) {
          if (dev.isOwner) {
            dev.isBlocked = blocked;
            modifiedCount++;
          }
        }
      } else if (ident.startsWith('alias:')) {
        const targetAlias = ident.replace('alias:', '').trim();
        for (const dev of this.devices.values()) {
          if (dev.alias && dev.alias.toLowerCase() === targetAlias) {
            dev.isBlocked = blocked;
            modifiedCount++;
          }
        }
      } else if (ident.startsWith('guest:')) {
        const devId = rawIdent.slice('guest:'.length).trim();
        const dev = this.devices.get(devId);
        if (dev) {
          dev.isBlocked = blocked;
          modifiedCount++;
        }
      } else {
        const dev = this.devices.get(rawIdent);
        if (dev) {
          dev.isBlocked = blocked;
          modifiedCount++;
        }
      }
    }

    if (modifiedCount > 0) {
      this.scheduleSave();
    }
    return modifiedCount;
  }

  /**
   * Batch deletes multiple users/devices and all associated devices
   */
  public batchDeleteUsers(userIdentifiers: string[]): { deletedCount: number; deletedUsers: number } {
    let totalDevicesDeleted = 0;
    let usersDeleted = 0;

    for (const ident of userIdentifiers) {
      if (!ident || typeof ident !== 'string') continue;
      const count = this.deleteUserDevices(ident);
      if (count > 0) {
        totalDevicesDeleted += count;
        usersDeleted++;
      }
    }

    return { deletedCount: totalDevicesDeleted, deletedUsers: usersDeleted };
  }

  public pruneDuplicateDevices(keepLatestPerUser = 3): number {
    let prunedCount = 0;

    // 1. Prune redundant owner devices (e.g. 25 owner devices accumulated on LAN)
    const ownerDevs = Array.from(this.devices.values())
      .filter(d => d.isOwner)
      .sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());

    if (ownerDevs.length > keepLatestPerUser) {
      for (let i = keepLatestPerUser; i < ownerDevs.length; i++) {
        this.devices.delete(ownerDevs[i].deviceId);
        prunedCount++;
      }
    }

    // 2. Prune redundant devices per alias
    const aliasMap = new Map<string, StoredDeviceInfo[]>();
    for (const d of this.devices.values()) {
      if (d.alias && !d.isOwner) {
        const k = d.alias.trim().toLowerCase();
        if (!aliasMap.has(k)) aliasMap.set(k, []);
        aliasMap.get(k)!.push(d);
      }
    }

    for (const devs of aliasMap.values()) {
      if (devs.length > keepLatestPerUser) {
        devs.sort((a, b) => new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime());
        for (let i = keepLatestPerUser; i < devs.length; i++) {
          this.devices.delete(devs[i].deviceId);
          prunedCount++;
        }
      }
    }

    if (prunedCount > 0) {
      this.scheduleSave();
    }
    return prunedCount;
  }

  public pruneStaleDevices(maxAgeDays = 30): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;
    let prunedCount = 0;

    for (const [id, dev] of this.devices.entries()) {
      // Do not auto-prune owner devices or devices with custom alias
      if (dev.isOwner || (dev.alias && dev.alias.trim())) continue;
      const lastSeen = new Date(dev.lastSeenAt || dev.firstSeenAt).getTime();
      if (lastSeen < cutoff) {
        this.devices.delete(id);
        prunedCount++;
      }
    }

    if (prunedCount > 0) {
      this.scheduleSave();
    }
    return prunedCount;
  }

  public listDevices(): StoredDeviceInfo[] {
    return Array.from(this.devices.values());
  }
}

export const deviceRegistryService = DeviceRegistryService.getInstance();
