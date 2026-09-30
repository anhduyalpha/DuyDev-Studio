/**
 * Dropzone Component (Dark Professional Minimalism)
 */

export function renderDropzone({
  id = 'fileDropzone',
  title = 'Kéo thả hoặc tải tệp lên',
  subtitle = '',
  accept = '*/*',
  maxSizeText = '',
  multiple = true
} = {}) {
  return `
    <div id="${id}" class="relative group border border-dashed border-zinc-300 hover:border-zinc-400 dark:border-white/[0.12] dark:hover:border-white/30 rounded-2xl p-6 sm:p-8 bg-white dark:bg-[#121215] text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px] shadow-sm">
      <input type="file" id="${id}_input" class="hidden" accept="${accept}" ${multiple ? 'multiple' : ''}>
      
      <div class="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-700 dark:bg-white/[0.04] dark:border-white/[0.08] dark:text-zinc-300 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:text-black dark:group-hover:text-white transition duration-200">
        <i data-lucide="upload-cloud" class="w-6 h-6"></i>
      </div>
      
      <h4 class="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">${title}</h4>
      ${subtitle ? `<p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm font-normal">${subtitle}</p>` : ''}
      
      <div class="mt-4">
        <button type="button" onclick="document.getElementById('${id}_input').click()" 
                class="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold shadow-xs transition">
          Chọn tệp
        </button>
      </div>

      ${maxSizeText ? `<p class="text-xs font-mono text-zinc-400 dark:text-zinc-500 mt-3">${maxSizeText}</p>` : ''}
    </div>
  `;
}

export function attachDropzoneListeners(id, onFilesSelected) {
  const dropzone = document.getElementById(id);
  const input = document.getElementById(`${id}_input`);
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', (e) => {
    if (e.target !== input && !e.target.closest('button')) {
      input.click();
    }
  });

  input.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('border-white/40', 'bg-white/[0.02]');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('border-white/40', 'bg-white/[0.02]');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  });
}
