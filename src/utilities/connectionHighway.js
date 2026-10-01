/**
 * Connection Highway Manager (< 140 lines)
 * Probes and switches between direct high-speed routes (LAN 1Gbps, Tailscale 250Mbps)
 * and remote WAN (Cloudflare Tunnel).
 */

export const HIGHWAYS = [
  {
    id: 'tailscale',
    name: 'Tailscale Direct',
    badge: 'Tailscale 250Mbps',
    url: 'http://100.90.62.15:3000',
    hostname: '100.90.62.15',
    speed: '250 Mbps',
    benchmarkTime: '~0.3s / 10MB',
    desc: 'Đường truyền P2P mã hóa qua Tailscale VPN (tốc độ như WinSCP)'
  },
  {
    id: 'lan',
    name: 'LAN Cục Bộ',
    badge: 'LAN 1Gbps',
    url: 'http://192.168.2.171:3000',
    hostname: '192.168.2.171',
    speed: '1000 Mbps',
    benchmarkTime: '~0.3s / 10MB',
    desc: 'Mạng Wi-Fi / Cáp LAN tại nhà'
  },
  {
    id: 'wireguard',
    name: 'WireGuard Direct',
    badge: 'WireGuard 250Mbps',
    url: 'http://10.7.0.1:3000',
    hostname: '10.7.0.1',
    speed: '250 Mbps',
    benchmarkTime: '~0.3s / 10MB',
    desc: 'Đường hầm VPN cá nhân WireGuard'
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare WAN',
    badge: 'Cloudflare WAN',
    url: 'https://duydevstudio.alphadaniel.io.vn',
    hostname: 'duydevstudio.alphadaniel.io.vn',
    speed: '1 - 3 MB/s',
    benchmarkTime: 'Tùy mạng 4G',
    desc: 'Đường hầm truy cập từ xa khi không bật VPN'
  }
];

export function getCurrentHighway() {
  if (typeof window === 'undefined') return HIGHWAYS[3];
  const h = window.location.hostname;
  return HIGHWAYS.find(item => item.hostname === h) || HIGHWAYS[3];
}

export function isDirectHighway() {
  const current = getCurrentHighway();
  return current.id === 'tailscale' || current.id === 'lan' || current.id === 'wireguard';
}

/**
 * Switch active host/origin
 */
export function switchHighway(targetUrl) {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash || '';
  const fullTarget = targetUrl.replace(/\/+$/, '') + (hash.startsWith('#') ? hash : hash ? `#${hash}` : '');

  if (window.AndroidBridge && typeof window.AndroidBridge.switchHost === 'function') {
    window.AndroidBridge.switchHost(targetUrl);
    return;
  }
  window.location.href = fullTarget;
}

/**
 * Probe an individual highway endpoint
 */
export async function probeHighway(highway, timeoutMs = 800) {
  if (typeof window === 'undefined') return { reachable: false, latencyMs: -1 };

  // Use Native Android Bridge if available
  if (window.AndroidBridge && typeof window.AndroidBridge.probeHighway === 'function') {
    try {
      const raw = window.AndroidBridge.probeHighway(highway.url, timeoutMs);
      return JSON.parse(raw);
    } catch (_) {}
  }

  // Browser fetch probe (no-cors for cross-origin LAN/VPN detection)
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`${highway.url}/api/v1/health`, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timer);
    return {
      reachable: true,
      latencyMs: Math.round(performance.now() - start)
    };
  } catch (_) {
    clearTimeout(timer);
    return { reachable: false, latencyMs: -1 };
  }
}

/**
 * Probe all highways in parallel
 */
export async function probeAllHighways(timeoutMs = 800) {
  if (window.AndroidBridge && typeof window.AndroidBridge.probeAllHighways === 'function') {
    try {
      const raw = window.AndroidBridge.probeAllHighways();
      const nativeResults = JSON.parse(raw);
      return HIGHWAYS.map(h => ({
        ...h,
        ...(nativeResults[h.id] || { reachable: false, latencyMs: -1 })
      }));
    } catch (_) {}
  }

  const results = await Promise.all(
    HIGHWAYS.map(async (h) => {
      const res = await probeHighway(h, timeoutMs);
      return { ...h, ...res };
    })
  );
  return results;
}
