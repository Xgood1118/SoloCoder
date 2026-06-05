import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { Tag } from '../core/models/tag.model';

@Component({
  selector: 'app-tag-list',
  template: `
    <div class="tag-list">
      <div class="page-header">
        <h2>标签管理</h2>
        <nz-input-group
          nzSearch
          class="search-input"
          style="width: 300px;"
        >
          <input
            type="text"
            nz-input
            placeholder="搜索标签..."
            [(ngModel)]="searchKeyword"
            (keyup.enter)="search()"
          />
          <button nz-button nzType="primary" nzSearch (click)="search()">搜索</button>
        </nz-input-group>
      </div>

      <nz-card>
        <nz-table
          #tagTable
          [nzData]="tags"
          [nzLoading]="loading"
          [nzTotal]="total"
          [nzPageSize]="pageSize"
          [nzPageIndex]="page"
          [nzShowSizeChanger]="true"
          (nzPageIndexChange)="onPageChange($event)"
          (nzPageSizeChange)="onPageSizeChange($event)"
        >
          <thead>
            <tr>
              <th>标签名称</th>
              <th nzWidth="150px">使用次数</th>
              <th nzWidth="200px">创建时间</th>
              <th nzWidth="150px" *ngIf="authService.hasRole('admin')">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let tag of tagTable.data">
              <td>
                <a class="tag-link" (click)="viewTag(tag.id)">
                  <nz-tag nzColor="blue">{{ tag.name }}</nz-tag>
                </a>
              </td>
              <td>{{ tag.usageCount }}</td>
              <td>{{ dateService.formatDateTime(tag.createdAt) }}</td>
              <td *ngIf="authService.hasRole('admin')">
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  nzDanger
                  (click)="deleteTag(tag)"
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
  styleUrls: ['./tag-list.component.scss'],
})
export class TagListComponent implements OnInit {
  tags: Tag[] = [];
  loading = false;
  total = 0;
  page = 1;
  pageSize = 20;
  searchKeyword = '';

  constructor(
    private apiService: ApiService,
    private router: Router,
    public authService: AuthService,
    public dateService: DateService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadTags();
  }

  loadTags(): void {
    this.loading = true;
    this.apiService
      .getTags({
        name: this.searchKeyword || undefined,
        page: this.page,
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (response) => {
          this.tags = response.items;
          this.total = response.total;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  search(): void {
    this.page = 1;
    this.loadTags();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.loadTags();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadTags();
  }

  viewTag(id: string): void {
    this.router.navigate(['/documents'], {
      queryParams: { tagId: id },
    });
  }

  deleteTag(tag: Tag): void {
    this.notificationService.confirmDelete(() => {
      this.apiService.deleteTag(tag.id).subscribe({
        next: () => {
          this.notificationService.success('标签删除成功');
          this.loadTags();
        },
      });
    }, `确定要删除标签"${tag.name}"吗？`);
  }
}
