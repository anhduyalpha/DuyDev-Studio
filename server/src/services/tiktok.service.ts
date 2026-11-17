/**
 * TikTok Service - Multi-tier Video & Audio Extractor & Stream Manager
 * Native replacement for n8n TikTok Downloader workflow.
 */

import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable, Transform } from 'stream';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FastifyReply } from 'fastify';
import { TikTokVideoData, ExistingDriveItem } from '../schemas/tiktok.schema.js';
import { StorageManager } from '../storage/storage.manager.js';
import { resolvedStoragePaths } from '../config/env.config.js';
import { DriveService } from './drive.service.js';
import { prisma } from '../lib/prisma.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import {
  extractBalancedJsonAt,
  streamTranscodedMp3,
  tryCobaltResolver,
  tryEvilOctalApi
} from './shared/media-extractor.helper.js';

const execFileAsync = promisify(execFile);

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DOUYIN_MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

export class TikTokService {
  static isDouyinUrl(url: string): boolean {
    return /(?:douyin\.com|iesdouyin\.com|douyinvod\.com|snssdk\.com|amemv\.com|byteimg\.com|pstatp\.com|zjcdn\.com)/i.test(url || '');
  }

  static getStreamReferer(targetUrl: string): string {
    return this.isDouyinUrl(targetUrl) ? 'https://www.douyin.com/' : 'https://www.tiktok.com/';
  }

  /**
   * Cleans and normalizes raw text input to a TikTok or Douyin URL (supports protocol-less shortlinks & Chinese share copy)
   */
  static extractUrl(rawText: string): string {
    const trimmed = (rawText || '').trim();
    const urlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:[a-zA-Z0-9_-]+\.)?(?:tiktok\.com|douyin\.com|iesdouyin\.com)\/[^\s"'>]*/i
    );
    if (!urlMatch) {
      throw new BadRequestError('Liên kết không hợp lệ. Vui lòng dán liên kết TikTok hoặc Douyin hợp lệ.');
    }
    let clean = urlMatch[0].replace(/[.,;!?)"'\]>]+$/, '');
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    return clean;
  }

