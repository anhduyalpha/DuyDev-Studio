import { FastifyReply, FastifyRequest } from 'fastify';
import { generateQrSchema, decodeQrSchema } from '../../schemas/qr.schema.js';
import { QrService } from '../../services/qr.service.js';
import { DynamicQrService } from '../../services/dynamic-qr.service.js';
import { BadRequestError } from '../../lib/errors.js';

function getBaseUrl(request: FastifyRequest): string {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const proto = typeof forwardedProto === 'string' ? forwardedProto : request.protocol || 'http';
  const forwardedHost = request.headers['x-forwarded-host'];
  const host = typeof forwardedHost === 'string' ? forwardedHost : request.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export async function generateQrHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = generateQrSchema.parse(request.body);
  let payload = body.payload;
  let dynamicInfo = null;

  // Auto-shorten URLs to lock them to standard Version 3 matrix density
  if (body.type === 'url' || (body.type === 'text' && typeof payload === 'string' && /^https?:\/\//i.test(payload.trim()))) {
    const rawUrl = typeof payload === 'object' && payload !== null && 'url' in payload
      ? String((payload as any).url)
      : String(payload);

    if (/^https?:\/\//i.test(rawUrl.trim())) {
      const baseUrl = getBaseUrl(request);
      dynamicInfo = await DynamicQrService.createDynamicQr({ targetUrl: rawUrl.trim() }, baseUrl);
      payload = dynamicInfo.shortUrl;
    }
  }

  const result = await QrService.generateQr({
    type: body.type,
    payload,
    format: body.format,
    margin: body.margin,
    errorCorrectionLevel: body.errorCorrectionLevel,
    colorDark: body.colorDark,
    colorLight: body.colorLight,
    width: body.width,
    version: body.version
  });

  return reply.send({
    success: true,
    data: {
      format: result.format,
      content: result.content,
      dataUrl: result.dataUrl,
      version: result.version,
      dynamic: dynamicInfo
    }
  });
}

export async function decodeQrHandler(request: FastifyRequest, reply: FastifyReply) {
  let buffer: Buffer;

  if (request.isMultipart()) {
    const file = await request.file();
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hình ảnh chứa mã QR');
    }
    buffer = await file.toBuffer();
  } else {
    const body = decodeQrSchema.parse(request.body);
    const base64Data = body.imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/i, '');
    buffer = Buffer.from(base64Data, 'base64');
  }

  const result = await QrService.decodeQrImage(buffer);

  return reply.send({
    success: true,
    data: {
      text: result.text
    }
  });
}
