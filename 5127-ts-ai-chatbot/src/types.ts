export interface Session {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: IntentType;
  sensitiveWarning?: string;
  createdAt: string;
}

export type IntentType = 'knowledge' | 'process' | 'ticket' | 'human' | 'chat';

export interface ChatStreamEvent {
  type: 'intent' | 'content' | 'warning' | 'done' | 'error';
  data: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  indexed: boolean;
}

export interface SensitiveWord {
  id: string;
  word: string;
  level: 'low' | 'medium' | 'high';
  category: string;
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  role: 'user' | 'admin';
  enabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
