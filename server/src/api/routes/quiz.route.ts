import { FastifyInstance } from 'fastify';
import { enqueueQuizJob, parsePromptIntent } from '../controllers/quiz.controller.js';

export async function quizRoute(app: FastifyInstance) {
  app.post('/api/v1/quiz/generate', enqueueQuizJob);
  app.post('/api/v1/quiz/parse-prompt', parsePromptIntent);
  app.post('/api/v1/quiz/smart-recognition', parsePromptIntent);
}
