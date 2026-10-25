import { FastifyReply, FastifyRequest } from 'fastify';
import { SpotifyService } from '../../services/spotify.service.js';
import {
  spotifyResolveBodySchema,
  spotifyStreamQuerySchema,
  spotifySaveDriveBodySchema,
  spotifyCheckDuplicateSchema
} from '../../schemas/spotify.schema.js';

export async function resolveSpotifyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url } = spotifyResolveBodySchema.parse(request.body || {});
  const data = await SpotifyService.resolveTrack(url);
  return reply.send({
    success: true,
    data
  });
}

export async function checkDuplicateSpotifyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, id, title } = spotifyCheckDuplicateSchema.parse(request.body || {});
  const result = await SpotifyService.checkExistingInDrive(id, url, title);
  return reply.send({
    success: true,
    data: result
  });
}

export async function streamSpotifyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, download, filename, file, name } = spotifyStreamQuerySchema.parse(request.query || {});
  const targetUrl = url || file || '';
  const isDownload = download === true || download === 'true' || download === '1';
  const rangeHeader = request.headers.range;

  await SpotifyService.proxyStream(
    targetUrl,
    isDownload,
    filename || name || 'spotify_track.mp3',
    rangeHeader,
    reply
  );
}

export async function saveToDriveSpotifyHandler(request: FastifyRequest, reply: FastifyReply) {
  const { url, title, artist, album, cover, duration, audioUrl, overwrite } =
    spotifySaveDriveBodySchema.parse(request.body || {});
  const result = await SpotifyService.saveToDrive(
    url,
    title,
    artist,
    album,
    cover,
    duration,
    audioUrl,
    overwrite
  );
  return reply.send({
    success: true,
    data: result
  });
}
