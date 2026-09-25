import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { recentJoinersHandler, statsHandler } from './dashboard.controller';
import { recentJoinersQuerySchema } from './dashboard.schemas';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/stats', asyncHandler(statsHandler));
dashboardRouter.get('/recent-joiners', validate({ query: recentJoinersQuerySchema }), asyncHandler(recentJoinersHandler));
