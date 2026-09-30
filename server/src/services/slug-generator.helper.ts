import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../lib/errors.js';

const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export async function generateRandomBase62Slug(
  length: number = 6,
  maxRetries: number = 5,
  isCachedCheck?: (slug: string) => boolean
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const bytes = crypto.randomBytes(length);
    let slug = '';
    for (let i = 0; i < length; i++) {
      slug += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
    }

    if (!isCachedCheck || !isCachedCheck(slug)) {
      const existing = await prisma.dynamicQr.findUnique({
        where: { slug },
        select: { id: true }
      });
      if (!existing) {
        return slug;
      }
    }
  }

  throw new AppError(
    `Không thể tạo mã định danh duy nhất sau ${maxRetries} lần thử. Vui lòng thử lại.`,
    500,
    'INTERNAL_ERROR'
  );
}
