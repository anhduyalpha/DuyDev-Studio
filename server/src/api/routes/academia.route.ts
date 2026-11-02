import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AcademiaService } from '../../services/academia.service.js';
import {
  academicResolveBodySchema,
  academicStreamQuerySchema,
  academicSaveDriveBodySchema,
  academicCheckDuplicateSchema
} from '../../schemas/academic-dl.schema.js';

export async function academiaRoute(app: FastifyInstance) {
  app.post('/api/v1/academia/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = academicResolveBodySchema.parse(request.body || {});
    const data = await AcademiaService.resolvePaper(url);
    return reply.send({ success: true, data });
  });

  app.post('/api/v1/academia/check-duplicate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, url } = academicCheckDuplicateSchema.parse(request.body || {});
    const result = await AcademiaService.checkExistingInDrive(id, url);
    return reply.send({ success: true, data: result });
  });

  app.get('/api/v1/academia/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, download, filename } = academicStreamQuerySchema.parse(request.query || {});
    const isDownload = download === true || download === 'true' || download === '1';
    const rangeHeader = request.headers.range;

    await AcademiaService.proxyStream(
      url,
      isDownload,
      filename || 'academia_paper.pdf',
      rangeHeader,
      reply
    );
  });

  app.post('/api/v1/academia/save-drive', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, title, id, originalUrl, cover, author, overwrite } = academicSaveDriveBodySchema.parse(request.body || {});
    const result = await AcademiaService.saveToDrive(
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
