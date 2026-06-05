export type DocumentStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
export type DocumentAccess = 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
export type SortField = 'createdAt' | 'updatedAt' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface Document {
  id: string;
  title: string;
  content: string;
  summary?: string;
  categoryId: string;
  categoryName?: string;
  tags: Tag[];
  authorId: string;
  authorName?: string;
  status: DocumentStatus;
  accessLevel: DocumentAccess;
  allowComments?: boolean;
  viewCount: number;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface Tag {
  id: string;
  name: string;
  usageCount: number;
  createdAt?: string | number;
}

export interface DocumentSearchParams {
  keyword?: string;
  categoryIds?: string[];
  tagIds?: string[];
  status?: DocumentStatus;
  authorId?: string;
  accessLevel?: DocumentAccess;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sortField?: SortField;
  sortDirection?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  categoryId: string;
  accessLevel: DocumentAccess;
  allowComments?: boolean;
  tagIds: string[];
  templateId?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  categoryId?: string;
  accessLevel?: DocumentAccess;
  allowComments?: boolean;
  tagIds?: string[];
}
