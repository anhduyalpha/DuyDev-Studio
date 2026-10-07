import { FastifyInstance } from 'fastify';
import { uploadFile, downloadFile, viewFile, importDriveFile } from '../controllers/files.controller.js';
import { presignTransitUpload, completeTransitUpload, batchPresignTransitUpload } from '../controllers/transit.controller.js';

export async function filesRoute(app: FastifyInstance) {
  app.post('/api/v1/files/upload', uploadFile);
  app.post('/api/v1/files/import-drive', importDriveFile);
  app.post('/api/v1/files/presign', presignTransitUpload);
  app.post('/api/v1/files/presign-batch', batchPresignTransitUpload);
  app.post('/api/v1/files/complete-transit', completeTransitUpload);
  app.get('/api/v1/files/download/:fileId', downloadFile);
  app.get('/api/v1/files/download/:fileId/:filename', downloadFile);
  app.get('/api/v1/files/view/:fileId', viewFile);
  app.get('/api/v1/files/view/:fileId/:filename', viewFile);
  app.get('/api/v1/files/:fileId', downloadFile);
}
