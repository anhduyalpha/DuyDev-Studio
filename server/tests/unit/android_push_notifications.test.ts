import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Android Native & Web Push Notification Subsystem', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const dnmPath = path.join(rootDir, 'android/app/src/main/java/vn/alphadaniel/duydevstudio/download/DownloadNotificationManager.kt');
  const bridgePath = path.join(rootDir, 'android/app/src/main/java/vn/alphadaniel/duydevstudio/AndroidBridge.kt');
  const mainActPath = path.join(rootDir, 'android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt');
  const helperPath = path.join(rootDir, 'src/utilities/notificationHelper.js');
  const taskCoordPath = path.join(rootDir, 'src/utilities/taskCoordinator.js');
  const swPath = path.join(rootDir, 'sw.js');

  const dnmContent = fs.readFileSync(dnmPath, 'utf-8');
  const bridgeContent = fs.readFileSync(bridgePath, 'utf-8');
  const mainActContent = fs.readFileSync(mainActPath, 'utf-8');
  const helperContent = fs.readFileSync(helperPath, 'utf-8');
  const taskCoordContent = fs.readFileSync(taskCoordPath, 'utf-8');
  const swContent = fs.readFileSync(swPath, 'utf-8');

  describe('1. Android Native Notification Engine (DownloadNotificationManager.kt)', () => {
    it('must configure V2 notification channels with IMPORTANCE_HIGH and clean legacy channels', () => {
      expect(dnmContent).toContain('ds_download_channel_v2');
      expect(dnmContent).toContain('ds_push_channel_v2');
      expect(dnmContent).toContain('manager.deleteNotificationChannel(LEGACY_CHANNEL_DOWNLOAD)');
      expect(dnmContent).toContain('manager.deleteNotificationChannel(LEGACY_CHANNEL_PUSH)');
      expect(dnmContent).toContain('NotificationManager.IMPORTANCE_HIGH');
    });

    it('must configure sound, vibration pattern, and public lockscreen visibility on channels', () => {
      expect(dnmContent).toContain('RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)');
      expect(dnmContent).toContain('AudioAttributes.USAGE_NOTIFICATION');
      expect(dnmContent).toContain('vibrationPattern = longArrayOf(0, 200, 100, 200)');
      expect(dnmContent).toContain('lockscreenVisibility = Notification.VISIBILITY_PUBLIC');
    });

    it('must build completed download and push notifications with PRIORITY_MAX, CATEGORY_STATUS and VISIBILITY_PUBLIC', () => {
      expect(dnmContent).toContain('.setPriority(NotificationCompat.PRIORITY_MAX)');
      expect(dnmContent).toContain('.setCategory(NotificationCompat.CATEGORY_STATUS)');
      expect(dnmContent).toContain('.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)');
      expect(dnmContent).toContain('.setDefaults(NotificationCompat.DEFAULT_ALL)');
    });
  });

  describe('2. Android Bridge & Activity Permissions', () => {
    it('AndroidBridge must expose permission methods and notification dispatch to JavaScript', () => {
      expect(bridgeContent).toContain('fun hasNotificationPermission(): Boolean');
      expect(bridgeContent).toContain('fun requestNotificationPermission()');
      expect(bridgeContent).toContain('fun openNotificationSettings()');
      expect(bridgeContent).toContain('fun showNotification(title: String, message: String');
    });

    it('MainActivity must implement runtime permission check and settings intent fallback', () => {
      expect(mainActContent).toContain('fun hasNotificationPermission(): Boolean');
      expect(mainActContent).toContain('fun requestNotificationPermission()');
      expect(mainActContent).toContain('fun openNotificationSettings()');
      expect(mainActContent).toContain('Settings.ACTION_APP_NOTIFICATION_SETTINGS');
    });
  });

  describe('3. Unified Frontend Notification Helper (notificationHelper.js)', () => {
    it('must export core notification lifecycle functions', () => {
      expect(helperContent).toContain('export function isNotificationSupported()');
      expect(helperContent).toContain('export function getNotificationPermission()');
      expect(helperContent).toContain('export async function requestNotificationPermission()');
      expect(helperContent).toContain('export function openNotificationSettings()');
      expect(helperContent).toContain('export function showNotification(');
      expect(helperContent).toContain('export function notifyJobComplete(');
      expect(helperContent).toContain('export function notifyJobFailed(');
    });

    it('must support native bridge when available and fallback to Web Push API', () => {
      expect(helperContent).toContain('window.AndroidBridge.showNotification');
      expect(helperContent).toContain('navigator.serviceWorker.ready');
      expect(helperContent).toContain('registration.showNotification');
    });
  });

  describe('4. Task Coordinator & Service Worker Integration', () => {
    it('taskCoordinator.js must import and call notifyJobComplete on completion and notifyJobFailed on error', () => {
      expect(taskCoordContent).toContain("import { notifyJobComplete, notifyJobFailed } from './notificationHelper.js'");
      expect(taskCoordContent).toContain('notifyJobComplete(');
      expect(taskCoordContent).toContain('notifyJobFailed(');
    });

    it('sw.js must handle notificationclick event and focus or open the window', () => {
      expect(swContent).toContain("self.addEventListener('notificationclick'");
      expect(swContent).toContain('event.notification.close()');
      expect(swContent).toContain('client.focus()');
    });

    it('sw.js cache name must be v23.55', () => {
      expect(swContent).toContain("const CACHE_NAME = 'duydev-studio-v23.55'");
    });
  });

  describe('5. Android Swipe-To-Refresh Suppression & APK Versioning', () => {
    const gradlePath = path.join(rootDir, 'android/app/build.gradle.kts');
    const gradleContent = fs.readFileSync(gradlePath, 'utf-8');

    it('MainActivity must disable swipeRefreshLayout and set onChildScrollUpCallback to prevent accidental reload', () => {
      expect(mainActContent).toContain('swipeRefreshLayout.isEnabled = false');
      expect(mainActContent).toContain('swipeRefreshLayout.setOnChildScrollUpCallback { _, _ -> true }');
    });

    it('build.gradle.kts must be bumped to versionCode 2354 and versionName 23.54.0', () => {
      expect(gradleContent).toContain('versionCode = 2354');
      expect(gradleContent).toContain('versionName = "23.54.0"');
    });
  });
});
