import express from 'express';
import cors from 'cors';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { recordsRouter } from './routes/records.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API router - requires authentication
  const apiRouter = express.Router();
  apiRouter.use(requireAuth);

  // Mount records routes
  apiRouter.use('/records', recordsRouter);

  // Future routes (tasks, flags, trace, events) will be mounted here
  app.use('/api', apiRouter);

  // Catch-all 404 handler
  app.use((req, res, next) => {
    next(notFound(`Route ${req.method} ${req.path} not found`));
  });

  // Global standard JSON error handler
  app.use(errorHandler);

  return app;
}
