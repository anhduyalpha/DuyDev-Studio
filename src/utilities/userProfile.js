/**
 * userProfile.js - User Profile & Avatar State Manager
 * Handles local persistence, backend synchronization with deviceRegistryService,
 * avatar generation, image compression, and real-time UI updates.
 */

import { getDeviceId } from './deviceId.js';
import { isAdminAuthenticated } from './adminAuth.js';

const STORAGE_KEY_PROFILE = 'ds_user_profile';
const STORAGE_KEY_PROMPTED = 'ds_profile_prompted_v1';

export const AVATAR_PRESETS = [
  { id: 'preset:fox', emoji: '🦊', label: 'Cáo tinh anh' },
  { id: 'preset:cat', emoji: '🐱', label: 'Mèo công nghệ' },
  { id: 'preset:rocket', emoji: '🚀', label: 'Phi hành gia' },
  { id: 'preset:lightning', emoji: '⚡', label: 'Tia chớp' },
  { id: 'preset:crown', emoji: '👑', label: 'Vương miện' },
  { id: 'preset:robot', emoji: '🤖', label: 'Robot' },
  { id: 'preset:owl', emoji: '🦉', label: 'Cú thông thái' },
  { id: 'preset:penguin', emoji: '🐧', label: 'Chim cánh cụt' },
  { id: 'preset:art', emoji: '🎨', label: 'Nghệ thuật' },
  { id: 'preset:game', emoji: '🎮', label: 'Game thủ' },
  { id: 'preset:coffee', emoji: '☕', label: 'Cà phê' },
  { id: 'preset:ninja', emoji: '🥷', label: 'Ninja' },
];

export function getPresetEmoji(avatarStr) {
  if (!avatarStr) return '';
  const found = AVATAR_PRESETS.find(p => p.id === avatarStr);
  if (found) return found.emoji;
  if (avatarStr.startsWith('preset:')) {
    return avatarStr.replace('preset:', '');
  }
  return avatarStr; // Raw emoji or string
}

export function getInitialLetter(name) {
  if (!name) return 'D';
  const clean = name.trim();
  if (!clean) return 'D';
  const words = clean.split(/\s+/);
  const targetWord = words[words.length - 1] || words[0] || 'D';
  return (targetWord[0] || 'D').toUpperCase();
}

/**
 * Returns a stable vibrant pastel gradient class based on name hash
 */
export function getAvatarGradient(name) {
  const gradients = [
    'from-indigo-500 to-purple-600 text-white',
    'from-amber-500 to-orange-600 text-white',
    'from-emerald-500 to-teal-600 text-white',
    'from-sky-500 to-blue-600 text-white',
    'from-rose-500 to-pink-600 text-white',
    'from-violet-500 to-fuchsia-600 text-white',
  ];
  if (!name) return gradients[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % gradients.length;
  return gradients[idx];
}

/**
 * Renders avatar inner HTML (image, emoji preset, or initial letter)
 */
export function renderAvatarInnerHtml(avatar, name) {
  if (avatar && (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://'))) {
    return `<img src="${avatar}" alt="${name || 'Avatar'}" class="w-full h-full object-cover rounded-full" />`;
  }
  if (avatar && (avatar.startsWith('preset:') || /\p{Emoji}/u.test(avatar))) {
    const emoji = getPresetEmoji(avatar);
    return `<span class="flex items-center justify-center text-base sm:text-lg select-none leading-none">${emoji}</span>`;
  }
  return `<span class="font-bold select-none">${getInitialLetter(name)}</span>`;
}

/**
 * Gets currently saved user profile from localStorage or defaults
 */
export function getUserProfile() {
  const deviceId = getDeviceId();
  const isAdmin = isAdminAuthenticated();

  let profile = {
    name: '',
    avatar: '',
    deviceId,
    isOwner: isAdmin,
    isConfigured: false
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        profile = {
          ...profile,
          ...parsed,
          deviceId,
          isConfigured: Boolean(parsed.name && parsed.name.trim().length > 0)
        };
      }
    }
  } catch {}

  // If admin/owner and name is empty, default to "Duy"
  if (isAdmin && !profile.name) {
    profile.name = 'Duy';
    profile.isOwner = true;
  }

  return profile;
}

/**
 * Checks if the user has already configured their profile
 */
export function isProfileConfigured() {
  const profile = getUserProfile();
  return Boolean(profile.isConfigured && profile.name.trim().length > 0);
}

/**
 * Saves profile to localStorage and syncs with backend server
 */
export async function saveUserProfile(updates = {}) {
  const current = getUserProfile();
  const deviceId = getDeviceId();

  const newProfile = {
    ...current,
    ...updates,
    deviceId,
    updatedAt: new Date().toISOString(),
    isConfigured: Boolean(updates.name ? updates.name.trim().length > 0 : current.name.trim().length > 0)
  };

  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(newProfile));
    localStorage.setItem(STORAGE_KEY_PROMPTED, 'true');
  } catch {}

  // Notify listeners on this window
  window.dispatchEvent(new CustomEvent('ds:profile-updated', { detail: newProfile }));

  // Synchronize with server
  try {
    await fetch('/api/v1/device/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId
      },
      body: JSON.stringify({
        deviceId,
        alias: newProfile.name,
        avatar: newProfile.avatar
      })
    });
  } catch (err) {
    console.warn('[Profile] Failed to sync profile to server:', err?.message);
  }

  return newProfile;
}

/**
 * Background synchronization with server on app load
 */
export async function syncProfileWithServer() {
  const deviceId = getDeviceId();
  if (!deviceId) return;

  try {
    const res = await fetch(`/api/v1/device/profile?deviceId=${encodeURIComponent(deviceId)}`, {
      headers: { 'X-Device-Id': deviceId }
    });
    if (!res.ok) return;
    const body = await res.json();
    const serverData = body?.data;

    if (serverData) {
      const local = getUserProfile();
      let hasChanges = false;
      const merged = { ...local };

      if (serverData.alias && !local.name) {
        merged.name = serverData.alias;
        merged.isConfigured = true;
        hasChanges = true;
      }
      if (serverData.avatar && !local.avatar) {
        merged.avatar = serverData.avatar;
        hasChanges = true;
      }
      if (serverData.isOwner !== undefined) {
        merged.isOwner = serverData.isOwner;
      }

      if (hasChanges) {
        localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('ds:profile-updated', { detail: merged }));
      } else if (local.name && !serverData.alias) {
        // Push local name to server if server was missing it
        fetch('/api/v1/device/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': deviceId
          },
          body: JSON.stringify({
            deviceId,
            alias: local.name,
            avatar: local.avatar
          })
        }).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Resizes an image file down to max 128x128 circular square webp/jpeg data URL
 */
export function compressAvatarImage(file, maxSize = 128) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Tệp không phải định dạng hình ảnh hợp lệ'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Lỗi tải hình ảnh'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          canvas.width = maxSize;
          canvas.height = maxSize;
          const ctx = canvas.getContext('2d');

          // Smooth high quality downsampling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxSize, maxSize);

          // Export as webp if supported, otherwise jpeg
          let dataUrl = canvas.toDataURL('image/webp', 0.85);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
