import { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import path from 'path';
import {
  youtubeResolveBodySchema,
  youtubeDownloadBodySchema,
  youtubeSaveDriveBodySchema
} from '../../schemas/youtube.schema.js';
import { YouTubeService } from '../../services/youtube.service.js';
import { BadRequestError } from '../../lib/errors.js';

export async function resolveYouTubeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = youtubeResolveBodySchema.parse(request.body);
  const data = await YouTubeService.resolve(body.url);
  return reply.send({
    success: true,
    data
  });
}

export async function downloadYouTubeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = youtubeDownloadBodySchema.parse(request.body);
  const data = await YouTubeService.download(body);
  return reply.send({
    success: true,
    data
  });
}

export async function saveToDriveYouTubeHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = youtubeSaveDriveBodySchema.parse(request.body);
  const data = await YouTubeService.download({
    url: body.url,
    type: body.type,
    quality: body.quality,
    customFilename: body.title,
    saveToDrive: true
  });
  return reply.send({
    success: true,
    data
  });
}

export async function streamYouTubeHandler(
  request: FastifyRequest<{ Params: { filename: string }; Querystring: { download?: string } }>,
  reply: FastifyReply
) {
  const { filename } = request.params;
  if (!filename) {
    throw new BadRequestError('Tên tệp không hợp lệ');
  }

  const filePath = YouTubeService.getDownloadedFilePath(filename);
  const stat = await fs.promises.stat(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'video/mp4';

  const isDownload = request.query.download === 'true' || request.query.download === '1';
  const disposition = isDownload ? 'attachment' : 'inline';
  const effectiveName = path.basename(filePath);
  const asciiName = effectiveName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  const encodedFilename = encodeURIComponent(effectiveName);

  reply.header('Content-Type', mimeType);
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Accept-Ranges', 'bytes');
  if (isDownload) {
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedFilename}`);
  } else {
    reply.header('Content-Disposition', 'inline');
  }

  // Handle Range requests (HTTP 206 Partial Content) according to RFC 7233 / RFC 9110
  const rangeHeader = request.headers.range;
  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    if (stat.size === 0) {
      reply.status(416);
      reply.header('Content-Range', 'bytes */0');
      return reply.send();
    }

    const parts = rangeHeader.replace(/bytes=/, '').trim().split('-');
    let start: number;
    let end: number;

    if (parts[0] === '' && parts[1]) {
      // Suffix byte range: bytes=-N (e.g. bytes=-1048576)
      const suffix = parseInt(parts[1], 10);
      if (isNaN(suffix) || suffix <= 0) {
        reply.status(416);
        reply.header('Content-Range', `bytes */${stat.size}`);
        return reply.send();
      }
      start = Math.max(0, stat.size - suffix);
      end = stat.size - 1;
    } else {
      start = parseInt(parts[0], 10);
      end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    }

    if (isNaN(start) || isNaN(end) || start < 0 || start >= stat.size || end < start) {
      reply.status(416);
      reply.header('Content-Range', `bytes */${stat.size}`);
      return reply.send();
    }

    const clampedEnd = Math.min(end, stat.size - 1);
    const chunkSize = (clampedEnd - start) + 1;

    reply.raw.writeHead(206, {
      'Content-Range': `bytes ${start}-${clampedEnd}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': mimeType,
      'Content-Disposition': isDownload ? `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedFilename}` : 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=86400'
    });

    return reply.send(fs.createReadStream(filePath, { start, end: clampedEnd }));
  }

  reply.header('Content-Length', stat.size);
  reply.header('Cache-Control', 'public, max-age=86400');

  const stream = fs.createReadStream(filePath);
  return reply.send(stream);
}
