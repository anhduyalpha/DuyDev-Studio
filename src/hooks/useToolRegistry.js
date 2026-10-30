/**
 * useToolRegistry - Central Tool Catalog
 */

const DEFAULT_TOOLS = [
  // 1. PDF Studio Suite
  {
    id: 'pdf-studio',
    title: 'PDF Studio',
    description: 'Ghép, tách, xoay, nén, đóng dấu và đọc tài liệu PDF vector.',
    category: 'pdf',
    icon: 'file-text',
    featured: true,
    specs: ['Nén & Ghép', 'Tách & Xoay', 'Watermark'],
    color: '#F59E0B',
    route: '#tool/pdf-studio',
    tags: ['pdf', 'ghép', 'tách', 'xoay', 'ảnh sang pdf', 'nén', 'mật khẩu', 'watermark', 'trích ảnh', 'xem pdf', 'merge', 'split', 'rotate']
  },
  {
    id: 'quiz-generator',
    title: 'Tạo Bài Tập Trắc Nghiệm',
    description: 'Biên soạn đề bài và đáp án A4 chuẩn in ấn từ PDF hoặc Google Drive.',
    category: 'pdf',
    icon: 'graduation-cap',
    featured: true,
    specs: ['Đề bài A4', 'Đáp án & Lời giải', 'Agnes AI'],
    color: '#8B5CF6',
    route: '#tool/quiz-generator',
    tags: ['quiz', 'bài tập', 'tạo bài tập', 'tạo bài tập trắc nghiệm', 'đề thi', 'trắc nghiệm', 'hóa học', 'toán', 'lý', 'pdf', 'a4', 'agnes', 'ai']
  },

  // 2. Archive Inspector (.ZIP / .RAR)
  {
    id: 'archive-inspect',
    title: 'Soi Tệp Nén',
    description: 'Duyệt cấu trúc thư mục và trích xuất không cần giải nén.',
    category: 'archive',
    icon: 'archive',
    featured: true,
    specs: ['.ZIP', '.RAR', '.7Z', 'Trích xuất'],
    color: '#0EA5E9',
    route: '#archive',
    tags: ['zip', 'rar', 'nén', 'xem', 'preview', 'tree', 'extract']
  },
  {
    id: 'server-archive',
    title: 'Nén Tệp ZIP',
    description: 'Nén tệp tin và thư mục thành định dạng ZIP.',
    category: 'archive',
    icon: 'folder-archive',
    featured: false,
    specs: ['ZIP'],
    color: '#0EA5E9',
    route: '#server-archive',
    tags: ['zip', 'archive', 'nén']
  },

  // 3. Format Converters
  {
    id: 'universal-converter',
    title: 'File Converter',
    description: 'Chuyển đổi hình ảnh, video, âm thanh và tài liệu đa định dạng.',
    category: 'convert',
    icon: 'refresh-cw',
    featured: true,
    specs: ['Hình ảnh', 'Video & Nhạc', 'Tài liệu'],
    color: '#6366F1',
    route: '#tool/universal-converter',
    tags: ['convert', 'chuyển đổi', 'universal', 'file converter', 'ảnh', 'video', 'nhạc', 'văn bản', 'webp', 'mp4', 'pdf']
  },

  {
    id: 'markdown-docs',
    title: 'Văn Bản & Tài Liệu',
    description: 'Chuyển đổi Markdown sang HTML, Word (.docx) và in PDF.',
    category: 'convert',
    icon: 'code-2',
    featured: false,
    specs: ['Markdown', 'DOCX', 'PDF'],
    color: '#8B5CF6',
    route: '#tool/markdown-docs',
    tags: ['markdown', 'docx', 'html', 'pdf', 'document']
  },

  // 4. QR Studio
  {
    id: 'qr-multi',
    title: 'QR Studio',
    description: 'Tạo mã QR thanh toán VietQR Napas, Wi-Fi, liên kết và danh bạ.',
    category: 'qr',
    icon: 'qr-code',
    featured: true,
    specs: ['VietQR', 'Wi-Fi & Link', 'Tùy biến'],
    color: '#10B981',
    route: '#tool/qr-multi',
    tags: ['qr', 'qrcode', 'wifi', 'vietqr', 'vcard', 'tạo mã']
  },
  {
    id: 'qr-scan',
    title: 'Quét Mã QR',
    description: 'Đọc nội dung mã QR từ tệp ảnh hoặc clipboard.',
    category: 'qr',
    icon: 'scan-line',
    featured: false,
    specs: ['Ảnh & Clipboard'],
    color: '#10B981',
    route: '#tool/qr-scan',
    tags: ['qr', 'quét', 'decode', 'reader']
  },

  // 5. System & Utility
  {
    id: 'studocu-dl',
    title: 'Studocu Downloader',
    description: 'Tải giáo trình & tài liệu Studocu sang PDF rõ nét.',
    category: 'system',
    icon: 'file-down',
    featured: false,
    specs: ['PDF', 'Tài liệu học tập'],
    color: '#6366F1',
    tier: 'UR',
    route: '#tool/studocu-dl',
    tags: ['studocu', 'tài liệu', 'tiện ích', 'download', 'pdf', 'slide', 'bài giảng']
  },
  {
    id: 'facebook-downloader',
    title: 'Facebook Downloader',
    description: 'Tải video Reel, bài viết và ảnh Facebook chất lượng gốc HD, lưu trực tiếp vào Drive.',
    category: 'media',
    icon: 'video',
    featured: true,
    specs: ['Video, Reel & Bài viết', 'MP4 & Ảnh HD', 'Lưu Drive'],
    color: '#1877F2',
    tier: 'UR',
    route: '#tool/facebook-downloader',
    tags: ['facebook', 'fb', 'video', 'reel', 'post', 'bài viết', 'ảnh', 'tải video facebook', 'media']
  },
  {
    id: 'instagram-downloader',
    title: 'Instagram Downloader',
    description: 'Tải video Reels, bài viết và Story Instagram sang MP4 không nén, lưu trực tiếp vào Drive.',
    category: 'media',
    icon: 'camera',
    featured: true,
    specs: ['Reels & Story', 'MP4 Full HD', 'Lưu Drive'],
    color: '#E1306C',
    tier: 'UR',
    route: '#tool/instagram-downloader',
    tags: ['instagram', 'ig', 'reels', 'story', 'tải video instagram', 'media']
  },
  {
    id: 'spotify-downloader',
    title: 'Spotify Downloader',
    description: 'Tải bài hát Spotify sang MP3 chất lượng cao, kèm ảnh bìa album và lưu trực tiếp vào Drive.',
    category: 'media',
    icon: 'music',
    featured: true,
    specs: ['MP3 320kbps', 'Ảnh bìa Album', 'Lưu Drive'],
    color: '#1DB954',
    tier: 'UR',
    route: '#tool/spotify-downloader',
    tags: ['spotify', 'nhạc', 'mp3', 'âm thanh', 'tải nhạc spotify', 'audio', 'media']
  },
  {
    id: 'tiktok-downloader',
    title: 'TikTok Downloader',
    description: 'Tải video & album ảnh slideshow TikTok không logo, âm thanh MP3 và lưu trực tiếp vào Drive.',
    category: 'media',
    icon: 'video',
    featured: true,
    specs: ['Không Logo', 'Video & Album Ảnh', 'Lưu Drive'],
    color: '#EE1D52',
    route: '#tool/tiktok-downloader',
    tags: ['tiktok', 'tik tok', 'tải video', 'album ảnh', 'slideshow', 'photo mode', 'tiktok downloader', 'no watermark', 'không logo', 'mp3', 'video', 'douyin', 'media']
  },
  {
    id: 'youtube-downloader',
    title: 'YouTube Downloader',
    description: 'Tải video Full HD/4K hoặc trích xuất âm thanh MP3 320kbps siêu tốc, lưu trực tiếp vào Drive.',
    category: 'media',
    icon: 'youtube',
    featured: true,
    specs: ['MP4 1080p', 'MP3 320kbps', 'Lưu Drive'],
    color: '#FF0000',
    route: '#tool/youtube-downloader',
    tags: ['youtube', 'yt', 'tải video', 'tải nhạc', 'youtube downloader', 'mp3', 'mp4', '1080p', 'audio', 'video', 'shorts', 'âm thanh', 'media']
  },
  {
    id: 'scribd-archiver',
    title: 'Scribd Downloader',
    description: 'Tải tài liệu & slide Scribd sang file PDF rõ nét.',
    category: 'system',
    icon: 'book-open',
    featured: true,
    specs: ['PDF', 'Slides', 'Drive'],
    color: '#EA580C',
    tier: 'UR',
    route: '#tool/scribd',
    tags: ['scribd', 'scribd downloader', 'tài liệu', 'pdf', 'archiver', 'download', 'sách', 'slide', 'tiện ích']
  },

  // 6. Advanced Tools
  {
    id: 'view-split',
    title: 'ViewSplit',
    description: 'So sánh hình ảnh đa khung nhìn, thanh trượt đè Before/After và soi điểm ảnh Pixel Inspector.',
    category: 'advanced',
    icon: 'columns-2',
    featured: true,
    specs: ['So sánh đa ảnh', 'Slider Wipe', 'Pixel Inspector'],
    color: '#06B6D4',
    route: '#tool/view-split',
    tags: ['viewsplit', 'view split', 'so sánh ảnh', 'soi điểm ảnh', 'pixel inspector', 'slider wipe', 'diff', 'compare', 'nâng cao', 'advanced']
  },
  {
    id: 'hash-checksum',
    title: 'Mã Băm & Base64',
    description: 'Tính mã băm MD5, SHA-256 và mã hóa, giải mã Base64.',
    category: 'advanced',
    icon: 'binary',
    featured: false,
    specs: ['MD5', 'SHA-256', 'Base64'],
    color: '#64748B',
    route: '#tool/hash-checksum',
    tags: ['hash', 'md5', 'sha256', 'base64', 'nâng cao', 'advanced']
  },
  {
    id: 'storage',
    title: 'Bộ Nhớ Lưu Trữ',
    description: 'Kho lưu trữ và truyền tải tập tin an toàn giữa các thiết bị.',
    category: 'advanced',
    icon: 'hard-drive',
    featured: false,
    specs: ['Cloud Drive', 'Truyền tệp'],
    color: '#6366F1',
    route: '#storage',
    tags: ['storage', 'drive', 'files', 'lưu trữ', 'casaos', 'tập tin', 'upload', 'download', 'bộ nhớ', 'nâng cao']
  }
];

