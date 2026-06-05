import { Injectable, signal } from '@angular/core';

export interface SseMessage {
  data: string;
  id?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class SseService {
  private connections = new Map<string, EventSource>();
  messages = signal<SseMessage | null>(null);

  connect(url: string, onMessage: (data: string) => void, onError?: () => void): void {
    this.disconnect(url);

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      this.messages.set({ data: event.data, id: event.lastEventId, type: event.type });
      onMessage(event.data);
    };

    eventSource.onerror = () => {
      eventSource.close();
      this.connections.delete(url);
      if (onError) {
        onError();
      }
    };

    this.connections.set(url, eventSource);
  }

  disconnect(url: string): void {
    const es = this.connections.get(url);
    if (es) {
      es.close();
      this.connections.delete(url);
    }
  }

  disconnectAll(): void {
    this.connections.forEach((es) => es.close());
    this.connections.clear();
  }
}
