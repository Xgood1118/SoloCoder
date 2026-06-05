export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string | number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  summary: string;
  highlightTitle?: string;
  highlightSummary?: string;
  type: 'document';
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
}
