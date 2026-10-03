import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { translateThreat, translateSeverity, isBenign } from '../lib/translate';

type ConnectionState = 'connected' | 'reconnecting' | 'offline';

interface LiveStreamOptions {
  onThreatAlert?: (data: any) => void;
  onNewIncident?: (data: any) => void;
  onNewHostIncident?: (data: any) => void;
  soundEnabled?: boolean;
}

export function useLiveStream(options: LiveStreamOptions = {}) {
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/live-stream';
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true';
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<ConnectionState>(useMocks ? 'connected' : 'offline');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);

  const addNotification = useCallback((alert: any) => {
    setNotifications(prev => [alert, ...prev].slice(0, 20));
    setUnreadCount(prev => prev + 1);

    // Update browser tab title
    document.title = `(${unreadCount + 1}) SentinelAI`;
  }, [unreadCount]);

  const markAllRead = useCallback(() => {
    setUnreadCount(0);
    document.title = 'SentinelAI';
  }, []);

  const connect = useCallback(() => {
    if (useMocks) {
      setState('connected');
      return;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState('connected');
        reconnectAttempt.current = 0;
        // Start ping interval
        pingInterval.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'PING' }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.event_type) {
            case 'CONNECTED':
              break;

            case 'THREAT_ALERT': {
              const alert = msg.data;
              if (!isBenign(alert?.attack_type)) {
                const threat = translateThreat(alert?.attack_type);
                const severity = translateSeverity(alert?.severity);

                // Refetch data
                queryClient.invalidateQueries({ queryKey: ['metrics'] });
                queryClient.invalidateQueries({ queryKey: ['incidents'] });
                queryClient.invalidateQueries({ queryKey: ['blocks'] });
                queryClient.invalidateQueries({ queryKey: ['host-incidents'] });

                // Show toast for HIGH+
                if (['CRITICAL', 'HIGH'].includes(alert?.severity?.toUpperCase())) {
                  const isCritical = alert?.severity?.toUpperCase() === 'CRITICAL';
                  toast.error(threat.friendly, {
                    description: threat.explanation,
                    duration: isCritical ? Infinity : 8000,
                    action: {
                      label: 'View',
                      onClick: () => {
                        const source = alert?.source === 'HIDS' ? 'computer' : 'network';
                        window.location.href = `/activity/${source}/${alert?.alert_id}`;
                      },
                    },
                  });
                }

                addNotification({
                  id: alert?.alert_id || Date.now(),
                  title: threat.friendly,
                  severity: severity.label,
                  time: Date.now() / 1000,
                  source: alert?.source === 'HIDS' ? 'computer' : 'network',
                  alertData: alert,
                });
              }
              options.onThreatAlert?.(alert);
              break;
            }

            case 'NEW_INCIDENT':
              queryClient.invalidateQueries({ queryKey: ['incidents'] });
              queryClient.invalidateQueries({ queryKey: ['metrics'] });
              options.onNewIncident?.(msg.data);
              break;

            case 'NEW_HOST_INCIDENT':
              queryClient.invalidateQueries({ queryKey: ['host-incidents'] });
              queryClient.invalidateQueries({ queryKey: ['metrics'] });
              options.onNewHostIncident?.(msg.data);
              break;

            case 'PONG':
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setState('reconnecting');
        cleanup();
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setState('offline');
      scheduleReconnect();
    }
  }, [wsUrl, useMocks, queryClient, options, addNotification]);

  const cleanup = useCallback(() => {
    if (pingInterval.current) {
      clearInterval(pingInterval.current);
      pingInterval.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    // Backoff: 1s, 2s, 4s, 8s, max 15s
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 15000);
    reconnectAttempt.current++;
    reconnectTimer.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      cleanup();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Mock mode: emit fake alerts every 15 seconds
  useEffect(() => {
    if (!useMocks) return;
    const mockTypes = ['DDoS', 'SSH-Bruteforce', 'PortScan', 'Stealer', 'Botnet'];
    const mockSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const interval = setInterval(() => {
      const type = mockTypes[Math.floor(Math.random() * mockTypes.length)];
      const severity = mockSeverities[Math.floor(Math.random() * mockSeverities.length)];
      const alert = {
        alert_id: `MOCK-${Date.now()}`,
        timestamp: Date.now() / 1000,
        severity,
        title: type,
        message: `Mock ${type} alert`,
        src_ip: '45.33.32.156',
        dst_ip: '192.168.1.10',
        attack_type: type,
        risk_score: 5 + Math.random() * 5,
        action_taken: 'TEMP_BAN_IP',
        source: type === 'Stealer' ? 'HIDS' : 'NIDS',
      };
      const threat = translateThreat(type);
      const sev = translateSeverity(severity);
      addNotification({
        id: alert.alert_id,
        title: threat.friendly,
        severity: sev.label,
        time: alert.timestamp,
        source: alert.source === 'HIDS' ? 'computer' : 'network',
        alertData: alert,
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [useMocks, addNotification]);

  // Polling fallback when offline
  useEffect(() => {
    if (state !== 'offline' && state !== 'reconnecting') return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['host-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [state, queryClient]);

  return { state, unreadCount, notifications, markAllRead };
}
