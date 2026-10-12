import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { adminTelemetryService, DEFAULT_ENGINE_TIMEOUTS } from '../../src/services/admin-telemetry.service.js';
import { resolvedStoragePaths } from '../../src/config/env.config.js';

describe('Admin Dynamic Engine Timeouts Configuration (Ticket #07, #10, #11, #12, #13)', () => {
  const configPath = path.join(path.resolve(resolvedStoragePaths.root, '..'), 'system_config.json');
  let backupConfig: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(configPath)) {
      backupConfig = fs.readFileSync(configPath, 'utf-8');
      fs.unlinkSync(configPath);
    } else {
      backupConfig = null;
    }
  });

  afterEach(() => {
    if (backupConfig !== null) {
      fs.writeFileSync(configPath, backupConfig, 'utf-8');
    } else if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  });

  it('returns required defaults when no system config file exists', async () => {
    const timeouts = await adminTelemetryService.getEngineTimeouts();
    expect(timeouts).toEqual({
      aiCallSec: 45,
      chromePdfSec: 60,
      pdfHeavyTaskSec: 300,
      converterTaskSec: 600,
      quizTaskSec: 600
    });
    expect(DEFAULT_ENGINE_TIMEOUTS).toEqual({
      aiCallSec: 45,
      chromePdfSec: 60,
      pdfHeavyTaskSec: 300,
      converterTaskSec: 600,
      quizTaskSec: 600
    });
  });

  it('updates and persists custom engine timeouts', async () => {
    const updated = await adminTelemetryService.updateEngineTimeouts({
      aiCallSec: 90,
      chromePdfSec: 80,
      pdfHeavyTaskSec: 450,
      converterTaskSec: 900,
      quizTaskSec: 1200
    });

    expect(updated).toEqual({
      aiCallSec: 90,
      chromePdfSec: 80,
      pdfHeavyTaskSec: 450,
      converterTaskSec: 900,
      quizTaskSec: 1200
    });

    // Verify persisted on disk
    expect(fs.existsSync(configPath)).toBe(true);
    const readBack = await adminTelemetryService.getEngineTimeouts();
    expect(readBack).toEqual({
      aiCallSec: 90,
      chromePdfSec: 80,
      pdfHeavyTaskSec: 450,
      converterTaskSec: 900,
      quizTaskSec: 1200
    });
  });

  it('enforces min and max bounds on engine timeouts', async () => {
    const bounded = await adminTelemetryService.updateEngineTimeouts({
      aiCallSec: 5,        // min 10
      chromePdfSec: 500,   // max 300
      pdfHeavyTaskSec: 10, // min 30
      converterTaskSec: 5000 // max 3600
    });

    expect(bounded.aiCallSec).toBe(10);
    expect(bounded.chromePdfSec).toBe(300);
    expect(bounded.pdfHeavyTaskSec).toBe(30);
    expect(bounded.converterTaskSec).toBe(3600);
  });
});