/**
 * 10 Cấp Độ Phân Hạng Thẻ Công Cụ (Tool Card Tier List 10 Levels)
 * Thứ tự phân hạng từ thấp đến cao: E -> D -> C -> B -> A -> S -> SS -> UR -> LR -> EX
 */
export const CARD_TIERS = Object.freeze({
  E: {
    id: 'E',
    code: 'E',
    name: 'Matte Slate',
    titleVi: 'Cơ bản thấp',
    level: 1,
    className: 'tier-e',
    badgeText: 'E · BASIC',
    color: '#71717A',
    description: 'Viền đơn phiến tối giản, bề mặt mờ thanh lịch, zero glow.'
  },
  D: {
    id: 'D',
    code: 'D',
    name: 'Frosted Quartz',
    titleVi: 'Tiêu chuẩn',
    level: 2,
    className: 'tier-d',
    badgeText: 'D · STANDARD',
    color: '#0EA5E9',
    description: 'Viền thép mát lạnh, rãnh sáng specular đỉnh thẻ, tinh tế trang nhã.'
  },
  C: {
    id: 'C',
    code: 'C',
    name: 'Anodized Emerald',
    titleVi: 'Khá',
    level: 3,
    className: 'tier-c',
    badgeText: 'C · UNCOMMON',
    color: '#10B981',
    description: 'Viền ngọc lục bảo anode hóa, ngạnh L-shaped micro-ticks 4 góc trong.'
  },
  B: {
    id: 'B',
    code: 'B',
    name: 'Brushed Titanium',
    titleVi: 'Hiếm',
    level: 4,
    className: 'tier-b',
    badgeText: 'B · RARE',
    color: '#94A3B8',
    description: 'Khung giáp Double-Bezel rãnh kép phay xước, huy hiệu titan sapphire.'
  },
  A: {
    id: 'A',
    code: 'A',
    name: 'Imperial Gold',
    titleVi: 'Sử thi',
    level: 5,
    className: 'tier-a',
    badgeText: 'A · EPIC',
    color: '#F59E0B',
    description: 'Viền vàng đồng gia công cơ khí chính xác, dải laser vàng phẳng đỉnh thẻ.'
  },
  S: {
    id: 'S',
    code: 'S',
    name: 'Royal Amethyst',
    titleVi: 'Siêu việt',
    level: 6,
    className: 'tier-s',
    badgeText: 'S · MASTER',
    color: '#8B5CF6',
    description: 'Mặt nạ viền kim loại vàng hồng & tím hoàng gia, vân lụa chéo, bệ icon phát sáng.'
  },
  SS: {
    id: 'SS',
    code: 'SS',
    name: 'Crimson Prestige',
    titleVi: 'Đại cao thủ',
    level: 7,
    className: 'tier-ss',
    badgeText: '★ SS · GRANDMASTER',
    color: '#F43F5E',
    description: 'Phiến sưu tập cao cấp, ngạnh góc CAD vát cạnh trong, tiêu điểm hồng ngọc.'
  },
  UR: {
    id: 'UR',
    code: 'UR',
    name: 'Prismatic Hologram',
    titleVi: 'Thần thoại',
    level: 8,
    className: 'tier-ur',
    badgeText: '✦ UR · MYTHIC',
    color: '#EC4899',
    description: 'Viền lưỡng sắc chuyển màu mượt mà, ánh kim quang học Holo Foil quét đa chiều.'
  },
  LR: {
    id: 'LR',
    code: 'LR',
    name: 'Sovereign Flare',
    titleVi: 'Huyền thoại tối thượng',
    level: 9,
    className: 'tier-lr',
    badgeText: '❖ LR · SOVEREIGN',
    color: '#EAB308',
    description: 'Khung cấu trúc 3 tầng hoàng kim đế vương, chân góc hình học, chân trời ánh sáng.'
  },
  EX: {
    id: 'EX',
    code: 'EX',
    name: 'Astral Singularity',
    titleVi: 'Đẳng cấp vũ trụ đặc biệt',
    level: 10,
    className: 'tier-ex',
    badgeText: '✦ EX · CELESTIAL',
    color: '#06B6D4',
    description: 'Tuyệt tác vũ trụ, viền Conic quay 360 độ siêu nét 1.5px, lưới tọa độ sao và hào quang tinh vân.'
  }
});

