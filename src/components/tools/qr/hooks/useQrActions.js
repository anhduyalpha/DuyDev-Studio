/**
 * useQrActions - Unified Action Handlers for QR Studio
 * Manages Dynamic QR creation/styling, Static QR generation (VietQR, Wi-Fi, vCard, Text),
 * QR scanning (BarcodeDetector / backend sharp fallback), and downloads.
 */

import { qrState, getApiBase, persistQrState, POPULAR_BANKS } from './useQrState.js';
import { showToast } from '../../../../utilities/toast.js';
import { copyQrImageOrFallback } from '../../../../utilities/clipboard.js';
import { storage } from '../../../../utilities/storage.js';

let activeStyledQr = null;

/**
 * Returns the currently active QRCodeStyling instance.
 * @returns {any} QRCodeStyling instance or null
 */
export function getActiveStyledQr() {
  return activeStyledQr;
}

/**
 * Renders the styled dynamic QR preview into the target DOM container.
 * @param {string} containerId - Element ID of the target container
 */
export function renderStyledQrToContainer(containerId) {
  try {
    const container = document.getElementById(containerId);
    if (!container || !window.QRCodeStyling) return;

    const { dynamic = {}, styling = {} } = qrState;
    if (!dynamic.createdQr) return;

    container.innerHTML = '';
    const shortUrl = dynamic.createdQr.shortUrl;

    const isCustomized = Boolean(styling.isCustomized);

    const dotsOptions = {
      type: isCustomized ? (styling.dotType || 'square') : 'square',
      color: isCustomized ? (styling.dotColor || '#000000') : '#000000'
    };

    if (isCustomized && styling.useGradient && styling.gradientStart && styling.gradientEnd) {
      dotsOptions.gradient = {
        type: 'linear',
        rotation: 45,
        colorStops: [
          { offset: 0, color: styling.gradientStart },
          { offset: 1, color: styling.gradientEnd }
        ]
      };
    }

    activeStyledQr = new window.QRCodeStyling({
      width: 250,
      height: 250,
      data: shortUrl,
      image: (isCustomized && styling.logoUrl) ? styling.logoUrl : undefined,
      dotsOptions,
      cornersSquareOptions: {
        type: isCustomized ? (styling.cornerSquareType || 'square') : 'square',
        color: isCustomized ? (styling.cornerColor || styling.dotColor || '#000000') : '#000000'
      },
      cornersDotOptions: {
        type: isCustomized ? (styling.cornerDotType || 'square') : 'square',
        color: isCustomized ? (styling.cornerColor || styling.dotColor || '#000000') : '#000000'
      },
      backgroundOptions: { color: '#ffffff' },
      imageOptions: {
        crossOrigin: 'anonymous',
        margin: styling.logoMargin ?? 6,
        imageSize: styling.logoSize ?? 0.32,
        hideBackgroundDots: true
      },
      qrOptions: {
        typeNumber: 0,
        errorCorrectionLevel: (isCustomized && styling.logoUrl) ? 'H' : 'M'
      }
    });

    if (container && typeof container.appendChild === 'function') {
      activeStyledQr.append(container);
    }
  } catch (err) {
    console.warn('[QR] Failed to render styled QR preview:', err);
  }
}

/**
 * Creates a dynamic QR code redirect link and renders its matrix.
 * @param {() => void} [onReRender]
 */
