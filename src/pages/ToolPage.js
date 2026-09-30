/**
 * ToolPage Controller
 * Dispatches to dedicated tool components based on toolId:
 * - PDF Tools: PdfConverter (Nén, Đổi, Ghép/Tách, Khóa mật khẩu)
 * - QR Studio: QrStudio (VietQR, Wi-Fi, URL, Text, Scanner)
 * - Hash & Checksum: HashStudio (SHA-256, SHA-1, SHA-512, MD5, Base64)
 * - Markdown & Docs: MarkdownEditor (Live Markdown Preview, Export HTML/PDF)
 * - Universal Converter: ConverterWorkspace (All formats - Images, Audio, Video, Docs, Archives)
 * - Archive Inspector: ArchivePage (Direct central directory inspector)
 */

import { renderPdfConverter, attachPdfConverterListeners } from '../components/tools/pdf/PdfWorkspace.js';
import {
  renderQrStudio,
  attachQrStudioListeners,
  renderQrScanner,
  attachQrScannerListeners
} from '../components/tools/qr/QrStudio.js';
import { renderHashStudio, attachHashStudioListeners } from '../components/tools/hash/HashStudio.js';
import { renderMarkdownEditor, attachMarkdownEditorListeners } from '../components/tools/MarkdownEditor.js';
import { renderArchivePage, attachArchivePageListeners } from './ArchivePage.js';
import { renderArchiveCompressWorkspace, attachArchiveCompressListeners } from '../components/tools/archive/ArchiveCompressWorkspace.js';
import { renderConverterWorkspace, attachConverterListeners } from '../components/tools/converter/ConverterWorkspace.js';
import { renderStudocuWorkspace, attachStudocuListeners } from '../components/tools/studocu/StudocuWorkspace.js';
import { renderStoragePage, attachStoragePageListeners } from './StoragePage.js';
import { converterManager } from '../components/tools/converter/hooks/useConverter.js';
import { pdfQueueManager } from '../components/tools/pdf/hooks/usePdfQueue.js';
import { toolRegistry } from '../hooks/useToolRegistry.js';

let currentActiveToolId = 'pdf-studio';

export function renderToolPage(toolId = 'pdf-convert', subTab = null) {
  currentActiveToolId = toolId;
  const tool = toolRegistry.getToolById(toolId);

  switch (toolId) {
    case 'qr-multi':
      return renderQrStudio(subTab);

    case 'qr-scan':
      return renderQrScanner();

    case 'hash-checksum':
      return renderHashStudio();

    case 'markdown-docs':
      return renderMarkdownEditor();

    case 'archive-inspect':
      return renderArchivePage();

    case 'server-archive':
      return renderArchiveCompressWorkspace();

    case 'image-converter':
    case 'video-audio':
    case 'universal-converter':
      return renderConverterWorkspace(converterManager);

    case 'studocu-dl':
      return renderStudocuWorkspace();

    case 'storage':
      return renderStoragePage();

    case 'pdf-studio':
    case 'pdf-merge':
    case 'pdf-lock':
    case 'pdf-convert':
    default: {
      const modeMap = {
        'pdf-merge': 'merge',
        'pdf-lock': 'security',
        'pdf-convert': 'compress',
        'lock': 'security',
        'img2pdf': 'images_to_pdf',
        'images': 'images_to_pdf',
        'extract': 'extract_images'
      };
      const targetMode = modeMap[subTab] || modeMap[toolId] || subTab;
      if (targetMode) pdfQueueManager.setMode(targetMode, true);
      return renderPdfConverter(pdfQueueManager.getState());
    }
  }
}

export function attachToolPageListeners(onReRender) {
  switch (currentActiveToolId) {
    case 'qr-multi':
      return attachQrStudioListeners(onReRender);

    case 'qr-scan':
      return attachQrScannerListeners(onReRender);

    case 'hash-checksum':
      return attachHashStudioListeners(onReRender);

    case 'markdown-docs':
      return attachMarkdownEditorListeners(onReRender);

    case 'archive-inspect':
      return attachArchivePageListeners(onReRender);

    case 'server-archive':
      return attachArchiveCompressListeners(onReRender);

    case 'image-converter':
    case 'video-audio':
    case 'universal-converter': {
      return attachConverterListeners(converterManager);
    }

    case 'studocu-dl':
      return attachStudocuListeners();

    case 'storage':
      return attachStoragePageListeners(onReRender);

    case 'pdf-studio':
    case 'pdf-merge':
    case 'pdf-lock':
    case 'pdf-convert':
    default: {
      return attachPdfConverterListeners(pdfQueueManager);
    }
  }
}
