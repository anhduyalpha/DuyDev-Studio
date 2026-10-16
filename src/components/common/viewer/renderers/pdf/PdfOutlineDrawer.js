/**
 * PdfOutlineDrawer Component (Compatibility Re-export Layer)
 * Proxies to PdfSidebarDrawer for backward compatibility
 */

export {
  renderSidebarDrawer as renderOutlineDrawer,
  openSidebarDrawer as openOutlineDrawer,
  closeSidebarDrawer as closeOutlineDrawer,
  toggleSidebarDrawer as toggleOutlineDrawer,
  attachSidebarListeners as attachOutlineListeners
} from './PdfSidebarDrawer.js';
