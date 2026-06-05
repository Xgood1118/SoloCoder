import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';
import SessionSidebar from '@/components/SessionSidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import { useChatStore } from '@/stores/chat.store';

export default function Chat() {
  const { sessions, currentSessionId, messages, isStreaming, intentLabel, loadSessions, createSession, selectSession, sendMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      selectSession(sessions[0].id);
    }
  }, [sessions, currentSessionId, selectSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-screen">
      <SessionSidebar />

      <div className="flex flex-1 flex-col">
        {currentSessionId ? (
          <>
            <div className="flex items-center justify-between border-b border-dark-600 bg-dark-800 px-6 py-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-medium text-light-100">{currentSession?.title || '新会话'}</h2>
                {intentLabel && (
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs text-primary">
                    {intentLabel}
                  </span>
                )}
              </div>
              <span className="text-xs text-light-300">
                上下文轮次: {Math.min(Math.floor(messages.length / 2), 10)}/10
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-light-300">
                  <Bot className="h-16 w-16 text-primary/40" />
                  <div className="text-center">
                    <p className="text-lg font-medium text-light-200">企业知识问答助手</p>
                    <p className="mt-1 text-sm">输入您的问题，我将为您智能解答</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isStreaming={isStreaming && idx === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <ChatInput onSend={sendMessage} />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-light-300">
            <Bot className="h-16 w-16 text-primary/40" />
            <p className="text-sm">选择或创建一个会话开始对话</p>
            <button
              onClick={createSession}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/80"
            >
              新建会话
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
