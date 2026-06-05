import { create } from 'zustand';
import type {
  DataPoint,
  AggregationResult,
  AlertEvent,
  AlertRule,
} from '../types';

interface MonitorState {
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  dataPoints: DataPoint[];
  aggregationResults: AggregationResult[];
  alertEvents: AlertEvent[];
  alertRules: AlertRule[];
  selectedMetric: string;
  selectedServer: string;
  isPlaybackMode: boolean;
  playbackStartTime: number | null;
  playbackEndTime: number | null;
  playbackSpeed: number;
  isPlaying: boolean;
  metrics: string[];
  servers: string[];

  setConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void;
  addDataPoints: (points: DataPoint[]) => void;
  addAggregationResults: (results: AggregationResult[]) => void;
  addAlertEvent: (event: AlertEvent) => void;
  setAlertRules: (rules: AlertRule[]) => void;
  updateAlertEvent: (event: AlertEvent) => void;
  setSelectedMetric: (metric: string) => void;
  setSelectedServer: (server: string) => void;
  setPlaybackMode: (enabled: boolean) => void;
  setPlaybackRange: (start: number, end: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setPlaying: (playing: boolean) => void;
  setMetrics: (metrics: string[]) => void;
  setServers: (servers: string[]) => void;
  clearData: () => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
  connectionStatus: 'connecting',
  dataPoints: [],
  aggregationResults: [],
  alertEvents: [],
  alertRules: [],
  selectedMetric: 'cpu_usage',
  selectedServer: 'all',
  isPlaybackMode: false,
  playbackStartTime: null,
  playbackEndTime: null,
  playbackSpeed: 1,
  isPlaying: false,
  metrics: [],
  servers: [],

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  addDataPoints: (points) =>
    set((state) => ({
      dataPoints: [...state.dataPoints, ...points].slice(-5000),
    })),
  addAggregationResults: (results) =>
    set((state) => {
      const existing = new Map<string, AggregationResult>();
      for (const r of state.aggregationResults) {
        const key = `${r.metricName}-${r.windowStart}-${JSON.stringify(r.dimensions)}`;
        existing.set(key, r);
      }
      for (const r of results) {
        const key = `${r.metricName}-${r.windowStart}-${JSON.stringify(r.dimensions)}`;
        existing.set(key, r);
      }
      return {
        aggregationResults: Array.from(existing.values()).slice(-1000),
      };
    }),
  addAlertEvent: (event) =>
    set((state) => ({
      alertEvents: [event, ...state.alertEvents.filter((e) => e.id !== event.id)].slice(0, 100),
    })),
  setAlertRules: (rules) => set({ alertRules: rules }),
  updateAlertEvent: (event) =>
    set((state) => ({
      alertEvents: state.alertEvents.map((e) => (e.id === event.id ? event : e)),
    })),
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  setSelectedServer: (server) => set({ selectedServer: server }),
  setPlaybackMode: (enabled) => set({ isPlaybackMode: enabled }),
  setPlaybackRange: (start, end) => set({ playbackStartTime: start, playbackEndTime: end }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setMetrics: (metrics) => set({ metrics }),
  setServers: (servers) => set({ servers }),
  clearData: () => set({ dataPoints: [], aggregationResults: [] }),
}));

export function useAlertStats() {
  const alertEvents = useMonitorStore((state) => state.alertEvents);
  
  const active = alertEvents.filter((e) => e.status === 'active').length;
  const warning = alertEvents.filter((e) => e.level === 'warning').length;
  const critical = alertEvents.filter((e) => e.level === 'critical').length;

  return { active, warning, critical };
}
