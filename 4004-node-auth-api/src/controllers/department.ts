import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getVisibleDepartmentTree } from '../department-service';

export function departmentsHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const tree = getVisibleDepartmentTree(user.sub);
    res.json({ data: tree });
  } catch (err) {
    next(err);
  }
}
