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
  url: z.string().optional().default(''),
  title: z.string().optional().default('tiktok_video'),
  id: z.string().optional().default(''),
  tiktokVideoId: z.string().optional(),
  originalUrl: z.string().optional(),
  cover: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      uniqueId: z.string().optional(),
      nickname: z.string().optional(),
      avatar: z.string().optional()
    })
  ]).optional(),
  duration: z.number().optional(),
  overwrite: z.boolean().optional().default(false),
  isSlideshow: z.boolean().optional().default(false),
  images: z.array(z.string()).optional(),
  audioUrl: z.string().optional()
});

export const tiktokCheckDuplicateSchema = z.object({
  url: z.string().optional(),
  id: z.string().optional()
});

export interface ExistingDriveItem {
  fileName: string;
  relPath: string;
  sizeBytes: number;
  title?: string;
  thumbnail?: string;
  tiktokVideoId?: string;
  author?: string;
  duration?: number;
  updatedAt?: string;
}

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
  videoUrl: string; // standard no watermark CDN link (or first image URL for slideshow)
  videoHdUrl?: string; // HD no watermark link if available
  audioUrl?: string; // MP3 sound link
  isSlideshow?: boolean;
  images?: string[];
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    playCount?: number;
    diggCount?: number;
    commentCount?: number;
    shareCount?: number;
  };
  extractor: 'ssr' | 'resolver' | 'ytdlp';
  existingInDrive?: ExistingDriveItem | null;
}
