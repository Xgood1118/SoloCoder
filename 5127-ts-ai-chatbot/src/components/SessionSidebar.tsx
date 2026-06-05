import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Pencil, Check, X, MessageSquare, Settings, Clock, LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';

export default function SessionSidebar() {
  const navigate = useNavigate();
  const { sessions, currentSessionId, createSession, deleteSession, renameSession, selectSession } = useChatStore();
  const { user, logout } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleCreate = async () => {
    await createSession();
  };

  const handleSelect = async (id: string) => {
    if (editingId) return;
    await selectSession(id);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSession(id);
  };

  const startEdit = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setEditingId(id);
    setEditTitle(title);
  };

  const confirmEdit = async () => {
    if (editingId && editTitle.trim()) {
      await renameSession(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-dark-600 bg-dark-800">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-base font-semibold text-light-100">企业知识助手</h1>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={handleCreate}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-dark-600 px-3 py-2 text-sm text-light-300 transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" />
          新建会话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => handleSelect(session.id)}
            className={cn(
              'group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors',
              currentSessionId === session.id
                ? 'bg-primary/15 text-primary'
                : 'text-light-200 hover:bg-dark-700'
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />

            {editingId === session.id ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  ref={inputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmEdit();
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 rounded bg-dark-600 px-1.5 py-0.5 text-xs text-light-100 outline-none"
                />
                <button onClick={(e) => { e.stopPropagation(); confirmEdit(); }} className="text-green-400 hover:text-green-300">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="text-red-400 hover:text-red-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 truncate">
                  <div className="truncate">{session.title || '新会话'}</div>
                  <div className="text-xs text-light-300">{formatTime(session.updatedAt)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => startEdit(e, session.id, session.title)} className="rounded p-0.5 text-light-300 hover:text-primary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={(e) => handleDelete(e, session.id)} className="rounded p-0.5 text-light-300 hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-dark-600 px-3 py-3">
        <button
          onClick={() => navigate('/history')}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-light-300 transition-colors hover:bg-dark-700 hover:text-light-100"
        >
          <Clock className="h-4 w-4" />
          历史记录
        </button>
        <button
          onClick={() => navigate('/admin')}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-light-300 transition-colors hover:bg-dark-700 hover:text-light-100"
        >
          <Settings className="h-4 w-4" />
          管理后台
        </button>
      </div>

      <div className="border-t border-dark-600 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dark-600">
            <User className="h-4 w-4 text-light-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-medium text-light-100">{user?.username}</div>
            <div className="text-xs text-light-300">{user?.role === 'admin' ? '管理员' : '普通用户'}</div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-light-300 transition-colors hover:bg-dark-700 hover:text-red-400"
            title="退出登录"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
