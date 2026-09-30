/**
 * History & Trash Bin API Routes
 */

import { FastifyInstance } from 'fastify';
import {
  getHistory,
  createHistoryItem,
  softDeleteHistoryItem,
  clearHistoryToTrash,
  getTrashItems,
  restoreTrashItem,
  restoreAllTrash,
  permanentlyDeleteTrashItem,
  emptyTrash
} from '../controllers/history.controller.js';

export async function historyRoute(app: FastifyInstance) {
  // History endpoints
  app.get('/api/v1/history', getHistory);
  app.post('/api/v1/history', createHistoryItem);
  app.delete('/api/v1/history/:id', softDeleteHistoryItem);
  app.delete('/api/v1/history', clearHistoryToTrash);

  // Trash Bin endpoints
  app.get('/api/v1/trash', getTrashItems);
  app.post('/api/v1/trash/:id/restore', restoreTrashItem);
  app.post('/api/v1/trash/restore-all', restoreAllTrash);
  app.delete('/api/v1/trash/:id', permanentlyDeleteTrashItem);
  app.delete('/api/v1/trash', emptyTrash);
}
