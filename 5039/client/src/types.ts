export interface Article {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  cover_image?: string;
  status: 'draft' | 'pending_approval' | 'published' | 'archived';
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
  category_name?: string;
  template_name?: string;
}

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
  layout_config: string;
  created_at: string;
  updated_at: string;
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

export interface Approval {
  id: string;
  article_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requester_id: string;
  approver_id?: string;
  request_note?: string;
  approval_note?: string;
  requested_at: string;
  approved_at?: string;
  article_title?: string;
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
