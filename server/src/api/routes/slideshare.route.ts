import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SlideShareService } from '../../services/slideshare.service.js';
import {
  academicResolveBodySchema,
  academicStreamQuerySchema,
  academicSaveDriveBodySchema,
  academicCheckDuplicateSchema
} from '../../schemas/academic-dl.schema.js';

export async function slideshareRoute(app: FastifyInstance) {
  app.post('/api/v1/slideshare/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = academicResolveBodySchema.parse(request.body || {});
    const data = await SlideShareService.resolvePresentation(url);
    return reply.send({ success: true, data });
  });

  app.post('/api/v1/slideshare/check-duplicate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, url } = academicCheckDuplicateSchema.parse(request.body || {});
    const result = await SlideShareService.checkExistingInDrive(id, url);
    return reply.send({ success: true, data: result });
  });

  app.get('/api/v1/slideshare/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, download, filename } = academicStreamQuerySchema.parse(request.query || {});
    const isDownload = download === true || download === 'true' || download === '1';
    const rangeHeader = request.headers.range;

    await SlideShareService.proxyStream(
      url,
      isDownload,
      filename || 'slideshare_presentation.pdf',
      rangeHeader,
      reply
    );
  });

  app.post('/api/v1/slideshare/save-drive', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, title, id, originalUrl, cover, author, overwrite } = academicSaveDriveBodySchema.parse(request.body || {});
    const result = await SlideShareService.saveToDrive(
      url,
      title,
      id,
      originalUrl,
      cover,
      author,
      overwrite
    );
    return reply.send({ success: true, data: result });
  });
}
