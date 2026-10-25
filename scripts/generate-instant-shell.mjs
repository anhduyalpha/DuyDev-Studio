import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Mock browser globals for Node SSR extraction
globalThis.window = {
  location: { hash: '', search: '', pathname: '/' },
  navigator: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {} })
};
globalThis.document = {
  documentElement: { classList: { contains: () => false, add: () => {}, remove: () => {} } },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
  cookie: ''
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

async function main() {
  const srcDirUrl = `file:///${rootDir.replace(/\\/g, '/')}/src`;
  const { renderHeader } = await import(`${srcDirUrl}/components/layout/Header.js`);
  const { renderDashboardPage } = await import(`${srcDirUrl}/pages/DashboardPage.js`);
  const { renderFooter } = await import(`${srcDirUrl}/components/layout/Footer.js`);
  const { renderBottomNav } = await import(`${srcDirUrl}/components/layout/BottomNav.js`);

  const headerHtml = renderHeader();
  const dashboardHtml = renderDashboardPage();
  const footerHtml = renderFooter();
  const bottomNavHtml = renderBottomNav('');

  const shellContent = `
    <!-- Instant App Shell & Dashboard (Zero-Delay First Paint - Suppressed in share mode) -->
    <div id="appInstantShell" class="min-h-screen flex flex-col antialiased selection:bg-indigo-500/30 selection:text-indigo-200 w-full max-w-full overflow-x-clip">
      
      <div id="headerContainer" class="w-full">
${headerHtml}
      </div>

      <main id="mainContent" class="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 pt-4 pb-36 sm:pt-8 sm:pb-20 lg:pb-24 min-w-0 overflow-x-clip">
${dashboardHtml}
      </main>

      <div id="footerContainer" class="w-full">
${footerHtml}
      </div>

      <div id="bottomNavContainer">
${bottomNavHtml}
      </div>

      <div id="globalPreviewContainer"></div>
      <div id="globalTaskDockContainer"></div>
    </div>
  `;

  const indexPath = path.join(rootDir, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // Regex to match <div id="app" ...> ... </div>
  const appStartToken = '<div id="app" class="w-full max-w-full overflow-x-clip min-h-screen">';
  const appEndToken = '  <!-- Non-blocking deferred vendor engines -->';

  const startIndex = indexHtml.indexOf(appStartToken);
  const endIndex = indexHtml.indexOf(appEndToken);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not find target boundaries for #app in index.html');
  }

  const updatedAppSection = `${appStartToken}${shellContent}</div>\n\n  <!-- Immediate Lucide Icon Resolution for Frame 0 (Zero Icon Flash) -->\n  <script>\n    if (window.lucide && typeof window.lucide.createIcons === 'function') {\n      window.lucide.createIcons();\n    }\n  </script>\n\n`;

  const newIndexHtml = indexHtml.slice(0, startIndex) + updatedAppSection + indexHtml.slice(endIndex);

  fs.writeFileSync(indexPath, newIndexHtml, 'utf-8');
  console.log('✅ Generated pixel-identical instant shell into index.html successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Failed to generate instant shell:', err);
  process.exit(1);
});
