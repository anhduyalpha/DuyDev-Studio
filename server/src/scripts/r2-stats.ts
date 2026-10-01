/**
 * Cloudflare R2 Telemetry & Quota Inspector
 * Displays monthly Class A / Class B request usage, circuit breaker headroom,
 * and live bucket storage consumption via S3 API and Cloudflare GraphQL.
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { env } from '../config/env.config.js';
import { R2Service } from '../services/r2.service.js';

async function main() {
  console.log('====================================================');
  console.log('   CLOUDFLARE R2 TELEMETRY & QUOTA INSPECTOR        ');
  console.log('====================================================\n');

  // 1. Internal Quota & Request Metrics
  const metrics = R2Service.getMetrics();
  const maxMonthly = env.R2_MAX_MONTHLY_REQUESTS;
  const remaining = Math.max(0, maxMonthly - metrics.totalRequests);
  const percentUsed = ((metrics.totalRequests / maxMonthly) * 100).toFixed(2);

  console.log('📊 MONTHLY REQUEST USAGE (Local Quota Tracking):');
  console.log(` - Tháng thống kê      : ${metrics.month}`);
  console.log(` - Class A (PUT/LIST)   : ${metrics.classA.toLocaleString()} lượt (Free quota: 1,000,000 / tháng)`);
  console.log(` - Class B (GET)        : ${metrics.classB.toLocaleString()} lượt (Free quota: 10,000,000 / tháng)`);
  console.log(` - Tổng số requests     : ${metrics.totalRequests.toLocaleString()}`);
  console.log(` - Hạn mức bảo vệ (Cap) : ${maxMonthly.toLocaleString()} lượt`);
  console.log(` - Còn lại an toàn      : ${remaining.toLocaleString()} lượt (${percentUsed}% đã dùng)`);
  console.log(` - Cập nhật lần cuối    : ${metrics.updatedAt}\n`);

  // 2. Live Cloudflare R2 Bucket Inspection via S3 API
  if (!env.R2_ENABLED || !env.R2_ACCOUNT_ID) {
    console.log('⚠️ R2 chưa được bật hoặc thiếu Account ID trong .env');
    return;
  }

  console.log('☁️ LIVE BUCKET STORAGE INSPECTION (S3 Endpoint):');
  console.log(` - Bucket Name          : ${env.R2_BUCKET_NAME}`);
  console.log(` - Account ID           : ${env.R2_ACCOUNT_ID}`);

  try {
    const s3 = R2Service.getClient();
    const res = await s3.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME }));
    const count = res.KeyCount || 0;
    let totalBytes = 0;

    const objects = res.Contents || [];
    for (const obj of objects) {
      totalBytes += obj.Size || 0;
    }

    const mb = (totalBytes / (1024 * 1024)).toFixed(2);
    const freeTierStorageGb = 10;
    const gb = (totalBytes / (1024 * 1024 * 1024)).toFixed(4);

    console.log(` - Số file tồn đọng     : ${count} objects`);
    console.log(` - Dung lượng lưu trữ   : ${mb} MB (${gb} GB / ${freeTierStorageGb} GB Free Tier)`);

    if (objects.length > 0) {
      console.log('\n 📁 Danh sách tệp đang lưu trữ:');
      for (const obj of objects) {
        const sizeMb = ((obj.Size || 0) / (1024 * 1024)).toFixed(2);
        console.log(`   * ${obj.Key} [${sizeMb} MB] (Sửa đổi: ${obj.LastModified?.toISOString() || 'N/A'})`);
      }
    } else {
      console.log(' ✅ Bucket sạch sẽ: 0 tệp tồn đọng (100% tệp transit đã được nạp về server và xóa khỏi R2)');
    }
  } catch (err: any) {
    console.error(' ❌ Lỗi kết nối tới Cloudflare R2 S3 API:', err.message);
  }

  // 3. Cloudflare GraphQL Analytics API (nếu có CLOUDFLARE_API_TOKEN)
  const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (cfApiToken) {
    console.log('\n📈 CLOUDFLARE GRAPHQL ANALYTICS (Official Metrics):');
    try {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

      const graphqlQuery = {
        query: `
          query GetR2Metrics($accountTag: String!, $startDate: Date!, $endDate: Date!, $bucket: String!) {
            viewer {
              accounts(filter: { accountTag: $accountTag }) {
                r2OperationsAdaptiveGroups(limit: 50, filter: { date_geq: $startDate, date_leq: $endDate, bucketName: $bucket }) {
                  sum { requests }
                  dimensions { actionType actionStatus }
                }
                r2StorageAdaptiveGroups(limit: 1, filter: { date_leq: $endDate, bucketName: $bucket }) {
                  max { payloadSize objectCount }
                }
              }
            }
          }
        `,
        variables: {
          accountTag: env.R2_ACCOUNT_ID,
          startDate: firstDay,
          endDate: lastDay,
          bucket: env.R2_BUCKET_NAME
        }
      };

      const gqlRes = await fetch('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfApiToken}`
        },
        body: JSON.stringify(graphqlQuery)
      });

      const gqlJson = await gqlRes.json() as any;
      if (gqlJson.data?.viewer?.accounts?.[0]) {
        const ops = gqlJson.data.viewer.accounts[0].r2OperationsAdaptiveGroups || [];
        console.log(' Chi tiết từ Cloudflare Billing Meter:');
        for (const op of ops) {
          console.log(`   * ${op.dimensions.actionType} (${op.dimensions.actionStatus}): ${op.sum.requests} requests`);
        }
      } else {
        console.log(' Không thể đọc GraphQL analytics:', JSON.stringify(gqlJson.errors || gqlJson));
      }
    } catch (gqlErr: any) {
      console.log(' Lỗi gọi GraphQL API:', gqlErr.message);
    }
  }

  console.log('\n====================================================\n');
}

main().catch(console.error);
