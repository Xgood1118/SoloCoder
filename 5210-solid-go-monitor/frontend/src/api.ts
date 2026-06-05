import type {
  Probe,
  ProbeResult,
  ProbeStats,
  Event,
  Alert,
  Overview,
  CreateProbeRequest,
} from './types';

const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getOverview: () => request<Overview>('/overview'),
  getGroups: () => request<string[]>('/groups'),

  getProbes: () => request<Probe[]>('/probes'),
  getProbe: (id: string) => request<Probe>(`/probes/${id}`),
  createProbe: (data: CreateProbeRequest) =>
    request<Probe>('/probes', { method: 'POST', body: JSON.stringify(data) }),
  updateProbe: (id: string, data: CreateProbeRequest) =>
    request<Probe>(`/probes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  patchProbe: (id: string, data: Partial<CreateProbeRequest> & { enabled?: boolean; group?: string }) =>
    request<Probe>(`/probes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProbe: (id: string) =>
    request<void>(`/probes/${id}`, { method: 'DELETE' }),
  cloneProbe: (id: string) =>
    request<Probe>(`/probes/${id}/clone`, { method: 'POST' }),
  testProbe: (id: string) =>
    request<ProbeResult>(`/probes/${id}/test`, { method: 'POST' }),
  importProbes: (data: CreateProbeRequest[]) =>
    request<Probe[]>('/probes/import', { method: 'POST', body: JSON.stringify(data) }),

  getResults: (id: string, params?: { since?: string; until?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.since) qs.set('since', params.since);
    if (params?.until) qs.set('until', params.until);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return request<ProbeResult[]>(`/probes/${id}/results${q}`);
  },
  getStats: (id: string) => request<ProbeStats>(`/probes/${id}/stats`),
  getFailures: (id: string, limit = 10) =>
    request<ProbeResult[]>(`/probes/${id}/failures?limit=${limit}`),

  getEvents: (limit = 100) => request<Event[]>(`/events?limit=${limit}`),
  ackEvent: (id: string) =>
    request<void>(`/events/${id}/ack`, { method: 'POST' }),

  getAlerts: () => request<Alert[]>('/alerts'),
  getAlertHistory: (limit = 100) =>
    request<Alert[]>(`/alerts/history?limit=${limit}`),
  ackAlert: (probeId: string) =>
    request<void>(`/alerts/${probeId}/ack`, { method: 'POST' }),
  silenceAlert: (probeId: string, minutes: number) =>
    request<void>(`/alerts/${probeId}/silence`, {
      method: 'POST',
      body: JSON.stringify({ minutes }),
    }),
  ackAlertsBatch: (probeIds: string[]) =>
    request<void>('/alerts/batch/ack', {
      method: 'POST',
      body: JSON.stringify({ probeIds }),
    }),
  silenceAlertsBatch: (probeIds: string[], minutes: number) =>
    request<void>('/alerts/batch/silence', {
      method: 'POST',
      body: JSON.stringify({ probeIds, minutes }),
    }),
};
