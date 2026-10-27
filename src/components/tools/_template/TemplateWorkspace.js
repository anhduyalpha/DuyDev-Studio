/**
 * TemplateWorkspace.js - Kiến trúc mẫu chuẩn mực cho mọi Module mới trong DuyDev Studio
 * Tuân thủ 100% tài liệu quy chuẩn docs/MODULE_STANDARD.md
 * 
 * Các tính năng tích hợp sẵn:
 * 1. Khung vòng đời Mount/Unmount với dọn dẹp tài nguyên triệt để (Zero Memory Leak)
 * 2. Tự động nhận diện liên kết chia sẻ từ Android APK / Web Share Target (Auto-Start Handoff)
 * 3. Hộp thả lịch sử thu gọn tại chỗ (Zero-Flicker Collapsible History Dropbox - KI-CON-006, KI-FIX-040)
 * 4. Nút Dán thông minh đa nền tảng (Universal Clipboard Reader - KI-FIX-029)
 * 5. Khử bẩn liên kết & tham số theo dõi (Dirty URL Sanitization)
 * 6. Tích hợp thanh tác vụ nổi (GlobalTaskDock) & Thông báo đẩy Android Native
 * 7. Xem trước tệp trên Universal File Viewer & Lưu vào Studio Drive
 * 8. Giao diện chuẩn mực Impeccable Design: Light/Dark parity, touch targets >= 44px
 */

import { storage } from '../../../utilities/storage.js';
import { StorageService } from '../../../services/storageService.js';
import { ViewerConnector } from '../../common/viewer/FileViewerConnector.js';
import { soundEngine } from '../../../utilities/soundEngine.js';
import { showToast } from '../../../utilities/toast.js';
import { readText } from '../../../utilities/clipboard.js';
import { taskCoordinator } from '../../../utilities/taskCoordinator.js';
import { notificationHelper } from '../../../utilities/notificationHelper.js';
import { consumePendingAutoStart } from '../../../utilities/smartUrlRouter.js';
import { renderMediaHistorySection, attachMediaHistoryListeners } from '../common/MediaHistorySection.js';

export class TemplateWorkspace {
  /**
   * @param {HTMLElement} containerEl Phần tử DOM gốc được router cấp phát
   */
  constructor(containerEl) {
    this.container = containerEl;
    this.toolId = 'template-tool';
    this.accentColor = '#4F46E5';

    // State nội bộ
    this.url = '';
    this.loading = false;
    this.error = null;
    this.resultData = null;
    this.historyTab = 'history';

    // Biến quản lý dọn dẹp tài nguyên (Teardown References)
    this.historyCleanup = null;
    this.handlePendingEvent = null;
    this.abortController = null;

    // Bound listeners để xóa an toàn khi unmount
    this.boundHandleInput = this.handleInput.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleClick = this.handleClick.bind(this);
  }

  /**
   * Khởi tạo giao diện và kết nối các luồng sự kiện
   */
  mount() {
    // 1. Render giao diện chính của module
    this.render();

    // 2. Nạp ngầm dữ liệu lịch sử từ máy chủ, CHỈ cập nhật history container (không flash trang)
    storage.fetchHistory().then(() => {
      this.renderHistory();
    }).catch(() => {});

    // 3. Tiêu thụ URL tự động chuyển tiếp từ Android ShareSheet hoặc Web Share Target
    const pendingUrl = consumePendingAutoStart(this.toolId);
    if (pendingUrl) {
      this.url = pendingUrl;
      const input = this.container.querySelector('#templateUrlInput');
      if (input) input.value = pendingUrl;
      setTimeout(() => this.processAction(), 60);
    }

    // 4. Lắng nghe sự kiện chuyển tiếp khi đang đứng sẵn ở route này
    this.handlePendingEvent = (e) => {
      if (e.detail?.toolId === this.toolId && e.detail.url) {
        this.url = e.detail.url.trim();
        const input = this.container.querySelector('#templateUrlInput');
        if (input) input.value = this.url;
        setTimeout(() => this.processAction(), 60);
      }
    };
    window.addEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
  }

  /**
   * Hủy bỏ toàn bộ sự kiện, timer, kết nối mạng và dọn sạch DOM
   */
  unmount() {
    if (this.handlePendingEvent) {
      window.removeEventListener('ds:pending-autostart-ready', this.handlePendingEvent);
      this.handlePendingEvent = null;
    }

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.container.innerHTML = '';
  }

  handleInput(e) {
    if (e.target.id === 'templateUrlInput') {
      this.url = e.target.value;
      this.error = null;
    }
  }

  handleKeyDown(e) {
    if (e.target.id === 'templateUrlInput' && e.key === 'Enter') {
      e.preventDefault();
      this.processAction();
    }
  }

  async handleClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    try { soundEngine?.play('click'); } catch {}

