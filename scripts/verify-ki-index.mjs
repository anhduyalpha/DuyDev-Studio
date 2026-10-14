#!/usr/bin/env node
/**
 * scripts/verify-ki-index.mjs
 * 
 * Autonomous Knowledge Base Index Validator & Synchronizer.
 * Scans docs/knowledge-base/ for KI-*.md files, extracts frontmatter / headers,
 * and verifies that docs/knowledge-base/README.md has all items registered.
 * Supports auto-fixing with `--fix`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const kbDir = path.join(rootDir, 'docs', 'knowledge-base');
const readmePath = path.join(kbDir, 'README.md');

// Parse CLI flags
const args = process.argv.slice(2);
const autoFix = args.includes('--fix');
const quiet = args.includes('--quiet') || args.includes('-q');

function log(...messages) {
  if (!quiet) console.log(...messages);
}

function parseFrontmatter(content) {
  const meta = {};
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const lines = fmMatch[1].split(/\r?\n/);
    for (const line of lines) {
      const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) {
        const currentKey = kv[1].trim();
        let val = kv[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        meta[currentKey] = val;
      }
    }
  }

  if (!meta.title) {
    const h1Match = content.match(/^#\s+(?:\[[^\]]+\]\s*)?([^\r\n]+)/m);
    if (h1Match) meta.title = h1Match[1].trim();
  }

  return meta;
}

function extractKiId(filename, meta) {
  if (meta.id) {
    const m = meta.id.match(/^(KI-[A-Z]+-\d+)/);
    if (m) return m[1];
  }
  const fileMatch = filename.match(/^(KI-[A-Z]+-\d+)/);
  if (fileMatch) return fileMatch[1];
  return filename.replace(/\.md$/, '');
}

function runVerification() {
  if (!fs.existsSync(kbDir)) {
    console.error(`❌ Knowledge base directory not found at: ${kbDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(readmePath)) {
    console.error(`❌ Master README not found at: ${readmePath}`);
    process.exit(1);
  }

  const files = fs.readdirSync(kbDir)
    .filter(f => f.startsWith('KI-') && f.endsWith('.md'))
    .sort();

  let readmeContent = fs.readFileSync(readmePath, 'utf8');

  log(`🔍 Scanning ${files.length} Knowledge Items in docs/knowledge-base/...`);

  const kiEntries = [];
  const idToFiles = new Map();

  for (const file of files) {
    const fullPath = path.join(kbDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const meta = parseFrontmatter(content);
    const kiId = extractKiId(file, meta);

    if (!idToFiles.has(kiId)) {
      idToFiles.set(kiId, []);
    }
    idToFiles.get(kiId).push(file);

    kiEntries.push({
      file,
      kiId,
      title: meta.title || file.replace(/\.md$/, ''),
      type: meta.type || (kiId.startsWith('KI-FIX') ? 'troubleshoot' : kiId.startsWith('KI-CON') ? 'concept' : 'how-to'),
      domain: meta.domain || 'fullstack',
      status: meta.status || 'verified',
      trigger: meta.trigger_conditions || meta.description || 'Xem chi tiết trong tài liệu.'
    });
  }

  // Check duplicate IDs
  let duplicateErrors = false;
  for (const [kiId, fileList] of idToFiles.entries()) {
    if (fileList.length > 1) {
      console.warn(`⚠️ Warning: Duplicate KI ID "${kiId}" shared across multiple files: ${fileList.join(', ')}`);
      duplicateErrors = true;
    }
  }

  // Check which KIs are missing from README.md
  const missingKis = [];
  for (const entry of kiEntries) {
    const isFileReferenced = readmeContent.includes(entry.file);
    if (!isFileReferenced) {
      missingKis.push(entry);
    }
  }

  if (missingKis.length > 0) {
    log(`⚠️ Found ${missingKis.length} Knowledge Item(s) missing from README.md:`);
    for (const m of missingKis) {
      log(`   - [${m.kiId}] ${m.file} ("${m.title}")`);
    }

    if (autoFix) {
      log(`⚡ Auto-fixing: Registering missing items into README.md master index...`);
      const tableHeaderMatch = readmeContent.match(/(\| ID \| Tiêu đề [^\n]+\n\| :--- [^\n]+\n)([\s\S]*?)(\n---|\n## 2\.)/);
      if (tableHeaderMatch) {
        let currentRows = tableHeaderMatch[2].trim().split('\n').filter(r => r.trim().startsWith('|'));
        for (const m of missingKis) {
          const newRow = `| [\`${m.kiId}\`](file:///docs/knowledge-base/${m.file}) | [${m.title}](file:///docs/knowledge-base/${m.file}) | \`${m.type}\` | \`${m.domain}\` | \`${m.status}\` | ${m.trigger} |`;
          currentRows.push(newRow);
        }

        currentRows.sort((a, b) => {
          const idA = (a.match(/`KI-[A-Z]+-\d+`/) || [''])[0];
          const idB = (b.match(/`KI-[A-Z]+-\d+`/) || [''])[0];
          return idA.localeCompare(idB);
        });

        const newTable = tableHeaderMatch[1] + currentRows.join('\n') + '\n' + tableHeaderMatch[3];
        readmeContent = readmeContent.replace(tableHeaderMatch[0], newTable);
        fs.writeFileSync(readmePath, readmeContent, 'utf8');
        log(`✅ Successfully updated docs/knowledge-base/README.md master index!`);
      } else {
        console.error(`❌ Could not locate Master Index table pattern in README.md.`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Verification failed: ${missingKis.length} Knowledge Item(s) not indexed in docs/knowledge-base/README.md. Run with --fix to sync.`);
      process.exit(1);
    }
  } else {
    log(`✅ All ${files.length} Knowledge Items are cleanly indexed in docs/knowledge-base/README.md.`);
  }

  log(`📊 Total KIs: ${files.length} (CON: ${kiEntries.filter(k => k.kiId.startsWith('KI-CON')).length}, FIX: ${kiEntries.filter(k => k.kiId.startsWith('KI-FIX')).length}, HOWTO: ${kiEntries.filter(k => k.kiId.startsWith('KI-HOWTO')).length})`);
  return duplicateErrors ? 1 : 0;
}

runVerification();
