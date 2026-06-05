import { Response } from 'express';

export interface SseMessage {
  event?: string;
  data: string;
  id?: string;
}

export function setupSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

export function sendSseMessage(res: Response, message: SseMessage): void {
  if (message.id) {
    res.write(`id: ${message.id}\n`);
  }
  if (message.event) {
    res.write(`event: ${message.event}\n`);
  }
  res.write(`data: ${message.data}\n\n`);
}

export function sendSseHeartbeat(res: Response): void {
  res.write(': heartbeat\n\n');
}
