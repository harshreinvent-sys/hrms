import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/AppError';
import type { AuthenticatedUser } from '../../middleware/authenticate';
import { canView, discloseMissing, scopeWhere } from '../../policies/employeePolicy';
import { employeeSelect, toEmployeeDto, type EmployeeDto } from './employees.dto';
import type { ListQuery } from './employees.schemas';

export interface EmployeeListResult {
  items: EmployeeDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/**
 * Scoped list. The policy's `scopeWhere` is AND-ed with the caller's filters
 * inside the query, so a filter can only narrow what the actor already sees —
 * never widen it (CLAUDE.md rule 5).
 */
export async function list(actor: AuthenticatedUser, query: ListQuery): Promise<EmployeeListResult> {
  const filters: Prisma.EmployeeWhereInput[] = [];

  if (query.department) filters.push({ department: query.department });
  if (query.status) filters.push({ status: query.status });
  if (query.search) {
    filters.push({
      OR: [
        { id: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.EmployeeWhereInput = { AND: [scopeWhere(actor), ...filters] };

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select: employeeSelect,
      orderBy: [{ id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return {
    items: rows.map(toEmployeeDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

/**
 * Single lookup, scoped in the query. When nothing comes back the policy decides
 * whether the actor may learn that (404) or not (403) — see `discloseMissing`.
 *
 * Found rows are re-checked with `canView` — redundant with the scoped query by
 * construction, and kept because it makes the object-level rule visible at the
 * call site instead of implied by a where clause.
 */
export async function getById(actor: AuthenticatedUser, id: string): Promise<EmployeeDto> {
  const row = await prisma.employee.findFirst({
    where: { id, AND: [scopeWhere(actor)] },
    select: employeeSelect,
  });

  if (!row) {
    if (discloseMissing(actor)) throw new NotFoundError('Employee');
    throw new ForbiddenError();
  }

  if (!canView(actor, row)) throw new ForbiddenError();

  return toEmployeeDto(row);
}

/** The caller's own record. The id comes from the token, never the request. */
export function me(actor: AuthenticatedUser): Promise<EmployeeDto> {
  return getById(actor, actor.employeeId);
}
