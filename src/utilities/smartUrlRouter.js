/**
 * Smart URL Router & Auto-Start Handoff Utility (< 120 lines)
 * Identifies supported target tools (Scribd, TikTok) from raw pasted text,
 * serializes auto-start state into sessionStorage, and safely dispatches routes.
 *
 * NOTE: Studocu is under strict quarantine and is NOT handled here.
 */

export const PENDING_AUTOSTART_KEY = 'dd_pending_autostart_url';
export const AUTOSTART_TTL_MS = 15000;

// Scribd document URL pattern: document/doc/presentation/embeds followed by numeric id
const SCRIBD_REGEX = /(?:https?:\/\/)?(?:www\.)?scribd\.com\/(?:document|doc|presentation|embeds)\/(\d+)[^\s"']*/i;

// TikTok video/photo/short URL patterns
const TIKTOK_REGEX = /(?:https?:\/\/)?(?:(?:vt|vm|www|m|v)\.)?tiktok\.com\/[^\s"']+/i;
const DOUYIN_REGEX = /(?:https?:\/\/)?(?:www\.)?douyin\.com\/[^\s"']+/i;

/**
 * Detect if text contains a supported tool URL.
 * @param {string} raw
 * @returns {{ toolId: 'scribd'|'tiktok', route: string, url: string, autoStart: boolean }|null}
 */
export function detectSmartRoute(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. Scribd Document Check
  const scribdMatch = trimmed.match(SCRIBD_REGEX);
  if (scribdMatch) {
    let matchedUrl = scribdMatch[0];
    if (!matchedUrl.startsWith('http://') && !matchedUrl.startsWith('https://')) {
      matchedUrl = 'https://' + matchedUrl;
    }
    return {
      toolId: 'scribd',
      route: '#tool/scribd',
      url: matchedUrl,
      autoStart: true
    };
  }

  // 2. TikTok / Douyin Video & Photo Check
  const tiktokMatch = trimmed.match(TIKTOK_REGEX) || trimmed.match(DOUYIN_REGEX);
  if (tiktokMatch) {
    let matchedUrl = tiktokMatch[0];
    if (!matchedUrl.startsWith('http://') && !matchedUrl.startsWith('https://')) {
      matchedUrl = 'https://' + matchedUrl;
    }
    return {
      toolId: 'tiktok',
      route: '#tool/tiktok',
      url: matchedUrl,
      autoStart: true
    };
  }

  return null;
}

/**
 * Serializes pending auto-start payload and navigates to the target tool route.
 * @param {{ toolId: string, url: string, route: string }} smartResult
 */
export function handoffSmartUrl(smartResult) {
  if (!smartResult || !smartResult.toolId || !smartResult.url) return;
  try {
    sessionStorage.setItem(
      PENDING_AUTOSTART_KEY,
      JSON.stringify({
        toolId: smartResult.toolId,
        url: smartResult.url,
        ts: Date.now()
      })
    );
  } catch (err) {
    console.warn('[SmartUrlRouter] Failed to set sessionStorage:', err);
  }

  const targetRoute = smartResult.route || (smartResult.toolId === 'scribd' ? '#tool/scribd' : '#tool/tiktok');
  if (window.location.hash === targetRoute) {
    window.dispatchEvent(new CustomEvent('ds:pending-autostart-ready', { detail: smartResult }));
  } else {
    window.location.hash = targetRoute;
  }
}

/**
 * Consumes pending auto-start URL for a specific tool if within TTL (<15s).
 * Clears sessionStorage immediately upon retrieval.
 * @param {'scribd'|'tiktok'} expectedToolId
 * @returns {string|null} The URL to auto-start, or null
 */
export function consumePendingAutoStart(expectedToolId) {
  try {
    const raw = sessionStorage.getItem(PENDING_AUTOSTART_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.toolId !== expectedToolId || !data.url) return null;

    const age = Date.now() - (data.ts || 0);
    sessionStorage.removeItem(PENDING_AUTOSTART_KEY);

    if (age < AUTOSTART_TTL_MS) {
      return data.url;
    }
    return null;
  } catch (err) {
    console.warn('[SmartUrlRouter] Failed to consume auto-start URL:', err);
    return null;
  }
}
