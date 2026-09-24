import fs from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { env } from './config/env';
import { compileOriginMatcher } from './utils/cors';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes';

/**
 * The OpenAPI document is hand-written (CLAUDE.md) and is the API contract.
 * Resolved relative to this file so it works from both src/ (tsx) and dist/.
 */
function loadOpenApiSpec(): Record<string, unknown> {
  const specPath = path.resolve(__dirname, '..', 'openapi.yaml');
  return YAML.parse(fs.readFileSync(specPath, 'utf8')) as Record<string, unknown>;
}

/**
 * Builds the Express app without starting a listener, so tests drive it through
 * supertest directly.
 */
export function createApp(): Express {
  const app = express();
  const openApiSpec = loadOpenApiSpec();

  // Security headers first so they apply to every response, including errors.
  app.use(helmet());
  app.use(requestLogger);
  // Browsers send Origin; curl, health checks and server-to-server calls do not.
  // Requests without one are allowed through (they cannot be a CORS attack);
  // requests with one must match CORS_ORIGIN, which may contain `*` patterns.
  const originAllowed = compileOriginMatcher(env.corsOrigins);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || originAllowed(origin)) {
          callback(null, true);
          return;
        }
        logger.warn({ origin, allowed: env.corsOrigins }, 'CORS: origin not in CORS_ORIGIN');
        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Unauthenticated, for uptime checks.
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // API docs are deliberately public (CLAUDE.md rule 2). Helmet's default CSP
  // blocks Swagger UI's inline scripts, so it is relaxed for this path only.
  app.get('/api/docs.json', (_req, res) => {
    res.status(200).json(openApiSpec);
  });
  app.use(
    '/api/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'HRMS API docs',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use('/api', apiRouter);

  // Order matters: unmatched routes first, then the error translator last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
