const ICONS = {
    view: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    tab: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    download: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    restore: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    folder: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`,
    trashFolder: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    spin: `<svg class="icon-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    downloadCta: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    user: `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
};

function renderDownloaderPill(downloadedBy) {
    if (!downloadedBy) {
        return `<span class="meta-pill meta-user" title="Người tải: Hệ thống">${ICONS.user}<span>Hệ thống</span></span>`;
    }
    const name = downloadedBy.name || downloadedBy.ip || 'Hệ thống';
    const ip = downloadedBy.ip || '';
    const device = downloadedBy.device || '';
    let tooltip = `Người tải: ${name}`;
    if (ip) tooltip += ` • IP: ${ip}`;
    if (device) tooltip += ` • Thiết bị: ${device}`;

    return `
        <span class="meta-pill meta-user" title="${escapeHtml(tooltip)}">
            ${ICONS.user}<span>${escapeHtml(name)}</span>
        </span>
    `;
}

function showToast(msg, duration = 3200) {
    const toast = document.getElementById('pasteToast');
    const msgEl = document.getElementById('pasteToastMsg');
    if (toast && msgEl) {
        msgEl.textContent = msg;
        const isError = msg.includes('lỗi') || msg.includes('Lỗi') || msg.includes('không hợp lệ') || msg.includes('Thất bại') || msg.includes('sai');
        const isSuccess = msg.includes('thành công') || msg.includes('Đã dán') || msg.includes('Đã khôi phục') || msg.includes('Hoàn tất') || msg.includes('Đã dọn sạch');

        if (isError) {
            toast.style.borderColor = 'var(--danger-border)';
            toast.style.color = '#fca5a5';
        } else if (isSuccess) {
            toast.style.borderColor = 'var(--success-border)';
            toast.style.color = '#86efac';
        } else {
            toast.style.borderColor = 'var(--border-strong)';
            toast.style.color = 'var(--text-primary)';
        }
        toast.style.display = 'inline-flex';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.display = 'none'; }, duration);
    }
}

function playCompleteSound() {
    try {
        const audio = document.getElementById('notifySound') || new Audio('/static/complete.wav');
        audio.currentTime = 0;
        const p = audio.play();
        if (p && typeof p.then === 'function') {
            p.catch(e => console.log('Audio autoplay prevented or error:', e));
        }
    } catch (err) {
        console.log('Audio error:', err);
    }
}

const toggleBtn = document.getElementById('toggleCookieBtn');
const cookieSec = document.getElementById('cookieSection');
if (toggleBtn && cookieSec) {
    toggleBtn.addEventListener('click', () => {
        const isHidden = cookieSec.style.display === 'none';
        cookieSec.style.display = isHidden ? 'block' : 'none';
        toggleBtn.classList.toggle('active', isHidden);
    });
}

function isValidStudocuUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim();
    if (!/^https?:\/\//i.test(clean)) return false;
    try {
        const u = new URL(clean);
        const host = u.hostname.toLowerCase();
        const isStudocu = host === 'studocu.com' || host.endsWith('.studocu.com') ||
                          host === 'studocu.vn' || host.endsWith('.studocu.vn');
        return isStudocu && u.pathname.length > 1;
    } catch (_) {
        return false;
    }
}

const pasteBtn = document.getElementById('pasteBtn');
const urlInput = document.getElementById('url');

let thinkingOrbInstance = null;

