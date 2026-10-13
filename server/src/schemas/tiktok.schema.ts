import { z } from 'zod';

export const tiktokResolveBodySchema = z.object({
  url: z.string().min(1, 'TikTok URL is required').trim()
});

export const tiktokStreamQuerySchema = z.object({
  url: z.string().min(1, 'Target media URL is required'),
  download: z.union([z.string(), z.boolean()]).optional(),
  filename: z.string().optional()
});

export const tiktokSaveDriveBodySchema = z.object({
  url: z.string().min(1, 'Target media URL is required'),
  title: z.string().optional().default('tiktok_video'),
  id: z.string().optional().default('')
});

export interface TikTokVideoData {
  id: string;
  title: string;
  author: {
    uniqueId: string;
    nickname: string;
    avatar: string;
  };
  cover: string;
  duration: number;
  videoUrl: string; // standard no watermark CDN link
  videoHdUrl?: string; // HD no watermark link if available
  audioUrl?: string; // MP3 sound link
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  extractor: 'ssr' | 'resolver' | 'ytdlp';
}
