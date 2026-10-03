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
