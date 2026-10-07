import { Queue, JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.config.js';
import { logger } from '../lib/logger.js';

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (process.env.NODE_ENV === 'test') {
      return times > 3 ? null : 100;
    }
    return Math.min(times * 500, 3000);
  }
});

redisConnection.on('error', (err) => {
  logger.warn({ err: err.message }, 'Redis connection warning/error');
});

export const taskQueue = new Queue('ds-tasks', {
  connection: redisConnection
});

taskQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ taskQueue warning/error');
});

export const converterQueue = new Queue('ds-converter-tasks', {
  connection: redisConnection
});

converterQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ converterQueue warning/error');
});

export const quizQueue = new Queue('ds-quiz-tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 }
  }
});

quizQueue.on('error', (err) => {
  logger.warn({ err: err.message }, 'BullMQ quizQueue warning/error');
});

export async function enqueueJob<T = unknown>(type: string, payload: T, options?: JobsOptions) {
  return taskQueue.add(type, payload, options);
}

export async function enqueueConverterJob<T = unknown>(payload: T, options?: JobsOptions) {
  return converterQueue.add('converter_process', payload, options);
}

export async function enqueueQuizJob<T = unknown>(payload: T, options?: JobsOptions) {
  return quizQueue.add('quiz_process', payload, options);
}

export function createRedisSubscriber(): Redis {
  const sub = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy(times) {
      if (process.env.NODE_ENV === 'test') {
        return times > 3 ? null : 100;
      }
      return Math.min(times * 500, 3000);
    }
  });

  sub.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis subscriber error');
  });

  return sub;
}

export async function publishJobEvent(jobId: string, eventName: string, data: unknown): Promise<void> {
  try {
    const channel = `job:events:${jobId}`;
    const payload = JSON.stringify({ event: eventName, data });
    await redisConnection.publish(channel, payload);
  } catch (err) {
    logger.warn({ jobId, eventName, err }, 'Failed to publish job event');
  }
}

export async function closeTaskQueue(): Promise<void> {
  try {
    await Promise.allSettled([taskQueue.close(), converterQueue.close(), quizQueue.close()]);
    await redisConnection.quit().catch(() => redisConnection.disconnect());
  } catch {
    redisConnection.disconnect();
  }
}
