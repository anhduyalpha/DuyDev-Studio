/**
 * Studocu API Operations & Persistence Helper (< 110 lines)
 * Manages remote file system operations and active job persistence.
 */

const ACTIVE_JOB_KEY = 'ds_studocu_active_job';

export function saveActiveJob(data) {
  try {
    if (data) localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(data));
    else localStorage.removeItem(ACTIVE_JOB_KEY);
  } catch (_) {}
}

export function loadActiveJob() {
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

export async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(res.status >= 500 ? 'Máy chủ đang khởi động lại hoặc tạm bận, vui lòng thử lại.' : 'Phản hồi không đúng định dạng');
  }
  if (!res.ok || data?.error) throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  return data;
}

export async function fetchFilesAndTrash() {
  try {
    const [filesRes, trashRes] = await Promise.allSettled([
      fetch('/api/v1/studocu/files').then(r => r.ok ? r.json() : []),
      fetch('/api/v1/studocu/trash').then(r => r.ok ? r.json() : [])
    ]);
    return {
      files: filesRes.status === 'fulfilled' && Array.isArray(filesRes.value) ? filesRes.value : [],
      trash: trashRes.status === 'fulfilled' && Array.isArray(trashRes.value) ? trashRes.value : []
    };
  } catch (_) {
    return { files: [], trash: [] };
  }
}

export async function cancelJobApi(jobId) {
  if (!jobId) return false;
  const res = await fetch(`/api/v1/studocu/cancel/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => null);
  return res?.ok;
}

export async function moveToTrashApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/studocu/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function restoreFromTrashApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/studocu/trash/restore/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function deletePermanentApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/studocu/trash/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function emptyTrashApi() {
  const res = await fetch('/api/v1/studocu/trash/empty', {
    method: 'DELETE'
  }).catch(() => null);
  return res?.ok;
}

export function playCompleteSound() {
  try {
    const audio = new Audio('/src/assets/audio/complete.wav');
    audio.volume = 0.2;
    audio.play().catch(() => {});
  } catch (_) {}
}

export function extractStudocuUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // 1. Strip markdown links [title](url) or <url>
  const mdMatch = text.match(/\((https?:\/\/[^\s)]+)\)/i) || text.match(/<([^\s>]+)>/);
  if (mdMatch) {
    text = mdMatch[1];
  }

  // 2. Extract URL match from surrounded text
  const urlMatch = text.match(/https?:\/\/[^\s"']+/i) || text.match(/(?:www\.)?(?:studocu|studeersnel)\.[a-z.]+\/[^\s"']+/i);
  if (urlMatch) {
    text = urlMatch[0];
  }

  // 3. Remove trailing punctuation commonly attached in text (. , ; ) > " ' etc.)
  text = text.replace(/[.,;!?>"')\]]+$/, '').trim();

  // 4. Ensure protocol
  if (!/^https?:\/\//i.test(text)) {
    text = 'https://' + text.replace(/^\/+/, '');
  }

  // 5. Validate hostname
  try {
    const parsed = new URL(text);
    const host = parsed.hostname.toLowerCase();
    const isStudocu = host === 'studocu.com' ||
      host.endsWith('.studocu.com') ||
      host === 'studocu.vn' ||
      host.endsWith('.studocu.vn') ||
      host === 'studeersnel.nl' ||
      host.endsWith('.studeersnel.nl');

    if (isStudocu) {
      return parsed.href;
    }
  } catch (_) {}

  return null;
}

export function verifyStudocuUrl(raw) {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { isValid: false, error: 'Vui lòng nhập hoặc dán liên kết Studocu' };
  }
  const clean = raw.trim();
  const extracted = extractStudocuUrl(clean);
  if (!extracted) {
    return {
      isValid: false,
      error: 'Liên kết không thuộc Studocu. Vui lòng dán liên kết từ studocu.com hoặc studocu.vn'
    };
  }

  try {
    const parsed = new URL(extracted);
    const pathname = parsed.pathname.toLowerCase();

    // 1. Kiểm tra link môn học / thư mục
    if (/\/(?:course|courses)\//i.test(pathname)) {
      return {
        isValid: false,
        error: 'Đây là liên kết môn học/thư mục (chứa danh sách nhiều tài liệu). Bạn hãy bấm vào 1 tài liệu cụ thể trong môn này để lấy link tải nhé!',
        url: extracted,
        type: 'course'
      };
    }

    // 2. Kiểm tra link trường / học viện
    if (/\/(?:institution|univ|school|university)\//i.test(pathname)) {
      return {
        isValid: false,
        error: 'Đây là liên kết trường học/học viện. Vui lòng bấm vào 1 tài liệu cụ thể để lấy link tải!',
        url: extracted,
        type: 'institution'
      };
    }

    // 3. Kiểm tra link tìm kiếm
    if (pathname.includes('/search') || parsed.searchParams.has('search')) {
      return {
        isValid: false,
        error: 'Đây là liên kết trang tìm kiếm. Vui lòng chọn và mở 1 tài liệu cụ thể để lấy link tải!',
        url: extracted,
        type: 'search'
      };
    }

    // 4. Kiểm tra link trang cá nhân
    if (/\/(?:user|profile)\//i.test(pathname)) {
      return {
        isValid: false,
        error: 'Đây là liên kết trang cá nhân. Vui lòng dán liên kết của tài liệu cụ thể!',
        url: extracted,
        type: 'user'
      };
    }

    // 5. Bắt buộc phải là trang tài liệu (chứa /document/ hoặc /doc/)
    if (!/\/(?:document|doc)\//i.test(pathname) && !/\/d\/\d+/i.test(pathname)) {
      return {
        isValid: false,
        error: 'Liên kết không phải là trang tài liệu Studocu. Link tài liệu chuẩn có dạng: studocu.com/vn/document/...',
        url: extracted,
        type: 'unknown_page'
      };
    }

    return { isValid: true, url: extracted };
  } catch (_) {
    return { isValid: false, error: 'Định dạng liên kết không hợp lệ' };
  }
}
