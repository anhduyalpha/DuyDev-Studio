import { z } from 'zod';

export const instagramResolveBodySchema = z.object({
  url: z.string().min(1, 'Instagram URL is required').trim()
});

export const instagramStreamQuerySchema = z.object({
  url: z.string().min(1, 'Target media URL is required'),
  download: z.union([z.string(), z.boolean()]).optional(),
  filename: z.string().optional()
});

export const instagramSaveDriveBodySchema = z.object({
  url: z.string().optional().default(''),
  title: z.string().optional().default('instagram_media'),
  id: z.string().optional().default(''),
  originalUrl: z.string().optional(),
  cover: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      username: z.string().optional(),
      fullName: z.string().optional()
    })
  ]).optional(),
  duration: z.number().optional(),
  isCarousel: z.boolean().optional().default(false),
  mediaUrls: z.array(z.string()).optional(),
  mediaType: z.enum(['video', 'image', 'carousel']).optional(),
  overwrite: z.boolean().optional().default(false)
});

export const instagramCheckDuplicateSchema = z.object({
  url: z.string().optional(),
  id: z.string().optional()
});

export interface InstagramMediaItem {
  type: 'video' | 'image';
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
}

export interface InstagramVideoData {
  id: string;
  title: string;
  caption?: string;
  author: {
    username: string;
    fullName?: string;
  };
  cover: string;
  duration: number;
  videoUrl?: string;
  imageUrl?: string;
  mediaType?: 'video' | 'image' | 'carousel';
  medias: InstagramMediaItem[];
  isCarousel?: boolean;
  existingInDrive?: any;
  extractor: 'resolver' | 'ytdlp' | 'scraper';
}
