import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMetrics, getIncidents, getHostIncidents, getBlocks, getHealthCheck } from '../api/endpoints';

export type OverallStatus = 'protected' | 'handled' | 'action_needed' | 'offline';

interface OverallStatusResult {
  status: OverallStatus;
  message: string;
  threatCount: number;
  isLoading: boolean;
}

export function useOverallStatus(): OverallStatusResult {
  const { data: health, error: healthError } = useQuery({
    queryKey: ['health-check'],
    queryFn: getHealthCheck,
    refetchInterval: 15000,
    retry: 1,
  });

  const { data: incidents } = useQuery({
    queryKey: ['incidents', 50],
    queryFn: () => getIncidents(50),
    refetchInterval: 10000,
  });

  const { data: hostIncidents } = useQuery({
    queryKey: ['host-incidents', 50],
    queryFn: () => getHostIncidents(50),
    refetchInterval: 10000,
  });

  const { isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
    refetchInterval: 10000,
  });

  return useMemo(() => {
    // Offline check
    if (healthError) {
      return {
        status: 'offline' as OverallStatus,
        message: "SentinelAI can't reach its protection engine. Make sure it's running.",
        threatCount: 0,
        isLoading: false,
      };
    }

    const now = Date.now() / 1000;
    const last24h = now - 86400;
    const lastHour = now - 3600;

    // Gather all recent incidents
    const recentNetwork = (incidents?.incidents || []).filter(
      (i: any) => i.timestamp >= last24h && i.severity && ['CRITICAL', 'HIGH'].includes(i.severity.toUpperCase())
    );

    const recentHost = (hostIncidents?.host_incidents || []).filter(
      (i: any) => i.timestamp >= last24h && i.severity && ['CRITICAL', 'HIGH'].includes(i.severity.toUpperCase())
    );

    const allRecent = [...recentNetwork, ...recentHost];
    const threatCount = allRecent.length;

    // Check for action-needed conditions
    const hasFailed = allRecent.some((i: any) => {
      const status = (i.action_status || i.status || '').toUpperCase();
      return status.includes('FAILED');
    });

    const hasCriticalNew = allRecent.some((i: any) => {
      return i.timestamp >= lastHour &&
        i.severity?.toUpperCase() === 'CRITICAL' &&
        (i.status?.toUpperCase() === 'NEW' || !i.status);
    });

    if (hasFailed || hasCriticalNew) {
      return {
        status: 'action_needed' as OverallStatus,
        message: 'Something needs your attention.',
        threatCount,
        isLoading,
      };
    }

    if (threatCount > 0) {
      return {
        status: 'handled' as OverallStatus,
        message: `We stopped ${threatCount} threat${threatCount > 1 ? 's' : ''} today. No action needed from you.`,
        threatCount,
        isLoading,
      };
    }

    return {
      status: 'protected' as OverallStatus,
      message: "You're protected. Nothing needs your attention.",
      threatCount: 0,
      isLoading,
    };
  }, [healthError, incidents, hostIncidents, isLoading]);
}
