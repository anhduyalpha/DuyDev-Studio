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
    const dataDir = path.resolve(process.cwd(), 'server', 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {
        // Fallback to local data dir
      }
    }
    this.filePath = path.resolve(
      fs.existsSync(dataDir) ? dataDir : process.cwd(),
      'device_registry.json'
    );
    this.loadFromDisk();
  }

  public static getInstance(): DeviceRegistryService {
    if (!DeviceRegistryService.instance) {
      DeviceRegistryService.instance = new DeviceRegistryService();
    }
    return DeviceRegistryService.instance;
  }

  private loadFromDisk() {
    try {
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
    ip: string;
    userAgent: string;
    deviceSummary: string;
    country: string;
    isLan?: boolean;
    isAdmin?: boolean;
  }): StoredDeviceInfo {
    const nowIso = new Date().toISOString();
    let dev = this.devices.get(params.deviceId);

    const shouldBeOwner = Boolean(
      dev?.isOwner ||
      params.isLan ||
      params.isAdmin ||
      (params.ip.startsWith('192.168.') || params.ip === '127.0.0.1' || params.ip === '::1')
    );

    if (!dev) {
      dev = {
        deviceId: params.deviceId,
        isOwner: shouldBeOwner,
        isBlocked: false,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        userAgent: params.userAgent,
        deviceSummary: params.deviceSummary,
        country: params.country,
        lastIp: params.ip,
        ipHistory: [params.ip]
      };
      this.devices.set(params.deviceId, dev);
    } else {
      dev.lastSeenAt = nowIso;
      dev.lastIp = params.ip;
      if (shouldBeOwner && !dev.isOwner) {
        dev.isOwner = true;
      }
      if (params.userAgent && params.userAgent !== 'Unknown') dev.userAgent = params.userAgent;
      if (params.deviceSummary) dev.deviceSummary = params.deviceSummary;
      if (params.country && params.country !== 'Unknown') dev.country = params.country;

      if (!dev.ipHistory) dev.ipHistory = [];
      if (!dev.ipHistory.includes(params.ip)) {
        dev.ipHistory.push(params.ip);
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
    dev.alias = alias ? alias.trim() : undefined;
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
    dev.isBlocked = blocked !== undefined ? blocked : !dev.isBlocked;
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

  public listDevices(): StoredDeviceInfo[] {
    return Array.from(this.devices.values());
  }
}

export const deviceRegistryService = DeviceRegistryService.getInstance();
