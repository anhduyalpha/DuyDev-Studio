import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Adversarial Challenge: Spotify Downloader Module (Milestone 2)', () => {
  const workspacePath = path.resolve(__dirname, '../../../src/components/tools/spotify/SpotifyWorkspace.js');
  const apiPath = path.resolve(__dirname, '../../../src/components/tools/spotify/services/spotifyApi.js');
  let workspaceCode: string;
  let apiCode: string;

  beforeAll(() => {
    workspaceCode = fs.readFileSync(workspacePath, 'utf8');
    apiCode = fs.readFileSync(apiPath, 'utf8');
  });

  describe('1. Touch Targets & Mobile Ergonomics (>= 44px)', () => {
    it('verifies Clear button enforces touch targets >= 44px', () => {
      const clearBtnMatches = workspaceCode.match(/data-action="clear-input"[^>]*class="([^"]*)"/g) ||
                               workspaceCode.match(/class="([^"]*)"[^>]*data-action="clear-input"/g);
      expect(clearBtnMatches).not.toBeNull();
      expect(clearBtnMatches!.length).toBeGreaterThanOrEqual(1);
      for (const m of clearBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
        expect(m).toContain('min-w-[44px]');
      }
    });

    it('verifies Paste button enforces touch targets >= 44px', () => {
      const pasteBtnMatches = workspaceCode.match(/data-action="paste-url"[^>]*class="([^"]*)"/g) ||
                              workspaceCode.match(/class="([^"]*)"[^>]*data-action="paste-url"/g);
      expect(pasteBtnMatches).not.toBeNull();
      expect(pasteBtnMatches!.length).toBeGreaterThanOrEqual(1);
      for (const m of pasteBtnMatches!) {
        expect(m).toContain('min-h-[44px]');
        expect(m).toContain('min-w-[44px]');
      }
    });

    it('verifies Submit/Resolve button enforces touch target >= 44px', () => {
      const submitBtnMatch = workspaceCode.match(/id="spSubmitBtn"[^>]*class="([^"]*)"/);
      expect(submitBtnMatch).not.toBeNull();
      expect(submitBtnMatch![1]).toContain('min-h-[44px]');
    });

    it('verifies Re-resolve button enforces touch targets >= 44px', () => {
      const reResolveMatch = workspaceCode.match(/data-action="re-resolve"[^>]*class="([^"]*)"/);
      expect(reResolveMatch).not.toBeNull();
      expect(reResolveMatch![1]).toContain('min-h-[44px]');
      expect(reResolveMatch![1]).toContain('min-w-[44px]');
    });

    it('verifies Preview button enforces touch target >= 44px', () => {
      const previewBtnMatch = workspaceCode.match(/data-action="preview"[^>]*class="([^"]*)"/);
      expect(previewBtnMatch).not.toBeNull();
      expect(previewBtnMatch![1]).toContain('min-h-[44px]');
    });

    it('verifies Save to Drive button enforces touch target >= 44px', () => {
      const saveDriveBtnMatch = workspaceCode.match(/id="spSaveDriveBtn"[^>]*class="([^"]*)"/);
      expect(saveDriveBtnMatch).not.toBeNull();
      expect(saveDriveBtnMatch![1]).toContain('min-h-[44px]');
    });

    it('verifies Download button enforces touch target >= 44px', () => {
      const downloadLinkMatch = workspaceCode.match(/<a\s+href="\${downloadUrl}"[^>]*class="([^"]*)"/);
      expect(downloadLinkMatch).not.toBeNull();
      expect(downloadLinkMatch![1]).toContain('min-h-[44px]');
    });

    it('verifies Dismiss Alert and Breadcrumb buttons enforce touch targets >= 44px', () => {
      const dismissAlertMatch = workspaceCode.match(/data-action="dismiss-alert"[^>]*class="([^"]*)"/);
      expect(dismissAlertMatch).not.toBeNull();
      expect(dismissAlertMatch![1]).toContain('min-h-[44px]');
      expect(dismissAlertMatch![1]).toContain('min-w-[44px]');

      const breadcrumbMatch = workspaceCode.match(/<a\s+href="#"[^>]*class="([^"]*)"/);
      expect(breadcrumbMatch).not.toBeNull();
      expect(breadcrumbMatch![1]).toContain('min-h-[44px]');
      expect(breadcrumbMatch![1]).toContain('min-w-[44px]');
    });
  });

  describe('2. 360px Viewport Responsiveness', () => {
    it('verifies input card footer stacks on mobile and aligns on desktop', () => {
      expect(workspaceCode).toContain('flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1');
    });

    it('verifies breadcrumb bar wraps on narrow screens', () => {
      expect(workspaceCode).toMatch(/Breadcrumb Bar[\s\S]*?class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"/);
    });

    it('verifies track metadata header stacks on narrow viewports', () => {
      expect(workspaceCode).toContain('flex flex-col sm:flex-row items-start sm:items-center gap-4');
    });

    it('verifies action buttons stack vertically on mobile and 2-col on desktop', () => {
      expect(workspaceCode).toContain('grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2');
    });

    it('verifies track header badges allow flex wrapping', () => {
      expect(workspaceCode).toContain('id="spotifyTrackBadges" class="flex items-center gap-2 flex-wrap"');
    });

    it('verifies track title truncates to prevent horizontal overflow', () => {
      expect(workspaceCode).toMatch(/<h2[^>]*class="[^"]*truncate[^"]*">\${escapeHtml\(this\.trackData\.title\)}<\/h2>/);
    });

    it('verifies no rigid fixed widths exceeding 320px in workspace container', () => {
      const fixedWidthMatches = workspaceCode.match(/(?:min-)?w-\[(\d+)px\]/g) || [];
      for (const fw of fixedWidthMatches) {
        const px = parseInt(fw.match(/\d+/)![0], 10);
        expect(px).toBeLessThanOrEqual(320);
      }
    });
  });

  describe('3. Isolated History Container & In-Place DOM Mutation', () => {
    it('verifies dedicated #spotifyHistoryContainer element exists', () => {
      expect(workspaceCode).toContain('<div id="spotifyHistoryContainer">');
    });

    it('verifies saveToDrive does NOT call this.render() and preserves active audio', () => {
      const saveToDriveMatch = workspaceCode.match(/async\s+saveToDrive\(\)\s*\{([\s\S]*?)\n\s*async\s+saveHistoryItemToDrive/);
      expect(saveToDriveMatch).not.toBeNull();
      const saveToDriveBlock = saveToDriveMatch![1];
      // Must not execute this.render() (code statement check)
      const renderCalls = saveToDriveBlock.split('\n')
        .filter(line => !line.trim().startsWith('//'))
        .filter(line => /this\.render\(\)/.test(line));
      expect(renderCalls.length).toBe(0);
      expect(saveToDriveBlock).toContain('saveDriveBtn.disabled = true');
      expect(saveToDriveBlock).toContain('saveDriveBtn.disabled = false');
      expect(saveToDriveBlock).toContain('badgeSpan.id = \'spotifyDriveBadge\'');
    });

    it('verifies saveHistoryItemToDrive mutates button and badge in place', () => {
      const saveHistoryMatch = workspaceCode.match(/async\s+saveHistoryItemToDrive\([^)]*\)\s*\{([\s\S]*?)\n\s*previewInApp/);
      expect(saveHistoryMatch).not.toBeNull();
      const saveHistoryBlock = saveHistoryMatch![1];
      expect(saveHistoryBlock).toContain('saveBtn.replaceWith(driveLink)');
      expect(saveHistoryBlock).toContain('Đã lưu Drive');
    });

    it('verifies delete, restore, and perm-delete animate and remove in-place without page flickering', () => {
      const attachHistoryMatch = workspaceCode.match(/attachHistoryListeners\(\)\s*\{([\s\S]*?)\n\s*renderHistory/);
      expect(attachHistoryMatch).not.toBeNull();
      const attachHistoryBlock = attachHistoryMatch![1];
      expect(attachHistoryBlock).toContain('data-action-delete');
      expect(attachHistoryBlock).toContain('data-action-restore');
      expect(attachHistoryBlock).toContain('data-action-perm-delete');
      expect(attachHistoryBlock).toContain('card.style.opacity = \'0\'');
      expect(attachHistoryBlock).toContain('card.style.transform = \'scale(0.96) translateY(-4px)\'');
      expect(attachHistoryBlock).toContain('card.remove()');
      expect(attachHistoryBlock).toContain('countBadge.textContent = `${currentItems.length} mục`');
    });

    it('verifies unmount cleans up history listener teardown function', () => {
      expect(workspaceCode).toContain('if (this.historyCleanup) {');
      expect(workspaceCode).toContain('this.historyCleanup();');
      expect(workspaceCode).toContain('this.historyCleanup = null;');
    });
  });

  describe('4. AbortController Lifecycle Governance', () => {
    it('verifies resolveTrack aborts previous in-flight request before new call', () => {
      const resolveTrackMatch = workspaceCode.match(/async\s+resolveTrack\([^)]*\)\s*\{([\s\S]*?)\n\s*async\s+saveToDrive/);
      expect(resolveTrackMatch).not.toBeNull();
      const resolveTrackBlock = resolveTrackMatch![1];
      expect(resolveTrackBlock).toContain('if (this.abortController) {');
      expect(resolveTrackBlock).toContain('this.abortController.abort();');
      expect(resolveTrackBlock).toContain('this.abortController = new AbortController();');
      expect(resolveTrackBlock).toContain('{ signal: this.abortController.signal }');
    });

    it('verifies resolveTrack gracefully ignores AbortError', () => {
      const resolveTrackMatch = workspaceCode.match(/async\s+resolveTrack\([^)]*\)\s*\{([\s\S]*?)\n\s*async\s+saveToDrive/);
      expect(resolveTrackMatch).not.toBeNull();
      const resolveTrackBlock = resolveTrackMatch![1];
      expect(resolveTrackBlock).toContain("if (err.name === 'AbortError') return;");
    });

    it('verifies unmount aborts any in-flight request', () => {
      const unmountMatch = workspaceCode.match(/unmount\(\)\s*\{([\s\S]*?)\n\s*(?:\/\*\*|sanitizeUrl)/);
      expect(unmountMatch).not.toBeNull();
      const unmountBlock = unmountMatch![1];
      expect(unmountBlock).toContain('if (this.abortController) {');
      expect(unmountBlock).toContain('this.abortController.abort();');
      expect(unmountBlock).toContain('this.abortController = null;');
    });

    it('verifies unmount cleanly removes all DOM and window event listeners', () => {
      const unmountMatch = workspaceCode.match(/unmount\(\)\s*\{([\s\S]*?)\n\s*(?:\/\*\*|sanitizeUrl)/);
      expect(unmountMatch).not.toBeNull();
      const unmountBlock = unmountMatch![1];
      expect(unmountBlock).toContain("window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);");
      expect(unmountBlock).toContain("input.removeEventListener('input', this.boundHandleInput);");
      expect(unmountBlock).toContain("input.removeEventListener('keydown', this.boundHandleKeyDown);");
      expect(unmountBlock).toContain("this.container.removeEventListener('click', this.boundHandleClick);");
      expect(unmountBlock).toContain("this.container.innerHTML = '';");
    });

    it('verifies spotifyApi forwards AbortSignal in resolveTrack and saveToDrive', () => {
      expect(apiCode).toContain('signal');
      expect(apiCode).toMatch(/fetch\('\/api\/v1\/spotify\/resolve',\s*\{[\s\S]*?signal[\s\S]*?\}\)/);
      expect(apiCode).toMatch(/fetch\('\/api\/v1\/spotify\/save-drive',\s*\{[\s\S]*?signal[\s\S]*?\}\)/);
    });
  });

  describe('5. Non-Interference Boundary & Compliance Audit', () => {
    it('verifies zero modifications to studocu code', () => {
      const statusOutput = execSync('git status --porcelain src/components/tools/studocu', {
        encoding: 'utf8',
        cwd: path.resolve(__dirname, '../../..')
      }).trim();
      expect(statusOutput).toBe('');
    });

    it('verifies universal tool module compliance passes 8/8 checks', () => {
      const auditScript = path.resolve(__dirname, '../../../scripts/audit_module_compliance.py');
      const targetDir = path.resolve(__dirname, '../../../src/components/tools/spotify');
      const out = execSync(`python "${auditScript}" "${targetDir}"`, {
        encoding: 'utf8'
      });
      expect(out).toContain('ĐẠT');
      expect(out).toContain('TẤT CẢ CÁC MODULE ĐƯỢC KIỂM TRA ĐỀU ĐẠT TIÊU CHUẨN KIẾN TRÚC');
    });

    it('verifies Spotify Downloader has tier UR in useToolRegistry.js', () => {
      const registryPath = path.resolve(__dirname, '../../../src/hooks/useToolRegistry.js');
      const registryCode = fs.readFileSync(registryPath, 'utf8');
      const spotifyEntry = registryCode.match(/id:\s*['"]spotify-downloader['"][\s\S]*?tier:\s*['"]UR['"]/);
      expect(spotifyEntry).not.toBeNull();
    });
  });
});
