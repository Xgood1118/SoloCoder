import { User } from './user.model';

export interface Comment {
  id: string;
  documentId: string;
  content: string;
  authorId: string;
  author?: User;
  parentId: string | null;
  likes: number;
  isLiked?: boolean;
  replies?: Comment[];
  createdAt: string | number;
  updatedAt: string | number;
}

export interface CreateCommentRequest {
  documentId: string;
  content: string;
  parentId?: string | null;
}

export interface UpdateCommentRequest {
  content: string;
}

export interface CommentListParams {
  documentId: string;
  page?: number;
  pageSize?: number;
}
