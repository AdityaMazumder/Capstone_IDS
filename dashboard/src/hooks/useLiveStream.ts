import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live-stream';

export type ConnectionStatus = 'Live' | 'Reconnecting...' | 'Offline';

export function useLiveStream() {
  const [status, setStatus] = useState<ConnectionStatus>('Offline');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number>(1000);
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    let pingInterval: any = null;

    function connect() {
      if (!isMounted) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('Live');
        reconnectTimeoutRef.current = 1000; // reset backoff
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'PING' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event_type === 'THREAT_ALERT') {
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
            queryClient.invalidateQueries({ queryKey: ['incidents'] });
            queryClient.invalidateQueries({ queryKey: ['blocks'] });
            
            const alertData = data.data;
            if (alertData.severity === 'CRITICAL' || alertData.severity === 'HIGH') {
              toast.error(`Threat Detected: ${alertData.title}`, {
                description: alertData.message,
              });
            } else {
              toast(`Activity: ${alertData.title}`);
            }
          }
        } catch (e) {
          console.error("Error parsing WS message", e);
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setStatus('Offline');
        if (isMounted) {
          setStatus('Reconnecting...');
          setTimeout(connect, reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = Math.min(reconnectTimeoutRef.current * 2, 15000);
        }
      };
      
      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  return status;
}
