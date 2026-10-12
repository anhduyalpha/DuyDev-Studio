import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Storage Drive Upload & Download Integrity Tests (v22.47)', () => {
  const projectRoot = path.resolve(__dirname, '../../../');

  it('verifies smartUploadFile appends file to FormData and omits manual Content-Type header', () => {
    const uploaderSrc = fs.readFileSync(path.join(projectRoot, 'src/utilities/resumableUploader.js'), 'utf-8');
    
    // Assert formData.append('file', file, file.name) exists
    expect(uploaderSrc).toContain("formData.append('file', file, file.name);");
    // Assert Content-Type is skipped when looping options.headers to avoid breaking multipart boundary
    expect(uploaderSrc).toContain("if (k.toLowerCase() === 'content-type') continue;");
  });

  it('verifies storageService imports getAdminToken and generates auth query parameter in getDownloadUrl', () => {
    const storageServiceSrc = fs.readFileSync(path.join(projectRoot, 'src/services/storageService.js'), 'utf-8');
    
    // Assert getAdminToken is imported
    expect(storageServiceSrc).toMatch(/import\s*{[^}]*getAdminToken[^}]*}\s*from\s*['"]\.\.\/utilities\/adminAuth\.js['"]/);
    // Assert getDownloadUrl calls getAdminToken() and appends &auth=
    expect(storageServiceSrc).toContain('const token = getAdminToken();');
    expect(storageServiceSrc).toContain('if (token) url += `&auth=${encodeURIComponent(token)}`;');
  });

  it('verifies StoragePage handleDownloadItem sets explicit filename and wraps in try-catch', () => {
    const storagePageSrc = fs.readFileSync(path.join(projectRoot, 'src/pages/StoragePage.js'), 'utf-8');
    
    expect(storagePageSrc).toContain('function handleDownloadItem(itemPath, isDir)');
    expect(storagePageSrc).toContain('a.download = isDir ? `${baseName}.zip` : baseName;');
    expect(storagePageSrc).toContain("showToast(err.message || 'Không thể tạo liên kết tải xuống', 'error');");
  });
});
