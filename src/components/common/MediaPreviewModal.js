/**
 * Backward compatibility facade for ViewerConnector (< 40 lines)
 * Delegates all preview calls to DD Studio Universal File Viewer Core
 */

import { ViewerConnector, detectFileCategory } from './viewer/FileViewerConnector.js';
import { closeFileViewer } from './viewer/FileViewerCore.js';

export function detectMediaType(fileName = '') {
  return detectFileCategory(fileName);
}

export function closeMediaPreview() {
  closeFileViewer();
}

/**
 * Opens the universal media preview modal.
 * @param {Object} options
 * @param {string} [options.name]
 * @param {string} [options.url]
 * @param {string} [options.fileId]
 * @param {string} [options.type]
 * @param {number} [options.size]
 */
export async function openMediaPreview({ name = 'Tệp', url = '', fileId = '', type = '', size = 0 }) {
  ViewerConnector.preview({
    fileName: name,
    viewUrl: url,
    downloadUrl: url,
    fileId,
    type,
    resultSize: size
  });
}
