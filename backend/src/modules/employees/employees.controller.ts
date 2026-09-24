import type { Request, Response } from 'express';
import { requireUser } from '../../middleware/authenticate';
import * as employeesService from './employees.service';
import type { ListQuery } from './employees.schemas';

export async function listHandler(req: Request, res: Response): Promise<void> {
  // `validate` has already parsed and coerced the query; the cast records that.
  const result = await employeesService.list(requireUser(req), req.query as unknown as ListQuery);
  res.status(200).json(result);
}

export async function getByIdHandler(req: Request, res: Response): Promise<void> {
  const employee = await employeesService.getById(requireUser(req), req.params.id as string);
  res.status(200).json({ employee });
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const employee = await employeesService.me(requireUser(req));
  res.status(200).json({ employee });
}
