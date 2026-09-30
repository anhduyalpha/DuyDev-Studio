import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { ArchiveService } from '../../src/services/archive.service.js';
import { SecurityException, NotFoundError, FileCorruptedError } from '../../src/lib/errors.js';

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function createZipBuffer(files: { name: string; content: string | Buffer }[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const dataBuf = Buffer.isBuffer(f.content) ? f.content : Buffer.from(f.content, 'utf8');
    const crc = crc32(dataBuf);
    const size = dataBuf.length;

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(size, 18);
    lh.writeUInt32LE(size, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    localHeaders.push(lh, nameBuf, dataBuf);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);

    centralHeaders.push(cd, nameBuf);
    offset += 30 + nameBuf.length + size;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const b of centralHeaders) cdSize += b.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

describe('ArchiveService Unit Tests', () => {
  const testDir = path.resolve('tests/fixtures/sandbox');
  const validZipPath = path.join(testDir, 'sample_archive.zip');
  const corruptZipPath = path.join(testDir, 'corrupt.zip');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });

    const zipBuffer = createZipBuffer([
      { name: 'document.txt', content: 'Top-level document content' },
      { name: 'assets/image_desc.json', content: '{"desc":"sunset"}' }
    ]);
    await fs.writeFile(validZipPath, zipBuffer);

    // Write a corrupt pseudo-zip file
    await fs.writeFile(corruptZipPath, Buffer.from('NOT_A_REAL_ZIP_HEADER_DATA_12345'));
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should inspect archive central directory without full disk extraction', async () => {
    const result = await ArchiveService.inspectArchive(validZipPath);

    expect(result.archiveName).toBe('sample_archive.zip');
    expect(result.totalFiles).toBe(2);
    expect(result.totalUncompressedBytes).toBeGreaterThan(0);
    expect(result.format).toBe('ZIP');

    const filePaths = result.tree.map((t) => t.path);
    expect(filePaths).toContain('/document.txt');
    expect(filePaths).toContain('/assets/image_desc.json');

    const docEntry = result.tree.find((t) => t.path === '/document.txt');
    expect(docEntry?.crc32).toBeDefined();
    expect(docEntry?.sizeBytes).toBe(Buffer.from('Top-level document content').length);
  });

  it('should extract a single member directly via stream', async () => {
    const extracted = await ArchiveService.extractSingleMember(validZipPath, 'document.txt');
    expect(extracted.name).toBe('document.txt');
    expect(extracted.sizeBytes).toBe(Buffer.from('Top-level document content').length);

    const chunks: Buffer[] = [];
    for await (const chunk of extracted.stream) {
      chunks.push(chunk as Buffer);
    }
    const content = Buffer.concat(chunks).toString('utf8');
    expect(content).toBe('Top-level document content');
  });

  it('should reject Zip Slip path traversal attempts with SecurityException', async () => {
    await expect(
      ArchiveService.extractSingleMember(validZipPath, '../../../../etc/passwd')
    ).rejects.toThrow(SecurityException);

    await expect(
      ArchiveService.extractSingleMember(validZipPath, '..\\..\\Windows\\System32\\cmd.exe')
    ).rejects.toThrow(SecurityException);

    await expect(
      ArchiveService.extractSingleMember(validZipPath, '/absolute/path/file.txt')
    ).rejects.toThrow(SecurityException);
  });

  it('should throw NotFoundError for non-existent member', async () => {
    await expect(
      ArchiveService.extractSingleMember(validZipPath, 'does_not_exist.txt')
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw FileCorruptedError when opening corrupted archive', async () => {
    await expect(
      ArchiveService.inspectArchive(corruptZipPath)
    ).rejects.toThrow(FileCorruptedError);
  });

  it('should compress files into an archive and allow inspecting it', async () => {
    const sampleFile1 = path.join(testDir, 'file1.txt');
    const sampleFile2 = path.join(testDir, 'file2.txt');
    const outZip = path.join(testDir, 'output.zip');

    await fs.writeFile(sampleFile1, 'Sample file 1 content');
    await fs.writeFile(sampleFile2, 'Sample file 2 content');

    const res = await ArchiveService.compressFiles(
      [
        { filePath: sampleFile1, originalName: 'file1.txt' },
        { filePath: sampleFile2, originalName: 'sub/file2.txt' }
      ],
      outZip,
      'zip',
      'normal'
    );

    expect(res.sizeBytes).toBeGreaterThan(0);

    const inspected = await ArchiveService.inspectArchive(outZip);
    expect(inspected.totalFiles).toBe(2);
    expect(inspected.tree.map((t) => t.name)).toContain('file1.txt');
    expect(inspected.tree.map((t) => t.name)).toContain('file2.txt');
  });

  it('should support extracting and inspecting nested archives', async () => {
    const innerZipBuf = createZipBuffer([
      { name: 'inner_note.txt', content: 'Secret nested note' }
    ]);
    const outerZipPath = path.join(testDir, 'outer_with_nested.zip');
    const outerZipBuf = createZipBuffer([
      { name: 'readme.md', content: '# Readme' },
      { name: 'nested.zip', content: innerZipBuf }
    ]);
    await fs.writeFile(outerZipPath, outerZipBuf);

    // 1. Inspect outer
    const outerInspected = await ArchiveService.inspectArchive(outerZipPath);
    expect(outerInspected.totalFiles).toBe(2);
    expect(outerInspected.tree.map((t) => t.name)).toContain('nested.zip');

    // 2. Extract nested member
    const extracted = await ArchiveService.extractSingleMember(outerZipPath, 'nested.zip');
    const extractedNestedPath = path.join(testDir, 'extracted_nested.zip');
    const chunks: Buffer[] = [];
    for await (const chunk of extracted.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    await fs.writeFile(extractedNestedPath, Buffer.concat(chunks));

    // 3. Inspect extracted nested archive
    const innerInspected = await ArchiveService.inspectArchive(extractedNestedPath);
    expect(innerInspected.totalFiles).toBe(1);
    expect(innerInspected.tree[0].name).toBe('inner_note.txt');
  });
});
