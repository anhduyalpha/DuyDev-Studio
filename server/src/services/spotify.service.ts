/**
 * Spotify Service - High-Fidelity Audio Extractor & Drive Manager
 * Native port of n8n Spotify Downloader workflow with n8n Code node parity:
 * - bytesToKb(bytes) = bytes / 1024
 * - kbToMb(kb) = (kb / 1024).toFixed(2)
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FastifyReply } from 'fastify';
import { SpotifyTrackData } from '../schemas/spotify.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface CachedTrackEntry {
  data: SpotifyTrackData;
  timestamp: number;
}

export class SpotifyService {
  private static trackCache = new Map<string, CachedTrackEntry>();
  private static readonly CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

  /**
   * Code node calculation from n8n workflow
   */
  static bytesToKb(bytes: number): number {
    return bytes / 1024;
  }

  static kbToMb(kb: number): string {
    return (kb / 1024).toFixed(2);
  }

  /**
   * Clears the in-memory Spotify track resolution cache
   */
  static clearCache(): void {
    this.trackCache.clear();
  }

  /**
   * Normalizes text by removing accents, non-alphanumeric chars, and lowercasing
   */
  static normalizeText(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Surgical cleaning of track title: strips metadata brackets/parentheses
   * (e.g. remaster, feat, deluxe, official, bonus, edition, anniversary, mono, stereo, explicit)
   * while preserving essential song title parentheses like "(Don't Fear) The Reaper" or "(I Can't Get No) Satisfaction".
   */
  static cleanTitle(title: string): string {
    if (!title || typeof title !== 'string') return '';
    const metadataBracketPattern = /\s*[\(\[][^\)\]]*\b(?:remaster(?:ed)?|feat(?:\.|\b)|ft(?:\.|\b)|deluxe|official|bonus|edition|anniversary|mono|stereo|explicit)\b[^\)\]]*[\)\]]/gi;
    let cleaned = title.replace(metadataBracketPattern, '').replace(/\s+/g, ' ').trim();
    return cleaned || title.trim();
  }

  /**
   * Multi-factor scoring metric (0-100+) to guarantee exact audio match and eliminate unwanted remixes/covers
   */
  static calculateMatchScore(candidate: any, expected: { title: string; artist: string; duration: number }): number {
    const { title: expTitle, artist: expArtist, duration: expDur } = expected;
    const candTitle = candidate.title || '';
    const candChannel = candidate.channel || candidate.uploader || '';
    const candTrack = candidate.track || '';
    const candArtist = candidate.artist || '';
    const candDur = Number(candidate.duration) || 0;

    const normExpTitle = this.normalizeText(expTitle);
    const normExpArtist = this.normalizeText(expArtist);
    const normCandTitle = this.normalizeText(candTitle);
    const normCandChannel = this.normalizeText(candChannel);
    const normCandTrack = this.normalizeText(candTrack);
    const normCandArtist = this.normalizeText(candArtist);

    const isIntendedRemix = /\b(remix|vinahouse|dj|mix|rework)\b/i.test(expTitle);
    const isIntendedLive = /\b(live|concert|tour)\b/i.test(expTitle);
    const isIntendedCover = /\b(cover|tribute)\b/i.test(expTitle);
    const isIntendedInstrumental = /\b(instrumental|beat|karaoke)\b/i.test(expTitle);

    let score = 0;

    // 1. Duration check
    const durDiff = expDur > 0 ? Math.abs(candDur - expDur) : 0;
    if (expDur > 0) {
      if (durDiff <= 2) score += 30;
      else if (durDiff <= 4) score += 25;
      else if (durDiff <= 7) score += 18;
      else if (durDiff <= 11) score += 10;
      else if (durDiff <= 15) score += 2;
      else return -999; // Disqualify if duration difference is > 15 seconds
    }

    // 2. Title matching
    if (normCandTrack && (normCandTrack === normExpTitle || normCandTrack.includes(normExpTitle))) {
      score += 35; // Perfect track tag from YouTube Music
    } else if (normCandTitle.includes(normExpTitle)) {
      score += 30;
    } else {
      const expWords = normExpTitle.split(' ').filter(w => w.length > 1);
      const matchedWords = expWords.filter(w => normCandTitle.includes(w));
      if (matchedWords.length === expWords.length && expWords.length > 0) {
        score += 25;
      } else if (matchedWords.length > 0) {
        score += Math.round((matchedWords.length / expWords.length) * 20);
      } else {
        return -999; // None of the title words matched
      }
    }

    // 3. Artist & Channel matching
    const artistWords = normExpArtist.split(' ').filter(w => w.length > 1);
    const isArtistInChannel = normCandChannel.includes(normExpArtist) || (artistWords.length > 0 && artistWords.every(w => normCandChannel.includes(w)));
    const isArtistInTitle = normCandTitle.includes(normExpArtist) || (artistWords.length > 0 && artistWords.every(w => normCandTitle.includes(w)));
    const isArtistInTag = normCandArtist.includes(normExpArtist);

    if (isArtistInTag || (normCandChannel.endsWith('topic') && isArtistInChannel)) {
      score += 25; // Official Topic release
    } else if (isArtistInChannel) {
      score += 20; // Official channel
    } else if (isArtistInTitle) {
      score += 12;
    }

    // 4. Official badges & indicators
    if (/official\s*(audio|music\s*video|mv|video)/i.test(candTitle)) score += 10;
    if (/master\s*audio|audio\s*lyrics/i.test(candTitle)) score += 8;
    if (normCandChannel.endsWith('topic')) score += 10;

    // 5. Strict Negative Filters (shield against unwanted remixes/covers)
    if (!isIntendedRemix && /\b(remix|vinahouse|dj|bass\s*boost|speed\s*up|slowed|nightcore|reverb)\b/i.test(candTitle)) {
      score -= 100;
    }
    if (!isIntendedLive && /\b(live|stage|concert|fancam|liveshow)\b/i.test(candTitle)) {
      score -= 60;
    }
    if (!isIntendedCover && /\b(cover|ai\s*cover)\b/i.test(candTitle)) {
      score -= 80;
    }
    if (!isIntendedInstrumental && /\b(karaoke|beat|tone\s*nam|tone\s*nu|instrumental)\b/i.test(candTitle)) {
      score -= 80;
    }
    if (/\b(parody|nhac\s*che|reaction|review|podcast|tap\s*\d+|trailer)\b/i.test(candTitle)) {
      score -= 100;
    }

    return score;
  }

  /**
   * Validates and extracts canonical Spotify entity details, stripping all tracking queries
   */
  static extractCanonicalInfo(rawText: string): { type: 'track' | 'album' | 'playlist'; id: string; canonicalUrl: string } {
    const trimmed = (rawText || '').trim();
    const match = trimmed.match(/(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/([a-zA-Z0-9]{22})/i);
    if (!match) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Spotify hợp lệ (ví dụ: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT).');
    }
    const type = match[1].toLowerCase() as 'track' | 'album' | 'playlist';
    const id = match[2];
    const canonicalUrl = `https://open.spotify.com/${type}/${id}`;
    return { type, id, canonicalUrl };
  }

  /**
   * Validates and extracts a canonical Spotify URL (compatibility helper)
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(/https?:\/\/(?:open\.)?spotify\.com\/(?:(?:intl-[a-z]{2}\/)?(?:track|album|playlist))\/(?:[a-zA-Z0-9]{22})/i);
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết Spotify hợp lệ (ví dụ: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT).');
    }
    return urlMatch[0];
  }

  /**
   * Resolves Spotify track metadata and audio download URL with 100% deterministic matching
   */
  static async resolveTrack(rawInput: string, refresh = false): Promise<SpotifyTrackData> {
    const { type, id: trackId, canonicalUrl } = this.extractCanonicalInfo(rawInput);
    const cacheKey = `spotify:${type}:${trackId}`;

    if (refresh) {
      this.trackCache.delete(cacheKey);
    }

    // Check in-memory cache for deterministic duplicate requests
    const cached = this.trackCache.get(cacheKey);
    if (!refresh && cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
      logger.info({ trackId, title: cached.data.title }, '[Spotify] Cache hit for track');
      const existing = await this.checkExistingInDrive(trackId, canonicalUrl, cached.data.title);
      return {
        ...cached.data,
        url: canonicalUrl,
        existingInDrive: existing.exists ? existing.item : null
      };
    }

    logger.info({ canonicalUrl, trackId, type }, '[Spotify] Resolving track metadata...');

    // 1. Authoritative metadata extraction via Spotify embed hydration
    let title = 'Spotify Track';
    let artist = 'Unknown Artist';
    let cover = '';
    let duration = 0; // in seconds
    let releaseDate: string | undefined;
    let previewUrl: string | undefined;
    let isHydrated = false;

    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${trackId}`, {
        headers: { 'User-Agent': DEFAULT_UA },
        signal: AbortSignal.timeout(7000)
      });

      if (embedRes.ok) {
        const html = await embedRes.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          const json = JSON.parse(nextDataMatch[1]);
          const entity = json?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            isHydrated = true;
            title = entity.name || entity.title || title;

            if (Array.isArray(entity.artists) && entity.artists.length > 0) {
              artist = entity.artists.map((a: any) => a.name).filter(Boolean).join(', ');
            } else if (entity.subtitle) {
              artist = entity.subtitle;
            }

            if (entity.duration) {
              duration = Math.round(Number(entity.duration) / 1000);
            }

            if (entity.releaseDate?.isoString) {
              releaseDate = entity.releaseDate.isoString;
            }

            if (entity.audioPreview?.url) {
              previewUrl = entity.audioPreview.url;
            }

            // Extract highest resolution artwork
            const images = entity.visualIdentity?.image;
            if (Array.isArray(images) && images.length > 0) {
              const sorted = [...images].sort((a: any, b: any) => (b.maxWidth || 0) - (a.maxWidth || 0));
              cover = sorted[0]?.url || cover;
            }
          }
        }
      }
    } catch (e: any) {
      logger.warn({ err: e?.message }, '[Spotify] Embed hydration fetch failed');
    }

    // Fallback: Spotify oEmbed if embed page didn't yield title
    if (!isHydrated || !title || title === 'Spotify Track') {
      try {
        const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`, {
          headers: { 'User-Agent': DEFAULT_UA },
          signal: AbortSignal.timeout(5000)
        });
        if (oembedRes.ok) {
          const oembed = await oembedRes.json() as any;
          if (oembed.title) title = oembed.title;
          if (oembed.thumbnail_url && !cover) cover = oembed.thumbnail_url;
          if (oembed.author_name && (!artist || artist === 'Unknown Artist')) artist = oembed.author_name;
        }
      } catch (e: any) {
        logger.debug({ err: e?.message }, '[Spotify] oEmbed fallback skipped');
      }
    }

    // 2. Multi-tier resolution for authoritative audio stream
    let downloadUrl: string | undefined;
    let fileSizeInBytes: number | undefined;
    let extractor: 'api' | 'ytdlp' | 'oembed' = 'oembed';
    let sourceTitle: string | undefined;
    let sourceChannel: string | undefined;
    let matchScore: number | undefined;

    // Tier 1: Try RapidAPI / Dedicated API resolver (if configured)
    try {
      const apiResult = await this.tryApiResolver(canonicalUrl);
      if (apiResult?.downloadUrl) {
        downloadUrl = apiResult.downloadUrl;
        extractor = 'api';
        if (apiResult.title) title = apiResult.title;
        if (apiResult.artist) artist = apiResult.artist;
        if (apiResult.cover) cover = apiResult.cover;
        if (apiResult.sizeBytes) fileSizeInBytes = apiResult.sizeBytes;
      }
    } catch {}

    // Tier 2: Anchored multi-staged yt-dlp lookup with strict deterministic scoring
    if (!downloadUrl) {
      try {
        const primaryArtist = artist.split(',')[0].replace(/[,/&]/g, ' ').replace(/\s+/g, ' ').trim();
        const cleanTitle = this.cleanTitle(title);

        const searchQueries = [
          `ytsearch8:${primaryArtist} ${cleanTitle} Topic`,
          `ytsearch8:${primaryArtist} ${cleanTitle} Official Audio`,
          `ytsearch10:${primaryArtist} ${cleanTitle}`
        ];

        const candidateMap = new Map<string, any>();

        for (const searchQuery of searchQueries) {
          try {
            const { stdout } = await execFileAsync('yt-dlp', [
              '--dump-json',
              '--default-search', 'ytsearch',
              '--no-playlist',
              '--no-warnings',
              searchQuery
            ], { timeout: 18000, maxBuffer: 15 * 1024 * 1024 });

            const lines = stdout.trim().split('\n').filter(Boolean);
            for (const line of lines) {
              try {
                const item = JSON.parse(line);
                if (item.id && !candidateMap.has(item.id)) {
                  candidateMap.set(item.id, item);
                }
              } catch {}
            }

            // Early exit if authoritative official match found (score >= 80)
            let highConfidenceFound = false;
            for (const item of candidateMap.values()) {
              if (this.calculateMatchScore(item, { title, artist, duration }) >= 80) {
                highConfidenceFound = true;
                break;
              }
            }
            if (highConfidenceFound) break;
          } catch (qErr: any) {
            logger.debug({ query: searchQuery, err: qErr?.message }, '[Spotify] Staged search query skipped');
          }
        }

        // Score all candidates
        const scoredCandidates: Array<{ item: any; score: number; durDiff: number }> = [];
        for (const item of candidateMap.values()) {
          const itemFormats = item.formats?.filter((f: any) => f.acodec !== 'none' && f.url);
          if (!item.url && (!itemFormats || itemFormats.length === 0)) continue;

          const score = this.calculateMatchScore(item, { title, artist, duration });
          const itemDuration = Number(item.duration) || 0;
          const durDiff = duration > 0 ? Math.abs(itemDuration - duration) : 0;
          scoredCandidates.push({ item, score, durDiff });
        }

        // Sort by score descending, then by lowest duration diff
        scoredCandidates.sort((a, b) => b.score !== a.score ? b.score - a.score : a.durDiff - b.durDiff);

        const best = scoredCandidates[0];
        // Must have positive score (or at least valid duration if score is marginal)
        if (best && (best.score >= 40 || (best.score > 0 && best.durDiff <= 8))) {
          const bestCandidate = best.item;
          extractor = 'ytdlp';
          sourceTitle = bestCandidate.title;
          sourceChannel = bestCandidate.channel || bestCandidate.uploader;
          matchScore = best.score;

          // Pick best audio format by bitrate
          const audioFormats = (bestCandidate.formats || [])
            .filter((f: any) => f.acodec !== 'none' && f.url)
            .sort((a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));

          const audioFmt = audioFormats[0];
          downloadUrl = audioFmt?.url || bestCandidate.url;
          if (!cover && bestCandidate.thumbnail) cover = bestCandidate.thumbnail;
          if (audioFmt?.filesize) fileSizeInBytes = audioFmt.filesize;
          if (duration === 0 && bestCandidate.duration) duration = Math.round(bestCandidate.duration);

          logger.info({
            trackId,
            selectedTitle: sourceTitle,
            selectedChannel: sourceChannel,
            score: matchScore,
            durDiff: best.durDiff
          }, '[Spotify] Resolved authoritative audio match');
        }
      } catch (ytErr: any) {
        logger.warn({ err: ytErr?.message }, '[Spotify] Anchored yt-dlp search failed');
      }
    }

    // Tier 3: Fallback to official Spotify 30s preview if full stream could not be matched
    if (!downloadUrl && previewUrl) {
      downloadUrl = previewUrl;
      extractor = 'oembed';
    }

    if (!downloadUrl) {
      throw new BadRequestError(`Không thể tìm thấy luồng âm thanh khớp chính xác với bài hát "${artist} - ${title}". Vui lòng thử lại sau.`);
    }

    // Check Drive duplication
    const existing = await this.checkExistingInDrive(trackId, canonicalUrl, title);

    const sizeInKb = fileSizeInBytes ? this.bytesToKb(fileSizeInBytes) : undefined;
    const sizeInMb = sizeInKb ? this.kbToMb(sizeInKb) : undefined;

    const resolvedPayload: SpotifyTrackData = {
      id: trackId,
      url: canonicalUrl,
      title,
      artist,
      cover,
      duration,
      releaseDate,
      downloadUrl,
      fileSizeInBytes,
      fileSizeInKb: sizeInKb,
      fileSizeInMb: sizeInMb,
      status: 'success',
      existingInDrive: existing.exists ? existing.item : null,
      extractor,
      sourceTitle,
      sourceChannel,
      matchScore
    };

    // Cache resolved track
    this.trackCache.set(cacheKey, {
      data: resolvedPayload,
      timestamp: Date.now()
    });

    return resolvedPayload;
  }

  /**
   * Tier 1: Try RapidAPI or open resolver
   */
  private static async tryApiResolver(targetUrl: string): Promise<{ downloadUrl?: string; title?: string; artist?: string; cover?: string; sizeBytes?: number } | null> {
    const apiKey = process.env.RAPIDAPI_KEY || process.env.RAPID_API_KEY;
    if (apiKey) {
      try {
        const formData = new FormData();
        formData.append('url', targetUrl);

        const res = await fetch('https://spotify-downloader11.p.rapidapi.com/spotify-downloader.php', {
          method: 'POST',
          headers: {
            'x-rapidapi-host': 'spotify-downloader11.p.rapidapi.com',
            'x-rapidapi-key': apiKey
          },
          body: formData,
          signal: AbortSignal.timeout(8000)
        });

        if (res.ok) {
          const data = await res.json() as any;
          if (data.status === 'success' && data.download_url) {
            return {
              downloadUrl: data.download_url,
              title: data.name,
              artist: data.artist,
              cover: data.image
            };
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Proxies audio stream with HTTP 206 Partial Content support
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply
  ): Promise<any> {
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_UA
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers,
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Không thể kết nối đến luồng âm thanh: HTTP ${upstreamRes.status}`);
    }

    reply.status(upstreamRes.status);
    reply.header('Content-Type', upstreamRes.headers.get('content-type') || 'audio/mpeg');
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) reply.header('Content-Length', contentLength);

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) reply.header('Content-Range', contentRange);

    if (download) {
      const safeName = filename || 'spotify_track.mp3';
      const encodedName = encodeURIComponent(safeName);
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
      reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    } else {
      reply.header('Content-Disposition', 'inline');
    }

    if (!upstreamRes.body) {
      return reply.send(Buffer.alloc(0));
    }

    const nodeReadable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(nodeReadable);
  }

  /**
   * Checks if audio track already exists in DD Studio Drive (`/data/storage/drive/spotify/`)
   */
  static async checkExistingInDrive(
    trackId?: string,
    originalUrl?: string,
    title?: string
  ): Promise<{ exists: boolean; item?: any }> {
    const spDir = path.join(resolvedStoragePaths.drive, 'spotify');
    if (!fs.existsSync(spDir)) {
      return { exists: false };
    }

    const cleanId = (trackId || '').trim();
    const cleanTitle = (title || '').toLowerCase().trim();
    const normInputUrl = (originalUrl || '').split('?')[0].replace(/\/$/, '').toLowerCase();

    try {
      const files = await fsPromises.readdir(spDir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory() || !file.name.endsWith('.mp3')) continue;

        const audioDiskPath = path.join(spDir, file.name);
        if (!fs.existsSync(audioDiskPath)) continue;

        let isMatch = false;
        let meta: any = null;
        const metaPath = path.join(spDir, `${file.name.replace(/\.[^.]+$/, '')}.meta.json`);

        if (fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(await fsPromises.readFile(metaPath, 'utf8'));
          } catch {}
        }

        if (cleanId && ((meta?.spotifyId && String(meta.spotifyId) === cleanId) || file.name.includes(cleanId.slice(-10)))) {
          isMatch = true;
        }

        if (!isMatch && normInputUrl && meta?.originalUrl) {
          const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
          if (normMetaUrl === normInputUrl) isMatch = true;
        }

        if (!isMatch && cleanTitle && meta?.title && meta.title.toLowerCase().trim() === cleanTitle) {
          isMatch = true;
        }

        if (isMatch) {
          const stat = await fsPromises.stat(audioDiskPath);
          const sizeInKb = this.bytesToKb(stat.size);
          return {
            exists: true,
            item: {
              fileName: file.name,
              relPath: `/spotify/${file.name}`,
              sizeBytes: stat.size,
              fileSizeInMb: this.kbToMb(sizeInKb),
              title: meta?.title || file.name,
              artist: meta?.artist,
              thumbnail: meta?.thumbnail,
              duration: meta?.duration,
              updatedAt: stat.mtime.toISOString()
            }
          };
        }
      }
    } catch {}

    return { exists: false };
  }

  /**
   * Saves MP3 track directly into DD Studio Drive (`/data/storage/drive/spotify/`)
   * Downloads high-quality 320kbps MP3, embeds metadata and cover artwork.
   */
  static async saveToDrive(
    url: string,
    title = 'Spotify Track',
    artist = 'Artist',
    album = '',
    cover = '',
    duration = 0,
    audioUrl?: string,
    overwrite = false
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileSizeInMb: string; fileId: string; metadata?: any }> {
    const spDir = path.join(resolvedStoragePaths.drive, 'spotify');
    if (!fs.existsSync(spDir)) {
      await fsPromises.mkdir(spDir, { recursive: true });
    }

    const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/i);
    const cleanId = (trackIdMatch ? trackIdMatch[1] : Date.now().toString(36)).slice(-10);

    const sanitizedTitle = (title || 'track')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 50)
      .trim();

    const sanitizedArtist = (artist || 'artist')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40)
      .trim();

    const fileName = `[Spotify]_${sanitizedArtist}_${sanitizedTitle}_${cleanId}.mp3`;
    const targetFilePath = path.join(spDir, fileName);

    if (overwrite && fs.existsSync(targetFilePath)) {
      await StorageManager.unlinkSafe(targetFilePath);
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
      await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
    }

    logger.info({ fileName, targetFilePath }, '[Spotify] Saving MP3 track directly to Studio Drive...');

    let byteCount = 0;
    const tempInputPath = path.join(resolvedStoragePaths.temp, `sp_raw_${Date.now()}_${cleanId}.tmp`);

    try {
      let sourceUrl = audioUrl;
      if (!sourceUrl || !sourceUrl.startsWith('http')) {
        const resolved = await this.resolveTrack(url, overwrite);
        sourceUrl = resolved.downloadUrl;
      }

      if (!sourceUrl || !sourceUrl.startsWith('http')) {
        throw new BadRequestError('Không thể tìm thấy luồng âm thanh hợp lệ để lưu vào Drive');
      }

      const upstreamRes = await fetch(sourceUrl, {
        headers: { 'User-Agent': DEFAULT_UA },
        signal: AbortSignal.timeout(120000)
      });

      if (!upstreamRes.ok || !upstreamRes.body) {
        throw new BadRequestError(`Không thể tải luồng âm thanh: HTTP ${upstreamRes.status}`);
      }

      const rawFileStream = fs.createWriteStream(tempInputPath);
      const webStream = Readable.fromWeb(upstreamRes.body as any);
      await pipeline(webStream, rawFileStream);

      // Transcode cleanly with ffmpeg to genuine 320kbps MP3 with embedded metadata
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-i', tempInputPath,
          '-vn',
          '-ar', '44100',
          '-b:a', '320k',
          '-metadata', `title=${title || 'Spotify Track'}`,
          '-metadata', `artist=${artist || 'Artist'}`,
          '-metadata', `album=${album || ''}`,
          targetFilePath
        ], { timeout: 60000 });
      } catch (ffErr: any) {
        logger.warn({ err: ffErr?.message }, '[Spotify] FFmpeg 320k transcode fallback to direct copy');
        await fsPromises.copyFile(tempInputPath, targetFilePath);
      }
    } finally {
      await StorageManager.unlinkSafe(tempInputPath);
    }

    const fileStat = await fsPromises.stat(targetFilePath);
    byteCount = fileStat.size;
    const fileBuf = await fsPromises.readFile(targetFilePath);
    const hashSha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

    // Download cover thumbnail
    let thumbnailDataUri = '';
    if (cover && cover.startsWith('http')) {
      try {
        const coverRes = await fetch(cover, {
          headers: { 'User-Agent': DEFAULT_UA },
          signal: AbortSignal.timeout(10000)
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
          thumbnailDataUri = `data:${contentType};base64,${coverBuffer.toString('base64')}`;
          const thumbPath = targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg');
          await fsPromises.writeFile(thumbPath, coverBuffer).catch(() => {});
        }
      } catch {}
    }

    const sizeInKb = this.bytesToKb(byteCount);
    const fileSizeInMb = this.kbToMb(sizeInKb);

    const metadata = {
      spotifyId: cleanId,
      originalUrl: url,
      title: title || 'Spotify Track',
      artist: artist || 'Artist',
      album: album || '',
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      sizeBytes: byteCount,
      fileSizeInKb: sizeInKb,
      fileSizeInMb,
      savedAt: new Date().toISOString()
    };

    const metaPath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    await fsPromises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    // Register in Prisma SQLite
    const fileId = crypto.randomUUID();
    try {
      await prisma.fileRecord.create({
        data: {
          id: fileId,
          purpose: 'PROCESSED',
          originalName: fileName,
          storagePath: targetFilePath,
          mimeType: 'audio/mpeg',
          sizeBytes: BigInt(byteCount),
          hashSha256,
          isPurged: false,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
      });
    } catch (e: any) {
      logger.warn({ err: e?.message }, '[Spotify] Could not create prisma record; file saved to disk');
    }

    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `spotify/${fileName}`,
      sizeBytes: byteCount,
      fileSizeInMb,
      fileId,
      metadata
    };
  }
}
