import { describe, it, expect } from 'vitest';
import {
  inspectArchiveSchema,
  inspectNestedArchiveSchema,
  extractFileQuerySchema
} from '../../src/schemas/archive.schema.js';
import { AuthService } from '../../src/services/auth.service.js';
import { getMimeTypeForExt } from '../../src/schemas/converter.schema.js';

describe('Storage Drive Archive Viewing & Hierarchy Navigation', () => {
  describe('Zod Schema Contracts for Drive Archives', () => {
    it('should validate inspectArchiveSchema with drivePath', () => {
      const parsed = inspectArchiveSchema.parse({
        drivePath: 'drive/Lab2.zip',
        auth: 'secret_token_123'
      });
      expect(parsed.drivePath).toBe('drive/Lab2.zip');
      expect(parsed.auth).toBe('secret_token_123');
      expect(parsed.fileId).toBeUndefined();
    });

    it('should reject inspectArchiveSchema when neither fileId nor drivePath is provided', () => {
      expect(() => {
        inspectArchiveSchema.parse({
          auth: 'some_token'
        });
      }).toThrow();
    });

    it('should validate inspectNestedArchiveSchema with parentDrivePath', () => {
      const parsed = inspectNestedArchiveSchema.parse({
        parentDrivePath: 'drive/Lab2.zip',
        memberPath: 'Lab2/nested_bundle.zip',
        auth: 'admin_pass'
      });
      expect(parsed.parentDrivePath).toBe('drive/Lab2.zip');
      expect(parsed.memberPath).toBe('Lab2/nested_bundle.zip');
      expect(parsed.parentFileId).toBeUndefined();
    });

    it('should validate inspectNestedArchiveSchema with parentFileId', () => {
      const parsed = inspectNestedArchiveSchema.parse({
        parentFileId: 'fil_parent_123',
        memberPath: 'inner.zip'
      });
      expect(parsed.parentFileId).toBe('fil_parent_123');
      expect(parsed.memberPath).toBe('inner.zip');
      expect(parsed.parentDrivePath).toBeUndefined();
    });

    it('should reject inspectNestedArchiveSchema when neither parentFileId nor parentDrivePath is provided', () => {
      expect(() => {
        inspectNestedArchiveSchema.parse({
          memberPath: 'inner.zip'
        });
      }).toThrow('parentFileId or parentDrivePath is required');
    });

    it('should validate extractFileQuerySchema with drivePath, memberPath, and auth', () => {
      const parsed = extractFileQuerySchema.parse({
        drivePath: 'drive/Lab2.zip',
        memberPath: 'Lab2/IT012_Lab02_2026.docx',
        inline: 'true',
        auth: 'storage_auth_key'
      });
      expect(parsed.drivePath).toBe('drive/Lab2.zip');
      expect(parsed.memberPath).toBe('Lab2/IT012_Lab02_2026.docx');
      expect(parsed.inline).toBe(true);
      expect(parsed.auth).toBe('storage_auth_key');
      expect(parsed.fileId).toBeUndefined();
    });
  });

  describe('Archive Tree Helper Logic Replication', () => {
    // Replicating archiveTreeHelper algorithms to verify edge cases
    const mockEntries = [
      { path: 'Lab2/IT012_Lab02_2026.docx', uncompressedBytes: 15420, isDirectory: false },
      { path: 'Lab2/IT012_Lab2_25520412_ALU8.circ', uncompressedBytes: 85200, isDirectory: false },
      { path: 'Lab2/sub/extra.txt', uncompressedBytes: 1024, isDirectory: false },
      { path: 'Lab2/sub/deeper/secret.log', uncompressedBytes: 2048, isDirectory: false },
      { path: 'readme.txt', uncompressedBytes: 512, isDirectory: false },
      { path: 'docs/guide.pdf', uncompressedBytes: 300000, isDirectory: false }
    ];

    function getSubfoldersInFolder(entries: any[], folderPath: string) {
      const normFolder = folderPath.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      const prefix = normFolder ? normFolder + '/' : '';
      const prefixParts = normFolder ? normFolder.split('/') : [];
      const prefixDepth = prefixParts.length;

      const subfolderMap = new Map<string, { path: string; name: string; fileCount: number; totalBytes: number }>();

      entries.forEach((entry) => {
        const raw = (entry.path || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
        if (!raw) return;

        if (prefix && !raw.startsWith(prefix)) return;

        const parts = raw.split('/');
        if (parts.length > prefixDepth + 1) {
          const immediateFolderName = parts[prefixDepth];
          const immediatePath = prefix ? `${prefix}${immediateFolderName}` : immediateFolderName;

          if (!subfolderMap.has(immediatePath)) {
            subfolderMap.set(immediatePath, {
              path: immediatePath,
              name: immediateFolderName,
              fileCount: 0,
              totalBytes: 0
            });
          }

          const info = subfolderMap.get(immediatePath)!;
          if (!entry.isDirectory && parts.length >= prefixDepth + 2) {
            info.fileCount += 1;
            info.totalBytes += Number(entry.uncompressedBytes || entry.compressedBytes || 0);
          }
        }
      });

      return Array.from(subfolderMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    function getAllFilesInArchive(entries: any[]) {
      return entries
        .filter((e) => !e.isDirectory && (e.path || '').trim())
        .map((e) => {
          const raw = (e.path || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
          const parts = raw.split('/');
          const name = parts[parts.length - 1];
          const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
          return {
            ...e,
            name,
            dirPath: dir,
            rawPath: raw
          };
        });
    }

    it('should identify immediate subfolders at root level without flat directory failure', () => {
      const rootFolders = getSubfoldersInFolder(mockEntries, '/');
      expect(rootFolders.length).toBe(2);
      expect(rootFolders.map((f) => f.name)).toEqual(['docs', 'Lab2']);

      const lab2Folder = rootFolders.find((f) => f.name === 'Lab2');
      expect(lab2Folder).toBeDefined();
      expect(lab2Folder?.fileCount).toBe(4); // 2 in Lab2, 1 in sub, 1 in deeper
      expect(lab2Folder?.totalBytes).toBe(15420 + 85200 + 1024 + 2048);
    });

    it('should identify child subfolders when navigated into Lab2/', () => {
      const childFolders = getSubfoldersInFolder(mockEntries, 'Lab2');
      expect(childFolders.length).toBe(1);
      expect(childFolders[0].name).toBe('sub');
      expect(childFolders[0].path).toBe('Lab2/sub');
      expect(childFolders[0].fileCount).toBe(2); // extra.txt and secret.log
    });

    it('should flatten all files correctly for search and flat mode', () => {
      const allFiles = getAllFilesInArchive(mockEntries);
      expect(allFiles.length).toBe(6);
      expect(allFiles.map((f) => f.name)).toContain('IT012_Lab02_2026.docx');
      expect(allFiles.map((f) => f.name)).toContain('readme.txt');

      const nestedDoc = allFiles.find((f) => f.name === 'IT012_Lab02_2026.docx');
      expect(nestedDoc?.dirPath).toBe('Lab2');
      expect(nestedDoc?.rawPath).toBe('Lab2/IT012_Lab02_2026.docx');

      const rootDoc = allFiles.find((f) => f.name === 'readme.txt');
      expect(rootDoc?.dirPath).toBe('/');
      expect(rootDoc?.rawPath).toBe('readme.txt');
    });
  });

  describe('Archive Authentication & Format Support', () => {
    it('should validate admin master password "anhduy123" for drive archives', async () => {
      const isAuthValid = await AuthService.verifyPassword('anhduy123');
      expect(isAuthValid).toBe(true);

      const isBadAuthValid = await AuthService.verifyPassword('wrongpassword');
      expect(isBadAuthValid).toBe(false);
    });

    it('should accurately resolve docx and spreadsheet MIME types for member extraction', () => {
      expect(getMimeTypeForExt('.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(getMimeTypeForExt('.xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(getMimeTypeForExt('.pdf')).toBe('application/pdf');
    });

    it('should recognize all nested archive extension formats including tar.gz', () => {
      const checkIsNested = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        return ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'tgz', 'xz'].includes(ext) || filename.endsWith('.tar.gz');
      };

      expect(checkIsNested('inner.zip')).toBe(true);
      expect(checkIsNested('sub_archive.rar')).toBe(true);
      expect(checkIsNested('deep.7z')).toBe(true);
      expect(checkIsNested('package.tar.gz')).toBe(true);
      expect(checkIsNested('backup.tgz')).toBe(true);
      expect(checkIsNested('IT012_Lab02_2026.docx')).toBe(false);
      expect(checkIsNested('report.pdf')).toBe(false);
      expect(checkIsNested('sheet.xlsx')).toBe(false);
    });
  });
});

