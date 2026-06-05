import * as sessionRepo from '../repositories/session.repository.js';
import * as messageRepo from '../repositories/message.repository.js';
import type { Message } from '../../shared/types.js';

export function searchHistory(
  userId: string,
  query: string
): Array<{ sessionId: string; sessionTitle: string; messages: Message[] }> {
  const sessions = sessionRepo.findByUserId(userId);
  const results: Array<{ sessionId: string; sessionTitle: string; messages: Message[] }> = [];

  for (const session of sessions) {
    const messages = messageRepo.findBySessionId(session.id);
    const matched = messages.filter(m => m.content.includes(query));
    if (matched.length > 0) {
      results.push({
        sessionId: session.id,
        sessionTitle: session.title,
        messages: matched,
      });
    }
  }

  return results;
}

export function copyMessages(
  sourceSessionId: string,
  targetSessionId: string,
  messageIds: string[]
): boolean {
  return messageRepo.copyToSession(messageIds, targetSessionId);
}
