/**
 * VideoRenderer Component (< 90 lines)
 * Responsive video player with PiP and resilient playback
 */

export function renderVideoViewer(state) {
  return `
    <div class="relative w-full flex items-center justify-center bg-black/80 rounded-xl overflow-hidden min-h-[300px] max-h-[75vh]">
      <video id="corePreviewVideo" controls autoplay playsinline class="max-h-[72vh] max-w-full rounded-lg shadow-2xl" src="${state.viewUrl}">
        Không hỗ trợ phát video này.
      </video>
    </div>
  `;
}

export function attachVideoListeners(state, registerCleanup) {
  const video = document.getElementById('corePreviewVideo');
  if (!video) return;

  registerCleanup(() => {
    try { video.pause(); video.src = ''; } catch {}
  });

  // Resilient blob recovery fallback if direct range stream fails
  video.addEventListener('error', async () => {
    try {
      const res = await fetch(state.viewUrl);
      if (res.ok) {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        registerCleanup(() => URL.revokeObjectURL(blobUrl));
        video.src = blobUrl;
        video.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Video fallback recovery failed:', e);
    }
  });
}
