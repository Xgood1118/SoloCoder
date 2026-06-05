import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { environment } from '../../environments/environment';
import {
  Document,
  DocumentSearchParams,
  DocumentStatus,
  SortField,
  SortOrder,
} from '../core/models/document.model';
import { Tag } from '../core/models/tag.model';
import { Category } from '../core/models/category.model';

@Component({
  selector: 'app-document-list',
  template: `
    <div class="document-list">
      <div class="page-header">
        <h2>文档管理</h2>
        <button
          nz-button
          nzType="primary"
          (click)="createDocument()"
          *ngIf="authService.hasRole(['admin', 'contributor'])"
        >
          <i nz-icon nzType="plus"></i>
          新建文档
        </button>
      </div>

      <nz-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-form">
          <div class="filter-row">
            <nz-input-group nzSearch nzSize="default" class="search-input">
              <input
                type="text"
                nz-input
                placeholder="搜索标题..."
                formControlName="keyword"
                (keyup.enter)="search()"
              />
              <button nz-button nzType="primary" nzSearch (click)="search()">搜索</button>
            </nz-input-group>
          </div>
          <div class="filter-row">
            <nz-form-item class="filter-item">
              <nz-form-label>分类</nz-form-label>
              <nz-select
                formControlName="categoryId"
                nzAllowClear
                nzPlaceHolder="选择分类"
                class="filter-select"
              >
                <nz-option *ngFor="let cat of flatCategories" [nzValue]="cat.id" [nzLabel]="cat.name"></nz-option>
              </nz-select>
            </nz-form-item>
            <nz-form-item class="filter-item">
              <nz-form-label>标签</nz-form-label>
              <nz-select
                formControlName="tagId"
                nzAllowClear
                nzPlaceHolder="选择标签"
                class="filter-select"
              >
                <nz-option *ngFor="let tag of tags" [nzValue]="tag.id" [nzLabel]="tag.name"></nz-option>
              </nz-select>
            </nz-form-item>
            <nz-form-item class="filter-item">
              <nz-form-label>状态</nz-form-label>
              <nz-select
                formControlName="status"
                nzAllowClear
                nzPlaceHolder="选择状态"
                class="filter-select"
              >
                <nz-option nzValue="DRAFT" nzLabel="草稿"></nz-option>
                <nz-option nzValue="PENDING_REVIEW" nzLabel="待审核"></nz-option>
                <nz-option nzValue="APPROVED" nzLabel="已通过"></nz-option>
                <nz-option nzValue="REJECTED" nzLabel="已驳回"></nz-option>
                <nz-option nzValue="PUBLISHED" nzLabel="已发布"></nz-option>
              </nz-select>
            </nz-form-item>
          </div>
          <div class="filter-row">
            <nz-form-item class="filter-item">
              <nz-form-label>创建时间</nz-form-label>
              <nz-range-picker
                formControlName="createdRange"
                class="filter-select"
              ></nz-range-picker>
            </nz-form-item>
            <nz-form-item class="filter-item">
              <nz-form-label>排序方式</nz-form-label>
              <nz-select formControlName="sortField" class="filter-select">
                <nz-option nzValue="createdAt" nzLabel="按创建时间"></nz-option>
                <nz-option nzValue="updatedAt" nzLabel="按更新时间"></nz-option>
                <nz-option nzValue="title" nzLabel="按标题"></nz-option>
              </nz-select>
            </nz-form-item>
            <nz-form-item class="filter-item">
              <nz-form-label>排序方向</nz-form-label>
              <nz-radio-group formControlName="sortDirection">
                <label nz-radio-button nzValue="desc">降序</label>
                <label nz-radio-button nzValue="asc">升序</label>
              </nz-radio-group>
            </nz-form-item>
          </div>
          <div class="filter-actions">
            <button nz-button (click)="resetFilters()">重置</button>
            <button nz-button nzType="primary" (click)="search()">查询</button>
          </div>
        </form>
      </nz-card>

      <nz-card class="table-card">
        <nz-table
          #basicTable
          [nzData]="documents"
          [nzLoading]="loading"
          [nzTotal]="total"
          [nzPageSize]="pageSize"
          [nzPageIndex]="page"
          [nzPageSizeOptions]="pageSizeOptions"
          [nzShowSizeChanger]="true"
          [nzShowPagination]="true"
          (nzQueryParams)="onQueryParamsChange($event)"
        >
          <thead>
            <tr>
              <th>标题</th>
              <th nzWidth="120px">分类</th>
              <th nzWidth="150px">标签</th>
              <th nzWidth="80px">状态</th>
              <th nzWidth="80px">权限</th>
              <th nzWidth="100px">作者</th>
              <th nzWidth="100px">浏览</th>
              <th nzWidth="150px">创建时间</th>
              <th nzWidth="150px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let doc of basicTable.data">
              <td>
                <a (click)="viewDocument(doc.id)" class="title-link">{{ doc.title }}</a>
              </td>
              <td>{{ doc.categoryName || '-' }}</td>
              <td>
                <nz-tag
                  *ngFor="let tag of doc.tags?.slice(0, 2)"
                  nzColor="blue"
                  nzSize="small"
                >
                  {{ tag.name }}
                </nz-tag>
                <span *ngIf="doc.tags?.length > 2" class="more-tags">
                  +{{ doc.tags.length - 2 }}
                </span>
              </td>
              <td>
                <nz-tag [nzColor]="getStatusColor(doc.status)" nzSize="small">
                  {{ getStatusText(doc.status) }}
                </nz-tag>
              </td>
              <td>
                <nz-tag [nzColor]="getAccessColor(doc.accessLevel)" nzSize="small">
                  {{ getAccessText(doc.accessLevel) }}
                </nz-tag>
              </td>
              <td>{{ doc.authorName || '-' }}</td>
              <td>{{ doc.viewCount }}</td>
              <td>{{ dateService.formatDateTime(doc.createdAt) }}</td>
              <td>
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  (click)="viewDocument(doc.id)"
                >
                  查看
                </button>
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  (click)="editDocument(doc.id)"
                  *ngIf="authService.canEditDocument(doc.authorId)"
                >
                  编辑
                </button>
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  nzDanger
                  (click)="deleteDocument(doc)"
                  *ngIf="authService.canDeleteDocument(doc.authorId)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>
    </div>
  `,
  styleUrls: ['./document-list.component.scss'],
})
export class DocumentListComponent implements OnInit {
  documents: Document[] = [];
  loading = false;
  total = 0;
  page = 1;
  pageSize = environment.defaultPageSize;
  pageSizeOptions = environment.pageSizeOptions;

