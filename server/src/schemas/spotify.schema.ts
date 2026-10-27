import { z } from 'zod';

export const spotifyResolveBodySchema = z.object({
  url: z.string().min(1, 'Spotify URL is required').trim(),
  refresh: z.boolean().optional()
});

export const spotifyDownloadBodySchema = z.object({
  url: z.string().min(1, 'Spotify URL is required').trim(),
  quality: z.enum(['128', '256', '320']).default('320'),
  customFilename: z.string().optional(),
  saveToDrive: z.boolean().default(false)
});

export const spotifyStreamQuerySchema = z.object({
  url: z.string().optional(),
  file: z.string().optional(),
  name: z.string().optional(),
  filename: z.string().optional(),
  download: z.union([z.string(), z.boolean()]).optional()
});

export const spotifySaveDriveBodySchema = z.object({
  url: z.string().min(1, 'Spotify track URL is required').trim(),
  title: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  cover: z.string().optional(),
  duration: z.number().optional(),
  audioUrl: z.string().optional(),
  overwrite: z.boolean().default(false)
});

export const spotifyCheckDuplicateSchema = z.object({
  url: z.string().optional(),
  id: z.string().optional(),
  title: z.string().optional()
});

export interface SpotifyTrackData {
  id: string;
  url: string;
  title: string;
  artist: string;
  album?: string;
  cover: string;
  duration: number; // in seconds
  releaseDate?: string;
  downloadUrl?: string;
  fileSizeInBytes?: number;
  fileSizeInKb?: number;
  fileSizeInMb?: string;
  status: 'success' | 'ready';
  existingInDrive?: any;
  extractor: 'api' | 'ytdlp' | 'oembed';
  sourceTitle?: string;
  sourceChannel?: string;
  matchScore?: number;
}
