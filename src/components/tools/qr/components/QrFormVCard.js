/**
 * QrFormVCard Component
 * Contact card inputs
 */

export function renderQrFormVCard(vcard) {
  return `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
        <i data-lucide="contact" class="w-4 h-4 text-blue-500"></i> Danh Bạ
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Họ & Tên</label>
          <input type="text" id="vcardFullName" value="${vcard.fullName || ''}" placeholder="Nguyễn Văn A" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Số Điện Thoại</label>
          <input type="tel" id="vcardPhone" value="${vcard.phone || ''}" placeholder="0912345678" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Công Ty</label>
          <input type="text" id="vcardOrg" value="${vcard.organization || ''}" placeholder="Công ty ABC" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Email</label>
          <input type="email" id="vcardEmail" value="${vcard.email || ''}" placeholder="email@example.com" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Chức Vụ</label>
          <input type="text" id="vcardTitle" value="${vcard.title || ''}" placeholder="Chức vụ" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Website</label>
          <input type="url" id="vcardWebsite" value="${vcard.website || ''}" placeholder="https://example.com" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
      </div>
    </div>
  `.trim();
}
