/**
 * useQrListeners - UI Event Listeners for QR Studio & Scanner
 */

import { qrState, URL_PRESETS, persistQrState } from './useQrState.js';
import {
  renderStyledQrToContainer,
  handleCreateDynamicQr,
  handleSaveDestination,
  handleRefreshAnalytics,
  handleDownloadDynamic,
  handleCopyDynamicImage,
  generateQrCode,
  downloadGeneratedQr,
  processScanFile
} from './useQrActions.js';
import { attachDropzoneListeners } from '../../../common/Dropzone.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyText, copyQrImageOrFallback } from '../../../../utilities/clipboard.js';
import { storage } from '../../../../utilities/storage.js';
import { attachQrHistoryListeners } from '../components/QrHistoryList.js';
import { attachQrPasteHandler, detachQrPasteHandler, handleClipboardPaste } from './useQrPaste.js';

/**
 * Attaches an event listener to an element by its ID if the element exists.
 * Supports both on(id, event, handler) and on(id, handler) shorthand for click events.
 * @param {string} id
 * @param {string|EventListener} eventOrHandler
 * @param {EventListener} [maybeHandler]
 */
function on(id, eventOrHandler, maybeHandler) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof eventOrHandler === 'function') {
    el.addEventListener('click', eventOrHandler);
  } else if (typeof maybeHandler === 'function') {
    el.addEventListener(eventOrHandler, maybeHandler);
  }
}

/**
 * Attaches DOM event listeners for QR Studio (creation & configuration tabs).
 * @param {() => void} [onReRender]
 * @returns {() => void} Teardown cleanup function
 */
export function attachQrStudioListeners(onReRender) {
  detachQrPasteHandler();

  const activeBtn = document.querySelector(`.btn-qr-tab[data-qr-tab="${qrState.activeTab}"]`);
  if (activeBtn) {
    activeBtn.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  if (qrState.activeTab === 'url' && qrState.dynamic?.createdQr) {
    renderStyledQrToContainer('dynamicQrCanvasContainer');
  }

  // 1. Tab switches (Creation tabs only)
  document.querySelectorAll('.btn-qr-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.qrTab;
      if (targetTab && targetTab !== qrState.activeTab) {
        qrState.activeTab = targetTab;
        qrState.error = null;
        persistQrState();
        if (onReRender) onReRender();

        requestAnimationFrame(() => {
          const newActive = document.querySelector(`.btn-qr-tab[data-qr-tab="${targetTab}"]`);
          if (newActive) {
            newActive.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        });
      }
    });
  });

  // 2. Tab-specific events (Creation only)
  if (qrState.activeTab === 'url') {
    bindDynamicEvents(onReRender);
  } else {
    bindStaticEvents(onReRender);
  }

  // 3. Dismiss Error
  on('btnDismissQrError', 'click', () => {
    qrState.error = null;
    if (onReRender) onReRender();
  });

  // 4. Attach history events
  attachQrHistoryListeners(onReRender);

  return () => {
    detachQrPasteHandler();
  };
}

/**
 * Binds event listeners for Dynamic QR code configuration.
 * @param {() => void} [onReRender]
 */
