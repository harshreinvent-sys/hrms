import type { Request, Response } from 'express';
import { requireUser } from '../../middleware/authenticate';
import * as dashboardService from './dashboard.service';
import type { RecentJoinersQuery } from './dashboard.schemas';

export async function statsHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json(await dashboardService.stats(requireUser(req)));
}

export async function recentJoinersHandler(req: Request, res: Response): Promise<void> {
  // `validate` has already parsed and coerced the query; the cast records that.
  const { limit } = req.query as unknown as RecentJoinersQuery;
  const items = await dashboardService.recentJoiners(requireUser(req), limit);
  res.status(200).json({ items });
}
