import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { renderQrStudio, renderQrScanner } from '../../../src/components/tools/qr/QrStudio.js';
import { renderQrActionControls, renderQrFormStatic } from '../../../src/components/tools/qr/components/QrFormStatic.js';
import { qrState } from '../../../src/components/tools/qr/hooks/useQrState.js';
import {
  buildStaticQrPayload,
  renderStyledQrToContainer,
  getActiveStyledQr
} from '../../../src/components/tools/qr/hooks/useQrActions.js';

describe('Task 4.2: Universal QRCodeStyling Customization and Preview Across All 5 Tabs', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const qrStudioPath = path.join(rootDir, 'src/components/tools/qr/QrStudio.js');
  const qrActionControlsPath = path.join(rootDir, 'src/components/tools/qr/components/QrFormStatic.js');
  const qrPreviewCardPath = path.join(rootDir, 'src/components/tools/qr/components/QrPreviewCard.js');

  const qrStudioContent = fs.readFileSync(qrStudioPath, 'utf-8');
  const qrActionControlsContent = fs.readFileSync(qrActionControlsPath, 'utf-8');
  const qrPreviewCardContent = fs.readFileSync(qrPreviewCardPath, 'utf-8');

  beforeEach(() => {
    // Reset qrState to clean baseline
    qrState.activeTab = 'url';
    qrState.format = 'png';
    qrState.error = null;
    qrState.generatedResult = null;
    qrState.styling = {
      isExpanded: false,
      isCustomized: false,
      dotType: 'square',
      dotColor: '#000000',
      useGradient: false,
      gradientStart: '#4F46E5',
      gradientEnd: '#06B6D4',
      cornerSquareType: 'square',
      cornerDotType: 'square',
      cornerColor: '#000000',
      logoUrl: null,
      logoMargin: 6,
      logoSize: 0.32
    };
    qrState.vietqr = {
      bankBin: '970436',
      accountNumber: '123456789',
      amount: 50000,
      purpose: 'Test Transfer'
    };
    qrState.wifi = {
      ssid: 'MyHomeNetwork',
      password: 'SafePassword123',
      security: 'WPA',
      hidden: false
    };
    qrState.vcard = {
      fullName: 'Nguyen Van A',
      phone: '0901234567',
      email: 'a@example.com',
      organization: 'Tech Corp',
      title: 'Engineer',
      website: 'https://example.com'
    };
    qrState.text = {
      content: 'Sample Plain Text'
    };
  });

  describe('1. Universal Styling Accordion Panel Across All 5 Creation Tabs', () => {
    const creationTabs = ['url', 'vietqr', 'wifi', 'vcard', 'text'] as const;

    creationTabs.forEach((tab) => {
      it(`renders renderQrStylePanel on creation tab "${tab}"`, () => {
        const html = renderQrStudio(tab);
        expect(html).toContain('id="btnToggleQrStyling"');
        expect(html).toContain('Tùy Biến Giao Diện');
        expect(html).toContain('btn-dot-type');
      });
    });

    it('does NOT render styling panel on scanner or history management views', () => {
      const scannerHtml = renderQrScanner();
      expect(scannerHtml).not.toContain('id="btnToggleQrStyling"');
      expect(scannerHtml).not.toContain('Tùy Biến Giao Diện');
    });
  });

  describe('2. buildStaticQrPayload Deterministic Builder & Escaping', () => {
    it('builds valid Wi-Fi payload with escaping for semicolon, colon, backslash, comma', () => {
      const wifiState = {
        activeTab: 'wifi',
        wifi: {
          ssid: 'Office;5G:Main\\Test,AP',
          password: 'P;a:s\\s,word!123',
          security: 'WPA',
          hidden: false
        }
      };

      const payload = buildStaticQrPayload(wifiState);
      // Expected ZXing Wi-Fi format: WIFI:T:WPA;S:...;;
      expect(payload).toMatch(/^WIFI:T:WPA;S:Office\\;5G\\:Main\\\\Test\\,AP;P:P\\;a\\:s\\\\s\\,word!123;;$/);
    });

    it('builds valid Wi-Fi payload with hidden flag set', () => {
      const wifiState = {
        activeTab: 'wifi',
        wifi: {
          ssid: 'HiddenWifi',
          password: 'SecretPassword',
          security: 'WPA',
          hidden: true
        }
      };

      const payload = buildStaticQrPayload(wifiState);
      expect(payload).toBe('WIFI:T:WPA;S:HiddenWifi;P:SecretPassword;H:true;;');
    });

    it('builds valid vCard 3.0 payload with BEGIN:VCARD and END:VCARD', () => {
      const vcardState = {
        activeTab: 'vcard',
        vcard: {
          fullName: 'Tran Van B',
          phone: '0987654321',
          email: 'b@company.vn',
          organization: 'Startup JSC',
          title: 'Founder',
          website: 'startup.vn'
        }
      };

      const payload = buildStaticQrPayload(vcardState);
      expect(payload).toContain('BEGIN:VCARD');
      expect(payload).toContain('VERSION:3.0');
      expect(payload).toContain('FN;CHARSET=UTF-8:Tran Van B');
      expect(payload).toContain('TEL;TYPE=CELL,VOICE:0987654321');
      expect(payload).toContain('EMAIL;TYPE=PREF,INTERNET:b@company.vn');
      expect(payload).toContain('ORG;CHARSET=UTF-8:Startup JSC');
      expect(payload).toContain('TITLE;CHARSET=UTF-8:Founder');
      expect(payload).toContain('URL:https://startup.vn');
      expect(payload).toContain('END:VCARD');
    });

    it('builds valid text payload', () => {
      const textState = {
        activeTab: 'text',
        text: {
          content: 'Simple UTF-8 text message: Xin chào DD Studio!'
        }
      };

      const payload = buildStaticQrPayload(textState);
      expect(payload).toBe('Simple UTF-8 text message: Xin chào DD Studio!');
    });
  });

  describe('3. renderStyledQrToContainer & Fallback Behavior', () => {
    it('creates QRCodeStyling instance and mounts into container when window.QRCodeStyling is available', () => {
      const appendMock = vi.fn();
      class MockQRCodeStyling {
        options: any;
        constructor(options: any) {
          this.options = options;
        }
        append = appendMock;
        update = vi.fn();
        download = vi.fn();
        getRawData = vi.fn();
      }

      // Mock DOM container
      const container = {
        id: 'qrStyledCanvasContainer',
        innerHTML: 'old content',
        appendChild: vi.fn()
      };

      const originalWindow = global.window;
      const originalDoc = global.document;

      try {
        (global as any).window = { QRCodeStyling: MockQRCodeStyling };
        (global as any).document = {
          getElementById: (id: string) => (id === 'qrStyledCanvasContainer' ? container : null)
        };

        renderStyledQrToContainer('qrStyledCanvasContainer', 'https://duydev.me/test');

        expect(container.innerHTML).toBe('');
        expect(appendMock).toHaveBeenCalledWith(container);
        expect(getActiveStyledQr()).not.toBeNull();
      } finally {
        (global as any).window = originalWindow;
        (global as any).document = originalDoc;
      }
    });

    it('renders fallback <img> cleanly without crashing when window.QRCodeStyling is unavailable', () => {
      const container = {
        id: 'qrStyledCanvasContainer',
        innerHTML: ''
      };

      const originalWindow = global.window;
      const originalDoc = global.document;

      try {
        (global as any).window = {};
        (global as any).document = {
          getElementById: (id: string) => (id === 'qrStyledCanvasContainer' ? container : null)
        };

        qrState.generatedResult = {
          format: 'png',
          dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          content: 'raw text'
        };

        expect(() => {
          renderStyledQrToContainer('qrStyledCanvasContainer', 'https://fallback.test');
        }).not.toThrow();

        expect(container.innerHTML).toContain('<img');
        expect(container.innerHTML).toContain('data:image/png;base64,');
      } finally {
        (global as any).window = originalWindow;
        (global as any).document = originalDoc;
      }
    });
  });

  describe('4. UI Hygiene & Redundant Color Control Removal', () => {
    it('renderQrActionControls in QrFormStatic.js removes redundant color picker', () => {
      const html = renderQrActionControls(qrState);
      // Redundant color controls must be removed
      expect(html).not.toContain('btn-color-preset');
      expect(html).not.toContain('qrCustomColorDark');
      expect(html).not.toContain('Màu Sắc');

      // Format radio controls & submit button must remain
      expect(html).toContain('name="qrFormatRadio"');
      expect(html).toContain('PNG');
      expect(html).toContain('SVG');
      expect(html).toContain('id="btnGenerateQr"');
    });

    it('QrActionControls copy contains no parenthetical slop like "PNG (Ảnh số)"', () => {
      expect(qrActionControlsContent).not.toContain('(Ảnh số)');
      expect(qrActionControlsContent).not.toContain('(Vector)');
      expect(qrActionControlsContent).not.toContain('(Tùy chọn)');
    });

    it('Submit buttons and action controls enforce min-h-[44px] touch targets', () => {
      expect(qrActionControlsContent).toContain('min-h-[44px]');
      expect(qrPreviewCardContent).toContain('min-h-[44px]');
    });

    it('QrPreviewCard uses #qrStyledCanvasContainer for mounting live styled canvas', () => {
      expect(qrPreviewCardContent).toContain('id="qrStyledCanvasContainer"');
    });
  });
});
