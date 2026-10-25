import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { toolLayoutService, VALID_CATEGORIES } from '../../services/tool-layout.service.js';
import { BadRequestError } from '../../lib/errors.js';

const categoryItemSchema = z.object({
  id: z.string().min(1, 'ID danh mục không được để trống').regex(/^[a-zA-Z0-9_-]+$/, 'ID danh mục chỉ chứa chữ cái, số, gạch nối hoặc gạch dưới'),
  label: z.string().min(1, 'Tên danh mục không được để trống'),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Màu đại diện phải là mã màu HEX hợp lệ (#RRGGBB)')
});

const toolLayoutItemSchema = z.object({
  id: z.string().min(1, 'Mã công cụ không được để trống'),
  category: z.string().min(1, 'Danh mục công cụ không được để trống'),
  order: z.number().int().optional()
});

const updateToolLayoutBodySchema = z.object({
  items: z.array(toolLayoutItemSchema).min(1, 'Danh sách thẻ công cụ không được để trống'),
  categories: z.array(categoryItemSchema).optional()
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

  const data = await toolLayoutService.updateLayout(parseResult.data.items, parseResult.data.categories);
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
