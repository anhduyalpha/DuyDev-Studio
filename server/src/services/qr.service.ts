import qrcode from 'qrcode';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { BadRequestError } from '../lib/errors.js';
import { VietQrPayload, WifiPayload, VCardPayload, QrFormat, QrErrorCorrectionLevel, QrType } from '../schemas/qr.schema.js';
import {
  formatTlv,
  calculateCrc16,
  generateVietQrPayload,
  generateWifiPayload,
  generateVCardPayload,
  resolvePayloadText
} from './qr-payload.helper.js';

export interface GenerateQrResult {
  format: QrFormat;
  content: string;
  dataUrl: string;
  payloadText: string;
  version?: number;
}

export class QrService {
  // Retain legacy method signatures for backward compatibility
  static formatTlv = formatTlv;
  static calculateCrc16 = calculateCrc16;
  static generateVietQrPayload = generateVietQrPayload;
  static generateWifiPayload = generateWifiPayload;
  static generateVCardPayload = generateVCardPayload;
  static resolvePayloadText = resolvePayloadText;

  /**
   * Decodes a QR code from an image buffer using Sharp and jsQR
   */
  static async decodeQrImage(buffer: Buffer): Promise<{ text: string }> {
    try {
      const image = sharp(buffer);
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const clamped = new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
      const jsQrFn: typeof import('jsqr').default = (jsQR as any).default || (jsQR as any);
      const code = jsQrFn(clamped, info.width, info.height);
      if (!code || (!code.data && (!code.binaryData || code.binaryData.length === 0))) {
        throw new BadRequestError('Không tìm thấy hoặc không thể giải mã mã QR từ hình ảnh này');
      }

      let decodedText = code.data || '';

      // Fix mojibake: prioritize true UTF-8 binary stream over Shift-JIS Kanji interpretation
      if (code.binaryData && code.binaryData.length > 0) {
        try {
          const rawBytes = Buffer.from(code.binaryData);
          const utf8Text = rawBytes.toString('utf-8');
          if (utf8Text && !utf8Text.includes('\ufffd')) {
            decodedText = utf8Text;
          }
        } catch {}
      }

      // Fallback: recover Latin1 misinterpreted UTF-8
      if (/[\u00c0-\u00ff]/.test(decodedText)) {
        try {
          const recovered = decodeURIComponent(escape(decodedText));
          if (recovered && recovered.length > 0) {
            decodedText = recovered;
          }
        } catch {}
      }

      return { text: decodedText };
    } catch (err) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError('Không thể xử lý định dạng ảnh này để quét mã QR');
    }
  }

  /**
   * Returns standard uniform QR matrix version per domain type
   */
  private static getStandardVersion(type: QrType, explicitVersion?: number): number | undefined {
    if (explicitVersion && explicitVersion >= 1 && explicitVersion <= 40) {
      return explicitVersion;
    }
    switch (type) {
      case 'url': return 3;    // Uniform 29x29 matrix (viewBox "0 0 33 33" with margin 2)
      case 'vietqr': return 6; // Standard Napas EMVCo 41x41 matrix
      case 'wifi': return 4;   // Standard Wi-Fi 33x33 matrix
      case 'vcard': return undefined; // Auto-select optimal version based on payload density
      case 'text': return 4;   // Standard text 33x33 matrix
      default: return 3;
    }
  }

  /**
   * Renders QR code as SVG or PNG data URL with guaranteed standard matrix density
   */
  static async generateQr(params: {
    type: QrType;
    payload: unknown;
    format?: QrFormat;
    margin?: number;
    errorCorrectionLevel?: QrErrorCorrectionLevel;
    colorDark?: string;
    colorLight?: string;
    width?: number;
    version?: number;
  }): Promise<GenerateQrResult> {
    const {
      type,
      payload,
      format = 'svg',
      margin = 2,
      errorCorrectionLevel = 'M',
      colorDark = '#000000',
      colorLight = '#ffffff',
      width = 512,
      version
    } = params;

    const payloadText = this.resolvePayloadText(type, payload);
    const standardVersion = this.getStandardVersion(type, version);
    const qrColor = { dark: colorDark || '#000000', light: colorLight || '#ffffff' };

    let effectiveVersion = standardVersion;

    if (format === 'svg') {
      let svgContent: string;
      try {
        svgContent = await qrcode.toString(payloadText, {
          type: 'svg',
          version: effectiveVersion,
          margin,
          errorCorrectionLevel,
          width,
          color: qrColor
        });
      } catch {
        // Graceful fallback to minimum required version if payload overflows standard slot
        effectiveVersion = undefined;
        svgContent = await qrcode.toString(payloadText, {
          type: 'svg',
          margin,
          errorCorrectionLevel,
          width,
          color: qrColor
        });
      }

      return {
        format: 'svg',
        content: svgContent,
        dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`,
        payloadText,
        version: effectiveVersion
      };
    } else {
      let dataUrl: string;
      try {
        dataUrl = await qrcode.toDataURL(payloadText, {
          version: effectiveVersion,
          margin,
          errorCorrectionLevel,
          width,
          color: qrColor
        });
      } catch {
        effectiveVersion = undefined;
        dataUrl = await qrcode.toDataURL(payloadText, {
          margin,
          errorCorrectionLevel,
          width,
          color: qrColor
        });
      }

      return {
        format: 'png',
        content: dataUrl,
        dataUrl,
        payloadText,
        version: effectiveVersion
      };
    }
  }
}
