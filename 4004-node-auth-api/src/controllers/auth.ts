import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  login,
  refreshTokenPair,
  logout,
  logoutAllDevices,
  revokeSession,
  changePassword,
} from '../auth-service';
import { Errors } from '../utils/errors';
import { getSessionById } from '../session-repository';

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return next(Errors.BadRequest('Username and password are required', 'MISSING_CREDENTIALS'));
    }
    const result = await login(username, password, req);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export function refreshHandler(req: Request, res: Response, next: NextFunction): void {
  try {
    const { refresh_token, refreshToken } = req.body || {};
    const token = refresh_token || refreshToken;
    if (!token) {
      return next(Errors.BadRequest('Refresh token is required', 'MISSING_REFRESH_TOKEN'));
    }
    const result = refreshTokenPair(token, req);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export function logoutHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const session = getSessionById(user.session_id);
    if (!session) {
      return next(Errors.NotFound('Session not found', 'SESSION_NOT_FOUND'));
    }
    logout(user.sub, user.session_id, user.jti, session.refresh_jti);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
}

export function logoutAllHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const count = logoutAllDevices(user.sub, user.session_id);
    res.json({ data: { success: true, terminatedCount: count } });
  } catch (err) {
    next(err);
  }
}

export function revokeSessionHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const { sessionId } = req.params;
    if (!sessionId) {
      return next(Errors.BadRequest('Session ID is required', 'MISSING_SESSION_ID'));
    }
    const result = revokeSession(user.sub, sessionId, user.session_id);
    res.json({ data: { success: result } });
  } catch (err) {
    next(err);
  }
}

export function changePasswordHandler(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const user = req.user!;
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return next(Errors.BadRequest('oldPassword and newPassword are required', 'MISSING_PASSWORD'));
    }
    if (newPassword.length < 8) {
      return next(Errors.BadRequest('Password must be at least 8 characters', 'WEAK_PASSWORD'));
    }
    changePassword(user.sub, oldPassword, newPassword);
    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
}
