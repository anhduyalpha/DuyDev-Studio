import { z } from 'zod';

export const youtubeResolveBodySchema = z.object({
  url: z.string().min(1, 'URL YouTube không được để trống').trim()
});

export const youtubeDownloadBodySchema = z.object({
  url: z.string().min(1, 'URL YouTube không được để trống').trim(),
  type: z.enum(['video', 'audio']).default('video'),
  quality: z.string().optional().default('best'), // '1080p' | '720p' | '480p' | '360p' | 'best' | 'mp3' | 'm4a'
  customFilename: z.string().optional(),
  saveToDrive: z.boolean().optional().default(false)
});

export const youtubeSaveDriveBodySchema = z.object({
  url: z.string().min(1, 'URL YouTube không được để trống').trim(),
  type: z.enum(['video', 'audio']).default('video'),
  quality: z.string().optional().default('best'),
  title: z.string().optional().default('youtube_media'),
  videoId: z.string().optional(),
  author: z.string().optional(),
  duration: z.number().optional(),
  cover: z.string().optional(),
  overwrite: z.boolean().optional().default(false)
});

export interface YouTubeFormatOption {
  formatId: string;
  note: string;
  ext: string;
  resolution?: string;
  filesizeApprox?: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface YouTubeVideoData {
  id: string;
  title: string;
  description: string;
  uploader: string;
  uploaderId?: string;
  uploaderUrl?: string;
  channel?: string;
  channelUrl?: string;
  duration: number;
  durationString: string;
  thumbnail: string;
  viewCount: number;
  likeCount?: number;
  webpageUrl: string;
  availableQualities: string[];
  hasAudioOnly: boolean;
}

export interface YouTubeDownloadResult {
  fileName: string;
  relPath: string;
  downloadUrl: string;
  viewUrl?: string;
  sizeBytes: number;
  type: 'video' | 'audio';
  format: string;
  quality: string;
  title: string;
  videoId: string;
  savedToDrive?: boolean;
}
