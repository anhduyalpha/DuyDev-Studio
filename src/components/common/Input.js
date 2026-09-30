/**
 * Reusable Atomic Input Component
 * Dark Professional Minimalism
 */

export function renderInput({
  id = '',
  label = '',
  type = 'text',
  value = '',
  placeholder = '',
  isMono = false,
  hint = '',
  error = '',
  className = '',
  rows = null
}) {
  const fontClass = isMono ? 'font-mono' : '';
  const borderClass = error
    ? 'border-red-500 focus:ring-red-500'
    : 'border-zinc-200 dark:border-zinc-700/60 focus:ring-indigo-500';

  const inputClasses = `w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#18181B] border ${borderClass} text-xs ${fontClass} text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 transition ${className}`;

  return `
    <div class="space-y-1.5">
      ${label ? `<label class="block text-xs font-medium text-zinc-600 dark:text-zinc-400">${label}</label>` : ''}
      ${
        rows
          ? `<textarea id="${id}" rows="${rows}" placeholder="${placeholder}" class="${inputClasses}">${value}</textarea>`
          : `<input type="${type}" id="${id}" value="${value}" placeholder="${placeholder}" class="${inputClasses}">`
      }
      ${hint ? `<p class="text-[11px] text-zinc-400">${hint}</p>` : ''}
      ${error ? `<p class="text-[11px] text-red-500">${error}</p>` : ''}
    </div>
  `.trim();
}
