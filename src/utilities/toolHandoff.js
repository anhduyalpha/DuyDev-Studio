/**
 * toolHandoff.js - Lightweight Cross-Tool Payload Handoff & Router
 * Facilitates sending files, blobs, URLs, and texts across tools without global state clutter.
 */

const SESSION_KEY = 'ds_tool_handoff';
const HANDOFF_TTL_MS = 60000; // 60 seconds bounded TTL

let inMemoryHandoff = null;

export const TOOL_ROUTES = {
  'universal-converter': '#tool/universal-converter',
  'pdf-studio': '#tool/pdf-studio',
  'view-split': '#tool/view-split',
  'hash-checksum': '#tool/hash-checksum',
  'qr-multi': '#tool/qr-multi',
  'qr-studio': '#tool/qr-multi',
  'markdown-docs': '#tool/markdown-docs',
  'server-archive': '#server-archive',
  'archive-inspect': '#archive'
};

function toolMatches(target, requested) {
  if (target === requested) return true;
  if ((target === 'qr-multi' || target === 'qr-studio') && (requested === 'qr-multi' || requested === 'qr-studio')) {
    return true;
  }
  return false;
}

/**
 * Dispatches a handoff payload to target tool and navigates to its route.
 * @param {string} targetTool - Destination tool identifier
 * @param {Object} payload - { file?, blob?, fileId?, fileName?, url?, text?, mimeType? }
 */
export function sendToTool(targetTool, payload = {}) {
  const timestamp = Date.now();
  inMemoryHandoff = {
    targetTool,
    payload,
    timestamp
  };

  try {
    if (typeof sessionStorage !== 'undefined') {
      const serializable = {
        targetTool,
        timestamp,
        payload: {
          fileId: payload.fileId,
          fileName: payload.fileName || (payload.file ? payload.file.name : ''),
          url: payload.url,
          text: payload.text,
          mimeType: payload.mimeType || (payload.file ? payload.file.type : '')
        }
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(serializable));
    }
  } catch {}

  const route = TOOL_ROUTES[targetTool];
  if (route && typeof window !== 'undefined') {
    window.location.hash = route;
  }
}

/**
 * Single-consume receiver for destination tools.
 * Checks in-memory (for rich Blob/File objects) and fallback sessionStorage.
 * Immediately clears handoff so normal mounts and refreshes do not re-consume.
 * @param {string} toolId
 * @returns {Object|null} Payload or null
 */
export function consumeHandoff(toolId) {
  const now = Date.now();

  // 1. Check in-memory first (preserves rich File/Blob objects)
  if (inMemoryHandoff && toolMatches(inMemoryHandoff.targetTool, toolId)) {
    if (now - inMemoryHandoff.timestamp <= HANDOFF_TTL_MS) {
      const payload = inMemoryHandoff.payload;
      inMemoryHandoff = null;
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {}
      return payload;
    }
    inMemoryHandoff = null;
  }

  // 2. Fallback to sessionStorage
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && toolMatches(data.targetTool, toolId) && (now - data.timestamp <= HANDOFF_TTL_MS)) {
          sessionStorage.removeItem(SESSION_KEY);
          return data.payload || null;
        }
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  } catch {}

  return null;
}

/**
 * Checks if a pending handoff exists for toolId without consuming it
 * @param {string} toolId
 * @returns {boolean}
 */
export function hasPendingHandoff(toolId) {
  const now = Date.now();
  if (inMemoryHandoff && toolMatches(inMemoryHandoff.targetTool, toolId)) {
    return (now - inMemoryHandoff.timestamp <= HANDOFF_TTL_MS);
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return Boolean(data && toolMatches(data.targetTool, toolId) && (now - data.timestamp <= HANDOFF_TTL_MS));
      }
    }
  } catch {}
  return false;
}
