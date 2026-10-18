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

  const range = request.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    reply.raw.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(path.basename(filePath))}"`,
      'Cache-Control': 'public, max-age=86400'
    });

    return reply.send(fileStream);
  }

  reply.header('Content-Type', mimeType);
  reply.header('Content-Length', stat.size);
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Disposition', `${disposition}; filename="${encodeURIComponent(path.basename(filePath))}"`);
  reply.header('Cache-Control', 'public, max-age=86400');

  const stream = fs.createReadStream(filePath);
  return reply.send(stream);
}
