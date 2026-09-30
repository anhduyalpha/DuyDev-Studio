/**
 * Dynamic QR Analytics Formatter Helper (< 60 lines)
 */

export interface AnalyticsScanLog {
  id: number | string;
  scannedAt: Date;
  userAgent?: string | null;
  referer?: string | null;
  ipAddress?: string | null;
}

export interface AnalyticsRecord {
  id: string;
  slug: string;
  targetUrl: string;
  title: string | null;
  scanCount: number;
  isActive: boolean;
  createdAt: Date;
  lastScannedAt: Date | null;
  scans: AnalyticsScanLog[];
}

export function formatDynamicQrAnalytics(
  record: AnalyticsRecord,
  recentLogs: { scannedAt: Date }[],
  baseUrl?: string
) {
  const dailyBreakdown: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyBreakdown[key] = 0;
  }

  for (const log of recentLogs) {
    const key = log.scannedAt.toISOString().split('T')[0];
    if (key in dailyBreakdown) {
      dailyBreakdown[key]++;
    }
  }

  const shortUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/q/${record.slug}` : `/q/${record.slug}`;

  return {
    id: record.id,
    slug: record.slug,
    shortUrl,
    targetUrl: record.targetUrl,
    title: record.title,
    scanCount: record.scanCount,
    isActive: record.isActive,
    createdAt: record.createdAt,
    lastScannedAt: record.lastScannedAt,
    dailyScans: Object.entries(dailyBreakdown)
      .map(([date, count]) => ({ date, count }))
      .reverse(),
    recentScans: record.scans.map((s) => ({
      id: s.id,
      scannedAt: s.scannedAt,
      userAgent: s.userAgent,
      referer: s.referer,
      anonymizedIp: s.ipAddress
    }))
  };
}

export function recordScanTelemetry(
  dynamicQrId: string,
  slug: string,
  client: { userAgent?: string | null; referer?: string | null; ipAddress?: string | null },
  prismaClient: any,
  loggerInstance: any,
  cryptoModule: any
) {
  const salt = process.env.IP_SALT || 'ds_qr_telemetry_salt_2026';
  const hashedIp = client.ipAddress
    ? cryptoModule.createHash('sha256').update(client.ipAddress + salt).digest('hex').substring(0, 16)
    : null;

  prismaClient.dynamicQr
    .update({
      where: { id: dynamicQrId },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date()
      }
    })
    .catch((err: unknown) => {
      loggerInstance.error({ err, slug }, 'Failed to atomically increment scanCount');
    });

  prismaClient.qrScanLog
    .create({
      data: {
        dynamicQrId,
        userAgent: client.userAgent ? client.userAgent.substring(0, 500) : null,
        referer: client.referer ? client.referer.substring(0, 500) : null,
        ipAddress: hashedIp
      }
    })
    .catch((err: unknown) => {
      loggerInstance.error({ err, slug }, 'Failed to record QrScanLog telemetry');
    });
}
