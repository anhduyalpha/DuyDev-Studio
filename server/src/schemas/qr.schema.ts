import { z } from 'zod';

export const qrTypeSchema = z.enum(['url', 'wifi', 'vietqr', 'text', 'vcard']);
export type QrType = z.infer<typeof qrTypeSchema>;

export const qrFormatSchema = z.enum(['svg', 'png']).default('svg');
export type QrFormat = z.infer<typeof qrFormatSchema>;

export const qrErrorCorrectionLevelSchema = z.enum(['L', 'M', 'Q', 'H']).default('M');
export type QrErrorCorrectionLevel = z.infer<typeof qrErrorCorrectionLevelSchema>;

export const vietQrPayloadSchema = z.object({
  bankBin: z.string().min(1, 'bankBin is required'),
  accountNumber: z.string().min(1, 'accountNumber is required'),
  amount: z.number().positive().optional(),
  purpose: z.string().optional()
});
export type VietQrPayload = z.infer<typeof vietQrPayloadSchema>;

export const wifiPayloadSchema = z.object({
  ssid: z.string().min(1, 'ssid is required'),
  password: z.string().optional().default(''),
  security: z.string().optional().default('WPA'),
  hidden: z.boolean().optional().default(false)
});
export type WifiPayload = z.infer<typeof wifiPayloadSchema>;

export const vcardPayloadSchema = z.object({
  fullName: z.string().min(1, 'fullName is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  organization: z.string().optional(),
  title: z.string().optional(),
  website: z.string().optional()
});
export type VCardPayload = z.infer<typeof vcardPayloadSchema>;

const hexColorRegex = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const generateQrSchema = z.object({
  type: qrTypeSchema,
  payload: z.union([
    vietQrPayloadSchema,
    wifiPayloadSchema,
    vcardPayloadSchema,
    z.string(),
    z.record(z.unknown())
  ]),
  format: qrFormatSchema.optional().default('svg'),
  margin: z.number().int().min(0).max(20).optional().default(2),
  errorCorrectionLevel: qrErrorCorrectionLevelSchema.optional().default('M'),
  colorDark: z.string().regex(hexColorRegex, 'colorDark must be a valid hex color').optional().default('#000000'),
  colorLight: z.string().regex(hexColorRegex, 'colorLight must be a valid hex color').optional().default('#ffffff'),
  width: z.number().int().min(64).max(4096).optional().default(512),
  version: z.number().int().min(1).max(40).optional()
});

export type GenerateQrInput = z.infer<typeof generateQrSchema>;

export const decodeQrSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required')
});

export type DecodeQrInput = z.infer<typeof decodeQrSchema>;
