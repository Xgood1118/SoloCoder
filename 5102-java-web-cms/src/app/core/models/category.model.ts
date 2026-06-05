export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  sort: number;
  documentCount: number;
  children?: Category[];
  createdAt: string | number;
  updatedAt: string | number;
}

export interface CreateCategoryRequest {
  name: string;
  parentId: string | null;
  sort?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  parentId?: string | null;
  sort?: number;
}

export interface MoveCategoryRequest {
  categoryId: string;
  newParentId: string | null;
}

export interface DeleteCategoryOptions {
  moveDocumentsToRoot: boolean;
}
