import { Request, Response, NextFunction } from 'express';
import { Errors, AppError } from '../utils/errors';
import { AuthRequest } from './auth';

export function requirePermission(
  check: (user: AuthRequest['user']) => boolean,
  code: string
) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.Unauthorized());
    }
    if (!check(req.user)) {
      return next(Errors.Forbidden(`Missing permission: ${code}`, 'MISSING_PERMISSION'));
    }
    next();
  };
}

export function requireRoles(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.Unauthorized());
    }
    const hasRole = roles.some(r => req.user!.roles.includes(r));
    if (!hasRole) {
      return next(Errors.Forbidden('Insufficient role', 'INSUFFICIENT_ROLE'));
    }
    next();
  };
}
