import { fetchApi } from './client';

export const endpoints = {
  getStatus: () => fetchApi<any>('/api/status'),
  getMetrics: () => fetchApi<any>('/api/metrics'),
  getIncidents: () => fetchApi<any>('/api/incidents?limit=50&severity=HIGH'),
  getIncidentDetails: (id: string) => fetchApi<any>(`/api/incidents/${id}`),
  getHostIncidents: () => fetchApi<any>('/api/host/incidents?limit=50&classification=Stealer'),
  getBlocks: () => fetchApi<any>('/api/blocks'),
  unblock: (ruleId: string) => fetchApi<any>(`/api/blocks/unblock/${ruleId}`, { method: 'POST' }),
  generateReport: () => fetchApi<any>('/api/reports/generate', { method: 'POST' }),
};
