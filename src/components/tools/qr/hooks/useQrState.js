import { loadModuleState, saveModuleState } from '../../../../utilities/moduleState.js';

const dynamicLinkState = {
  link: '',
  targetUrl: '',
  preset: 'custom',
  title: '',
  customSlug: '',
  createdQr: null,
  isCreating: false,
  isEditingDestination: false,
  editTargetUrl: '',
  isSavingDestination: false,
  analytics: null,
  isRefreshingAnalytics: false
};

export const qrState = {
  activeTab: 'url', // 'url' | 'vietqr' | 'wifi' | 'vcard' | 'text'
  format: 'png',     // 'png' | 'svg'
  margin: 2,
  errorCorrectionLevel: 'M',
  colorDark: '#000000',
  colorLight: '#ffffff',
  width: 512,
  url: dynamicLinkState,
  dynamic: dynamicLinkState, // Aliased for seamless compatibility
  styling: {
    isExpanded: false,
    isCustomized: false,
    dotType: 'square',                 // Standard classic QR code
    dotColor: '#000000',
    useGradient: false,
    gradientStart: '#4F46E5',
    gradientEnd: '#06B6D4',
    cornerSquareType: 'square',        // Standard classic QR corners
    cornerDotType: 'square',
    cornerColor: '#000000',
    logoUrl: null,
    logoMargin: 6,
    logoSize: 0.32
  },
  vietqr: {
    bankBin: '970436', // Vietcombank default
    accountNumber: '',
    /** @type {number|string} */
    amount: '',
    purpose: ''
  },
  wifi: {
    ssid: '',
    password: '',
    security: 'WPA',
    hidden: false
  },
  vcard: {
    fullName: '',
    phone: '',
    email: '',
    organization: '',
    title: '',
    website: ''
  },
  text: {
    content: ''
  },
  scan: {
    result: null,
    isScanning: false,
    error: null
  },
  generatedResult: null, // for static QR: { content, dataUrl, format }
  isGenerating: false,
  error: null
};

// Hydrate saved state if available
const savedQr = loadModuleState('qr', null);
if (savedQr && typeof savedQr === 'object') {
  if (savedQr.activeTab && savedQr.activeTab !== 'scan') qrState.activeTab = savedQr.activeTab;
  if (savedQr.format) qrState.format = savedQr.format;
  if (savedQr.styling && typeof savedQr.styling === 'object') {
    Object.assign(qrState.styling, savedQr.styling);
    qrState.styling.isExpanded = false;
  }
  if (savedQr.vietqr && typeof savedQr.vietqr === 'object') Object.assign(qrState.vietqr, savedQr.vietqr);
  if (savedQr.wifi && typeof savedQr.wifi === 'object') Object.assign(qrState.wifi, savedQr.wifi);
  if (savedQr.vcard && typeof savedQr.vcard === 'object') Object.assign(qrState.vcard, savedQr.vcard);
  if (savedQr.text && typeof savedQr.text === 'object') Object.assign(qrState.text, savedQr.text);
  if (savedQr.scan && typeof savedQr.scan === 'object') Object.assign(qrState.scan, savedQr.scan);
  if (savedQr.dynamic && typeof savedQr.dynamic === 'object') {
    Object.assign(qrState.dynamic, savedQr.dynamic);
    qrState.url = qrState.dynamic;
  }
}

// CRITICAL: Always reset transient loading/scanning flags on startup
if (qrState.activeTab === 'scan') qrState.activeTab = 'url';
qrState.scan.isScanning = false;
qrState.scan.error = null;
qrState.isGenerating = false;
qrState.error = null;
if (qrState.dynamic) {
  qrState.dynamic.isCreating = false;
  qrState.dynamic.isEditingDestination = false;
  qrState.dynamic.isSavingDestination = false;
  qrState.dynamic.isRefreshingAnalytics = false;
}

export function persistQrState() {
  saveModuleState('qr', qrState);
}

export const POPULAR_BANKS = [
  { bin: '970436', name: 'Vietcombank', shortName: 'VCB' },
  { bin: '970415', name: 'VietinBank', shortName: 'VietinBank' },
  { bin: '970418', name: 'BIDV', shortName: 'BIDV' },
  { bin: '970422', name: 'MB Bank', shortName: 'MB' },
  { bin: '970407', name: 'Techcombank', shortName: 'Techcombank' },
  { bin: '970416', name: 'ACB', shortName: 'ACB' },
  { bin: '970432', name: 'VPBank', shortName: 'VPBank' },
  { bin: '970423', name: 'TPBank', shortName: 'TPBank' },
  { bin: '970441', name: 'VIB', shortName: 'VIB' },
  { bin: '970448', name: 'OCB', shortName: 'OCB' },
  { bin: '970405', name: 'Agribank', shortName: 'Agribank' },
  { bin: '970403', name: 'Sacombank', shortName: 'Sacombank' }
];

export const COLOR_PRESETS = [
  { val: '#000000', label: 'Đen' },
  { val: '#4F46E5', label: 'Indigo' },
  { val: '#06B6D4', label: 'Cyan' },
  { val: '#059669', label: 'Emerald' },
  { val: '#DC2626', label: 'Đỏ' }
];

export const URL_PRESETS = [
  { id: 'custom', label: 'Tùy chỉnh', placeholder: 'https://example.com' },
  { id: 'google-sheets', label: 'Google Sheets', placeholder: 'https://docs.google.com/spreadsheets/d/...' },
  { id: 'google-drive', label: 'Google Drive', placeholder: 'https://drive.google.com/drive/folders/...' },
  { id: 'google-docs', label: 'Google Docs', placeholder: 'https://docs.google.com/document/d/...' },
  { id: 'google-forms', label: 'Google Forms', placeholder: 'https://forms.gle/...' },
  { id: 'onedrive', label: 'OneDrive', placeholder: 'https://1drv.ms/...' },
  { id: 'dropbox', label: 'Dropbox', placeholder: 'https://dropbox.com/s/...' },
  { id: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/watch?v=...' },
  { id: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { id: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...' }
];

export const QR_TABS = [
  { id: 'url', label: 'Link Web', icon: 'globe' },
  { id: 'vietqr', label: 'VietQR', icon: 'credit-card' },
  { id: 'wifi', label: 'Wi-Fi', icon: 'wifi' },
  { id: 'vcard', label: 'Danh Bạ', icon: 'contact' },
  { id: 'text', label: 'Văn Bản', icon: 'file-text' }
];

export const GENERATOR_TABS = QR_TABS;

export const DOT_TYPES = [
  { id: 'rounded', label: 'Bo tròn' },
  { id: 'dots', label: 'Chấm tròn' },
  { id: 'classy', label: 'Cổ điển' },
  { id: 'square', label: 'Vuông' }
];

export const CORNER_SQUARE_TYPES = [
  { id: 'extra-rounded', label: 'Bo tròn lớn' },
  { id: 'dot', label: 'Chấm tròn' },
  { id: 'square', label: 'Vuông' }
];

export function getApiBase() {
  if (window.location.port === '5173') {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return '';
}
