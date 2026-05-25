import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getUserInfo } from '../user-service';
import { listLoginLogs } from '../session-repository';

export async function meHandler(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const info = await getUserInfo(user.sub, user.session_id);
    res.json({ data: info });
  } catch (err) {
    next(err);
  }
}

export function loginLogsHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const logs = listLoginLogs(user.sub, limit);
    res.json({ data: logs });
  } catch (err) {
    next(err);
  }
}
