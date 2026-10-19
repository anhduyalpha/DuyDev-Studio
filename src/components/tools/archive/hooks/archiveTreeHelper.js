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
  const normFolder = !folderPath || folderPath === '/' ? '/' : (folderPath.endsWith('/') ? folderPath : folderPath + '/');
  return (entries || [])
    .filter((e) => !e.isDirectory)
    .filter((e) => {
      const norm = (e.path.startsWith('/') ? e.path : '/' + e.path).replace(/\\/g, '/');
      const lastSlash = norm.lastIndexOf('/');
      const entryDir = lastSlash <= 0 ? '/' : norm.substring(0, lastSlash + 1);
      return entryDir === normFolder;
    })
    .map((e) => ({ ...e, rawPath: e.path.replace(/^\/+/, '') }));
}

/**
 * Extracts immediate subfolders directly inside folderPath
 */
export function getSubfoldersInFolder(entries, folderPath) {
  const normFolder = !folderPath || folderPath === '/' ? '/' : (folderPath.endsWith('/') ? folderPath : folderPath + '/');
  const subfolderMap = new Map();

  (entries || []).forEach((e) => {
    const norm = (e.path.startsWith('/') ? e.path : '/' + e.path).replace(/\\/g, '/');
    if (!norm.startsWith(normFolder) || norm === normFolder) return;

    const remainder = norm.slice(normFolder.length);
    const parts = remainder.split('/').filter(Boolean);
    if (parts.length > 0) {
      const subName = parts[0];
      const subPath = normFolder === '/' ? `/${subName}/` : `${normFolder}${subName}/`;

      if (!subfolderMap.has(subPath)) {
        subfolderMap.set(subPath, {
          path: subPath,
          name: subName,
          fileCount: 0,
          totalBytes: 0,
          isDirectory: true
        });
      }

      if (!e.isDirectory) {
        const item = subfolderMap.get(subPath);
        item.fileCount++;
        item.totalBytes += (Number(e.sizeBytes) || 0);
      }
    }
  });

  return Array.from(subfolderMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

/**
 * Returns all files across all folders in archive (flattened)
 */
export function getAllFilesInArchive(entries) {
  return (entries || [])
    .filter((e) => !e.isDirectory)
    .map((e) => {
      const rawPath = e.path.replace(/^\/+/, '');
      const lastSlash = rawPath.lastIndexOf('/');
      const dirPath = lastSlash !== -1 ? rawPath.slice(0, lastSlash) : '';
      return {
        ...e,
        rawPath,
        dirPath
      };
    });
}

