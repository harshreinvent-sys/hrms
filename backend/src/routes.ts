import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';

/**
 * Everything under /api mounts here. Each module router applies `authenticate`
 * itself (per-route or router-wide), so this file stays a plain table of
 * contents and the docs route in app.ts is never accidentally protected.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
