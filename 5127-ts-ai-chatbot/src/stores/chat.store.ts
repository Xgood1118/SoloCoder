import { create } from 'zustand';
import type { Session, Message } from '@/types';
import { authFetch } from '@/stores/auth.store';

interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  intentLabel: string;

  loadSessions: () => Promise<void>;
  createSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  loadMessages: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  setStreaming: (v: boolean) => void;
  setIntentLabel: (v: string) => void;
  appendMessage: (msg: Message) => void;
  updateLastAssistant: (content: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  isStreaming: false,
  intentLabel: '',

  loadSessions: async () => {
    const res = await authFetch('/api/sessions');
    if (res.ok) {
      const data = await res.json();
      set({ sessions: data });
    }
  },

  createSession: async () => {
    const res = await authFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新会话' }),
    });
    if (res.ok) {
      const session: Session = await res.json();
      set((s) => ({ sessions: [session, ...s.sessions], currentSessionId: session.id, messages: [] }));
    }
  },

  deleteSession: async (id) => {
    const res = await authFetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      set((s) => {
        const sessions = s.sessions.filter((ss) => ss.id !== id);
        const currentSessionId = s.currentSessionId === id ? (sessions[0]?.id ?? null) : s.currentSessionId;
        return { sessions, currentSessionId, messages: s.currentSessionId === id ? [] : s.messages };
      });
    }
  },

  renameSession: async (id, title) => {
    const res = await authFetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      set((s) => ({
        sessions: s.sessions.map((ss) => (ss.id === id ? { ...ss, title } : ss)),
      }));
    }
  },

  selectSession: async (id) => {
    set({ currentSessionId: id });
    await get().loadMessages(id);
  },

  loadMessages: async (sessionId) => {
    const res = await authFetch(`/api/sessions/${sessionId}/messages`);
    if (res.ok) {
      const data = await res.json();
      set({ messages: data });
    }
  },

  sendMessage: async (content) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: currentSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], isStreaming: true, intentLabel: '' }));

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: currentSessionId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, assistantMsg] }));

    try {
      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, message: content }),
      });

      if (!response.ok) {
        const err = await response.json();
        set((s) => {
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: err.error || '请求失败' };
          }
          return { messages: msgs, isStreaming: false };
        });
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'intent') {
                const labels: Record<string, string> = { knowledge: '知识查询', process: '流程指引', ticket: '工单发起', human: '人工转接', chat: '日常对话' };
                set({ intentLabel: labels[event.data] ?? event.data });
              }
              if (event.type === 'content') {
                set((s) => {
                  const msgs = [...s.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, content: last.content + event.data };
                  }
                  return { messages: msgs };
                });
              }
              if (event.type === 'warning') {
                set((s) => {
                  const msgs = [...s.messages];
                  const last = msgs[msgs.length - 1];
                  if (last?.role === 'assistant') {
                    msgs[msgs.length - 1] = { ...last, sensitiveWarning: event.data };
                  }
                  return { messages: msgs };
                });
              }
              if (event.type === 'done' || event.type === 'error') {
                set({ isStreaming: false });
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch {
      set({ isStreaming: false });
    }
  },

  setStreaming: (v) => set({ isStreaming: v }),
  setIntentLabel: (v) => set({ intentLabel: v }),
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistant: (content) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs };
    }),
}));
