export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type BodyType = 'json' | 'formdata' | 'raw' | 'none';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestConfig {
  url: string;
  method: HttpMethod;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  bodyType: BodyType;
  body: {
    json: string;
    formdata: KeyValuePair[];
    raw: string;
  };
}

export interface ResponseData {
  success: boolean;
  data?: any;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  error?: string;
  responseTime?: number;
}

export interface HistoryItem {
  id: string;
  url: string;
  method: HttpMethod;
  request: RequestConfig;
  response?: ResponseData;
  timestamp: number;
}

export interface ProjectHeaders {
  [key: string]: {
    key: string;
    value: string;
    enabled: boolean;
  };
}
