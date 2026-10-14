import { FastifyReply, FastifyRequest } from 'fastify';
import { TikTokService } from '../../services/tiktok.service.js';
import {
  tiktokResolveBodySchema,
  tiktokStreamQuerySchema,
  tiktokSaveDriveBodySchema,
  tiktokCheckDuplicateSchema
} from '../../schemas/tiktok.schema.js';

export async function resolveTikTokHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url } = tiktokResolveBodySchema.parse(request.body || {});
  const data = await TikTokService.resolveVideo(url);
  return reply.send({
    success: true,
    data
  });
}

export async function checkDuplicateTikTokHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, id } = tiktokCheckDuplicateSchema.parse(request.body || {});
  let expandedUrl = url;
  if (url && (url.includes('vt.tiktok.com') || url.includes('vm.tiktok.com'))) {
    try {
      expandedUrl = await TikTokService.expandUrl(url);
    } catch {}
  }
  const result = await TikTokService.checkExistingInDrive(id, expandedUrl);
  return reply.send({
    success: true,
    data: result
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
  const { url, title, id, originalUrl, cover, author, duration, overwrite, isSlideshow, images, audioUrl } =
    tiktokSaveDriveBodySchema.parse(request.body || {});
  const result = await TikTokService.saveToDrive(
    url,
    title,
    id,
    originalUrl,
    cover,
    author,
    duration,
    overwrite,
    isSlideshow,
    images,
    audioUrl
  );
  return reply.send({
    success: true,
    data: result
  });
}
