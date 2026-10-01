/**
 * Environment Configuration Loader & Validator
 * Powered by Zod
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  STORAGE_ROOT: z.string().default('./data/storage'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50000),
  FILE_TTL_MINUTES: z.coerce.number().default(0),
  JANITOR_INTERVAL_MINUTES: z.coerce.number().default(15),
  AUTH_MODE: z.enum(['none', 'token']).default('none'),
  API_KEY: z.string().default('duydev_super_secret_token_2026'),
  CORS_ORIGIN: z.string().default('*'),
  HTTPS_PORT: z.coerce.number().default(3443),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  R2_ENABLED: z.preprocess((v) => v === 'true' || v === true, z.boolean()).default(false),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default('ddstudio-backend'),
  R2_MAX_MONTHLY_REQUESTS: z.coerce.number().default(900000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;

export const resolvedStoragePaths = {
  root: path.resolve(process.cwd(), env.STORAGE_ROOT),
  uploads: path.resolve(process.cwd(), env.STORAGE_ROOT, 'uploads'),
  processed: path.resolve(process.cwd(), env.STORAGE_ROOT, 'processed'),
  temp: path.resolve(process.cwd(), env.STORAGE_ROOT, 'temp'),
  drive: path.resolve(process.cwd(), env.STORAGE_ROOT, 'drive')
};

