import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger.js';

export interface ToolLayoutItem {
  id: string;
  category: string;
  order: number;
}

export interface ToolLayoutInputItem {
  id: string;
  category: string;
  order?: number;
}

export interface CategoryItem {
  id: string;
  label: string;
  color: string;
}

export interface ToolLayoutConfig {
  items: ToolLayoutItem[];
  categories: CategoryItem[];
  updatedAt: string;
}

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'pdf', label: 'PDF', color: '#F59E0B' },
  { id: 'convert', label: 'Chuyển đổi', color: '#8B5CF6' },
  { id: 'archive', label: 'File nén', color: '#0EA5E9' },
  { id: 'qr', label: 'Mã QR', color: '#10B981' },
  { id: 'system', label: 'Tiện ích', color: '#6366F1' },
  { id: 'advanced', label: 'Nâng cao', color: '#EC4899' }
];

export const VALID_CATEGORIES = ['pdf', 'convert', 'archive', 'qr', 'system', 'advanced'] as const;
export type ValidCategory = typeof VALID_CATEGORIES[number];

export const DEFAULT_TOOL_LAYOUT: ToolLayoutItem[] = [
  { id: 'pdf-studio', category: 'pdf', order: 1 },
  { id: 'quiz-generator', category: 'pdf', order: 2 },
  { id: 'archive-inspect', category: 'archive', order: 3 },
  { id: 'server-archive', category: 'archive', order: 4 },
  { id: 'universal-converter', category: 'convert', order: 5 },
  { id: 'markdown-docs', category: 'convert', order: 6 },
  { id: 'qr-multi', category: 'qr', order: 7 },
  { id: 'qr-scan', category: 'qr', order: 8 },
  { id: 'studocu-dl', category: 'system', order: 9 },
  { id: 'tiktok-downloader', category: 'system', order: 10 },
  { id: 'youtube-downloader', category: 'system', order: 11 },
  { id: 'scribd-archiver', category: 'system', order: 12 },
  { id: 'view-split', category: 'advanced', order: 13 },
  { id: 'hash-checksum', category: 'advanced', order: 14 },
  { id: 'storage', category: 'advanced', order: 15 }
];

export class ToolLayoutService {
  private static instance: ToolLayoutService;
  private filePath: string;
  private dataDir: string;

  private constructor() {
    const baseDir = process.cwd().endsWith('server') ? process.cwd() : path.join(process.cwd(), 'server');
    this.dataDir = path.join(baseDir, 'data');
    if (!fs.existsSync(this.dataDir)) {
      try {
        fs.mkdirSync(this.dataDir, { recursive: true });
      } catch (err) {
        logger.warn({ err }, 'Failed to create data directory for ToolLayoutService');
      }
    }
    this.filePath = path.join(this.dataDir, 'tool_layout_config.json');
  }

  public static getInstance(): ToolLayoutService {
    if (!ToolLayoutService.instance) {
      ToolLayoutService.instance = new ToolLayoutService();
    }
    return ToolLayoutService.instance;
  }