function setDownloadingState(isDownloading) {
    const submitBtn = document.getElementById('submitBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    const pasteBtnIcon = document.getElementById('pasteBtnIcon');
    const pasteBtnTitle = document.getElementById('pasteBtnTitle');
    const pasteBtnBadge = document.getElementById('pasteBtnBadge');
    const cancelContainer = document.getElementById('cancelContainer');
    const urlInput = document.getElementById('url');

    if (submitBtn) {
        submitBtn.disabled = isDownloading;
    }
    if (urlInput) {
        urlInput.disabled = isDownloading;
    }
    if (cancelContainer) {
        cancelContainer.style.display = isDownloading ? 'block' : 'none';
    }

    if (pasteBtn) {
        pasteBtn.disabled = isDownloading;
        if (isDownloading) {
            pasteBtn.classList.add('btn-hero-downloading');
            if (pasteBtnBadge) pasteBtnBadge.style.display = 'none';
            if (pasteBtnIcon) {
                pasteBtnIcon.innerHTML = '<canvas id="thinkingOrbCanvas" width="22" height="22"></canvas>';
                const cvs = document.getElementById('thinkingOrbCanvas');
                if (window.ThinkingOrbs && cvs) {
                    if (thinkingOrbInstance) {
                        try { thinkingOrbInstance.stop(); } catch (_) {}
                    }
                    thinkingOrbInstance = window.ThinkingOrbs.createThinkingOrb(cvs, {
                        state: 'working',
                        size: 22,
                        isDark: true,
                        speed: 1.25
                    });
                } else {
                    pasteBtnIcon.innerHTML = ICONS.spin;
                }
            }
            if (pasteBtnTitle) pasteBtnTitle.textContent = 'Đang tải tài liệu...';
        } else {
            pasteBtn.classList.remove('btn-hero-downloading');
            if (pasteBtnBadge) pasteBtnBadge.style.display = '';
            if (thinkingOrbInstance) {
                try { thinkingOrbInstance.stop(); } catch (_) {}
                thinkingOrbInstance = null;
            }
            if (pasteBtnIcon) {
                pasteBtnIcon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1 2-2h2"/></svg>`;
            }
            if (pasteBtnTitle) pasteBtnTitle.textContent = 'Dán link & Tải ngay';
        }
    }
}

function handlePasteCandidate(rawText) {
    if (!rawText) return false;
    const submitBtn = document.getElementById('submitBtn');
    const pasteBtn = document.getElementById('pasteBtn');
    if (pasteBtn?.disabled || submitBtn?.disabled) {
        showToast('Tiến trình tải đang chạy. Vui lòng chờ hoàn tất trước khi dán liên kết mới.');
        return false;
    }
    const text = rawText.trim();
    if (!isValidStudocuUrl(text)) {
        showToast('Đường dẫn không hợp lệ. Vui lòng sao chép đúng liên kết Studocu.', 4000);
        const pasteBtnTitle = document.getElementById('pasteBtnTitle');
        if (pasteBtn && !pasteBtn.disabled && pasteBtnTitle) {
            const oldTitle = pasteBtnTitle.textContent;
            pasteBtnTitle.textContent = 'Liên kết không hợp lệ!';
            pasteBtn.style.borderColor = 'var(--danger-border)';
            setTimeout(() => {
                pasteBtnTitle.textContent = oldTitle;
                pasteBtn.style.borderColor = '';
            }, 2000);
        }
        return false;
    }

    if (urlInput) {
        urlInput.value = text;
    }
    const pasteBtnTitle = document.getElementById('pasteBtnTitle');
    const pasteBtnIcon = document.getElementById('pasteBtnIcon');
    if (pasteBtn && !pasteBtn.disabled && pasteBtnTitle) {
        if (pasteBtnIcon) pasteBtnIcon.innerHTML = ICONS.check;
        pasteBtnTitle.textContent = 'Đã nhận liên kết!';
    }
    showToast('Đã nhận liên kết. Đang tự động bắt đầu tải...');

    const downloadForm = document.getElementById('downloadForm');
    const submitBtnEl = document.getElementById('submitBtn');
    if (downloadForm) {
        setTimeout(() => {
            if (submitBtnEl && !submitBtnEl.disabled) {
                if (typeof downloadForm.requestSubmit === 'function') {
                    downloadForm.requestSubmit();
                } else {
                    submitBtnEl.click();
                }
            }
        }, 200);
    }
    return true;
}

if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
        if (pasteBtn.disabled) return;

        // Thử đọc trực tiếp từ Clipboard API
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    handlePasteCandidate(text);
                    return;
                } else {
                    showToast('Bộ nhớ tạm rỗng. Vui lòng sao chép liên kết Studocu trước.', 3000);
                    return;
                }
            } catch (err) {
                console.log('Clipboard read error or not permitted:', err);
                showToast('Nhấn phím Ctrl + V bất kỳ đâu trên trang để dán liên kết tải ngay', 3500);
                return;
            }
        }

        showToast('Nhấn phím Ctrl + V để dán liên kết Studocu', 3500);
    });

    document.addEventListener('paste', (e) => {
        if (e.target && (e.target.id === 'cookie' || e.target.tagName === 'TEXTAREA')) return;
        const submitBtnEl = document.getElementById('submitBtn');
        if (pasteBtn?.disabled || submitBtnEl?.disabled) {
            showToast('Tiến trình tải đang chạy. Vui lòng chờ hoàn tất trước khi dán liên kết mới.');
            return;
        }
        const text = (e.clipboardData || window.clipboardData)?.getData('text');
        if (text && text.trim()) {
            const ok = handlePasteCandidate(text);
            if (ok) {
                e.preventDefault();
            }
        }
    });
}

let currentJobId = null;
let pollInterval = null;
let jobStartTime = null;

function openPdfModal(docId, docName) {
    let id = docId;
    let name = '';
    if (docName) {
        try { name = decodeURIComponent(docName); } catch (e) { name = docName; }
    }
    if (!name && id) {
        name = decodeURIComponent(id || '');
        if (name.startsWith('/view/') || name.startsWith('/downloads/')) {
            name = name.replace('/view/', '').replace('/downloads/', '').split('?')[0];
            name = decodeURIComponent(name);
        } else if (name.includes('?file=')) {
            name = decodeURIComponent(name.split('?file=')[1].split('&')[0]);
        } else if (name.includes('?id=')) {
            id = name.split('?id=')[1].split('&')[0];
        }
    }
    if (!name) name = id || 'Tài liệu';

    document.getElementById('modalTitle').textContent = name;
    document.getElementById('modalTitle').title = name;
    const streamUrl = id ? ('/api/document-stream?id=' + encodeURIComponent(id)) : ('/api/document-stream?file=' + encodeURIComponent(name));
    const viewerUrl = '/pdfjs/web/viewer.html?file=' + encodeURIComponent(streamUrl);
    document.getElementById('modalOpenTab').href = viewerUrl;
    document.getElementById('modalDlBtn').href = '/downloads/' + encodeURIComponent(name);
    document.getElementById('modalPdfFrame').src = viewerUrl;
    document.getElementById('pdfModal').style.display = 'flex';
}

function closePdfModal() {
    document.getElementById('pdfModal').style.display = 'none';
    document.getElementById('modalPdfFrame').src = 'about:blank';
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('pdfModal').style.display === 'flex') {
        if (e.key === 'Escape') closePdfModal();
    }
});

document.getElementById('downloadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    setDownloadingState(true);

    let rawCookie = document.getElementById('cookie').value.trim();
    if (rawCookie && !rawCookie.includes('cf_clearance') && !rawCookie.includes('studocu_session') && !rawCookie.includes('studocu=') && !rawCookie.includes('laravel_session=')) {
        rawCookie = null;
    }

    const payload = {
        url: document.getElementById('url').value.trim(),
        format: 'pdf',
        timeout: 60,
        cookie: rawCookie || null
    };

    try {
        const resp = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await resp.json();
        if (data.job_id) {
            startTrackingJob(data.job_id);
        } else {
            showToast('Lỗi khởi tạo job: ' + (data.error || 'Không xác định'), 4000);
            setDownloadingState(false);
        }
    } catch (err) {
        showToast('Lỗi kết nối máy chủ: ' + err.message, 4000);
        setDownloadingState(false);
    }
});

