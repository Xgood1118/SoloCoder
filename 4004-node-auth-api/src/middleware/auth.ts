import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token';
import { Errors } from '../utils/errors';
import { isTokenBlacklisted } from '../session-repository';
import { JwtAccessPayload } from '../utils/token';

export interface AuthRequest extends Request {
  user?: JwtAccessPayload;
  sessionId?: string;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    return next(Errors.Unauthorized('No token provided', 'NO_TOKEN'));
  }

  try {
    const payload = verifyAccessToken(token);

    if (isTokenBlacklisted(payload.jti)) {
      return next(Errors.Unauthorized('Token has been revoked', 'TOKEN_REVOKED'));
    }

    req.user = payload;
    req.sessionId = payload.session_id;
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    if (!isTokenBlacklisted(payload.jti)) {
      req.user = payload;
      req.sessionId = payload.session_id;
    }
  } catch {
    // ignore for optional auth
  }
  next();
}
