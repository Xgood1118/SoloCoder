import { inTx } from './db';
import {
  getUserByUsername,
  getUserById,
  listUserRoles,
  resetUserFailedAttempts,
  updateUserFailedAttempts,
  updateUserPassword,
} from './repositories';
import {
  blacklistToken,
  createLoginLog,
  deleteSession,
  deleteSessionsByUser,
  getActiveSessionsByUser,
  getSessionById,
  isTokenBlacklisted,
  refreshSessionTokens,
  upsertSession,
} from './session-repository';
import { verifyPassword, hashPassword } from './utils/password';
import {
  signAccessToken,
  signRefreshToken,
  isRefreshWithinGrace,
} from './utils/token';
import { formatLocation, lookupIpLocation } from './utils/geo';
import { buildDeviceFingerprint, getClientIp, parseUserAgent } from './utils/device';
import { Errors } from './utils/errors';
import { formatDate, addMinutes, addDays } from './utils/date';
import { Request } from 'express';

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 10);
const PASSWORD_EXPIRE_DAYS = Number(process.env.PASSWORD_EXPIRE_DAYS || 90);

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  mustChangePassword: boolean;
}

export async function login(
  username: string,
  password: string,
  req: Request
): Promise<LoginResult> {
  const user = getUserByUsername(username);
  const ua = req.headers['user-agent'];
  const ip = getClientIp(req);
  const deviceInfo = parseUserAgent(ua);

  const logParams = {
    username,
    ip,
    device_type: deviceInfo.device_type,
    device_model: deviceInfo.device_model,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    location: null as string | null,
  };

  if (!user) {
    createLoginLog({ ...logParams, user_id: null, status: 'failure', reason: 'USER_NOT_FOUND' });
    throw Errors.Unauthorized('Invalid username or password', 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'active') {
    createLoginLog({ ...logParams, user_id: user.id, status: 'failure', reason: 'ACCOUNT_INACTIVE' });
    throw Errors.Forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    createLoginLog({ ...logParams, user_id: user.id, status: 'failure', reason: 'ACCOUNT_LOCKED' });
    throw Errors.Locked(`Account locked until ${user.locked_until}`, 'ACCOUNT_LOCKED');
  }

  if (!verifyPassword(password, user.password_hash)) {
    const newAttempts = user.failed_attempts + 1;
    let lockedUntil: string | null = null;
    if (newAttempts >= MAX_ATTEMPTS) {
      lockedUntil = formatDate(addMinutes(new Date(), LOCK_MINUTES));
    }
    updateUserFailedAttempts(user.id, newAttempts, lockedUntil);
    createLoginLog({ ...logParams, user_id: user.id, status: 'failure', reason: 'WRONG_PASSWORD' });
    if (newAttempts >= MAX_ATTEMPTS) {
      throw Errors.Locked(`Account locked for ${LOCK_MINUTES} minutes after ${MAX_ATTEMPTS} failed attempts`, 'ACCOUNT_LOCKED');
    }
    throw Errors.Unauthorized(`Invalid username or password (${newAttempts}/${MAX_ATTEMPTS})`, 'INVALID_CREDENTIALS');
  }

  const pwdChangedAt = new Date(user.password_changed_at);
  const passwordExpired = addDays(pwdChangedAt, PASSWORD_EXPIRE_DAYS) < new Date();
  const mustChange = user.must_change_password === 1 || passwordExpired;

  const geo = await lookupIpLocation(ip);
  const location = formatLocation(geo);
  logParams.location = location;

  const roles = listUserRoles(user.id);
  const roleCodes = roles.map(r => r.code);

  return inTx(() => {
    resetUserFailedAttempts(user.id);
    createLoginLog({ ...logParams, user_id: user.id, status: 'success', reason: null });

    const fingerprint = buildDeviceFingerprint(deviceInfo, ua || '');

    const { token: at, jti: accessJti, expiresAt: accessExpiresAt } = signAccessToken({
      sub: user.id,
      username: user.username,
      name: user.name,
      department_id: user.department_id,
      roles: roleCodes,
      session_id: '',
      session_version: 0,
    });

    const { token: rt, jti: refreshJti, expiresAt: refreshExpiresAt } = signRefreshToken({
      sub: user.id,
      session_id: '',
      session_version: 0,
    });

    const sessionResult = upsertSession({
      user_id: user.id,
      device_fingerprint: fingerprint,
      device_type: deviceInfo.device_type,
      ip,
      location,
      token_jti: accessJti,
      token_expires_at: formatDate(new Date(accessExpiresAt))!,
      refresh_jti: refreshJti,
      refresh_expires_at: formatDate(new Date(refreshExpiresAt))!,
    });

    blacklistToken({
      jti: accessJti,
      user_id: user.id,
      token_type: 'access',
      reason: 'REPLACED_BY_SESSION',
      expires_at: formatDate(new Date(accessExpiresAt))!,
    });

    const { token: finalAccessToken, jti: finalAccessJti, expiresAt: finalAccessExpiresAt } = signAccessToken({
      sub: user.id,
      username: user.username,
      name: user.name,
      department_id: user.department_id,
      roles: roleCodes,
      session_id: sessionResult.id,
      session_version: sessionResult.version,
    });

    const { token: finalRefreshToken, jti: finalRefreshJti, expiresAt: finalRefreshExpiresAt } = signRefreshToken({
      sub: user.id,
      session_id: sessionResult.id,
      session_version: sessionResult.version,
    });

    const session = getSessionById(sessionResult.id);
    if (session) {
      refreshSessionTokens(session.id, session.version, {
        token_jti: finalAccessJti,
        token_expires_at: formatDate(new Date(finalAccessExpiresAt))!,
        refresh_jti: finalRefreshJti,
        refresh_expires_at: formatDate(new Date(finalRefreshExpiresAt))!,
        ip,
      });
    }

    return {
      accessToken: finalAccessToken,
      refreshToken: finalRefreshToken,
      expiresIn: Math.floor((finalAccessExpiresAt - Date.now()) / 1000),
      tokenType: 'Bearer' as const,
      mustChangePassword: mustChange,
    };
  });
}

export function refreshTokenPair(refreshToken: string, req: Request): LoginResult {
  const { valid, payload, reason } = isRefreshWithinGrace(refreshToken);
  if (!valid || !payload) {
    throw Errors.Unauthorized('Refresh token is invalid or expired', 'REFRESH_TOKEN_INVALID');
  }

  if (isTokenBlacklisted(payload.jti)) {
    throw Errors.Unauthorized('Refresh token has been revoked', 'TOKEN_REVOKED');
  }

  const session = getSessionById(payload.session_id);
  if (!session) {
    throw Errors.Unauthorized('Session not found', 'SESSION_NOT_FOUND');
  }

  if (session.version !== payload.session_version) {
    throw Errors.Unauthorized('Session version mismatch', 'SESSION_VERSION_MISMATCH');
  }

  if (session.refresh_jti !== payload.jti) {
    blacklistToken({
      jti: payload.jti,
      user_id: session.user_id,
      token_type: 'refresh',
      reason: 'REPLAY_ATTACK',
      expires_at: formatDate(new Date(payload.exp * 1000))!,
    });
    throw Errors.Unauthorized('Refresh token reuse detected', 'REFRESH_TOKEN_REUSED');
  }

  const user = getUserById(session.user_id);
  if (!user || user.status !== 'active') {
    throw Errors.Unauthorized('Account not available', 'ACCOUNT_UNAVAILABLE');
  }

  const roles = listUserRoles(user.id);
  const roleCodes = roles.map(r => r.code);

  blacklistToken({
    jti: payload.jti,
    user_id: user.id,
    token_type: 'refresh',
    reason: 'ROTATED',
    expires_at: formatDate(new Date(payload.exp * 1000))!,
  });

  const ip = getClientIp(req);

  const { token: accessToken, jti: accessJti, expiresAt: accessExpiresAt } = signAccessToken({
    sub: user.id,
    username: user.username,
    name: user.name,
    department_id: user.department_id,
    roles: roleCodes,
    session_id: session.id,
    session_version: session.version,
  });

  const { token: newRefreshToken, jti: newRefreshJti, expiresAt: newRefreshExpiresAt } = signRefreshToken({
    sub: user.id,
    session_id: session.id,
    session_version: session.version,
  });

  refreshSessionTokens(session.id, session.version, {
    token_jti: accessJti,
    token_expires_at: formatDate(new Date(accessExpiresAt))!,
    refresh_jti: newRefreshJti,
    refresh_expires_at: formatDate(new Date(newRefreshExpiresAt))!,
    ip,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: Math.floor((accessExpiresAt - Date.now()) / 1000),
    tokenType: 'Bearer' as const,
    mustChangePassword: user.must_change_password === 1,
  };
}

export function logout(userId: number, sessionId: string, accessJti: string, refreshJti: string): void {
  inTx(() => {
    blacklistToken({
      jti: accessJti,
      user_id: userId,
      token_type: 'access',
      reason: 'LOGGED_OUT',
      expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
    });
    blacklistToken({
      jti: refreshJti,
      user_id: userId,
      token_type: 'refresh',
      reason: 'LOGGED_OUT',
      expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
    });
    deleteSession(sessionId);
  });
}

export function logoutAllDevices(userId: number, currentSessionId: string): number {
  const sessions = getActiveSessionsByUser(userId);
  const count = inTx(() => {
    for (const s of sessions) {
      if (s.id === currentSessionId) continue;
      blacklistToken({
        jti: s.token_jti,
        user_id: userId,
        token_type: 'access',
        reason: 'FORCED_LOGOUT',
        expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
      });
      blacklistToken({
        jti: s.refresh_jti,
        user_id: userId,
        token_type: 'refresh',
        reason: 'FORCED_LOGOUT',
        expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
      });
    }
    return deleteSessionsByUser(userId, currentSessionId);
  });
  return count;
}

export function revokeSession(userId: number, sessionId: string, currentSessionId: string): boolean {
  if (sessionId === currentSessionId) {
    throw Errors.BadRequest('Cannot revoke current session', 'CANNOT_REVOKE_CURRENT');
  }
  const session = getSessionById(sessionId);
  if (!session || session.user_id !== userId) {
    throw Errors.NotFound('Session not found', 'SESSION_NOT_FOUND');
  }
  inTx(() => {
    blacklistToken({
      jti: session.token_jti,
      user_id: userId,
      token_type: 'access',
      reason: 'ADMIN_REVOKED',
      expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
    });
    blacklistToken({
      jti: session.refresh_jti,
      user_id: userId,
      token_type: 'refresh',
      reason: 'ADMIN_REVOKED',
      expires_at: formatDate(new Date(Date.now() + 24 * 3600 * 1000))!,
    });
    deleteSession(sessionId);
  });
  return true;
}

export function changePassword(userId: number, oldPassword: string, newPassword: string): void {
  const user = getUserById(userId);
  if (!user) throw Errors.NotFound('User not found');

  if (!verifyPassword(oldPassword, user.password_hash)) {
    throw Errors.BadRequest('Current password is incorrect', 'INVALID_OLD_PASSWORD');
  }

  if (verifyPassword(newPassword, user.password_hash)) {
    throw Errors.BadRequest('New password must be different from current', 'PASSWORD_NOT_CHANGED');
  }

  const newHash = hashPassword(newPassword);
  updateUserPassword(userId, newHash, false);
}

export { MAX_ATTEMPTS, LOCK_MINUTES, PASSWORD_EXPIRE_DAYS };