let LAST_RAW_LOGS = [];

function copyTerminalLogs() {
    if (!LAST_RAW_LOGS || LAST_RAW_LOGS.length === 0) {
        showToast('Chưa có nội dung log để sao chép.');
        return;
    }
    const fullText = LAST_RAW_LOGS.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullText).then(() => {
            const btnText = document.getElementById('copyLogsText');
            if (btnText) {
                const old = btnText.textContent;
                btnText.textContent = 'Đã chép!';
                setTimeout(() => { btnText.textContent = old; }, 1800);
            }
            showToast('Đã sao chép toàn bộ nhật ký tải vào bộ nhớ tạm.');
        }).catch(() => {
            showToast('Không thể sao chép tự động.');
        });
    } else {
        showToast('Trình duyệt không hỗ trợ sao chép tự động.');
    }
}

function parseLogType(text) {
    if (text.includes('✅') || text.includes('Tải thành công') || text.includes('Hoàn tất')) {
        return { type: 'success', icon: '✓' };
    }
    if (text.includes('❌') || text.includes('THẤT BẠI') || text.includes('LỖI') || text.includes('Error')) {
        return { type: 'error', icon: '✕' };
    }
    if (text.includes('⚠️') || text.includes('Cảnh báo') || text.includes('giới hạn') || text.includes('hàng đợi')) {
        return { type: 'warn', icon: '!' };
    }
    if (text.includes('🔄') || text.includes('thu thập') || text.includes('Trang ') || text.includes('Ghép nối') || text.includes('In ấn') || text.includes('kết xuất') || text.includes('Đang xuất') || text.includes('gộp phân đoạn')) {
        return { type: 'progress', icon: '↻' };
    }
    if (text.includes('⚡') || text.includes('🚀') || text.includes('Nhận diện') || text.includes('CACHE') || text.includes('giải phóng') || text.includes('đóng Tab')) {
        return { type: 'accent', icon: '⚡' };
    }
    if (text.includes('🍪') || text.includes('Cookie')) {
        return { type: 'accent', icon: '⚿' };
    }
    return { type: 'normal', icon: '›' };
}

function renderLogs(logs) {
    if (!logs || logs.length === 0) return '';
    const emojiRegex = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;
    const maxVisible = 80;
    const startIndex = Math.max(0, logs.length - maxVisible);
    const visibleLogs = logs.slice(startIndex);

    let html = '';
    if (startIndex > 0) {
        html += `
            <div class="log-line log-normal" style="opacity:0.45;font-style:italic;">
                <span class="log-num">..</span>
                <span class="log-badge-icon">…</span>
                <span class="log-text">[Đã thu gọn ${startIndex} dòng nhật ký trước đó để tối ưu trải nghiệm thiết bị]</span>
            </div>
        `;
    }

    html += visibleLogs.map((raw, relativeIdx) => {
        const idx = startIndex + relativeIdx;
        const isLast = (idx === logs.length - 1);
        const { type, icon } = parseLogType(raw);
        let clean = raw.replace(emojiRegex, '').trim();
        if (!clean) clean = raw.trim();

        const num = String(idx + 1).padStart(2, '0');
        const activeClass = isLast ? ' log-active' : '';
        return `
            <div class="log-line log-${type}${activeClass}">
                <span class="log-num">${num}</span>
                <span class="log-badge-icon">${icon}</span>
                <span class="log-text">${escapeHtml(clean)}</span>
            </div>
        `;
    }).join('');
    return html;
}

function updateProgressBar(logs, status, elapsed) {
    const fillEl = document.getElementById('progressBarFill');
    const stepLabel = document.getElementById('progressStepLabel');
    const pctLabel = document.getElementById('progressPercentLabel');
    if (!fillEl || !stepLabel || !pctLabel) return;

    if (status === 'completed') {
        fillEl.style.width = '100%';
        fillEl.classList.add('completed');
        fillEl.classList.remove('failed');
        stepLabel.textContent = 'Hoàn tất xuất bản tài liệu A4!';
        pctLabel.textContent = '100%';
        return;
    }
    if (status === 'failed') {
        fillEl.classList.add('failed');
        fillEl.classList.remove('completed');
        stepLabel.textContent = 'Tiến trình dừng do có lỗi xảy ra.';
        return;
    }

    let percent = Math.min(25, 6 + Math.floor(elapsed * 2));
    let label = 'Đang kết nối phiên tải trên máy chủ...';

    if (logs && logs.length > 0) {
        for (let i = logs.length - 1; i >= 0; i--) {
            const line = logs[i];
            const chunkMatch = line.match(/Trang\s+\d+\s*-\s*(\d+)\s*\/\s*(\d+)/i);
            if (chunkMatch) {
                const cur = parseInt(chunkMatch[1], 10);
                const tot = parseInt(chunkMatch[2], 10);
                if (tot > 0) {
                    const ratio = cur / tot;
                    percent = Math.min(92, Math.max(25, Math.round(25 + ratio * 65)));
                    label = `Đang thu thập nội dung: Trang ${cur}/${tot}`;
                    break;
                }
            }
            if (line.includes('Nhận diện tài liệu')) {
                percent = Math.max(percent, 20);
                label = 'Đã nhận diện cấu trúc tài liệu...';
                break;
            }
            if (line.includes('Trạng thái trang')) {
                percent = Math.max(percent, 15);
                label = 'Đang tải trang tài liệu...';
                break;
            }
            if (line.includes('Đang mở Tab')) {
                percent = Math.max(percent, 10);
                label = 'Đang mở phiên trình duyệt độc lập...';
                break;
            }
            if (line.includes('LOCAL CACHE HIT')) {
                percent = 95;
                label = 'Khôi phục từ bộ nhớ đệm máy chủ...';
                break;
            }
        }
    }

    fillEl.style.width = `${percent}%`;
    stepLabel.textContent = label;
    pctLabel.textContent = `${percent}%`;
}

