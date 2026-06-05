import * as sessionRepo from '../repositories/session.repository.js';
import type { Session } from '../../shared/types.js';

export function createSession(userId: string, title: string): Session {
  return sessionRepo.create(userId, title);
}

export function getSessionsByUserId(userId: string): Session[] {
  return sessionRepo.findByUserId(userId);
}

export function renameSession(id: string, title: string): Session | null {
  return sessionRepo.updateTitle(id, title);
}

export function deleteSession(id: string): boolean {
  return sessionRepo.remove(id);
}
