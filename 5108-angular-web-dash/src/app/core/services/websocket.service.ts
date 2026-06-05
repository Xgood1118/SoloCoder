import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  BehaviorSubject,
  throwError,
  timer,
  of,
  fromEvent,
  merge,
  EMPTY
} from 'rxjs';
import {
  switchMap,
  takeUntil,
  catchError,
  retry,
  tap,
  map,
  filter,
  share,
  take,
  finalize,
  distinctUntilChanged
} from 'rxjs/operators';
import {
  DataPoint,
  ConnectionStatus,
  WebSocketConfig,
  DEFAULT_BUFFER_SIZE
} from '../../types/dashboard.types';
import { DataBufferService } from './data-buffer.service';

const DEFAULT_CONFIG: WebSocketConfig = {
  url: 'ws://localhost:8080/realtime',
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000
};

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private readonly config: WebSocketConfig = DEFAULT_CONFIG;
  private readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
    connected: false,
    reconnecting: false,
    attempt: 0
  });
  private readonly socket$ = new Subject<WebSocket>();
  private readonly subscriptions = new Map<string, { destroy$: Subject<void>; unsubscribed: boolean }>();
  private readonly globalDestroy$ = new Subject<void>();
  private socket: WebSocket | null = null;

  constructor(private readonly dataBufferService: DataBufferService) {
    this.initializeConnection();
  }

  getConnectionStatus$(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable().pipe(distinctUntilChanged());
  }

  subscribe(streamId: string, bufferSize: number = DEFAULT_BUFFER_SIZE): Observable<DataPoint[]> {
    if (!this.subscriptions.has(streamId)) {
      this.createSubscription(streamId, bufferSize);
    }

    const sub = this.subscriptions.get(streamId)!;
    if (sub.unsubscribed) {
      sub.unsubscribed = false;
      sub.destroy$ = new Subject<void>();
      this.setupStreamListener(streamId);
    }

    return this.dataBufferService.getData$(streamId) ?? of([]);
  }

  unsubscribe(streamId: string): void {
    const sub = this.subscriptions.get(streamId);
    if (sub) {
      sub.destroy$.next();
      sub.destroy$.complete();
      sub.unsubscribed = true;
      this.sendUnsubscribeMessage(streamId);
    }
  }

  send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect(): void {
    this.globalDestroy$.next();
    this.globalDestroy$.complete();
    this.subscriptions.forEach(sub => {
      sub.destroy$.next();
      sub.destroy$.complete();
    });
    this.subscriptions.clear();
    this.socket?.close();
    this.connectionStatus$.next({
      connected: false,
      reconnecting: false,
      attempt: 0
    });
  }

  private initializeConnection(): void {
    this.createSocket()
      .pipe(
        retry({
          count: this.config.reconnectAttempts,
          delay: (error: unknown, retryCount: number) => {
            const attempt = retryCount;
            this.connectionStatus$.next({
              connected: false,
              reconnecting: attempt <= this.config.reconnectAttempts,
              attempt,
              error: error instanceof Error ? error.message : String(error)
            });
            const delayTime = Math.min(
              this.config.reconnectDelay * Math.pow(2, retryCount - 1),
              this.config.maxReconnectDelay
            );
            return timer(delayTime);
          }
        }),
        finalize(() => {
          if (!this.connectionStatus$.value.connected) {
            this.connectionStatus$.next({
              connected: false,
              reconnecting: false,
              attempt: this.config.reconnectAttempts,
              error: 'Maximum reconnection attempts exceeded'
            });
          }
        }),
        takeUntil(this.globalDestroy$),
        catchError((error: unknown) => {
          this.connectionStatus$.next({
            connected: false,
            reconnecting: false,
            attempt: 0,
            error: error instanceof Error ? error.message : String(error)
          });
          return EMPTY;
        })
      )
      .subscribe(socket => {
        this.socket = socket;
        this.socket$.next(socket);
      });
  }

  private createSocket(): Observable<WebSocket> {
    return new Observable<WebSocket>(observer => {
      const ws = new WebSocket(this.config.url);

      ws.onopen = () => {
        this.connectionStatus$.next({
          connected: true,
          reconnecting: false,
          attempt: 0
        });
        this.resubscribeAllStreams();
        observer.next(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.streamId && data.data) {
            this.handleStreamData(data.streamId, data.data);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onerror = (error) => {
        observer.error(error);
      };

      ws.onclose = (event) => {
        if (!event.wasClean) {
          observer.error(new Error(`WebSocket closed unexpectedly: code ${event.code}`));
        }
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    });
  }

  private createSubscription(streamId: string, bufferSize: number): void {
    this.dataBufferService.createBuffer(streamId, bufferSize);
    this.subscriptions.set(streamId, {
      destroy$: new Subject<void>(),
      unsubscribed: false
    });
    this.setupStreamListener(streamId);
  }

  private setupStreamListener(streamId: string): void {
    const sub = this.subscriptions.get(streamId);
    if (!sub) return;

    this.socket$
      .pipe(
        filter(socket => socket.readyState === WebSocket.OPEN),
        take(1),
        tap(() => this.sendSubscribeMessage(streamId)),
        switchMap(() =>
          merge(
            this.listenToSocketMessages(streamId),
            this.listenToSocketClose(streamId)
          )
        ),
        takeUntil(sub.destroy$),
        catchError((error: unknown) => {
          console.error(`Stream ${streamId} error:`, error);
          return EMPTY;
        })
      )
      .subscribe();
  }

  private listenToSocketMessages(streamId: string): Observable<DataPoint[]> {
    if (!this.socket) return EMPTY;

    return fromEvent<MessageEvent>(this.socket, 'message').pipe(
      map(event => {
        try {
          return JSON.parse(event.data);
        } catch {
          return null;
        }
      }),
      filter((data): data is { streamId: string; data: DataPoint | DataPoint[] } =>
        data !== null && data.streamId === streamId && data.data != null
      ),
      tap(({ data }) => {
        if (Array.isArray(data)) {
          this.dataBufferService.addDataPoints(streamId, data);
        } else {
          this.dataBufferService.addDataPoint(streamId, data);
        }
      }),
      map(({ data }) => Array.isArray(data) ? data : [data]),
      share()
    );
  }

  private listenToSocketClose(streamId: string): Observable<never> {
    if (!this.socket) return EMPTY;

    return fromEvent<CloseEvent>(this.socket, 'close').pipe(
      switchMap(() => {
        const error = new Error(`Socket closed for stream ${streamId}`);
        return throwError(() => error);
      })
    );
  }

  private handleStreamData(streamId: string, data: DataPoint | DataPoint[]): void {
    if (Array.isArray(data)) {
      this.dataBufferService.addDataPoints(streamId, data);
    } else {
      this.dataBufferService.addDataPoint(streamId, data);
    }
  }

  private sendSubscribeMessage(streamId: string): void {
    this.send({ action: 'subscribe', streamId });
  }

  private sendUnsubscribeMessage(streamId: string): void {
    this.send({ action: 'unsubscribe', streamId });
  }

  private resubscribeAllStreams(): void {
    this.subscriptions.forEach((sub, streamId) => {
      if (!sub.unsubscribed) {
        this.sendSubscribeMessage(streamId);
      }
    });
  }
}
