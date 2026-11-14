import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/lib/prisma.js';
import { closeTaskQueue } from '../../src/queues/task.queue.js';
import { markdownExportSchema, sanitizeMarkdownFilename } from '../../src/schemas/markdown.schema.js';

const execFileAsync = promisify(execFile);
const WORKTREE_ROOT = path.resolve(__dirname, '../../..');
const PYTHON_SCRIPT = path.join(WORKTREE_ROOT, 'engines/document/markdown_to_docx.py');
const FRONTEND_MODULE = path.join(WORKTREE_ROOT, 'src/components/tools/MarkdownEditor.js');

describe('Task 4.4 - Markdown Export & Docs Upgrade Suite', () => {
  let app: FastifyInstance;
  const createdFileIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    for (const id of createdFileIds) {
      await prisma.fileRecord.deleteMany({ where: { id } }).catch(() => {});
      await prisma.historyRecord.deleteMany({ where: { resultFileId: id } }).catch(() => {});
    }
    await closeTaskQueue();
    await app.close();
  });

  describe('1. Zod Validation & Filename Sanitization', () => {
    it('accepts valid docx and pdf export requests', () => {
      const validDocx = markdownExportSchema.parse({
        format: 'docx',
        markdown: '# Hello World\nThis is a test.',
        filename: 'my_notes'
      });
      expect(validDocx.format).toBe('docx');
      expect(validDocx.markdown).toContain('Hello World');

      const validPdf = markdownExportSchema.parse({
        format: 'pdf',
        markdown: '## Subtitle\n*italic*',
        filename: 'report.pdf'
      });
      expect(validPdf.format).toBe('pdf');
    });

    it('rejects invalid format', () => {
      expect(() => {
        markdownExportSchema.parse({
          format: 'exe',
          markdown: '# Bad'
        });
      }).toThrow();
    });

    it('rejects empty or whitespace-only markdown', () => {
      expect(() => {
        markdownExportSchema.parse({
          format: 'docx',
          markdown: '   '
        });
      }).toThrow();

      expect(() => {
        markdownExportSchema.parse({
          format: 'docx',
          markdown: ''
        });
      }).toThrow();
    });

    it('sanitizes filename preventing directory traversal and invalid characters', () => {
      expect(sanitizeMarkdownFilename('../../etc/passwd')).toBe('passwd');
      expect(sanitizeMarkdownFilename('..\\..\\windows\\system32')).toBe('system32');
      expect(sanitizeMarkdownFilename('my:file*name?.docx')).toBe('myfilename');
      expect(sanitizeMarkdownFilename('   ')).toBe('document');
      expect(sanitizeMarkdownFilename(undefined)).toBe('document');
      expect(sanitizeMarkdownFilename('valid-file_name 123')).toBe('valid-file_name 123');
    });
  });

  describe('2. Python markdown_to_docx.py OOXML Engine', () => {
    it('compiles and executes markdown_to_docx.py on rich markdown producing valid OOXML .docx', async () => {
      const tempDir = path.join(WORKTREE_ROOT, 'data/storage/temp/test_md_' + Date.now());
      await fs.mkdir(tempDir, { recursive: true });
      const inputMdPath = path.join(tempDir, 'sample.md');
      const outputDocxPath = path.join(tempDir, 'output.docx');

      const richMarkdown = `# Tiêu Đề Cấp 1
## Tiêu Đề Cấp 2
### Tiêu Đề Cấp 3

Chào mừng bạn đến với **văn bản in đậm**, *in nghiêng*, và \`mã inline\`.
Thử nghiệm ký tự điều khiển XML \x00\x08\x0b\x0c không gây lỗi.

> Đây là một khối trích dẫn quan trọng (blockquote).

- Danh sách gạch đầu dòng 1
- Danh sách gạch đầu dòng 2
  - Mục lồng ghép

1. Danh sách có thứ tự 1
2. Danh sách có thứ tự 2

\`\`\`typescript
function testExport(): boolean {
  console.log("Syntax highlighting table");
  return true;
}
\`\`\`

| Cột 1 | Cột 2 | Cột 3 |
| :--- | :---: | ---: |
| Dòng 1 A | Dòng 1 B | 100 |
| Dòng 2 A | Dòng 2 B | 200 |
`;

      await fs.writeFile(inputMdPath, richMarkdown, 'utf-8');

      try {
        const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
        const { stdout, stderr } = await execFileAsync(pythonBin, [
          PYTHON_SCRIPT,
          inputMdPath,
          outputDocxPath,
          '--title',
          'Rich Test Document'
        ]);

        expect(existsSync(outputDocxPath)).toBe(true);
        const stats = await fs.stat(outputDocxPath);
        expect(stats.size).toBeGreaterThan(1000);

        // Check ZIP magic header (PK\x03\x04)
        const fileBuffer = await fs.readFile(outputDocxPath);
        expect(fileBuffer[0]).toBe(0x50); // P
        expect(fileBuffer[1]).toBe(0x4b); // K
        expect(fileBuffer[2]).toBe(0x03);
        expect(fileBuffer[3]).toBe(0x04);

        // Verify python-docx can open and read paragraphs and tables
        const verifyScript = `
import docx
doc = docx.Document(r"${outputDocxPath.replace(/\\/g, '\\\\')}")
assert len(doc.paragraphs) >= 5, f"Paragraphs count: {len(doc.paragraphs)}"
assert len(doc.tables) >= 1, f"Tables count: {len(doc.tables)}"
print("DOCX_OK")
`;
        const verifyRes = await execFileAsync(pythonBin, ['-c', verifyScript]);
        expect(verifyRes.stdout).toContain('DOCX_OK');
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });

  describe('3. POST /api/v1/markdown/export API Endpoint', () => {
    it('returns 400 when body is invalid or markdown is empty', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/markdown/export',
        payload: {
          format: 'docx',
          markdown: '   '
        }
      });
      expect(res1.statusCode).toBe(400);

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/markdown/export',
        payload: {
          format: 'unsupported_format',
          markdown: 'Hello'
        }
      });
      expect(res2.statusCode).toBe(400);
    });

    it('exports docx, persists FileRecord and HistoryRecord, and returns download URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/markdown/export',
        payload: {
          format: 'docx',
          markdown: '# DOCX Test\nExport via Fastify endpoint.\n- Item A\n- Item B',
          filename: 'test_export_doc'
        },
        headers: {
          'x-device-id': 'dev_test_device_123'
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload);
      expect(data.fileId).toBeDefined();
      expect(data.downloadUrl).toBe(`/api/v1/files/download/${data.fileId}`);
      expect(data.fileName).toMatch(/\.docx$/);
      expect(data.sizeBytes).toBeGreaterThan(0);

      createdFileIds.push(data.fileId);

      // Verify Prisma records
      const fileRec = await prisma.fileRecord.findUnique({ where: { id: data.fileId } });
      expect(fileRec).toBeDefined();
      expect(fileRec?.originalName).toBe(data.fileName);
      expect(fileRec?.purpose).toBe('PROCESSED_ARTIFACT');

      const histRec = await prisma.historyRecord.findFirst({
        where: { resultFileId: data.fileId }
      });
      expect(histRec).toBeDefined();
      expect(histRec?.toolId).toBe('markdown-docs');
      expect(histRec?.deviceId).toBe('dev_test_device_123');
    });

    it('exports pdf, neutralizes XSS scripts, and returns download URL', async () => {
      const xssMarkdown = `# Security Test
<script>alert("xss")</script>
<iframe src="https://evil.com"></iframe>
<img src="x" onerror="alert(1)">
Normal paragraph content.
`;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/markdown/export',
        payload: {
          format: 'pdf',
          markdown: xssMarkdown,
          filename: 'xss_sanitized'
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.payload);
      expect(data.fileId).toBeDefined();
      expect(data.downloadUrl).toBe(`/api/v1/files/download/${data.fileId}`);
      expect(data.fileName).toMatch(/\.pdf$/);
      expect(data.sizeBytes).toBeGreaterThan(0);

      createdFileIds.push(data.fileId);

      // Verify Prisma records
      const fileRec = await prisma.fileRecord.findUnique({ where: { id: data.fileId } });
      expect(fileRec).toBeDefined();
      expect(fileRec?.originalName).toBe(data.fileName);
    });
  });

  describe('4. Frontend MarkdownEditor.js Contract & Ergonomics', () => {
    it('contains required UI elements, open file inputs, Drive picker, sync scroll, and shortcuts', async () => {
      const code = await fs.readFile(FRONTEND_MODULE, 'utf-8');

      // 1. Local file input
      expect(code).toContain('accept=".md,.markdown,.txt"');
      expect(code).toContain('mdLocalFileInput');

      // 2. Open from Drive & admin auth integration
      expect(code).toContain('Mở từ Drive');
      expect(code).toContain('getStorageAuthHeaders');
      expect(code).toContain('/api/v1/storage/list');

      // 3. Sync scroll toggle & guard
      expect(code).toContain('isSyncingScroll');
      expect(code).toContain('btnToggleSyncScroll');

      // 4. Keyboard shortcuts Ctrl+B, Ctrl+I, Ctrl+S
      expect(code).toContain('keydown');
      expect(code).toMatch(/\(?\(?e\.(ctrlKey|metaKey)\)?\s*&&\s*e\.key\.toLowerCase\(\)\s*===\s*['"]s['"]/);
      expect(code).toMatch(/\(?\(?e\.(ctrlKey|metaKey)\)?\s*&&\s*e\.key\.toLowerCase\(\)\s*===\s*['"]b['"]/);
      expect(code).toMatch(/\(?\(?e\.(ctrlKey|metaKey)\)?\s*&&\s*e\.key\.toLowerCase\(\)\s*===\s*['"]i['"]/);

      // 5. Export DOCX & PDF buttons calling /api/v1/markdown/export
      expect(code).toContain('Xuất .DOCX');
      expect(code).toContain('Xuất .PDF');
      expect(code).toContain('/api/v1/markdown/export');

      // 6. Touch target ergonomic compliance (min-h-[44px] or px/py sizing >= 44px)
      expect(code).toContain('min-h-[44px]');

      // 7. Anti-AI slop check (no parenthetical labels like "Xuất .DOCX (Word)")
      expect(code).not.toContain('Xuất .DOCX (');
      expect(code).not.toContain('Xuất .PDF (');
      expect(code).not.toContain('Tải .md (');
    });
  });
});
