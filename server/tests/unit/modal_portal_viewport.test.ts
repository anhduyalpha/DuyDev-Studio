import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Modal Portal & Viewport Backdrop Integrity', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('eliminates containing block trap in index.html fadeIn keyframes (transform: none)', () => {
    const indexPath = path.join(rootDir, 'index.html');
    const content = fs.readFileSync(indexPath, 'utf-8');

    // Must NOT keep transform: translateY(0) at 100% which establishes a containing block
    expect(content).toContain("'100%': { opacity: '1', transform: 'none' }");
    expect(content).not.toContain("'100%': { opacity: '1', transform: 'translateY(0)' }");
  });

  it('guarantees SlideConfirmModal teleports to document.body and covers full viewport', () => {
    const modalPath = path.join(rootDir, 'src/components/common/SlideConfirmModal.js');
    const content = fs.readFileSync(modalPath, 'utf-8');

    // ensureModalMounted teleports to document.body
    expect(content).toContain('document.body.appendChild(modal)');
    // openSlideConfirmModal sets full viewport dimensions and high z-index
    expect(content).toContain("modal.style.width = '100vw'");
    expect(content).toContain("modal.style.height = '100vh'");
    expect(content).toContain("modal.style.zIndex = '99999'");
    expect(content).toContain("modal.style.backdropFilter = 'blur(12px)'");
    // Scroll lock on body
    expect(content).toContain("document.body.style.overflow = 'hidden'");
    expect(content).toContain("document.body.style.overflow = ''");
  });

  it('mounts globalSlideConfirmContainer directly on document.body in app.js', () => {
    const appPath = path.join(rootDir, 'src/app.js');
    const content = fs.readFileSync(appPath, 'utf-8');

    expect(content).toContain("slideConfirmEl.id = 'globalSlideConfirmContainer'");
    expect(content).toContain('document.body.appendChild(slideConfirmEl)');
  });

  it('maintains synchronized PWA version v23.68 across files', () => {
    const swPath = path.join(rootDir, 'sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain("CACHE_NAME = 'duydev-studio-v23.68'");

    const pwaPath = path.join(rootDir, 'src/utilities/pwa.js');
    const pwaContent = fs.readFileSync(pwaPath, 'utf-8');
    expect(pwaContent).toContain("CURRENT_PWA_VERSION = 'duydev-studio-v23.68'");

    const indexPath = path.join(rootDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('src/app.js?v=23.68');
  });
});
