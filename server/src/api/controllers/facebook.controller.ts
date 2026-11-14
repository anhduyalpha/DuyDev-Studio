import { FastifyReply, FastifyRequest } from 'fastify';
import { FacebookService } from '../../services/facebook.service.js';
import {
  facebookResolveBodySchema,
  facebookStreamQuerySchema,
  facebookSaveDriveBodySchema,
  facebookCheckDuplicateSchema
} from '../../schemas/facebook.schema.js';

export async function resolveFacebookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url } = facebookResolveBodySchema.parse(request.body || {});
  const data = await FacebookService.resolveVideo(url);
  return reply.send({
    success: true,
    data
  });
}

export async function checkDuplicateFacebookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, id } = facebookCheckDuplicateSchema.parse(request.body || {});
  const result = await FacebookService.checkExistingInDrive(id, url);
  return reply.send({
    success: true,
    data: result
  });
}

export async function streamFacebookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, download, filename, dashToken } = facebookStreamQuerySchema.parse(request.query || {});
  const isDownload = download === true || download === 'true' || download === '1';
  const rangeHeader = request.headers.range;

  const resolvedUrl = dashToken && !url.startsWith('dash://') ? `dash://${dashToken}` : url;

  await FacebookService.proxyStream(
    resolvedUrl,
    isDownload,
    filename || 'facebook_video.mp4',
    rangeHeader,
    reply
  );
}

export async function saveToDriveFacebookHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, title, id, originalUrl, cover, author, duration, quality, overwrite, mediaType, ext, dashToken } =
    facebookSaveDriveBodySchema.parse(request.body || {});

  const resolvedUrl = dashToken && (!url || !url.startsWith('dash://')) ? `dash://${dashToken}` : url;

  const result = await FacebookService.saveToDrive(
    resolvedUrl,
    title,
    id,
    originalUrl,
    cover,
    author,
    duration,
    quality,
    overwrite,
    mediaType,
    ext
  );
  return reply.send({
    success: true,
    data: result
  });
}
