export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  isDefault: boolean;
  structure?: string;
  createdAt: string | number;
  updatedAt: string | number;
}

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  categoryId?: string;
  isDefault: boolean;
  structure?: string;
}

export interface TemplateUpdateRequest {
  name?: string;
  description?: string;
  categoryId?: string;
  isDefault?: boolean;
  structure?: string;
}
