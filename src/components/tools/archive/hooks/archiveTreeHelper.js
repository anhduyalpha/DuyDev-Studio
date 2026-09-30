/**
 * Archive Tree & Folder Path Extraction Helpers (< 60 lines)
 */

export function extractFolders(entries) {
  const folderSet = new Set(['/']);
  entries.forEach((e) => {
    const norm = (e.path.startsWith('/') ? e.path : '/' + e.path).replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    if (!e.isDirectory) parts.pop();
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      folderSet.add(current + '/');
    }
  });

  const sorted = Array.from(folderSet).sort((a, b) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });

  return sorted.map((folderPath) => {
    if (folderPath === '/') return { path: '/', name: 'Thư mục gốc', depth: 0 };
    const clean = folderPath.replace(/^\/+|\/+$/g, '');
    const parts = clean.split('/');
    return { path: folderPath, name: parts[parts.length - 1], depth: parts.length };
  });
}

export function getFilesInFolder(entries, folderPath) {
  return entries
    .filter((e) => !e.isDirectory)
    .filter((e) => {
      const norm = (e.path.startsWith('/') ? e.path : '/' + e.path).replace(/\\/g, '/');
      const lastSlash = norm.lastIndexOf('/');
      const entryDir = lastSlash <= 0 ? '/' : norm.substring(0, lastSlash + 1);
      return entryDir === folderPath;
    })
    .map((e) => ({ ...e, rawPath: e.path.replace(/^\/+/, '') }));
}
