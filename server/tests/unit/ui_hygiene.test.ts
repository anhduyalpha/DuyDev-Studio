import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { renderViewSplitPixelInspector } from '../../../src/components/tools/viewsplit/components/ViewSplitPixelInspector.js';
import { renderViewSplitToolbar } from '../../../src/components/tools/viewsplit/components/ViewSplitToolbar.js';

describe('UI Hygiene, Option C Mobile Layouts & Ergonomic Touch Targets (Task 4.1)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const footerPath = path.join(rootDir, 'src/components/layout/Footer.js');
  const quizListenersPath = path.join(rootDir, 'src/components/tools/quiz/hooks/useQuizListeners.js');
  const youtubeWorkspacePath = path.join(rootDir, 'src/components/tools/youtube/YoutubeWorkspace.js');
  const pdfConfigPanelPath = path.join(rootDir, 'src/components/tools/pdf/components/ConfigPanel.js');
  const headerPath = path.join(rootDir, 'src/components/layout/Header.js');
  const viewSplitInspectorPath = path.join(rootDir, 'src/components/tools/viewsplit/components/ViewSplitPixelInspector.js');
  const viewSplitToolbarPath = path.join(rootDir, 'src/components/tools/viewsplit/components/ViewSplitToolbar.js');
  const tiktokWorkspacePath = path.join(rootDir, 'src/components/tools/tiktok/TiktokWorkspace.js');
  const storagePagePath = path.join(rootDir, 'src/pages/StoragePage.js');

  const footerContent = fs.readFileSync(footerPath, 'utf-8');
  const quizListenersContent = fs.readFileSync(quizListenersPath, 'utf-8');
  const youtubeContent = fs.readFileSync(youtubeWorkspacePath, 'utf-8');
  const pdfConfigContent = fs.readFileSync(pdfConfigPanelPath, 'utf-8');
  const headerContent = fs.readFileSync(headerPath, 'utf-8');
  const viewSplitInspectorContent = fs.readFileSync(viewSplitInspectorPath, 'utf-8');
  const viewSplitToolbarContent = fs.readFileSync(viewSplitToolbarPath, 'utf-8');
  const tiktokContent = fs.readFileSync(tiktokWorkspacePath, 'utf-8');
  const storageContent = fs.readFileSync(storagePagePath, 'utf-8');

  describe('1. Copy Hygiene & Slop Purge', () => {
    it('Footer.js must contain "mọi người dùng" and not "mụi người dùng"', () => {
      expect(footerContent).toContain('mọi người dùng');
      expect(footerContent).not.toContain('mụi người dùng');
    });

    it('useQuizListeners.js must not contain playful slop ("cho bạn nè", "xinh lung linh", "Ten ten")', () => {
      expect(quizListenersContent).not.toContain('cho bạn nè');
      expect(quizListenersContent).not.toContain('xinh lung linh');
      expect(quizListenersContent).not.toContain('Ten ten');
      expect(quizListenersContent).toContain('Đang khởi tạo và kiểm tra tài liệu nguồn...');
      expect(quizListenersContent).toContain('Đang dàn trang A4 và xuất PDF...');
      expect(quizListenersContent).toContain('Bộ đề thi và đáp án đã sẵn sàng.');
    });

    it('YoutubeWorkspace.js must not contain parenthetical "Âm thanh (Audio)"', () => {
      expect(youtubeContent).not.toContain('Âm thanh (Audio)');
      expect(youtubeContent).toContain('<span>Âm thanh</span>');
    });

    it('PDF ConfigPanel.js must not contain "(Tùy chọn)" in range label', () => {
      expect(pdfConfigContent).not.toContain('Dải trang chuyển đổi (Tùy chọn)');
      expect(pdfConfigContent).toContain('Dải trang chuyển đổi');
    });
  });

  describe('2. Header Dynamic Tool Count & >=44px Ergonomics', () => {
    it('Header.js must use dynamic tool count instead of hardcoded 21', () => {
      expect(headerContent).not.toContain('trong 21 công cụ');
      expect(headerContent).toContain('toolRegistry');
    });

    it('Header.js must hide branding text on <420px via hidden xs:inline', () => {
      expect(headerContent).toMatch(/class="[^"]*hidden\s+xs:inline[^"]*"\s*>\s*DuyDev Studio/);
    });

    it('Header.js must preserve #headerProfileDot and hide profile text label on <420px', () => {
      expect(headerContent).toContain('id="headerProfileDot"');
      expect(headerContent).toContain('id="headerProfileBtn"');
      expect(headerContent).toMatch(/id="headerUserNameText"\s+class="[^"]*hidden\s+xs:inline[^"]*"/);
    });

    it('Header.js logo and action buttons must enforce min-w-[44px] min-h-[44px]', () => {
      expect(headerContent).toMatch(/aria-label="Về trang chủ DuyDev Studio"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/id="btnMobileSearchToggle"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/href="#storage"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/href="#history"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/id="headerTrashBtn"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/id="btnSoundToggle"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
      expect(headerContent).toMatch(/id="btnThemeToggle"[^>]*min-w-\[44px\]\s+min-h-\[44px\]/);
    });
  });

  describe('3. ViewSplit Pixel Inspector BottomNav Clearance & Toolbar Button', () => {
    it('renderViewSplitPixelInspector must return empty string when !inspectorOpen', () => {
      const html = renderViewSplitPixelInspector({ inspectorOpen: false, pixelInspectorState: {} });
      expect(html.trim()).toBe('');
    });

    it('ViewSplitPixelInspector.js HUD must clear mobile BottomNav with bottom-24 and w-[min(320px,calc(100vw-24px))]', () => {
      expect(viewSplitInspectorContent).toContain('bottom-24 sm:bottom-4');
      expect(viewSplitInspectorContent).toContain('w-[min(320px,calc(100vw-24px))]');
    });

    it('ViewSplitToolbar.js toggle-inspector button must have min-h-[44px] min-w-[44px] px-2.5', () => {
      expect(viewSplitToolbarContent).toMatch(/data-action="toggle-inspector"[^>]*min-h-\[44px\]\s+min-w-\[44px\]\s+px-2\.5/);
    });
  });

  describe('4. Mobile Touch Targets: TikTok Workspace', () => {
    it('TiktokWorkspace.js mobile paste button must have min-h-[44px]', () => {
      expect(tiktokContent).toMatch(/id="btnPasteTiktokClipboard"[^>]*min-h-\[44px\]/);
    });
  });

  describe('5. Storage Page Option C 2-Row Toolbar', () => {
    it('StoragePage.js must enforce Option C 2-row layout with min-h-[44px] inputs and buttons', () => {
      expect(storageContent).toContain('id="inputStorageSearch"');
      expect(storageContent).toMatch(/id="inputStorageSearch"[^>]*min-h-\[44px\]/);
      expect(storageContent).toMatch(/for="storageFileInput"[^>]*min-h-\[44px\]/);
      expect(storageContent).toMatch(/id="btnStorageNewFolder"[^>]*min-h-\[44px\]/);
      expect(storageContent).toMatch(/id="btnStorageSelectAllToggle"[^>]*min-h-\[44px\]\s+min-w-\[44px\]/);
      expect(storageContent).toMatch(/id="btnStorageRefresh"[^>]*min-h-\[44px\]\s+min-w-\[44px\]/);
      expect(storageContent).toMatch(/id="btnStorageLock"[^>]*min-h-\[44px\]\s+min-w-\[44px\]/);
    });

    it('StoragePage.js must preserve all core DOM IDs', () => {
      const requiredIds = [
        'inputStorageSearch',
        'btnStorageClearSearch',
        'selectStorageSort',
        'btnStorageViewGrid',
        'btnStorageViewList',
        'btnStorageSelectAllToggle',
        'btnStorageNewFolder',
        'storageFileInput',
        'btnStorageRefresh',
        'btnStorageLock'
      ];
      for (const id of requiredIds) {
        expect(storageContent).toContain(`id="${id}"`);
      }
    });
  });
});
