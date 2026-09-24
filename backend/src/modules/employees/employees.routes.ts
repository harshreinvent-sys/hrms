import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { idParamSchema, listQuerySchema } from './employees.schemas';
import { getByIdHandler, listHandler } from './employees.controller';

export const employeesRouter = Router();

// Every employee route requires a session. What each role may then see or
// change is decided in the service via policies/employeePolicy.ts.
employeesRouter.use(authenticate);

employeesRouter.get('/', validate({ query: listQuerySchema }), asyncHandler(listHandler));
employeesRouter.get('/:id', validate({ params: idParamSchema }), asyncHandler(getByIdHandler));
