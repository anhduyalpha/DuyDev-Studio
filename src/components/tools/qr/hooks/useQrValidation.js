/**
 * QR Web Link & Preset Validation Utilities
 * Validates target URLs according to selected service presets (YouTube, Facebook, TikTok, Google Docs/Sheets/Drive/Forms, etc.)
 */

/**
 * Validates a target URL against the chosen preset.
 * @param {string} rawUrl
 * @param {string} [presetId='custom']
 * @returns {{ valid: boolean, normalizedUrl: string, message: string }}
 */
export function validateTargetUrlForPreset(rawUrl, presetId = 'custom') {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      normalizedUrl: '',
      message: 'Vui lòng nhập địa chỉ liên kết trang web (URL)'
    };
  }

  // Prepend https:// if no protocol is specified
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      valid: false,
      normalizedUrl: normalized,
      message: 'Địa chỉ web không đúng định dạng URL'
    };
  }

  const hostname = (parsed.hostname || '').toLowerCase();
  if (!hostname || !hostname.includes('.')) {
    return {
      valid: false,
      normalizedUrl: normalized,
      message: 'Tên miền trang web không hợp lệ'
    };
  }

  const pathname = parsed.pathname || '';

  switch (presetId) {
    case 'youtube': {
      const isYt = hostname === 'youtube.com' ||
                   hostname.endsWith('.youtube.com') ||
                   hostname === 'youtu.be' ||
                   hostname.endsWith('.youtu.be');
      if (!isYt) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Bạn đang chọn dịch vụ YouTube, vui lòng nhập liên kết từ youtube.com hoặc youtu.be'
        };
      }
      break;
    }

    case 'facebook': {
      const isFb = hostname === 'facebook.com' ||
                   hostname.endsWith('.facebook.com') ||
                   hostname === 'fb.com' ||
                   hostname.endsWith('.fb.com') ||
                   hostname === 'fb.watch' ||
                   hostname.endsWith('.fb.watch') ||
                   hostname === 'fb.me' ||
                   hostname.endsWith('.fb.me');
      if (!isFb) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Bạn đang chọn dịch vụ Facebook, vui lòng nhập liên kết từ facebook.com hoặc fb.watch'
        };
      }
      break;
    }

    case 'tiktok': {
      const isTt = hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
      if (!isTt) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Bạn đang chọn dịch vụ TikTok, vui lòng nhập liên kết từ tiktok.com'
        };
      }
      break;
    }

    case 'google-sheets': {
      const isGoogle = hostname === 'docs.google.com' || hostname.endsWith('.google.com');
      const isSheets = pathname.includes('/spreadsheets');
      if (!isGoogle || !isSheets) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Google Sheets (docs.google.com/spreadsheets/...)'
        };
      }
      break;
    }

    case 'google-drive': {
      const isDrive = hostname === 'drive.google.com' ||
                      (hostname.endsWith('.google.com') && (pathname.includes('/drive') || pathname.includes('/file/d/')));
      if (!isDrive) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Google Drive (drive.google.com/...)'
        };
      }
      break;
    }

    case 'google-docs': {
      const isGoogle = hostname === 'docs.google.com' || hostname.endsWith('.google.com');
      const isDocs = pathname.includes('/document');
      if (!isGoogle || !isDocs) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Google Docs (docs.google.com/document/...)'
        };
      }
      break;
    }

    case 'google-forms': {
      const isForms = hostname === 'forms.gle' ||
                      ((hostname === 'docs.google.com' || hostname.endsWith('.google.com')) && pathname.includes('/forms'));
      if (!isForms) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Google Forms (forms.gle hoặc docs.google.com/forms)'
        };
      }
      break;
    }

    case 'onedrive': {
      const isOneDrive = hostname === '1drv.ms' || hostname.includes('onedrive') || hostname.includes('sharepoint.com');
      if (!isOneDrive) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Microsoft OneDrive (1drv.ms hoặc onedrive.live.com)'
        };
      }
      break;
    }

    case 'dropbox': {
      const isDropbox = hostname === 'dropbox.com' || hostname.endsWith('.dropbox.com');
      if (!isDropbox) {
        return {
          valid: false,
          normalizedUrl: normalized,
          message: 'Đường dẫn không hợp lệ. Vui lòng nhập liên kết Dropbox (dropbox.com/...)'
        };
      }
      break;
    }

    case 'custom':
    default:
      // Any valid HTTP / HTTPS URL is permitted
      break;
  }

  return {
    valid: true,
    normalizedUrl: normalized,
    message: ''
  };
}
