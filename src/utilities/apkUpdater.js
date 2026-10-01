/**
 * Android APK Direct Updater Utility
 * Handles GitHub release inspection, semantic version comparison,
 * and communication with the native AndroidBridge for in-app APK downloading and installation.
 */

const GITHUB_REPO = 'anhduyalpha/DuyDev-Studio';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

/**
 * Check if the application is running inside the native Android APK wrapper.
 * @returns {boolean}
 */
export function isNativeApp() {
  return Boolean(
    typeof window !== 'undefined' &&
    window.AndroidBridge &&
    typeof window.AndroidBridge.isNativeApp === 'function' &&
    window.AndroidBridge.isNativeApp()
  );
}

/**
 * Get current native application version from AndroidBridge.
 * @returns {string}
 */
export function getNativeAppVersion() {
  if (isNativeApp() && typeof window.AndroidBridge.getAppVersion === 'function') {
    return window.AndroidBridge.getAppVersion();
  }
  return '1.0.0';
}

/**
 * Check if the app is authorized to request package installations.
 * @returns {boolean}
 */
export function canRequestPackageInstalls() {
  if (isNativeApp() && typeof window.AndroidBridge.canRequestPackageInstalls === 'function') {
    return window.AndroidBridge.canRequestPackageInstalls();
  }
  return true;
}

/**
 * Open Android system settings to grant unknown sources permission.
 */
export function openInstallPermissionSettings() {
  if (isNativeApp() && typeof window.AndroidBridge.openInstallPermissionSettings === 'function') {
    window.AndroidBridge.openInstallPermissionSettings();
  }
}

/**
 * Check if a previously downloaded APK exists in app cache.
 * @returns {boolean}
 */
export function hasDownloadedApk() {
  if (isNativeApp() && typeof window.AndroidBridge.hasDownloadedApk === 'function') {
    return window.AndroidBridge.hasDownloadedApk();
  }
  return false;
}

/**
 * Launch system installer using existing cached APK.
 * @returns {boolean}
 */
export function installDownloadedApk() {
  if (isNativeApp() && typeof window.AndroidBridge.installDownloadedApk === 'function') {
    return window.AndroidBridge.installDownloadedApk();
  }
  return false;
}

/**
 * Compare two semver strings (e.g. "15.5.0" vs "15.4.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 * @param {string} v1
 * @param {string} v2
 * @returns {number}
 */
export function compareSemver(v1, v2) {
  const parse = (v) =>
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

/**
 * Fetch the latest GitHub release info.
 * @returns {Promise<{
 *   tagName: string,
 *   version: string,
 *   apkAsset: { name: string, size: number, downloadUrl: string },
 *   publishedAt: string,
 *   releaseNotes: string
 * }>}
 */
export async function fetchLatestApkRelease() {
  const resp = await fetch(`${GITHUB_API_URL}?t=${Date.now()}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
    cache: 'no-store'
  });

  if (!resp.ok) {
    throw new Error(`GitHub phản hồi mã lỗi ${resp.status}`);
  }

  const release = await resp.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAsset = assets.find((a) => a.name && a.name.toLowerCase().endsWith('.apk'));

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

/**
 * Check if a newer APK is available on GitHub compared to the installed native app.
 * @returns {Promise<{
 *   hasUpdate: boolean,
 *   currentVersion: string,
 *   latestVersion: string,
 *   tagName: string,
 *   apkAsset: { name: string, size: number, downloadUrl: string },
 *   releaseNotes: string
 * }>}
 */
export async function checkApkUpdate() {
  const currentVer = getNativeAppVersion();
  const latestRelease = await fetchLatestApkRelease();
  const hasUpdate = compareSemver(latestRelease.version, currentVer) > 0;

  return {
    hasUpdate,
    currentVersion: currentVer,
    latestVersion: latestRelease.version,
    tagName: latestRelease.tagName,
    apkAsset: latestRelease.apkAsset,
    releaseNotes: latestRelease.releaseNotes
  };
}

/**
 * Start downloading and installing APK via AndroidBridge.
 * @param {string} downloadUrl
 */
export function startApkUpdate(downloadUrl) {
  if (isNativeApp() && typeof window.AndroidBridge.downloadAndInstallApk === 'function') {
    window.AndroidBridge.downloadAndInstallApk(downloadUrl);
  } else {
    throw new Error('Tính năng cập nhật APK chỉ hoạt động trong ứng dụng Native Android');
  }
}

/**
 * Listen for APK download progress, completion, and errors from native bridge.
 * @param {{
 *   onProgress?: (data: { percent: number, bytes: number, total: number }) => void,
 *   onComplete?: (data: { path: string, bytes: number }) => void,
 *   onError?: (data: { message: string }) => void
 * }} handlers
 * @returns {() => void} Teardown unsubscribe function
 */
export function listenApkProgress({ onProgress, onComplete, onError }) {
  const handleProgress = (e) => onProgress?.(e.detail);
  const handleComplete = (e) => onComplete?.(e.detail);
  const handleError = (e) => onError?.(e.detail);

  window.addEventListener('ds:apk-download-progress', handleProgress);
  window.addEventListener('ds:apk-download-complete', handleComplete);
  window.addEventListener('ds:apk-download-error', handleError);

  return () => {
    window.removeEventListener('ds:apk-download-progress', handleProgress);
    window.removeEventListener('ds:apk-download-complete', handleComplete);
    window.removeEventListener('ds:apk-download-error', handleError);
  };
}
