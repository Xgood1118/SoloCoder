export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Template {
  id: string;
  name: string;
  type: string;
  layout_config: any;
  created_at: string;
  updated_at: string;
}

export type ArticleStatus = 'draft' | 'pending_approval' | 'published' | 'archived';

export interface Article {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  cover_image?: string;
  status: ArticleStatus;
  language: string;
  category_id?: string;
  template_id?: string;
  author_id: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  master_id?: string;
  tags?: Tag[];
  category?: Category;
  template?: Template;
}

export interface ArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  content?: string;
  excerpt?: string;
  cover_image?: string;
  created_by: string;
  created_at: string;
  change_log?: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  article_id: string;
  status: ApprovalStatus;
  requester_id: string;
  approver_id?: string;
  request_note?: string;
  approval_note?: string;
  requested_at: string;
  approved_at?: string;
}

export interface OperationLog {
  id: string;
  operator_id: string;
  operator_name: string;
  action: string;
  target_type: string;
  target_id: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}
