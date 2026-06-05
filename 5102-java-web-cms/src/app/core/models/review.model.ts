import { User } from './user.model';

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ReviewRecord {
  id: string;
  documentId: string;
  documentTitle: string;
  reviewerId: string;
  reviewer?: User;
  submitterId: string;
  submitter?: User;
  level: number;
  status: ReviewStatus;
  comment?: string;
  createdAt: string | number;
  reviewedAt?: string | number;
}

export interface ReviewActionRequest {
  documentId?: string;
  level?: number;
  reviewRecordId?: string;
  comment?: string;
}

export interface ReviewConfig {
  id: string;
  categoryId: string;
  categoryName?: string;
  reviewLevel: number;
  levelOneRole: string;
  levelTwoRole: string;
  enabled: boolean;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface ReviewConfigCreateRequest {
  categoryId: string;
  reviewLevel: number;
  levelOneRole: string;
  levelTwoRole?: string;
  enabled: boolean;
}

export interface ReviewConfigUpdateRequest {
  categoryId?: string;
  reviewLevel?: number;
  levelOneRole?: string;
  levelTwoRole?: string;
  enabled?: boolean;
}
