import { FastifyReply, FastifyRequest } from 'fastify';
import { TikTokService } from '../../services/tiktok.service.js';
import {
  tiktokResolveBodySchema,
  tiktokStreamQuerySchema,
  tiktokSaveDriveBodySchema
} from '../../schemas/tiktok.schema.js';

export async function resolveTikTokHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url } = tiktokResolveBodySchema.parse(request.body || {});
  const data = await TikTokService.resolveVideo(url);
  return reply.send({
    success: true,
    data
  });
}

export async function streamTikTokHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, download, filename } = tiktokStreamQuerySchema.parse(request.query || {});
  const isDownload = download === true || download === 'true' || download === '1';
  const rangeHeader = request.headers.range;

  await TikTokService.proxyStream(
    url,
    isDownload,
    filename || 'tiktok_video.mp4',
    rangeHeader,
    reply
  );
}

export async function saveToDriveTikTokHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, title, id } = tiktokSaveDriveBodySchema.parse(request.body || {});
  const result = await TikTokService.saveToDrive(url, title, id);
  return reply.send({
    success: true,
    data: result
  });
}
