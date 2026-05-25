import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { hasPermission, checkUserPermissions, listUserPermissions } from '../permission-service';
import { Errors } from '../utils/errors';

export function checkPermissionHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const code = req.query.code as string | undefined;
    if (!code) {
      return next(Errors.BadRequest('Permission code is required', 'MISSING_PERMISSION_CODE'));
    }
    const granted = hasPermission(user.sub, code);
    res.json({ data: { granted, code } });
  } catch (err) {
    next(err);
  }
}

export function checkPermissionsHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const codes = req.query.codes as string | undefined;
    if (!codes) {
      return next(Errors.BadRequest('Permission codes are required', 'MISSING_PERMISSION_CODES'));
    }
    const codeList = codes.split(',').map(c => c.trim()).filter(Boolean);
    const result = checkUserPermissions(user.sub, codeList);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export function listPermissionsHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const permissions = listUserPermissions(user.sub);
    res.json({ data: permissions });
  } catch (err) {
    next(err);
  }
}
