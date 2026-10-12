/**
 * MigrationNoticeModal Component
 * Prominent migration notice modal and persistent top banner when accessing deprecated domains
 * (e.g. duydev.studio.alphadaniel.io.vn -> studio.duydev.cloud)
 */

export const DEPRECATED_DOMAINS = [
  'duydev.studio.alphadaniel.io.vn',
  'duydevstudio.alphadaniel.io.vn',
  'alphadaniel.io.vn'
];

export const CANONICAL_TARGET_DOMAIN = 'https://studio.duydev.cloud';

/**
 * Checks if the current page was loaded from a deprecated domain or has a test parameter
 * @returns {boolean}
 */
export function isDeprecatedDomain() {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search || '');
  const hash = window.location.hash || '';

  // 1. Explicit domain check (e.g. duydev.studio.alphadaniel.io.vn or any *.alphadaniel.io.vn)
  const isOldHost = DEPRECATED_DOMAINS.some(d => host === d || host.endsWith('.' + d));

  // 2. Testing trigger (?migration=1 or #migration-notice)
  const isTestTrigger = searchParams.has('migration') ||
                        searchParams.has('migration-notice') ||
                        hash.includes('migration-notice');

  return isOldHost || isTestTrigger;
}

/**
 * Constructs the canonical destination URL preserving pathname, clean search, and hash
 * @returns {string}
 */
export function getCanonicalDestinationUrl() {
  if (typeof window === 'undefined' || !window.location) return CANONICAL_TARGET_DOMAIN;

  const pathname = window.location.pathname || '/';
  const searchParams = new URLSearchParams(window.location.search || '');
  searchParams.delete('migration');
  searchParams.delete('migration-notice');
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const rawHash = window.location.hash || '';
  const cleanHash = rawHash
    .replace(/[?&]migration(-notice)?(=1)?/g, '')
    .replace('#migration-notice', '');

  return `${CANONICAL_TARGET_DOMAIN}${pathname}${qs}${cleanHash}`;
}

let countdownTimer = null;
let remainingSeconds = 8;
let isPaused = false;

/**
 * Renders and attaches the migration modal and banner if on deprecated domain
 */
