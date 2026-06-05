import { useRef, useCallback } from 'react';

interface ChatStreamEvent {
  type: 'intent' | 'content' | 'warning' | 'done' | 'error';
  data: string;
}

export function useSSE() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    sessionId: string,
    message: string,
    onEvent: (event: ChatStreamEvent) => void,
    onDone: () => void
  ) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
      signal: controller.signal,
    });

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
            const event: ChatStreamEvent = JSON.parse(line.slice(6));
            onEvent(event);
            if (event.type === 'done') onDone();
          } catch { /* ignore parse errors */ }
        }
      }
    }
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { sendMessage, abort };
}
