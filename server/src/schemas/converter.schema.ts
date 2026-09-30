import { z } from 'zod';

export const converterDetectSchema = z.object({
  fileId: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional()
});

export type ConverterDetectInput = z.infer<typeof converterDetectSchema>;

export const enqueueConverterJobSchema = z.object({
  fileId: z.string().min(1, 'fileId is required'),
  targetFormat: z.string().min(1, 'targetFormat is required'),
  options: z.record(z.unknown()).optional().default({})
});

export type EnqueueConverterJobInput = z.infer<typeof enqueueConverterJobSchema>;

export interface ConverterJobPayload {
  jobId: string;
  fileId: string;
  targetFormat: string;
  options?: Record<string, unknown>;
}

export const CATEGORY_FORMATS: Record<string, string[]> = {
  image: ['webp', 'png', 'jpg', 'jpeg', 'ico', 'gif', 'bmp', 'tiff', 'pdf'],
  video: ['mp4', 'webm', 'gif', 'mp3', 'wav', 'aac', 'mkv', 'avi', 'mov'],
  audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'opus'],
  document: ['pdf', 'docx', 'txt', 'html', 'md'],
  data: ['csv', 'xlsx', 'json', 'xml', 'html', 'txt'],
  archive: ['zip', 'tar', 'gz', '7z']
};

export const EXTENSION_CATEGORIES: Record<string, { category: string; label: string }> = {
  jpg: { category: 'image', label: 'Hình ảnh' },
  jpeg: { category: 'image', label: 'Hình ảnh' },
  png: { category: 'image', label: 'Hình ảnh' },
  webp: { category: 'image', label: 'Hình ảnh' },
  bmp: { category: 'image', label: 'Hình ảnh' },
  tiff: { category: 'image', label: 'Hình ảnh' },
  tif: { category: 'image', label: 'Hình ảnh' },
  ico: { category: 'image', label: 'Hình ảnh' },
  gif: { category: 'image', label: 'Hình ảnh' },
  svg: { category: 'image', label: 'Hình ảnh' },
  avif: { category: 'image', label: 'Hình ảnh' },
  heic: { category: 'image', label: 'Hình ảnh' },
  heif: { category: 'image', label: 'Hình ảnh' },

  mp4: { category: 'video', label: 'Video' },
  mov: { category: 'video', label: 'Video' },
  avi: { category: 'video', label: 'Video' },
  mkv: { category: 'video', label: 'Video' },
  webm: { category: 'video', label: 'Video' },
  flv: { category: 'video', label: 'Video' },
  wmv: { category: 'video', label: 'Video' },

  mp3: { category: 'audio', label: 'Âm thanh' },
  wav: { category: 'audio', label: 'Âm thanh' },
  flac: { category: 'audio', label: 'Âm thanh' },
  aac: { category: 'audio', label: 'Âm thanh' },
  ogg: { category: 'audio', label: 'Âm thanh' },
  m4a: { category: 'audio', label: 'Âm thanh' },

  pdf: { category: 'document', label: 'Tài liệu Văn bản' },
  docx: { category: 'document', label: 'Tài liệu Văn bản' },
  doc: { category: 'document', label: 'Tài liệu Văn bản' },
  pptx: { category: 'document', label: 'Tài liệu Văn bản' },
  ppt: { category: 'document', label: 'Tài liệu Văn bản' },
  txt: { category: 'document', label: 'Tài liệu Văn bản' },
  html: { category: 'document', label: 'Tài liệu Văn bản' },
  md: { category: 'document', label: 'Tài liệu Văn bản' },
  rtf: { category: 'document', label: 'Tài liệu Văn bản' },

  csv: { category: 'data', label: 'Tài liệu Bảng tính' },
  xlsx: { category: 'data', label: 'Tài liệu Bảng tính' },
  xls: { category: 'data', label: 'Tài liệu Bảng tính' },
  json: { category: 'data', label: 'Dữ liệu Cấu trúc' },
  xml: { category: 'data', label: 'Dữ liệu Cấu trúc' },

  zip: { category: 'archive', label: 'Tệp nén' },
  '7z': { category: 'archive', label: 'Tệp nén' },
  tar: { category: 'archive', label: 'Tệp nén' },
  gz: { category: 'archive', label: 'Tệp nén' }
};

export function getMimeTypeForExt(ext: string): string {
  const clean = ext.toLowerCase().replace(/^\./, '');
  const mimeMap: Record<string, string> = {
    webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    avif: 'image/avif', gif: 'image/gif', ico: 'image/x-icon', svg: 'image/svg+xml',
    bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
    mov: 'video/quicktime', ogv: 'video/ogg', flv: 'video/x-flv',
    mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg',
    flac: 'audio/flac', m4a: 'audio/mp4', opus: 'audio/opus',
    pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain; charset=utf-8', html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    md: 'text/markdown; charset=utf-8', markdown: 'text/markdown; charset=utf-8',
    rtf: 'application/rtf',
    json: 'application/json; charset=utf-8', xml: 'text/xml; charset=utf-8',
    csv: 'text/csv; charset=utf-8', log: 'text/plain; charset=utf-8',
    js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    ts: 'text/plain; charset=utf-8', tsx: 'text/plain; charset=utf-8', jsx: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8', py: 'text/plain; charset=utf-8', sh: 'text/plain; charset=utf-8',
    yaml: 'text/yaml; charset=utf-8', yml: 'text/yaml; charset=utf-8',
    c: 'text/plain; charset=utf-8', cpp: 'text/plain; charset=utf-8', h: 'text/plain; charset=utf-8',
    rs: 'text/plain; charset=utf-8', go: 'text/plain; charset=utf-8', java: 'text/plain; charset=utf-8',
    sql: 'text/plain; charset=utf-8', ini: 'text/plain; charset=utf-8', env: 'text/plain; charset=utf-8',
    zip: 'application/zip', '7z': 'application/x-7z-compressed', tar: 'application/x-tar',
    rar: 'application/x-rar-compressed', gz: 'application/gzip', bz2: 'application/x-bzip2'
  };
  return mimeMap[clean] || 'application/octet-stream';
}

