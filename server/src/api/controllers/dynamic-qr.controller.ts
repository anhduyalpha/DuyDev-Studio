import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createDynamicQrSchema,
  updateDynamicQrSchema,
  slugParamSchema
} from '../../schemas/dynamic-qr.schema.js';
import { DynamicQrService } from '../../services/dynamic-qr.service.js';

function getBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : request.protocol || 'http';
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string' ? forwardedHost : request.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function redirectHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = slugParamSchema.parse(request.params);

  const userAgent = (request.headers['user-agent'] as string) || null;
  const referer = (request.headers['referer'] as string) || null;
  const ipAddress = request.ip || null;

  const targetUrl = await DynamicQrService.resolveAndLogScan(slug, {
    userAgent,
    referer,
    ipAddress
  });

  if (!targetUrl) {
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã QR Không Khả Dụng | DD Studio</title>
  <style>
    body { margin: 0; padding: 0; background-color: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 400px; margin: 24px; padding: 32px; background: #121215; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    h1 { font-size: 1.25rem; font-weight: 700; margin: 16px 0 8px; color: #ffffff; }
    p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
    .badge { display: inline-block; font-size: 0.75rem; font-family: monospace; font-weight: 600; padding: 4px 12px; background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.25); border-radius: 9999px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">404 NOT FOUND</div>
    <h1>Mã QR Không Khả Dụng</h1>
    <p>Liên kết này không tồn tại, đã hết hạn hoặc tạm thời bị vô hiệu hoá bởi người sở hữu.</p>
  </div>
</body>
</html>`;
    return reply.status(404).type('text/html; charset=utf-8').send(html);
  }

  return reply.redirect(targetUrl, 302);
}

export async function createDynamicQrHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = createDynamicQrSchema.parse(request.body);
  const baseUrl = getBaseUrl(request);

  const result = await DynamicQrService.createDynamicQr(body, baseUrl);

  return reply.status(201).send({
    success: true,
    data: result
  });
}

export async function listDynamicQrsHandler(request: FastifyRequest, reply: FastifyReply) {
  const baseUrl = getBaseUrl(request);
  const data = await DynamicQrService.listRecent(baseUrl);

  return reply.send({
    success: true,
    data
  });
}

export async function getAnalyticsHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = slugParamSchema.parse(request.params);
  const baseUrl = getBaseUrl(request);

  const data = await DynamicQrService.getAnalytics(slug, baseUrl);

  return reply.send({
    success: true,
    data
  });
}

export async function updateDynamicQrHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = slugParamSchema.parse(request.params);
  const body = updateDynamicQrSchema.parse(request.body);

  const updated = await DynamicQrService.updateDestination(slug, body);

  return reply.send({
    success: true,
    data: updated
  });
}

export async function deleteDynamicQrHandler(request: FastifyRequest, reply: FastifyReply) {
  const { slug } = slugParamSchema.parse(request.params);

  const result = await DynamicQrService.deleteDynamicQr(slug);

  return reply.send({
    success: true,
    data: result
  });
}
