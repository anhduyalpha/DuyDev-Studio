/**
 * Reusable Micro-Badge Component (Soft Tinted Minimalist)
 */

export function renderBadge(text, color = null) {
  if (!color) {
    return `
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-mono uppercase tracking-wider bg-zinc-100 dark:bg-white/[0.05] text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-white/[0.08] font-semibold">
        ${text}
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold tool-accent-box"
          style="--accent: ${color};">
      ${text}
    </span>
  `;
}
