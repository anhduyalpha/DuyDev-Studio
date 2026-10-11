"""
Smart Image Converter - Enhanced Version 2.0
Converts images between all major formats using Pillow and PyMuPDF (no CairoSVG required).
Supports: JPG, PNG, WEBP, HEIC, SVG, ICO, BMP, GIF, TIFF, AVIF, PDF
"""
import os
import asyncio
from PIL import Image

# Register HEIF/HEIC opener if available
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HAS_HEIF = True
except ImportError:
    HAS_HEIF = False

# Check AVIF support
try:
    from PIL import features
    HAS_AVIF = features.check('avif')
except Exception:
    HAS_AVIF = False


async def convert_image(
    input_path: str,
    output_dir: str,
    target_format: str,
    quality: str = "high",
    width: int = None,
    height: int = None
) -> dict:
    """Image converter with format detection, PyMuPDF SVG support, resizing, and quality options."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _process_image, input_path, output_dir, target_format, quality, width, height
    )


def _parse_quality(quality_val) -> int:
    """Parses quality string or number to integer between 10 and 100."""
    try:
        q_int = int(quality_val)
        return max(10, min(100, q_int))
    except (ValueError, TypeError):
        q_str = str(quality_val).lower().strip()
        if q_str == 'low':
            return 60
        elif q_str == 'medium':
            return 80
        return 95  # 'high' or default


def _apply_resize(img: Image.Image, width: int = None, height: int = None) -> Image.Image:
    """Resizes image using LANCZOS filter respecting aspect ratio if one dimension is given."""
    orig_w, orig_h = img.size
    if width and height:
        target_w, target_h = int(width), int(height)
    elif width:
        target_w = int(width)
        target_h = max(1, int(round(orig_h * (target_w / orig_w))))
    elif height:
        target_h = int(height)
        target_w = max(1, int(round(orig_w * (target_h / orig_h))))
    else:
        return img

    if target_w > 0 and target_h > 0 and (target_w != orig_w or target_h != orig_h):
        return img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return img


def _process_image(
    input_path: str,
    output_dir: str,
    target_format: str,
    quality: str = "high",
    width: int = None,
    height: int = None
) -> dict:
    try:
        filename = os.path.basename(input_path)
        name, ext = os.path.splitext(filename)
        ext_lower = ext.lower()
        target_fmt = target_format.lower().lstrip('.')
        output_filename = f"{name}.{target_fmt}"
        output_path = os.path.join(output_dir, output_filename)

        quality_value = _parse_quality(quality)

        # === SVG HANDLING (Vector format rendered via PyMuPDF at sharp 2K resolution) ===
        if ext_lower == '.svg':
            return _convert_svg(input_path, output_path, output_filename, target_fmt, quality_value, width, height)

        # === RASTER IMAGE HANDLING ===
        with Image.open(input_path) as img:
            img = _apply_resize(img, width, height)
            original_mode = img.mode

            # Convert to RGB for formats that don't support alpha channel
            if target_fmt in ['jpg', 'jpeg', 'bmp', 'pdf'] and original_mode in ['RGBA', 'P', 'LA']:
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                if img.mode in ['RGBA', 'LA']:
                    background.paste(img, mask=img.split()[-1])
                    img = background
                else:
                    img = img.convert('RGB')

            # Format-specific save options
            if target_fmt in ['jpg', 'jpeg']:
                img.save(
                    output_path,
                    'JPEG',
                    quality=quality_value,
                    subsampling=0 if quality_value >= 85 else 2,
                    optimize=True
                )

            elif target_fmt == 'png':
                save_kwargs = {'optimize': True}
                if quality_value < 80:
                    save_kwargs['compress_level'] = 9
                img.save(output_path, 'PNG', **save_kwargs)

            elif target_fmt == 'webp':
                save_kwargs = {
                    'quality': quality_value,
                    'method': 6 if quality_value >= 85 else 4
                }
                if getattr(img, 'n_frames', 1) > 1:
                    save_kwargs['save_all'] = True
                img.save(output_path, 'WEBP', **save_kwargs)

            elif target_fmt == 'gif':
                if img.mode != 'P':
                    img = img.convert('P', palette=Image.ADAPTIVE, colors=256)
                save_kwargs = {'optimize': True}
                if getattr(img, 'n_frames', 1) > 1:
                    save_kwargs['save_all'] = True
                    save_kwargs['loop'] = 0
                img.save(output_path, 'GIF', **save_kwargs)

            elif target_fmt == 'bmp':
                if img.mode not in ['RGB', 'L', 'P']:
                    img = img.convert('RGB')
                img.save(output_path, 'BMP')

            elif target_fmt in ['tiff', 'tif']:
                img.save(output_path, 'TIFF', compression='tiff_lzw' if quality_value >= 80 else 'tiff_deflate')

            elif target_fmt == 'ico':
                sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
                img_copy = img.copy()
                img_copy.thumbnail((256, 256), Image.Resampling.LANCZOS)
                img_copy.save(output_path, 'ICO', sizes=sizes)

            elif target_fmt == 'pdf':
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(output_path, 'PDF', resolution=150.0)

            elif target_fmt in ['heic', 'heif']:
                if not HAS_HEIF:
                    return {"success": False, "error": "Thư viện pillow-heif chưa được cài đặt. Vui lòng chạy 'pip install pillow-heif'"}
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                img.save(output_path, 'HEIF', quality=quality_value)

            elif target_fmt == 'avif':
                if not HAS_AVIF:
                    return {"success": False, "error": "Định dạng AVIF yêu cầu Pillow 9.1+ và thư viện libavif trên hệ thống"}
                img.save(output_path, 'AVIF', quality=quality_value)

            else:
                img.save(output_path)

        return {"success": True, "output_path": output_path, "filename": output_filename}

    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi hình ảnh: {str(e)}"}


def _convert_svg(
    input_path: str,
    output_path: str,
    output_filename: str,
    target_format: str,
    quality_value: int,
    width: int = None,
    height: int = None
) -> dict:
    """Converts SVG vector files to any image format using PyMuPDF at sharp 2K resolution."""
    try:
        import pymupdf  # PyMuPDF
    except ImportError:
        try:
            import fitz as pymupdf
        except ImportError:
            return {"success": False, "error": "Thư viện PyMuPDF chưa được cài đặt. Vui lòng chạy 'pip install PyMuPDF'"}

    try:
        doc = pymupdf.open(input_path)
        if len(doc) == 0:
            doc.close()
            return {"success": False, "error": "Tệp SVG rỗng hoặc không có nội dung trang"}

        page = doc[0]
        rect = page.rect
        orig_w = max(1.0, float(rect.width))
        orig_h = max(1.0, float(rect.height))

        # Determine target pixel resolution
        if width and height:
            scale_x = float(width) / orig_w
            scale_y = float(height) / orig_h
            mat = pymupdf.Matrix(scale_x, scale_y)
        elif width:
            s = float(width) / orig_w
            mat = pymupdf.Matrix(s, s)
        elif height:
            s = float(height) / orig_h
            mat = pymupdf.Matrix(s, s)
        else:
            # Default sharp 2K resolution (2048px on longest edge)
            max_dim = max(orig_w, orig_h)
            scale = 2048.0 / max_dim if max_dim > 0 else 2.0
            scale = max(1.0, min(8.0, scale))  # Bound scale
            mat = pymupdf.Matrix(scale, scale)

        pix = page.get_pixmap(matrix=mat, alpha=True)
        img = Image.frombytes("RGBA", [pix.width, pix.height], pix.samples)
        doc.close()

        # Save to target format via Pillow
        if target_format in ['jpg', 'jpeg']:
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            bg.save(output_path, 'JPEG', quality=quality_value, subsampling=0, optimize=True)

        elif target_format == 'png':
            img.save(output_path, 'PNG', optimize=True)

        elif target_format == 'webp':
            img.save(output_path, 'WEBP', quality=quality_value, method=6)

        elif target_format == 'ico':
            sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
            img_copy = img.copy()
            img_copy.thumbnail((256, 256), Image.Resampling.LANCZOS)
            img_copy.save(output_path, 'ICO', sizes=sizes)

        elif target_format == 'bmp':
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            bg.save(output_path, 'BMP')

        elif target_format in ['tiff', 'tif']:
            img.save(output_path, 'TIFF', compression='tiff_lzw')

        elif target_format == 'pdf':
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            bg.save(output_path, 'PDF', resolution=150.0)

        elif target_format == 'gif':
            p_img = img.convert('P', palette=Image.ADAPTIVE, colors=256)
            p_img.save(output_path, 'GIF', optimize=True)

        else:
            img.save(output_path)

        return {"success": True, "output_path": output_path, "filename": output_filename}

    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi SVG: {str(e)}"}
