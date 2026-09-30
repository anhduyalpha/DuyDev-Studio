const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const activeJobs = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const reqPath = decodeURI(parsedUrl.pathname);

  // API Route: File Upload
  if (req.method === 'POST' && reqPath === '/api/v1/files/upload') {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const fileId = `fil_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        data: { fileId, fileName: 'uploaded_file', fileSizeBytes: Buffer.concat(body).length || 1024 }
      }));
    });
    return;
  }

  // API Route: Converter Format Detect
  if (req.method === 'POST' && reqPath === '/api/v1/converter/detect') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, data: { detected: true } }));
    });
    return;
  }

  // API Route: Create Converter Job
  if (req.method === 'POST' && reqPath === '/api/v1/converter/job') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload = {};
      try { payload = JSON.parse(body); } catch {}
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      activeJobs.set(jobId, payload);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        data: { jobId, eventsUrl: `/api/v1/jobs/${jobId}/events` }
      }));
    });
    return;
  }

  // API Route: SSE Job Events Stream
  const sseMatch = reqPath.match(/^\/api\/v1\/jobs\/([^/]+)\/events$/);
  if (req.method === 'GET' && sseMatch) {
    const jobId = sseMatch[1];
    const job = activeJobs.get(jobId) || { targetFormat: 'webp' };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const steps = [
      { percentage: 20, stage: 'Đang phân tích cấu trúc luồng byte...' },
      { percentage: 48, stage: 'Đang mã hóa định dạng đích...' },
      { percentage: 76, stage: 'Đang tối ưu dung lượng và bộ lọc...' },
      { percentage: 95, stage: 'Đang đóng gói file thành phẩm...' }
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        res.write(`event: progress\ndata: ${JSON.stringify(steps[stepIdx])}\n\n`);
        stepIdx++;
      } else {
        clearInterval(interval);
        const resultFileId = `fil_res_${Date.now()}`;
        const targetExt = job.targetFormat || 'webp';
        res.write(`event: completed\ndata: ${JSON.stringify({
          jobId,
          percentage: 100,
          resultFileId,
          resultFileName: `converted_${Date.now()}.${targetExt}`,
          resultSizeBytes: 42800,
          duration: '1.8s',
          downloadUrl: `/api/v1/files/download/${resultFileId}`
        })}\n\n`);
        res.end();
      }
    }, 400);

    req.on('close', () => clearInterval(interval));
    return;
  }

  // API Route: Download file
  if (req.method === 'GET' && reqPath.startsWith('/api/v1/files/download/')) {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="converted_output.bin"',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end('DuyDev Studio - Universal Converter Processed Artifact');
  }

  let filePathName = reqPath;
  if (filePathName === '/' || filePathName === '') filePathName = '/index.html';
  const filePath = path.join(ROOT, filePathName);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    };

    if (ext === '.js' && filePath.endsWith('sw.js')) {
      headers['Service-Worker-Allowed'] = '/';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[DuyDev Studio PWA Server Running]`);
  console.log(`- Local URL:   http://localhost:${PORT}`);
  console.log(`- Network URL: http://127.0.0.1:${PORT}`);
});
