import { Bot, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import IntentBadge from '@/components/IntentBadge';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export default function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-primary' : 'bg-dark-600'
      )}>
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>

      <div className={cn('flex max-w-[70%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {message.intent && <IntentBadge intent={message.intent} />}

        <div className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-to-br from-primary to-primary/70 text-white'
            : 'bg-dark-700 text-light-100'
        )}>
          <span className="whitespace-pre-wrap">{message.content}</span>
          {isStreaming && !isUser && (
            <span className="animate-blink text-primary">|</span>
          )}
        </div>

        {message.sensitiveWarning && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="h-3 w-3" />
            <span>{message.sensitiveWarning}</span>
          </div>
        )}

        <span className="text-xs text-light-300">
          {new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
