import { describe, it, expect } from 'vitest';
import { QrService } from '../../src/services/qr.service.js';

describe('QrService Unit Tests', () => {
  it('should compute CRC16-CCITT correctly for standard test vector', () => {
    // Standard test vector for CRC16-CCITT FALSE
    const crc = QrService.calculateCrc16('123456789');
    expect(crc).toBe('29B1');
  });

  it('should generate valid VietQR payload with all tags and correct CRC', () => {
    const payload = QrService.generateVietQrPayload({
      bankBin: '970422',
      accountNumber: '0987654321',
      amount: 250000,
      purpose: 'Thanh toan tien hosting'
    });

    expect(payload).toContain('000201'); // Tag 00
    expect(payload).toContain('010212'); // Tag 01 dynamic
    expect(payload).toContain('A000000727'); // NAPAS GUID
    expect(payload).toContain('970422'); // Bank BIN
    expect(payload).toContain('0987654321'); // Account number
    expect(payload).toContain('QRIBFTTA'); // Fast transfer
    expect(payload).toContain('5303704'); // VND currency
    expect(payload).toContain('5406250000'); // Amount
    expect(payload).toContain('5802VN'); // Country code
    expect(payload).toContain('Thanh toan tien hosting');
    expect(payload).toContain('6304'); // CRC tag

    // Verify CRC matches content
    const dataWithoutCrc = payload.slice(0, payload.indexOf('6304') + 4);
    const expectedCrc = payload.slice(-4);
    expect(QrService.calculateCrc16(dataWithoutCrc)).toBe(expectedCrc);
  });

  it('should generate static VietQR when amount is omitted', () => {
    const payload = QrService.generateVietQrPayload({
      bankBin: '970415',
      accountNumber: '1122334455'
    });

    expect(payload).toContain('010211'); // Static QR initiation
    expect(payload).not.toContain('5406'); // No amount tag
  });

  it('should generate valid Wi-Fi payload', () => {
    const wifi = QrService.generateWifiPayload({
      ssid: 'DuyDev_Studio_5G',
      password: 'MySecretPassword123',
      security: 'WPA',
      hidden: true
    });

    expect(wifi).toBe('WIFI:S:DuyDev_Studio_5G;T:WPA;P:MySecretPassword123;H:true;;');
  });

  it('should render SVG QR code with data URL', async () => {
    const result = await QrService.generateQr({
      type: 'url',
      payload: 'https://duydev.me',
      format: 'svg',
      margin: 2
    });

    expect(result.format).toBe('svg');
    expect(result.content).toContain('<svg');
    expect(result.dataUrl).toContain('data:image/svg+xml');
  });

  it('should render PNG QR code as base64 data URL', async () => {
    const result = await QrService.generateQr({
      type: 'text',
      payload: 'Hello DuyDev Studio',
      format: 'png'
    });

    expect(result.format).toBe('png');
    expect(result.dataUrl).toContain('data:image/png;base64,');
  });

  it('should generate valid vCard 3.0 payload with CHARSET=UTF-8', () => {
    const vcard = QrService.generateVCardPayload({
      fullName: 'Đặng Hoàng Anh Duy',
      phone: '0768134698',
      email: 'duydang0768134698@gmail.com',
      organization: 'CNTT ĐHQG TPHCM',
      title: 'Sinh viên',
      website: 'duydevstudio.alphadaniel.io.vn'
    });

    expect(vcard).toContain('BEGIN:VCARD');
    expect(vcard).toContain('VERSION:3.0');
    expect(vcard).toContain('FN;CHARSET=UTF-8:Đặng Hoàng Anh Duy');
    expect(vcard).toContain('N;CHARSET=UTF-8:Đặng;Duy;Hoàng Anh;;');
    expect(vcard).toContain('TEL;TYPE=CELL,VOICE:0768134698');
    expect(vcard).toContain('EMAIL;TYPE=PREF,INTERNET:duydang0768134698@gmail.com');
    expect(vcard).toContain('ORG;CHARSET=UTF-8:CNTT ĐHQG TPHCM');
    expect(vcard).toContain('TITLE;CHARSET=UTF-8:Sinh viên');
    expect(vcard).toContain('URL:https://duydevstudio.alphadaniel.io.vn');
    expect(vcard).toContain('END:VCARD');
  });

  it('should generate QR code with custom colors and width', async () => {
    const result = await QrService.generateQr({
      type: 'url',
      payload: 'https://example.com',
      format: 'svg',
      colorDark: '#4F46E5',
      colorLight: '#00000000',
      width: 1024
    });

    expect(result.content.toLowerCase()).toContain('#4f46e5');
  });

  it('should decode QR code from image buffer successfully', async () => {
    // Generate a QR code buffer first
    const qrResult = await QrService.generateQr({
      type: 'url',
      payload: 'https://duydev.studio/test-decode-123',
      format: 'png',
      width: 512
    });

    const base64Data = qrResult.dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const decoded = await QrService.decodeQrImage(buffer);
    expect(decoded.text).toBe('https://duydev.studio/test-decode-123');
  });

  it('should correctly format VietQR with Vietnamese accented purpose using UTF-8 byte length and compute valid CRC', () => {
    const payload = QrService.generateVietQrPayload({
      bankBin: '970436',
      accountNumber: '1234567890',
      amount: 500000,
      purpose: 'Tiền học phí tháng 9'
    });

    const purposeStr = 'Tiền học phí tháng 9';
    const expectedByteLen = Buffer.byteLength(purposeStr, 'utf-8'); // 26 bytes
    expect(expectedByteLen).toBe(26);

    // Tag 08 inside Tag 62 should specify length 26, not char length 20
    expect(payload).toContain(`0826${purposeStr}`);

    // Verify CRC matches content over UTF-8 bytes
    const dataWithoutCrc = payload.slice(0, payload.indexOf('6304') + 4);
    const expectedCrc = payload.slice(-4);
    expect(QrService.calculateCrc16(dataWithoutCrc)).toBe(expectedCrc);
  });

  it('should decode QR code containing accented Vietnamese text without mojibake or Chinese characters', async () => {
    const originalText = 'Chuyển khoản: Nguyễn Văn A - Cảm ơn bạn!';
    const qrResult = await QrService.generateQr({
      type: 'text',
      payload: originalText,
      format: 'png',
      width: 512
    });

    const base64Data = qrResult.dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const decoded = await QrService.decodeQrImage(buffer);
    expect(decoded.text).toBe(originalText);
    // Ensure no Chinese / Kanji characters were introduced
    expect(/[\u4e00-\u9fff\u3040-\u30ff]/.test(decoded.text)).toBe(false);
  });

  it('should throw BadRequestError when decoding image without QR code', async () => {
    // 100x100 blank PNG
    const blankBuffer = await (await import('sharp')).default({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();

    await expect(QrService.decodeQrImage(blankBuffer)).rejects.toThrow();
  });
});
