import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { toolLayoutService, VALID_CATEGORIES } from '../../services/tool-layout.service.js';
import { BadRequestError } from '../../lib/errors.js';

const toolLayoutItemSchema = z.object({
  id: z.string().min(1, 'Mã công cụ không được để trống'),
  category: z.enum(VALID_CATEGORIES, {
    errorMap: () => ({ message: 'Danh mục công cụ không hợp lệ' })
  }),
  order: z.number().int().optional()
});

const updateToolLayoutBodySchema = z.object({
  items: z.array(toolLayoutItemSchema).min(1, 'Danh sách thẻ công cụ không được để trống')
});

/**
 * GET /api/v1/system/tool-layout & GET /api/v1/admin/tool-layout
 * Returns active tool layout (order and category per card)
 */
export async function getToolLayoutHandler(_request: FastifyRequest, reply: FastifyReply) {
  const data = await toolLayoutService.getLayout();
  return reply.send({
    success: true,
    data
  });
}

/**
 * PUT /api/v1/admin/tool-layout
 * Updates active tool layout configuration
 */
export async function updateToolLayoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const parseResult = updateToolLayoutBodySchema.safeParse(request.body);
  if (!parseResult.success) {
    throw new BadRequestError(parseResult.error.errors[0]?.message || 'Dữ liệu bố cục thẻ công cụ không hợp lệ');
  }

  const data = await toolLayoutService.updateLayout(parseResult.data.items);
  return reply.send({
    success: true,
    message: 'Đã cập nhật bố cục thẻ công cụ thành công',
    data
  });
}

/**
 * POST /api/v1/admin/tool-layout/reset
 * Resets tool layout configuration to defaults
 */
export async function resetToolLayoutHandler(_request: FastifyRequest, reply: FastifyReply) {
  const data = await toolLayoutService.resetLayout();
  return reply.send({
    success: true,
    message: 'Đã khôi phục bố cục thẻ công cụ về mặc định',
    data
  });
}
