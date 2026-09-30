import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { taskCoordinator } from '../../src/../../src/utilities/taskCoordinator.js';

describe('Universal Task Coordinator & Multitasking Architecture', () => {
  beforeEach(() => {
    taskCoordinator.destroy();
  });

  afterEach(() => {
    taskCoordinator.destroy();
  });

  it('should register an existing module manager and aggregate active running tasks', () => {
    const mockArchiveManager = {
      moduleId: 'archive',
      moduleTitle: 'Xem Tệp Nén',
      route: '#archive',
      getActiveTasks: () => [
        {
          id: 'archive-task-1',
          moduleId: 'archive',
          moduleTitle: 'Xem Tệp Nén',
          title: 'backup.zip',
          status: 'running' as const,
          progress: 45,
          stage: 'Đang truyền 45%',
          route: '#archive'
        }
      ],
      subscribe: vi.fn((fn: () => void) => () => {})
    };

    taskCoordinator.registerManager(mockArchiveManager as any);

    const active = taskCoordinator.getActiveTasks();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('archive-task-1');
    expect(active[0].moduleId).toBe('archive');
    expect(active[0].progress).toBe(45);
  });

  it('should support multiple concurrent modules running simultaneously', () => {
    const archiveManager = {
      moduleId: 'archive',
      moduleTitle: 'Xem Tệp Nén',
      route: '#archive',
      getActiveTasks: () => [
        {
          id: 'arch-1',
          moduleId: 'archive',
          moduleTitle: 'Xem Tệp Nén',
          title: 'archive.zip',
          status: 'running' as const,
          progress: 60,
          stage: 'Đang tải lên',
          route: '#archive'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    const pdfManager = {
      moduleId: 'pdf-studio',
      moduleTitle: 'PDF Studio',
      route: '#tool/pdf-studio',
      getActiveTasks: () => [
        {
          id: 'pdf-1',
          moduleId: 'pdf-studio',
          moduleTitle: 'PDF Studio',
          title: 'Ghép 3 tệp PDF',
          status: 'running' as const,
          progress: 80,
          stage: 'Đang ghép nối',
          route: '#tool/pdf-studio'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    const converterManager = {
      moduleId: 'universal-converter',
      moduleTitle: 'File Converter',
      route: '#tool/universal-converter',
      getActiveTasks: () => [
        {
          id: 'conv-1',
          moduleId: 'universal-converter',
          moduleTitle: 'File Converter',
          title: 'clip.mp4 -> WEBM',
          status: 'running' as const,
          progress: 25,
          stage: 'Đang chuyển đổi',
          route: '#tool/universal-converter'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    taskCoordinator.registerManager(archiveManager as any);
    taskCoordinator.registerManager(pdfManager as any);
    taskCoordinator.registerManager(converterManager as any);

    const active = taskCoordinator.getActiveTasks();
    expect(active).toHaveLength(3);
    const moduleIds = active.map((t) => t.moduleId);
    expect(moduleIds).toContain('archive');
    expect(moduleIds).toContain('pdf-studio');
    expect(moduleIds).toContain('universal-converter');
  });

  it('should seamlessly accommodate future modules via standard IModuleTaskManager contract', () => {
    // Simulate a future module created in the future: "AudioTranscriber"
    let isTranscribing = true;
    let progress = 15;

    const futureAudioModule = {
      moduleId: 'audio-ai-transcribe',
      moduleTitle: 'Nhận Diện Giọng Nói AI',
      route: '#tool/audio-transcribe',
      getActiveTasks: () => {
        if (!isTranscribing) return [];
        return [
          {
            id: 'audio-job-999',
            moduleId: 'audio-ai-transcribe',
            moduleTitle: 'Nhận Diện Giọng Nói AI',
            title: 'interview.wav',
            status: 'running' as const,
            progress,
            stage: 'Đang trích xuất văn bản...',
            route: '#tool/audio-transcribe',
            cancel: () => {
              isTranscribing = false;
            }
          }
        ];
      },
      subscribe: vi.fn(() => () => {})
    };

    taskCoordinator.registerManager(futureAudioModule as any);

    let active = taskCoordinator.getActiveTasks();
    expect(active).toHaveLength(1);
    expect(active[0].moduleTitle).toBe('Nhận Diện Giọng Nói AI');
    expect(active[0].title).toBe('interview.wav');
    expect(active[0].progress).toBe(15);

    // Cancel via coordinator
    taskCoordinator.cancelTask('audio-job-999');
    active = taskCoordinator.getActiveTasks();
    expect(active).toHaveLength(0);
  });

  it('should detect status transitions from running to completed and notify listeners', () => {
    let taskStatus: 'running' | 'completed' = 'running';

    const testManager = {
      moduleId: 'test-tool',
      moduleTitle: 'Test Tool',
      route: '#tool/test',
      getActiveTasks: () => [
        {
          id: 'test-task-1',
          moduleId: 'test-tool',
          moduleTitle: 'Test Tool',
          title: 'document.pdf',
          status: taskStatus,
          progress: taskStatus === 'completed' ? 100 : 50,
          stage: taskStatus === 'completed' ? 'Hoàn tất' : 'Đang xử lý',
          route: '#tool/test'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    const completionSpy = vi.spyOn(taskCoordinator, 'notifyCompletion');

    taskCoordinator.registerManager(testManager as any);
    expect(taskCoordinator.getActiveTasks()).toHaveLength(1);
    expect(completionSpy).not.toHaveBeenCalled();

    // Transition to completed
    taskStatus = 'completed';
    taskCoordinator.syncTasks();

    expect(completionSpy).toHaveBeenCalledTimes(1);
    expect(completionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-task-1',
        status: 'completed'
      })
    );
  });

  it('should not notify subscribers if syncTasks runs without any changes', () => {
    const testManager = {
      moduleId: 'test-idle',
      moduleTitle: 'Test Idle',
      route: '#tool/idle',
      getActiveTasks: () => [
        {
          id: 'idle-task-1',
          moduleId: 'test-idle',
          moduleTitle: 'Test Idle',
          title: 'idle.zip',
          status: 'running' as const,
          progress: 30,
          stage: 'Đang tải lên...',
          route: '#tool/idle'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    taskCoordinator.registerManager(testManager as any);

    const subscriberSpy = vi.fn();
    const unsub = taskCoordinator.subscribe(subscriberSpy);
    // Initial call on subscribe
    expect(subscriberSpy).toHaveBeenCalledTimes(1);

    // Call syncTasks without changing anything
    taskCoordinator.syncTasks();
    expect(subscriberSpy).toHaveBeenCalledTimes(1);

    // Call syncTasks with force=true
    taskCoordinator.syncTasks(true);
    expect(subscriberSpy).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('should notify subscribers when task progress or stage changes', () => {
    let progress = 10;
    let stage = 'Bắt đầu';

    const testManager = {
      moduleId: 'test-dynamic',
      moduleTitle: 'Test Dynamic',
      route: '#tool/dynamic',
      getActiveTasks: () => [
        {
          id: 'dynamic-task-1',
          moduleId: 'test-dynamic',
          moduleTitle: 'Test Dynamic',
          title: 'file.pdf',
          status: 'running' as const,
          progress,
          stage,
          route: '#tool/dynamic'
        }
      ],
      subscribe: vi.fn(() => () => {})
    };

    taskCoordinator.registerManager(testManager as any);

    const subscriberSpy = vi.fn();
    taskCoordinator.subscribe(subscriberSpy);
    expect(subscriberSpy).toHaveBeenCalledTimes(1);

    // Change progress
    progress = 25;
    stage = 'Đang ghép trang 1/4';
    taskCoordinator.syncTasks();

    expect(subscriberSpy).toHaveBeenCalledTimes(2);
    expect(subscriberSpy).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          progress: 25,
          stage: 'Đang ghép trang 1/4'
        })
      ])
    );
  });
});
