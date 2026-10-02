/**
 * useToolRegistry - Central Tool Catalog
 */

const DEFAULT_TOOLS = [
  // 1. PDF Studio Suite
  {
    id: 'pdf-studio',
    title: 'PDF Studio Pro',
    description: 'Ghép, tách, xoay, nén, đóng dấu và xem PDF chuyên nghiệp.',
    category: 'pdf',
    icon: 'file-text',
    badge: '10-in-1 Suite',
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
    badge: 'AI A4 PDF',
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
    badge: 'Zero-Extraction',
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
    badge: '',
    featured: false,
    specs: ['ZIP'],
    color: '#0EA5E9',
    route: '#server-archive',
    tags: ['zip', 'archive', 'nén']
  },

  // 3. Format Converters
  {
    id: 'universal-converter',
    title: 'File Converter Pro',
    description: 'Chuyển đổi 65+ định dạng hình ảnh, video, âm thanh và tài liệu.',
    category: 'convert',
    icon: 'refresh-cw',
    badge: '65+ Định dạng',
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
    badge: '',
    featured: false,
    specs: ['Markdown', 'DOCX', 'PDF'],
    color: '#8B5CF6',
    route: '#tool/markdown-docs',
    tags: ['markdown', 'docx', 'html', 'pdf', 'document']
  },

  // 4. QR Studio
  {
    id: 'qr-multi',
    title: 'QR Studio Pro',
    description: 'Tạo mã QR thanh toán VietQR Napas, Wi-Fi, liên kết và danh bạ.',
    category: 'qr',
    icon: 'qr-code',
    badge: 'VietQR Napas',
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
    badge: '',
    featured: false,
    specs: ['Ảnh & Clipboard'],
    color: '#10B981',
    route: '#tool/qr-scan',
    tags: ['qr', 'quét', 'decode', 'reader']
  },

  // 5. System & Utility
  {
    id: 'hash-checksum',
    title: 'Mã Băm & Base64',
    description: 'Tính mã băm MD5, SHA-256 và mã hóa, giải mã Base64.',
    category: 'system',
    icon: 'binary',
    badge: '',
    featured: false,
    specs: ['MD5', 'SHA-256', 'Base64'],
    color: '#64748B',
    route: '#tool/hash-checksum',
    tags: ['hash', 'md5', 'sha256', 'base64']
  },
  {
    id: 'studocu-dl',
    title: 'Studocu Downloader',
    description: 'Trích xuất tài liệu Studocu sang PDF và Markdown.',
    category: 'system',
    icon: 'file-down',
    badge: '',
    featured: false,
    specs: ['PDF & MD'],
    color: '#6366F1',
    route: '#tool/studocu-dl',
    tags: ['studocu', 'tài liệu', 'tiện ích', 'download', 'pdf', 'slide', 'bài giảng']
  },
  {
    id: 'storage',
    title: 'Bộ Nhớ Lưu Trữ',
    description: 'Kho lưu trữ và truyền tải tập tin cá nhân an toàn giữa các thiết bị.',
    category: 'system',
    icon: 'hard-drive',
    badge: 'Cá nhân',
    featured: false,
    specs: ['Cloud Drive', 'Truyền tệp'],
    color: '#6366F1',
    route: '#storage',
    tags: ['storage', 'drive', 'files', 'lưu trữ', 'casaos', 'tập tin', 'upload', 'download']
  }
];


class ToolRegistry {
  constructor() {
    this.tools = [...DEFAULT_TOOLS];
    this.listeners = new Set();
    this.currentCategory = 'all';
    this.searchQuery = '';
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
    return this.tools.find(t => t.id === id) || this.tools[0];
  }
}

export const toolRegistry = new ToolRegistry();