function bindDynamicEvents(onReRender) {
  // Preset selector
  on('dynamicPresetSelect', 'change', (e) => {
    qrState.dynamic.preset = e.target.value;
    const targetInput = document.getElementById('dynamicTargetUrl');
    const found = URL_PRESETS.find((p) => p.id === e.target.value);
    if (targetInput && found) {
      targetInput.placeholder = found.placeholder;
    }
  });

  on('dynamicTargetUrl', 'input', (e) => {
    qrState.dynamic.targetUrl = e.target.value.trim();
    persistQrState();
  });

  on('dynamicTargetUrl', 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateDynamicQr(onReRender);
    }
  });

  on('dynamicTitle', 'input', (e) => {
    qrState.dynamic.title = e.target.value;
    persistQrState();
  });

  on('dynamicCustomSlug', 'input', (e) => {
    qrState.dynamic.customSlug = e.target.value.trim();
    persistQrState();
  });

  on('btnCreateDynamicQr', 'click', () => {
    handleCreateDynamicQr(onReRender);
  });

  on('btnToggleQrStyling', 'click', () => {
    qrState.styling.isExpanded = !qrState.styling.isExpanded;
    const content = document.getElementById('qrStylingCollapseContent');
    const icon = document.getElementById('iconToggleQrStyling');
    if (content) {
      content.classList.toggle('hidden', !qrState.styling.isExpanded);
    }
    if (icon) {
      icon.setAttribute('data-lucide', qrState.styling.isExpanded ? 'chevron-up' : 'chevron-down');
      if (window.lucide) window.lucide.createIcons({ root: icon.parentElement });
    }
    persistQrState();
  });

  on('btnResetQrToStandard', 'click', () => {
    qrState.styling.isCustomized = false;
    qrState.styling.dotType = 'square';
    qrState.styling.cornerSquareType = 'square';
    qrState.styling.cornerDotType = 'square';
    qrState.styling.dotColor = '#000000';
    qrState.styling.useGradient = false;
    qrState.styling.logoUrl = null;
    persistQrState();
    showToast('Đã đặt lại về chuẩn QR mặc định', 'info');
    if (onReRender) onReRender();
  });

  document.querySelectorAll('.btn-dot-type').forEach((btn) => {
    btn.addEventListener('click', () => {
      qrState.styling.dotType = btn.dataset.dotType;
      qrState.styling.isCustomized = true;
      persistQrState();
      if (onReRender) onReRender();
    });
  });

  on('chkUseGradient', 'change', (e) => {
    qrState.styling.useGradient = e.target.checked;
    qrState.styling.isCustomized = true;
    persistQrState();
    if (onReRender) onReRender();
  });

  on('qrGradientStart', 'change', (e) => {
    qrState.styling.gradientStart = e.target.value;
    qrState.styling.isCustomized = true;
    persistQrState();
    if (onReRender) onReRender();
  });

  on('qrGradientEnd', 'change', (e) => {
    qrState.styling.gradientEnd = e.target.value;
    qrState.styling.isCustomized = true;
    persistQrState();
    if (onReRender) onReRender();
  });

  document.querySelectorAll('.btn-preset-dot-color').forEach((btn) => {
    btn.addEventListener('click', () => {
      qrState.styling.dotColor = btn.dataset.dotColor;
      qrState.styling.isCustomized = true;
      persistQrState();
      if (onReRender) onReRender();
    });
  });

  on('qrDotColor', 'change', (e) => {
    qrState.styling.dotColor = e.target.value;
    qrState.styling.isCustomized = true;
    persistQrState();
    if (onReRender) onReRender();
  });

  document.querySelectorAll('.btn-corner-square').forEach((btn) => {
    btn.addEventListener('click', () => {
      qrState.styling.cornerSquareType = btn.dataset.cornerSquare;
      qrState.styling.isCustomized = true;
      persistQrState();
      if (onReRender) onReRender();
    });
  });

  on('dynamicLogoInput', 'change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        qrState.styling.logoUrl = event.target.result;
        qrState.styling.isCustomized = true;
        persistQrState();
        if (onReRender) onReRender();
      };
      reader.readAsDataURL(file);
    }
  });

  on('btnRemoveDynamicLogo', 'click', () => {
    qrState.styling.logoUrl = null;
    persistQrState();
    if (onReRender) onReRender();
  });

  if (qrState.dynamic.createdQr) {
    on('btnRefreshAnalytics', 'click', () => {
      handleRefreshAnalytics(onReRender);
    });

    on('btnCopyDynamicShortLink', 'click', async () => {
      const ok = await copyText(qrState.dynamic.createdQr.shortUrl);
      showToast(ok ? 'Đã sao chép link' : 'Không thể sao chép', ok ? 'success' : 'error');
    });

    on('btnToggleEditDestination', 'click', () => {
      qrState.dynamic.isEditingDestination = true;
      qrState.dynamic.editTargetUrl = qrState.dynamic.createdQr
        ? qrState.dynamic.createdQr.targetUrl
        : '';
      if (onReRender) onReRender();
    });

    on('btnCancelEditDestination', 'click', () => {
      qrState.dynamic.isEditingDestination = false;
      if (onReRender) onReRender();
    });

    on('btnSaveDestination', 'click', () => {
      const inputEl = document.getElementById('inputEditTargetUrl');
      handleSaveDestination(inputEl ? inputEl.value.trim() : '', onReRender);
    });
  }

  on('btnDownloadDynamicPng', 'click', () => handleDownloadDynamic('png'));
  on('btnDownloadDynamicSvg', 'click', () => handleDownloadDynamic('svg'));
  on('btnCopyDynamicImage', 'click', () => handleCopyDynamicImage());

  on('btnTrashDynamicQr', 'click', async () => {
    if (qrState.dynamic.historyId) {
      await storage.moveToTrash(qrState.dynamic.historyId);
    }
    qrState.dynamic.createdQr = null;
    persistQrState();
    showToast('Đã chuyển mã QR vào thùng rác', 'info');
    if (onReRender) onReRender();
  });
}

/**
 * Binds event listeners for Static QR forms (VietQR, Wi-Fi, vCard, Text).
 * @param {() => void} [onReRender]
 */
