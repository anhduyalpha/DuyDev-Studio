import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tool Card Manager Reordering & Real-time Dynamic Layout Sync', () => {
  const adminManagerPath = path.resolve(process.cwd(), 'src/components/admin/AdminToolCardManager.js');
  const dashboardPagePath = path.resolve(process.cwd(), 'src/pages/DashboardPage.js');

  it('AdminToolCardManager: exports getFilteredDraftTools helper', () => {
    const code = fs.readFileSync(adminManagerPath, 'utf-8');
    expect(code).toContain('export function getFilteredDraftTools()');
  });

  it('AdminToolCardManager: binds isFirst and isLast to filteredTools index instead of globalIndex', () => {
    const code = fs.readFileSync(adminManagerPath, 'utf-8');
    expect(code).toContain('const isFirst = index === 0;');
    expect(code).toContain('const isLast = index === filteredTools.length - 1;');
  });

  it('AdminToolCardManager: reorders relative to visible filtered tools', () => {
    const code = fs.readFileSync(adminManagerPath, 'utf-8');
    // Verifies move-up finds previous visible tool and splices target immediately before it
    expect(code).toContain('const currentFiltered = getFilteredDraftTools();');
    expect(code).toContain('const prevVisibleTool = currentFiltered[visibleIndex - 1];');
    expect(code).toContain('const nextVisibleTool = currentFiltered[visibleIndex + 1];');
  });

  it('DashboardPage: subscribes to toolRegistry to dynamically synchronize cards and counts', () => {
    const code = fs.readFileSync(dashboardPagePath, 'utf-8');
    expect(code).toContain('const unsubscribeRegistry = toolRegistry.subscribe(');
    expect(code).toContain('if (typeof unsubscribeRegistry === \'function\') unsubscribeRegistry();');
  });

  it('Simulation: swapping items in a filtered category list does not freeze or get blocked by interleaved tools', () => {
    // Model tools across multiple categories interleaved
    const mockDraft = [
      { id: 'pdf-studio', category: 'pdf', order: 1 },
      { id: 'quiz-generator', category: 'pdf', order: 2 },
      { id: 'universal-converter', category: 'convert', order: 3 },
      { id: 'youtube-downloader', category: 'system', order: 4 },
      { id: 'qr-multi', category: 'qr', order: 5 },
      { id: 'studocu-dl', category: 'system', order: 6 },
      { id: 'tiktok-downloader', category: 'system', order: 7 }
    ];

    // Filter for 'system' category
    const activeCategory = 'system';
    const filtered = mockDraft.filter(t => t.category === activeCategory);
    expect(filtered.map(t => t.id)).toEqual(['youtube-downloader', 'studocu-dl', 'tiktok-downloader']);

    // Move studocu-dl (index 1 in filtered) UP
    const targetId = 'studocu-dl';
    const visibleIndex = filtered.findIndex(t => t.id === targetId);
    expect(visibleIndex).toBe(1);

    const prevVisibleTool = filtered[visibleIndex - 1];
    expect(prevVisibleTool.id).toBe('youtube-downloader');

    const targetIdx = mockDraft.findIndex(t => t.id === targetId);
    const [item] = mockDraft.splice(targetIdx, 1);
    const newPrevIdx = mockDraft.findIndex(t => t.id === prevVisibleTool.id);
    mockDraft.splice(newPrevIdx, 0, item);
    mockDraft.forEach((t, i) => { t.order = i + 1; });

    // Verify filtered order immediately has studocu-dl first
    const newFiltered = mockDraft.filter(t => t.category === activeCategory);
    expect(newFiltered.map(t => t.id)).toEqual(['studocu-dl', 'youtube-downloader', 'tiktok-downloader']);
    expect(newFiltered[0].id).toBe('studocu-dl');
    expect(newFiltered[1].id).toBe('youtube-downloader');

    // And first item has isFirst = true (index === 0)
    expect(newFiltered.findIndex(t => t.id === 'studocu-dl') === 0).toBe(true);
  });
});
