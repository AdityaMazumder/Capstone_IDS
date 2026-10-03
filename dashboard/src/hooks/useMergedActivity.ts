import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIncidents, getHostIncidents, getBlocks, getMetrics } from '../api/endpoints';
import { translateThreat, translateSeverity, translateNetworkAction, translateHostAction, translateActionStatus, isBenign } from '../lib/translate';

export interface MergedAlert {
  id: string;
  source: 'network' | 'computer';
  time: number;
  severity: string;
  severityRaw: string;
  riskScore: number;
  typeRaw: string;
  title: string;
  story: string;
  actionLabel: string;
  actionState: 'done' | 'test' | 'failed' | 'none';
  srcIp?: string;
  dstIp?: string;
  processName?: string;
  isNew?: boolean;
}

export function useMergedActivity(limit: number = 100) {
  const { data: networkData, isLoading: networkLoading, error: networkError } = useQuery({
    queryKey: ['incidents', limit],
    queryFn: () => getIncidents(limit),
    refetchInterval: 10000,
  });

  const { data: hostData, isLoading: hostLoading, error: hostError } = useQuery({
    queryKey: ['host-incidents', limit],
    queryFn: () => getHostIncidents(limit),
    refetchInterval: 10000,
  });

  const merged = useMemo((): MergedAlert[] => {
    const items: MergedAlert[] = [];

    // Network incidents
    if (networkData?.incidents) {
      for (const inc of networkData.incidents) {
        if (isBenign(inc.attack_type)) continue;
        const threat = translateThreat(inc.attack_type);
        const sev = translateSeverity(inc.severity);
        const actionStatus = inc.action_taken?.toUpperCase() || '';
        let actionState: MergedAlert['actionState'] = 'none';
        if (actionStatus.includes('BLOCK') || actionStatus.includes('BAN') || actionStatus.includes('RATE')) actionState = 'done';

        items.push({
          id: inc.incident_id,
          source: 'network',
          time: inc.timestamp,
          severity: sev.label,
          severityRaw: inc.severity,
          riskScore: inc.risk_score,
          typeRaw: inc.attack_type,
          title: threat.friendly,
          story: threat.explanation,
          actionLabel: translateNetworkAction(inc.action_taken),
          actionState,
          srcIp: inc.src_ip,
          dstIp: inc.dst_ip,
        });
      }
    }

    // Host incidents
    if (hostData?.host_incidents) {
      for (const inc of hostData.host_incidents) {
        if (isBenign(inc.classification)) continue;
        const threat = translateThreat(inc.classification);
        const sev = translateSeverity(inc.severity);
        const status = translateActionStatus(inc.action_status);
        let actionState: MergedAlert['actionState'] = 'none';
        if (inc.action_status?.toUpperCase().includes('SUCCESS')) actionState = 'done';
        else if (inc.action_status?.toUpperCase().includes('SIMULATED')) actionState = 'test';
        else if (inc.action_status?.toUpperCase().includes('FAILED')) actionState = 'failed';

        items.push({
          id: inc.incident_id,
          source: 'computer',
          time: inc.timestamp,
          severity: sev.label,
          severityRaw: inc.severity,
          riskScore: inc.risk_score,
          typeRaw: inc.classification,
          title: threat.friendly,
          story: threat.explanation,
          actionLabel: translateHostAction(inc.soar_action),
          actionState,
          processName: inc.process_name,
        });
      }
    }

    // Sort by time descending
    items.sort((a, b) => b.time - a.time);
    return items;
  }, [networkData, hostData]);

  return {
    alerts: merged,
    isLoading: networkLoading || hostLoading,
    error: networkError || hostError,
    networkCount: networkData?.count ?? 0,
    hostCount: hostData?.count ?? 0,
  };
}