  filterForm: FormGroup;
  tags: Tag[] = [];
  categories: Category[] = [];
  flatCategories: Category[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
    public dateService: DateService,
    private notificationService: NotificationService
  ) {
    this.filterForm = this.fb.group({
      keyword: [''],
      categoryId: [''],
      tagId: [''],
      status: [''],
      createdRange: [[]],
      sortField: ['createdAt'],
      sortDirection: ['desc'],
    });
  }

  ngOnInit(): void {
    this.loadTags();
    this.loadCategories();

    this.route.queryParams.subscribe((params) => {
      if (params['categoryIds']) {
        const ids = params['categoryIds'].split(',');
        if (ids.length > 0) {
          this.filterForm.patchValue({ categoryId: ids[0] });
        }
      }
      this.loadDocuments();
    });
  }

  loadTags(): void {
    this.apiService.getAllTags().subscribe((tags) => {
      this.tags = tags;
    });
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe((categories) => {
      this.categories = categories;
      this.flatCategories = this.flattenCategories(categories);
    });
  }

  private flattenCategories(categories: Category[]): Category[] {
    const result: Category[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach((cat) => {
        result.push(cat);
        if (cat.children) {
          traverse(cat.children);
        }
      });
    };
    traverse(categories);
    return result;
  }

  loadDocuments(): void {
    this.loading = true;
    const formValue = this.filterForm.value;
    const params: DocumentSearchParams = {
      keyword: formValue.keyword || undefined,
      categoryIds: formValue.categoryId ? [formValue.categoryId] : undefined,
      tagIds: formValue.tagId ? [formValue.tagId] : undefined,
      status: formValue.status || undefined,
      sortField: formValue.sortField as SortField,
      sortDirection: formValue.sortDirection as SortOrder,
      page: this.page,
      pageSize: this.pageSize,
    };

    if (formValue.createdRange && formValue.createdRange.length === 2) {
      params.createdFrom = formValue.createdRange[0]?.toISOString();
      params.createdTo = formValue.createdRange[1]?.toISOString();
    }

    this.apiService.getDocuments(params).subscribe({
      next: (response) => {
        this.documents = response.items;
        this.total = response.total;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.page = params.pageIndex;
    this.pageSize = params.pageSize;
    this.loadDocuments();
  }

  search(): void {
    this.page = 1;
    this.loadDocuments();
  }

  resetFilters(): void {
    this.filterForm.reset({
      keyword: '',
      categoryId: '',
      tagId: '',
      status: '',
      createdRange: [],
      sortField: 'createdAt',
      sortDirection: 'desc',
    });
    this.page = 1;
    this.loadDocuments();
  }

  createDocument(): void {
    this.router.navigate(['/documents/new']);
  }

  viewDocument(id: string): void {
    this.router.navigate(['/documents', id]);
  }

  editDocument(id: string): void {
    this.router.navigate(['/documents', id, 'edit']);
  }

  deleteDocument(doc: Document): void {
    this.notificationService.confirmDelete(() => {
      this.apiService.deleteDocument(doc.id).subscribe({
        next: () => {
          this.notificationService.success('文档删除成功');
          this.loadDocuments();
        },
      });
    }, '确定要删除该文档吗？此操作不可恢复。');
  }

  getStatusColor(status: DocumentStatus): string {
    const colors: Record<string, string> = {
      DRAFT: 'gold',
      PENDING_REVIEW: 'blue',
      APPROVED: 'green',
      REJECTED: 'red',
      PUBLISHED: 'green',
    };
    return colors[status] || 'default';
  }

  getStatusText(status: DocumentStatus): string {
    const texts: Record<string, string> = {
      DRAFT: '草稿',
      PENDING_REVIEW: '待审核',
      APPROVED: '已通过',
      REJECTED: '已驳回',
      PUBLISHED: '已发布',
    };
    return texts[status] || status;
  }

  getAccessColor(access: string): string {
    const colors: Record<string, string> = {
      PUBLIC: 'green',
      INTERNAL: 'blue',
      PRIVATE: 'red',
    };
    return colors[access] || 'default';
  }

  getAccessText(access: string): string {
    const texts: Record<string, string> = {
      PUBLIC: '公开',
      INTERNAL: '内部',
      PRIVATE: '私有',
    };
    return texts[access] || access;
  }
}
