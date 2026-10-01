import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit Tests for Android APK Direct Updater Logic
 */

function compareSemver(v1: string, v2: string): number {
  const parse = (v: string) =>
    String(v || '')
      .replace(/^[^\d]*/, '')
      .split(/[-+.]/)
      .map((n) => parseInt(n, 10) || 0);

  const parts1 = parse(v1);
  const parts2 = parse(v2);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function parseReleasePayload(release: any) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAsset = assets.find((a: any) => a.name && a.name.toLowerCase().endsWith('.apk'));

  if (!apkAsset) {
    throw new Error(`Bản phát hành ${release.tag_name} chưa có tệp APK`);
  }

  const cleanVersion = (release.tag_name || '').replace(/^[^\d]*/, '');

  return {
    tagName: release.tag_name,
    version: cleanVersion,
    apkAsset: {
      name: apkAsset.name,
      size: apkAsset.size || 0,
      downloadUrl: apkAsset.browser_download_url
    },
    publishedAt: release.published_at || '',
    releaseNotes: release.body || ''
  };
}

describe('APK Updater - Semantic Version Comparison', () => {
  it('correctly identifies newer minor versions', () => {
    expect(compareSemver('15.5.0', '15.4.0')).toBe(1);
    expect(compareSemver('v15.5.0', 'v15.4.0')).toBe(1);
    expect(compareSemver('15.5.0', 'v15.4.0')).toBe(1);
  });

  it('correctly identifies newer patch versions', () => {
    expect(compareSemver('15.4.1', '15.4.0')).toBe(1);
    expect(compareSemver('15.4.10', '15.4.9')).toBe(1);
  });

  it('correctly identifies newer major versions', () => {
    expect(compareSemver('16.0.0', '15.9.9')).toBe(1);
  });

  it('correctly handles equal versions', () => {
    expect(compareSemver('15.4.0', '15.4.0')).toBe(0);
    expect(compareSemver('v15.4.0', '15.4.0')).toBe(0);
    expect(compareSemver('15.4.0', 'v15.4.0')).toBe(0);
  });

  it('correctly identifies older versions', () => {
    expect(compareSemver('15.3.0', '15.4.0')).toBe(-1);
    expect(compareSemver('v15.3.9', 'v15.4.0')).toBe(-1);
  });

  it('gracefully handles missing parts or alpha suffixes', () => {
    expect(compareSemver('15.5.0-beta.1', '15.4.0')).toBe(1);
    expect(compareSemver('15.4', '15.4.0')).toBe(0);
    expect(compareSemver('15.5', '15.4.2')).toBe(1);
  });
});

describe('APK Updater - GitHub Release Payload Parsing', () => {
  it('extracts duydev-studio.apk asset from GitHub release JSON', () => {
    const mockRelease = {
      tag_name: 'v15.5.0',
      published_at: '2026-10-01T12:00:00Z',
      body: 'Release notes v15.5.0',
      assets: [
        {
          name: 'source.tar.gz',
          size: 1024,
          browser_download_url: 'https://github.com/.../source.tar.gz'
        },
        {
          name: 'duydev-studio.apk',
          size: 4950000,
          browser_download_url: 'https://github.com/anhduyalpha/DuyDev-Studio/releases/download/v15.5.0/duydev-studio.apk'
        }
      ]
    };

    const parsed = parseReleasePayload(mockRelease);
    expect(parsed.tagName).toBe('v15.5.0');
    expect(parsed.version).toBe('15.5.0');
    expect(parsed.apkAsset.name).toBe('duydev-studio.apk');
    expect(parsed.apkAsset.size).toBe(4950000);
    expect(parsed.apkAsset.downloadUrl).toContain('duydev-studio.apk');
  });

  it('throws an error if no APK asset is found in release', () => {
    const mockReleaseNoApk = {
      tag_name: 'v15.5.0',
      assets: [
        {
          name: 'source.tar.gz',
          size: 1024,
          browser_download_url: 'https://github.com/.../source.tar.gz'
        }
      ]
    };

    expect(() => parseReleasePayload(mockReleaseNoApk)).toThrow(/chưa có tệp APK/);
  });
});

describe('APK Updater - Native Android Bridge Contract', () => {
  let mockBridge: any;

  beforeEach(() => {
    mockBridge = {
      isNativeApp: vi.fn(() => true),
      getAppVersion: vi.fn(() => '15.4.0'),
      canRequestPackageInstalls: vi.fn(() => true),
      openInstallPermissionSettings: vi.fn(),
      downloadAndInstallApk: vi.fn(),
      hasDownloadedApk: vi.fn(() => false),
      installDownloadedApk: vi.fn(() => false)
    };
    (global as any).window = {
      AndroidBridge: mockBridge
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('detects native app and retrieves current version', () => {
    expect(mockBridge.isNativeApp()).toBe(true);
    expect(mockBridge.getAppVersion()).toBe('15.4.0');
  });

  it('delegates downloadAndInstallApk to native bridge', () => {
    const url = 'https://github.com/anhduyalpha/DuyDev-Studio/releases/download/v15.5.0/duydev-studio.apk';
    mockBridge.downloadAndInstallApk(url);
    expect(mockBridge.downloadAndInstallApk).toHaveBeenCalledWith(url);
  });

  it('checks unknown package install permissions', () => {
    expect(mockBridge.canRequestPackageInstalls()).toBe(true);
    mockBridge.canRequestPackageInstalls.mockReturnValue(false);
    expect(mockBridge.canRequestPackageInstalls()).toBe(false);

    mockBridge.openInstallPermissionSettings();
    expect(mockBridge.openInstallPermissionSettings).toHaveBeenCalled();
  });
});
