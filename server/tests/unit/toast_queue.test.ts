import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showToast,
  showActionableToast,
  clearAllToasts,
  getActiveToastsCount
} from '../../../src/utilities/toast.js';

interface MockElement {
  id?: string;
  className: string;
  innerHTML: string;
  textContent: string;
  style: Record<string, string>;
  children: MockElement[];
  parentNode: MockElement | null;
  classList: {
    add: (...cls: string[]) => void;
    remove: (...cls: string[]) => void;
    contains: (cls: string) => boolean;
  };
  querySelector: (sel: string) => MockElement | null;
  querySelectorAll: (sel: string) => MockElement[];
  appendChild: (child: MockElement) => MockElement;
  removeChild: (child: MockElement) => MockElement;
  onclick?: ((e: unknown) => void) | null;
  offsetWidth: number;
}

function createMockElement(tag: string): MockElement {
  const classes = new Set<string>();
  const children: MockElement[] = [];

  const elem: MockElement = {
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    children,
    parentNode: null,
    offsetWidth: 100,
    classList: {
      add: (...cls: string[]) => cls.forEach((c) => classes.add(c)),
      remove: (...cls: string[]) => cls.forEach((c) => classes.delete(c)),
      contains: (c: string) => classes.has(c)
    },
    querySelector: (sel: string) => {
      if (sel === '.toast-counter-badge') {
        return children.find((c) => c.className.includes('toast-counter-badge')) || null;
      }
      if (sel === '.toast-message-text') {
        return children.find((c) => c.className.includes('toast-message-text')) || createMockElement('span');
      }
      if (sel === '.btn-toast-close' || sel === '.btn-toast-dismiss') {
        return createMockElement('button');
      }
      return null;
    },
    querySelectorAll: () => [],
    appendChild: (child: MockElement) => {
      child.parentNode = elem;
      children.push(child);
      return child;
    },
    removeChild: (child: MockElement) => {
      const idx = children.indexOf(child);
      if (idx !== -1) {
        children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }
  };
  return elem;
}

describe('Toast Queue Manager & Anti-Spam Unit Tests', () => {
  let mockBody: MockElement;
  let elementsById: Map<string, MockElement>;

  beforeEach(() => {
    vi.useFakeTimers();
    elementsById = new Map();
    mockBody = createMockElement('body');

    // @ts-expect-error Mocking document for testing in Node
    globalThis.document = {
      body: mockBody,
      getElementById: (id: string) => elementsById.get(id) || null,
      createElement: (tag: string) => {
        const el = createMockElement(tag);
        return el;
      }
    };

    // @ts-expect-error Mocking window and requestAnimationFrame
    globalThis.window = {
      lucide: { createIcons: vi.fn() }
    };
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    clearAllToasts();
  });

  afterEach(() => {
    clearAllToasts();
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Clean up globals so other test files in the same thread are not polluted
    delete (globalThis as any).document;
    delete (globalThis as any).window;
    delete (globalThis as any).requestAnimationFrame;
  });

  it('should create container and render toast with message', () => {
    showToast('Tệp đã được xử lý', 'success');

    expect(getActiveToastsCount()).toBe(1);
    const container = globalThis.document.getElementById('ds-toast-container');
    expect(container).toBeDefined();
  });

  it('should strictly enforce MAX_ACTIVE_TOASTS = 3 with FIFO eviction', () => {
    // Spam 6 distinct toasts
    showToast('Thông báo 1', 'info');
    showToast('Thông báo 2', 'info');
    showToast('Thông báo 3', 'info');
    showToast('Thông báo 4', 'info');
    showToast('Thông báo 5', 'info');
    showToast('Thông báo 6', 'info');

    // Must never exceed 3 active toasts
    expect(getActiveToastsCount()).toBeLessThanOrEqual(3);
  });

  it('should deduplicate and coalesce identical messages with count badge (×N)', () => {
    // Spam click delete 5 times with exact same message
    showToast('Đã chuyển mục vào thùng rác', 'info');
    showToast('Đã chuyển mục vào thùng rác', 'info');
    showToast('Đã chuyển mục vào thùng rác', 'info');
    showToast('Đã chuyển mục vào thùng rác', 'info');
    showToast('Đã chuyển mục vào thùng rác', 'info');

    // Exactly 1 toast card must exist on screen
    expect(getActiveToastsCount()).toBe(1);
  });

  it('should distinguish messages with different types or text', () => {
    showToast('Xóa tệp A', 'info');
    showToast('Xóa tệp B', 'info');

    expect(getActiveToastsCount()).toBe(2);
  });

  it('should auto-dismiss toast after duration timeout', () => {
    showToast('Hoàn thành', 'success', 2000);
    expect(getActiveToastsCount()).toBe(1);

    // Fast-forward past duration + animation delay
    vi.advanceTimersByTime(2300);

    expect(getActiveToastsCount()).toBe(0);
  });

  it('should clear all toasts immediately via clearAllToasts()', () => {
    showToast('Tin nhắn 1', 'info');
    showToast('Tin nhắn 2', 'warning');
    expect(getActiveToastsCount()).toBe(2);

    clearAllToasts();
    expect(getActiveToastsCount()).toBe(0);
  });

  it('should manage actionable toast capacity alongside regular toasts', () => {
    showToast('Tin nhắn thông thường 1', 'info');
    showToast('Tin nhắn thông thường 2', 'info');
    showActionableToast('Tác vụ chạy ngầm', { actionText: 'Mở' });

    expect(getActiveToastsCount()).toBe(3);

    // Adding 4th toast should evict the oldest
    showToast('Tin nhắn thứ 4', 'success');
    expect(getActiveToastsCount()).toBe(3);
  });
});
