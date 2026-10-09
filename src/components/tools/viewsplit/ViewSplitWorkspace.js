/**
 * ViewSplitWorkspace.js - Entry Render & Layout Controller for ViewSplit Module
 * Orchestrates multi-pane grids, slider wipe overlays, difference heatmaps,
 * floating glass pixel loupe, and event listener attachments.
 */

import { viewSplitStore, LAYOUT_MODES } from './hooks/useViewSplit.js';
import { renderViewSplitToolbar } from './components/ViewSplitToolbar.js';
import { renderViewSplitPane } from './components/ViewSplitPane.js';
import { renderViewSplitSliderOverlay } from './components/ViewSplitSliderOverlay.js';
import { renderViewSplitPixelInspector } from './components/ViewSplitPixelInspector.js';
import { renderViewSplitMobileTabs } from './components/ViewSplitMobileTabs.js';
import { renderViewSplitUrlModal } from './components/ViewSplitUrlModal.js';
import { attachViewSplitDomListeners } from './hooks/useViewSplitDom.js';

/**
 * Renders the full ViewSplit workspace HTML.
 * @returns {string}
 */
export function renderViewSplitWorkspace() {
  const state = viewSplitStore;
  const { layout, panes, activePaneId, filter, mobileActiveTab } = state;

  return `
    <div id="viewsplit-workspace" class="w-full flex flex-col gap-3 min-h-[calc(100vh-140px)] animate-fadeIn">
      <!-- Top Action Toolbar -->
      ${renderViewSplitToolbar(state)}

      <!-- Mobile Segmented Tab Switcher (Visible only on < 768px) -->
      ${renderViewSplitMobileTabs(state)}

      <!-- Viewports Workspace Container -->
      <main class="w-full flex-1 relative min-h-[500px]">
        ${
          layout === LAYOUT_MODES.SLIDER || layout === LAYOUT_MODES.DIFF
            ? renderViewSplitSliderOverlay(state)
            : renderMultiPaneGrid(layout, panes, activePaneId, filter, mobileActiveTab)
        }
      </main>

      <!-- Floating Glass Pixel Inspector HUD -->
      ${renderViewSplitPixelInspector(state)}

      <!-- Image URL & Drive Ingestion Modal -->
      ${renderViewSplitUrlModal(state)}
    </div>
  `;
}

/**
 * Renders multi-pane grid layout based on selected layout mode.
 */
function renderMultiPaneGrid(layout, panes, activePaneId, filter, mobileActiveTab) {
  // Mobile responsive helper: On small screens, if user picked a mobile tab, we can highlight or focus it
  switch (layout) {
    case LAYOUT_MODES.SINGLE: {
      const targetPane = panes.find((p) => p.id === activePaneId) || panes[0];
      return `
        <div class="w-full h-[580px] xl:h-[680px]">
          ${renderViewSplitPane(targetPane, true, filter)}
        </div>
      `;
    }

    case LAYOUT_MODES.SPLIT_H: {
      return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 h-[600px] xl:h-[700px]">
          ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
        </div>
      `;
    }

    case LAYOUT_MODES.SPLIT_V: {
      return `
        <div class="grid grid-cols-1 grid-rows-2 gap-3 h-[720px] xl:h-[800px]">
          ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
        </div>
      `;
    }

    case LAYOUT_MODES.TRIPLE_H: {
      return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 h-[600px] xl:h-[700px]">
          ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
          ${renderViewSplitPane(panes[2], activePaneId === 3, filter)}
        </div>
      `;
    }

    case LAYOUT_MODES.TRIPLE_L: {
      return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 h-[620px] xl:h-[720px]">
          <div class="md:col-span-2 h-full">
            ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          </div>
          <div class="grid grid-cols-1 grid-rows-2 gap-3 h-full">
            ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
            ${renderViewSplitPane(panes[2], activePaneId === 3, filter)}
          </div>
        </div>
      `;
    }

    case LAYOUT_MODES.TRIPLE_T: {
      return `
        <div class="grid grid-cols-1 grid-rows-2 gap-3 h-[720px] xl:h-[820px]">
          <div class="w-full h-full">
            ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
            ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
            ${renderViewSplitPane(panes[2], activePaneId === 3, filter)}
          </div>
        </div>
      `;
    }

    case LAYOUT_MODES.QUAD:
    default: {
      return `
        <div class="grid grid-cols-1 sm:grid-cols-2 grid-rows-2 gap-3 h-[640px] xl:h-[740px]">
          ${renderViewSplitPane(panes[0], activePaneId === 1, filter)}
          ${renderViewSplitPane(panes[1], activePaneId === 2, filter)}
          ${renderViewSplitPane(panes[2], activePaneId === 3, filter)}
          ${renderViewSplitPane(panes[3], activePaneId === 4, filter)}
        </div>
      `;
    }
  }
}

/**
 * Attaches all DOM listeners and initiates rendering cycle.
 * @param {Function} onReRender
 * @returns {Function} cleanup
 */
export function attachViewSplitWorkspaceListeners(onReRender) {
  return attachViewSplitDomListeners(viewSplitStore, onReRender);
}
