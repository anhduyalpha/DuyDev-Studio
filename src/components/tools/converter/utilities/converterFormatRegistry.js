/**
 * Converter Format Registry & Output Compatibility Matrix (< 200 lines)
 * Canonical format categories, cross-format compatibility matrix, and smart defaults.
 */

export const SUPPORTED_CATEGORIES = [
  { id: 'image', label: 'Hình ảnh' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Âm thanh' },
  { id: 'document', label: 'Tài liệu Văn bản' },
  { id: 'data', label: 'Bảng tính & Dữ liệu' },
  { id: 'archive', label: 'Tệp nén' }
];

export const CATEGORY_FORMATS = {
  image: ['webp', 'png', 'jpg', 'ico', 'pdf', 'bmp', 'tiff', 'gif'],
  video: ['mp4', 'webm', 'gif', 'avi', 'mkv', 'mov', 'mp3', 'wav', 'aac', 'flac'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'],
  document: ['pdf', 'docx', 'txt', 'html', 'md'],
  data: ['csv', 'xlsx', 'json', 'xml', 'html', 'txt'],
  archive: ['zip', '7z', 'tar', 'gz']
};

const EXTENSION_CATEGORY_MAP = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', bmp: 'image',
  tiff: 'image', tif: 'image', ico: 'image', gif: 'image', svg: 'image',
  heic: 'image', heif: 'image',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  flv: 'video', wmv: 'video',
  mp3: 'audio', wav: 'audio', flac: 'audio', aac: 'audio', ogg: 'audio',
  m4a: 'audio', opus: 'audio',
  pdf: 'document', docx: 'document', doc: 'document', pptx: 'document',
  ppt: 'document', txt: 'document', html: 'document', htm: 'document',
  md: 'document', markdown: 'document', rtf: 'document',
  csv: 'data', xlsx: 'data', xls: 'data', json: 'data', xml: 'data',
  zip: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive'
};

const VIDEO_TARGETS = ['webm', 'mp4', 'gif', 'avi', 'mkv', 'mov'];
const VIDEO_EXTRACT_AUDIO = ['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus'];
const AUDIO_TARGETS = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'];
const ARCHIVE_TARGETS = ['zip', '7z', 'tar', 'gz'];

export const COMPATIBILITY_MATRIX = {
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

const SMART_DEFAULTS = {
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

const MIME_EXTENSION_MAP = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico',
  'image/bmp': 'bmp', 'image/tiff': 'tiff',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac',
  'audio/ogg': 'ogg', 'audio/flac': 'flac',
  'application/pdf': 'pdf', 'application/json': 'json', 'text/csv': 'csv',
  'application/zip': 'zip', 'application/x-7z-compressed': '7z',
  'application/x-tar': 'tar', 'application/gzip': 'gz'
};

export function sniffFileExtension(fileName = '', mimeType = '') {
  const safeName = typeof fileName === 'string' ? fileName.trim() : '';
  const parts = safeName.split('.');
  const ext = parts.length > 1 ? parts.pop().toLowerCase().trim() : '';
  if (ext) return ext;

  if (typeof mimeType === 'string' && mimeType.trim()) {
    const cleanMime = mimeType.split(';')[0].trim().toLowerCase();
    if (MIME_EXTENSION_MAP[cleanMime]) {
      return MIME_EXTENSION_MAP[cleanMime];
    }
  }
  return '';
}

export function getFormatCategory(sourceExt = '') {
  const clean = typeof sourceExt === 'string' ? sourceExt.toLowerCase().trim().replace(/^\./, '') : '';
  return EXTENSION_CATEGORY_MAP[clean] || 'document';
}

export function getSmartDefaultTarget(sourceExt = '') {
  const clean = typeof sourceExt === 'string' ? sourceExt.toLowerCase().trim().replace(/^\./, '') : '';
  if (SMART_DEFAULTS[clean]) return SMART_DEFAULTS[clean];
  const compatible = getCompatibleOutputs(clean);
  return compatible[0]?.id || 'pdf';
}

export function getCompatibleOutputs(sourceExt = '') {
  const clean = typeof sourceExt === 'string' ? sourceExt.toLowerCase().trim().replace(/^\./, '') : '';
  const cat = getFormatCategory(clean);
  const rawTargets = COMPATIBILITY_MATRIX[clean] || CATEGORY_FORMATS[cat] || ['pdf'];
  const defaultTarget = SMART_DEFAULTS[clean] || rawTargets.find((fmt) => fmt !== clean) || rawTargets[0];

  return rawTargets
    .filter((fmt) => fmt !== clean && fmt !== 'svg' && fmt !== 'avif')
    .map((fmt) => ({
      id: fmt,
      name: fmt.toUpperCase(),
      isRecommended: fmt === defaultTarget,
      category: AUDIO_TARGETS.includes(fmt) && cat === 'video' ? 'audio' : cat
    }));
}
