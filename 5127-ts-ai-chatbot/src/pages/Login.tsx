import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, loading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    clearError();
  }, [mode, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (mode === 'register' && password !== confirmPassword) {
      return;
    }

    const success = mode === 'login'
      ? await login(username.trim(), password)
      : await register(username.trim(), password);

    if (success) navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark-900 px-4">
      <div className="w-full max-w-md rounded-2xl border border-dark-600 bg-dark-800 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
            <LogIn className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-light-100">企业知识助手</h1>
          <p className="mt-2 text-sm text-light-300">
            {mode === 'login' ? '登录以继续对话' : '注册新账号'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-light-200">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-4 py-2.5 text-sm text-light-100 placeholder:text-light-300 transition-colors focus:border-primary/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-light-200">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="w-full rounded-lg border border-dark-600 bg-dark-700 px-4 py-2.5 text-sm text-light-100 placeholder:text-light-300 transition-colors focus:border-primary/50 focus:outline-none"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-light-200">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                className="w-full rounded-lg border border-dark-600 bg-dark-700 px-4 py-2.5 text-sm text-light-100 placeholder:text-light-300 transition-colors focus:border-primary/50 focus:outline-none"
              />
              {password && confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">两次输入的密码不一致</p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password || (mode === 'register' && password !== confirmPassword)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm text-primary hover:underline"
          >
            {mode === 'login' ? (
              <>没有账号？<span className="font-medium">立即注册</span></>
            ) : (
              <>已有账号？<span className="font-medium">返回登录</span></>
            )}
          </button>
        </div>

        <div className="mt-6 rounded-lg bg-dark-700/50 px-4 py-3">
          <p className="text-xs text-light-300">
            测试账号：<span className="font-mono text-primary">admin</span> / <span className="font-mono text-primary">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