function bindStaticEvents(onReRender) {
  // Real-time input synchronization
  on('qrTextInput', 'input', (e) => {
    qrState.text.content = e.target.value;
    persistQrState();
  });

  on('qrAccountNumber', 'input', (e) => {
    qrState.vietqr.accountNumber = e.target.value.trim();
    persistQrState();
  });

  on('qrAmount', 'input', (e) => {
    qrState.vietqr.amount = e.target.value ? Number(e.target.value) : '';
    persistQrState();
  });

  on('qrPurpose', 'input', (e) => {
    qrState.vietqr.purpose = e.target.value;
    persistQrState();
  });

  on('qrBankSelect', 'change', (e) => {
    qrState.vietqr.bankBin = e.target.value;
    persistQrState();
  });

  on('qrWifiSsid', 'input', (e) => {
    qrState.wifi.ssid = e.target.value.trim();
    persistQrState();
  });

  on('qrWifiPassword', 'input', (e) => {
    qrState.wifi.password = e.target.value;
    persistQrState();
  });

  on('qrWifiSecurity', 'change', (e) => {
    qrState.wifi.security = e.target.value;
    persistQrState();
  });

  on('qrWifiHidden', 'change', (e) => {
    qrState.wifi.hidden = e.target.checked;
    persistQrState();
  });

  on('vcardFullName', 'input', (e) => {
    qrState.vcard.fullName = e.target.value;
    persistQrState();
  });

  on('vcardPhone', 'input', (e) => {
    qrState.vcard.phone = e.target.value.trim();
    persistQrState();
  });

  on('vcardEmail', 'input', (e) => {
    qrState.vcard.email = e.target.value.trim();
    persistQrState();
  });

  on('vcardOrg', 'input', (e) => {
    qrState.vcard.organization = e.target.value;
    persistQrState();
  });

  on('vcardTitle', 'input', (e) => {
    qrState.vcard.title = e.target.value;
    persistQrState();
  });

  on('vcardWebsite', 'input', (e) => {
    qrState.vcard.website = e.target.value.trim();
    persistQrState();
  });

  document.querySelectorAll('input[name="qrFormatRadio"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      qrState.format = e.target.value;
      persistQrState();
      if (onReRender) onReRender();
    });
  });

  document.querySelectorAll('.btn-color-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      qrState.colorDark = btn.dataset.colorDark;
      persistQrState();
      if (onReRender) onReRender();
    });
  });

  const customColorInput = document.getElementById('qrCustomColorDark');
  if (customColorInput) {
    customColorInput.addEventListener('input', (e) => {
      qrState.colorDark = e.target.value;
      persistQrState();
    });
    customColorInput.addEventListener('change', () => {
      persistQrState();
      if (onReRender) onReRender();
    });
  }

  on('btnGenerateQr', 'click', () => {
    generateQrCode(onReRender);
  });

  if (qrState.generatedResult) {
    on('btnDownloadQr', 'click', () => {
      downloadGeneratedQr();
    });

    on('btnCopyQrData', 'click', async () => {
      try {
        const { format, dataUrl, content } = qrState.generatedResult;
        let blob = null;
        if (format === 'png' && dataUrl) {
          try {
            const res = await fetch(dataUrl);
            blob = await res.blob();
          } catch {
            // Fetch blob error fallback
          }
        }
        const res = await copyQrImageOrFallback({ blob, dataUrl, text: content });
        if (res.success) {
          if (res.mode === 'image') {
            showToast('Đã sao chép ảnh QR', 'success');
          } else {
            showToast('Đã sao chép nội dung', 'success');
          }
        } else {
          showToast('Không thể sao chép', 'error');
        }
      } catch {
        showToast('Không thể sao chép vào clipboard', 'error');
      }
    });

    on('btnTrashStaticQr', 'click', async () => {
      if (qrState.staticHistoryId) {
        await storage.moveToTrash(qrState.staticHistoryId);
      }
      qrState.generatedResult = null;
      persistQrState();
      showToast('Đã chuyển mã QR vào thùng rác', 'info');
      if (onReRender) onReRender();
    });
  }
}

/**
 * Binds dropzone and clipboard paste events for QR Scanner.
 * @param {() => void} [onReRender]
 */
function bindScannerEvents(onReRender) {
  attachDropzoneListeners('qrScanDropzone', async (files) => {
    if (files?.[0]) {
      await processScanFile(files[0], onReRender);
    }
  });

  on('btnCopyScanResult', 'click', async () => {
    if (!qrState.scan.result) return;
    const copied = await copyText(qrState.scan.result);
    showToast(
      copied ? 'Đã sao chép nội dung quét QR!' : 'Không thể truy cập clipboard',
      'info'
    );
  });

  on('btnPasteScanImage', 'click', () => {
    handleClipboardPaste(onReRender);
  });

  attachQrPasteHandler(onReRender);
}

/**
 * Attaches DOM event listeners for QR Scanner.
 * @param {() => void} [onReRender]
 * @returns {() => void} Teardown cleanup function
 */
export function attachQrScannerListeners(onReRender) {
  detachQrPasteHandler();
  bindScannerEvents(onReRender);
  attachQrHistoryListeners(onReRender);

  on('btnDismissQrError', 'click', () => {
    qrState.error = null;
    if (onReRender) onReRender();
  });

  return () => {
    detachQrPasteHandler();
  };
}
