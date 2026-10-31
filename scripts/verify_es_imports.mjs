import fs from 'fs';
import path from 'path';

const srcDir = './src';
let errors = [];

function getExports(content) {
  const exports = new Set();
  const directExportRegex = /export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([a-zA-Z0-9_$]+)/g;
  let match;
  while ((match = directExportRegex.exec(content)) !== null) {
    exports.add(match[1]);
  }
  const blockExportRegex = /export\s*\{([^}]+)\}/g;
  while ((match = blockExportRegex.exec(content)) !== null) {
    const items = match[1].split(',');
    for (const item of items) {
      const parts = item.trim().split(/\s+as\s+/);
      const exportedName = parts[1] || parts[0];
      if (exportedName && exportedName.trim()) {
        exports.add(exportedName.trim());
      }
    }
  }
  return exports;
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Match named imports: import { a, b as c } from './path.js'
  const importNamedRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = importNamedRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    const specifier = match[2];
    if (!specifier.startsWith('.')) continue;

    const cleanSpec = specifier.split('?')[0];
    const targetFile = path.resolve(path.dirname(filePath), cleanSpec);
    if (!fs.existsSync(targetFile)) {
      errors.push(`${filePath}: Target file ${specifier} not found`);
      continue;
    }

    const targetContent = fs.readFileSync(targetFile, 'utf8');
    const targetExports = getExports(targetContent);

    for (const name of names) {
      if (!targetExports.has(name)) {
        errors.push(`${filePath}: Missing export "${name}" from ${specifier}`);
      }
    }
  }
}

scanDir(srcDir);

console.log(`Scan completed. Total errors: ${errors.length}`);
for (const err of errors) {
  console.log(`  ERROR: ${err}`);
}
if (errors.length > 0) {
  process.exit(1);
} else {
  console.log('All ES module named imports verified cleanly.');
}
