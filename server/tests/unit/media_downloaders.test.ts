import { describe, it, expect } from 'vitest';
import { FacebookService } from '../../src/services/facebook.service.js';
import { InstagramService } from '../../src/services/instagram.service.js';
import { SpotifyService } from '../../src/services/spotify.service.js';
import { facebookResolveBodySchema } from '../../src/schemas/facebook.schema.js';
import { instagramResolveBodySchema } from '../../src/schemas/instagram.schema.js';
import { spotifyResolveBodySchema } from '../../src/schemas/spotify.schema.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Media Downloaders Unit Test Suite', () => {
  describe('1. Facebook Downloader Service & Schemas', () => {
    it('extracts valid Facebook video and Reel URLs correctly', () => {
      const reelUrl = 'https://www.facebook.com/reel/1234567890?s=yWDuG2&fs=e';
      const watchUrl = 'https://www.facebook.com/watch/?v=9876543210';
      const fbWatchUrl = 'https://fb.watch/mXz8123abc/';

      expect(FacebookService.extractUrl(reelUrl)).toContain('facebook.com/reel/1234567890');
      expect(FacebookService.extractUrl(watchUrl)).toContain('facebook.com/watch/?v=9876543210');
      expect(FacebookService.extractUrl(fbWatchUrl)).toContain('fb.watch/mXz8123abc/');
    });

    it('rejects invalid or non-Facebook URLs with BadRequestError', () => {
      expect(() => FacebookService.extractUrl('')).toThrow(BadRequestError);
      expect(() => FacebookService.extractUrl('https://example.com/video.mp4')).toThrow(BadRequestError);
      expect(() => FacebookService.extractUrl('not a url')).toThrow(BadRequestError);
    });

    it('validates Facebook request body schema and rejects empty payload', () => {
      expect(() => facebookResolveBodySchema.parse({ url: 'https://www.facebook.com/watch/?v=123' })).not.toThrow();
      expect(() => facebookResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => facebookResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent video', async () => {
      const result = await FacebookService.checkExistingInDrive('non_existent_fb_id_99999');
      expect(result).toHaveProperty('exists', false);
    });
  });

  describe('2. Instagram Downloader Service & Schemas', () => {
    it('extracts valid Instagram Post, Reel, and Story URLs correctly', () => {
      const reelUrl = 'https://www.instagram.com/reel/Cabc123xyz/?utm_source=ig_web';
      const postUrl = 'https://www.instagram.com/p/Dxyz987abc/';
      const storyUrl = 'https://www.instagram.com/stories/some_user/1234567890123/';

      expect(InstagramService.extractUrl(reelUrl)).toContain('instagram.com/reel/Cabc123xyz');
      expect(InstagramService.extractUrl(postUrl)).toContain('instagram.com/p/Dxyz987abc');
      expect(InstagramService.extractUrl(storyUrl)).toContain('instagram.com/stories/some_user/1234567890123');
    });

    it('rejects invalid or non-Instagram URLs with BadRequestError', () => {
      expect(() => InstagramService.extractUrl('')).toThrow(BadRequestError);
      expect(() => InstagramService.extractUrl('https://tiktok.com/@user/video/123')).toThrow(BadRequestError);
      expect(() => InstagramService.extractUrl('random text')).toThrow(BadRequestError);
    });

    it('validates Instagram request body schema', () => {
      expect(() => instagramResolveBodySchema.parse({ url: 'https://www.instagram.com/reel/Cabc123/' })).not.toThrow();
      expect(() => instagramResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => instagramResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent media', async () => {
      const result = await InstagramService.checkExistingInDrive('non_existent_ig_id_88888');
      expect(result).toHaveProperty('exists', false);
    });
  });

  describe('3. Spotify Downloader Service & Exact n8n Math Parity', () => {
    it('extracts valid Spotify track URLs correctly', () => {
      const trackUrl = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=ZXw&nd=1';
      const intlTrackUrl = 'https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT';

      expect(SpotifyService.extractUrl(trackUrl)).toContain('spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      expect(SpotifyService.extractUrl(intlTrackUrl)).toContain('spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT');
    });

    it('rejects invalid or non-track Spotify URLs with BadRequestError', () => {
      expect(() => SpotifyService.extractUrl('')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractUrl('https://open.spotify.com/artist/123456')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractUrl('https://soundcloud.com/track/123')).toThrow(BadRequestError);
    });

    it('achieves exact mathematical parity with n8n Code node (bytesToKb & kbToMb)', () => {
      // n8n Code node:
      // function bytesToKb(bytes) { return bytes / 1024; }
      // function kbToMb(kb) { return (kb / 1024).toFixed(2); }

      // Test Case 1: Exactly 1 MB = 1048576 bytes
      const kb1 = SpotifyService.bytesToKb(1048576);
      expect(kb1).toBe(1024);
      expect(SpotifyService.kbToMb(kb1)).toBe('1.00');

      // Test Case 2: 3,463,942 bytes (~3.30 MB)
      const kb2 = SpotifyService.bytesToKb(3463942);
      expect(kb2).toBeCloseTo(3382.7558, 2);
      expect(SpotifyService.kbToMb(kb2)).toBe('3.30');

      // Test Case 3: 15,728,640 bytes (15 MB)
      const kb3 = SpotifyService.bytesToKb(15728640);
      expect(kb3).toBe(15360);
      expect(SpotifyService.kbToMb(kb3)).toBe('15.00');
    });

    it('validates Spotify request body schema and rejects empty payload', () => {
      expect(() => spotifyResolveBodySchema.parse({ url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' })).not.toThrow();
      expect(() => spotifyResolveBodySchema.parse({ url: '' })).toThrow();
      expect(() => spotifyResolveBodySchema.parse({})).toThrow();
    });

    it('handles Drive duplicate check gracefully for non-existent track', async () => {
      const result = await SpotifyService.checkExistingInDrive('non_existent_track_77777');
      expect(result).toHaveProperty('exists', false);
    });
  });
});