export function checkAndRenderMigrationNotice() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (!isDeprecatedDomain()) {
    return;
  }

  // Avoid duplicate injection
  if (document.getElementById('migrationNoticeOverlay')) {
    return;
  }

  const targetUrl = getCanonicalDestinationUrl();
  const currentHost = window.location.hostname || 'duydev.studio.alphadaniel.io.vn';

  // Inject Modal & Top Banner markup
  const container = document.createElement('div');
  container.id = 'migrationNoticeOverlay';
  container.innerHTML = `
    <!-- 1. Top Warning Banner (Initially hidden unless modal is dismissed) -->
    <div id="migrationNoticeTopBanner" class="hidden sticky top-0 z-50 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white px-3 sm:px-5 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-all">
      <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-200 shrink-0"></i>
          <span class="truncate">
            Tên miền <strong class="font-mono text-amber-100">${currentHost}</strong> đã di dời sang <strong class="font-mono underline text-white">studio.duydev.cloud</strong>.
          </span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a href="${targetUrl}" class="px-3 py-1 rounded-lg bg-white text-orange-600 font-bold hover:bg-orange-50 text-[11px] shadow-xs transition flex items-center gap-1.5 no-underline">
            <span>Chuyển ngay</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
          <button type="button" id="btnReopenMigrationModal" class="px-2 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-white text-[11px] transition cursor-pointer" title="Xem chi tiết thông báo">
            Chi tiết
          </button>
        </div>
      </div>
    </div>

    <!-- 2. High-Priority Migration Notice Modal -->
    <div id="migrationNoticeModal" class="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div class="relative w-full max-w-lg rounded-3xl border border-amber-500/30 dark:border-amber-500/20 bg-white dark:bg-[#121215] p-6 sm:p-8 shadow-2xl space-y-6 text-center overflow-hidden">
        
        <!-- Glowing background aura -->
        <div class="absolute -top-24 -left-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <!-- Beacon Header Icon -->
        <div class="relative mx-auto w-16 h-16 flex items-center justify-center">
          <div class="absolute inset-0 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 opacity-20 blur-xl animate-pulse"></div>
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400 shadow-md">
            <i data-lucide="arrow-right-left" class="w-8 h-8"></i>
          </div>
        </div>

        <!-- Pill Badge & Title -->
        <div class="space-y-2">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-[11px] font-bold tracking-wider uppercase font-mono">
            <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>Thông Báo Di Dời Tên Miền</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Trang web đã chuyển sang địa chỉ mới
          </h2>
          <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
            Tên miền cũ <span class="font-mono font-semibold text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded bg-rose-500/10">${currentHost}</span> đã ngừng hoạt động. Toàn bộ tiện ích DuyDev Studio hiện được vận hành chính thức tại địa chỉ mới:
          </p>
        </div>

        <!-- Highlight Target Address Card -->
        <div class="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/80 border border-amber-500/30 dark:border-amber-500/20 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <i data-lucide="shield-check" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider font-mono">Địa chỉ mới chính thức</div>
              <a href="${targetUrl}" class="font-mono text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 hover:text-orange-500 dark:hover:text-orange-400 transition truncate block">
                studio.duydev.cloud
              </a>
            </div>
          </div>
          <button type="button" id="btnCopyCanonicalUrl" class="px-3 py-2 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer" title="Sao chép liên kết">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span id="btnCopyCanonicalText">Sao chép</span>
          </button>
        </div>

        <!-- Guidance List -->
        <div class="text-left bg-zinc-50 dark:bg-white/[0.02] p-3.5 rounded-2xl border border-zinc-200/80 dark:border-white/5 space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
          <div class="flex items-start gap-2">
            <i data-lucide="bookmark" class="w-4 h-4 text-orange-500 shrink-0 mt-0.5"></i>
            <span>Vui lòng cập nhật lại <strong>Dấu trang (Bookmark)</strong> trên trình duyệt sang <strong>studio.duydev.cloud</strong>.</span>
          </div>
          <div class="flex items-start gap-2">
            <i data-lucide="smartphone" class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"></i>
            <span>Nếu đã cài đặt PWA: Hãy gỡ bỏ bản cũ và cài đặt lại từ tên miền mới để nhận đầy đủ cập nhật.</span>
          </div>
        </div>

        <!-- Countdown Ticker -->
        <div id="migrationCountdownContainer" class="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-1.5 font-medium font-mono">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-500 animate-spin"></i>
          <span>Tự động chuyển tiếp sau <strong id="migrationCountdownSec" class="text-amber-600 dark:text-amber-400 font-bold text-sm">8</strong>s...</span>
          <button type="button" id="btnToggleCountdownPause" class="ml-2 text-[11px] underline text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer">
            [Tạm dừng]
          </button>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-2.5 pt-1">
          <a id="btnRedirectNow" href="${targetUrl}" class="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:via-amber-600 hover:to-orange-700 text-white font-bold text-sm sm:text-base shadow-xl shadow-orange-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2.5 cursor-pointer no-underline">
            <span>Chuyển Sang studio.duydev.cloud Ngay</span>
            <i data-lucide="arrow-right" class="w-4 h-4 sm:w-5 sm:h-5"></i>
          </a>

          <div class="flex items-center justify-center gap-4 text-xs">
            <button type="button" id="btnStayOnDeprecatedDomain" class="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition underline cursor-pointer py-1">
              Tôi vẫn muốn ở lại trang này
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.prepend(container);

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: container });
  }

  // Attach event handlers
  setupMigrationEvents(targetUrl);
}

/**
 * Attaches interactive listeners and countdown timer
 * @param {string} targetUrl
 */
function setupMigrationEvents(targetUrl) {
  const modal = document.getElementById('migrationNoticeModal');
  const banner = document.getElementById('migrationNoticeTopBanner');
  const secEl = document.getElementById('migrationCountdownSec');
  const btnPause = document.getElementById('btnToggleCountdownPause');
  const btnCopy = document.getElementById('btnCopyCanonicalUrl');
  const btnCopyText = document.getElementById('btnCopyCanonicalText');
  const btnStay = document.getElementById('btnStayOnDeprecatedDomain');
  const btnReopen = document.getElementById('btnReopenMigrationModal');
  const btnRedirect = document.getElementById('btnRedirectNow');

  // Copy button
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(targetUrl);
        if (btnCopyText) btnCopyText.textContent = 'Đã chép!';
        setTimeout(() => {
          if (btnCopyText) btnCopyText.textContent = 'Sao chép';
        }, 2000);
      } catch {
        // Fallback prompt
        window.prompt('Sao chép liên kết:', targetUrl);
      }
    });
  }

  // Pause / Resume countdown
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      isPaused = !isPaused;
      if (isPaused) {
        btnPause.textContent = '[Tiếp tục]';
        btnPause.classList.add('text-amber-500', 'font-bold');
      } else {
        btnPause.textContent = '[Tạm dừng]';
        btnPause.classList.remove('text-amber-500', 'font-bold');
      }
    });
  }

  // Dismiss modal and show top banner
  if (btnStay) {
    btnStay.addEventListener('click', () => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      if (modal) modal.classList.add('hidden');
      if (banner) banner.classList.remove('hidden');
    });
  }

  // Re-open modal from top banner
  if (btnReopen) {
    btnReopen.addEventListener('click', () => {
      if (modal) modal.classList.remove('hidden');
      if (banner) banner.classList.add('hidden');
    });
  }

  // Immediate redirect when clicking CTA
  if (btnRedirect) {
    btnRedirect.addEventListener('click', (e) => {
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    });
  }

  // Countdown timer
  remainingSeconds = 8;
  isPaused = false;
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    if (isPaused) return;

    remainingSeconds -= 1;
    if (secEl) {
      secEl.textContent = String(Math.max(0, remainingSeconds));
    }

    if (remainingSeconds <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      // Navigate to canonical URL
      window.location.href = targetUrl;
    }
  }, 1000);
}
