import { BadRequestError } from '../lib/errors.js';
import { VietQrPayload, WifiPayload, VCardPayload, QrType } from '../schemas/qr.schema.js';

/**
 * Formats EMVCo Tag-Length-Value (TLV) block using UTF-8 byte length
 */
export function formatTlv(tag: string, value: string): string {
  const byteLen = Buffer.byteLength(value, 'utf-8');
  const len = byteLen.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Computes CRC16-CCITT (polynomial 0x1021, initial 0xFFFF) over UTF-8 bytes
 */
export function calculateCrc16(str: string): string {
  const buf = Buffer.from(str, 'utf-8');
  let crc = 0xffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generates VietQR EMVCo standard payload for Vietnamese interbank transfers
 */
export function generateVietQrPayload(data: VietQrPayload): string {
  const { bankBin, accountNumber, amount, purpose } = data;

  if (!bankBin || !accountNumber) {
    throw new BadRequestError('VietQR requires bankBin and accountNumber');
  }

  // Tag 00: Payload Format Indicator (01)
  const tag00 = formatTlv('00', '01');

  // Tag 01: Point of Initiation Method (12 = dynamic with amount, 11 = static)
  const tag01 = formatTlv('01', amount !== undefined ? '12' : '11');

  // Tag 38: Merchant Account Information (NAPAS VietQR)
  const subTag00Guid = formatTlv('00', 'A000000727');
  const subSubTag00Bin = formatTlv('00', bankBin);
  const subSubTag01Acc = formatTlv('01', accountNumber);
  const subTag01Beneficiary = formatTlv('01', `${subSubTag00Bin}${subSubTag01Acc}`);
  const subTag02Service = formatTlv('02', 'QRIBFTTA');

  const tag38Value = `${subTag00Guid}${subTag01Beneficiary}${subTag02Service}`;
  const tag38 = formatTlv('38', tag38Value);

  // Tag 53: Transaction Currency (704 = VND)
  const tag53 = formatTlv('53', '704');

  // Tag 54: Transaction Amount (optional)
  const tag54 = amount !== undefined && amount > 0 ? formatTlv('54', Math.round(amount).toString()) : '';

  // Tag 58: Country Code (VN)
  const tag58 = formatTlv('58', 'VN');

  // Tag 62: Additional Data Field (purpose)
  let tag62 = '';
  if (purpose && purpose.trim().length > 0) {
    const subTag08Purpose = formatTlv('08', purpose.trim());
    tag62 = formatTlv('62', subTag08Purpose);
  }

  // Tag 63: CRC16 checksum
  const rawPayloadWithoutCrc = `${tag00}${tag01}${tag38}${tag53}${tag54}${tag58}${tag62}6304`;
  const crc = calculateCrc16(rawPayloadWithoutCrc);

  return `${rawPayloadWithoutCrc}${crc}`;
}

/**
 * Generates standard Wi-Fi network credential string
 */
export function generateWifiPayload(data: WifiPayload): string {
  const { ssid, password = '', security = 'WPA', hidden = false } = data;
  const cleanSecurity = security || 'WPA';
  const hiddenPart = hidden ? 'H:true;' : '';
  return `WIFI:S:${ssid};T:${cleanSecurity};P:${password};${hiddenPart};`;
}

function escapeVCard(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generates standard vCard 3.0 string with explicit UTF-8 charset declarations
 * to prevent mojibake/garbled text on mobile barcode scanners (Xiaomi, Samsung, iOS).
 */
export function generateVCardPayload(data: VCardPayload | string): string {
  if (typeof data === 'string') return data;
  const { fullName, phone, email, organization, title, website } = data;
  if (!fullName || !fullName.trim()) {
    throw new BadRequestError('vCard requires fullName');
  }

  const cleanName = fullName.trim();
  const nameParts = cleanName.split(/\s+/);
  let nValue = `;${escapeVCard(cleanName)};;;`;
  if (nameParts.length >= 2) {
    const family = escapeVCard(nameParts[0]);
    const given = escapeVCard(nameParts[nameParts.length - 1]);
    const middle = escapeVCard(nameParts.slice(1, -1).join(' '));
    nValue = `${family};${given};${middle};;`;
  }

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N;CHARSET=UTF-8:${nValue}`,
    `FN;CHARSET=UTF-8:${escapeVCard(cleanName)}`
  ];
  if (organization && organization.trim()) {
    lines.push(`ORG;CHARSET=UTF-8:${escapeVCard(organization.trim())}`);
  }
  if (title && title.trim()) {
    lines.push(`TITLE;CHARSET=UTF-8:${escapeVCard(title.trim())}`);
  }
  if (phone && phone.trim()) {
    lines.push(`TEL;TYPE=CELL,VOICE:${phone.trim()}`);
  }
  if (email && email.trim()) {
    lines.push(`EMAIL;TYPE=PREF,INTERNET:${email.trim()}`);
  }
  if (website && website.trim()) {
    const rawUrl = website.trim();
    const cleanUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    lines.push(`URL:${cleanUrl}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * Resolves raw QR string based on payload type
 */
export function resolvePayloadText(type: QrType, payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (type === 'vietqr') {
    return generateVietQrPayload(payload as VietQrPayload);
  }

  if (type === 'wifi') {
    return generateWifiPayload(payload as WifiPayload);
  }

  if (type === 'vcard') {
    return generateVCardPayload(payload as VCardPayload);
  }

  if (type === 'url') {
    if (typeof payload === 'object' && payload !== null && 'url' in payload) {
      return String((payload as { url: unknown }).url);
    }
    return String(payload);
  }

  if (type === 'text') {
    if (typeof payload === 'object' && payload !== null && 'text' in payload) {
      return String((payload as { text: unknown }).text);
    }
    return typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  }

  return typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
}