export function getCardTierConfig(tierKey) {
  if (!tierKey) return null;
  const key = String(tierKey).trim().toUpperCase();
  return CARD_TIERS[key] || null;
}

export const TOOL_LAYOUT_STORAGE_KEY = 'ds_tool_layout_override';
export const TOOL_CATEGORIES_STORAGE_KEY = 'ds_tool_categories_override';

export const DEFAULT_TOOL_CATEGORIES = [
  { id: 'pdf', label: 'PDF', color: '#F59E0B' },
  { id: 'convert', label: 'Chuyển đổi', color: '#8B5CF6' },
  { id: 'archive', label: 'File nén', color: '#0EA5E9' },
  { id: 'qr', label: 'Mã QR', color: '#10B981' },
  { id: 'media', label: 'Media', color: '#E11D48' },
  { id: 'system', label: 'Tiện ích', color: '#6366F1' },
  { id: 'advanced', label: 'Nâng cao', color: '#EC4899' }
];

class ToolRegistry {
  constructor() {
    this.tools = DEFAULT_TOOLS.map(t => ({ ...t }));
    this.categories = DEFAULT_TOOL_CATEGORIES.map(c => ({ ...c }));
    this.listeners = new Set();
    this.currentCategory = 'all';
    this.searchQuery = '';
    this.channel = null;
    this.loadLocalLayout();
    this.initCrossTabSync();
  }

