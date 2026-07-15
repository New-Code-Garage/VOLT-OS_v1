'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { Event } from '@/lib/types';

/** Maximum reconnect delay in milliseconds */
const MAX_RECONNECT_DELAY = 5000;

/** Base delay doubling sequence (1s → 2s → 4s → capped at 5s) */
const RECONNECT_DELAYS = [1000, 2000, 4000, MAX_RECONNECT_DELAY];

interface UseWebSocketReturn {
  isConnected: boolean;
  reconnectAttempt: number;
  error: string | null;
}

export function useWebSocket(): UseWebSocketReturn {
  const addEvent = useDashboardStore((s) => s.addEvent);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);

  // Stable reactive state via store subscriptions not needed here;
  // expose minimal state via refs that consumers can read.
  const isConnectedRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  const forceRenderRef = useRef<number>(0);
  const forceRender = () => {
    forceRenderRef.current += 1;
  };

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    cleanup();

    try {
      const wsUrl =
        typeof window !== 'undefined'
          ? `ws://${window.location.hostname}:3333/ws`
          : 'ws://localhost:3333/ws';

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        isConnectedRef.current = true;
        errorRef.current = null;
        reconnectAttemptRef.current = 0;
        // Trigger re-render
        forceRender();
      };

      ws.onmessage = (message) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(message.data) as Event;
          addEvent(data);
        } catch {
          console.error('[ws] Failed to parse message');
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        isConnectedRef.current = false;
        forceRender();
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        errorRef.current = 'WebSocket connection error';
        forceRender();
        ws.close();
      };
    } catch {
      if (!mountedRef.current) return;
      errorRef.current = 'Failed to create WebSocket';
      forceRender();
      scheduleReconnect();
    }
  }, [addEvent, cleanup]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const attempt = reconnectAttemptRef.current;
    const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptRef.current = attempt + 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  // Expose state via a simple object; consumers use this hook.
  return {
    isConnected: isConnectedRef.current,
    reconnectAttempt: reconnectAttemptRef.current,
    error: errorRef.current,
  };
}
