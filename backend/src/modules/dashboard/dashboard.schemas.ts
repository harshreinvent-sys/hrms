import { z } from 'zod';

export const recentJoinersQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(5),
  })
  .strict();

export type RecentJoinersQuery = z.infer<typeof recentJoinersQuerySchema>;