  getCategories() {
    return [
      { id: 'all', label: 'Tất cả', color: '#A1A1AA' },
      ...this.categories
    ];
  }

  getRawCategories() {
    return this.categories;
  }

  initCrossTabSync() {
    if (typeof window === 'undefined') return;

    // 1. BroadcastChannel for instant 0ms cross-tab sync
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('ds_tool_layout');
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'TOOL_LAYOUT_UPDATED') {
            if (Array.isArray(event.data.categories)) {
              this.applyCategoriesSync(event.data.categories, false);
            }
            if (Array.isArray(event.data.items)) {
              this.applyLayoutSync(event.data.items, false);
            }
          }
        };
      } catch (_) {}
    }

    // 2. Cross-tab localStorage storage event fallback
    window.addEventListener('storage', (e) => {
      if (e.key === TOOL_CATEGORIES_STORAGE_KEY && e.newValue) {
        try {
          const cats = JSON.parse(e.newValue);
          if (Array.isArray(cats)) {
            this.applyCategoriesSync(cats, false);
          }
        } catch (_) {}
      }
      if (e.key === TOOL_LAYOUT_STORAGE_KEY && e.newValue) {
        try {
          const items = JSON.parse(e.newValue);
          if (Array.isArray(items)) {
            this.applyLayoutSync(items, false);
          }
        } catch (_) {}
      }
    });

    // 3. Tab visibility / window focus auto-check
    window.addEventListener('focus', () => this.fetchServerLayout());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.fetchServerLayout();
      }
    });

    // 4. Background gentle polling every 12 seconds when active
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.fetchServerLayout();
      }
    }, 12000);
    if (pollTimer && typeof pollTimer.unref === 'function') {
      pollTimer.unref();
    }
  }

  loadLocalLayout() {
    try {
      if (typeof localStorage !== 'undefined') {
        const rawCats = localStorage.getItem(TOOL_CATEGORIES_STORAGE_KEY);
        if (rawCats) {
          const cats = JSON.parse(rawCats);
          if (Array.isArray(cats) && cats.length > 0) {
            this.applyCategoriesSync(cats, false);
          }
        }
        const raw = localStorage.getItem(TOOL_LAYOUT_STORAGE_KEY);
        if (raw) {
          const items = JSON.parse(raw);
          if (Array.isArray(items) && items.length > 0) {
            this.applyLayoutSync(items, false);
          }
        }
      }
    } catch (err) {
      console.warn('[ToolRegistry] Failed to load local layout override:', err);
    }
  }

  applyCategoriesSync(newCategories, shouldSave = true) {
    if (!Array.isArray(newCategories) || newCategories.length === 0) return;

    const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const sanitized = [];
    const seenIds = new Set();

    for (const cat of newCategories) {
      if (!cat || typeof cat.id !== 'string') continue;
      const id = cat.id.trim().toLowerCase();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      sanitized.push({
        id,
        label: typeof cat.label === 'string' && cat.label.trim() ? cat.label.trim() : id,
        color: typeof cat.color === 'string' && hexColorRegex.test(cat.color.trim()) ? cat.color.trim() : '#6366F1'
      });
    }

    // Ensure default categories exist
    for (const def of DEFAULT_TOOL_CATEGORIES) {
      if (!seenIds.has(def.id)) {
        seenIds.add(def.id);
        sanitized.push({ ...def });
      }
    }

    let hasDiff = sanitized.length !== this.categories.length;
    if (!hasDiff) {
      for (let i = 0; i < sanitized.length; i++) {
        if (sanitized[i].id !== this.categories[i]?.id ||
            sanitized[i].label !== this.categories[i]?.label ||
            sanitized[i].color !== this.categories[i]?.color) {
          hasDiff = true;
          break;
        }
      }
    }

    this.categories = sanitized;

    if (shouldSave && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(TOOL_CATEGORIES_STORAGE_KEY, JSON.stringify(this.categories));
      } catch (e) {
        console.warn('[ToolRegistry] Failed to save categories to localStorage:', e);
      }
    }

    if (this.channel && shouldSave) {
      try {
        this.channel.postMessage({
          type: 'TOOL_LAYOUT_UPDATED',
          items: this.tools.map((t, idx) => ({ id: t.id, category: t.category, order: idx + 1 })),
          categories: this.categories
        });
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && shouldSave) {
      try {
        window.dispatchEvent(new CustomEvent('ds:tool-categories-changed', {
          detail: { categories: this.categories }
        }));
      } catch (_) {}
    }

    if (hasDiff || shouldSave) {
      this.notify();
    }
  }

  applyLayoutSync(layoutItems, shouldSave = true) {
    if (!Array.isArray(layoutItems) || layoutItems.length === 0) return;

    const layoutMap = new Map();
    layoutItems.forEach((it, idx) => {
      if (it && it.id) {
        layoutMap.set(it.id, {
          category: it.category,
          order: typeof it.order === 'number' ? it.order : idx + 1
        });
      }
    });

    // Check if there are any differences between new layout and current tools
    let hasDifference = false;
    for (let i = 0; i < this.tools.length; i++) {
      const tool = this.tools[i];
      const override = layoutMap.get(tool.id);
      if (override && override.category && tool.category !== override.category) {
        hasDifference = true;
        break;
      }
    }
    if (!hasDifference) {
      const sortedIds = [...this.tools].sort((a, b) => {
        const orderA = layoutMap.has(a.id) ? layoutMap.get(a.id).order : 9999;
        const orderB = layoutMap.has(b.id) ? layoutMap.get(b.id).order : 9999;
        return orderA - orderB;
      }).map(t => t.id);

      const currentIds = this.tools.map(t => t.id);
      for (let i = 0; i < currentIds.length; i++) {
        if (currentIds[i] !== sortedIds[i]) {
          hasDifference = true;
          break;
        }
      }
    }

    // Update categories
    this.tools.forEach(tool => {
      const override = layoutMap.get(tool.id);
      if (override && override.category) {
        tool.category = override.category;
      }
    });

    // Sort according to order
    this.tools.sort((a, b) => {
      const orderA = layoutMap.has(a.id) ? layoutMap.get(a.id).order : 9999;
      const orderB = layoutMap.has(b.id) ? layoutMap.get(b.id).order : 9999;
      return orderA - orderB;
    });

    if (shouldSave && typeof localStorage !== 'undefined') {
      try {
        const toSave = this.tools.map((t, idx) => ({
          id: t.id,
          category: t.category,
          order: idx + 1
        }));
        localStorage.setItem(TOOL_LAYOUT_STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
        console.warn('[ToolRegistry] Failed to save layout to localStorage:', e);
      }
    }

    // Broadcast update across open tabs in real-time
    if (this.channel && shouldSave) {
      try {
        this.channel.postMessage({
          type: 'TOOL_LAYOUT_UPDATED',
          items: this.tools.map((t, idx) => ({ id: t.id, category: t.category, order: idx + 1 }))
        });
      } catch (_) {}
    }

    if (typeof window !== 'undefined' && shouldSave) {
      try {
        window.dispatchEvent(new CustomEvent('ds:tool-layout-changed', {
          detail: { tools: this.tools }
        }));
      } catch (_) {}
    }

    // Only notify listeners if layout actually changed or explicit save
    if (hasDifference || shouldSave) {
      this.notify();
    }
  }

  async fetchServerLayout() {
    try {
      const res = await fetch('/api/v1/system/tool-layout', {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          if (Array.isArray(json.data.categories)) {
            this.applyCategoriesSync(json.data.categories, true);
          }
          if (Array.isArray(json.data.items)) {
            this.applyLayoutSync(json.data.items, true);
          }
        }
      }
    } catch {
      // Silent catch for offline PWA
    }
  }

  async saveLayoutToServer(layoutItems, authHeaders = {}, categories = null) {
    const payload = { items: layoutItems };
    if (Array.isArray(categories)) {
      payload.categories = categories;
    }

    const res = await fetch('/api/v1/admin/tool-layout', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Lỗi khi lưu cấu hình thẻ công cụ');
    }
    if (Array.isArray(json.data?.categories)) {
      this.applyCategoriesSync(json.data.categories, true);
    }
    this.applyLayoutSync(json.data?.items || layoutItems, true);
    return json;
  }

  async resetLayoutToServer(authHeaders = {}) {
    const res = await fetch('/api/v1/admin/tool-layout/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) {
      throw new Error(json.message || json.error || 'Lỗi khi khôi phục cấu hình thẻ công cụ');
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(TOOL_LAYOUT_STORAGE_KEY);
        localStorage.removeItem(TOOL_CATEGORIES_STORAGE_KEY);
      } catch {}
    }

    this.categories = DEFAULT_TOOL_CATEGORIES.map(c => ({ ...c }));
    this.tools = DEFAULT_TOOLS.map(t => ({ ...t }));
    this.notify();
    return json;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getFilteredTools(), this.currentCategory, this.searchQuery);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const list = this.getFilteredTools();
    this.listeners.forEach(fn => fn(list, this.currentCategory, this.searchQuery));
  }

  setCategory(cat) {
    if (this.currentCategory === cat) return;
    this.currentCategory = cat;
    this.notify();
  }

  setSearchQuery(q) {
    this.searchQuery = q.toLowerCase().trim();
    this.notify();
  }

  getFilteredTools() {
    return this.tools.filter(tool => {
      const matchCat = this.currentCategory === 'all' || tool.category === this.currentCategory;
      if (!matchCat) return false;
      if (!this.searchQuery) return true;
      const haystack = `${tool.title} ${tool.description} ${tool.tags.join(' ')}`.toLowerCase();
      return haystack.includes(this.searchQuery);
    });
  }

  getToolById(id) {
    if (id === 'pdf' || id === 'pdf-convert' || id === 'pdf-merge' || id === 'pdf-lock') {
      return this.tools.find(t => t.id === 'pdf-studio') || this.tools[0];
    }
    if (id === 'image-converter' || id === 'video-audio' || id === 'converter') {
      return this.tools.find(t => t.id === 'universal-converter') || this.tools[0];
    }
    if (id === 'scribd' || id === 'scribd-archiver') {
      return this.tools.find(t => t.id === 'scribd-archiver') || this.tools[0];
    }
    if (id === 'facebook' || id === 'facebook-downloader') {
      return this.tools.find(t => t.id === 'facebook-downloader') || this.tools[0];
    }
    if (id === 'instagram' || id === 'instagram-downloader') {
      return this.tools.find(t => t.id === 'instagram-downloader') || this.tools[0];
    }
    if (id === 'spotify' || id === 'spotify-downloader') {
      return this.tools.find(t => t.id === 'spotify-downloader') || this.tools[0];
    }
    return this.tools.find(t => t.id === id) || this.tools[0];
  }

  setToolTier(toolId, tierKey) {
    const tool = this.tools.find(t => t.id === toolId);
    if (!tool) return false;
    const tierConfig = getCardTierConfig(tierKey);
    if (tierConfig) {
      tool.tier = tierConfig.code;
    } else {
      delete tool.tier;
    }
    this.notify();
    return true;
  }

  getToolTier(toolId) {
    const tool = this.tools.find(t => t.id === toolId);
    return tool ? tool.tier || null : null;
  }
}

export const toolRegistry = new ToolRegistry();

if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      toolRegistry.fetchServerLayout();
    } catch {}
  }, 120);
}

