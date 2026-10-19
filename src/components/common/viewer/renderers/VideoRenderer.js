/**
 * VideoRenderer Component
 * High-performance video player with PiP, vertical swipe navigation, and TikTok caption overlays
 */

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderVideoViewer(state) {
  const metadata = state.metadata || {};
  const authorName = metadata.authorNickname || (metadata.author ? '@' + metadata.author.replace(/^@/, '') : '');
  const authorHandle = metadata.author ? '@' + metadata.author.replace(/^@/, '') : '';
  const caption = metadata.title || '';
  const originalUrl = metadata.originalUrl || '';
  const hasMetadata = Boolean(authorName || caption || originalUrl);

  const playlist = Array.isArray(state.playlist) ? state.playlist : null;
  const hasPlaylist = Boolean(playlist && playlist.length > 1);
  const currentIndex = typeof state.playlistIndex === 'number' ? state.playlistIndex : 0;
  const totalCount = playlist ? playlist.length : 1;

  return `
    <div id="videoViewerContainer" class="relative w-full flex items-center justify-center bg-black rounded-xl sm:rounded-2xl overflow-hidden min-h-[340px] sm:min-h-[480px] max-h-[82vh] select-none">
      <!-- Native HTML5 Video Element -->
      <video 
        id="corePreviewVideo" 
        controls 
        autoplay 
        playsinline 
        loop
        class="max-h-[80vh] max-w-full rounded-lg shadow-2xl object-contain z-10" 
        src="${state.viewUrl}"
      >
        Không hỗ trợ phát video này.
      </video>

      <!-- TikTok-Style Bottom-Left Caption Overlay (Collapsible) -->
      ${hasMetadata ? `
        <div id="tiktokCaptionOverlay" class="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-20 max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-xl transition-all duration-200 pointer-events-auto">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-xs">
              <i data-lucide="video" class="w-3.5 h-3.5"></i>
            </span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-white truncate">${escapeHtml(authorName || 'TikTok Video')}</p>
              ${authorHandle ? `<p class="text-[10px] text-zinc-300 font-mono truncate">${escapeHtml(authorHandle)}</p>` : ''}
            </div>
          </div>
          ${caption ? `
            <p id="tiktokCaptionText" class="text-xs text-zinc-200 leading-relaxed line-clamp-2 hover:line-clamp-none transition-all cursor-pointer select-text" title="Nhấn để xem toàn bộ caption">
              ${escapeHtml(caption)}
            </p>
          ` : ''}
          ${originalUrl ? `
            <a 
              href="${escapeHtml(originalUrl)}" 
              target="_blank" 
              rel="noopener noreferrer" 
              class="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] font-medium text-zinc-200 hover:text-white transition cursor-pointer"
            >
              <i data-lucide="external-link" class="w-3 h-3"></i>
              <span>Mở link TikTok</span>
            </a>
          ` : ''}
        </div>
      ` : ''}

      <!-- Floating Vertical Next/Prev Chevron Navigation (Right Side) -->
      ${hasPlaylist ? `
        <div class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 sm:gap-2 bg-black/65 backdrop-blur-md rounded-2xl p-1.5 border border-white/10 shadow-xl pointer-events-auto">
          <button
            id="btnPrevViewerVideo"
            type="button"
            class="p-2 sm:p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
            title="Video trước (Phím ↑ hoặc Vuốt xuống)"
          >
            <i data-lucide="chevron-up" class="w-5 h-5"></i>
          </button>

          <span class="text-[11px] font-mono font-bold text-white/90 px-1 select-none">
            ${currentIndex + 1}/${totalCount}
          </span>

          <button
            id="btnNextViewerVideo"
            type="button"
            class="p-2 sm:p-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/15 active:scale-90 transition cursor-pointer"
            title="Video tiếp theo (Phím ↓ hoặc Vuốt lên)"
          >
            <i data-lucide="chevron-down" class="w-5 h-5"></i>
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

export function attachVideoListeners(state, registerCleanup) {
  const video = document.getElementById('corePreviewVideo');
  if (!video) return;

  registerCleanup(() => {
    try {
      video.pause();
      video.currentTime = 0;
      video.removeAttribute('src');
      video.load();
    } catch {}
  });

  let hasRetried = false;
  // Resilient blob recovery fallback if direct range stream fails
  video.addEventListener('error', async () => {
    const errCode = video.error?.code;
    let errorMsg = 'Không thể phát trực tiếp định dạng video này trên trình duyệt.';
    if (errCode === 4) {
      errorMsg = 'Trình duyệt không hỗ trợ giải mã định dạng hoặc codec video này (ví dụ: HEVC/H.265, AC3, AVI, FLV).';
    } else if (errCode === 3) {
      errorMsg = 'Dữ liệu video bị hỏng cấu trúc hoặc lỗi giải mã luồng phát.';
    } else if (errCode === 2) {
      errorMsg = 'Lỗi kết nối mạng khi tải luồng phát video.';
    }

    const isTooLargeForBlob = Boolean(state.size && Number(state.size) > 35 * 1024 * 1024);

    if (hasRetried || isTooLargeForBlob) {
      if (state.showErrorFallback) {
        state.showErrorFallback(errorMsg, `MediaError code: ${errCode || 'unknown'}`);
        return;
      }
      const container = document.getElementById('videoViewerContainer');
      if (container && !document.getElementById('videoErrorNotice')) {
        const notice = document.createElement('div');
        notice.id = 'videoErrorNotice';
        notice.className = 'absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-black/85 text-center text-white space-y-3';
        notice.innerHTML = `
          <div class="w-12 h-12 rounded-2xl bg-white/10 text-rose-400 flex items-center justify-center">
            <i data-lucide="alert-triangle" class="w-6 h-6"></i>
          </div>
          <p class="text-xs text-zinc-300 max-w-sm">${errorMsg}</p>
          <div class="flex items-center gap-2 pt-1">
            <a href="${state.downloadUrl || state.viewUrl}" download="${state.name}" class="px-3.5 py-1.5 rounded-xl bg-white text-zinc-900 text-xs font-semibold inline-flex items-center gap-1.5 shadow-md">
              <i data-lucide="download" class="w-3.5 h-3.5"></i> Tải về video
            </a>
          </div>
        `;
        container.appendChild(notice);
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: notice });
      }
      return;
    }
    hasRetried = true;
    try {
      const res = await fetch(state.viewUrl, { signal: state.abortSignal });
      if (res.ok) {
        const blob = await res.blob();
        if (state.isCurrentSession && !state.isCurrentSession()) return;
        const blobUrl = URL.createObjectURL(blob);
        registerCleanup(() => URL.revokeObjectURL(blobUrl));
        video.src = blobUrl;
        video.play().catch(() => {});
      } else {
        const statusText = res.status === 404
          ? 'Tệp video không tồn tại trên máy chủ hoặc liên kết đã hết hạn (HTTP 404).'
          : (res.status === 403 || res.status === 401
              ? `Không có quyền truy cập tệp hoặc phiên làm việc đã hết hạn (HTTP ${res.status}).`
              : `Máy chủ phản hồi lỗi khi nạp video (HTTP ${res.status}).`);
        if (state.showErrorFallback) {
          state.showErrorFallback(statusText, `HTTP ${res.status}`);
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('Video fallback recovery failed:', e);
      if (state.showErrorFallback) {
        state.showErrorFallback(errorMsg, e?.message || '');
      }
    }
  });

  // Collapsible Caption Expand/Collapse
  const captionText = document.getElementById('tiktokCaptionText');
  if (captionText) {
    const onCaptionClick = () => {
      captionText.classList.toggle('line-clamp-2');
    };
    captionText.addEventListener('click', onCaptionClick);
    registerCleanup(() => captionText.removeEventListener('click', onCaptionClick));
  }

  // Playlist Navigation Controls (Next / Prev / Vertical Swipes)
  const playlist = Array.isArray(state.playlist) ? state.playlist : null;
  if (playlist && playlist.length > 1) {
    const currentIndex = typeof state.playlistIndex === 'number' ? state.playlistIndex : 0;

    const navigate = (targetIndex, direction) => {
      if (typeof state.onSwitchItem === 'function') {
        state.onSwitchItem(targetIndex, direction);
      }
    };

    const btnPrev = document.getElementById('btnPrevViewerVideo');
    const btnNext = document.getElementById('btnNextViewerVideo');

    if (btnPrev) {
      btnPrev.onclick = (e) => {
        e.stopPropagation();
        navigate(currentIndex - 1, 'prev');
      };
    }

    if (btnNext) {
      btnNext.onclick = (e) => {
        e.stopPropagation();
        navigate(currentIndex + 1, 'next');
      };
    }

    // Keyboard ArrowUp / ArrowDown Navigation
    const onKeydown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigate(currentIndex + 1, 'next');
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigate(currentIndex - 1, 'prev');
      }
    };
    window.addEventListener('keydown', onKeydown);
    registerCleanup(() => window.removeEventListener('keydown', onKeydown));

    // Vertical Touch Swipe Navigation
    const container = document.getElementById('videoViewerContainer') || video.parentElement;
    if (container) {
      let startY = 0;
      let startX = 0;
      let startTime = 0;

      const onTouchStart = (e) => {
        if (e.touches.length === 1) {
          startY = e.touches[0].clientY;
          startX = e.touches[0].clientX;
          startTime = Date.now();
        }
      };

      const onTouchEnd = (e) => {
        if (e.changedTouches.length === 1) {
          const endY = e.changedTouches[0].clientY;
          const endX = e.changedTouches[0].clientX;
          const diffY = endY - startY;
          const diffX = endX - startX;
          const elapsed = Date.now() - startTime;

          // Swipe up (diffY < -45): Next video
          // Swipe down (diffY > 45): Previous video
          if (Math.abs(diffY) > 45 && Math.abs(diffY) > Math.abs(diffX) * 1.2 && elapsed < 800) {
            if (diffY < 0) {
              navigate(currentIndex + 1, 'next');
            } else {
              navigate(currentIndex - 1, 'prev');
            }
          }
        }
      };

      container.addEventListener('touchstart', onTouchStart, { passive: true });
      container.addEventListener('touchend', onTouchEnd, { passive: true });

      registerCleanup(() => {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchend', onTouchEnd);
      });
    }
  }

  if (window.lucide?.createIcons) window.lucide.createIcons();
}
