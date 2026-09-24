import { z } from 'zod';
import { EmploymentStatus } from '@prisma/client';

/** Public employee id, e.g. EMP001. Anything else is a 400 before any lookup. */
export const employeeIdSchema = z.string().regex(/^EMP\d{3,}$/, 'Employee id must look like EMP001');

export const idParamSchema = z.object({ id: employeeIdSchema }).strict();

export const listQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    department: z.string().trim().min(1).max(100).optional(),
    status: z.nativeEnum(EmploymentStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type ListQuery = z.infer<typeof listQuerySchema>;