  /**
   * Reads tool layout configuration, merging saved overrides with defaults.
   */
  public async getLayout(): Promise<ToolLayoutConfig> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          const mergedCategories = this.mergeCategoriesWithDefaults(parsed.categories);
          const validCatIds = new Set(mergedCategories.map(c => c.id));
          const mergedItems = this.mergeWithDefaults(parsed.items, validCatIds);
          return {
            items: mergedItems,
            categories: mergedCategories,
            updatedAt: parsed.updatedAt || new Date().toISOString()
          };
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to read tool layout from disk; returning defaults');
    }

    return {
      items: [...DEFAULT_TOOL_LAYOUT],
      categories: [...DEFAULT_CATEGORIES],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Updates tool layout configuration and writes to disk.
   */
  public async updateLayout(newItems: ToolLayoutInputItem[], newCategories?: CategoryItem[]): Promise<ToolLayoutConfig> {
    if (!Array.isArray(newItems) || newItems.length === 0) {
      throw new Error('Dữ liệu danh sách thẻ công cụ không hợp lệ');
    }

    // 1. Process and sanitize categories
    let finalCategories: CategoryItem[];
    if (Array.isArray(newCategories) && newCategories.length > 0) {
      finalCategories = this.mergeCategoriesWithDefaults(newCategories);
    } else {
      const current = await this.getLayout();
      finalCategories = current.categories;
    }

    const validCategoryIds = new Set(finalCategories.map(c => c.id));

    // 2. Sanitize and validate items
    const sanitized: ToolLayoutItem[] = [];
    const seenIds = new Set<string>();

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;

      const id = item.id.trim();
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      let cat = typeof item.category === 'string' ? item.category.trim().toLowerCase() : 'system';
      if (!validCategoryIds.has(cat)) {
        // Fallback to default category for this tool if available, otherwise 'system'
        const def = DEFAULT_TOOL_LAYOUT.find(d => d.id === id);
        cat = def && validCategoryIds.has(def.category) ? def.category : 'system';
      }

      const orderVal = typeof item.order === 'number' && !isNaN(item.order) ? item.order : (i + 1);

      sanitized.push({
        id,
        category: cat,
        order: orderVal
      });
    }

    // Merge any missing tools from defaults so no tools ever disappear
    const completeList = this.mergeWithDefaults(sanitized, validCategoryIds);

    // Normalize order sequentially: 1, 2, 3...
    completeList.sort((a, b) => a.order - b.order);
    completeList.forEach((item, idx) => {
      item.order = idx + 1;
    });

    const config: ToolLayoutConfig = {
      items: completeList,
      categories: finalCategories,
      updatedAt: new Date().toISOString()
    };

    try {
      if (!fs.existsSync(this.dataDir)) {
        await fs.promises.mkdir(this.dataDir, { recursive: true });
      }
      const tmpPath = `${this.filePath}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
      await fs.promises.rename(tmpPath, this.filePath);
    } catch (err) {
      logger.error({ err }, 'Failed to persist tool layout configuration to disk');
      throw new Error('Không thể lưu cấu hình thẻ công cụ vào bộ nhớ máy chủ');
    }

    return config;
  }

  /**
   * Resets layout configuration to system defaults.
   */
  public async resetLayout(): Promise<ToolLayoutConfig> {
    try {
      if (fs.existsSync(this.filePath)) {
        await fs.promises.unlink(this.filePath);
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to unlink tool layout config file');
    }

    return {
      items: [...DEFAULT_TOOL_LAYOUT],
      categories: [...DEFAULT_CATEGORIES],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Merges custom categories with system defaults to guarantee core tabs never break.
   */
  private mergeCategoriesWithDefaults(categories?: any[]): CategoryItem[] {
    const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const result: CategoryItem[] = [];
    const seenIds = new Set<string>();

    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (!cat || typeof cat.id !== 'string') continue;
        const id = cat.id.trim().toLowerCase();
        if (!id || seenIds.has(id)) continue;

        const label = typeof cat.label === 'string' && cat.label.trim() ? cat.label.trim() : id;
        const color = typeof cat.color === 'string' && hexColorRegex.test(cat.color.trim())
          ? cat.color.trim()
          : '#6366F1';

        seenIds.add(id);
        result.push({ id, label, color });
      }
    }

    // Ensure all default categories exist
    for (const def of DEFAULT_CATEGORIES) {
      if (!seenIds.has(def.id)) {
        seenIds.add(def.id);
        result.push({ ...def });
      }
    }

    return result;
  }

  /**
   * Merges custom items with defaults so newly introduced tools are never lost.
   */
  private mergeWithDefaults(items: ToolLayoutItem[], validCategoryIds?: Set<string>): ToolLayoutItem[] {
    const result: ToolLayoutItem[] = [];
    const itemMap = new Map<string, ToolLayoutItem>();
    const isCatValid = (cat: string) => validCategoryIds ? validCategoryIds.has(cat) : (VALID_CATEGORIES as readonly string[]).includes(cat);

    for (const it of items) {
      if (it && typeof it.id === 'string') {
        itemMap.set(it.id, it);
        result.push({
          id: it.id,
          category: isCatValid(it.category) ? it.category : 'system',
          order: typeof it.order === 'number' && !isNaN(it.order) ? it.order : result.length + 1
        });
      }
    }

    // Check for any default tools missing from custom config
    let nextOrder = result.length > 0 ? Math.max(...result.map(r => r.order)) + 1 : 1;
    for (const def of DEFAULT_TOOL_LAYOUT) {
      if (!itemMap.has(def.id)) {
        result.push({
          id: def.id,
          category: isCatValid(def.category) ? def.category : 'system',
          order: nextOrder++
        });
      }
    }

    result.sort((a, b) => a.order - b.order);
    return result;
  }
}

export const toolLayoutService = ToolLayoutService.getInstance();
