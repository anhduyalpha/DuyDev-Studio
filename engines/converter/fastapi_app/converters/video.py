"""
Universal Media Converter - Enhanced Version 2.0
Converts video and audio files using FFmpeg with Smart Stream Copy, multi-threaded presets, and real-time progress.
"""
import os
import asyncio
import shutil
import json

VIDEO_FORMATS = ['mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'm4v', '3gp', 'mpeg', 'mpg', 'ts']
AUDIO_FORMATS = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'aiff', 'opus', 'ac3', 'amr', 'm4r']


async def _probe_media(ffprobe_cmd: str, input_path: str) -> dict:
    """Probes media metadata (duration, codecs, resolution) using ffprobe."""
    if not ffprobe_cmd:
        return {}
    cmd = [
        ffprobe_cmd,
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        input_path
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        if proc.returncode == 0:
            return json.loads(out.decode('utf-8', errors='ignore'))
    except Exception:
        pass
    return {}


async def convert_media(
    input_path: str,
    output_dir: str,
    target_format: str,
    quality: str = "high",
    resolution: str = None,
    fps: str = None,
    bitrate: str = None,
    on_progress=None
) -> dict:
    """Generic FFmpeg converter for video and audio files with Smart Stream Copy and progress."""
    try:
        ffmpeg_cmd = shutil.which("ffmpeg")
        ffprobe_cmd = shutil.which("ffprobe")
        if not ffmpeg_cmd:
            return {"success": False, "error": "Không tìm thấy FFmpeg trên hệ thống. Vui lòng cài đặt FFmpeg."}

        filename = os.path.basename(input_path)
        name, ext = os.path.splitext(filename)
        src_ext = ext.lower().lstrip('.')
        target_fmt = target_format.lower().lstrip('.')
        output_filename = f"{name}.{target_fmt}"
        output_path = os.path.join(output_dir, output_filename)

        probe_info = await _probe_media(ffprobe_cmd, input_path) if ffprobe_cmd else {}
        total_duration = float(probe_info.get('format', {}).get('duration', 0) or 0)

        # Check for Smart Stream Copy (-c copy)
        # Compatible containers when codecs match and no resizing/fps modification requested
        is_remux_candidate = (
            src_ext in ['mkv', 'mov', 'flv', 'ts', 'm4v'] and target_fmt == 'mp4' or
            src_ext in ['mp4', 'mov', 'ts'] and target_fmt == 'mkv'
        )
        has_transform = (
            (resolution and str(resolution).lower() not in ['original', 'gốc', 'none', '']) or
            (fps and str(fps).lower() not in ['original', 'gốc', 'none', ''])
        )

        v_streams = [s for s in probe_info.get('streams', []) if s.get('codec_type') == 'video']
        a_streams = [s for s in probe_info.get('streams', []) if s.get('codec_type') == 'audio']
        v_codec = v_streams[0].get('codec_name', '').lower() if v_streams else ''
        a_codec = a_streams[0].get('codec_name', '').lower() if a_streams else ''

        can_stream_copy = (
            is_remux_candidate and not has_transform and
            v_codec in ['h264', 'avc1'] and target_fmt == 'mp4'
        )

        cmd = [ffmpeg_cmd, '-y', '-i', input_path]

        if can_stream_copy:
            if on_progress:
                on_progress(50, "Đang chuyển đổi tức thì (Smart Stream Copy)...")
            cmd.extend(['-c:v', 'copy'])
            if a_codec == 'aac':
                cmd.extend(['-c:a', 'copy'])
            else:
                cmd.extend(['-c:a', 'aac', '-b:a', '192k'])
            cmd.extend(['-movflags', '+faststart'])
        else:
            options = _get_format_options(target_fmt, quality, resolution, fps, bitrate)
            cmd.extend(options)

        cmd.extend(['-progress', 'pipe:1', output_path])

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # Asynchronously read progress stream from FFmpeg
        async def read_progress():
            last_pct = 35
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded = line.decode('utf-8', errors='ignore').strip()
                if decoded.startswith('out_time_us='):
                    try:
                        out_us = int(decoded.split('=')[1])
                        current_sec = out_us / 1000000.0
                        if total_duration > 0:
                            pct = min(92, max(35, int(35 + (current_sec / total_duration) * 57)))
                            if pct > last_pct and (pct - last_pct >= 4 or pct >= 90):
                                last_pct = pct
                                if on_progress:
                                    on_progress(pct, f"Đang mã hóa đa luồng ({pct}%)...")
                    except Exception:
                        pass

        progress_task = asyncio.create_task(read_progress())
        _, stderr = await asyncio.wait_for(process.communicate(), timeout=900)  # 15 min timeout
        await progress_task

        if process.returncode == 0:
            return {"success": True, "output_path": output_path, "filename": output_filename}
        else:
            error_msg = stderr.decode('utf-8', errors='ignore')[-300:] if stderr else "Không rõ nguyên nhân"
            return {"success": False, "error": f"Lỗi FFmpeg: {error_msg.strip()}"}

    except asyncio.TimeoutError:
        return {"success": False, "error": "Quá trình chuyển đổi vượt quá thời gian chờ (15 phút)"}
    except Exception as e:
        return {"success": False, "error": f"Lỗi chuyển đổi đa phương tiện: {str(e)}"}


def _get_format_options(
    target_format: str,
    quality: str,
    resolution: str = None,
    fps: str = None,
    bitrate: str = None
) -> list:
    """Get FFmpeg options for target format with resolution, fps, and bitrate options."""
    options = []

    # Resolution filter
    res_str = str(resolution or '').lower().strip()
    if res_str in ['1080p', '1080']:
        options.extend(['-vf', 'scale=-2:1080'])
    elif res_str in ['720p', '720']:
        options.extend(['-vf', 'scale=-2:720'])
    elif res_str in ['480p', '480']:
        options.extend(['-vf', 'scale=-2:480'])

    # FPS filter
    fps_str = str(fps or '').lower().strip()
    if fps_str in ['30', '60']:
        options.extend(['-r', fps_str])

    # === AUDIO FORMATS ===
    if target_format in AUDIO_FORMATS:
        options.append('-vn')
        custom_bitrate = bitrate if bitrate and bitrate != 'original' else None

        if target_format == 'mp3':
            b = custom_bitrate or ('320k' if quality == 'high' else '192k')
            options.extend(['-acodec', 'libmp3lame', '-ab', b])

        elif target_format == 'wav':
            options.extend(['-acodec', 'pcm_s16le', '-ar', '44100'])

        elif target_format in ['aac', 'm4a']:
            b = custom_bitrate or ('256k' if quality == 'high' else '192k')
            options.extend(['-acodec', 'aac', '-ab', b])

        elif target_format == 'ogg':
            options.extend(['-acodec', 'libvorbis', '-aq', '8' if quality == 'high' else '5'])

        elif target_format == 'flac':
            options.extend(['-acodec', 'flac', '-compression_level', '8'])

        elif target_format == 'opus':
            b = custom_bitrate or ('192k' if quality == 'high' else '128k')
            options.extend(['-acodec', 'libopus', '-ab', b])

        elif target_format == 'aiff':
            options.extend(['-acodec', 'pcm_s16be'])

        elif target_format == 'ac3':
            options.extend(['-acodec', 'ac3', '-ab', '384k'])

        elif target_format == 'wma':
            options.extend(['-acodec', 'wmav2', '-ab', '192k'])

        elif target_format == 'm4r':
            options.extend(['-acodec', 'aac', '-ab', '128k', '-t', '30'])

    # === VIDEO FORMATS ===
    elif target_format == 'gif':
        options.extend([
            '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
            '-loop', '0'
        ])

    elif target_format in VIDEO_FORMATS:
        if target_format == 'mp4':
            # Fast multi-threaded encoding preset
            options.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-threads', '0', '-c:a', 'aac', '-movflags', '+faststart'])
            if quality == 'high':
                options.extend(['-crf', '20'])
            else:
                options.extend(['-crf', '24'])

        elif target_format == 'webm':
            # Fast VP9 multi-threaded encoding
            options.extend(['-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-threads', '0', '-c:a', 'libopus'])
            if quality == 'high':
                options.extend(['-b:v', '3M', '-crf', '24'])
            else:
                options.extend(['-b:v', '1.8M', '-crf', '32'])

        elif target_format == 'mkv':
            options.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-threads', '0', '-c:a', 'aac'])
            if quality == 'high':
                options.extend(['-crf', '20'])
            else:
                options.extend(['-crf', '24'])

        elif target_format == 'mov':
            options.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-threads', '0', '-c:a', 'aac', '-tag:v', 'avc1'])
            if quality == 'high':
                options.extend(['-crf', '20'])
            else:
                options.extend(['-crf', '24'])

        elif target_format == 'avi':
            options.extend(['-c:v', 'mpeg4', '-c:a', 'mp3', '-q:v', '4' if quality == 'high' else '6'])

        elif target_format == 'wmv':
            options.extend(['-c:v', 'wmv2', '-c:a', 'wmav2', '-b:v', '2M'])

        elif target_format == 'flv':
            options.extend(['-c:v', 'flv', '-c:a', 'mp3', '-ar', '44100'])

        elif target_format == 'm4v':
            options.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-threads', '0', '-c:a', 'aac'])

        elif target_format == '3gp':
            options.extend(['-c:v', 'h263', '-c:a', 'amr_nb', '-s', '352x288', '-ar', '8000'])

        elif target_format in ['mpeg', 'mpg']:
            options.extend(['-c:v', 'mpeg2video', '-c:a', 'mp2'])

    return options
