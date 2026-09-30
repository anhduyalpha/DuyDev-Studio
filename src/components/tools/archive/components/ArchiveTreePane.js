/**
 * ArchiveTreePane Component
 * Dynamic Folder Tree Left Pane
 */

export function renderArchiveTreePane({ folders, currentFolder }) {
  return `
    <div id="archiveTreePaneContainer" class="lg:col-span-4 h-full flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-zinc-200/80 dark:border-white/[0.06] p-4 bg-zinc-50/70 dark:bg-[#0E0E11]">
      <div class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-2 pb-2 shrink-0">
        Cấu trúc thư mục
      </div>

      <div id="archiveTreeList" class="space-y-1 font-mono text-sm flex-1 overflow-y-auto custom-scrollbar pr-1">
        ${folders.map(folder => `
          <div data-folder-path="${folder.path}"
               class="btn-folder-select flex items-center gap-2 px-2.5 py-2 rounded-xl transition cursor-pointer select-none ${
                 folder.path === currentFolder
                   ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium border border-zinc-300 dark:border-white/[0.12]'
                   : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.03] hover:text-zinc-900 dark:hover:text-zinc-200'
               }"
               style="${folder.depth > 0 ? `margin-left: ${folder.depth * 10}px` : ''}">
            <i data-lucide="${folder.path === currentFolder ? 'folder-open' : 'folder'}" class="w-4 h-4 ${folder.path === currentFolder ? 'text-indigo-600 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}"></i>
            <span class="truncate">${folder.name}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `.trim();
}

export function updateActiveFolderTree(folderPath) {
  const treeList = document.getElementById('archiveTreeList');
  if (!treeList) return;
  treeList.querySelectorAll('.btn-folder-select').forEach((el) => {
    const isCurrent = el.getAttribute('data-folder-path') === folderPath;
    el.className = `btn-folder-select flex items-center gap-2 px-2.5 py-2 rounded-xl transition cursor-pointer select-none ${
      isCurrent
        ? 'bg-zinc-200 dark:bg-white/[0.08] text-zinc-900 dark:text-white font-medium border border-zinc-300 dark:border-white/[0.12]'
        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.03] hover:text-zinc-900 dark:hover:text-zinc-200'
    }`;
    const icon = el.querySelector('i');
    if (icon) {
      icon.className = `w-4 h-4 ${isCurrent ? 'text-indigo-600 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'}`;
    }
  });
}

