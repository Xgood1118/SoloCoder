import { useState, useRef, useCallback, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';
import { useChatStore } from '@/stores/chat.store';

interface ChatInputProps {
  onSend: (message: string) => void;
}

export default function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const contextCount = useChatStore((s) => s.messages.length);
  const contextRound = Math.min(Math.floor(contextCount / 2), 10);

  return (
    <div className="border-t border-dark-600 bg-dark-800 px-4 py-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 items-end rounded-xl border border-dark-600 bg-dark-700 px-3 py-2 focus-within:border-primary/50">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? '等待回复中...' : '输入您的问题...'}
            disabled={isStreaming}
            rows={1}
            className="max-h-[160px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-light-100 placeholder:text-light-300 focus:outline-none disabled:opacity-50"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isStreaming || !value.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-1.5 text-xs text-light-300">
        上下文: {contextRound}/10 · Enter 发送 · Shift+Enter 换行
      </div>
    </div>
  );
}
