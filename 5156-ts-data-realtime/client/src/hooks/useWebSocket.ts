import { useEffect, useRef } from 'react';
import { useMonitorStore } from '../store/useMonitorStore';
import type { WebSocketMessage } from '../types';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const storeActions = useRef({
    setConnectionStatus: useMonitorStore.getState().setConnectionStatus,
    addDataPoints: useMonitorStore.getState().addDataPoints,
    addAggregationResults: useMonitorStore.getState().addAggregationResults,
    addAlertEvent: useMonitorStore.getState().addAlertEvent,
  });

  const handleMessage = (message: WebSocketMessage) => {
    const actions = storeActions.current;
    switch (message.type) {
      case 'data_batch':
        actions.addDataPoints(message.data);
        break;
      case 'aggregation_batch':
        actions.addAggregationResults(message.data);
        break;
      case 'alert_event':
        actions.addAlertEvent(message.data);
        break;
      case 'connection_status':
        actions.setConnectionStatus(message.data.status);
        break;
    }
  };

  const connect = () => {
    storeActions.current.setConnectionStatus('connecting');

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        storeActions.current.setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        storeActions.current.setConnectionStatus('disconnected');
        scheduleReconnect();
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      scheduleReconnect();
    }
  };

  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      connect();
    }, delay);
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const refreshHistory = async () => {
    try {
      const response = await fetch('/api/data/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 60 }),
      });
      const data = await response.json();
      console.log('Refreshed history:', data.refreshed);
    } catch (error) {
      console.error('Error refreshing history:', error);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    refreshHistory,
  };
}
