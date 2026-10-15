import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tool Registry Categories & Advanced Tab Suite', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('1. CategoryFilters.js includes the Advanced (Nâng cao) category tab', () => {
    const filtersPath = path.join(rootDir, 'src/components/dashboard/CategoryFilters.js');
    const content = fs.readFileSync(filtersPath, 'utf-8');

    expect(content).toContain("{ id: 'advanced', label: 'Nâng cao', color: '#EC4899' }");
    expect(content).toContain("id: 'system', label: 'Tiện ích'");
  });

  it('2. useToolRegistry.js moves hash-checksum and storage to the advanced category', () => {
    const registryPath = path.join(rootDir, 'src/hooks/useToolRegistry.js');
    const content = fs.readFileSync(registryPath, 'utf-8');

    // hash-checksum must be advanced
    expect(content).toMatch(/id:\s*'hash-checksum'[\s\S]*?category:\s*'advanced'/);
    // storage must be advanced
    expect(content).toMatch(/id:\s*'storage'[\s\S]*?category:\s*'advanced'/);

    // system tools must remain in system
    expect(content).toMatch(/id:\s*'view-split'[\s\S]*?category:\s*'system'/);
    expect(content).toMatch(/id:\s*'studocu-dl'[\s\S]*?category:\s*'system'/);
    expect(content).toMatch(/id:\s*'tiktok-downloader'[\s\S]*?category:\s*'system'/);
    expect(content).toMatch(/id:\s*'scribd-archiver'[\s\S]*?category:\s*'system'/);
  });

  it('3. DashboardPage.js tracks counts for advanced category', () => {
    const dashboardPath = path.join(rootDir, 'src/pages/DashboardPage.js');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    expect(content).toContain("advanced: toolRegistry.tools.filter(t => t.category === 'advanced').length");
  });

  it('4. ToolCard.js maps advanced category label to Nâng cao', () => {
    const toolCardPath = path.join(rootDir, 'src/components/dashboard/ToolCard.js');
    const content = fs.readFileSync(toolCardPath, 'utf-8');

    expect(content).toContain("advanced: 'Nâng cao'");
    expect(content).toContain("'#EC4899': '#BE185D'");
  });
});
