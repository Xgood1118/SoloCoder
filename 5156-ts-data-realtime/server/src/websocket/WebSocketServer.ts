import { WebSocketServer as WSServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Data as WebSocketData } from 'ws';
import type {
  DataPoint,
  AggregationResult,
  AlertEvent,
  WebSocketMessageUnion,
  WebSocketMessage,
} from '../types';

interface ClientConnection {
  ws: WebSocket;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WSServer;
  private clients: Map<string, ClientConnection> = new Map();
  private messageQueue: WebSocketMessageUnion[] = [];
  private maxQueueSize: number = 1000;

  constructor(server: HttpServer) {
    this.wss = new WSServer({ server, path: '/ws' });
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws) => {
      const clientId = this.generateClientId();
      console.log(`New WebSocket connection: ${clientId}`);

      this.clients.set(clientId, { ws, isAlive: true });

      this.sendInitialHistory(clientId);

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
        }
      });

      ws.on('message', (data) => {
        this.handleClientMessage(clientId, data);
      });

      ws.on('close', () => {
        console.log(`WebSocket disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (!client.isAlive) {
          console.log(`Terminating inactive connection: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }
        client.isAlive = false;
        client.ws.ping();
      }
    }, 30000);
  }

  private sendInitialHistory(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      this.sendToClient(clientId, {
        type: 'connection_status',
        data: {
          status: 'connected',
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error(`Error sending initial status to ${clientId}:`, error);
    }
  }

  private handleClientMessage(clientId: string, data: WebSocketData): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      console.log(`Received message from ${clientId}:`, message.type);
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
    }
  }

  broadcastDataPoints(points: DataPoint[]): void {
    const message: WebSocketMessageUnion = {
      type: 'data_batch',
      data: points,
    };
    this.broadcast(message);
  }

  broadcastAggregationResults(results: AggregationResult[]): void {
    const message: WebSocketMessageUnion = {
      type: 'aggregation_batch',
      data: results,
    };
    this.broadcast(message);
  }

  broadcastAlertEvent(event: AlertEvent): void {
    const message: WebSocketMessageUnion = {
      type: 'alert_event',
      data: event,
    };
    this.broadcast(message);
  }

  private broadcast(message: WebSocketMessageUnion): void {
    this.queueMessage(message);

    for (const [clientId, client] of this.clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Error broadcasting to ${clientId}:`, error);
        }
      }
    }
  }

  private sendToClient(clientId: string, message: WebSocketMessageUnion): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Error sending to ${clientId}:`, error);
    }
  }

  private queueMessage(message: WebSocketMessageUnion): void {
    this.messageQueue.push(message);
    if (this.messageQueue.length > this.maxQueueSize) {
      this.messageQueue.shift();
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    for (const [, client] of this.clients.entries()) {
      client.ws.close();
    }
    this.wss.close();
  }
}
