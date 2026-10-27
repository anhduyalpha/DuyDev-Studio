import { z } from 'zod';

export const facebookResolveBodySchema = z.object({
  url: z.string().min(1, 'Facebook URL is required').trim()
});

export const facebookStreamQuerySchema = z.object({
  url: z.string().min(1, 'Target media URL is required'),
  download: z.union([z.string(), z.boolean()]).optional(),
  filename: z.string().optional()
});

export const facebookSaveDriveBodySchema = z.object({
  url: z.string().optional().default(''),
  title: z.string().optional().default('facebook_media'),
  id: z.string().optional().default(''),
  originalUrl: z.string().optional(),
  cover: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string().optional(),
      id: z.string().optional()
    })
  ]).optional(),
  duration: z.number().optional(),
  quality: z.string().optional(),
  mediaType: z.enum(['video', 'image', 'post']).optional().default('video'),
  ext: z.string().optional(),
  overwrite: z.boolean().optional().default(false)
});

export const facebookCheckDuplicateSchema = z.object({
  url: z.string().optional(),
  id: z.string().optional()
});

export interface FacebookMediaFormat {
  quality: 'hd' | 'sd' | 'audio' | string;
  label: string;
  url: string;
  sizeBytes?: number;
  ext: string;
}

export interface FacebookVideoData {
  id: string;
  title: string;
  author: {
    name: string;
    id?: string;
  };
  cover: string;
  duration: number;
  formats: FacebookMediaFormat[];
  videoHdUrl?: string;
  videoSdUrl?: string;
  audioUrl?: string;
  existingInDrive?: any;
  extractor: 'resolver' | 'ytdlp' | 'scraper';
  mediaType?: 'video' | 'image' | 'post';
  caption?: string;
  images?: Array<{ id?: string; url: string; label?: string }>;
}
