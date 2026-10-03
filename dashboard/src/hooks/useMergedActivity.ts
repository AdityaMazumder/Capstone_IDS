import { useQuery } from '@tanstack/react-query';
import { endpoints } from '../api/endpoints';

export function useMergedActivity() {
  const { data: netData, isLoading: netLoad } = useQuery({ queryKey: ['incidents'], queryFn: endpoints.getIncidents });
  const { data: hostData, isLoading: hostLoad } = useQuery({ queryKey: ['host-incidents'], queryFn: endpoints.getHostIncidents });

  const incidents = [];
  if (netData?.incidents) {
    incidents.push(...netData.incidents.map((i: any) => ({
      id: i.incident_id,
      source: 'network',
      time: i.timestamp,
      severity: i.severity,
      riskScore: i.risk_score,
      typeRaw: i.attack_type,
      title: i.mitre_technique_name || i.attack_type,
      actionState: i.action_taken === 'FAILED' ? 'failed' : i.status === 'SIMULATED' ? 'test' : 'done',
    })));
  }
  if (hostData?.host_incidents) {
    incidents.push(...hostData.host_incidents.map((i: any) => ({
      id: i.incident_id,
      source: 'computer',
      time: i.timestamp,
      severity: i.severity,
      riskScore: i.risk_score,
      typeRaw: i.classification,
      title: i.process_name,
      actionState: i.action_status === 'FAILED' ? 'failed' : i.action_status === 'SIMULATED' ? 'test' : 'done',
    })));
  }

  incidents.sort((a, b) => b.time - a.time);

  return { incidents, isLoading: netLoad || hostLoad };
}
