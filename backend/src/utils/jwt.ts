import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

/**
 * What a verified token proves about the caller. This is the ONLY source of
 * identity in the API (CLAUDE.md security rule 1). `authenticate` copies it onto
 * `req.user`; nothing downstream reads ids or roles from the request body.
 */
export interface AccessTokenPayload {
  /** User.id */
  sub: string;
  employeeId: string;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Throws on a malformed, tampered, or expired token. Callers map that to 401. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null) {
    throw new jwt.JsonWebTokenError('Unexpected token payload');
  }
  const { sub, employeeId, role } = decoded as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof employeeId !== 'string' || typeof role !== 'string') {
    throw new jwt.JsonWebTokenError('Token payload is missing required claims');
  }
  return { sub, employeeId, role: role as Role };
}
