import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage } from 'http'

const logConnections = new Map<string, Set<WebSocket>>()
const statusConnections = new Set<WebSocket>()
let wss: WebSocketServer | null = null

export function setupWebSocket(server: any): void {
  if (wss) return

  wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = request.url || ''

    if (url.startsWith('/ws/logs/')) {
      const executionId = url.replace('/ws/logs/', '')
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request, { type: 'logs', executionId })
      })
    } else if (url === '/ws/task-status') {
      wss!.handleUpgrade(request, socket, head, (ws) => {
        wss!.emit('connection', ws, request, { type: 'status' })
      })
    } else {
      socket.destroy()
    }
  })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, context: any) => {
    if (context?.type === 'logs') {
      const executionId = context.executionId
      if (!logConnections.has(executionId)) {
        logConnections.set(executionId, new Set())
      }
      logConnections.get(executionId)!.add(ws)

      ws.on('close', () => {
        const conns = logConnections.get(executionId)
        if (conns) {
          conns.delete(ws)
          if (conns.size === 0) {
            logConnections.delete(executionId)
          }
        }
      })
    } else if (context?.type === 'status') {
      statusConnections.add(ws)

      ws.on('close', () => {
        statusConnections.delete(ws)
      })
    }

    ws.on('error', (err) => {
      console.error('WebSocket error:', err)
    })
  })
}

export function broadcastLog(executionId: string, logLine: string): void {
  const conns = logConnections.get(executionId)
  if (!conns || conns.size === 0) return

  const message = JSON.stringify({
    type: 'log',
    executionId,
    timestamp: new Date().toISOString(),
    data: logLine
  })

  for (const ws of conns) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }
}

export function broadcastTaskStatus(taskId: string, status: string, extra?: Record<string, unknown>): void {
  if (statusConnections.size === 0) return

  const message = JSON.stringify({
    type: 'task-status',
    taskId,
    status,
    timestamp: new Date().toISOString(),
    ...extra
  })

  for (const ws of statusConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }
}

export function broadcastExecutionUpdate(execution: Record<string, unknown>): void {
  if (statusConnections.size === 0) return

  const message = JSON.stringify({
    type: 'execution-update',
    execution,
    timestamp: new Date().toISOString()
  })

  for (const ws of statusConnections) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }
}
