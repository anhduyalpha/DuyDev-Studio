import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('120Hz Native Compositor Optimization & Zero-JS Scroll Hijacking Suite', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('1. Obsolete JS scroll hijackers and root class togglers are deleted', () => {
    const lenisPath = path.join(rootDir, 'src/vendor/lenis-smooth.js');
    const smoothPath = path.join(rootDir, 'src/utilities/smoothScroll.js');
    const optPath = path.join(rootDir, 'src/utilities/scrollOptimizer.js');

    expect(fs.existsSync(lenisPath)).toBe(false);
    expect(fs.existsSync(smoothPath)).toBe(false);
    expect(fs.existsSync(optPath)).toBe(false);
  });

  it('2. app.js uses native window.scrollTo and does not import or invoke scroll hijackers', () => {
    const appPath = path.join(rootDir, 'src/app.js');
    const content = fs.readFileSync(appPath, 'utf-8');

    expect(content).not.toContain('smoothScroll');
    expect(content).not.toContain('scrollOptimizer');
    expect(content).not.toContain('initSmoothScroll');
    expect(content).not.toContain('initScrollOptimizer');
    expect(content).not.toContain('scrollToTarget');
    expect(content).toContain('window.scrollTo(0, 0)');
  });

  it('3. stitch-tokens.css isolates sticky chrome bars onto GPU layers with blur <= 12px', () => {
    const cssPath = path.join(rootDir, 'src/styles/stitch-tokens.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).toContain('.glass-panel');
    expect(content).toContain('.glass-dock');
    expect(content).toContain('transform: translateZ(0)');
    expect(content).toContain('will-change: transform');
    expect(content).toContain('backface-visibility: hidden');
    expect(content).toContain('blur(12px)');
    // Ensures persistent chrome blur never exceeds 12px
    expect(content).not.toContain('blur(28px)');
  });

  it('4. stitch-tokens.css eliminates backdrop-filter on repeating cards and purges is-scrolling & content-visibility', () => {
    const cssPath = path.join(rootDir, 'src/styles/stitch-tokens.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).not.toContain('html.is-scrolling');
    expect(content).not.toContain('.lenis');
    expect(content).not.toContain('content-visibility: auto');

    // Linear card uses solid surface tokens without blur
    expect(content).toContain('.linear-card');
    expect(content).not.toMatch(/\.linear-card\s*\{[^}]*backdrop-filter/);
    expect(content).not.toMatch(/\.tool-accent-box\s*\{[^}]*backdrop-filter/);
  });

  it('5. stitch-tokens.css guards hover elevations with pointer:fine and enforces native window scrolling without scroll trapping', () => {
    const cssPath = path.join(rootDir, 'src/styles/stitch-tokens.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    expect(content).toContain('@media (hover: hover) and (pointer: fine)');
    expect(content).toContain('overscroll-behavior-y: auto');
    expect(content).not.toContain('overscroll-behavior-y: none');
    expect(content).toContain('overflow-y: auto');
    expect(content).toContain('overflow-y: visible');
    expect(content).toContain('overflow-x: clip');
    expect(content).toContain('-webkit-overflow-scrolling: touch');
    expect(content).toContain('scroll-behavior: auto');
  });

  it('6. Android MainActivity retains unlockHighRefreshRate and restores LAYER_TYPE_NONE', () => {
    const mainActivityPath = path.join(
      rootDir,
      'android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt'
    );
    expect(fs.existsSync(mainActivityPath)).toBe(true);
    const content = fs.readFileSync(mainActivityPath, 'utf-8');

    expect(content).toContain('unlockHighRefreshRate()');
    expect(content).toContain('preferredDisplayModeId');
    expect(content).toContain('setPreferMinimalPostProcessing(true)');
    expect(content).toContain('View.LAYER_TYPE_NONE');
    expect(content).not.toContain('View.LAYER_TYPE_HARDWARE');
  });

  it('7. StoragePage and TiktokWorkspace apply decoding=async on image elements', () => {
    const storagePath = path.join(rootDir, 'src/pages/StoragePage.js');
    const storageContent = fs.readFileSync(storagePath, 'utf-8');
    expect(storageContent).toContain('decoding="async"');

    const tiktokPath = path.join(rootDir, 'src/components/tools/tiktok/TiktokWorkspace.js');
    const tiktokContent = fs.readFileSync(tiktokPath, 'utf-8');
    expect(tiktokContent).toContain('decoding="async"');
  });

  it('8. Service Worker precache list has purged deleted scroll files under v22.75+', () => {
    const swPath = path.join(rootDir, 'sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');

    expect(content).toMatch(/const CACHE_NAME = 'duydev-studio-v(22\.(7[5-9]|[89]\d)|23\.\d+)'/);
    expect(content).not.toContain('lenis-smooth.js');
    expect(content).not.toContain('smoothScroll.js');
    expect(content).not.toContain('scrollOptimizer.js');
  });

  it('9. index.html and pwa.js synchronize version query tags with sw.js', () => {
    const swPath = path.join(rootDir, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    const swMatch = swContent.match(/const CACHE_NAME = ['"]duydev-studio-v([^'"]+)['"]/);
    const ver = swMatch ? swMatch[1] : '22.76';

    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain(`src/app.js?v=${ver}`);
    expect(indexContent).toContain(`stitch-tokens.css?v=${ver}`);

    const pwaPath = path.join(rootDir, 'src/utilities/pwa.js');
    const pwaContent = fs.readFileSync(pwaPath, 'utf-8');
    expect(pwaContent).toContain(`CURRENT_PWA_VERSION = 'duydev-studio-v${ver}'`);
  });
});
