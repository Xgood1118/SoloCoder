import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { DateService } from '../core/services/date.service';
import { Document, DocumentSearchParams, SortField, SortOrder } from '../core/models/document.model';
import { Tag } from '../core/models/tag.model';
import { Category } from '../core/models/category.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-advanced-search',
  template: `
    <div class="advanced-search">
      <nz-page-header class="page-header" nzTitle="高级搜索" nzBackIcon (nzBack)="goBack()"></nz-page-header>

      <nz-card class="filter-card">
        <form [formGroup]="searchForm" class="search-form">
          <div class="form-row">
            <nz-form-item class="form-item">
              <nz-form-label>关键词</nz-form-label>
              <nz-form-control>
                <input
                  type="text"
                  nz-input
                  formControlName="keyword"
                  placeholder="搜索标题或内容..."
                />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item class="form-item">
              <nz-form-label>分类</nz-form-label>
              <nz-form-control>
                <nz-select
                  formControlName="categoryId"
                  nzAllowClear
                  nzPlaceHolder="选择分类"
                >
                  <nz-option
                    *ngFor="let cat of flatCategories"
                    [nzValue]="cat.id"
                    [nzLabel]="cat.name"
                  ></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item class="form-item">
              <nz-form-label>标签</nz-form-label>
              <nz-form-control>
                <nz-select
                  formControlName="tagId"
                  nzAllowClear
                  nzPlaceHolder="选择标签"
                >
                  <nz-option
                    *ngFor="let tag of tags"
                    [nzValue]="tag.id"
                    [nzLabel]="tag.name"
                  ></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item class="form-item">
              <nz-form-label>状态</nz-form-label>
              <nz-form-control>
                <nz-select
                  formControlName="status"
                  nzAllowClear
                  nzPlaceHolder="选择状态"
                >
                  <nz-option nzValue="draft" nzLabel="草稿"></nz-option>
                  <nz-option nzValue="published" nzLabel="已发布"></nz-option>
                  <nz-option nzValue="archived" nzLabel="已归档"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item class="form-item">
              <nz-form-label>创建时间范围</nz-form-label>
              <nz-form-control>
                <nz-range-picker formControlName="createdRange"></nz-range-picker>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item class="form-item">
              <nz-form-label>更新时间范围</nz-form-label>
              <nz-form-control>
                <nz-range-picker formControlName="updatedRange"></nz-range-picker>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-actions">
            <button nz-button (click)="resetForm()">重置</button>
            <button nz-button nzType="primary" (click)="search()">搜索</button>
          </div>
        </form>
      </nz-card>

      <nz-card class="results-card" *ngIf="hasSearched">
        <div class="results-header">
          <h3>搜索结果</h3>
          <span class="results-count">共 {{ total }} 条结果</span>
        </div>

        <nz-list [nzLoading]="loading" nzNoResult="未找到匹配的文档">
          <nz-list-item *ngFor="let doc of documents" (click)="viewDocument(doc.id)" class="result-item">
            <nz-list-item-meta>
              <nz-list-item-meta-title>
                <a class="result-title">{{ doc.title }}</a>
              </nz-list-item-meta-title>
              <nz-list-item-meta-description>
                <div class="result-summary">{{ doc.summary }}</div>
                <div class="result-meta">
                  <span><i nz-icon nzType="folder"></i> {{ doc.category?.name || '-' }}</span>
                  <span><i nz-icon nzType="tags"></i> {{ doc.tags?.length || 0 }} 个标签</span>
                  <span><i nz-icon nzType="user"></i> {{ doc.author?.realName || '-' }}</span>
                  <span><i nz-icon nzType="clock-circle"></i> {{ dateService.formatDate(doc.updatedAt) }}</span>
                </div>
              </nz-list-item-meta-description>
            </nz-list-item-meta>
          </nz-list-item>
        </nz-list>

        <div class="pagination" *ngIf="total > 0">
          <nz-pagination
            [nzTotal]="total"
            [nzPageSize]="pageSize"
            [nzPageIndex]="page"
            [nzPageSizeOptions]="pageSizeOptions"
            [nzShowSizeChanger]="true"
            (nzPageIndexChange)="onPageChange($event)"
            (nzPageSizeChange)="onPageSizeChange($event)"
          ></nz-pagination>
        </div>
      </nz-card>
    </div>
  `,
  styleUrls: ['./advanced-search.component.scss'],
})
export class AdvancedSearchComponent implements OnInit {
  searchForm: FormGroup;
  documents: Document[] = [];
  loading = false;
  total = 0;
  page = 1;
  pageSize = environment.defaultPageSize;
  pageSizeOptions = environment.pageSizeOptions;
  hasSearched = false;

  tags: Tag[] = [];
  categories: Category[] = [];
  flatCategories: Category[] = [];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    public dateService: DateService
  ) {
    this.searchForm = this.fb.group({
      keyword: [''],
      categoryId: [''],
      tagId: [''],
      status: [''],
      createdRange: [[]],
      updatedRange: [[]],
    });
  }

  ngOnInit(): void {
    this.loadTags();
    this.loadCategories();

    this.route.queryParams.subscribe((params) => {
      if (params['keyword']) {
        this.searchForm.patchValue({ keyword: params['keyword'] });
        this.search();
      }
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

  search(): void {
    this.loading = true;
    this.hasSearched = true;
    const formValue = this.searchForm.value;

    const params: DocumentSearchParams = {
      keyword: formValue.keyword || undefined,
      categoryIds: formValue.categoryId ? [formValue.categoryId] : undefined,
      tagIds: formValue.tagId ? [formValue.tagId] : undefined,
      status: formValue.status || undefined,
      page: this.page,
      pageSize: this.pageSize,
      sortField: 'updatedAt' as SortField,
      sortDirection: 'desc' as SortOrder,
    };

    if (formValue.createdRange && formValue.createdRange.length === 2) {
      params.createdFrom = formValue.createdRange[0]?.getTime()?.toString();
      params.createdTo = formValue.createdRange[1]?.getTime()?.toString();
    }

    if (formValue.updatedRange && formValue.updatedRange.length === 2) {
      params.updatedFrom = formValue.updatedRange[0]?.getTime()?.toString();
      params.updatedTo = formValue.updatedRange[1]?.getTime()?.toString();
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

  resetForm(): void {
    this.searchForm.reset({
      keyword: '',
      categoryId: '',
      tagId: '',
      status: '',
      createdRange: [],
      updatedRange: [],
    });
    this.documents = [];
    this.total = 0;
    this.hasSearched = false;
  }

  onPageChange(page: number): void {
    this.page = page;
    this.search();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.search();
  }

  viewDocument(id: string): void {
    this.router.navigate(['/documents', id]);
  }

  goBack(): void {
    this.router.navigate(['/documents']);
  }
}
