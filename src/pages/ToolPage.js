/**
 * ToolPage Controller (Lazy Dynamic ES Module Architecture)
 * Dispatches to dedicated tool components on-demand using dynamic ES module loaders:
 * - PDF Tools: PdfConverter (PdfWorkspace.js)
 * - QR Studio: QrStudio (QrStudio.js)
 * - Hash & Checksum: HashStudio (HashStudio.js)
 * - Markdown & Docs: MarkdownEditor (MarkdownEditor.js)
 * - Archive Inspector: ArchivePage (ArchivePage.js)
 * - Server Archive: ArchiveCompressWorkspace (ArchiveCompressWorkspace.js)
 * - Universal Converter: ConverterWorkspace (ConverterWorkspace.js)
 * - Studocu Downloader: StudocuWorkspace (StudocuWorkspace.js) [Quarantined]
 * - Scribd Archiver: ScribdWorkspace (ScribdWorkspace.js)
 * - Storage Inspector: StoragePage (StoragePage.js)
 * - Quiz Generator: QuizWorkspace (QuizWorkspace.js)
 * - View Split: ViewSplitWorkspace (ViewSplitWorkspace.js)
 * - Social & Media Downloaders: TikTok, YouTube, Facebook, Instagram, Spotify, SlideShare, Academia, ResearchGate
 */

import { toolRegistry } from '../hooks/useToolRegistry.js';

let currentActiveToolId = 'pdf-studio';
let currentActiveModule = null;
let latestRenderToken = 0;
const MODULE_CACHE = new Map();

/**
 * Registry of dynamic loaders returning { render, attach }
 */
const TOOL_LOADERS = {
  'qr-multi': async () => {
    const m = await import('../components/tools/qr/QrStudio.js');
    return {
      render: (subTab) => m.renderQrStudio(subTab),
      attach: (onReRender) => m.attachQrStudioListeners(onReRender)
    };
  },

  'qr-scan': async () => {
    const m = await import('../components/tools/qr/QrStudio.js');
    return {
      render: () => m.renderQrScanner(),
      attach: (onReRender) => m.attachQrScannerListeners(onReRender)
    };
  },

  'hash-checksum': async () => {
    const m = await import('../components/tools/hash/HashStudio.js');
    return {
      render: () => m.renderHashStudio(),
      attach: (onReRender) => m.attachHashStudioListeners(onReRender)
    };
  },

  'markdown-docs': async () => {
    const m = await import('../components/tools/MarkdownEditor.js');
    return {
      render: () => m.renderMarkdownEditor(),
      attach: (onReRender) => m.attachMarkdownEditorListeners(onReRender)
    };
  },

  'archive-inspect': async () => {
    const m = await import('./ArchivePage.js');
    return {
      render: () => m.renderArchivePage(),
      attach: (onReRender) => m.attachArchivePageListeners(onReRender)
    };
  },

  'server-archive': async () => {
    const m = await import('../components/tools/archive/ArchiveCompressWorkspace.js');
    return {
      render: () => m.renderArchiveCompressWorkspace(),
      attach: (onReRender) => m.attachArchiveCompressListeners(onReRender)
    };
  },

  'universal-converter': async () => {
    const [ws, { converterManager }] = await Promise.all([
      import('../components/tools/converter/ConverterWorkspace.js'),
      import('../components/tools/converter/hooks/useConverter.js')
    ]);
    return {
      render: () => ws.renderConverterWorkspace(converterManager),
      attach: () => ws.attachConverterListeners(converterManager)
    };
  },

  'studocu-dl': async () => {
    const m = await import('../components/tools/studocu/StudocuWorkspace.js');
    return {
      render: () => m.renderStudocuWorkspace(),
      attach: () => m.attachStudocuListeners()
    };
  },

  'scribd': async () => {
    const m = await import('../components/tools/scribd/ScribdWorkspace.js');
    return {
      render: () => m.renderScribdWorkspace(),
      attach: () => m.attachScribdListeners()
    };
  },

  'storage': async () => {
    const m = await import('./StoragePage.js');
    return {
      render: () => m.renderStoragePage(),
      attach: (onReRender) => m.attachStoragePageListeners(onReRender)
    };
  },

  'quiz': async () => {
    const m = await import('../components/tools/quiz/QuizWorkspace.js');
    return {
      render: () => m.renderQuizWorkspace(),
      attach: (onReRender) => m.attachQuizListeners(onReRender)
    };
  },

  'view-split': async () => {
    const m = await import('../components/tools/viewsplit/ViewSplitWorkspace.js');
    return {
      render: () => m.renderViewSplitWorkspace(),
      attach: (onReRender) => m.attachViewSplitWorkspaceListeners(onReRender)
    };
  },

  'tiktok': async () => {
    const m = await import('../components/tools/tiktok/TiktokWorkspace.js');
    return {
      render: () => m.renderTiktokWorkspace(),
      attach: (onReRender) => m.attachTiktokWorkspaceListeners(onReRender)
    };
  },

  'youtube': async () => {
    const m = await import('../components/tools/youtube/YoutubeWorkspace.js');
    return {
      render: () => m.renderYoutubeWorkspace(),
      attach: (onReRender) => m.attachYoutubeWorkspaceListeners(onReRender)
    };
  },

  'facebook': async () => {
    const m = await import('../components/tools/facebook/FacebookWorkspace.js');
    return {
      render: () => m.renderFacebookWorkspace(),
      attach: (onReRender) => m.attachFacebookWorkspaceListeners(onReRender)
    };
  },

  'instagram': async () => {
    const m = await import('../components/tools/instagram/InstagramWorkspace.js');
    return {
      render: () => m.renderInstagramWorkspace(),
      attach: (onReRender) => m.attachInstagramWorkspaceListeners(onReRender)
    };
  },

  'spotify': async () => {
    const m = await import('../components/tools/spotify/SpotifyWorkspace.js');
    return {
      render: () => m.renderSpotifyWorkspace(),
      attach: (onReRender) => m.attachSpotifyWorkspaceListeners(onReRender)
    };
  },

  'slideshare': async () => {
    const m = await import('../components/tools/slideshare/SlideshareWorkspace.js');
    return {
      render: () => m.renderSlideshareWorkspace(),
      attach: (onReRender) => m.attachSlideshareWorkspaceListeners(onReRender)
    };
  },

  'academia': async () => {
    const m = await import('../components/tools/academia/AcademiaWorkspace.js');
    return {
      render: () => m.renderAcademiaWorkspace(),
      attach: (onReRender) => m.attachAcademiaWorkspaceListeners(onReRender)
    };
  },

  'researchgate': async () => {
    const m = await import('../components/tools/researchgate/ResearchgateWorkspace.js');
    return {
      render: () => m.renderResearchgateWorkspace(),
      attach: (onReRender) => m.attachResearchgateWorkspaceListeners(onReRender)
    };
  },

  'pdf-studio': async () => {
    const [ws, { pdfQueueManager }] = await Promise.all([
      import('../components/tools/pdf/PdfWorkspace.js'),
      import('../components/tools/pdf/hooks/usePdfQueue.js')
    ]);
    const modeMap = {
      'pdf-merge': 'merge',
      'pdf-lock': 'security',
      'pdf-convert': 'compress',
      'lock': 'security',
      'img2pdf': 'images_to_pdf',
      'images': 'images_to_pdf',
      'extract': 'extract_images'
    };
    return {
      render: (subTab, toolId) => {
        const targetMode = modeMap[subTab] || modeMap[toolId] || subTab;
        if (targetMode) pdfQueueManager.setMode(targetMode, true);
        return ws.renderPdfConverter(pdfQueueManager.getState());
      },
      attach: () => ws.attachPdfConverterListeners(pdfQueueManager)
    };
  }
};

