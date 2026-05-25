import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Errors } from './errors';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_GRACE_HOURS: number = Number(process.env.JWT_REFRESH_GRACE_HOURS || 24);

export interface JwtAccessPayload {
  sub: number;
  jti: string;
  type: 'access';
  username: string;
  name: string;
  department_id: number | null;
  roles: string[];
  session_id: string;
  session_version: number;
  iat: number;
  exp: number;
}

export interface JwtRefreshPayload {
  sub: number;
  jti: string;
  type: 'refresh';
  session_id: string;
  session_version: number;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  accessJti: string;
  refreshJti: string;
}

interface AccessPayloadInput {
  sub: number;
  username: string;
  name: string;
  department_id: number | null;
  roles: string[];
  session_id: string;
  session_version: number;
}

interface RefreshPayloadInput {
  sub: number;
  session_id: string;
  session_version: number;
}

type SignExpiresIn = Exclude<jwt.SignOptions['expiresIn'], undefined>;

function toSignExpiresIn(value: string | number): SignExpiresIn {
  if (typeof value === 'number') return value;
  return value as SignExpiresIn;
}

export function signAccessToken(
  payload: AccessPayloadInput,
  expiresIn: string | number = ACCESS_EXPIRES_IN
): { token: string; jti: string; expiresAt: number } {
  const jti = uuidv4();
  const toSign: Record<string, unknown> = { ...payload, type: 'access', jti };
  const opts: jwt.SignOptions = { expiresIn: toSignExpiresIn(expiresIn) };
  const token = jwt.sign(toSign, SECRET, opts);
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return { token, jti, expiresAt: (decoded?.exp ?? 0) * 1000 };
}

export function signRefreshToken(
  payload: RefreshPayloadInput,
  expiresIn: string | number = REFRESH_EXPIRES_IN
): { token: string; jti: string; expiresAt: number } {
  const jti = uuidv4();
  const toSign: Record<string, unknown> = { ...payload, type: 'refresh', jti };
  const opts: jwt.SignOptions = { expiresIn: toSignExpiresIn(expiresIn) };
  const token = jwt.sign(toSign, SECRET, opts);
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return { token, jti, expiresAt: (decoded?.exp ?? 0) * 1000 };
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    const result = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    return result as unknown as JwtAccessPayload;
  } catch (err) {
    const e = err as Error;
    if (e.name === 'TokenExpiredError') {
      throw Errors.Unauthorized('Token expired', 'TOKEN_EXPIRED');
    }
    throw Errors.Unauthorized('Invalid token', 'TOKEN_INVALID');
  }
}

export function decodeTokenWithoutVerify(
  token: string
): JwtAccessPayload | JwtRefreshPayload | null {
  try {
    const result = jwt.decode(token);
    return result as JwtAccessPayload | JwtRefreshPayload | null;
  } catch {
    return null;
  }
}

export function isRefreshWithinGrace(token: string): {
  valid: boolean;
  payload: JwtRefreshPayload | null;
  reason?: string;
} {
  try {
    const result = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
    const payload = result as unknown as JwtRefreshPayload;
    if (payload.type !== 'refresh') {
      return { valid: false, payload: null, reason: 'NOT_REFRESH_TOKEN' };
    }
    return { valid: true, payload };
  } catch (err) {
    const e = err as Error;
    if (e.name === 'TokenExpiredError') {
      const decoded = jwt.decode(token) as JwtRefreshPayload | null;
      if (!decoded) return { valid: false, payload: null, reason: 'MALFORMED' };
      const exp = decoded.exp ?? 0;
      const now = Math.floor(Date.now() / 1000);
      const grace = REFRESH_GRACE_HOURS * 3600;
      if (now - exp <= grace) {
        return { valid: true, payload: decoded, reason: 'GRACE_PERIOD' };
      }
      return { valid: false, payload: decoded, reason: 'REFRESH_EXPIRED' };
    }
    return { valid: false, payload: null, reason: 'INVALID' };
  }
}

export { SECRET, ACCESS_EXPIRES_IN, REFRESH_EXPIRES_IN, REFRESH_GRACE_HOURS };