function startTrackingJob(jobId, initialStartTime = null, initialLogs = null) {
    currentJobId = jobId;
    jobStartTime = initialStartTime || Date.now();
    LAST_RAW_LOGS = initialLogs || ['⚡ Khởi chạy kết nối tới trình duyệt trên máy chủ...'];

    try {
        localStorage.setItem('studocu_active_job', JSON.stringify({
            jobId: jobId,
            startTime: jobStartTime,
            url: document.getElementById('url')?.value.trim() || ''
        }));
    } catch (_) {}

    document.getElementById('progressCard').style.display = 'block';
    document.getElementById('jobDownloads').style.display = 'none';
    document.getElementById('jobDownloads').innerHTML = '';

    const badge = document.getElementById('jobBadge');
    badge.className = 'badge-status badge-running';
    badge.textContent = 'ĐANG CHẠY';

    const indicator = document.querySelector('#progressCard .status-indicator');
    if (indicator) indicator.className = 'status-indicator running';

    const fillEl = document.getElementById('progressBarFill');
    if (fillEl) {
        fillEl.style.width = '6%';
        fillEl.classList.remove('completed', 'failed');
    }
    const stepLabel = document.getElementById('progressStepLabel');
    if (stepLabel) stepLabel.textContent = 'Khởi chạy kết nối tới trình duyệt trên máy chủ...';
    const pctLabel = document.getElementById('progressPercentLabel');
    if (pctLabel) pctLabel.textContent = '6%';

    const terminal = document.getElementById('terminalLog');
    terminal.innerHTML = renderLogs(LAST_RAW_LOGS);
    terminal.scrollTop = terminal.scrollHeight;

    const elapsed = Math.round((Date.now() - jobStartTime) / 1000);
    const timerEl = document.getElementById('jobTimer');
    if (timerEl) timerEl.textContent = `${elapsed}s`;

    if (initialLogs && initialLogs.length > 0) {
        updateProgressBar(initialLogs, 'running', elapsed);
    }

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(pollJobStatus, 1200);
}

async function pollJobStatus() {
    if (!currentJobId) return;
    const elapsed = Math.round((Date.now() - jobStartTime) / 1000);
    document.getElementById('jobTimer').textContent = `${elapsed}s`;

    try {
        const resp = await fetch(`/api/status/${currentJobId}`);
        if (!resp.ok) {
            clearInterval(pollInterval);
            setDownloadingState(false);
            try { localStorage.removeItem('studocu_active_job'); } catch (_) {}
            return;
        }
        const data = await resp.json();
        if (data.error) {
            clearInterval(pollInterval);
            setDownloadingState(false);
            try { localStorage.removeItem('studocu_active_job'); } catch (_) {}
            return;
        }

        const newLogs = data.logs || [];
        const logsChanged = newLogs.length !== LAST_RAW_LOGS.length ||
            (newLogs.length > 0 && newLogs[newLogs.length - 1] !== LAST_RAW_LOGS[LAST_RAW_LOGS.length - 1]);

        LAST_RAW_LOGS = newLogs;
        const terminal = document.getElementById('terminalLog');
        if (terminal && newLogs.length > 0 && logsChanged) {
            terminal.innerHTML = renderLogs(newLogs);
            terminal.scrollTop = terminal.scrollHeight;
        }

        updateProgressBar(data.logs, data.status, elapsed);

        const badge = document.getElementById('jobBadge');
        const indicator = document.querySelector('#progressCard .status-indicator');

        if (data.status === 'queued') {
            badge.className = 'badge-status badge-queued';
            badge.textContent = 'XẾP HÀNG';
            if (indicator) indicator.className = 'status-indicator running';
        } else if (data.status === 'running') {
            badge.className = 'badge-status badge-running';
            badge.textContent = 'ĐANG CHẠY';
            if (indicator) indicator.className = 'status-indicator running';
        }

        if (data.status === 'completed') {
            clearInterval(pollInterval);
            try { localStorage.removeItem('studocu_active_job'); } catch (_) {}
            playCompleteSound();
            setDownloadingState(false);

            const urlInput = document.getElementById('url');
            if (urlInput) {
                urlInput.value = '';
                urlInput.focus();
            }

            badge.className = 'badge-status badge-completed';
            badge.textContent = data.from_cache ? 'BỘ NHỚ ĐỆM' : 'HOÀN TẤT';
            if (indicator) indicator.className = 'status-indicator completed';

            const dlContainer = document.getElementById('jobDownloads');
            dlContainer.style.display = 'flex';
            let dlHtml = '';
            if (data.result?.pdf) {
                const pdfName = data.result.pdf.name || data.result.title || 'Tai_lieu.pdf';
                const pdfId = data.result.pdf.id || '';
                const streamUrl = data.result.pdf.stream_url || (pdfId ? ('/api/document-stream?id=' + encodeURIComponent(pdfId)) : ('/api/document-stream?file=' + encodeURIComponent(pdfName)));
                const viewerUrl = data.result.pdf.viewer_url || ('/pdfjs/web/viewer.html?file=' + encodeURIComponent(streamUrl));
                const elapsedDisplay = data.result?.elapsed_sec ? (data.result.elapsed_sec + 's') : (Math.round((Date.now() - jobStartTime) / 1000) + 's');
                const sizeDisplay = (data.result.pdf.size_mb !== undefined && data.result.pdf.size_mb !== null) ? `${data.result.pdf.size_mb} MB` : 'Đã lưu';
                const userDisplay = data.downloaded_by?.name || 'Bạn';
                dlHtml += `
                    <div style="width: 100%; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 8px;">
                        Người tải: <b style="color: #93c5fd;">${escapeHtml(userDisplay)}</b> • Thời gian: <b style="color: var(--text-primary);">${elapsedDisplay}</b> • Dung lượng: <b style="color: var(--text-primary);">${sizeDisplay}</b> • Số trang: <b style="color: var(--text-primary);">${data.result.pdf.pages || 'N/A'} trang</b>
                    </div>
                    <button type="button" onclick="openPdfModal('${pdfId}', '${encodeURIComponent(pdfName)}')" class="btn-action btn-view" style="padding: 7px 12px;">
                        ${ICONS.view}<span>Xem trực tiếp</span>
                    </button>
                    <a href="${viewerUrl}" target="_blank" class="btn-action" style="padding: 7px 12px;" title="Mở trong tab mới">
                        ${ICONS.tab}<span>Mở tab mới</span>
                    </a>
                    <a href="${data.result.pdf.download_url}" class="btn-action btn-dl" style="padding: 7px 12px;" download>
                        ${ICONS.download}<span>Tải PDF (${sizeDisplay})</span>
                    </a>
                `;
            }
            if (data.result?.md) {
                const mdViewUrl = data.result.md.view_url || data.result.md.download_url.replace('/downloads/', '/view/');
                dlHtml += `
                    <a href="${mdViewUrl}" target="_blank" class="btn-action" style="padding: 7px 12px;">
                        ${ICONS.view}<span>Xem MD</span>
                    </a>
                    <a href="${data.result.md.download_url}" class="btn-action" style="padding: 7px 12px;" download>
                        ${ICONS.download}<span>Tải Markdown (${data.result.md.size_kb} KB)</span>
                    </a>
                `;
            }
            dlContainer.innerHTML = dlHtml;
            loadFiles();
        } else if (data.status === 'cancelled') {
            clearInterval(pollInterval);
            pollInterval = null;
            currentJobId = null;
            try { localStorage.removeItem('studocu_active_job'); } catch (_) {}
            setDownloadingState(false);

            const badge = document.getElementById('jobBadge');
            if (badge) {
                badge.className = 'badge-status badge-failed';
                badge.textContent = 'ĐÃ HỦY';
            }
            if (indicator) indicator.className = 'status-indicator failed';

            showToast('Tiến trình tải đã bị hủy.');
            loadFiles();
        } else if (data.status === 'failed') {
            clearInterval(pollInterval);
            try { localStorage.removeItem('studocu_active_job'); } catch (_) {}
            setDownloadingState(false);

            const badge = document.getElementById('jobBadge');
            badge.className = 'badge-status badge-failed';
            badge.textContent = 'THẤT BẠI';
            if (indicator) indicator.className = 'status-indicator failed';

            loadFiles();
        }
    } catch (e) {
        console.error('Lỗi kiểm tra tiến độ:', e);
    }
}