/**
 * Canonical tool ID aliases
 */
const TOOL_ALIASES = {
  'universal-converter': 'universal-converter',
  'image-converter': 'universal-converter',
  'video-audio': 'universal-converter',
  'scribd-archiver': 'scribd',
  'scribd': 'scribd',
  'quiz-generator': 'quiz',
  'quiz': 'quiz',
  'view-split': 'view-split',
  'viewsplit': 'view-split',
  'tiktok-downloader': 'tiktok',
  'tiktok': 'tiktok',
  'youtube-downloader': 'youtube',
  'youtube': 'youtube',
  'facebook-downloader': 'facebook',
  'facebook': 'facebook',
  'instagram-downloader': 'instagram',
  'instagram': 'instagram',
  'spotify-downloader': 'spotify',
  'spotify': 'spotify',
  'slideshare-downloader': 'slideshare',
  'slideshare': 'slideshare',
  'academia-downloader': 'academia',
  'academia': 'academia',
  'researchgate-downloader': 'researchgate',
  'researchgate': 'researchgate',
  'pdf-studio': 'pdf-studio',
  'pdf-merge': 'pdf-studio',
  'pdf-lock': 'pdf-studio',
  'pdf-convert': 'pdf-studio',
  'pdf-split': 'pdf-studio'
};

/**
 * Loads a tool module dynamically with caching
 */
async function loadToolModule(canonicalId) {
  if (MODULE_CACHE.has(canonicalId)) {
    return MODULE_CACHE.get(canonicalId);
  }
  const loader = TOOL_LOADERS[canonicalId];
  if (!loader) {
    throw new Error(`Công cụ không tồn tại: ${canonicalId}`);
  }
  const promise = loader();
  MODULE_CACHE.set(canonicalId, promise);
  try {
    const mod = await promise;
    return mod;
  } catch (err) {
    MODULE_CACHE.delete(canonicalId);
    throw err;
  }
}

/**
 * Synchronous loading skeleton for instant feedback during dynamic import
 */
