/**
 * Prisma Client Singleton with SQLite WAL Optimization Hooks
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

// Global serialization polyfill for BigInt (needed for SQLite sizeBytes)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error']
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * Initializes SQLite WAL mode and tuning PRAGMAs
 */
export async function initSqlitePragmas(): Promise<void> {
  try {
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA foreign_keys = ON;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 30000;`);
    await prisma.$queryRawUnsafe(`PRAGMA cache_size = -64000;`);
    logger.info('✅ SQLite WAL mode and performance PRAGMAs initialized');
  } catch (error) {
    logger.error({ err: error }, '⚠️ Failed to execute SQLite PRAGMA tuning statements');
  }
}
