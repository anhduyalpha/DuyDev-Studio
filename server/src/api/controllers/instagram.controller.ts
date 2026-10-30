import { FastifyReply, FastifyRequest } from 'fastify';
import { InstagramService } from '../../services/instagram.service.js';
import {
  instagramResolveBodySchema,
  instagramStreamQuerySchema,
  instagramSaveDriveBodySchema,
  instagramCheckDuplicateSchema
} from '../../schemas/instagram.schema.js';

export async function resolveInstagramHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url } = instagramResolveBodySchema.parse(request.body || {});
  const data = await InstagramService.resolveVideo(url);
  return reply.send({
    success: true,
    data
  });
}

export async function checkDuplicateInstagramHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, id } = instagramCheckDuplicateSchema.parse(request.body || {});
  const result = await InstagramService.checkExistingInDrive(id, url);
  return reply.send({
    success: true,
    data: result
  });
}

export async function streamInstagramHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, download, filename } = instagramStreamQuerySchema.parse(request.query || {});
  const isDownload = download === true || download === 'true' || download === '1';
  const rangeHeader = request.headers.range;

  await InstagramService.proxyStream(
    url,
    isDownload,
    filename || 'instagram_video.mp4',
    rangeHeader,
    reply
  );
}

export async function saveToDriveInstagramHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, title, id, originalUrl, cover, author, duration, overwrite, mediaType } =
    instagramSaveDriveBodySchema.parse(request.body || {});
  const result = await InstagramService.saveToDrive(
    url,
    title,
    id,
    originalUrl,
    cover,
    author,
    duration,
    overwrite,
    mediaType
  );
  return reply.send({
    success: true,
    data: result
  });
}
