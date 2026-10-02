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

function renderToolsContent(toolsList, isAllDefault) {
  if (isAllDefault) {
    const featured = toolsList.filter(t => t.featured);
    const secondary = toolsList.filter(t => !t.featured);

    return `
      <div class="space-y-6">
        <!-- Spotlight Core Tools -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <h2 class="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Tâm điểm tác vụ</h2>
            </div>
            <span class="text-xs font-mono text-zinc-400">4 bộ công cụ chính</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            ${featured.map(t => renderToolCard(t, true)).join('')}
          </div>
        </div>

        <!-- Secondary Utility Tools -->
        <div class="space-y-3 pt-1">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Tiện ích & Công cụ hỗ trợ</h3>
            <span class="text-xs font-mono text-zinc-400">${secondary.length} công cụ</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            ${secondary.map(t => renderToolCard(t, false)).join('')}
          </div>
        </div>
      </div>
    `.trim();
  }

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
      ${toolsList.map(t => renderToolCard(t, t.featured)).join('')}
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
      
      <!-- Welcome Header & Quick Action Chips -->
      <div class="flex items-center justify-between pb-3 sm:pb-4 border-b border-zinc-200/80 dark:border-white/5">
        <div>
          <h1 class="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            Xin chào, Duy! <span class="text-base">👋</span>
          </h1>
        </div>

        <!-- Quick Jump Buttons (Desktop only to prevent mobile clutter) -->
        <div class="hidden sm:flex flex-wrap gap-2.5">
          <a href="#tool/pdf-studio" class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 hover:text-black border border-zinc-200 hover:border-amber-500/50 dark:bg-[#121215] dark:hover:bg-[#18181B] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-amber-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition shadow-xs">
            <span class="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
            <span>PDF Studio</span>
          </a>
          <a href="#tool/universal-converter" class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 hover:text-black border border-zinc-200 hover:border-indigo-500/50 dark:bg-[#121215] dark:hover:bg-[#18181B] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-indigo-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition shadow-xs">
            <span class="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></span>
            <span>File Converter</span>
          </a>
          <a href="#archive" class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 hover:text-black border border-zinc-200 hover:border-sky-500/50 dark:bg-[#121215] dark:hover:bg-[#18181B] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-sky-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition shadow-xs">
            <span class="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400"></span>
            <span>File nén</span>
          </a>
          <a href="#tool/qr-multi" class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 hover:text-black border border-zinc-200 hover:border-emerald-500/50 dark:bg-[#121215] dark:hover:bg-[#18181B] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-emerald-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition shadow-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
            <span>Mã QR</span>
          </a>
          <a href="#storage" class="px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 hover:text-black border border-zinc-200 hover:border-indigo-500/50 dark:bg-[#121215] dark:hover:bg-[#18181B] dark:text-zinc-300 dark:hover:text-white dark:border-white/[0.08] dark:hover:border-indigo-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition shadow-xs">
            <span class="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400"></span>
            <span>Tiện ích (Storage)</span>
          </a>
        </div>
      </div>


      <!-- Category Filter Pills Bar -->
      <div class="w-full min-w-0 overflow-hidden">
        ${renderCategoryFilters(currentCategory, counts)}
      </div>

      <!-- Tools Grid -->
      <div>
        <div class="flex items-center justify-between mb-3 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
          <span id="toolsCountLabel" class="font-bold text-zinc-900 dark:text-zinc-100 text-sm sm:text-base">
            ${isAllDefault ? `Tất cả công cụ (${tools.length})` : `Kết quả (${tools.length})`}
          </span>
        </div>

        <div id="toolsGridContainer">
          ${renderToolsContent(tools, isAllDefault)}
        </div>
      </div>

      <!-- Recent Executions Activity Feed -->
      <div id="recentActivityContainer">
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
      gridEl.innerHTML = renderToolsContent(filteredTools, isAll);
      if (window.lucide) window.lucide.createIcons({ root: gridEl });
    }
    if (countEl) {
      countEl.textContent = isAll ? `Tất cả công cụ (${filteredTools.length})` : `Kết quả (${filteredTools.length})`;
    }

    // 3. Update active pill styling across all tabs in place
    document.querySelectorAll('.filter-pill').forEach(btn => {
      const isThisActive = btn.getAttribute('data-category') === cat;
      const activeClasses = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md border-zinc-900 dark:border-white ring-1 ring-black/10 dark:ring-white/20';
      const inactiveClasses = 'bg-white dark:bg-[#16161a] text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white border border-zinc-200/90 dark:border-white/[0.12] hover:border-zinc-300 dark:hover:border-white/25 font-medium shadow-2xs';

      btn.className = `filter-pill flex items-center px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm border transition-all whitespace-nowrap active:scale-95 ${isThisActive ? activeClasses : inactiveClasses}`;
      
      const badge = btn.querySelector('.filter-count-badge');
      if (badge) {
        badge.className = `filter-count-badge ml-1.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-bold ${
          isThisActive 
            ? 'bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800' 
            : 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.08] dark:text-zinc-400'
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

  return () => {};
}
