"""
DD Studio - Unified Archive Engine
Supports inspection, extraction, and compression for ZIP, TAR, TAR.GZ, TGZ, 7Z, RAR.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tarfile
import zipfile


def find_7z_binary():
    """Locate 7z or 7za executable if available on system."""
    for cmd in ['7z', '7za']:
        path = shutil.which(cmd)
        if path:
            return path
    if sys.platform == 'win32':
        candidates = [
            r'C:\WINDOWS\system32\7z.exe',
            r'C:\Program Files\7-Zip\7z.exe',
            r'C:\Program Files (x86)\7-Zip\7z.exe'
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
    return None


def inspect_with_7z(seven_zip: str, file_path: str):
    cmd = [seven_zip, 'l', '-slt', '-bd', file_path]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, errors='replace')
    if res.returncode != 0:
        return None

    format_name = 'ARCHIVE'
    for line in res.stdout.splitlines():
        if line.strip().startswith('Type = '):
            format_name = line.strip().split(' = ', 1)[1].upper()
            break

    # 7z separates the header info from file entries with '----------'
    parts = res.stdout.split('----------\n')
    if len(parts) < 2:
        parts = res.stdout.split('----------\r\n')
    if len(parts) < 2:
        return None

    body = parts[1]
    raw_blocks = body.split('\n\n')
    entries = []

    for block in raw_blocks:
        current_item = {}
        for line in block.splitlines():
            if ' = ' in line:
                k, v = line.split(' = ', 1)
                current_item[k.strip()] = v.strip()
        if current_item.get('Path'):
            _add_7z_entry(current_item, entries)

    if not entries:
        return None

    clean_entries = [e for e in entries if e['path'] != '/' and not e['path'].endswith(os.path.basename(file_path))]
    total_files = len([e for e in clean_entries if not e['isDirectory']])
    total_uncompressed = sum(e['sizeBytes'] for e in clean_entries if not e['isDirectory'])
    total_compressed = sum(e['compressedBytes'] for e in clean_entries if not e['isDirectory'])

    return {
        'archiveName': os.path.basename(file_path),
        'totalFiles': total_files,
        'totalUncompressedBytes': total_uncompressed,
        'totalCompressedBytes': total_compressed,
        'format': format_name,
        'tree': clean_entries,
        'entries': clean_entries
    }


def _add_7z_entry(item: dict, entries: list):
    path_val = item.get('Path', '').replace('\\', '/').lstrip('/')
    if not path_val:
        return
    is_dir = item.get('Folder') == '+' or path_val.endswith('/')
    size = int(item.get('Size', '0') or '0')
    packed = int(item.get('Packed Size', str(size)) or str(size))
    ratio = round(packed / size, 2) if size > 0 else 1.0
    entries.append({
        'path': '/' + path_val,
        'name': os.path.basename(path_val) or path_val,
        'isDirectory': is_dir,
        'sizeBytes': size,
        'compressedBytes': packed,
        'compressionRatio': ratio,
        'crc32': item.get('CRC'),
        'lastModified': item.get('Modified')
    })


def inspect_with_python(file_path: str):
    tree = []
    format_name = 'UNKNOWN'

    if tarfile.is_tarfile(file_path):
        with tarfile.open(file_path, 'r:*') as tf:
            for member in tf.getmembers():
                norm = '/' + member.name.replace('\\', '/').lstrip('/')
                tree.append({
                    'path': norm,
                    'name': os.path.basename(member.name) or member.name,
                    'isDirectory': member.isdir(),
                    'sizeBytes': member.size,
                    'compressedBytes': member.size,
                    'compressionRatio': 1.0,
                    'lastModified': None
                })
        format_name = 'TAR.GZ' if file_path.lower().endswith(('.tar.gz', '.tgz')) else 'TAR'

    elif zipfile.is_zipfile(file_path):
        with zipfile.ZipFile(file_path, 'r') as zf:
            for info in zf.infolist():
                norm = '/' + info.filename.replace('\\', '/').lstrip('/')
                tree.append({
                    'path': norm,
                    'name': os.path.basename(info.filename) or info.filename,
                    'isDirectory': info.is_dir(),
                    'sizeBytes': info.file_size,
                    'compressedBytes': info.compress_size,
                    'compressionRatio': round(info.compress_size / info.file_size, 2) if info.file_size > 0 else 1.0,
                    'crc32': f"{info.CRC:08X}",
                    'lastModified': None
                })
        format_name = 'ZIP'
    else:
        return None

    total_files = len([e for e in tree if not e['isDirectory']])
    total_uncompressed = sum(e['sizeBytes'] for e in tree if not e['isDirectory'])
    total_compressed = sum(e['compressedBytes'] for e in tree if not e['isDirectory'])

    return {
        'archiveName': os.path.basename(file_path),
        'totalFiles': total_files,
        'totalUncompressedBytes': total_uncompressed,
        'totalCompressedBytes': total_compressed,
        'format': format_name,
        'tree': tree,
        'entries': tree
    }


def handle_inspect(args):
    path = os.path.abspath(args.file)
    if not os.path.exists(path):
        print(json.dumps({'success': False, 'error': f"File not found: {path}"}))
        sys.exit(1)

    # 1. Try 7z CLI first (handles rar, 7z, tar, zip, gz, bz2)
    seven_zip = find_7z_binary()
    res = inspect_with_7z(seven_zip, path) if seven_zip else None

    # 2. Fall back to Python built-in tarfile/zipfile
    if not res:
        res = inspect_with_python(path)

    if res:
        print(json.dumps({'success': True, 'data': res}))
        sys.exit(0)
    else:
        print(json.dumps({'success': False, 'error': 'Cannot parse archive or unsupported format'}))
        sys.exit(1)


def handle_extract(args):
    archive_path = os.path.abspath(args.file)
    target_member = args.member.replace('\\', '/').lstrip('/')

    seven_zip = find_7z_binary()
    if seven_zip:
        cmd = [seven_zip, 'e', '-so', '-bd', archive_path, target_member]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, err = proc.communicate()
        if proc.returncode == 0 and len(out) > 0:
            sys.stdout.buffer.write(out)
            sys.exit(0)

    # Fallback to Python tarfile
    if tarfile.is_tarfile(archive_path):
        with tarfile.open(archive_path, 'r:*') as tf:
            for m in tf.getmembers():
                if m.name.replace('\\', '/').lstrip('/') == target_member:
                    f = tf.extractfile(m)
                    if f:
                        shutil.copyfileobj(f, sys.stdout.buffer)
                        sys.exit(0)

    # Fallback to Python zipfile
    if zipfile.is_zipfile(archive_path):
        with zipfile.ZipFile(archive_path, 'r') as zf:
            for name in zf.namelist():
                if name.replace('\\', '/').lstrip('/') == target_member:
                    with zf.open(name) as f:
                        shutil.copyfileobj(f, sys.stdout.buffer)
                        sys.exit(0)

    sys.stderr.write(f"Member '{target_member}' not found in archive\n")
    sys.exit(1)


def handle_compress(args):
    output_path = os.path.abspath(args.output)
    fmt = args.format.lower().lstrip('.')
    items = json.loads(args.files)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    if fmt in ['tar.gz', 'tgz', 'tar']:
        mode = 'w:gz' if 'gz' in fmt else 'w'
        with tarfile.open(output_path, mode) as tf:
            for item in items:
                tf.add(item['filePath'], arcname=item['originalName'])
    elif fmt == '7z':
        seven_zip = find_7z_binary()
        if seven_zip:
            cmd = [seven_zip, 'a', '-t7z', '-mx7', '-bd', output_path]
            # Add files
            for item in items:
                cmd.append(item['filePath'])
            subprocess.run(cmd, check=True)
        else:
            with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
                for item in items:
                    zf.write(item['filePath'], arcname=item['originalName'])
    else:  # zip
        level = 9 if args.level == 'maximum' else 1 if args.level == 'fast' else 6
        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=level) as zf:
            for item in items:
                zf.write(item['filePath'], arcname=item['originalName'])

    size_bytes = os.path.getsize(output_path)
    print(json.dumps({'success': True, 'data': {'sizeBytes': size_bytes}}))
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="DD Studio Universal Archive Engine")
    subparsers = parser.add_subparsers(dest='command', required=True)

    p_inspect = subparsers.add_parser('inspect')
    p_inspect.add_argument('--file', required=True)

    p_extract = subparsers.add_parser('extract')
    p_extract.add_argument('--file', required=True)
    p_extract.add_argument('--member', required=True)

    p_compress = subparsers.add_parser('compress')
    p_compress.add_argument('--output', required=True)
    p_compress.add_argument('--format', default='zip')
    p_compress.add_argument('--level', default='normal')
    p_compress.add_argument('--files', required=True)

    args = parser.parse_args()
    if args.command == 'inspect':
        handle_inspect(args)
    elif args.command == 'extract':
        handle_extract(args)
    elif args.command == 'compress':
        handle_compress(args)


if __name__ == '__main__':
    main()
