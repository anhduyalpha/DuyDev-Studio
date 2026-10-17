import { describe, it, expect, beforeEach } from 'vitest';
import { AiMetricsService } from '../../src/services/ai-metrics.service.js';

describe('AI Key Toggle & Active Environment Synchronization', () => {
  let aiMetrics: AiMetricsService;

  beforeEach(() => {
    aiMetrics = AiMetricsService.getInstance();
    // Ensure agnes-primary exists and is initially active for tests
    aiMetrics.updateKey({
      id: 'agnes-primary',
      name: 'Agnes AI (Primary)',
      provider: 'agnes',
      baseUrl: 'https://apihub.agnes-ai.com/v1',
      model: 'agnes-3.0-flash',
      apiKey: 'test-agnes-key-12345',
      priority: 1,
      isActive: true
    });
  });

  it('should toggle agnes-primary key off and on', () => {
    // 1. Toggle OFF
    const toggledOff = aiMetrics.toggleKey('agnes-primary', false);
    expect(toggledOff.isActive).toBe(false);

    // 2. Toggle ON
    const toggledOn = aiMetrics.toggleKey('agnes-primary', true);
    expect(toggledOn.isActive).toBe(true);

    // 3. Toggle invert (no param)
    const inverted = aiMetrics.toggleKey('agnes-primary');
    expect(inverted.isActive).toBe(false);

    // Reset back to true
    aiMetrics.toggleKey('agnes-primary', true);
  });

  it('should switch primary active key and sync process.env when agnes-primary is toggled off', () => {
    // Add custom fallback key with high priority
    aiMetrics.updateKey({
      id: 'custom-fallback-test',
      name: 'Custom OpenRouter Brain',
      provider: 'custom',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat',
      apiKey: 'sk-or-test-key-99999',
      priority: 1,
      isActive: true
    });

    // Make agnes-primary priority 0 so it's first
    aiMetrics.updateKey({
      id: 'agnes-primary',
      priority: 0,
      isActive: true
    });

    // When agnes-primary is active, it should be the primary key
    let primary = aiMetrics.getPrimaryActiveKey();
    expect(primary?.id).toBe('agnes-primary');
    expect(process.env.AGNES_AI_API_KEY).toBe('test-agnes-key-12345');
    expect(process.env.AGNES_AI_BASE_URL).toBe('https://apihub.agnes-ai.com/v1');
    expect(process.env.AGNES_AI_MODEL).toBe('agnes-3.0-flash');

    // Turn OFF agnes-primary
    aiMetrics.toggleKey('agnes-primary', false);

    // Now primary active key should be custom-fallback-test
    primary = aiMetrics.getPrimaryActiveKey();
    expect(primary?.id).toBe('custom-fallback-test');
    expect(process.env.AGNES_AI_API_KEY).toBe('sk-or-test-key-99999');
    expect(process.env.AGNES_AI_BASE_URL).toBe('https://openrouter.ai/api/v1');
    expect(process.env.AGNES_AI_MODEL).toBe('deepseek/deepseek-chat');

    // Turn agnes-primary back ON and restore priority 1
    aiMetrics.updateKey({
      id: 'agnes-primary',
      priority: 1,
      isActive: true
    });
    primary = aiMetrics.getPrimaryActiveKey();
    expect(primary?.id).toBe('agnes-primary');
    expect(process.env.AGNES_AI_API_KEY).toBe('test-agnes-key-12345');

    // Cleanup
    aiMetrics.deleteKey('custom-fallback-test');
  });

  it('should throw error when toggling non-existent key', () => {
    expect(() => {
      aiMetrics.toggleKey('non-existent-key-id-xyz');
    }).toThrow('Không tìm thấy API key với ID');
  });
});