export function renderToolLoadingSkeleton(tool = null) {
  const toolName = tool?.name || 'Đang tải công cụ...';
  const toolDesc = tool?.description || 'Vui lòng chờ trong giây lát trong khi công cụ được khởi tạo.';

  return `
    <div id="toolLoadingSkeleton" class="space-y-6 pb-24 animate-pulse" aria-busy="true" aria-live="polite">
      <!-- Skeleton Breadcrumb -->
      <div class="flex items-center gap-2 text-sm text-zinc-400 dark:text-zinc-500">
        <a href="#dashboard" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] transition text-xs font-medium">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Dashboard
        </a>
        <span class="text-zinc-300 dark:text-zinc-700">/</span>
        <div class="h-4 w-28 bg-zinc-200 dark:bg-white/10 rounded-md"></div>
      </div>

      <!-- Skeleton Header -->
      <div class="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] shadow-sm space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-white/10 flex items-center justify-center">
            <i data-lucide="loader-2" class="w-5 h-5 text-zinc-400 dark:text-zinc-500 animate-spin"></i>
          </div>
          <div class="space-y-1.5">
            <h1 class="text-base sm:text-lg font-semibold text-zinc-900 dark:text-white tracking-tight">${toolName}</h1>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">${toolDesc}</p>
          </div>
        </div>
      </div>

      <!-- Skeleton Content Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 space-y-4">
          <div class="h-64 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col items-center justify-center gap-3 p-6">
            <div class="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-white/10"></div>
            <div class="h-4 w-48 bg-zinc-200 dark:bg-white/10 rounded-md"></div>
            <div class="h-3 w-32 bg-zinc-100 dark:bg-white/5 rounded-md"></div>
          </div>
        </div>
        <div class="space-y-4">
          <div class="h-48 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] p-5 space-y-3">
            <div class="h-4 w-24 bg-zinc-200 dark:bg-white/10 rounded-md"></div>
            <div class="h-9 w-full bg-zinc-100 dark:bg-white/5 rounded-xl"></div>
            <div class="h-9 w-full bg-zinc-100 dark:bg-white/5 rounded-xl"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escapes unsafe characters to prevent DOM-XSS
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Fallback error view when dynamic import fails
 */
function renderToolErrorFallback(toolId, error) {
  const safeToolId = escapeHtml(toolId);
  const safeMessage = escapeHtml(error?.message || 'Không thể tải mô-đun công cụ');

  return `
    <div id="toolErrorFallback" class="max-w-xl mx-auto my-12 p-6 sm:p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/40 shadow-sm text-center space-y-4">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-center text-rose-500">
        <i data-lucide="alert-triangle" class="w-7 h-7"></i>
      </div>
      <div class="space-y-1.5">
        <h2 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">Không thể tải công cụ</h2>
        <p class="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
          Đã xảy ra lỗi khi tải mô-đun cho <span class="font-mono text-zinc-700 dark:text-zinc-300 font-semibold">${safeToolId}</span>.
        </p>
        <p class="text-xs text-rose-600 dark:text-rose-400 font-mono bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-200/60 dark:border-rose-900/30 break-all">
          ${safeMessage}
        </p>
      </div>
      <div class="flex items-center justify-center gap-3 pt-2">
        <a href="#dashboard" class="px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white text-xs font-semibold transition cursor-pointer">
          Về Dashboard
        </a>
        <button onclick="window.location.reload()" class="px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer">
          Tải lại trang
        </button>
      </div>
    </div>
  `;
}

/**
 * Asynchronously renders the requested tool page by dynamically loading its workspace
 */
export async function renderToolPage(toolId = 'pdf-convert', subTab = null) {
  const myToken = ++latestRenderToken;
  currentActiveToolId = toolId;
  const canonicalId = TOOL_ALIASES[toolId] || toolId;
  const loader = TOOL_LOADERS[canonicalId] || TOOL_LOADERS[toolId];

  if (!loader) {
    if (myToken === latestRenderToken && currentActiveToolId === toolId) {
      currentActiveModule = null;
    }
    return renderToolErrorFallback(toolId, new Error(`Không tìm thấy công cụ "${toolId}".`));
  }

  try {
    const mod = await loadToolModule(canonicalId);
    if (myToken === latestRenderToken && currentActiveToolId === toolId) {
      currentActiveModule = mod;
    }
    return mod.render(subTab, toolId);
  } catch (err) {
    if (myToken === latestRenderToken && currentActiveToolId === toolId) {
      currentActiveModule = null;
    }
    console.error(`[ToolPage] Error loading tool module "${toolId}":`, err);
    return renderToolErrorFallback(toolId, err);
  }
}

/**
 * Attaches event listeners for the currently active tool module
 */
export function attachToolPageListeners(onReRender) {
  if (currentActiveModule && typeof currentActiveModule.attach === 'function') {
    try {
      return currentActiveModule.attach(onReRender);
    } catch (err) {
      console.warn(`[ToolPage] Error attaching listeners for "${currentActiveToolId}":`, err);
    }
  }
  return null;
}