async function cancelCurrentJob() {
    const cancelBtn = document.getElementById('cancelBtn');
    const terminalCancelBtn = document.getElementById('terminalCancelBtn');
    if (cancelBtn) cancelBtn.disabled = true;
    if (terminalCancelBtn) terminalCancelBtn.disabled = true;

    const jobIdToCancel = currentJobId;
    if (jobIdToCancel) {
        try {
            await fetch(`/api/cancel/${encodeURIComponent(jobIdToCancel)}`, { method: 'POST' });
        } catch (err) {
            console.log('Lỗi gửi yêu cầu hủy lên máy chủ:', err);
        }
    }

    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    currentJobId = null;
    try { localStorage.removeItem('studocu_active_job'); } catch (_) {}

    // Ẩn bảng tiến trình terminal / tab
    const progressCard = document.getElementById('progressCard');
    if (progressCard) {
        progressCard.style.display = 'none';
    }

    setDownloadingState(false);
    if (cancelBtn) cancelBtn.disabled = false;
    if (terminalCancelBtn) terminalCancelBtn.disabled = false;

    showToast('Đã đóng tab và ngắt toàn bộ tiến trình tải.');
}
window.cancelCurrentJob = cancelCurrentJob;

async function restoreActiveJobState() {
    try {
        const raw = localStorage.getItem('studocu_active_job');
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved || !saved.jobId) {
            localStorage.removeItem('studocu_active_job');
            return;
        }

        // Bỏ qua nếu job đã tạo quá 1 tiếng trước
        if (saved.startTime && (Date.now() - saved.startTime > 3600 * 1000)) {
            localStorage.removeItem('studocu_active_job');
            return;
        }

        const resp = await fetch(`/api/status/${saved.jobId}`);
        if (!resp.ok) {
            localStorage.removeItem('studocu_active_job');
            return;
        }
        const data = await resp.json();
        if (data.error) {
            localStorage.removeItem('studocu_active_job');
            return;
        }

        if (data.status === 'running' || data.status === 'queued') {
            const urlInput = document.getElementById('url');
            if (urlInput && saved.url && !urlInput.value) {
                urlInput.value = saved.url;
            }
            setDownloadingState(true);
            startTrackingJob(saved.jobId, saved.startTime, data.logs);
        } else if (data.status === 'completed') {
            // Tác vụ đã hoàn tất trong lúc reload
            const urlInput = document.getElementById('url');
            if (urlInput && saved.url && !urlInput.value) {
                urlInput.value = saved.url;
            }
            startTrackingJob(saved.jobId, saved.startTime, data.logs);
            pollJobStatus();
        } else {
            localStorage.removeItem('studocu_active_job');
        }
    } catch (err) {
        console.log('Không thể khôi phục trạng thái tiến trình tải:', err);
    }
}

