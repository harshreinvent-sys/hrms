import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Builds the Express app without starting a listener, so tests drive it through
 * supertest directly. Module routers mount under `/api` as each slice lands.
 */
export function createApp(): Express {
  const app = express();

  // Security headers first so they apply to every response, including errors.
  app.use(helmet());
  app.use(requestLogger);
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Unauthenticated, for uptime checks.
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Order matters: unmatched routes first, then the error translator last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
