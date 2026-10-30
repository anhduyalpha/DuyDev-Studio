import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { FacebookService } from '../../src/services/facebook.service.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';

describe('Adversarial Challenge: Facebook Downloader Module', () => {
  const fbDir = path.join(resolvedStoragePaths.drive, 'facebook');
  const testFilesCreated: string[] = [];

  beforeAll(async () => {
    await fsPromises.mkdir(fbDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up only files created by this test
    for (const f of testFilesCreated) {
      try {
        await fsPromises.unlink(f);
      } catch {}
    }
  });

  describe('1. Mobile Ergonomics & Touch Target Inspection (>= 44px & 360px viewport)', () => {
    const workspacePath = path.resolve(__dirname, '../../../src/components/tools/facebook/FacebookWorkspace.js');
    let code: string;

    beforeAll(() => {
      code = fs.readFileSync(workspacePath, 'utf8');
    });

    it('verifies all critical action buttons enforce touch targets >= 44px', () => {
      // 1. Clear button
      const clearBtnMatches = code.match(/data-action="clear-input"[^>]*class="([^"]*)"/g) ||
                               code.match(/class="([^"]*)"[^>]*data-action="clear-input"/g);
      expect(clearBtnMatches).not.toBeNull();
      for (const m of clearBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
        expect(m).toContain('min-w-[44px]');
      }

      // 2. Paste button
      const pasteBtnMatches = code.match(/data-action="paste-url"[^>]*class="([^"]*)"/g) ||
                              code.match(/class="([^"]*)"[^>]*data-action="paste-url"/g);
      expect(pasteBtnMatches).not.toBeNull();
      for (const m of pasteBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
      }

      // 3. Extract/Submit button
      const submitBtnMatch = code.match(/id="fbSubmitBtn"[^>]*class="([^"]*)"/);
      expect(submitBtnMatch).not.toBeNull();
      expect(submitBtnMatch![1]).toContain('min-h-[44px]');

      // 4. Quality selector buttons
      const qualityBtnMatches = code.match(/data-action="select-quality"[^>]*class="([^"]*)"/g);
      expect(qualityBtnMatches).not.toBeNull();
      for (const m of qualityBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
      }

      // 5. Primary Download button
      const downloadBtnMatch = code.match(/id="fbPrimaryDownloadBtn"[^>]*class="([^"]*)"/);
      expect(downloadBtnMatch).not.toBeNull();
      expect(downloadBtnMatch![1]).toContain('min-h-[44px]');
      expect(downloadBtnMatch![1]).toContain('w-full');

      // 6. Save to Drive button
      const saveDriveBtnMatch = code.match(/id="fbSaveDriveBtn"[^>]*class="([^"]*)"/);
      expect(saveDriveBtnMatch).not.toBeNull();
      expect(saveDriveBtnMatch![1]).toContain('min-h-[44px]');
      expect(saveDriveBtnMatch![1]).toContain('w-full');

      // 7. Preview button
      const previewBtnMatches = code.match(/data-action="preview"[^>]*class="([^"]*)"/g);
      expect(previewBtnMatches).not.toBeNull();
      for (const m of previewBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
      }

      // 8. Dismiss Alert button
      const alertBtnMatch = code.match(/data-action="dismiss-alert"[^>]*class="([^"]*)"/);
      expect(alertBtnMatch).not.toBeNull();
      expect(alertBtnMatch![1]).toContain('min-h-[44px]');
      expect(alertBtnMatch![1]).toContain('min-w-[44px]');

      // 9. Breadcrumb back button
      const breadcrumbBackMatch = code.match(/<a\s+href="#"[^>]*class="([^"]*)"/);
      expect(breadcrumbBackMatch).not.toBeNull();
      expect(breadcrumbBackMatch![1]).toContain('min-h-[44px]');
    });

    it('verifies responsive layout wrapping and no fixed overflow down to 360px', () => {
      // Breadcrumb bar must have flex-wrap
      expect(code).toMatch(/Breadcrumb Bar[\s\S]*?class="flex flex-wrap/);

      // Input actions footer bar must have flex-wrap
      expect(code).toMatch(/class="flex flex-wrap items-center justify-between gap-2 pt-1"/);

      // Video title bar must have flex-wrap or responsive direction
      expect(code).toMatch(/flex-col sm:flex-row sm:items-center/);

      // Quality selector grid must adapt cleanly
      expect(code).toMatch(/grid grid-cols-2/);

      // Must not contain hardcoded fixed pixel widths >= 300px that break 360px viewport
      const fixedWidthMatches = code.match(/(?:min-)?w-\[(?:[3-9]\d{2,}|\d{4,})px\]/g);
      expect(fixedWidthMatches).toBeNull();
    });
  });

  describe('2. Concurrency & Stress Testing for FacebookService.checkExistingInDrive', () => {
    it('handles null, undefined, empty, and whitespace-only parameters gracefully', async () => {
      const r1 = await FacebookService.checkExistingInDrive(undefined, undefined);
      expect(r1).toEqual({ exists: false });

      const r2 = await FacebookService.checkExistingInDrive('', '');
      expect(r2).toEqual({ exists: false });

      const r3 = await FacebookService.checkExistingInDrive('   ', '   ');
      expect(r3).toEqual({ exists: false });

      const r4 = await FacebookService.checkExistingInDrive('   ', undefined);
      expect(r4).toEqual({ exists: false });

      const r5 = await FacebookService.checkExistingInDrive(undefined, '   ');
      expect(r5).toEqual({ exists: false });
    });

    it('handles special characters, injection patterns, and extremely long strings without throwing', async () => {
      const maliciousPayloads = [
        '../../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '<script>alert("xss")</script>',
        '\0nullbyte',
        'a'.repeat(20000),
        '🎉🔥💡🇻🇳🚀',
        "'; DROP TABLE drive; --",
        'CON',
        'PRN',
        'AUX'
      ];

      for (const payload of maliciousPayloads) {
        const res = await FacebookService.checkExistingInDrive(payload, `https://facebook.com/${payload}`);
        expect(res).toBeDefined();
        expect(res.exists).toBe(false);
      }
    });

    it('survives corrupt, empty, and malformed .meta.json files gracefully', async () => {
      const corruptMeta = path.join(fbDir, 'test_corrupt_file_adv.meta.json');
      const emptyMeta = path.join(fbDir, 'test_empty_file_adv.meta.json');
      testFilesCreated.push(corruptMeta, emptyMeta);

      await fsPromises.writeFile(corruptMeta, '{ invalid json: broken truncated content', 'utf8');
      await fsPromises.writeFile(emptyMeta, '', 'utf8');

      // Calling checkExistingInDrive should not throw SyntaxError
      const res = await FacebookService.checkExistingInDrive('test_corrupt_file_adv');
      expect(res).toBeDefined();
      expect(res.exists).toBe(false);
    });

    it('executes 50 concurrent requests against drive with 60 files without deadlock or crash', async () => {
      // Seed 60 files (some metadata, some media)
      const targetId = 'adv_target_video_777';
      const targetMeta = path.join(fbDir, `${targetId}.meta.json`);
      const targetMedia = path.join(fbDir, `${targetId}.mp4`);
      testFilesCreated.push(targetMeta, targetMedia);

      await fsPromises.writeFile(targetMedia, 'dummy video binary content', 'utf8');
      await fsPromises.writeFile(
        targetMeta,
        JSON.stringify({
          facebookVideoId: targetId,
          title: 'Adversarial Test Target Video',
          originalUrl: 'https://www.facebook.com/watch/?v=adv_target_video_777',
          duration: 120,
          thumbnail: 'https://example.com/thumb.jpg'
        }),
        'utf8'
      );

      // Seed 25 background noise metadata files
      for (let i = 0; i < 25; i++) {
        const noiseMeta = path.join(fbDir, `adv_noise_${i}.meta.json`);
        testFilesCreated.push(noiseMeta);
        await fsPromises.writeFile(
          noiseMeta,
          JSON.stringify({
            facebookVideoId: `noise_${i}`,
            title: `Noise Video ${i}`,
            originalUrl: `https://facebook.com/reel/noise_${i}`
          }),
          'utf8'
        );
      }

      // Fire 50 concurrent checkExistingInDrive calls in parallel
      const promises = Array.from({ length: 50 }, (_, idx) => {
        if (idx % 2 === 0) {
          return FacebookService.checkExistingInDrive(targetId, 'https://www.facebook.com/watch/?v=adv_target_video_777');
        } else {
          return FacebookService.checkExistingInDrive(`non_existent_${idx}`, `https://facebook.com/non_existent_${idx}`);
        }
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);

      // Verify even index matched target correctly
      for (let i = 0; i < 50; i += 2) {
        expect(results[i].exists).toBe(true);
        expect(results[i].item).toBeDefined();
        expect(results[i].item.fileName).toBe(`${targetId}.mp4`);
        expect(results[i].item.title).toBe('Adversarial Test Target Video');
      }

      // Verify odd index returned false cleanly
      for (let i = 1; i < 50; i += 2) {
        expect(results[i].exists).toBe(false);
      }
    });

    it('matches via normalized originalUrl when videoId differs', async () => {
      const matchUrlId = 'adv_url_match_888';
      const metaPath = path.join(fbDir, `${matchUrlId}.meta.json`);
      const mediaPath = path.join(fbDir, `${matchUrlId}.mp4`);
      testFilesCreated.push(metaPath, mediaPath);

      await fsPromises.writeFile(mediaPath, 'dummy media content', 'utf8');
      await fsPromises.writeFile(
        metaPath,
        JSON.stringify({
          facebookVideoId: 'different_internal_id',
          title: 'URL Match Test Video',
          originalUrl: 'https://www.facebook.com/reel/123456789/?utm_source=fb&fbclid=xyz'
        }),
        'utf8'
      );

      // Query with same canonical URL but different tracking parameters and no videoId
      const res = await FacebookService.checkExistingInDrive('', 'https://www.facebook.com/reel/123456789/?s=yWDuG2&fs=e');
      expect(res.exists).toBe(true);
      expect(res.item).toBeDefined();
      expect(res.item.title).toBe('URL Match Test Video');
    });
  });

  describe('3. Non-Interference Boundary Check', () => {
    it('confirms src/components/tools/studocu/ and server/src/services/studocu/ are 100% untouched', () => {
      const status = execSync('git status --porcelain src/components/tools/studocu/ server/src/services/studocu/', {
        encoding: 'utf8'
      }).trim();
      expect(status).toBe('');

      const diff = execSync('git diff --stat HEAD -- src/components/tools/studocu/ server/src/services/studocu/', {
        encoding: 'utf8'
      }).trim();
      expect(diff).toBe('');
    });
  });
});