function formatFileTime(mtime, fallback) {
    if (!mtime) return fallback || '';
    const d = new Date(mtime * 1000);
    if (isNaN(d.getTime())) return fallback || '';
    const pad = n => String(n).padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

let ALL_FILES = [];
let TRASH_FILES = [];
let CURRENT_FILTER = 'all'; // 'all' | 'pdf' | 'md' | 'trash'
let CURRENT_SEARCH = '';
let CURRENT_SORT = 'newest';

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    if (mb < 1024) return mb.toFixed(2) + ' MB';
    const gb = mb / 1024;
    return gb.toFixed(2) + ' GB';
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

function highlightMatch(text, query) {
    if (!query || !query.trim()) return escapeHtml(text);
    const q = query.trim();
    const lowerText = (text || '').toLowerCase();
    const lowerQ = q.toLowerCase();
    let result = '';
    let start = 0;
    let idx = lowerText.indexOf(lowerQ, start);

    while (idx !== -1) {
        result += escapeHtml(text.slice(start, idx));
        result += '<mark class="search-highlight">' + escapeHtml(text.slice(idx, idx + q.length)) + '</mark>';
        start = idx + q.length;
        idx = lowerText.indexOf(lowerQ, start);
    }
    result += escapeHtml(text.slice(start));
    return result;
}

async function loadFiles() {
    const listEl = document.getElementById('fileList');
    try {
        const [filesResp, trashResp] = await Promise.all([
            fetch('/api/files'),
            fetch('/api/trash')
        ]);
        ALL_FILES = await filesResp.json();
        TRASH_FILES = await trashResp.json();
        updateFileStats();
        renderFileList();
    } catch (err) {
        if (listEl) listEl.innerHTML = `<p style="color:var(--danger); font-size:0.84rem;">Không tải được danh sách: ${escapeHtml(err.message)}</p>`;
    }
}

async function refreshFiles() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('spinning');
    await loadFiles();
    setTimeout(() => {
        if (btn) btn.classList.remove('spinning');
    }, 500);
    showToast('Đã cập nhật danh sách tài liệu.');
}

function updateFileStats() {
    const totalCount = ALL_FILES.length;
    const pdfCount = ALL_FILES.filter(f => f.is_pdf).length;
    const mdCount = ALL_FILES.filter(f => !f.is_pdf).length;
    const trashCount = TRASH_FILES.length;
    const totalBytes = ALL_FILES.reduce((acc, f) => acc + (f.size_bytes || 0), 0);

    const badge = document.getElementById('fileStatsBadge');
    if (badge) {
        if (CURRENT_FILTER === 'trash') {
            const trashBytes = TRASH_FILES.reduce((acc, f) => acc + (f.size_bytes || 0), 0);
            badge.textContent = `${trashCount} tệp trong thùng rác • ${formatBytes(trashBytes)}`;
        } else {
            badge.textContent = `${totalCount} tài liệu • ${formatBytes(totalBytes)}`;
        }
    }

    const countAll = document.getElementById('countAll');
    const countPdf = document.getElementById('countPdf');
    const countMd = document.getElementById('countMd');
    const countTrash = document.getElementById('countTrash');
    if (countAll) countAll.textContent = totalCount;
    if (countPdf) countPdf.textContent = pdfCount;
    if (countMd) countMd.textContent = mdCount;
    if (countTrash) countTrash.textContent = trashCount;

    const emptyBtn = document.getElementById('emptyTrashBtn');
    if (emptyBtn) {
        emptyBtn.style.display = (CURRENT_FILTER === 'trash' && trashCount > 0) ? 'inline-flex' : 'none';
    }

    const titleIcon = document.getElementById('fileSectionIcon');
    const titleText = document.getElementById('fileSectionTitleText');
    if (titleIcon && titleText) {
        if (CURRENT_FILTER === 'trash') {
            titleIcon.innerHTML = ICONS.trashFolder;
            titleText.textContent = 'Thùng rác';
        } else {
            titleIcon.innerHTML = ICONS.folder;
            titleText.textContent = 'Tài liệu đã tải';
        }
    }
}

function setFileFilter(filter) {
    CURRENT_FILTER = filter;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        if (tab.getAttribute('data-filter') === filter) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    updateFileStats();
    renderFileList();
}

function onFileSearch(query) {
    CURRENT_SEARCH = query;
    const clearBtn = document.getElementById('fileSearchClear');
    if (clearBtn) {
        clearBtn.style.display = query.trim().length > 0 ? 'block' : 'none';
    }
    renderFileList();
}

function clearFileSearch() {
    const input = document.getElementById('fileSearchInput');
    if (input) input.value = '';
    onFileSearch('');
    if (input) input.focus();
}

function onFileSortChange(sortVal) {
    CURRENT_SORT = sortVal;
    renderFileList();
}

function resetFileFilters() {
    setFileFilter('all');
    clearFileSearch();
    const sortEl = document.getElementById('fileSortSelect');
    if (sortEl) {
        sortEl.value = 'newest';
        CURRENT_SORT = 'newest';
    }
}

