import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Global Task Micro-Dock (iOS HUD / macOS Task Indicator Aesthetic)', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const dockJsPath = path.join(rootDir, 'src/components/layout/GlobalTaskDock.js');
  const cssPath = path.join(rootDir, 'src/styles/stitch-tokens.css');

  it('1. GlobalTaskDock.js enforces ultra-compact dẹt container dimensions (max-w-[340px])', () => {
    const jsContent = fs.readFileSync(dockJsPath, 'utf-8');

    expect(jsContent).toContain('max-w-[340px]');
    expect(jsContent).toContain('sm:w-[340px]');
    expect(jsContent).toContain('task-micro-dock');
    expect(jsContent).not.toContain('max-w-sm w-[calc(100vw-2rem)] sm:w-88');
  });

  it('2. Single task items use an inline horizontal row (Badge + Description + Percentage)', () => {
    const jsContent = fs.readFileSync(dockJsPath, 'utf-8');

    // Horizontal flex container
    expect(jsContent).toContain('flex items-center justify-between gap-2 min-w-0');
    // Micro badge
    expect(jsContent).toContain('text-[9.5px] font-bold uppercase tracking-wider');
    // Truncated title
    expect(jsContent).toContain('dock-task-title text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate');
    // Percentage
    expect(jsContent).toContain('dock-pct-text text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400');
  });

  it('3. Secondary verbose stage details are collapsed by default and expand on hover', () => {
    const jsContent = fs.readFileSync(dockJsPath, 'utf-8');

    expect(jsContent).toContain('dock-stage-row max-h-0 opacity-0 group-hover/item:max-h-6 group-hover/item:opacity-100');
    expect(jsContent).toContain('dock-stage-text truncate');
  });

  it('4. Uses sub-pixel 2px progress thread with dock-progress-thread class', () => {
    const jsContent = fs.readFileSync(dockJsPath, 'utf-8');

    expect(jsContent).toContain('dock-progress-thread');
    expect(jsContent).toContain('h-[2px]');
    // Thick 5px or 4px bar was removed
    expect(jsContent).not.toContain('h-1 overflow-hidden');
  });

  it('5. Micro header features pulsing green status dot and tiny 11px typography', () => {
    const jsContent = fs.readFileSync(dockJsPath, 'utf-8');

    expect(jsContent).toContain('bg-emerald-500');
    expect(jsContent).toContain('text-[11px] font-semibold text-zinc-600 dark:text-zinc-400');
  });

  it('6. stitch-tokens.css implements glassmorphism tokens, hover lift, and shimmer animation', () => {
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('.task-micro-dock');
    expect(cssContent).toContain('backdrop-filter: blur(16px)');
    expect(cssContent).toContain('transform: translateY(-2px)');
    expect(cssContent).toContain('.dock-progress-thread');
    expect(cssContent).toContain('@keyframes dockProgressShimmer');
  });

  it('7. getVisibleDockTasks hides active tasks on matching tool views including route aliases', async () => {
    const { getVisibleDockTasks } = await import(dockJsPath);

    const scribdTask = { id: 'scribd-1', moduleId: 'scribd-archiver', route: '#tool/scribd' };
    const studocuTask = { id: 'studocu-1', moduleId: 'studocu-dl', route: '#tool/studocu-dl' };
    const converterTask = { id: 'conv-1', moduleId: 'converter', route: '#tool/universal-converter' };
    const allTasks = [scribdTask, studocuTask, converterTask];

    // On #tool/scribd
    (global as any).window = { location: { hash: '#tool/scribd' } };
    expect(getVisibleDockTasks(allTasks)).toEqual([studocuTask, converterTask]);

    // On #tool/scribd-archiver
    (global as any).window = { location: { hash: '#tool/scribd-archiver' } };
    expect(getVisibleDockTasks(allTasks)).toEqual([studocuTask, converterTask]);

    // On #studocu-dl alias
    (global as any).window = { location: { hash: '#studocu-dl' } };
    expect(getVisibleDockTasks(allTasks)).toEqual([scribdTask, converterTask]);

    // On #dashboard
    (global as any).window = { location: { hash: '#dashboard' } };
    expect(getVisibleDockTasks(allTasks)).toEqual(allTasks);
  });

  it('8. formatTaskTitle prevents duplicate action prefixes', async () => {
    const { formatTaskTitle } = await import(dockJsPath);

    expect(formatTaskTitle({ title: 'Đang xử lý: Sách Toán' })).toBe('Đang xử lý: Sách Toán');
    expect(formatTaskTitle({ title: 'Tài liệu Scribd' })).toBe('Đang tải Tài liệu Scribd');
    expect(formatTaskTitle({ title: 'Chuyển đổi: test.mp4' })).toBe('Chuyển đổi: test.mp4');
  });
});

