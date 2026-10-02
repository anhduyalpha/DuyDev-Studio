/**
 * TermsPage.js - Điều khoản dịch vụ & Tuyên bố miễn trừ hài hước
 * DuyDev Studio Personal Utility Hub
 */

import { copyText } from '../utilities/clipboard.js';
import { showToast } from '../utilities/toast.js';

export function renderTermsPage() {
  return `
    <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <a href="#" class="hover:text-zinc-800 dark:hover:text-zinc-200 transition">Trang chủ</a>
        <span>/</span>
        <span class="text-zinc-900 dark:text-zinc-100 font-medium">Điều khoản dịch vụ</span>
      </div>

      <!-- Hero Header -->
      <div class="relative overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-white to-zinc-50/50 dark:from-zinc-900/90 dark:to-[#0c0c0e] p-6 sm:p-8 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold tracking-wide">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span>PHIÊN BẢN CƠM THÊM • MIỄN TRỪ TRÁCH NHIỆM</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Điều khoản sử dụng & Tuyên bố miễn trừ
            </h1>
            <p class="text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl leading-relaxed">
              Vui lòng đọc kỹ trước khi bấm lung tung. Đọc hay không đọc thì đằng nào bạn cũng đã lỡ bấm vào web rồi.
            </p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <a href="#" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition shadow-sm cursor-pointer">
              <i data-lucide="arrow-left" class="w-4 h-4"></i>
              <span>Quay lại Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Tuyên ngôn cốt lõi -->
      <div class="p-4 sm:p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 flex items-start gap-3.5">
        <div class="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
          <i data-lucide="info" class="w-4 h-4"></i>
        </div>
        <div class="text-xs sm:text-sm leading-relaxed space-y-1">
          <p class="font-semibold text-amber-900 dark:text-amber-100">
            Tuyên ngôn khai sinh của website:
          </p>
          <p class="text-amber-800/90 dark:text-amber-200/90 font-medium">
            "Đây là web lỏ tự code phục vụ nhu cầu cá nhân của Anh Duy để làm việc, nén PDF cho lẹ, cào tài liệu học tập, soi file zip và nghịch linh tinh, chứ không phải tập đoàn công nghệ triệu đô nào cả."
          </p>
        </div>
      </div>

      <!-- Danh sách điều khoản -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Điều 1 -->
        <div class="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-500 dark:text-rose-400 shrink-0">
              <i data-lucide="flame" class="w-4 h-4"></i>
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-rose-500 font-semibold">Điều 1</span>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Miễn trừ trách nhiệm cấp vũ trụ</h3>
            </div>
          </div>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Hệ thống chạy trên một chiếc máy chủ homeserver nhỏ bé đặt dưới gầm bàn. Nếu một ngày web lăn ra chết, đừng hoảng loạn, có thể mẹ tác giả vừa rút nhầm dây nguồn để cắm nồi cơm điện, hoặc mạng nhà đang đứt cáp quang.
          </p>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            ⚠️ Tác giả không chịu trách nhiệm nếu bạn nén tài liệu lúc 23:59 rồi bị trễ hạn nộp bài. Hãy nộp sớm hơn đi!
          </div>
        </div>

        <!-- Điều 2 -->
        <div class="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-semibold">Điều 2</span>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Bảo mật & Quyền riêng tư (Thật 100%)</h3>
            </div>
          </div>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Chúng tôi cam đoan không bán dữ liệu của bạn cho bất kỳ ai — đơn giản vì dữ liệu của bạn chả ai thèm mua, và tác giả cũng lười viết database lưu lịch sử xem của bạn.
          </p>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            🔒 Mọi tệp xử lý xong được cơ chế dọn rác tự động xóa sạch, không ai rảnh ngồi đọc tài liệu của bạn đâu.
          </div>
        </div>

        <!-- Điều 3 -->
        <div class="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shrink-0">
              <i data-lucide="cpu" class="w-4 h-4"></i>
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-indigo-500 font-semibold">Điều 3</span>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Văn hóa sử dụng chùa văn minh</h3>
            </div>
          </div>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Dùng tẹt ga không tốn một xu, không quảng cáo cờ bạc, không pop-up phiền toái. Nhưng xin đừng đem bot đi DDoS hay cào phá server. Con chip Celeron gánh còng lưng, ép quá nó bốc khói là cả làng cùng nhịn.
          </p>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            🛠️ Thấy lỗi thì hoan hỉ nhắn dev một tiếng, đừng ngồi chửi thầm tội nghiệp.
          </div>
        </div>

        <!-- Điều 4 -->
        <div class="p-5 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] space-y-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 dark:text-amber-400 shrink-0">
              <i data-lucide="coffee" class="w-4 h-4"></i>
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-amber-500 font-semibold">Điều 4</span>
              <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chính sách Dô-nết (Nuôi Server)</h3>
            </div>
          </div>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Nếu công cụ này giúp bạn kịp qua môn, tiết kiệm 15 phút cuộc đời hoặc đơn giản là thấy dev dễ thương: xin mời dô-nết tùy tâm! Tiền ủng hộ sẽ được chuyển hóa thành tiền điện, tiền mạng hoặc vài gói mì Hảo Hảo lúc nửa đêm.
          </p>
          <div class="p-2.5 rounded-xl bg-zinc-50 dark:bg-black/40 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
            ❤️ Không ép buộc, nhưng ai donate thì server sẽ tự động chạy nhanh hơn 0.01% nhờ aura tâm linh.
          </div>
        </div>
      </div>

      <!-- Hộp Dô-Nết / Donate Cực Xịn -->
      <div id="donateSection" class="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-zinc-900/90 to-[#0e0e12] p-6 sm:p-8 shadow-xl space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20 shrink-0">
              <i data-lucide="heart" class="w-6 h-6 fill-white"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-bold text-white">Quỹ bảo kê tiền điện & mì tôm cho Dev</h2>
                <span class="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-semibold">DÔ-NẾT TÙY TÂM</span>
              </div>
              <p class="text-xs text-zinc-400 mt-0.5">Một ly trà đá hay gói bim bim cũng đủ làm dev cảm động rớt nước mắt.</p>
            </div>
          </div>
        </div>

        <!-- Bank Card & QR Display Grid -->
        <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          <!-- Chi tiết tài khoản (7 cols) -->
          <div class="md:col-span-7 flex flex-col justify-between space-y-4 bg-black/40 border border-white/10 rounded-2xl p-5 sm:p-6 shadow-inner">
            <div class="space-y-3">
              <div class="flex items-center justify-between text-xs text-zinc-400 border-b border-white/5 pb-2.5">
                <span>Ngân hàng</span>
                <span class="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span class="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono text-[10px] font-bold">ACB</span>
                  <span>Ngân hàng TMCP Á Châu</span>
                </span>
              </div>

              <div class="flex items-center justify-between text-xs text-zinc-400 border-b border-white/5 pb-2.5">
                <span>Chủ tài khoản</span>
                <span class="font-bold text-amber-400 tracking-wide font-mono uppercase text-sm">ĐẶNG HOÀNG ANH DUY</span>
              </div>

              <div class="space-y-1.5 pt-1">
                <span class="text-xs text-zinc-400 block font-medium">Số tài khoản nhận donate</span>
                <div class="flex items-center gap-2">
                  <span id="donateStk" class="font-mono text-xl sm:text-2xl font-bold text-white tracking-widest bg-zinc-900/90 px-4 py-2.5 rounded-xl border border-indigo-500/40 flex-1 select-all">
                    36646437
                  </span>
                  <button type="button" id="btnCopyStk" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-lg shadow-indigo-600/30">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                    <span>Sao chép</span>
                  </button>
                </div>
              </div>

              <div class="text-[11px] text-zinc-400 pt-2 flex items-center gap-2">
                <i data-lucide="message-square" class="w-3.5 h-3.5 text-zinc-500 shrink-0"></i>
                <span>Nội dung chuyển khoản: <span class="text-zinc-200 font-mono font-medium">Nuoi server DDStudio</span></span>
              </div>
            </div>

            <!-- Định giá tiền & QR tự cập nhật -->
            <div class="pt-3 border-t border-white/5 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs text-zinc-400 font-medium">Chọn số tiền (QR tự cập nhật):</span>
                <span id="labelCurrentDonateAmount" class="font-mono text-xs font-bold text-amber-400">10.000 VNĐ</span>
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button type="button" class="btn-donate-tier px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer text-center bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30" data-amount="10000">
                  <span>☕</span> <span>10.000đ</span>
                </button>
                <button type="button" class="btn-donate-tier px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition cursor-pointer text-center" data-amount="20000">
                  <span>🥪</span> <span>20.000đ</span>
                </button>
                <button type="button" class="btn-donate-tier px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition cursor-pointer text-center" data-amount="50000">
                  <span>🍜</span> <span>50.000đ</span>
                </button>
                <button type="button" class="btn-donate-tier px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition cursor-pointer text-center" data-amount="100000">
                  <span>⚡</span> <span>100.000đ</span>
                </button>
              </div>
              <div class="flex items-center gap-2 pt-0.5">
                <div class="relative flex-1">
                  <input
                    type="number"
                    id="inputCustomDonateAmount"
                    min="1000"
                    step="1000"
                    placeholder="Nhập số tiền khác..."
                    class="w-full bg-zinc-900/90 border border-white/10 rounded-xl pl-3 pr-11 py-1.5 text-xs text-white placeholder-zinc-500 font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-500">VNĐ</span>
                </div>
                <button type="button" id="btnCustomTuyuTam" class="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer whitespace-nowrap active:scale-95" title="Random số tiền từ 10.000đ đến 100.000đ">
                  <span>🎲 Tùy tâm</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Mã VietQR (5 cols) -->
          <div class="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl border border-white/10 bg-black/40 text-center space-y-3">
            <div class="relative p-2.5 bg-white rounded-2xl shadow-xl max-w-[210px] w-full">
              <img
                id="vietQrImg"
                src="https://img.vietqr.io/image/ACB-36646437-compact2.png?amount=10000&addInfo=Nuoi%20server%20DDStudio&accountName=DANG%20HOANG%20ANH%20DUY"
                alt="VietQR Donate ACB 36646437 - ĐẶNG HOÀNG ANH DUY"
                class="w-full h-auto aspect-square object-contain rounded-xl transition-opacity duration-200"
                loading="lazy"
                onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'py-12 text-zinc-800 text-xs font-mono font-bold\'>ACB - 36646437<br>DANG HOANG ANH DUY</div>';"
              />
            </div>
            <div class="space-y-1">
              <p id="labelQrAmountTitle" class="text-xs font-semibold text-zinc-200">Mã VietQR: 10.000 VNĐ</p>
              <p id="labelQrAmountSub" class="text-[11px] text-zinc-400">Quét bằng mọi ứng dụng ngân hàng hoặc ví điện tử</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
        <p class="text-xs text-zinc-500 dark:text-zinc-400 text-center sm:text-left">
          Bằng việc tiếp tục ở lại trang này, bạn mặc nhiên đã đồng ý với tất cả điều khoản lỏ bên trên.
        </p>
        <div class="flex items-center gap-3">
          <a href="#" class="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer transition shadow-sm">
            Tôi đồng ý (dù chả còn cách nào khác)
          </a>
        </div>
      </div>
    </div>
  `;
}

