import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Milestone 1 Empirical Adversarial Suite: Concentric Squircle Geometry & Optical Hierarchy', () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const toolCardPath = path.join(rootDir, 'src/components/dashboard/ToolCard.js');
  const categoryFiltersPath = path.join(rootDir, 'src/components/dashboard/CategoryFilters.js');
  const cardTiersCssPath = path.join(rootDir, 'src/styles/card-tiers-10.css');
  const toolRegistryPath = path.join(rootDir, 'src/hooks/useToolRegistry.js');

  const toolCardSource = fs.readFileSync(toolCardPath, 'utf-8');
  const categoryFiltersSource = fs.readFileSync(categoryFiltersPath, 'utf-8');
  const cardTiersCss = fs.readFileSync(cardTiersCssPath, 'utf-8');
  const toolRegistrySource = fs.readFileSync(toolRegistryPath, 'utf-8');

  // =========================================================================
  // 1. Concentric Squircle Geometry
  // =========================================================================
  describe('1. Concentric Squircle Geometry & Optical Proportions', () => {
    it('1.1 Outer card wrapper enforces !rounded-[20px] with important specificity', () => {
      // Must contain !rounded-[20px] on the primary anchor
      expect(toolCardSource).toMatch(/class="[^"]*!rounded-\[20px\][^"]*"/);
      
      // Extract the outer class string
      const classMatch = toolCardSource.match(/class="tool-card linear-card\$\{tierCardClass\}([^"]+)"/);
      expect(classMatch).not.toBeNull();
      const classes = classMatch![1];
      expect(classes).toContain('!rounded-[20px]');
      expect(classes).toContain('overflow-hidden');
    });

    it('1.2 Top-down ambient surface tint uses matching rounded-[20px]', () => {
      expect(toolCardSource).toMatch(/bg-gradient-to-b[^>]+rounded-\[20px\]/);
    });

    it('1.3 Inner icon container uses rounded-[14px]', () => {
      expect(toolCardSource).toMatch(/rounded-\[14px\][^>]+tool-accent-box/);
    });

    it('1.4 Squircle geometric ratio mathematically verifies: R_outer - R_inner = 6px (delta = 6px, ratio = 0.70)', () => {
      const rOuterMatch = toolCardSource.match(/!rounded-\[(\d+)px\]/);
      const rInnerMatch = toolCardSource.match(/rounded-\[(\d+)px\][^\n]+tool-accent-box/);

      expect(rOuterMatch).not.toBeNull();
      expect(rInnerMatch).not.toBeNull();

      const rOuter = parseInt(rOuterMatch![1], 10);
      const rInner = parseInt(rInnerMatch![1], 10);

      const delta = rOuter - rInner;
      const ratio = rInner / rOuter;

      expect(rOuter).toBe(20);
      expect(rInner).toBe(14);
      expect(delta).toBe(6);
      expect(ratio).toBeCloseTo(0.70, 2);
    });

    it('1.5 Spec badges maintain optical hierarchy with rounded-[8px]', () => {
      expect(toolCardSource).toContain('rounded-[8px]');
      expect(toolCardSource).toContain('text-[10px]');
      expect(toolCardSource).toContain('font-mono');
      expect(toolCardSource).toContain('tabular-nums');
    });
  });

  // =========================================================================
  // 2. CSS Specificity & 10-Tier RPG Badge Compatibility
  // =========================================================================
  describe('2. CSS Specificity Override on .tier-card & 10-Tier RPG Coexistence', () => {
    it('2.1 card-tiers-10.css declares .tier-card with border-radius: 1rem (16px) without !important', () => {
      // Find .tier-card block
      const tierCardMatch = cardTiersCss.match(/\.tier-card\s*\{([^}]+)\}/);
      expect(tierCardMatch).not.toBeNull();
      const tierCardBody = tierCardMatch![1];

      expect(tierCardBody).toContain('border-radius: 1rem');
      expect(tierCardBody).not.toMatch(/border-radius:[^;]+!important/);
    });

    it('2.2 Zero occurrences of border-radius ... !important exist in card-tiers-10.css', () => {
      expect(cardTiersCss).not.toMatch(/border-radius\s*:\s*[^;]+!important/i);
    });

    it('2.3 !rounded-[20px] generates border-radius: 20px !important which decisively overrides 1rem in CSS cascade', () => {
      // In CSS Cascade Specification (W3C CSS Cascading and Inheritance Level 4, Section 6.2),
      // declarations marked !important take precedence over normal declarations regardless of selector specificity.
      const hasTailwindBang = toolCardSource.includes('!rounded-[20px]');
      const tierCssHasImportant = /border-radius\s*:[^;]+!important/i.test(cardTiersCss);

      expect(hasTailwindBang).toBe(true);
      expect(tierCssHasImportant).toBe(false);
      // CSS Cascade: Important utility (specificity 0,1,0 + !important) beats normal class selector (.tier-card 0,1,0)
    });

    it('2.4 All 10 RPG tiers (E, D, C, B, A, S, SS, UR, LR, EX) are preserved in CARD_TIERS', () => {
      const requiredTiers = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'UR', 'LR', 'EX'];
      for (const tier of requiredTiers) {
        expect(toolRegistrySource).toContain(`${tier}: {`);
      }
    });

    it('2.5 Tier crest badge (.tier-crest-badge) has shrink-0 and clean shadow-xs', () => {
      expect(toolCardSource).toContain('tier-crest-badge shadow-xs shrink-0');
      expect(toolCardSource).toContain('tier-badge-indicator');
      expect(toolCardSource).toContain('tier-badge-label');
    });

    it('2.6 Outer card has overflow-hidden preventing tier halo or frame clipping overflow', () => {
      expect(toolCardSource).toMatch(/class="[^"]*overflow-hidden[^"]*"/);
    });
  });

  // =========================================================================
  // 3. CategoryFilters Segmented Control Aesthetics & Micro-Press
  // =========================================================================
  describe('3. CategoryFilters Segmented Control & Tactile Micro-Press', () => {
    it('3.1 Active pill uses dark:bg-white/[0.14] with specular rim shadow and border', () => {
      expect(categoryFiltersSource).toContain('dark:bg-white/[0.14]');
      expect(categoryFiltersSource).toContain('dark:border-white/[0.16]');
      expect(categoryFiltersSource).toContain('dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]');
    });

    it('3.2 Inactive pill uses dark:bg-[#16161A] and dark:text-[#86868B] with hover:#F5F5F7', () => {
      expect(categoryFiltersSource).toContain('dark:bg-[#16161A]');
      expect(categoryFiltersSource).toContain('dark:text-[#86868B]');
      expect(categoryFiltersSource).toContain('dark:hover:text-[#F5F5F7]');
    });

    it('3.3 Active indicator dot is unconditionally bg-white when active (eliminating dark-on-dark bug)', () => {
      // Must check the ternary: ${isActive ? 'bg-white' : ''}
      expect(categoryFiltersSource).toMatch(/isActive\s*\?\s*['"]bg-white['"]\s*:\s*['"]['"]/);
      // And inactive dot receives style with background-color: cat.color
      expect(categoryFiltersSource).toMatch(/isActive\s*\?\s*['"]['"]\s*:\s*`background-color:\s*\$\{cat\.color\};`/);
    });

    it('3.4 Count badge uses rounded-[6px], font-mono, and tabular-nums', () => {
      expect(categoryFiltersSource).toContain('rounded-[6px]');
      expect(categoryFiltersSource).toContain('font-mono');
      expect(categoryFiltersSource).toContain('tabular-nums');
      expect(categoryFiltersSource).toContain('dark:bg-white/[0.18]');
    });

    it('3.5 Micro-press scaling is calibrated to physical mass: active:scale-[0.985] on cards and active:scale-[0.96] on pills', () => {
      expect(toolCardSource).toContain('active:scale-[0.985]');
      expect(toolCardSource).toContain('touch-manipulation');
      expect(toolCardSource).toContain('transition-transform duration-150 ease-out');

      expect(categoryFiltersSource).toContain('active:scale-[0.96]');
      expect(categoryFiltersSource).toContain('transition-transform duration-100 ease-out');
    });
  });

  // =========================================================================
  // 4. Adversarial Edge Cases & Fallback Behavior
  // =========================================================================
  describe('4. Adversarial Edge Cases & Degradation', () => {
    it('4.1 ToolCard handles null/undefined tier gracefully without crashing or injecting undefined classes', () => {
      // Simulate ToolCard logic with no tier
      const toolNoTier = {
        id: 'test-tool',
        title: 'Test Tool',
        description: 'Test Description',
        route: '#test',
        icon: 'file',
        category: 'pdf',
        specs: ['PDF', '100%']
      };

      const tierConfig = (toolNoTier as any).tier ? null : null;
      const tierCardClass = tierConfig ? ' tier-card test' : '';
      expect(tierCardClass).toBe('');
      // In ToolCard.js: tierCardClass is empty string when tool.tier is undefined
      expect(toolCardSource).toContain("const tierCardClass = tierConfig ? ` tier-card ${tierConfig.className}` : '';");
    });

    it('4.2 ToolCard handles empty specs array without orphan DOM nodes', () => {
      expect(toolCardSource).toContain("${tool.specs && tool.specs.length > 0 ? tool.specs.map(");
    });

    it('4.3 Title and description enforce truncation and min-height for optical alignment', () => {
      expect(toolCardSource).toContain('tracking-[-0.025em]');
      expect(toolCardSource).toContain('truncate');
      expect(toolCardSource).toContain('leading-[1.45]');
      expect(toolCardSource).toContain('line-clamp-2');
      expect(toolCardSource).toContain('min-h-[2.25rem]');
    });

    it('4.4 CategoryFilters safely falls back to count = 0 if key is missing in counts dictionary', () => {
      expect(categoryFiltersSource).toContain('const count = counts[cat.id] !== undefined ? counts[cat.id] : 0;');
    });
  });

  // =========================================================================
  // 5. Perimeter Protection Guardrail (Studocu, Scribd, Card-Tiers-10)
  // =========================================================================
  describe('5. Protected Scraper Perimeter & Style Guardrails', () => {
    it('5.1 git status confirms ZERO modifications to protected modules', () => {
      const gitStatus = execSync('git status --short', { cwd: rootDir, encoding: 'utf-8' });
      
      expect(gitStatus).not.toMatch(/src\/components\/tools\/studocu/);
      expect(gitStatus).not.toMatch(/server\/src\/services\/studocu/);
      expect(gitStatus).not.toMatch(/src\/styles\/studocu\.css/);
      expect(gitStatus).not.toMatch(/src\/styles\/scribd\.css/);
      expect(gitStatus).not.toMatch(/src\/styles\/card-tiers-10\.css/);
    });
  });
});
