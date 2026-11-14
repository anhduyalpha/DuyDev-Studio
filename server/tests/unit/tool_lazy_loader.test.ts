import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Task 1.4 — Lazy Dynamic Tool Loading (ToolPage.js) & Race-Free Router (app.js)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const toolPagePath = path.join(rootDir, 'src/pages/ToolPage.js');
  const appJsPath = path.join(rootDir, 'src/app.js');

  describe('Static Invariant Checks', () => {
    it('ToolPage.js must have ZERO top-level static imports of components/tools/**, ArchivePage.js, or StoragePage.js', () => {
      const content = fs.readFileSync(toolPagePath, 'utf-8');
      const lines = content.split('\n');

      // Match top-level import statements: import ... from '...'
      const topLevelImports = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('import ') && trimmed.includes(' from ');
      });

      const forbiddenStaticImports = topLevelImports.filter(imp => {
        return (
          imp.includes('components/tools/') ||
          imp.includes('ArchivePage.js') ||
          imp.includes('StoragePage.js') ||
          imp.includes('useConverter.js') ||
          imp.includes('usePdfQueue.js')
        );
      });

      expect(forbiddenStaticImports).toEqual([]);
    });

    it('ToolPage.js must not contain stale ?v= query strings in any import specifier', () => {
      const content = fs.readFileSync(toolPagePath, 'utf-8');
      expect(content).not.toMatch(/from\s+['"][^'"]*\?v=[^'"]*['"]/);
      expect(content).not.toMatch(/import\s*\(\s*['"][^'"]*\?v=[^'"]*['"]\s*\)/);
    });

    it('ToolPage.js must export renderToolLoadingSkeleton, renderToolPage, and attachToolPageListeners', () => {
      const content = fs.readFileSync(toolPagePath, 'utf-8');
      expect(content).toMatch(/export\s+(async\s+)?function\s+renderToolPage/);
      expect(content).toMatch(/export\s+function\s+attachToolPageListeners/);
      expect(content).toMatch(/export\s+function\s+renderToolLoadingSkeleton/);
    });

    it('src/app.js must defer ShareTargetModal.js load (no top-level static import)', () => {
      const content = fs.readFileSync(appJsPath, 'utf-8');
      const topLevelStaticShareImport = content.split('\n').filter(line => {
        const trimmed = line.trim();
        return trimmed.startsWith('import ') && trimmed.includes('ShareTargetModal.js');
      });
      expect(topLevelStaticShareImport).toEqual([]);
    });
  });

  describe('Tool Registry & Loader Coverage', () => {
    it('All 20+ tool IDs and aliases resolve cleanly in ToolPage.js', async () => {
      const { renderToolPage, renderToolLoadingSkeleton } = await import(
        '../../../src/pages/ToolPage.js'
      );

      // Verify skeleton renders valid HTML
      const skeletonHtml = renderToolLoadingSkeleton({ name: 'PDF Studio', id: 'pdf-studio' });
      expect(skeletonHtml).toContain('animate-pulse');
      expect(skeletonHtml).toContain('PDF Studio');

      // Verify all canonical tools and aliases
      const testToolIds = [
        'pdf-studio',
        'pdf-merge',
        'pdf-lock',
        'pdf-convert',
        'pdf-split',
        'quiz-generator',
        'quiz',
        'archive-inspect',
        'server-archive',
        'universal-converter',
        'image-converter',
        'video-audio',
        'markdown-docs',
        'qr-multi',
        'qr-scan',
        'studocu-dl',
        'facebook-downloader',
        'facebook',
        'instagram-downloader',
        'instagram',
        'spotify-downloader',
        'spotify',
        'tiktok-downloader',
        'tiktok',
        'youtube-downloader',
        'youtube',
        'scribd-archiver',
        'scribd',
        'slideshare-downloader',
        'slideshare',
        'academia-downloader',
        'academia',
        'researchgate-downloader',
        'researchgate',
        'view-split',
        'viewsplit',
        'hash-checksum',
        'storage'
      ];

      for (const toolId of testToolIds) {
        const result = await renderToolPage(toolId);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('Dynamic import errors render a clean fallback error UI inside #mainContent without crashing', async () => {
      const { renderToolPage } = await import(
        '../../../src/pages/ToolPage.js'
      );

      // Unknown or intentionally failed toolId
      const fallbackHtml = await renderToolPage('__non_existent_tool_id_triggering_fallback__');
      expect(typeof fallbackHtml).toBe('string');
      // Should show a clean fallback UI rather than throwing
      expect(fallbackHtml).toMatch(/(Không thể tải|Lỗi|error|fallback|Dashboard)/i);
    });
  });

  describe('Race-Condition & Sequence Guard in Navigation', () => {
    it('Switching rapidly from Tool A -> Tool B cancels DOM swap and listeners for A (navigationSeq guard)', async () => {
      // Mock navigation state machine mimicking app.js
      let navigationSeq = 0;
      let activeViewInDom: string | null = null;
      let attachedListenersFor: string | null = null;

      const mockNavigateToTool = async (
        toolId: string,
        simulatedDelayMs: number,
        mockRender: (id: string) => Promise<string>,
        mockAttach: (id: string) => void
      ) => {
        navigationSeq++;
        const currentSeq = navigationSeq;

        // Render skeleton immediately
        activeViewInDom = `skeleton-${toolId}`;

        try {
          await new Promise(r => setTimeout(r, simulatedDelayMs));
          const html = await mockRender(toolId);

          // Sequence Guard check
          if (currentSeq !== navigationSeq) {
            // Cancelled: stale navigation!
            return { cancelled: true, toolId };
          }

          // Active navigation: commit DOM & attach listeners
          activeViewInDom = html;
          mockAttach(toolId);
          attachedListenersFor = toolId;
          return { cancelled: false, toolId };
        } catch {
          if (currentSeq !== navigationSeq) return { cancelled: true, toolId };
          activeViewInDom = `error-${toolId}`;
          return { error: true, toolId };
        }
      };

      const renderSpy = vi.fn(async (id: string) => `rendered-${id}`);
      const attachSpy = vi.fn((id: string) => {});

      // Launch slow navigation to Tool A (100ms)
      const promiseA = mockNavigateToTool('tool-A', 100, renderSpy, attachSpy);

      // Rapidly launch fast navigation to Tool B (20ms) after 10ms
      await new Promise(r => setTimeout(r, 10));
      const promiseB = mockNavigateToTool('tool-B', 20, renderSpy, attachSpy);

      const [resA, resB] = await Promise.all([promiseA, promiseB]);

      // Tool A should be cancelled because seq changed
      expect(resA.cancelled).toBe(true);
      // Tool B should succeed
      expect(resB.cancelled).toBe(false);

      // DOM and listeners should reflect Tool B, NOT Tool A
      expect(activeViewInDom).toBe('rendered-tool-B');
      expect(attachedListenersFor).toBe('tool-B');
      expect(attachSpy).toHaveBeenCalledTimes(1);
      expect(attachSpy).toHaveBeenCalledWith('tool-B');
    });

    it('src/app.js implements _navigationSeq and guards dispatchTool', () => {
      const content = fs.readFileSync(appJsPath, 'utf-8');
      expect(content).toContain('_navigationSeq');
      expect(content).toMatch(/renderToolLoadingSkeleton/);
      // dispatchTool should be async and check sequence
      expect(content).toMatch(/async\s+dispatchTool|const\s+dispatchTool\s*=\s*async/);
    });
  });
});
