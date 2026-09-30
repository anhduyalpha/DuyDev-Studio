/**
 * Reusable Atomic ColorPicker Component
 * Dark Professional Minimalism
 */

export function renderColorPicker({
  id = 'customColorPicker',
  presets = [],
  activeColor = '#000000',
  dataAttr = 'data-preset-color',
  btnClass = 'btn-preset-color'
}) {
  const isPresetActive = (val) => activeColor.toUpperCase() === val.toUpperCase();

  return `
    <div class="flex items-center gap-2">
      ${presets
        .map(
          (c) => `
        <button type="button" ${dataAttr}="${c.val}"
                class="${btnClass} w-6 h-6 rounded-full border-2 transition ${
            isPresetActive(c.val)
              ? 'border-indigo-500 scale-110 shadow-xs'
              : 'border-zinc-300 dark:border-white/20 hover:scale-105'
          }"
                style="background-color: ${c.val}"
                title="${c.label || c.val}"></button>
      `
        )
        .join('')}
      <div class="relative w-6 h-6 rounded-full overflow-hidden border border-zinc-300 dark:border-white/20 cursor-pointer ml-1" title="Chọn màu">
        <input type="color" id="${id}" value="${activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#000000'}" class="absolute -top-2 -left-2 w-10 h-10 cursor-pointer border-0 p-0">
      </div>
    </div>
  `.trim();
}