export async function handleCreateDynamicQr(onReRender) {
  const getVal = (id) => document.getElementById(id)?.value?.trim();
  if (getVal('dynamicTargetUrl') !== undefined) {
    qrState.dynamic.targetUrl = getVal('dynamicTargetUrl');
  }
  if (getVal('dynamicTitle') !== undefined) {
    qrState.dynamic.title = getVal('dynamicTitle');
  }
  if (getVal('dynamicCustomSlug') !== undefined) {
    qrState.dynamic.customSlug = getVal('dynamicCustomSlug');
  }

  let target = (qrState.dynamic.targetUrl || '').trim();
  if (!target) {
    qrState.error = 'Vui lòng nhập địa chỉ liên kết trang web (URL Đích)';
    if (onReRender) onReRender();
    return;
  }

  if (!/^https?:\/\//i.test(target)) {
    target = `https://${target}`;
    qrState.dynamic.targetUrl = target;
  }

  qrState.dynamic.isCreating = true;
  qrState.error = null;
  if (onReRender) onReRender();

  try {
    const apiBase = getApiBase();
    let dynamicData = null;
    let serverRes = null;

    try {
      serverRes = await fetch(`${apiBase}/api/v1/qr/dynamic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: target,
          title: qrState.dynamic.title || undefined,
          customSlug: qrState.dynamic.customSlug || undefined
        })
      });
    } catch (networkErr) {
      console.warn('[QR] Backend unreachable, falling back to direct QR:', networkErr);
    }

    if (serverRes) {
      const json = await serverRes.json().catch(() => ({}));
      if (serverRes.ok && json.success) {
        dynamicData = json.data;
      } else if (serverRes.status === 400 || serverRes.status === 409) {
        throw new Error(json.error?.message || 'Dữ liệu không hợp lệ hoặc slug đã tồn tại');
      } else {
        console.warn('[QR] Backend dynamic QR error, falling back to direct URL:', json);
      }
    }

    if (!dynamicData) {
      dynamicData = {
        id: `local_${Date.now()}`,
        slug: 'direct',
        shortUrl: target,
        targetUrl: target,
        title: qrState.dynamic.title || null,
        scanCount: 0,
        isFallback: true
      };
    }

    qrState.dynamic.createdQr = dynamicData;
    qrState.dynamic.isEditingDestination = false;
    const histTitle = qrState.dynamic.title?.trim();
    const histName = `[Link Web] ${histTitle ? `${histTitle} • ` : ''}${target}.png`;

    const hist = await storage.addHistoryItem({
      toolId: 'qr-multi',
      toolTitle: 'Tạo Mã QR',
      fileName: histName,
      resultSize: 1500,
      mimeType: 'image/png',
      category: 'image',
      downloadUrl: dynamicData.shortUrl
    });

    if (hist?.id) {
      qrState.dynamic.historyId = hist.id;
    }
    persistQrState();
    showToast('Đã tạo mã QR', 'success');
  } catch (err) {
    qrState.error = err.message || 'Lỗi khi tạo mã QR';
    showToast(qrState.error, 'error');
  } finally {
    qrState.dynamic.isCreating = false;
    if (onReRender) onReRender();
  }
}

/**
 * Updates the destination URL of an existing dynamic QR slug.
 * @param {string} newTargetUrl
 * @param {() => void} [onReRender]
 */
export async function handleSaveDestination(newTargetUrl, onReRender) {
  if (!qrState.dynamic.createdQr) return;
  let target = (newTargetUrl || '').trim();
  if (!target) {
    showToast('Vui lòng nhập URL đích mới', 'error');
    return;
  }
  if (!/^https?:\/\//i.test(target)) {
    target = `https://${target}`;
  }

  if (qrState.dynamic.createdQr.isFallback) {
    qrState.dynamic.createdQr.targetUrl = target;
    qrState.dynamic.createdQr.shortUrl = target;
    qrState.dynamic.isEditingDestination = false;
    persistQrState();
    showToast('Đã cập nhật link đích', 'success');
    if (onReRender) onReRender();
    return;
  }

  qrState.dynamic.isSavingDestination = true;
  if (onReRender) onReRender();

  try {
    const apiBase = getApiBase();
    const slug = qrState.dynamic.createdQr.slug;
    const res = await fetch(`${apiBase}/api/v1/qr/dynamic/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: target })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Không thể cập nhật liên kết đích');
    }

    qrState.dynamic.createdQr.targetUrl = json.data.targetUrl;
    qrState.dynamic.isEditingDestination = false;
    showToast('Đã cập nhật link đích', 'success');
  } catch (err) {
    showToast(err.message || 'Lỗi khi cập nhật', 'error');
  } finally {
    qrState.dynamic.isSavingDestination = false;
    if (onReRender) onReRender();
  }
}

/**
 * Refreshes real-time scan analytics for the active dynamic QR slug.
 * @param {() => void} [onReRender]
 */
export async function handleRefreshAnalytics(onReRender) {
  if (!qrState.dynamic.createdQr) return;
  if (qrState.dynamic.createdQr.isFallback) {
    showToast('Mã QR trực tiếp (ngoại tuyến) không hỗ trợ thống kê', 'info');
    return;
  }
  qrState.dynamic.isRefreshingAnalytics = true;
  if (onReRender) onReRender();

  try {
    const apiBase = getApiBase();
    const slug = qrState.dynamic.createdQr.slug;
    const res = await fetch(`${apiBase}/api/v1/qr/dynamic/${slug}/analytics`);
    const json = await res.json();

    if (res.ok && json.success) {
      qrState.dynamic.createdQr.scanCount = json.data.scanCount;
      qrState.dynamic.analytics = json.data;
      showToast(`Đã đồng bộ: ${json.data.scanCount} lượt quét`, 'success');
    }
  } catch (err) {
    showToast('Không thể làm mới lượt quét: ' + (err.message || ''), 'error');
  } finally {
    qrState.dynamic.isRefreshingAnalytics = false;
    if (onReRender) onReRender();
  }
}

/**
 * Downloads the styled dynamic QR code in PNG or SVG format.
 * @param {'png'|'svg'} [extension='png']
 */
export async function handleDownloadDynamic(extension = 'png') {
  if (!activeStyledQr) return;
  const slug = qrState.dynamic.createdQr ? qrState.dynamic.createdQr.slug : 'dynamic';

  try {
    if (extension === 'png') {
      activeStyledQr.update({ width: 1024, height: 1024 });
      await activeStyledQr.download({ name: `qr-${slug}`, extension: 'png' });
      activeStyledQr.update({ width: 250, height: 250 });
    } else {
      await activeStyledQr.download({ name: `qr-${slug}`, extension: 'svg' });
    }
    showToast(`Đã tải tệp ${extension.toUpperCase()}`, 'success');
  } catch (err) {
    showToast('Lỗi khi tải file: ' + (err.message || ''), 'error');
  }
}

/**
 * Copies the dynamic QR image to the clipboard.
 */
export async function handleCopyDynamicImage() {
  if (!activeStyledQr) return;

  try {
    const blob = await activeStyledQr.getRawData('png');
    const fallbackText = qrState.dynamic.createdQr ? qrState.dynamic.createdQr.shortUrl : '';
    const res = await copyQrImageOrFallback({ blob, text: fallbackText });

    if (res.success) {
      showToast(
        res.mode === 'image'
          ? 'Đã sao chép ảnh QR vào clipboard!'
          : 'Đã sao chép liên kết QR!',
        'success'
      );
    } else {
      showToast('Không thể sao chép vào clipboard', 'error');
    }
  } catch (err) {
    showToast('Lỗi sao chép: ' + (err.message || ''), 'error');
  }
}

/**
 * Generates an informative label for static QR items in history.
 * @param {string} type - 'vietqr' | 'wifi' | 'vcard' | 'text'
 * @returns {string} Human-readable title
 */
export function buildStaticQrHistoryName(type) {
  if (type === 'vietqr') {
    const bank = POPULAR_BANKS.find((b) => b.bin === qrState.vietqr.bankBin);
    const bankName = bank ? bank.shortName || bank.name : qrState.vietqr.bankBin || 'Ngân hàng';
    const amt = qrState.vietqr.amount
      ? ` • ${Number(qrState.vietqr.amount).toLocaleString('vi-VN')}đ`
      : '';
    const pur = qrState.vietqr.purpose ? ` • ${qrState.vietqr.purpose}` : '';
    return `[VietQR] ${bankName}: ${qrState.vietqr.accountNumber}${amt}${pur}`;
  }

  if (type === 'wifi') {
    const sec = qrState.wifi.security === 'nopass' ? 'Không MK' : qrState.wifi.security || 'WPA';
    const pass = qrState.wifi.password ? ` (MK: ${qrState.wifi.password})` : '';
    return `[Wi-Fi] ${qrState.wifi.ssid || 'Mạng'} • ${sec}${pass}`;
  }

  if (type === 'vcard') {
    const details = [qrState.vcard.phone, qrState.vcard.organization || qrState.vcard.email]
      .filter(Boolean)
      .join(' • ');
    return `[Danh Bạ] ${qrState.vcard.fullName || 'Liên hệ'}${details ? ` • ${details}` : ''}`;
  }

  if (type === 'text') {
    const txt = (qrState.text.content || '').trim().replace(/\s+/g, ' ');
    return `[Văn Bản] ${txt.length > 55 ? txt.slice(0, 52) + '...' : txt}`;
  }

  return `[Mã QR] ${type}`;
}

/**
 * Synchronizes DOM form input values into the static qrState structure.
 */
export function syncStaticInputsFromDom() {
  const type = qrState.activeTab;
  const val = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : undefined;
  };

  if (type === 'vietqr') {
    if (val('qrAccountNumber') !== undefined) {
      qrState.vietqr.accountNumber = val('qrAccountNumber').trim();
    }
    if (val('qrAmount') !== undefined) {
      qrState.vietqr.amount = val('qrAmount') ? Number(val('qrAmount')) : '';
    }
    if (val('qrPurpose') !== undefined) {
      qrState.vietqr.purpose = val('qrPurpose');
    }
    if (val('qrBankSelect') !== undefined) {
      qrState.vietqr.bankBin = val('qrBankSelect');
    }
  } else if (type === 'wifi') {
    if (val('qrWifiSsid') !== undefined) {
      qrState.wifi.ssid = val('qrWifiSsid').trim();
    }
    if (val('qrWifiPassword') !== undefined) {
      qrState.wifi.password = val('qrWifiPassword');
    }
    if (val('qrWifiSecurity') !== undefined) {
      qrState.wifi.security = val('qrWifiSecurity');
    }
    const hidEl = document.getElementById('qrWifiHidden');
    if (hidEl) {
      qrState.wifi.hidden = hidEl.checked;
    }
  } else if (type === 'vcard') {
    if (val('vcardFullName') !== undefined) {
      qrState.vcard.fullName = val('vcardFullName');
    }
    if (val('vcardPhone') !== undefined) {
      qrState.vcard.phone = val('vcardPhone').trim();
    }
    if (val('vcardEmail') !== undefined) {
      qrState.vcard.email = val('vcardEmail').trim();
    }
    if (val('vcardOrg') !== undefined) {
      qrState.vcard.organization = val('vcardOrg');
    }
    if (val('vcardTitle') !== undefined) {
      qrState.vcard.title = val('vcardTitle');
    }
    if (val('vcardWebsite') !== undefined) {
      qrState.vcard.website = val('vcardWebsite').trim();
    }
  } else if (type === 'text') {
    if (val('qrTextInput') !== undefined) {
      qrState.text.content = val('qrTextInput');
    }
  }
}

/**
 * Generates a static QR code using the backend API.
 * @param {() => void} [onReRender]
 */
export async function generateQrCode(onReRender) {
  // CRITICAL: Read all values from DOM BEFORE re-rendering to prevent inputs from disappearing
  syncStaticInputsFromDom();

  let payload;
  const type = qrState.activeTab;

  try {
    if (type === 'vietqr') {
      if (!qrState.vietqr.accountNumber) {
        throw new Error('Vui lòng nhập số tài khoản ngân hàng');
      }
      payload = {
        bankBin: qrState.vietqr.bankBin,
        accountNumber: qrState.vietqr.accountNumber,
        ...(qrState.vietqr.amount ? { amount: Number(qrState.vietqr.amount) } : {}),
        ...(qrState.vietqr.purpose ? { purpose: qrState.vietqr.purpose } : {})
      };
    } else if (type === 'wifi') {
      if (!qrState.wifi.ssid) {
        throw new Error('Vui lòng nhập tên mạng Wi-Fi');
      }
      payload = {
        ssid: qrState.wifi.ssid,
        password: qrState.wifi.password || '',
        security: qrState.wifi.security || 'WPA',
        hidden: !!qrState.wifi.hidden
      };
    } else if (type === 'vcard') {
      if (!qrState.vcard.fullName?.trim()) {
        throw new Error('Vui lòng nhập Họ & Tên cho danh bạ');
      }
      payload = {
        fullName: qrState.vcard.fullName.trim(),
        phone: qrState.vcard.phone || '',
        email: qrState.vcard.email || '',
        organization: qrState.vcard.organization || '',
        title: qrState.vcard.title || '',
        website: qrState.vcard.website || ''
      };
    } else if (type === 'text') {
      const content = (qrState.text.content || '').trim();
      if (!content) {
        throw new Error('Vui lòng nhập nội dung văn bản');
      }
      payload = content;
    }
  } catch (err) {
    qrState.error = err.message;
    showToast(qrState.error, 'error');
    if (onReRender) onReRender();
    return;
  }

  qrState.isGenerating = true;
  qrState.error = null;
  if (onReRender) onReRender();

  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/v1/qr/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        payload,
        format: qrState.format,
        margin: qrState.margin,
        errorCorrectionLevel: qrState.errorCorrectionLevel,
        colorDark: qrState.colorDark,
        colorLight: qrState.colorLight,
        width: qrState.width
      })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message || 'Không thể tạo mã QR');
    }
    qrState.generatedResult = json.data;

    let byteSize = 0;
    if (json.data.dataUrl) {
      const b64 = json.data.dataUrl.split(',')[1] || '';
      byteSize = Math.round(b64.length * 0.75);
    } else if (json.data.content) {
      byteSize = new Blob([json.data.content]).size;
    }

    const ext = qrState.format === 'svg' ? 'svg' : 'png';
    const hist = await storage.addHistoryItem({
      toolId: 'qr-multi',
      toolTitle: 'Tạo Mã QR',
      fileName: `${buildStaticQrHistoryName(type)}.${ext}`,
      resultSize: byteSize || 1200,
      mimeType: ext === 'svg' ? 'image/svg+xml' : 'image/png',
      category: 'image',
      downloadUrl: json.data.dataUrl || null
    });

    if (hist?.id) {
      qrState.staticHistoryId = hist.id;
    }
    persistQrState();
    showToast('Đã tạo mã QR', 'success');
  } catch (err) {
    qrState.error = err.message || 'Lỗi xử lý tạo mã QR';
    showToast(qrState.error, 'error');
  } finally {
    qrState.isGenerating = false;
    if (onReRender) onReRender();
  }
}

/**
 * Downloads the generated static QR code (PNG or SVG).
 */
export function downloadGeneratedQr() {
  if (!qrState.generatedResult) return;
  const { format, content, dataUrl } = qrState.generatedResult;
  const filename = `qrcode-${Date.now()}.${format}`;
  const url =
    format === 'svg'
      ? URL.createObjectURL(new Blob([content], { type: 'image/svg+xml;charset=utf-8' }))
      : dataUrl;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (format === 'svg') {
    URL.revokeObjectURL(url);
  }
  showToast(`Đã tải tệp ${format.toUpperCase()}!`, 'success');
}

/**
 * Decodes a QR image file via BarcodeDetector API or server-side sharp/jsQR.
 * @param {File} file - The image file to decode
 * @param {() => void} [onReRender]
 */
export async function processScanFile(file, onReRender) {
  qrState.scan.isScanning = true;
  qrState.scan.result = null;
  qrState.scan.error = null;
  if (onReRender) onReRender();

  try {
    let finalDecodedText = null;

    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const bitmap = await createImageBitmap(file);
        const codes = await detector.detect(bitmap);

        if (codes && codes.length > 0 && codes[0].rawValue) {
          const rawVal = codes[0].rawValue;
          // Check for CJK characters / Shift-JIS mojibake from Windows platform barcode engine
          const hasCjk = /[\u4e00-\u9fff\u3040-\u30ff]/.test(rawVal);
          if (!hasCjk) {
            finalDecodedText = rawVal;
            // Attempt Latin1 mojibake recovery if applicable
            if (/[\u00c0-\u00ff]/.test(rawVal)) {
              try {
                const recovered = decodeURIComponent(escape(rawVal));
                if (recovered) {
                  finalDecodedText = recovered;
                }
              } catch {
                // Ignore decoding error
              }
            }
          }
        }
      } catch {
        // Fallback to backend Sharp + jsQR
      }
    }

    if (!finalDecodedText) {
      const apiBase = getApiBase();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase}/api/v1/qr/decode`, {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Không thể tìm thấy hoặc đọc mã QR từ ảnh này');
      }

      finalDecodedText = json.data.text;
    }

    qrState.scan.result = finalDecodedText;
    let scanLabel = `[Quét QR] ${finalDecodedText.slice(0, 60).trim()}`;
    if (finalDecodedText.startsWith('http://') || finalDecodedText.startsWith('https://')) {
      scanLabel = `[Quét QR - Link] ${finalDecodedText.slice(0, 60).trim()}`;
    } else if (finalDecodedText.startsWith('WIFI:')) {
      const match = finalDecodedText.match(/S:([^;]+);/);
      scanLabel = `[Quét QR - Wi-Fi] ${match?.[1] ? `Mạng: ${match[1]}` : finalDecodedText.slice(0, 50)}`;
    }

    await storage.addHistoryItem({
      toolId: 'qr-scan',
      toolTitle: 'Quét Mã QR',
      fileName: scanLabel,
      downloadUrl: finalDecodedText.startsWith('http') ? finalDecodedText : null
    });

    persistQrState();
    showToast('Đã giải mã QR', 'success');
  } catch (err) {
    qrState.scan.error = err.message || 'Lỗi khi quét ảnh mã QR';
    showToast(qrState.scan.error, 'error');
  } finally {
    qrState.scan.isScanning = false;
    if (onReRender) onReRender();
  }
}
