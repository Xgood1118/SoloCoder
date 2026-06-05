import { Injectable, signal, DestroyRef, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export interface WsMessage {
  type: string;
  payload: unknown;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<WsMessage>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyRef = inject(DestroyRef);

  messages$ = this.messageSubject.asObservable();
  connected = signal(false);

  connect(url: string): void {
    this.disconnect();

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected.set(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        this.messageSubject.next(msg);
      } catch {
        this.messageSubject.next({ type: 'raw', payload: event.data });
      }
    };

    this.ws.onclose = () => {
      this.connected.set(false);
      this.scheduleReconnect(url);
    };

    this.ws.onerror = () => {
      this.connected.set(false);
    };

    this.destroyRef.onDestroy(() => this.disconnect());
  }

  send(message: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.connected.set(false);
  }

  private scheduleReconnect(url: string): void {
    this.reconnectTimer = setTimeout(() => {
      this.connect(url);
    }, 5000);
  }
}
