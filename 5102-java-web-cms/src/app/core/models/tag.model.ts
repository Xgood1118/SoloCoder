export interface Tag {
  id: string;
  name: string;
  usageCount: number;
  createdAt: string | number;
}

export interface CreateTagRequest {
  name: string;
}

export interface TagSearchParams {
  name?: string;
  page?: number;
  pageSize?: number;
}
