import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('120Hz/144Hz Inertial Smooth Scroll & GPU Compositor Optimization Suite', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('1. Lenis vendor library exists and provides dual global and ES module exports', () => {
    const lenisPath = path.join(rootDir, 'src/vendor/lenis-smooth.js');
    expect(fs.existsSync(lenisPath)).toBe(true);
    const content = fs.readFileSync(lenisPath, 'utf-8');
    expect(content).toContain('Lenis=class');
    expect(content).toContain('export { Lenis }');
    expect(content).toContain('export default Lenis');
  });

  it('2. smoothScroll.js exports high-refresh inertial controller functions', () => {
    const smoothPath = path.join(rootDir, 'src/utilities/smoothScroll.js');
    expect(fs.existsSync(smoothPath)).toBe(true);
    const content = fs.readFileSync(smoothPath, 'utf-8');
    expect(content).toContain('export function initSmoothScroll');
    expect(content).toContain('export function pauseSmoothScroll');
    expect(content).toContain('export function resumeSmoothScroll');
    expect(content).toContain('export function scrollToTarget');
    expect(content).toContain('export function getLenis');
    // Verifies Apple / Linear Exponential Easing curve
    expect(content).toContain('Math.pow(2, -10 * t)');
    // Verifies native touch physics preserved for mobile
    expect(content).toContain('syncTouch: false');
  });

  it('3. scrollOptimizer.js exports GPU reliever with passive event listeners and debouncing', () => {
    const optPath = path.join(rootDir, 'src/utilities/scrollOptimizer.js');
    expect(fs.existsSync(optPath)).toBe(true);
    const content = fs.readFileSync(optPath, 'utf-8');
    expect(content).toContain('export function initScrollOptimizer');
    expect(content).toContain('export function destroyScrollOptimizer');
    expect(content).toContain('is-scrolling');
    expect(content).toContain('passive: true');
  });

  it('4. stitch-tokens.css includes high-speed scroll GPU shader relief & content-visibility virtualization', () => {
    const cssPath = path.join(rootDir, 'src/styles/stitch-tokens.css');
    const content = fs.readFileSync(cssPath, 'utf-8');
    expect(content).toContain('html.lenis');
    expect(content).toContain('.lenis.lenis-smooth');
    expect(content).toContain('html.is-scrolling');
    expect(content).toContain('backdrop-filter: none !important');
    expect(content).toContain('content-visibility: auto');
  });

  it('5. app.js boots smooth scroll and scroll optimizer on startup and uses scrollToTarget', () => {
    const appPath = path.join(rootDir, 'src/app.js');
    const content = fs.readFileSync(appPath, 'utf-8');
    expect(content).toContain("import { initSmoothScroll, scrollToTarget } from './utilities/smoothScroll.js?v=22.74'");
    expect(content).toContain("import { initScrollOptimizer } from './utilities/scrollOptimizer.js'");
    expect(content).toContain('initSmoothScroll();');
    expect(content).toContain('initScrollOptimizer();');
    expect(content).toContain('scrollToTarget(0');
  });

  it('6. Android MainActivity unlocks 120Hz display refresh rate and enables hardware layer', () => {
    const mainActivityPath = path.join(
      rootDir,
      'android/app/src/main/java/vn/alphadaniel/duydevstudio/MainActivity.kt'
    );
    expect(fs.existsSync(mainActivityPath)).toBe(true);
    const content = fs.readFileSync(mainActivityPath, 'utf-8');
    expect(content).toContain('unlockHighRefreshRate()');
    expect(content).toContain('preferredDisplayModeId');
    expect(content).toContain('View.LAYER_TYPE_HARDWARE');
  });

  it('7. Service Worker precaches Lenis and scroll utilities under v22.74 cache version', () => {
    const swPath = path.join(rootDir, 'sw.js');
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content).toContain("const CACHE_NAME = 'duydev-studio-v22.74';");
    expect(content).toContain("'./src/vendor/lenis-smooth.js?v=22.74'");
    expect(content).toContain("'./src/utilities/smoothScroll.js?v=22.74'");
    expect(content).toContain("'./src/utilities/scrollOptimizer.js'");
  });

  it('8. index.html and pwa.js synchronize v22.74 version query tags', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('src/app.js?v=22.74');
    expect(indexContent).toContain('stitch-tokens.css?v=22.74');

    const pwaPath = path.join(rootDir, 'src/utilities/pwa.js');
    const pwaContent = fs.readFileSync(pwaPath, 'utf-8');
    expect(pwaContent).toContain("CURRENT_PWA_VERSION = 'duydev-studio-v22.74'");
  });
});
