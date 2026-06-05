export type ChartType = 'line' | 'bar' | 'pie' | 'gauge';

export type WidgetRole = 'master' | 'slave' | 'independent';

export type TriggerEventType = 'click' | 'hover';

export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
  category?: string;
}

export interface WidgetLinkageConfig {
  triggerEvent: TriggerEventType;
  targetWidgetIds: string[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface WidgetConfig {
  id: string;
  title: string;
  dataStream: string;
  chartType: ChartType;
  position: WidgetPosition;
  role: WidgetRole;
  linkage: WidgetLinkageConfig;
  color?: string;
  bufferSize: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  gridCols: number;
  gridRows: number;
  cellSize: number;
}

export interface LinkageEvent {
  sourceWidgetId: string;
  eventType: TriggerEventType;
  data: {
    timestamp?: number;
    value?: number;
    label?: string;
    [key: string]: unknown;
  };
}

export interface WebSocketConfig {
  url: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  attempt: number;
  error?: string;
}

export const WIDGET_COLORS = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666',
  '#73c0de', '#3ba272', '#fc8452', '#9a60b4',
  '#ea7ccc'
];

export const DEFAULT_BUFFER_SIZE = 100;
export const DEFAULT_GRID_COLS = 12;
export const DEFAULT_GRID_ROWS = 8;
export const DEFAULT_CELL_SIZE = 100;
