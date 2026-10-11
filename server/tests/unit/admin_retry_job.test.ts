import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminTelemetryService } from '../../src/services/admin-telemetry.service.js';
import { prisma } from '../../src/lib/prisma.js';
import * as queueModule from '../../src/queues/task.queue.js';
import { BadRequestError, NotFoundError } from '../../src/lib/errors.js';

describe('Admin Retry Failed Job Service (Pillar 6)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects empty or missing jobId with BadRequestError', async () => {
    await expect(adminTelemetryService.retryFailedJob('')).rejects.toThrow(BadRequestError);
    await expect(adminTelemetryService.retryFailedJob('   ')).rejects.toThrow(BadRequestError);
  });

  it('throws NotFoundError when job is not found in database', async () => {
    vi.spyOn(prisma.job, 'findUnique').mockResolvedValue(null);
    await expect(adminTelemetryService.retryFailedJob('job_nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('resets job status in DB, removes existing BullMQ job, and re-enqueues quiz job', async () => {
    const mockJob = {
      id: 'job_failed_quiz_1',
      type: 'quiz_generate',
      status: 'FAILED',
      progress: 30,
      errorMessage: 'Agnes AI Timeout',
      optionsJson: JSON.stringify({
        fileId: 'fil_123',
        pages: '1-3',
        count: 10,
        startNum: 1,
        title: 'Đề thi thử'
      })
    };

    vi.spyOn(prisma.job, 'findUnique').mockResolvedValue(mockJob as any);
    const updateSpy = vi.spyOn(prisma.job, 'update').mockResolvedValue({} as any);

    const mockOldJob = {
      remove: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(queueModule.quizQueue, 'getJob').mockResolvedValue(mockOldJob as any);
    const enqueueSpy = vi.spyOn(queueModule, 'enqueueQuizJob').mockResolvedValue({} as any);

    const res = await adminTelemetryService.retryFailedJob('job_failed_quiz_1');

    expect(res.success).toBe(true);
    expect(res.jobId).toBe('job_failed_quiz_1');
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'job_failed_quiz_1' },
      data: expect.objectContaining({
        status: 'QUEUED',
        progress: 0,
        errorMessage: null,
        completedAt: null
      })
    });
    // Critical: Old job must be removed to avoid BullMQ deduplication ignore
    expect(mockOldJob.remove).toHaveBeenCalled();
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job_failed_quiz_1',
        fileId: 'fil_123',
        count: 10
      }),
      { jobId: 'job_failed_quiz_1' }
    );
  });

  it('retries all failed jobs in batch', async () => {
    const mockFailedJobs = [
      { id: 'job_f1', type: 'quiz_generate', optionsJson: '{}' },
      { id: 'job_f2', type: 'converter_process', optionsJson: '{}' }
    ];

    vi.spyOn(prisma.job, 'findMany').mockResolvedValue(mockFailedJobs as any);
    vi.spyOn(adminTelemetryService, 'retryFailedJob').mockResolvedValue({
      success: true,
      jobId: 'job_f1',
      type: 'quiz_generate',
      message: 'OK'
    });

    const res = await adminTelemetryService.retryAllFailedJobs();
    expect(res.totalFailed).toBe(2);
    expect(res.retriedCount).toBe(2);
    expect(res.skippedCount).toBe(0);
  });
});