export function attachTermsPageListeners() {
  const btnCopyStk = document.getElementById('btnCopyStk');
  const donateStk = document.getElementById('donateStk');
  const vietQrImg = document.getElementById('vietQrImg');
  const labelCurrentAmount = document.getElementById('labelCurrentDonateAmount');
  const labelQrTitle = document.getElementById('labelQrAmountTitle');
  const customInput = document.getElementById('inputCustomDonateAmount');
  const btnCustomTuyuTam = document.getElementById('btnCustomTuyuTam');

  let currentAmount = 10000;
  let debounceTimer = null;

  const setDonateAmount = (amount, updateInput = true) => {
    currentAmount = Math.max(0, Number(amount) || 0);

    // 1. Update text labels
    if (labelCurrentAmount) {
      labelCurrentAmount.textContent = currentAmount > 0
        ? `${currentAmount.toLocaleString('vi-VN')} VNĐ`
        : 'Tùy tâm';
    }
    if (labelQrTitle) {
      labelQrTitle.textContent = currentAmount > 0
        ? `Mã VietQR: ${currentAmount.toLocaleString('vi-VN')} VNĐ`
        : 'Mã VietQR Napas 24/7 (Tùy tâm)';
    }

    // 2. Update QR Image
    if (vietQrImg) {
      const base = 'https://img.vietqr.io/image/ACB-36646437-compact2.png';
      const params = new URLSearchParams({
        addInfo: 'Nuoi server DDStudio',
        accountName: 'DANG HOANG ANH DUY'
      });
      if (currentAmount > 0) {
        params.set('amount', String(currentAmount));
      }
      vietQrImg.src = `${base}?${params.toString()}`;
    }

    // 3. Update button active states
    const isStandardPreset = [10000, 20000, 50000, 100000].includes(currentAmount);
    document.querySelectorAll('.btn-donate-tier').forEach((btn) => {
      const btnAmount = Number(btn.dataset.amount);
      const isActive = btnAmount === currentAmount;
      if (isActive) {
        btn.className = 'btn-donate-tier px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer text-center bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30';
      } else {
        btn.className = 'btn-donate-tier px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition cursor-pointer text-center';
      }
    });

    if (btnCustomTuyuTam) {
      const isRandomOrCustom = !isStandardPreset && currentAmount > 0;
      btnCustomTuyuTam.className = isRandomOrCustom
        ? 'px-3.5 py-1.5 rounded-xl border bg-indigo-600 border-indigo-500 text-white text-xs font-semibold transition cursor-pointer whitespace-nowrap shadow-sm shadow-indigo-600/30 active:scale-95'
        : 'px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium transition cursor-pointer whitespace-nowrap active:scale-95';
    }

    if (updateInput && customInput) {
      customInput.value = isStandardPreset ? '' : String(currentAmount);
    }
  };

  // Preset buttons click
  document.querySelectorAll('.btn-donate-tier').forEach((btn) => {
    btn.addEventListener('click', () => {
      const amount = Number(btn.dataset.amount);
      setDonateAmount(amount, true);
    });
  });

  // Tùy tâm button click -> Random amount from 10,000 to 100,000 VNĐ
  btnCustomTuyuTam?.addEventListener('click', () => {
    const randomThousand = Math.floor(Math.random() * 91) + 10; // 10 to 100
    const randomAmount = randomThousand * 1000;
    setDonateAmount(randomAmount, true);
    showToast(`🎲 Số tiền tùy tâm may mắn: ${randomAmount.toLocaleString('vi-VN')} VNĐ`, 'info');
  });

  // Custom amount input (debounced)
  customInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const rawVal = e.target.value.trim();
      if (!rawVal) {
        setDonateAmount(10000, false);
        return;
      }
      const val = parseInt(rawVal, 10);
      if (!isNaN(val) && val >= 0) {
        setDonateAmount(val, false);
      }
    }, 200);
  });

  // Copy STK
  const handleCopy = async () => {
    const stk = donateStk?.textContent?.trim() || '36646437';
    const success = await copyText(stk);
    if (success) {
      showToast(`Đã sao chép STK ACB: ${stk}! Cảm ơn bạn ❤️`, 'success');
    } else {
      showToast(`STK: ${stk} - ACB (ĐẶNG HOÀNG ANH DUY)`, 'info');
    }
  };
  btnCopyStk?.addEventListener('click', handleCopy);

  return () => {
    clearTimeout(debounceTimer);
  };
}
