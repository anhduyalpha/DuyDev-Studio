/**
 * Reusable Atomic Button Component
 * Professional Dark Minimalism
 */

export function renderButton({
  id = '',
  text = '',
  icon = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  title = '',
  type = 'button'
}) {
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition cursor-pointer select-none rounded-xl';
  
  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs gap-1.5',
    md: 'py-2 px-3.5 text-xs gap-2',
    lg: 'py-2.5 px-4 text-sm gap-2'
  }[size] || 'py-2 px-3.5 text-xs gap-2';

  const variantClasses = {
    primary: 'bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 shadow-sm',
    secondary: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] dark:text-zinc-200',
    indigo: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm',
    outline: 'border border-zinc-200 hover:border-zinc-300 dark:border-zinc-700/60 dark:hover:border-zinc-600 bg-white dark:bg-[#18181B] text-zinc-700 dark:text-zinc-300',
    danger: 'border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30',
    ghost: 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]'
  }[variant] || variantClasses.primary;

  const stateClasses = disabled || loading ? 'opacity-60 cursor-not-allowed pointer-events-none' : '';

  const iconMarkup = loading
    ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>'
    : icon
    ? `<i data-lucide="${icon}" class="w-3.5 h-3.5"></i>`
    : '';

  return `
    <button type="${type}"
            ${id ? `id="${id}"` : ''}
            ${title ? `title="${title}"` : ''}
            ${disabled || loading ? 'disabled' : ''}
            class="${baseClasses} ${sizeClasses} ${variantClasses} ${stateClasses} ${className}">
      ${iconMarkup}
      ${text ? `<span>${text}</span>` : ''}
    </button>
  `.trim();
}