    switch (action) {
      case 'paste-url': {
        const text = await readText();
        const clean = this.sanitizeUrl(text);
        if (clean) {
          this.url = clean;
          const input = this.container.querySelector('#templateUrlInput');
          if (input) input.value = clean;
          showToast('Đã dán liên kết', 'success');
          this.processAction();
        } else {
          showToast('Không tìm thấy liên kết hợp lệ trong bộ nhớ tạm', 'warning');
        }
        break;
      }
      case 'clear-input': {
        this.url = '';
        this.error = null;
        const input = this.container.querySelector('#templateUrlInput');
        if (input) {
          input.value = '';
          input.focus();
        }
        break;
      }
      case 'process-now': {
        this.processAction();
        break;
      }
      case 'preview-result': {
        this.previewInApp();
        break;
      }
      case 'save-drive': {
        this.saveToDrive();
        break;
      }
    }
  }

  /**
   * Khử bẩn liên kết và loại bỏ các tham số tracking
   */
  sanitizeUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const match = raw.match(/https?:\/\/[^\s"'<>()]+/i);
    if (!match) return '';
    try {
      const u = new URL(match[0].trimEnd().replace(/[.,;!?)]+$/, ''));
      // Xóa các tracker thông dụng
      ['fbclid', 'igsh', 'si', 'utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
      return u.toString();
    } catch {
      return match[0];
    }
  }

  /**
   * Thực thi tác vụ chính
   */
  async processAction() {
    const cleanUrl = this.sanitizeUrl(this.url || '');
    if (!cleanUrl) {
      this.error = 'Vui lòng dán liên kết hợp lệ';
      showToast(this.error, 'warning');
      this.render();
      return;
    }

    this.loading = true;
    this.error = null;
    this.render();

    const taskId = `task_${Date.now()}`;
    taskCoordinator?.createTask?.(taskId, {
      title: `Xử lý: ${cleanUrl}`,
      type: 'processing',
      progress: 10
    });

    try {
      soundEngine?.play('click');

      // Giả lập xử lý tác vụ (thay bằng gọi API backend)
      await new Promise(r => setTimeout(r, 600));

      this.resultData = {
        id: `item_${Date.now()}`,
        title: 'Tệp Mẫu Đã Xử Lý',
        url: cleanUrl,
        downloadUrl: cleanUrl,
        fileName: 'sample_output.mp4',
        duration: 120,
        resultSize: 1024 * 1024 * 15
      };

      // Ghi nhận vào hệ thống lưu trữ phân vùng
      storage.recordCompletedJob({
        id: this.resultData.id,
        toolId: this.toolId,
        title: this.resultData.title,
        fileName: this.resultData.fileName,
        originalUrl: cleanUrl,
        downloadUrl: this.resultData.downloadUrl,
        resultSize: this.resultData.resultSize,
        timestamp: Date.now()
      });

      taskCoordinator?.updateTask?.(taskId, { status: 'completed', progress: 100 });
      notificationHelper?.send?.({
        title: 'Xử lý thành công',
        body: `Đã hoàn tất xử lý cho ${this.resultData.title}`,
        icon: '/src/assets/logo-ds.svg'
      });

      soundEngine?.play('success');
      showToast('Đã xử lý xong tệp!', 'success');
    } catch (err) {
      this.error = err.message || 'Lỗi khi xử lý tác vụ';
      soundEngine?.play('error');
      showToast(this.error, 'error');
      taskCoordinator?.updateTask?.(taskId, { status: 'failed', error: this.error });
    } finally {
      this.loading = false;
      this.render();
      this.renderHistory();
    }
  }

  previewInApp() {
    if (!this.resultData) return;
    ViewerConnector.preview({
      name: this.resultData.title,
      fileName: this.resultData.fileName,
      category: 'video',
      mimeType: 'video/mp4',
      viewUrl: this.resultData.downloadUrl,
      downloadUrl: this.resultData.downloadUrl
    });
  }

  async saveToDrive() {
    if (!this.resultData) return;
    showToast('Đang lưu tệp vào Studio Drive...', 'info');
    // Tích hợp logic lưu drive tại đây...
  }

  saveHistoryItemToDrive(item) {
    if (!item) return;
    showToast('Đang lưu mục lịch sử vào Drive...', 'info');
    // Sau khi lưu xong, CHỈ gọi this.renderHistory() để cập nhật badge xanh tại chỗ
    this.renderHistory();
  }

  /**
   * Render toàn bộ khung làm việc của Module
   */
  render() {
    this.container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
        
        <!-- Breadcrumb Navigation Bar -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            <a href="#" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#111114] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 transition shadow-xs min-h-[44px]">
              <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> <span class="hidden xs:inline">Dashboard</span>
            </a>
            <span class="text-zinc-400 dark:text-zinc-600">/</span>
            <span class="text-zinc-900 dark:text-zinc-200 font-semibold truncate flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" style="background-color: ${this.accentColor}"></span>
              Tên Công Cụ Mẫu
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Tier S
            </span>
          </div>
        </div>

        <!-- Master Interactive Input Card -->
        <div class="linear-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-3">
          <label for="templateUrlInput" class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Dán liên kết cần xử lý
          </label>
          <div class="relative flex items-center">
            <input
              type="text"
              id="templateUrlInput"
              value="${this.url}"
              placeholder="https://..."
              class="w-full pl-3.5 pr-24 py-2.5 rounded-xl text-sm bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition min-h-[44px]"
            />
            <div class="absolute right-1.5 flex items-center gap-1">
              ${this.url ? `
                <button
                  type="button"
                  data-action="clear-input"
                  class="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                  title="Xóa nội dung"
                >
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              ` : ''}
              <button
                type="button"
                data-action="paste-url"
                class="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition flex items-center gap-1 min-h-[40px] cursor-pointer"
                title="Dán từ bộ nhớ tạm"
              >
                <i data-lucide="clipboard" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Dán</span>
              </button>
            </div>
          </div>

          ${this.error ? `
            <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <i data-lucide="alert-circle" class="w-4 h-4 shrink-0"></i>
              <span>${this.error}</span>
            </div>
          ` : ''}

          <div class="flex justify-end pt-1">
            <button
              type="button"
              data-action="process-now"
              ${this.loading ? 'disabled' : ''}
              class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm flex items-center gap-2 min-h-[44px] cursor-pointer"
            >
              ${this.loading ? `
                <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
                <span>Đang xử lý...</span>
              ` : `
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
                <span>Bắt đầu xử lý</span>
              `}
            </button>
          </div>
        </div>

        <!-- Result Preview Card (nếu có dữ liệu) -->
        ${this.resultData ? `
          <div class="linear-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-zinc-200 dark:border-white/10 shadow-xs space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">${this.resultData.title}</h3>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  data-action="preview-result"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                  <span>Xem trước</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- ISOLATED HISTORY CONTAINER: Nơi chứa lịch sử được cách ly để chống giật lag toàn trang -->
        <div id="templateHistoryContainer">
          ${renderMediaHistorySection({
            toolId: this.toolId,
            title: 'Lịch Sử Tác Vụ Mẫu',
            activeTab: this.historyTab,
            fallbackIcon: 'clock',
            accentColor: this.accentColor,
            driveFolderPath: '/template'
          })}
        </div>

      </div>
    `;

    // Gắn listeners cho ô input và container
    const input = this.container.querySelector('#templateUrlInput');
    if (input) {
      input.removeEventListener('input', this.boundHandleInput);
      input.removeEventListener('keydown', this.boundHandleKeyDown);
      input.addEventListener('input', this.boundHandleInput);
      input.addEventListener('keydown', this.boundHandleKeyDown);
    }

    this.container.removeEventListener('click', this.boundHandleClick);
    this.container.addEventListener('click', this.boundHandleClick);

    // Gắn listeners cô lập cho phần lịch sử
    this.attachHistoryListeners();

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: this.container });
    }
  }

  /**
   * Gắn listeners chuyên trách cho khu vực lịch sử
   */
  attachHistoryListeners() {
    const historyContainer = this.container.querySelector('#templateHistoryContainer');
    if (!historyContainer) return;

    if (this.historyCleanup) {
      this.historyCleanup();
      this.historyCleanup = null;
    }

    this.historyCleanup = attachMediaHistoryListeners({
      container: historyContainer,
      toolId: this.toolId,
      accentColor: this.accentColor,
      onTabChange: (tab) => {
        this.historyTab = tab;
        this.renderHistory();
      },
      onReResolve: (url) => {
        this.url = url;
        const inp = this.container.querySelector('#templateUrlInput');
        if (inp) inp.value = url;
        this.processAction();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      onSaveDrive: (item) => {
        this.saveHistoryItemToDrive(item);
      },
      onHistoryChange: () => {
        this.renderHistory();
      }
    });

    if (window.lucide?.createIcons) {
      window.lucide.createIcons({ root: historyContainer });
    }
  }

  /**
   * Cập nhật CHỈ phân vùng lịch sử, bảo toàn 100% các ô input và trạng thái trang phía trên
   */
  renderHistory() {
    const historyContainer = this.container.querySelector('#templateHistoryContainer');
    if (!historyContainer) return;

    historyContainer.innerHTML = renderMediaHistorySection({
      toolId: this.toolId,
      title: 'Lịch Sử Tác Vụ Mẫu',
      activeTab: this.historyTab,
      fallbackIcon: 'clock',
      accentColor: this.accentColor,
      driveFolderPath: '/template'
    });

    this.attachHistoryListeners();
  }
}
