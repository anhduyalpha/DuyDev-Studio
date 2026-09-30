/**
 * Lightweight Markdown Parser and Blob Exporter Utility
 */

export function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseMarkdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    // Headers
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-zinc-900 dark:text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-zinc-900 dark:text-white mt-5 mb-2 pb-1 border-b border-zinc-200 dark:border-white/10">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-zinc-900 dark:text-white mt-6 mb-3 pb-2 border-b border-zinc-200 dark:border-white/10">$1</h1>')
    // Bold / Italic
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="font-semibold text-zinc-900 dark:text-white">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="italic text-zinc-800 dark:text-zinc-200">$1</em>')
    // Blockquote
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-3 py-1 my-2 italic text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-white/[0.02] rounded-r-lg">$1</blockquote>')
    // Code blocks
    .replace(/```([\s\S]*?)```/gim, '<pre class="bg-zinc-100 dark:bg-[#0E0E11] p-3 rounded-xl border border-zinc-200/60 dark:border-white/[0.04] font-mono text-[11px] overflow-x-auto text-indigo-600 dark:text-indigo-400 my-3"><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/gim, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] font-mono text-[11px] text-indigo-600 dark:text-indigo-400">$1</code>')
    // Unordered lists
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-zinc-700 dark:text-zinc-300">$1</li>')
    // Links (only safe protocols: https?://, mailto:, #; block attribute breakout)
    .replace(/\[([^\]]+)\]\(((?:[^()]+|\([^()]*\))*)\)/gim, (_, text, href) => {
      const cleanHref = href.trim();
      if (/^(?:https?:\/\/|mailto:|#)/i.test(cleanHref) && !/[\s"'<>]|&(?:quot|#39|#x27);/i.test(cleanHref)) {
        return `<a href="${cleanHref}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">${text}</a>`;
      }
      return text;
    })
    // Simple Tables
    .replace(/\|(.*)\|/gim, (match) => {
      const cells = match.split('|').filter(c => c.trim() !== '');
      if (cells.some(c => c.includes('---'))) {
        return '';
      }
      return `<tr class="border-b border-zinc-200 dark:border-white/10">${cells.map(c => `<td class="p-2 border border-zinc-200 dark:border-white/10">${c.trim()}</td>`).join('')}</tr>`;
    })
    // Line breaks
    .replace(/\n\n/gim, '<div class="h-2"></div>');

  return html;
}
