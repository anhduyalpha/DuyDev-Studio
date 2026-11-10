import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { SlideShareService } from '../../services/slideshare.service.js';
import { resolvedStoragePaths } from '../../config/env.config.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import {
  academicResolveBodySchema,
  academicStreamQuerySchema,
  academicSaveDriveBodySchema,
  academicCheckDuplicateSchema,
  academicCompileTempSchema
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

  app.get('/api/v1/slideshare/download', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const filePath = query?.file || query?.path || '';
    if (!filePath) {
      throw new BadRequestError('Thiếu tham số tệp cần tải');
    }

    const isTemp = query?.temp === '1' || query?.temp === 'true';
    const driveDir = path.join(resolvedStoragePaths.drive, 'slideshare');
    const tempDir = resolvedStoragePaths.temp;
    const safeName = path.basename(filePath);
    let diskPath = isTemp ? path.join(tempDir, safeName) : path.join(driveDir, safeName);

    if (!fs.existsSync(diskPath)) {
      const altPath = isTemp ? path.join(driveDir, safeName) : path.join(tempDir, safeName);
      if (fs.existsSync(altPath)) {
        diskPath = altPath;
      } else {
        throw new NotFoundError(`Tệp ${safeName} không tồn tại trên hệ thống`);
      }
    }

    const stat = await fsPromises.stat(diskPath);
    const ext = path.extname(diskPath).toLowerCase().replace(/^\./, '');
    const mimeType = ext === 'pptx'
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      : (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream');

    const encodedName = encodeURIComponent(safeName);
    const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');

    reply.header('Content-Type', mimeType);
    reply.header('Content-Length', stat.size);
    reply.header('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
    reply.header('Cache-Control', 'public, max-age=3600');

    return reply.send(fs.createReadStream(diskPath));
  });

  app.post('/api/v1/slideshare/compile', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, title, format, originalUrl, slideImages } = academicCompileTempSchema.parse(request.body || {});
    const result = await SlideShareService.compileTempPresentation(
      format,
      id,
      title,
      slideImages,
      originalUrl
    );
    return reply.send({ success: true, data: result });
  });

  app.post('/api/v1/slideshare/save-drive', async (request: FastifyRequest, reply: FastifyReply) => {
    const { url, title, id, originalUrl, cover, author, overwrite, slideImages } = academicSaveDriveBodySchema.parse(request.body || {});
    const result = await SlideShareService.saveToDrive(
      url,
      title,
      id,
      originalUrl,
      cover,
      author,
      overwrite,
      slideImages
    );
    return reply.send({ success: true, data: result });
  });
}