  /**
   * Expands short TikTok & Douyin URLs (vt/vm.tiktok.com, v.douyin.com, iesdouyin.com) and canonicalizes modal_id links
   */
  static async expandUrl(rawUrl: string): Promise<string> {
    const cleanUrl = this.extractUrl(rawUrl);

    const normalizeDouyinModal = (u: string): string => {
      const modalMatch = u.match(/[?&]modal_id=(\d+)/i);
      if (modalMatch && u.includes('douyin.com')) {
        return `https://www.douyin.com/video/${modalMatch[1]}`;
      }
      return u;
    };

    if (!/(?:vt\.tiktok\.com|vm\.tiktok\.com|v\.douyin\.com|m\.douyin\.com|iesdouyin\.com\/share)/i.test(cleanUrl)) {
      return normalizeDouyinModal(cleanUrl);
    }

    try {
      const res = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.isDouyinUrl(cleanUrl) ? DOUYIN_MOBILE_UA : DEFAULT_UA
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(6500)
      });
      return normalizeDouyinModal(res.url || cleanUrl);
    } catch (err: any) {
      logger.warn({ err: err?.message, cleanUrl }, 'Failed to expand short TikTok/Douyin URL; falling back to original');
      return normalizeDouyinModal(cleanUrl);
    }
  }

  /**
   * Multi-tier resolution:
   * - Douyin links: Native iesdouyin _ROUTER_DATA -> TikWM -> Optional Evil0ctal/Cobalt -> yt-dlp
   * - TikTok links: SSR parser -> TikWM HD -> Optional Evil0ctal/Cobalt -> yt-dlp
   */
  static async resolveVideo(rawInput: string): Promise<TikTokVideoData> {
    const targetUrl = await this.expandUrl(rawInput);
    const isDouyin = this.isDouyinUrl(targetUrl);
    logger.info({ targetUrl, isDouyin }, '[TikTok/Douyin] Resolving media...');

    // Extract ID from URL if present (video, note, photo, item)
    const idMatch = targetUrl.match(/\/(?:video|note|photo|item)\/(\d+)/i);
    const videoIdFallback = idMatch ? idMatch[1] : `tt_${Date.now()}`;

    let resolvedData: TikTokVideoData | null = null;

    // --- Tier 0 (Douyin): Native Cookieless iesdouyin _ROUTER_DATA Extractor ---
    if (isDouyin) {
      try {
        const douyinResult = await this.tryDouyinRouterExtraction(targetUrl, videoIdFallback);
        if (douyinResult) {
          logger.info({ id: douyinResult.id }, '[Douyin] Successfully resolved via Tier 0 Native _ROUTER_DATA');
          resolvedData = douyinResult;
        }
      } catch (dyErr: any) {
        logger.debug({ err: dyErr?.message }, '[Douyin] Tier 0 _ROUTER_DATA extraction skipped/failed');
      }
    }

    // --- Tier 1 (TikTok): SSR Extraction (Native n8n Scrape) ---
    if (!resolvedData && !isDouyin) {
      try {
        const ssrResult = await this.trySsrExtraction(targetUrl, videoIdFallback);
        if (ssrResult) {
          logger.info({ id: ssrResult.id }, '[TikTok] Successfully resolved via Tier 1 SSR parser');
          resolvedData = ssrResult;
        }
      } catch (ssrErr: any) {
        logger.debug({ err: ssrErr?.message }, '[TikTok] Tier 1 SSR parser bypassed/failed');
      }
    }

    // --- Tier 2: Direct High-Speed Resolver (TikWM handles both TikTok & Douyin) ---
    if (!resolvedData) {
      try {
        const resolverResult = await this.tryTikwmResolver(targetUrl, videoIdFallback);
        if (resolverResult) {
          logger.info({ id: resolverResult.id }, '[TikTok/Douyin] Successfully resolved via Tier 2 Resolver API');
          resolvedData = resolverResult;
        }
      } catch (resErr: any) {
        logger.warn({ err: resErr?.message }, '[TikTok/Douyin] Tier 2 Resolver API failed, checking fallback tiers');
      }
    }

    // --- Tier 2B: Optional Self-Hosted Evil0ctal / Cobalt Gateway ---
    if (!resolvedData) {
      try {
        const externalRes = await this.tryExternalExtractorFallback(targetUrl, videoIdFallback, isDouyin);
        if (externalRes) {
          resolvedData = externalRes;
        }
      } catch (extErr: any) {
        logger.debug({ err: extErr?.message }, '[TikTok/Douyin] Optional external gateway skipped');
      }
    }

    // --- Tier 3: yt-dlp CLI ---
    if (!resolvedData) {
      try {
        const ytdlpResult = await this.tryYtdlpExtraction(targetUrl, videoIdFallback);
        if (ytdlpResult) {
          logger.info({ id: ytdlpResult.id }, '[TikTok/Douyin] Successfully resolved via Tier 3 yt-dlp');
          resolvedData = ytdlpResult;
        }
      } catch (ytErr: any) {
        logger.error({ err: ytErr?.message }, '[TikTok/Douyin] Tier 3 yt-dlp extraction failed');
      }
    }

    if (!resolvedData) {
      throw new BadRequestError('Không thể trích xuất video TikTok/Douyin này. Video có thể đang ở chế độ riêng tư, bị xóa hoặc bị giới hạn khu vực.');
    }

    resolvedData.platform = isDouyin ? 'douyin' : 'tiktok';

    // Check if video already exists in Drive (Post-metadata Video ID & physical file check)
    const existing = await this.checkExistingInDrive(resolvedData.id, targetUrl);
    resolvedData.existingInDrive = existing.exists ? existing.item : null;
    return resolvedData;
  }

  /**
   * Tier 0 (Douyin): Native Cookieless iesdouyin _ROUTER_DATA Parser (Video, Notes Photo Album, Live Photo & BGM MP3)
   */
  private static async tryDouyinRouterExtraction(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const idMatch = targetUrl.match(/\/(?:video|note|slides|share\/video)\/(\d+)/i) || targetUrl.match(/[?&]modal_id=(\d+)/i);
    const awemeId = idMatch?.[1] || fallbackId;
    if (!/^\d{10,}$/.test(awemeId)) return null;

    const shareUrl = `https://www.iesdouyin.com/share/video/${awemeId}/`;
    const res = await fetch(shareUrl, {
      headers: {
        'User-Agent': DOUYIN_MOBILE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.douyin.com/'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) return null;
    const html = await res.text();
    const routerIdx = html.indexOf('_ROUTER_DATA');
    if (routerIdx === -1) return null;

    const braceStart = html.indexOf('{', routerIdx);
    const jsonText = extractBalancedJsonAt(html, braceStart);
    if (!jsonText) return null;

    let routerData: any;
    try {
      routerData = JSON.parse(jsonText);
    } catch {
      return null;
    }

    const loaderEntries = Object.values(routerData?.loaderData || {}) as any[];
    let item: any = null;
    for (const entry of loaderEntries) {
      if (entry?.videoInfoRes?.item_list?.[0]) {
        item = entry.videoInfoRes.item_list[0];
        break;
      }
    }
    if (!item) return null;

    const stripWatermark = (u?: string) => (u ? u.replace(/\/playwm\//g, '/play/') : '');

    // Extract images & Douyin Live Photo video clips for /note/ or photo albums
    const rawImages = Array.isArray(item.images) ? item.images : [];
    const isSlideshow = rawImages.length > 0;
    const images = rawImages
      .map((img: any) => img?.url_list?.[0] || img?.download_url_list?.[0] || '')
      .filter(Boolean);
    const livePhotoVideos = rawImages
      .map((img: any) => stripWatermark(img?.video?.play_addr?.url_list?.[0] || ''))
      .filter(Boolean);

    // Pick highest-bitrate unwatermarked MP4 stream
    const bitRates = Array.isArray(item.video?.bit_rate) ? [...item.video.bit_rate] : [];
    bitRates.sort((a: any, b: any) => Number(b?.bit_rate || 0) - Number(a?.bit_rate || 0));
    const hdPlay = stripWatermark(bitRates[0]?.play_addr?.url_list?.[0] || '');
    const stdPlay = stripWatermark(item.video?.play_addr?.url_list?.[0] || '');
    const videoUrl = stdPlay || hdPlay || images[0] || '';
    if (!videoUrl && !isSlideshow) return null;

    const audioUrl = item.music?.play_url?.url_list?.[0] || '';
    const cover =
      item.video?.origin_cover?.url_list?.[0] ||
      item.video?.cover?.url_list?.[0] ||
      images[0] ||
      '';

    const statsObj = item.statistics || {};
    const views = Number(statsObj.play_count || 0);
    const likes = Number(statsObj.digg_count || 0);
    const comments = Number(statsObj.comment_count || 0);
    const shares = Number(statsObj.share_count || 0);

    return {
      id: String(item.aweme_id || awemeId),
      title: item.desc || `Douyin Media ${awemeId}`,
      author: {
        uniqueId: item.author?.unique_id || item.author?.short_id || String(item.author?.uid || 'douyin_user'),
        nickname: item.author?.nickname || 'Douyin Creator',
        avatar: item.author?.avatar_thumb?.url_list?.[0] || ''
      },
      cover,
      duration: Math.round(Number(item.duration || item.video?.duration || 0) / (Number(item.duration || 0) > 1000 ? 1000 : 1)),
      videoUrl,
      videoHdUrl: hdPlay && hdPlay !== videoUrl ? hdPlay : undefined,
      audioUrl: audioUrl || undefined,
      isSlideshow: isSlideshow || undefined,
      images: images.length > 0 ? images : undefined,
      livePhotoVideos: livePhotoVideos.length > 0 ? livePhotoVideos : undefined,
      platform: 'douyin',
      stats: {
        views,
        likes,
        comments,
        shares,
        playCount: views,
        diggCount: likes,
        commentCount: comments,
        shareCount: shares
      },
      extractor: 'douyin-router'
    };
  }

  /**
   * Tier 2B: Optional Self-Hosted Evil0ctal or Cobalt Gateway Fallback
   */
  private static async tryExternalExtractorFallback(
    targetUrl: string,
    fallbackId: string,
    isDouyin: boolean
  ): Promise<TikTokVideoData | null> {
    if (isDouyin) {
      const ev = await tryEvilOctalApi(targetUrl);
      if (ev) {
        const images = Array.isArray(ev.image_data?.no_watermark_image_list)
          ? ev.image_data.no_watermark_image_list.filter(Boolean)
          : undefined;
        const hdPlay = ev.video_data?.nwm_video_url_HQ || ev.video_data?.nwm_video_url;
        const stdPlay = ev.video_data?.nwm_video_url || hdPlay || images?.[0] || '';
        if (stdPlay || (images && images.length > 0)) {
          return {
            id: String(ev.aweme_id || fallbackId),
            title: ev.desc || `Douyin Media ${fallbackId}`,
            author: {
              uniqueId: ev.author?.unique_id || ev.author?.short_id || 'douyin_user',
              nickname: ev.author?.nickname || 'Douyin Creator',
              avatar: ev.author?.avatar_thumb?.url_list?.[0] || ''
            },
            cover: ev.cover_data?.origin_cover?.url_list?.[0] || ev.cover_data?.cover?.url_list?.[0] || images?.[0] || '',
            duration: Number(ev.duration || 0),
            videoUrl: stdPlay,
            videoHdUrl: hdPlay && hdPlay !== stdPlay ? hdPlay : undefined,
            audioUrl: ev.music?.play_url?.url_list?.[0] || undefined,
            isSlideshow: Boolean(images && images.length > 0),
            images,
            platform: 'douyin',
            stats: {
              views: Number(ev.statistics?.play_count || 0),
              likes: Number(ev.statistics?.digg_count || 0),
              comments: Number(ev.statistics?.comment_count || 0),
              shares: Number(ev.statistics?.share_count || 0)
            },
            extractor: 'evil0ctal'
          };
        }
      }
    }

    const cobalt = await tryCobaltResolver(targetUrl);
    if (cobalt?.url || (cobalt?.picker && cobalt.picker.length > 0)) {
      const imgs = cobalt.picker?.filter((p) => p.type === 'photo').map((p) => p.url) || [];
      const vids = cobalt.picker?.filter((p) => p.type === 'video').map((p) => p.url) || [];
      return {
        id: fallbackId,
        title: cobalt.filename ? cobalt.filename.replace(/\.[^.]+$/, '') : `${isDouyin ? 'Douyin' : 'TikTok'} Media ${fallbackId}`,
        author: { uniqueId: isDouyin ? 'douyin_user' : 'tiktok_user', nickname: isDouyin ? 'Douyin' : 'TikTok', avatar: '' },
        cover: cobalt.picker?.[0]?.thumb || imgs[0] || '',
        duration: 0,
        videoUrl: vids[0] || cobalt.url || imgs[0] || '',
        audioUrl: cobalt.picker && cobalt.url ? cobalt.url : undefined,
        isSlideshow: imgs.length > 0 ? true : undefined,
        images: imgs.length > 0 ? imgs : undefined,
        livePhotoVideos: vids.length > 0 && imgs.length > 0 ? vids : undefined,
        platform: isDouyin ? 'douyin' : 'tiktok',
        stats: { views: 0, likes: 0, comments: 0, shares: 0 },
        extractor: 'cobalt'
      };
    }
    return null;
  }

  /**
   * Tier 1: SSR HTML Scraping (matching n8n node 2 & 3)
   */
  private static async trySsrExtraction(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Check for Slardar WAF challenge page
    if (html.includes('_wafchallengeid') || html.includes('Please wait...')) {
      return null;
    }

    let itemStruct: any = null;

    // Check __UNIVERSAL_DATA_FOR_REHYDRATION__
    const matchUni = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application\/json">([\s\S]*?)<\/script>/);
    if (matchUni) {
      try {
        const parsed = JSON.parse(matchUni[1]);
        itemStruct = parsed?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
      } catch {}
    }

    // Check SIGI_STATE
    if (!itemStruct) {
      const matchSigi = html.match(/<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/);
      if (matchSigi) {
        try {
          const parsed = JSON.parse(matchSigi[1]);
          const itemModule = parsed?.ItemModule;
          const firstKey = itemModule ? Object.keys(itemModule)[0] : null;
          if (firstKey) itemStruct = itemModule[firstKey];
        } catch {}
      }
    }

    let isSlideshow = false;
    let images: string[] = [];

    if (itemStruct?.imagePost?.images && Array.isArray(itemStruct.imagePost.images) && itemStruct.imagePost.images.length > 0) {
      isSlideshow = true;
      images = itemStruct.imagePost.images.map((img: any) => {
        return (
          img?.imageURL?.urlList?.[0] ||
          img?.displayImage?.urlList?.[0] ||
          img?.thumbnail?.urlList?.[0] ||
          ''
        );
      }).filter(Boolean);
    } else if (Array.isArray(itemStruct?.images) && itemStruct.images.length > 0) {
      isSlideshow = true;
      images = itemStruct.images.map((img: any) => {
        if (typeof img === 'string') return img;
        return img?.urlList?.[0] || img?.imageURL?.urlList?.[0] || '';
      }).filter(Boolean);
    }

    if (!itemStruct || (!itemStruct.video?.playAddr && !isSlideshow)) {
      return null;
    }

    const videoUrl = itemStruct.video?.playAddr || (images.length > 0 ? images[0] : '');
    const id = itemStruct.id || fallbackId;
    const title = itemStruct.desc || `TikTok Video ${id}`;
    const author = {
      uniqueId: itemStruct.author?.uniqueId || itemStruct.author?.id || 'tiktok_user',
      nickname: itemStruct.author?.nickname || itemStruct.author?.uniqueId || 'Người dùng TikTok',
      avatar: itemStruct.author?.avatarThumb || itemStruct.author?.avatarMedium || ''
    };
    const cover = itemStruct.video?.cover || itemStruct.video?.originCover || (images.length > 0 ? images[0] : '');
    const duration = Number(itemStruct.video?.duration || 0);
    const audioUrl = itemStruct.music?.playUrl || '';
    const statsViews = Number(itemStruct.stats?.playCount || 0);
    const statsLikes = Number(itemStruct.stats?.diggCount || 0);
    const statsComments = Number(itemStruct.stats?.commentCount || 0);
    const statsShares = Number(itemStruct.stats?.shareCount || 0);
    const stats = {
      views: statsViews,
      likes: statsLikes,
      comments: statsComments,
      shares: statsShares,
      playCount: statsViews,
      diggCount: statsLikes,
      commentCount: statsComments,
      shareCount: statsShares
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      audioUrl: audioUrl || undefined,
      isSlideshow: isSlideshow || undefined,
      images: images.length > 0 ? images : undefined,
      stats,
      extractor: 'ssr'
    };
  }

  /**
   * Tier 2: TikWM API Resolver
   */
  private static async tryTikwmResolver(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': DEFAULT_UA },
      signal: AbortSignal.timeout(7000)
    });

    if (!res.ok) return null;
    const json = await res.json() as any;

    if (json.code !== 0 || !json.data) {
      return null;
    }

    const d = json.data;
    const id = String(d.id || fallbackId);
    const title = d.title || `TikTok Video ${id}`;
    const author = {
      uniqueId: d.author?.unique_id || d.author?.id || 'tiktok_user',
      nickname: d.author?.nickname || d.author?.unique_id || 'Người dùng TikTok',
      avatar: d.author?.avatar || ''
    };
    const duration = Number(d.duration || 0);

    // Make sure play URLs are absolute
    const ensureAbsolute = (u?: string) => {
      if (!u) return '';
      if (u.startsWith('http')) return u;
      return `https://www.tikwm.com${u}`;
    };

    const isSlideshow = Array.isArray(d.images) && d.images.length > 0;
    const images = isSlideshow ? d.images.map((img: string) => ensureAbsolute(img)).filter(Boolean) : undefined;

    const videoUrl = ensureAbsolute(d.play) || (images && images.length > 0 ? images[0] : '');
    const videoHdUrl = ensureAbsolute(d.hdplay);
    const audioUrl = ensureAbsolute(d.music || d.music_info?.play);
    const cover = d.cover || d.origin_cover || (images && images.length > 0 ? images[0] : '');

    const statsViews = Number(d.play_count || 0);
    const statsLikes = Number(d.digg_count || 0);
    const statsComments = Number(d.comment_count || 0);
    const statsShares = Number(d.share_count || 0);
    const stats = {
      views: statsViews,
      likes: statsLikes,
      comments: statsComments,
      shares: statsShares,
      playCount: statsViews,
      diggCount: statsLikes,
      commentCount: statsComments,
      shareCount: statsShares
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      videoHdUrl: videoHdUrl && videoHdUrl !== videoUrl ? videoHdUrl : undefined,
      audioUrl: audioUrl || undefined,
      isSlideshow: isSlideshow || undefined,
      images: images && images.length > 0 ? images : undefined,
      stats,
      extractor: 'resolver'
    };
  }

  /**
   * Tier 3: Local yt-dlp CLI
   */
  private static async tryYtdlpExtraction(targetUrl: string, fallbackId: string): Promise<TikTokVideoData | null> {
    const { stdout } = await execFileAsync('yt-dlp', [
      '--dump-json',
      '--no-warnings',
      '--no-check-certificates',
      targetUrl
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    if (!info) return null;

    const id = String(info.id || fallbackId);
    const title = info.title || info.description || `TikTok Video ${id}`;
    const author = {
      uniqueId: info.uploader_id || info.uploader || 'tiktok_user',
      nickname: info.channel || info.uploader || 'Người dùng TikTok',
      avatar: ''
    };
    const duration = Number(info.duration || 0);

    let isSlideshow = false;
    let images: string[] = [];
    if (Array.isArray(info.entries) && info.entries.length > 0) {
      images = info.entries.map((e: any) => e?.url || e?.thumbnail || '').filter(Boolean);
      if (images.length > 0) isSlideshow = true;
    } else if (Array.isArray(info.thumbnails) && info.formats && info.formats.length === 0) {
      images = info.thumbnails.map((t: any) => t?.url).filter(Boolean);
      if (images.length > 0) isSlideshow = true;
    }

    const videoUrl = info.url || (info.formats && info.formats[info.formats.length - 1]?.url) || (images.length > 0 ? images[0] : '');
    const audioUrl = info.audio_channels ? (info.url || '') : undefined;
    const cover = info.thumbnail || (images.length > 0 ? images[0] : '');

    const statsViews = Number(info.view_count || 0);
    const statsLikes = Number(info.like_count || 0);
    const statsComments = Number(info.comment_count || 0);
    const statsShares = Number(info.repost_count || 0);
    const stats = {
      views: statsViews,
      likes: statsLikes,
      comments: statsComments,
      shares: statsShares,
      playCount: statsViews,
      diggCount: statsLikes,
      commentCount: statsComments,
      shareCount: statsShares
    };

    return {
      id,
      title,
      author,
      cover,
      duration,
      videoUrl,
      audioUrl: audioUrl || undefined,
      isSlideshow: isSlideshow || undefined,
      images: images.length > 0 ? images : undefined,
      stats,
      extractor: 'ytdlp'
    };
  }

  /**
   * Proxies CDN media stream with Range requests (HTTP 206) and proper Referer
   */
  static async proxyStream(
    targetUrl: string,
    download: boolean,
    filename: string,
    rangeHeader: string | undefined,
    reply: FastifyReply,
    format?: 'mp3'
  ): Promise<void> {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': DEFAULT_UA,
      'Referer': this.getStreamReferer(targetUrl)
    };

    if (format === 'mp3') {
      return streamTranscodedMp3({
        sourceUrl: targetUrl,
        headers: upstreamHeaders,
        filename,
        reply
      });
    }

    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(60000)
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      throw new BadRequestError(`Upstream CDN responded with error: ${upstreamRes.status} ${upstreamRes.statusText}`);
    }

    // Forward status (200 or 206)
    reply.status(upstreamRes.status);

    // Forward streaming headers
    const ext = (filename || '').toLowerCase();
    let defaultMime = 'video/mp4';
    if (ext.endsWith('.mp3')) defaultMime = 'audio/mpeg';
    else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) defaultMime = 'image/jpeg';
    else if (ext.endsWith('.png')) defaultMime = 'image/png';
    else if (ext.endsWith('.webp')) defaultMime = 'image/webp';
    else if (ext.endsWith('.zip')) defaultMime = 'application/zip';

    const contentType = upstreamRes.headers.get('content-type') || defaultMime;
    reply.header('Content-Type', contentType);
    reply.header('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      reply.header('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      reply.header('Content-Range', contentRange);
    }

    if (download) {
      const safeName = filename || 'tiktok_video.mp4';
      const encodedName = encodeURIComponent(safeName);
      const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
      reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    } else {
      reply.header('Content-Disposition', 'inline');
      reply.header('Cache-Control', 'public, max-age=86400, immutable');
    }

    if (!upstreamRes.body) {
      return reply.send(Buffer.alloc(0));
    }

    const nodeReadable = Readable.fromWeb(upstreamRes.body as any);
    return reply.send(nodeReadable);
  }

  /**
   * Checks if a TikTok video already exists in Studio Drive (`/data/storage/drive/tiktok/`)
   * Verifies both metadata / ID and physical file existence on disk.
   */
  static async checkExistingInDrive(
    videoId?: string,
    originalUrl?: string
  ): Promise<{ exists: boolean; item?: ExistingDriveItem }> {
    const tiktokDir = path.join(resolvedStoragePaths.drive, 'tiktok');
    if (!fs.existsSync(tiktokDir)) {
      return { exists: false };
    }

    const cleanId = (videoId || '').trim();
    const normInputUrl = (originalUrl || '')
      .split('?')[0]
      .replace(/\/$/, '')
      .toLowerCase();

    // If neither ID nor URL is provided, cannot check
    if (!cleanId && !normInputUrl) {
      return { exists: false };
    }

    try {
      const files = await fsPromises.readdir(tiktokDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isDirectory()) continue;
        if (!file.name.endsWith('.mp4') && !file.name.endsWith('.webm') && !file.name.endsWith('.mkv') && !file.name.endsWith('.zip')) continue;

        const videoDiskPath = path.join(tiktokDir, file.name);
        // CRUCIAL: Physical File Verification
        if (!fs.existsSync(videoDiskPath)) continue;

        let isMatch = false;
        let meta: any = null;

        const baseName = file.name.replace(/\.[^.]+$/, '');
        const metaPath = path.join(tiktokDir, `${baseName}.meta.json`);

        if (fs.existsSync(metaPath)) {
          try {
            const raw = await fsPromises.readFile(metaPath, 'utf8');
            meta = JSON.parse(raw);
          } catch {}
        }

        // 1. Check by Video ID
        if (cleanId) {
          if (meta?.tiktokVideoId && String(meta.tiktokVideoId) === cleanId) {
            isMatch = true;
          } else if (file.name.includes(cleanId.slice(-10))) {
            isMatch = true;
          }
        }

        // 2. Check by Normalized URL
        if (!isMatch && normInputUrl) {
          if (meta?.originalUrl) {
            const normMetaUrl = meta.originalUrl.split('?')[0].replace(/\/$/, '').toLowerCase();
            if (normMetaUrl === normInputUrl) {
              isMatch = true;
            }
          }
          // Also check if URL contains video ID that matches filename
          const urlIdMatch = normInputUrl.match(/\/video\/(\d+)/i) || normInputUrl.match(/item\/(\d+)/i);
          if (urlIdMatch && file.name.includes(urlIdMatch[1].slice(-10))) {
            isMatch = true;
          }
        }

        if (isMatch) {
          const stat = await fsPromises.stat(videoDiskPath);
          return {
            exists: true,
            item: {
              fileName: file.name,
              relPath: `/tiktok/${file.name}`,
              sizeBytes: stat.size,
              title: meta?.title || file.name,
              thumbnail: meta?.thumbnail,
              tiktokVideoId: meta?.tiktokVideoId || cleanId,
              author: meta?.author,
              duration: meta?.duration,
              updatedAt: stat.mtime.toISOString()
            }
          };
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, '[TikTok] Error checking existing file in Drive');
    }

    return { exists: false };
  }

  /**
   * Saves TikTok video stream directly into DD Studio Drive (`/data/storage/drive/tiktok/`)
   */
  static async saveToDrive(
    mediaUrl = '',
    title = 'tiktok_video',
    id = '',
    originalUrl = '',
    cover = '',
    author?: any,
    duration?: number,
    overwrite = false,
    isSlideshow = false,
    images?: string[],
    audioUrl?: string
  ): Promise<{ success: boolean; fileName: string; relPath: string; sizeBytes: number; fileId: string; metadata?: any }> {
    // 0. Auto-resolve if raw TikTok URL was passed directly as mediaUrl or originalUrl without streams
    const candidateUrl = (mediaUrl || originalUrl || '').trim();
    const isDirectTikTokPage = candidateUrl.includes('tiktok.com') || candidateUrl.includes('douyin.com');
    const isCdnStream = candidateUrl.includes('tiktokcdn') || candidateUrl.includes('tikwm') || candidateUrl.includes('byteoversea');

    if (isDirectTikTokPage && !isCdnStream && (!images || images.length === 0)) {
      logger.info({ candidateUrl }, '[TikTok] Raw TikTok page URL passed to saveToDrive; auto-resolving metadata...');
      const resolved = await this.resolveVideo(candidateUrl);
      return this.saveToDrive(
        resolved.videoHdUrl || resolved.videoUrl || '',
        resolved.title,
        resolved.id,
        candidateUrl,
        resolved.cover,
        resolved.author,
        resolved.duration,
        overwrite,
        Boolean(resolved.isSlideshow),
        resolved.images,
        resolved.audioUrl
      );
    }

    // 1. Target directory
    const tiktokDir = path.join(resolvedStoragePaths.drive, 'tiktok');
    if (!fs.existsSync(tiktokDir)) {
      await fsPromises.mkdir(tiktokDir, { recursive: true });
    }

    // 2. Handle Slideshow / Carousel Posts
    if ((isSlideshow || (!mediaUrl && images && images.length > 0)) && images && images.length > 0) {
      const sanitizedTitle = (title || 'album')
        .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 60)
        .trim()
        .replace(/^_+|_+$/g, '');

      const cleanId = (id || Date.now().toString(36)).slice(-10);
      const fileName = `[TikTok]_${sanitizedTitle || 'album'}_${cleanId}.zip`;
      const targetFilePath = path.join(tiktokDir, fileName);

      if (overwrite) {
        try {
          if (fs.existsSync(targetFilePath)) {
            await StorageManager.unlinkSafe(targetFilePath);
            await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
            await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
          }
        } catch {}
      }

      logger.info({ fileName, targetFilePath, slideCount: images.length }, '[TikTok] Saving slideshow bundle to Studio Drive...');

      const tempFolder = path.join(resolvedStoragePaths.temp, `tt_slides_${cleanId}_${Date.now()}`);
      await fsPromises.mkdir(tempFolder, { recursive: true });

      let byteCount = 0;
      const hash = crypto.createHash('sha256');

      try {
        // Download each slide image into temp folder
        for (let i = 0; i < images.length; i++) {
          const imgUrl = images[i];
          try {
            const res = await fetch(imgUrl, {
              headers: { 'User-Agent': DEFAULT_UA, 'Referer': 'https://www.tiktok.com/' },
              signal: AbortSignal.timeout(30000)
            });
            if (res.ok) {
              const buf = Buffer.from(await res.arrayBuffer());
              const slideName = `slide_${String(i + 1).padStart(2, '0')}.jpg`;
              await fsPromises.writeFile(path.join(tempFolder, slideName), buf);
            }
          } catch (imgErr: any) {
            logger.warn({ err: imgErr?.message, index: i }, '[TikTok] Failed to fetch slide image for zip bundle');
          }
        }

        // Download background audio if available
        if (audioUrl) {
          try {
            const audioRes = await fetch(audioUrl, {
              headers: { 'User-Agent': DEFAULT_UA, 'Referer': 'https://www.tiktok.com/' },
              signal: AbortSignal.timeout(30000)
            });
            if (audioRes.ok) {
              const audioBuf = Buffer.from(await audioRes.arrayBuffer());
              await fsPromises.writeFile(path.join(tempFolder, 'audio.mp3'), audioBuf);
            }
          } catch (aErr: any) {
            logger.warn({ err: aErr?.message }, '[TikTok] Failed to fetch audio for slideshow zip bundle');
          }
        }

        // Package into ZIP using Python standard library zipfile
        const pyScript = `
import zipfile, os, sys
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in sorted(os.listdir(src)):
        p = os.path.join(src, f)
        if os.path.isfile(p):
            zf.write(p, f)
`;
        try {
          await execFileAsync('python3', ['-c', pyScript, tempFolder, targetFilePath]);
        } catch {
          await execFileAsync('python', ['-c', pyScript, tempFolder, targetFilePath]);
        }

        const stat = await fsPromises.stat(targetFilePath);
        byteCount = stat.size;

        const zipBuf = await fsPromises.readFile(targetFilePath);
        hash.update(zipBuf);
      } catch (zipErr: any) {
        await StorageManager.unlinkSafe(targetFilePath);
        throw new BadRequestError(`Lỗi đóng gói album ảnh TikTok: ${zipErr?.message}`);
      } finally {
        await fsPromises.rm(tempFolder, { recursive: true, force: true }).catch(() => {});
      }

      // Cache thumbnail locally (first slide or cover)
      let thumbnailDataUri = '';
      const coverUrl = cover || images[0];
      if (coverUrl && coverUrl.startsWith('http')) {
        try {
          const coverRes = await fetch(coverUrl, {
            headers: { 'User-Agent': DEFAULT_UA, 'Referer': 'https://www.tiktok.com/' },
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

      const authorHandle = typeof author === 'string' ? author : (author?.uniqueId || author?.nickname || 'tiktok_user');
      const authorNickname = typeof author === 'object' ? author?.nickname : authorHandle;
      const authorAvatar = typeof author === 'object' ? author?.avatar : '';

      const metadata = {
        tiktokVideoId: id || cleanId,
        originalUrl: originalUrl || '',
        title: title || 'TikTok Slideshow',
        author: authorHandle,
        authorNickname,
        authorAvatar,
        thumbnail: thumbnailDataUri || coverUrl || '',
        duration: duration || 0,
        isSlideshow: true,
        slideCount: images.length,
        savedAt: new Date().toISOString()
      };

      const metaFilePath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
      try {
        await fsPromises.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf8');
      } catch (metaErr: any) {
        logger.warn({ err: metaErr?.message }, '[TikTok] Failed to write sidecar metadata file for slideshow');
      }

      const hashSha256 = hash.digest('hex');
      const fileId = `fil_tt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

      try {
        await prisma.fileRecord.create({
          data: {
            id: fileId,
            purpose: 'PROCESSED',
            originalName: fileName,
            storagePath: targetFilePath,
            mimeType: 'application/zip',
            sizeBytes: BigInt(byteCount),
            hashSha256,
            isPurged: false,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        });
      } catch (dbErr: any) {
        logger.warn({ err: dbErr?.message }, '[TikTok] Could not create prisma fileRecord; disk file is preserved');
      }

      DriveService.invalidateStatsCache();

      return {
        success: true,
        fileName,
        relPath: `tiktok/${fileName}`,
        sizeBytes: byteCount,
        fileId,
        metadata
      };
    }

    // 3. Handle Standard Video Stream
    if (!mediaUrl) {
      throw new BadRequestError('Không tìm thấy đường dẫn video để lưu');
    }

    const sanitizedTitle = (title || 'video')
      .replace(/[\\/:*?"<>|#@$%^&*]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 60)
      .trim()
      .replace(/^_+|_+$/g, '');

    const cleanId = (id || Date.now().toString(36)).slice(-10);
    const fileName = `[TikTok]_${sanitizedTitle || 'clip'}_${cleanId}.mp4`;
    const targetFilePath = path.join(tiktokDir, fileName);

    // If overwrite is requested, purge any existing matching files
    if (overwrite) {
      try {
        if (fs.existsSync(targetFilePath)) {
          await StorageManager.unlinkSafe(targetFilePath);
          await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.meta.json'));
          await StorageManager.unlinkSafe(targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg'));
        }
      } catch {}
    }

    logger.info({ fileName, targetFilePath }, '[TikTok] Saving video directly to Studio Drive...');

    // 3. Fetch from upstream with streaming pipeline
    const upstreamRes = await fetch(mediaUrl, {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Referer': this.getStreamReferer(mediaUrl)
      },
      signal: AbortSignal.timeout(120000)
    });

    if (!upstreamRes.ok || !upstreamRes.body) {
      throw new BadRequestError(`Không thể tải video từ TikTok CDN (Mã lỗi: ${upstreamRes.status})`);
    }

    const hash = crypto.createHash('sha256');
    let byteCount = 0;

    const hashingStream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteCount += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      }
    });

    const fileWriteStream = fs.createWriteStream(targetFilePath, { highWaterMark: 4 * 1024 * 1024 });
    const nodeReadable = Readable.fromWeb(upstreamRes.body as any);

    try {
      await pipeline(nodeReadable, hashingStream, fileWriteStream);
    } catch (err: any) {
      await StorageManager.unlinkSafe(targetFilePath);
      throw new BadRequestError(`Lỗi ghi tệp video vào Drive: ${err?.message}`);
    }

    if (byteCount === 0) {
      await StorageManager.unlinkSafe(targetFilePath);
      throw new BadRequestError('Video tải về có dung lượng 0 byte');
    }

    // 4. Cache thumbnail locally so it never expires with TikTok CDN tokens
    let thumbnailDataUri = '';
    if (cover && cover.startsWith('http')) {
      try {
        const coverRes = await fetch(cover, {
          headers: {
            'User-Agent': DEFAULT_UA,
            'Referer': this.getStreamReferer(cover)
          },
          signal: AbortSignal.timeout(10000)
        });
        if (coverRes.ok) {
          const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
          const contentType = coverRes.headers.get('content-type') || 'image/jpeg';
          thumbnailDataUri = `data:${contentType};base64,${coverBuffer.toString('base64')}`;
          const thumbPath = targetFilePath.replace(/\.[^.]+$/, '.thumb.jpg');
          await fsPromises.writeFile(thumbPath, coverBuffer).catch(() => {});
        }
      } catch (coverErr: any) {
        logger.debug({ err: coverErr?.message }, '[TikTok] Could not cache cover image locally; keeping remote URL');
      }
    }

    // 5. Persist enriched metadata sidecar (.meta.json)
    const authorHandle = typeof author === 'string' ? author : (author?.uniqueId || author?.nickname || 'tiktok_user');
    const authorNickname = typeof author === 'object' ? author?.nickname : authorHandle;
    const authorAvatar = typeof author === 'object' ? author?.avatar : '';

    const metadata = {
      tiktokVideoId: id || cleanId,
      originalUrl: originalUrl || '',
      title: title || 'TikTok Video',
      author: authorHandle,
      authorNickname,
      authorAvatar,
      thumbnail: thumbnailDataUri || cover || '',
      duration: duration || 0,
      savedAt: new Date().toISOString()
    };

    const metaFilePath = targetFilePath.replace(/\.[^.]+$/, '.meta.json');
    try {
      await fsPromises.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (metaErr: any) {
      logger.warn({ err: metaErr?.message }, '[TikTok] Failed to write sidecar metadata file');
    }

    const hashSha256 = hash.digest('hex');
    const fileId = `fil_tt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

    // 6. Index in Prisma FileRecord
    try {
      await prisma.fileRecord.create({
        data: {
          id: fileId,
          purpose: 'PROCESSED',
          originalName: fileName,
          storagePath: targetFilePath,
          mimeType: 'video/mp4',
          sizeBytes: BigInt(byteCount),
          hashSha256,
          isPurged: false,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // permanent 1 year
        }
      });
    } catch (dbErr: any) {
      logger.warn({ err: dbErr?.message }, '[TikTok] Could not create prisma fileRecord; disk file is preserved');
    }

    // 7. Invalidate Drive telemetry cache
    DriveService.invalidateStatsCache();

    return {
      success: true,
      fileName,
      relPath: `tiktok/${fileName}`,
      sizeBytes: byteCount,
      fileId,
      metadata
    };
  }
}
