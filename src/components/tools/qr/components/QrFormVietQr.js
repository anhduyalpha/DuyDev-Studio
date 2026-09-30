/**
 * QrFormVietQr Component
 * Bank selection & account inputs
 */

import { POPULAR_BANKS } from '../hooks/useQrState.js';

export function renderQrFormVietQr(vietqr) {
  return `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
        <i data-lucide="credit-card" class="w-4 h-4 text-indigo-500"></i> VietQR
      </h3>

      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Ngân Hàng</label>
        <select id="qrBankSelect" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          ${POPULAR_BANKS.map((b) => `
            <option value="${b.bin}" ${vietqr.bankBin === b.bin ? 'selected' : ''} class="bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100">${b.name}</option>
          `).join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Số Tài Khoản</label>
        <input type="text" id="qrAccountNumber" value="${vietqr.accountNumber || ''}" placeholder="Nhập số tài khoản" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Số Tiền</label>
          <input type="number" id="qrAmount" value="${vietqr.amount || ''}" placeholder="Ví dụ: 50000" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Nội Dung</label>
          <input type="text" id="qrPurpose" value="${vietqr.purpose || ''}" placeholder="Ví dụ: Thanh toan" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>
    </div>
  `.trim();
}
