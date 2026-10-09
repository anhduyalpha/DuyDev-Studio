/**
 * DashboardPage View Controller (Dark Professional Minimalism)
 */

import { renderCategoryFilters, attachCategoryFilterListeners } from '../components/dashboard/CategoryFilters.js';
import { renderToolCard } from '../components/dashboard/ToolCard.js';
import { renderRecentActivity } from '../components/dashboard/RecentActivity.js';
import { toolRegistry } from '../hooks/useToolRegistry.js';
import { storage } from '../utilities/storage.js';
import { ViewerConnector } from '../components/common/viewer/FileViewerConnector.js';
import { showToast } from '../utilities/toast.js';
import { copyText, copyQrImageOrFallback } from '../utilities/clipboard.js';
import { pdfQueueManager } from '../components/tools/pdf/hooks/usePdfQueue.js';
import { converterManager } from '../components/tools/converter/hooks/useConverter.js';
import { updateHeaderTrashIndicator } from '../components/layout/Header.js';

function renderToolsContent(toolsList) {
  if (!toolsList || toolsList.length === 0) {
    return `
      <div class="py-12 text-center rounded-2xl glass-panel-contained text-zinc-500 dark:text-zinc-400 font-mono text-xs space-y-3">
        <p>Không tìm thấy công cụ nào phù hợp.</p>
        <button type="button" id="btnResetSearch" class="px-3.5 py-1.5 rounded-xl glass-pill text-zinc-700 dark:text-zinc-300 font-sans text-xs font-medium transition cursor-pointer inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <span>Xóa bộ lọc tìm kiếm</span>
          <kbd class="px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-white/[0.08] text-[10px] font-mono font-semibold text-zinc-600 dark:text-zinc-300 border border-zinc-300/80 dark:border-white/10">Esc</kbd>
        </button>
      </div>
    `.trim();
  }

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
      ${toolsList.map(t => renderToolCard(t)).join('')}
    </div>
  `.trim();
}

export function renderDashboardPage() {
  const tools = toolRegistry.getFilteredTools();
  const currentCategory = toolRegistry.currentCategory;
  const isAllDefault = currentCategory === 'all' && !toolRegistry.searchQuery;
  const counts = {
    all: toolRegistry.tools.length,
    pdf: toolRegistry.tools.filter(t => t.category === 'pdf').length,
    convert: toolRegistry.tools.filter(t => t.category === 'convert').length,
    archive: toolRegistry.tools.filter(t => t.category === 'archive').length,
    qr: toolRegistry.tools.filter(t => t.category === 'qr').length,
    system: toolRegistry.tools.filter(t => t.category === 'system').length
  };

  return `
    <div class="space-y-6 sm:space-y-8 animate-fadeIn">
      
      <!-- Category Filter Pills Bar -->
      <div class="w-full min-w-0 overflow-hidden">
        ${renderCategoryFilters(currentCategory, counts)}
      </div>

      <!-- Tools Grid -->
      <div>
        <div class="flex items-center justify-between mb-3.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          <span id="toolsCountLabel" class="font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base font-mono tracking-tight">
            ${isAllDefault ? `Tất cả công cụ (${tools.length})` : `Kết quả (${tools.length})`}
          </span>
        </div>

        <div id="toolsGridContainer">
          ${renderToolsContent(tools)}
        </div>
      </div>

      <!-- Recent Executions Activity Feed (Apple Sequoia Pure Frost Glass - Located at bottom) -->
      <div id="recentActivityContainer" class="empty:hidden pt-2 sm:pt-4">
        ${renderRecentActivity()}
      </div>

    </div>
  `;
}

export function attachDashboardListeners(onReRender) {
  // Sync latest history & trash from server
  storage.fetchTrash().then(() => updateHeaderTrashIndicator()).catch(() => {});
  storage.fetchHistory().then((items) => {
    if (items && items.length > 0) {
      const container = document.getElementById('recentActivityContainer');
      if (container) {
        container.innerHTML = renderRecentActivity();
        if (window.lucide) window.lucide.createIcons({ root: container });
      }
    }
  }).catch(() => {});


  // Handle clear search filter click
  const toolsGridContainer = document.getElementById('toolsGridContainer');
  if (toolsGridContainer) {
    toolsGridContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('#btnResetSearch');
      if (btn) {
        toolRegistry.setSearchQuery('');
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) searchInput.value = '';
        if (onReRender) onReRender();
      }
    });
  }

  attachCategoryFilterListeners((cat, clickedBtn) => {
    toolRegistry.setCategory(cat);

    // 1. Smooth scroll clicked tab into center view (no snapping back to 0!)
    if (clickedBtn) {
      clickedBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // 2. Perform in-place update of tools grid without re-rendering the category tabs
    const filteredTools = toolRegistry.getFilteredTools();
    const gridEl = document.getElementById('toolsGridContainer');
    const countEl = document.getElementById('toolsCountLabel');
    const isAll = cat === 'all' && !toolRegistry.searchQuery;

    if (gridEl) {
      gridEl.innerHTML = renderToolsContent(filteredTools);
      if (window.lucide) window.lucide.createIcons({ root: gridEl });
    }
    if (countEl) {
      countEl.textContent = isAll ? `Tất cả công cụ (${filteredTools.length})` : `Kết quả (${filteredTools.length})`;
    }

    // 3. Update active pill styling across all tabs in place
    document.querySelectorAll('.filter-pill').forEach(btn => {
      const isThisActive = btn.getAttribute('data-category') === cat;
      const activeClasses = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md border-zinc-900 dark:border-white ring-1 ring-black/10 dark:ring-white/20';
      const inactiveClasses = 'glass-pill text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white font-medium';

      btn.className = `filter-pill flex items-center px-3.5 sm:px-4 py-2 min-h-[40px] sm:min-h-[38px] rounded-xl text-xs sm:text-sm border transition-all whitespace-nowrap active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/80 dark:focus-visible:ring-indigo-400 ${isThisActive ? activeClasses : inactiveClasses}`;
      btn.setAttribute('aria-selected', String(isThisActive));
      btn.setAttribute('aria-pressed', String(isThisActive));
      
      const badge = btn.querySelector('.filter-count-badge');
      if (badge) {
        badge.className = `filter-count-badge ml-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${
          isThisActive 
            ? 'bg-zinc-800 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900' 
            : 'bg-zinc-100/90 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-300 border border-zinc-200/50 dark:border-white/[0.06]'
        }`;
      }
    });
  });

  const recentContainer = document.getElementById('recentActivityContainer');
  if (recentContainer) {
    recentContainer.addEventListener('click', async (e) => {
      // 1. Move to Trash (Optimistic removal)
      const trashBtn = e.target.closest('.btn-trash-recent');
      if (trashBtn) {
        e.preventDefault();
        e.stopPropagation();
        if (trashBtn.dataset.deleting === 'true') return;
        trashBtn.dataset.deleting = 'true';
        const id = trashBtn.dataset.trashRecent;
        if (!id) return;

        const card = trashBtn.closest('[data-recent-card-id]');
        if (card) {
          card.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
          setTimeout(() => {
            card.remove();
            const grid = document.getElementById('recentActivityCardsGrid');
            if (grid && grid.children.length === 0) {
              recentContainer.innerHTML = '';
            }
          }, 200);
        }

        await storage.moveToTrash(id);
        updateHeaderTrashIndicator();
        showToast('Đã chuyển mục vào thùng rác', 'info');
        return;
      }

      // 2. Open in Corresponding Tool Workspace
      const openBtn = e.target.closest('.btn-open-in-tool');
      if (openBtn) {
        const itemId = openBtn.dataset.openInTool;
        const toolId = openBtn.dataset.toolId;
        const all = storage.getLocalHistory();
        const item = all.find((x) => x.id === itemId);
        if (!item) return;

        const tool = toolRegistry.getToolById(toolId || item.toolId);
        const route = tool?.route || '#';

        if (tool.id === 'pdf-studio') {
          window.location.hash = '#tool/pdf-studio';
          pdfQueueManager.addFileFromHistory(item).then((ok) => {
            if (ok) showToast(`Đã nạp ${item.fileName} vào PDF Studio`, 'success');
          });
          return;
        }

        if (tool.id === 'universal-converter') {
          window.location.hash = '#tool/universal-converter';
          const url = item.downloadUrl || (item.resultFileId ? `/api/v1/files/download/${item.resultFileId}` : null);
          if (url) {
            fetch(url)
              .then((r) => r.blob())
              .then((blob) => {
                const file = new File([blob], item.fileName || 'converted-file', { type: blob.type || 'application/octet-stream' });
                converterManager.addFiles([file]);
                showToast(`Đã nạp ${item.fileName} vào File Converter`, 'success');
              })
              .catch(() => {});
          }
          return;
        }

        window.location.hash = route;
        return;
      }

      // 3. Copy Link or Text
      const copyBtn = e.target.closest('.btn-copy-recent');
      if (copyBtn) {
        const id = copyBtn.dataset.copyId;
        const all = storage.getLocalHistory();
        const item = all.find((x) => x.id === id);
        if (!item) return;

        if (item.downloadUrl && item.downloadUrl.startsWith('data:image')) {
          const res = await copyQrImageOrFallback({ dataUrl: item.downloadUrl, text: item.fileName });
          showToast(res.success ? (res.mode === 'image' ? 'Đã sao chép ảnh QR' : 'Đã sao chép') : 'Lỗi sao chép', res.success ? 'success' : 'error');
        } else {
          const text = item.downloadUrl || item.fileName || '';
          const ok = await copyText(text);
          showToast(ok ? 'Đã sao chép liên kết' : 'Lỗi sao chép', ok ? 'success' : 'error');
        }
        return;
      }

      // 4. Preview Modal
      const prevBtn = e.target.closest('.btn-preview-recent');
      if (prevBtn) {
        const url = prevBtn.dataset.previewUrl;
        const name = prevBtn.dataset.fileName;
        const size = Number(prevBtn.dataset.fileSize || 0);
        if (url) ViewerConnector.preview({ fileName: name, downloadUrl: url, resultSize: size });
      }
    });
  }

  // Keyboard shortcut: Escape clears active search query
  const handleEscapeKey = (e) => {
    if (e.key === 'Escape' && toolRegistry.searchQuery) {
      toolRegistry.setSearchQuery('');
      const searchInput = document.getElementById('globalSearchInput');
      if (searchInput) searchInput.value = '';
      if (onReRender) onReRender();
    }
  };
  window.addEventListener('keydown', handleEscapeKey);

  return () => {
    window.removeEventListener('keydown', handleEscapeKey);
  };
}