function renderFileList() {
    const listEl = document.getElementById('fileList');
    if (!listEl) return;

    if (CURRENT_FILTER === 'trash') {
        if (TRASH_FILES.length === 0) {
            listEl.innerHTML = `
                <div class="file-empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </div>
                    <div class="empty-title">Thùng rác trống</div>
                    <div class="empty-subtitle">Không có tài liệu nào trong thùng rác. Các tệp đã xóa tạm thời sẽ hiển thị ở đây.</div>
                </div>
            `;
            return;
        }

        let filtered = TRASH_FILES.slice();
        const query = CURRENT_SEARCH.trim().toLowerCase();
        if (query) {
            filtered = filtered.filter(f => (f.name || '').toLowerCase().includes(query));
        }

        if (filtered.length === 0) {
            listEl.innerHTML = `
                <div class="file-empty-state">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </div>
                    <div class="empty-title">Không tìm thấy tài liệu phù hợp</div>
                    <div class="empty-subtitle">Không có tệp nào trong thùng rác khớp với từ khóa "<b>${escapeHtml(CURRENT_SEARCH)}</b>".</div>
                    <button type="button" class="btn-reset-filter" onclick="clearFileSearch()">Xóa tìm kiếm</button>
                </div>
            `;
            return;
        }

        filtered.sort((a, b) => {
            switch (CURRENT_SORT) {
                case 'oldest':
                    return (a.mtime || 0) - (b.mtime || 0);
                case 'name_asc':
                    return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true, sensitivity: 'base' });
                case 'name_desc':
                    return (b.name || '').localeCompare(a.name || '', 'vi', { numeric: true, sensitivity: 'base' });
                case 'size_desc':
                    return (b.size_bytes || 0) - (a.size_bytes || 0);
                case 'size_asc':
                    return (a.size_bytes || 0) - (b.size_bytes || 0);
                case 'newest':
                default:
                    return (b.mtime || 0) - (a.mtime || 0);
            }
        });

        listEl.innerHTML = filtered.map(f => {
            const timeStr = formatFileTime(f.mtime, f.time);
            const highlightedName = highlightMatch(f.name, CURRENT_SEARCH);
            const sizeDisplay = f.size || formatBytes(f.size_bytes);
            const badgeType = f.is_pdf ? 'badge-type-pdf' : 'badge-type-md';
            const typeLabel = f.is_pdf ? 'PDF' : 'MD';

            return `
            <div class="file-item" style="opacity: 0.92;">
                <div class="file-item-left">
                    <div class="file-type-badge ${badgeType}">${typeLabel}</div>
                    <div class="file-info">
                        <span class="file-name" title="${escapeHtml(f.name)}">${highlightedName}</span>
                        <div class="file-meta-row">
                            <span class="meta-pill">${sizeDisplay}</span>
                            <span class="meta-pill">${timeStr}</span>
                            ${renderDownloaderPill(f.downloaded_by)}
                            <span class="meta-pill" style="color: #fca5a5; border-color: rgba(244, 63, 94, 0.25);">Trong Thùng rác</span>
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button type="button" onclick="restoreTrashFile('${encodeURIComponent(f.name)}')" class="btn-action btn-restore" title="Khôi phục tài liệu">
                        ${ICONS.restore}<span>Khôi phục</span>
                    </button>
                    <button type="button" class="btn-action btn-del-perm" onclick="deletePermanentFile('${encodeURIComponent(f.name)}')" title="Xóa vĩnh viễn khỏi hệ thống">
                        ${ICONS.close}
                    </button>
                </div>
            </div>`;
        }).join('');
        return;
    }

    if (ALL_FILES.length === 0) {
        listEl.innerHTML = `
            <div class="file-empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                </div>
                <div class="empty-title">Chưa có tài liệu nào trên máy chủ</div>
                <div class="empty-subtitle">Dán liên kết Studocu ở trên và nhấn "Bắt đầu tải tài liệu" để xuất tài liệu đầu tiên.</div>
            </div>
        `;
        return;
    }

    let filtered = ALL_FILES.slice();
    if (CURRENT_FILTER === 'pdf') {
        filtered = filtered.filter(f => f.is_pdf);
    } else if (CURRENT_FILTER === 'md') {
        filtered = filtered.filter(f => !f.is_pdf);
    }

    const query = CURRENT_SEARCH.trim().toLowerCase();
    if (query) {
        filtered = filtered.filter(f => (f.name || '').toLowerCase().includes(query));
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div class="file-empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div class="empty-title">Không tìm thấy tài liệu phù hợp</div>
                <div class="empty-subtitle">Không có tài liệu nào khớp với từ khóa "<b>${escapeHtml(CURRENT_SEARCH)}</b>".</div>
                <button type="button" class="btn-reset-filter" onclick="resetFileFilters()">Xóa bộ lọc</button>
            </div>
        `;
        return;
    }

    filtered.sort((a, b) => {
        switch (CURRENT_SORT) {
            case 'oldest':
                return (a.mtime || 0) - (b.mtime || 0);
            case 'name_asc':
                return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true, sensitivity: 'base' });
            case 'name_desc':
                return (b.name || '').localeCompare(a.name || '', 'vi', { numeric: true, sensitivity: 'base' });
            case 'size_desc':
                return (b.size_bytes || 0) - (a.size_bytes || 0);
            case 'size_asc':
                return (a.size_bytes || 0) - (b.size_bytes || 0);
            case 'newest':
            default:
                return (b.mtime || 0) - (a.mtime || 0);
        }
    });

    listEl.innerHTML = filtered.map(f => {
        const timeStr = formatFileTime(f.mtime, f.time);
        const streamUrl = f.stream_url || (f.id ? ('/api/document-stream?id=' + encodeURIComponent(f.id)) : ('/api/document-stream?file=' + encodeURIComponent(f.name)));
        const viewerUrl = f.viewer_url || ('/pdfjs/web/viewer.html?file=' + encodeURIComponent(streamUrl));
        const highlightedName = highlightMatch(f.name, CURRENT_SEARCH);
        const sizeDisplay = f.size || formatBytes(f.size_bytes);

        if (f.is_pdf) {
            return `
            <div class="file-item">
                <div class="file-item-left">
                    <div class="file-type-badge badge-type-pdf">PDF</div>
                    <div class="file-info">
                        <span class="file-name" title="${escapeHtml(f.name)}" onclick="openPdfModal('${f.id || ''}', '${encodeURIComponent(f.name)}')">${highlightedName}</span>
                        <div class="file-meta-row">
                            <span class="meta-pill">${sizeDisplay}</span>
                            <span class="meta-pill">${timeStr}</span>
                            ${renderDownloaderPill(f.downloaded_by)}
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <button type="button" onclick="openPdfModal('${f.id || ''}', '${encodeURIComponent(f.name)}')" class="btn-action btn-view" title="Xem trước tài liệu">
                        ${ICONS.view}<span>Xem</span>
                    </button>
                    <a href="${viewerUrl}" target="_blank" class="btn-action btn-tab" title="Mở trong tab riêng toàn màn hình">
                        ${ICONS.tab}<span>Tab</span>
                    </a>
                    <a href="${f.url}" class="btn-action btn-dl" download title="Tải về máy tính">
                        ${ICONS.download}<span>Tải</span>
                    </a>
                    <button type="button" class="btn-action btn-del" onclick="deleteFile('${encodeURIComponent(f.name)}')" title="Chuyển vào Thùng rác">
                        ${ICONS.trash}
                    </button>
                </div>
            </div>`;
        } else {
            return `
            <div class="file-item">
                <div class="file-item-left">
                    <div class="file-type-badge badge-type-md">MD</div>
                    <div class="file-info">
                        <a href="${f.view_url}" target="_blank" style="text-decoration:none;" class="file-name" title="${escapeHtml(f.name)}">${highlightedName}</a>
                        <div class="file-meta-row">
                            <span class="meta-pill">${sizeDisplay}</span>
                            <span class="meta-pill">${timeStr}</span>
                            ${renderDownloaderPill(f.downloaded_by)}
                        </div>
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${f.view_url}" target="_blank" class="btn-action btn-view" title="Xem nội dung Markdown">
                        ${ICONS.view}<span>Xem</span>
                    </a>
                    <a href="${f.url}" class="btn-action btn-dl" download title="Tải về máy tính">
                        ${ICONS.download}<span>Tải</span>
                    </a>
                    <button type="button" class="btn-action btn-del" onclick="deleteFile('${encodeURIComponent(f.name)}')" title="Chuyển vào Thùng rác">
                        ${ICONS.trash}
                    </button>
                </div>
            </div>`;
        }
    }).join('');
}

async function deleteFile(encodedName) {
    let decodedName = encodedName;
    try { decodedName = decodeURIComponent(encodedName); } catch (_) {}
    try {
        const res = await fetch(`/api/files/${encodedName}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) {
            showToast(`Đã chuyển "${decodedName}" vào Thùng rác.`);
            await loadFiles();
        } else {
            showToast(`Không thể chuyển tệp vào thùng rác: ${d.error || 'Lỗi không xác định'}`);
        }
    } catch (e) {
        showToast('Lỗi thao tác xóa: ' + e.message);
    }
}

