import { spawn } from 'child_process';
import { Readable } from 'stream';
import { FastifyReply } from 'fastify';
import { BadRequestError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

/**
 * Unescapes JSON-encoded URL strings (forward slashes and Unicode ampersands/equals)
 */
export function unescapeMediaJsonUrl(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\\\\//g, '/')
    .replace(/\\\//g, '/')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u0025/gi, '%')
    .replace(/&amp;/gi, '&')
    .trim();
}

/**
 * Extracts a balanced JSON object or array literal starting at `startIndex`
 */
export function extractBalancedJsonAt(text: string, startIndex: number): string | null {
  if (!text || startIndex < 0 || startIndex >= text.length) return null;
  const openChar = text[startIndex];
  const closeChar = openChar === '{' ? '}' : openChar === '[' ? ']' : '';
  if (!closeChar) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

/**
 * Optional self-hosted Cobalt v10+ API adapter (configured via COBALT_API_URL).
 * Provides Telegram-bot-grade multi-platform resilience without breaking zero-config deployments.
 */
export async function tryCobaltResolver(
  targetUrl: string,
  options: { videoQuality?: string; isAudioOnly?: boolean; timeoutMs?: number } = {}
): Promise<{
  status: string;
  url?: string;
  filename?: string;
  picker?: Array<{ type: 'photo' | 'video' | 'gif'; url: string; thumb?: string }>;
} | null> {
  const endpoint = process.env.COBALT_API_URL?.trim();
  if (!endpoint) return null;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };
    const apiKey = process.env.COBALT_API_KEY?.trim();
    if (apiKey) {
      headers['Authorization'] = `Api-Key ${apiKey}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: targetUrl,
        videoQuality: options.videoQuality || 'max',
        downloadMode: options.isAudioOnly ? 'audio' : 'auto',
        filenameStyle: 'pretty'
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 6000)
    });

    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (!json || json.status === 'error') return null;

    if (json.status === 'tunnel' || json.status === 'redirect') {
      if (typeof json.url === 'string' && json.url.startsWith('http')) {
        return {
          status: json.status,
          url: json.url,
          filename: json.filename
        };
      }
    }

    if (json.status === 'picker' && Array.isArray(json.picker) && json.picker.length > 0) {
      return {
        status: 'picker',
        url: json.audio,
        filename: json.audioFilename,
        picker: json.picker
          .filter((p: any) => p?.url && typeof p.url === 'string')
          .map((p: any) => ({
            type: p.type === 'video' ? 'video' : p.type === 'gif' ? 'gif' : 'photo',
            url: p.url,
            thumb: p.thumb
          }))
      };
    }

    return null;
  } catch (err: any) {
    logger.debug({ err: err?.message, endpoint }, '[MediaExtractor] Cobalt adapter skipped/failed');
    return null;
  }
}

/**
 * Optional Evil0ctal Douyin_TikTok_Download_API adapter (DOUYIN_API_URL / EVILOCTAL_API_URL).
 */
export async function tryEvilOctalApi(
  targetUrl: string,
  timeoutMs = 7000
): Promise<any | null> {
  const baseUrl = (process.env.DOUYIN_API_URL || process.env.EVILOCTAL_API_URL || '').trim().replace(/\/$/, '');
  if (!baseUrl) return null;

  try {
    const endpoint = `${baseUrl}/api/hybrid/video_data?url=${encodeURIComponent(targetUrl)}&minimal=false`;
    const res = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    if (json?.code === 200 && json?.data) {
      return json.data;
    }
    return null;
  } catch (err: any) {
    logger.debug({ err: err?.message, baseUrl }, '[MediaExtractor] Evil0ctal API skipped/failed');
    return null;
  }
}

/**
 * Streams an upstream video/audio URL through FFmpeg to produce a direct MP3 download
 * without writing temporary files to disk (zero zombie subprocess leaks).
 */
export async function streamTranscodedMp3({
  sourceUrl,
  headers,
  filename,
  reply
}: {
  sourceUrl: string;
  headers: Record<string, string>;
  filename: string;
  reply: FastifyReply;
}): Promise<any> {
  const upstreamRes = await fetch(sourceUrl, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(90000)
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    try {
      await upstreamRes.body?.cancel();
    } catch {}
    throw new BadRequestError(`Không thể kết nối nguồn âm thanh: HTTP ${upstreamRes.status}`);
  }

  const mp3Name = (filename || 'audio.mp3').replace(/\.[^.]+$/, '') + '.mp3';
  const encodedName = encodeURIComponent(mp3Name);
  const asciiName = mp3Name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');

  reply.header('Content-Type', 'audio/mpeg');
  reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);

  const upstreamType = (upstreamRes.headers.get('content-type') || '').toLowerCase();
  if (upstreamType.includes('audio/mpeg') || upstreamType.includes('audio/mp3')) {
    const cl = upstreamRes.headers.get('content-length');
    if (cl) reply.header('Content-Length', cl);
    return reply.send(Readable.fromWeb(upstreamRes.body as any));
  }

  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-vn',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '2',
      '-f',
      'mp3',
      'pipe:1'
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] }
  );

  let settled = false;
  const cleanupFfmpeg = () => {
    if (settled) return;
    settled = true;
    try {
      if (!ffmpeg.killed) ffmpeg.kill('SIGKILL');
    } catch {}
  };

  reply.raw.on('close', cleanupFfmpeg);
  ffmpeg.on('error', (err) => {
    logger.warn({ err: err?.message }, '[MediaExtractor] ffmpeg audio transcode spawn error');
    cleanupFfmpeg();
  });

  const nodeInput = Readable.fromWeb(upstreamRes.body as any);
  nodeInput.on('error', () => {
    try {
      ffmpeg.stdin.end();
    } catch {}
  });
  nodeInput.pipe(ffmpeg.stdin);

  ffmpeg.stdout.on('close', () => {
    settled = true;
  });

  return reply.send(ffmpeg.stdout);
}
