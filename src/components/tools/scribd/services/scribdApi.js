/**
 * Scribd API Operations & Persistence Helper
 * Manages remote Scribd API calls, Studio Drive saving, and active job persistence.
 */

const ACTIVE_JOB_KEY = 'ds_scribd_active_job';

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
      fetch('/api/v1/scribd/files').then(r => r.ok ? r.json() : []),
      fetch('/api/v1/scribd/trash').then(r => r.ok ? r.json() : [])
    ]);
    return {
      files: filesRes.status === 'fulfilled' && Array.isArray(filesRes.value) ? filesRes.value : [],
      trash: trashRes.status === 'fulfilled' && Array.isArray(trashRes.value) ? trashRes.value : []
    };
  } catch (_) {
    return { files: [], trash: [] };
  }
}

export async function startDownloadApi(url, forceReload = false) {
  return safeFetchJson('/api/v1/scribd/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, force_reload: forceReload })
  });
}

export async function cancelJobApi(jobId) {
  if (!jobId) return false;
  const res = await fetch(`/api/v1/scribd/cancel/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).catch(() => null);
  return res?.ok;
}

export async function moveToTrashApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/scribd/files/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function restoreFromTrashApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/scribd/trash/restore/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function deletePermanentApi(filename) {
  if (!filename) return false;
  const res = await fetch(`/api/v1/scribd/trash/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).catch(() => null);
  return res?.ok;
}

export async function emptyTrashApi() {
  const res = await fetch('/api/v1/scribd/trash/empty', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: 'empty' })
  }).catch(() => null);
  return res?.ok;
}

export async function saveToDriveApi(filename, title = '', targetDir = 'scribd') {
  return safeFetchJson('/api/v1/scribd/save-drive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, title, targetDir })
  });
}