async function restoreTrashFile(encodedName) {
    let decodedName = encodedName;
    try { decodedName = decodeURIComponent(encodedName); } catch (_) {}
    try {
        const res = await fetch(`/api/trash/restore/${encodedName}`, { method: 'POST' });
        const d = await res.json();
        if (d.success) {
            showToast(`Đã khôi phục tệp "${decodedName}".`);
            await loadFiles();
        } else {
            showToast(`Không thể khôi phục tệp: ${d.error || 'Lỗi không xác định'}`);
        }
    } catch (e) {
        showToast('Lỗi khôi phục: ' + e.message);
    }
}

async function deletePermanentFile(encodedName) {
    let decodedName = encodedName;
    try { decodedName = decodeURIComponent(encodedName); } catch (_) {}
    if (!confirm(`Xác nhận xóa vĩnh viễn tệp "${decodedName}" khỏi máy chủ?\nThao tác này không thể hoàn tác.`)) return;
    try {
        const res = await fetch(`/api/trash/${encodedName}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) {
            showToast(`Đã xóa vĩnh viễn tệp "${decodedName}".`);
            await loadFiles();
        } else {
            showToast(`Không thể xóa tệp: ${d.error || 'Lỗi không xác định'}`);
        }
    } catch (e) {
        showToast('Lỗi xóa vĩnh viễn: ' + e.message);
    }
}

async function emptyTrash() {
    if (TRASH_FILES.length === 0) {
        showToast('Thùng rác hiện đang trống.');
        return;
    }
    if (!confirm(`Xác nhận xóa vĩnh viễn toàn bộ ${TRASH_FILES.length} tệp trong Thùng rác?\nThao tác này không thể hoàn tác.`)) return;
    try {
        const res = await fetch('/api/trash/empty', { method: 'POST' });
        const d = await res.json();
        if (d.success) {
            showToast(`Đã dọn sạch thùng rác (${d.count || 0} tệp).`);
            await loadFiles();
        } else {
            showToast(`Lỗi dọn thùng rác: ${d.error || 'Lỗi không xác định'}`);
        }
    } catch (e) {
        showToast('Lỗi dọn thùng rác: ' + e.message);
    }
}

async function resetSession() {
    const span = document.getElementById('resetStatus');
    span.textContent = 'Đang dọn dẹp...';
    try {
        const res = await fetch('/api/reset-session', { method: 'POST' });
        const d = await res.json();
        span.textContent = d.message;
        setTimeout(() => { span.textContent = ''; }, 3500);
    } catch (err) {
        span.textContent = 'Lỗi: ' + err.message;
    }
}

loadFiles();
restoreActiveJobState();
