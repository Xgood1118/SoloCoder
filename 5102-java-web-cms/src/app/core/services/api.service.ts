import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Document,
  DocumentSearchParams,
  PaginatedResponse,
  CreateDocumentRequest,
  UpdateDocumentRequest,
} from '../models/document.model';
import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from '../models/category.model';
import { Tag, TagSearchParams } from '../models/tag.model';
import {
  Comment,
  CreateCommentRequest,
  CommentListParams,
} from '../models/comment.model';
import { ApiResponse, SearchResponse } from '../models/common.model';
import {
  ReviewRecord,
  ReviewActionRequest,
  ReviewConfig,
  ReviewConfigCreateRequest,
  ReviewConfigUpdateRequest,
} from '../models/review.model';
import {
  DocumentTemplate,
  TemplateCreateRequest,
  TemplateUpdateRequest,
} from '../models/template.model';
import { LoginRequest, LoginResponse } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly apiUrl = environment.apiUrl;
  private useMock = false;

  constructor(private http: HttpClient) {}

  getDocuments(
    params: DocumentSearchParams
  ): Observable<PaginatedResponse<Document>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => {
            httpParams = httpParams.append(key, v);
          });
        } else {
          httpParams = httpParams.set(key, String(value));
        }
      }
    });

    return this.http
      .get<ApiResponse<PaginatedResponse<Document>>>(`${this.apiUrl}/documents`, {
        params: httpParams,
      })
      .pipe(map((res) => res.data!));
  }

  getDocument(id: string): Observable<Document> {
    return this.http
      .get<ApiResponse<Document>>(`${this.apiUrl}/documents/${id}`)
      .pipe(map((res) => res.data!));
  }

  createDocument(request: CreateDocumentRequest): Observable<Document> {
    return this.http
      .post<ApiResponse<Document>>(`${this.apiUrl}/documents`, request)
      .pipe(map((res) => res.data!));
  }

  updateDocument(
    id: string,
    request: UpdateDocumentRequest
  ): Observable<Document> {
    return this.http
      .put<ApiResponse<Document>>(`${this.apiUrl}/documents/${id}`, request)
      .pipe(map((res) => res.data!));
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/documents/${id}`);
  }

  getCategories(): Observable<Category[]> {
    return this.http
      .get<ApiResponse<Category[]>>(`${this.apiUrl}/categories`)
      .pipe(map((res) => res.data!));
  }

  createCategory(request: CreateCategoryRequest): Observable<Category> {
    return this.http
      .post<ApiResponse<Category>>(`${this.apiUrl}/categories`, request)
      .pipe(map((res) => res.data!));
  }

  updateCategory(
    id: string,
    request: UpdateCategoryRequest
  ): Observable<Category> {
    return this.http
      .put<ApiResponse<Category>>(`${this.apiUrl}/categories/${id}`, request)
      .pipe(map((res) => res.data!));
  }

  deleteCategory(id: string, moveToRoot: boolean): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`, {
      params: { moveToRoot: String(moveToRoot) },
    });
  }

  getTags(params?: TagSearchParams): Observable<PaginatedResponse<Tag>> {
    return this.http
      .get<ApiResponse<PaginatedResponse<Tag>>>(`${this.apiUrl}/tags`, {
        params: params as Record<string, string>,
      })
      .pipe(map((res) => res.data!));
  }

  getAllTags(): Observable<Tag[]> {
    return this.http
      .get<ApiResponse<Tag[]>>(`${this.apiUrl}/tags/all`)
      .pipe(map((res) => res.data!));
  }

  createTag(name: string): Observable<Tag> {
    return this.http
      .post<ApiResponse<Tag>>(`${this.apiUrl}/tags`, { name })
      .pipe(map((res) => res.data!));
  }

  deleteTag(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/tags/${id}`);
  }

  getComments(
    params: CommentListParams
  ): Observable<PaginatedResponse<Comment>> {
    return this.http
      .get<ApiResponse<PaginatedResponse<Comment>>>(`${this.apiUrl}/comments`, {
        params: params as unknown as Record<string, string>,
      })
      .pipe(map((res) => res.data!));
  }

  createComment(request: CreateCommentRequest): Observable<Comment> {
    return this.http
      .post<ApiResponse<Comment>>(`${this.apiUrl}/comments`, request)
      .pipe(map((res) => res.data!));
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/comments/${id}`);
  }

  likeComment(id: string): Observable<{ likes: number }> {
    return this.http
      .post<ApiResponse<{ likes: number }>>(
        `${this.apiUrl}/comments/${id}/like`,
        {}
      )
      .pipe(map((res) => res.data!));
  }

  search(keyword: string): Observable<SearchResponse> {
    return this.http
      .get<ApiResponse<SearchResponse>>(`${this.apiUrl}/search`, {
        params: { keyword },
      })
      .pipe(map((res) => res.data!));
  }

  submitForReview(documentId: string): Observable<ReviewRecord> {
    return this.http
      .post<ApiResponse<ReviewRecord>>(
        `${this.apiUrl}/reviews/submit/${documentId}`,
        {}
      )
      .pipe(map((res) => res.data!));
  }

  getPendingReviews(
    reviewerId: string,
    level: number,
    page: number,
    pageSize: number
  ): Observable<PaginatedResponse<ReviewRecord>> {
    return this.http
      .get<ApiResponse<PaginatedResponse<ReviewRecord>>>(
        `${this.apiUrl}/reviews/pending/${reviewerId}/${level}`,
        {
          params: { page: String(page), pageSize: String(pageSize) },
        }
      )
      .pipe(map((res) => res.data!));
  }

  approveReview(
    request: ReviewActionRequest,
    reviewerId: string
  ): Observable<ReviewRecord> {
    return this.http
      .post<ApiResponse<ReviewRecord>>(
        `${this.apiUrl}/reviews/approve?reviewerId=${reviewerId}`,
        request
      )
      .pipe(map((res) => res.data!));
  }

  rejectReview(
    request: ReviewActionRequest,
    reviewerId: string
  ): Observable<ReviewRecord> {
    return this.http
      .post<ApiResponse<ReviewRecord>>(
        `${this.apiUrl}/reviews/reject?reviewerId=${reviewerId}`,
        request
      )
      .pipe(map((res) => res.data!));
  }

  resubmitForReview(documentId: string): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(
        `${this.apiUrl}/reviews/resubmit/${documentId}`,
        {}
      )
      .pipe(map(() => undefined));
  }

  getReviewHistory(documentId: string): Observable<ReviewRecord[]> {
    return this.http
      .get<ApiResponse<ReviewRecord[]>>(
        `${this.apiUrl}/reviews/history/${documentId}`
      )
      .pipe(map((res) => res.data!));
  }

  getTemplates(): Observable<DocumentTemplate[]> {
    return this.http
      .get<ApiResponse<DocumentTemplate[]>>(`${this.apiUrl}/templates`)
      .pipe(map((res) => res.data!));
  }

  getTemplatesByCategory(categoryId: string): Observable<DocumentTemplate[]> {
    return this.http
      .get<ApiResponse<DocumentTemplate[]>>(
        `${this.apiUrl}/templates/category/${categoryId}`
      )
      .pipe(map((res) => res.data!));
  }

  getTemplateById(id: string): Observable<DocumentTemplate> {
    return this.http
      .get<ApiResponse<DocumentTemplate>>(`${this.apiUrl}/templates/${id}`)
      .pipe(map((res) => res.data!));
  }

  createTemplate(request: TemplateCreateRequest): Observable<DocumentTemplate> {
    return this.http
      .post<ApiResponse<DocumentTemplate>>(`${this.apiUrl}/templates`, request)
      .pipe(map((res) => res.data!));
  }

  updateTemplate(
    id: string,
    request: TemplateUpdateRequest
  ): Observable<DocumentTemplate> {
    return this.http
      .put<ApiResponse<DocumentTemplate>>(
        `${this.apiUrl}/templates/${id}`,
        request
      )
      .pipe(map((res) => res.data!));
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/templates/${id}`);
  }

  getReviewConfigs(): Observable<ReviewConfig[]> {
    return this.http
      .get<ApiResponse<ReviewConfig[]>>(`${this.apiUrl}/review-configs`)
      .pipe(map((res) => res.data!));
  }

  getReviewConfigByCategory(categoryId: string): Observable<ReviewConfig> {
    return this.http
      .get<ApiResponse<ReviewConfig>>(
        `${this.apiUrl}/review-configs/category/${categoryId}`
      )
      .pipe(map((res) => res.data!));
  }

  createReviewConfig(
    request: ReviewConfigCreateRequest
  ): Observable<ReviewConfig> {
    return this.http
      .post<ApiResponse<ReviewConfig>>(
        `${this.apiUrl}/review-configs`,
        request
      )
      .pipe(map((res) => res.data!));
  }

  updateReviewConfig(
    id: string,
    request: ReviewConfigUpdateRequest
  ): Observable<ReviewConfig> {
    return this.http
      .put<ApiResponse<ReviewConfig>>(
        `${this.apiUrl}/review-configs/${id}`,
        request
      )
      .pipe(map((res) => res.data!));
  }

  deleteReviewConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/review-configs/${id}`);
  }

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<ApiResponse<LoginResponse>>(`${this.apiUrl}/auth/login`, request)
      .pipe(map((res) => res.data!));
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiResponse<void>>(`${this.apiUrl}/auth/logout`, {})
      .pipe(map(() => undefined));
  }
}
