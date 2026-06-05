import { create } from 'zustand';
import type { User, LoginResponse } from '@/types';

const TOKEN_KEY = 'chatbot_token';
const USER_KEY = 'chatbot_user';

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  error: string | null;
  loading: boolean;

  init: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  error: null,
  loading: false,

  init: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || '登录失败', loading: false });
        return false;
      }
      const { token, user } = data as LoginResponse;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ token, user, isAuthenticated: true, loading: false });
      return true;
    } catch {
      set({ error: '网络错误，请稍后重试', loading: false });
      return false;
    }
  },

  register: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || '注册失败', loading: false });
        return false;
      }
      const { token, user } = data as LoginResponse;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ token, user, isAuthenticated: true, loading: false });
      return true;
    } catch {
      set({ error: '网络错误，请稍后重试', loading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));

export function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export function getAuthFetchOptions(options: RequestInit = {}): RequestInit {
  const headers = getAuthHeaders();
  return {
    ...options,
    headers: {
      ...options.headers,
      ...headers,
    },
  };
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const fullOptions = getAuthFetchOptions(options);
  const res = await fetch(url, fullOptions);
  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }
  return res;
}
