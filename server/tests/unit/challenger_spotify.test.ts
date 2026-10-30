import { describe, it, expect } from 'vitest';
import { SpotifyService } from '../../src/services/spotify.service.js';
import { BadRequestError } from '../../src/lib/errors.js';

describe('Adversarial Challenge: SpotifyService Remediation', () => {

  describe('1. cleanTitle Surgical Cleansing & Edge Cases', () => {
    it('preserves essential parentheses in classic song titles', () => {
      expect(SpotifyService.cleanTitle("(Don't Fear) The Reaper")).toBe("(Don't Fear) The Reaper");
      expect(SpotifyService.cleanTitle("(I Can't Get No) Satisfaction")).toBe("(I Can't Get No) Satisfaction");
      expect(SpotifyService.cleanTitle("(Sittin' On) The Dock of the Bay")).toBe("(Sittin' On) The Dock of the Bay");
      expect(SpotifyService.cleanTitle("(You Make Me Feel Like) A Natural Woman")).toBe("(You Make Me Feel Like) A Natural Woman");
      expect(SpotifyService.cleanTitle("(Ghost) Riders in the Sky")).toBe("(Ghost) Riders in the Sky");
    });

    it('surgically strips metadata tags in parentheses and brackets', () => {
      expect(SpotifyService.cleanTitle("Hotel California (2013 Remaster)")).toBe("Hotel California");
      expect(SpotifyService.cleanTitle("Starboy (feat. Daft Punk)")).toBe("Starboy");
      expect(SpotifyService.cleanTitle("Bad Guy [Official Audio]")).toBe("Bad Guy");
      expect(SpotifyService.cleanTitle("Thriller (Deluxe Edition)")).toBe("Thriller");
      expect(SpotifyService.cleanTitle("Billie Jean (Anniversary Edition)")).toBe("Billie Jean");
      expect(SpotifyService.cleanTitle("Hey Jude (Mono Version)")).toBe("Hey Jude");
      expect(SpotifyService.cleanTitle("Bohemian Rhapsody (Stereo)")).toBe("Bohemian Rhapsody");
      expect(SpotifyService.cleanTitle("Lose Yourself (Explicit)")).toBe("Lose Yourself");
      expect(SpotifyService.cleanTitle("Radioactive [Bonus Track]")).toBe("Radioactive");
      expect(SpotifyService.cleanTitle("Sunflower (ft. Swae Lee)")).toBe("Sunflower");
    });

    it('handles combined essential parentheses and metadata brackets', () => {
      expect(SpotifyService.cleanTitle("(Don't Fear) The Reaper (2020 Remaster)")).toBe("(Don't Fear) The Reaper");
      expect(SpotifyService.cleanTitle("(I Can't Get No) Satisfaction [Official Audio]")).toBe("(I Can't Get No) Satisfaction");
    });

    it('handles non-Latin and Vietnamese titles cleanly', () => {
      expect(SpotifyService.cleanTitle("Định Mệnh (2024 Remaster)")).toBe("Định Mệnh");
      expect(SpotifyService.cleanTitle("残酷な天使のテーゼ [2009 Remaster]")).toBe("残酷な天使のテーゼ");
      // Note: [2009 VERSION] or (Acoustic Version) retains version intentionally so acoustic/radio/Taylor's versions are not flattened
      expect(SpotifyService.cleanTitle("Song (Acoustic Version)")).toBe("Song (Acoustic Version)");
    });

    it('safely handles degenerate and edge inputs', () => {
      expect(SpotifyService.cleanTitle("")).toBe("");
      expect(SpotifyService.cleanTitle("   ")).toBe("");
      // When entire title consists of metadata brackets, does not collapse to empty string
      expect(SpotifyService.cleanTitle("(Remastered)")).toBe("(Remastered)");
      // Invalid types
      expect(SpotifyService.cleanTitle(null as any)).toBe("");
      expect(SpotifyService.cleanTitle(undefined as any)).toBe("");
      expect(SpotifyService.cleanTitle(12345 as any)).toBe("");
    });
  });

  describe('2. calculateMatchScore Anti-Remix & Scoring Robustness', () => {
    const expectedOriginal = {
      title: "Định Mệnh",
      artist: "Noo Phước Thịnh",
      duration: 296
    };

    it('awards high score (>= 80) to authoritative studio Topic video', () => {
      const topicCandidate = {
        title: "Định Mệnh",
        channel: "Noo Phước Thịnh - Topic",
        track: "Định Mệnh",
        artist: "Noo Phước Thịnh",
        duration: 296
      };
      const score = SpotifyService.calculateMatchScore(topicCandidate, expectedOriginal);
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('penalizes unwanted remix heavily (-100 penalty)', () => {
      const remixCandidate = {
        title: "Định Mệnh (Vinahouse Remix TikTok 2024)",
        channel: "DJ EDM Vietnam",
        duration: 296
      };
      const score = SpotifyService.calculateMatchScore(remixCandidate, expectedOriginal);
      expect(score).toBeLessThan(0);
    });

    it('penalizes unwanted live recording (-60 penalty)', () => {
      const liveCandidate = {
        title: "Định Mệnh (Live Concert The Heroes)",
        channel: "Noo Phước Thịnh",
        duration: 296
      };
      const score = SpotifyService.calculateMatchScore(liveCandidate, expectedOriginal);
      expect(score).toBeLessThan(40);
    });

    it('penalizes unwanted karaoke or instrumental (-80 penalty)', () => {
      const karaokeCandidate = {
        title: "Định Mệnh - Karaoke Tone Nam Chuẩn",
        channel: "Karaoke Beat Studio",
        duration: 296
      };
      const score = SpotifyService.calculateMatchScore(karaokeCandidate, expectedOriginal);
      expect(score).toBeLessThan(0);
    });

    it('disqualifies candidate with duration difference > 15 seconds (-999)', () => {
      const longCandidate = {
        title: "Định Mệnh",
        channel: "Noo Phước Thịnh",
        duration: 315 // diff = 19s
      };
      const score = SpotifyService.calculateMatchScore(longCandidate, expectedOriginal);
      expect(score).toBe(-999);
    });

    it('allows legitimate remix when expected title contains remix keyword', () => {
      const expectedRemix = {
        title: "Levitating (The Blessed Madonna Remix)",
        artist: "Dua Lipa",
        duration: 250
      };
      const candidateRemix = {
        title: "Dua Lipa - Levitating (The Blessed Madonna Remix) [Official Audio]",
        channel: "Dua Lipa",
        track: "Levitating (The Blessed Madonna Remix)",
        artist: "Dua Lipa",
        duration: 250
      };
      const score = SpotifyService.calculateMatchScore(candidateRemix, expectedRemix);
      expect(score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('3. extractCanonicalInfo Canonical Parsing & Validation', () => {
    it('correctly parses standard track URL and strips tracking parameters', () => {
      const url = 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123xyz&utm_source=copy-link';
      const info = SpotifyService.extractCanonicalInfo(url);
      expect(info.type).toBe('track');
      expect(info.id).toBe('4cOdK2wGLETKBW3PvgPWqT');
      expect(info.canonicalUrl).toBe('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    });

    it('correctly parses internationalized track URL (e.g. /intl-es/track/)', () => {
      const url = 'https://open.spotify.com/intl-es/track/70LcF31zb4XZ6crZ1Bp5bT';
      const info = SpotifyService.extractCanonicalInfo(url);
      expect(info.type).toBe('track');
      expect(info.id).toBe('70LcF31zb4XZ6crZ1Bp5bT');
    });

    it('correctly parses album and playlist entities', () => {
      const albumUrl = 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3';
      const playlistUrl = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M';
      expect(SpotifyService.extractCanonicalInfo(albumUrl).type).toBe('album');
      expect(SpotifyService.extractCanonicalInfo(playlistUrl).type).toBe('playlist');
    });

    it('throws BadRequestError on non-Spotify or corrupted URLs', () => {
      expect(() => SpotifyService.extractCanonicalInfo('https://youtube.com/watch?v=123')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractCanonicalInfo('https://open.spotify.com/track/invalid-id')).toThrow(BadRequestError);
      expect(() => SpotifyService.extractCanonicalInfo('')).toThrow(BadRequestError);
    });
  });

});
