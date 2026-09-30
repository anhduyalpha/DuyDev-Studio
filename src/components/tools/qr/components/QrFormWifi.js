/**
 * QrFormWifi Component
 * Wi-Fi network inputs
 */

export function renderQrFormWifi(wifi) {
  return `
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 pb-2 border-b border-zinc-100 dark:border-white/[0.05]">
        <i data-lucide="wifi" class="w-4 h-4 text-emerald-500"></i> Wi-Fi
      </h3>

      <div>
        <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Tên Mạng</label>
        <input type="text" id="qrWifiSsid" value="${wifi.ssid || ''}" placeholder="Nhập tên mạng Wi-Fi" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Mật Khẩu</label>
          <input type="text" id="qrWifiPassword" value="${wifi.password || ''}" placeholder="Mật khẩu" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </div>
        <div>
          <label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Bảo Mật</label>
          <select id="qrWifiSecurity" class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700/60 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="WPA" ${wifi.security === 'WPA' ? 'selected' : ''}>WPA / WPA2 / WPA3</option>
            <option value="WEP" ${wifi.security === 'WEP' ? 'selected' : ''}>WEP</option>
            <option value="nopass" ${wifi.security === 'nopass' ? 'selected' : ''}>Không mật khẩu</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <input type="checkbox" id="qrWifiHidden" ${wifi.hidden ? 'checked' : ''} class="accent-indigo-600 rounded">
        <label for="qrWifiHidden" class="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">Mạng Wi-Fi ẩn</label>
      </div>
    </div>
  `.trim();
}
