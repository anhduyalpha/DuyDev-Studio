import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ResearchGateService } from '../../services/researchgate.service.js';
import {
  academicResolveBodySchema,
  academicStreamQuerySchema,
  academicSaveDriveBodySchema,
  academicCheckDuplicateSchema
} from '../../schemas/academic-dl.schema.js';

export async function researchgateRoute(app: FastifyInstance) {
  app.post('/api/v1/researchgate/resolve', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url } = academicResolveBodySchema.parse(request.body || {});
    const data = await ResearchGateService.resolvePublication(url);
    return reply.send({ success: true, data });
  });

  app.post('/api/v1/researchgate/check-duplicate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, url } = academicCheckDuplicateSchema.parse(request.body || {});
    const result = await ResearchGateService.checkExistingInDrive(id, url);
    return reply.send({ success: true, data: result });
  });

  app.get('/api/v1/researchgate/stream', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, download, filename } = academicStreamQuerySchema.parse(request.query || {});
    const isDownload = download === true || download === 'true' || download === '1';
    const rangeHeader = request.headers.range;

    await ResearchGateService.proxyStream(
      url,
      isDownload,
      filename || 'researchgate_paper.pdf',
      rangeHeader,
      reply
    );
  });

  app.post('/api/v1/researchgate/save-drive', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, title, id, originalUrl, cover, author, overwrite } = academicSaveDriveBodySchema.parse(request.body || {});
    const result = await ResearchGateService.saveToDrive(
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