const VIDEO_TARGETS = ['webm', 'mp4', 'gif', 'avi', 'mkv', 'mov'];
const VIDEO_EXTRACT_AUDIO = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus'];
const AUDIO_TARGETS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'];
const ARCHIVE_TARGETS = ['zip', '7z', 'tar', 'gz'];

export const COMPATIBILITY_MATRIX: Record<string, string[]> = {
  docx: ['pdf', 'txt', 'html', 'md'],
  doc: ['pdf', 'txt', 'html', 'md'],
  pdf: ['docx', 'txt', 'html', 'md', 'rtf', 'png', 'jpg'],
  pptx: ['pdf', 'png', 'jpg', 'txt'],
  ppt: ['pdf', 'png', 'jpg', 'txt'],
  txt: ['csv', 'xlsx', 'json', 'xml', 'html'],
  html: ['csv', 'xlsx', 'json', 'xml', 'txt'],
  htm: ['csv', 'xlsx', 'json', 'xml', 'txt'],
  md: ['csv', 'xlsx', 'json', 'xml', 'html', 'txt'],
  markdown: ['csv', 'xlsx', 'json', 'xml', 'html', 'txt'],
  csv: ['xlsx', 'json', 'xml', 'html', 'txt'],
  xlsx: ['csv', 'json', 'xml', 'html', 'txt'],
  xls: ['csv', 'json', 'xml', 'html', 'txt'],
  json: ['csv', 'xlsx', 'xml', 'html', 'txt'],
  xml: ['json', 'csv', 'xlsx', 'html', 'txt'],
  png: ['webp', 'jpg', 'ico', 'pdf', 'bmp'],
  jpg: ['webp', 'png', 'ico', 'pdf', 'bmp'],
  jpeg: ['webp', 'png', 'ico', 'pdf', 'bmp'],
  webp: ['png', 'jpg', 'ico', 'pdf', 'bmp'],
  bmp: ['png', 'jpg', 'webp', 'ico', 'pdf'],
  tiff: ['png', 'jpg', 'webp', 'ico', 'pdf', 'bmp'],
  tif: ['png', 'jpg', 'webp', 'ico', 'pdf', 'bmp'],
  svg: ['png', 'jpg', 'pdf'],
  ico: ['png', 'webp', 'jpg', 'bmp'],
  gif: ['webp', 'png', 'jpg'],
  heic: ['jpg', 'png', 'webp'],
  heif: ['jpg', 'png', 'webp'],
  mp4: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  mov: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  avi: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  mkv: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  webm: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  flv: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  wmv: [...VIDEO_TARGETS, ...VIDEO_EXTRACT_AUDIO],
  mp3: AUDIO_TARGETS,
  wav: AUDIO_TARGETS,
  flac: AUDIO_TARGETS,
  aac: AUDIO_TARGETS,
  ogg: AUDIO_TARGETS,
  m4a: AUDIO_TARGETS,
  opus: AUDIO_TARGETS,
  zip: ARCHIVE_TARGETS,
  '7z': ARCHIVE_TARGETS,
  tar: ARCHIVE_TARGETS,
  gz: ARCHIVE_TARGETS
};

export const SMART_DEFAULTS: Record<string, string> = {
  docx: 'pdf', doc: 'pdf', pdf: 'docx', pptx: 'pdf', ppt: 'pdf',
  txt: 'csv', html: 'csv', htm: 'csv', md: 'csv', markdown: 'csv',
  csv: 'xlsx', xlsx: 'csv', xls: 'csv', json: 'csv', xml: 'json',
  png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png',
  tiff: 'png', tif: 'png', svg: 'png', ico: 'png', gif: 'png',
  heic: 'jpg', heif: 'jpg',
  mp4: 'webm', mov: 'mp4', avi: 'mp4', mkv: 'mp4', webm: 'mp4', flv: 'mp4', wmv: 'mp4',
  mp3: 'wav', wav: 'mp3', flac: 'mp3', aac: 'mp3', ogg: 'mp3', m4a: 'mp3', opus: 'mp3',
  zip: '7z', '7z': 'zip', tar: 'zip', gz: 'zip'
};

export function getDefaultTarget(ext: string): string {
  const clean = ext.toLowerCase().replace(/^\./, '');
  if (SMART_DEFAULTS[clean]) return SMART_DEFAULTS[clean];
  const list = COMPATIBILITY_MATRIX[clean];
  if (list && list.length > 0) return list[0];
  const cat = EXTENSION_CATEGORIES[clean]?.category || 'document';
  const catFormats = CATEGORY_FORMATS[cat] || ['pdf'];
  return catFormats.find((f) => f !== clean) || catFormats[0] || 'pdf';
}

export function getCompatibleFormats(ext: string): string[] {
  const clean = ext.toLowerCase().replace(/^\./, '');
  const cat = EXTENSION_CATEGORIES[clean]?.category || 'document';
  const rawTargets = COMPATIBILITY_MATRIX[clean] || (CATEGORY_FORMATS[cat] || ['pdf']);
  return rawTargets.filter((fmt) => fmt !== clean && fmt !== 'svg' && fmt !== 'avif');
}
