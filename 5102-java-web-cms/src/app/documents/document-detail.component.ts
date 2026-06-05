import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { DateService } from '../core/services/date.service';
import { Document } from '../core/models/document.model';
import { Comment } from '../core/models/comment.model';

@Component({
  selector: 'app-document-detail',
  template: `
    <div class="document-detail" *ngIf="document; else loading">
      <nz-page-header class="page-header" nzBackIcon (nzBack)="goBack()">
        <nz-page-header-title>{{ document.title }}</nz-page-header-title>
        <nz-page-header-subtitle>
          <nz-breadcrumb>
            <nz-breadcrumb-item>
              <a [routerLink]="['/documents']">文档</a>
            </nz-breadcrumb-item>
            <nz-breadcrumb-item *ngIf="document.categoryName">
              {{ document.categoryName }}
            </nz-breadcrumb-item>
          </nz-breadcrumb>
        </nz-page-header-subtitle>
        <nz-page-header-extra>
          <button
            nz-button
            (click)="editDocument()"
            *ngIf="authService.canEditDocument(document.authorId)"
          >
            <i nz-icon nzType="edit"></i>
            编辑
          </button>
        </nz-page-header-extra>
      </nz-page-header>

      <nz-card class="content-card">
        <div class="document-meta">
          <div class="meta-left">
            <nz-avatar
              [nzText]="document.authorName?.[0] || 'U'"
              class="author-avatar"
            ></nz-avatar>
            <div class="author-info">
              <div class="author-name">{{ document.authorName || '未知作者' }}</div>
              <div class="meta-info">
                <span>创建于 {{ dateService.formatDateTime(document.createdAt) }}</span>
                <span class="divider">|</span>
                <span>更新于 {{ dateService.formatDateTime(document.updatedAt) }}</span>
              </div>
            </div>
          </div>
          <div class="meta-right">
            <nz-tag [nzColor]="getStatusColor(document.status)" class="status-tag">
              {{ getStatusText(document.status) }}
            </nz-tag>
            <nz-tag [nzColor]="getAccessColor(document.accessLevel)">
              {{ getAccessText(document.accessLevel) }}
            </nz-tag>
          </div>
        </div>

        <div class="document-tags" *ngIf="document.tags?.length">
          <nz-tag
            *ngFor="let tag of document.tags"
            nzColor="blue"
            class="document-tag"
          >
            {{ tag.name }}
          </nz-tag>
        </div>

        <nz-divider></nz-divider>

        <div class="document-content" [innerHTML]="document.content"></div>

        <nz-divider></nz-divider>

        <div class="document-stats">
          <span><i nz-icon nzType="eye"></i> {{ document.viewCount }} 次浏览</span>
        </div>
      </nz-card>

      <nz-card class="comments-card" nzTitle="评论">
        <app-comment-list
          [documentId]="document.id"
          (commentsChange)="onCommentsChange($event)"
        ></app-comment-list>
      </nz-card>
    </div>

    <ng-template #loading>
      <div class="loading-container">
        <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 10 }"></nz-skeleton>
      </div>
    </ng-template>
  `,
  styleUrls: ['./document-detail.component.scss'],
})
export class DocumentDetailComponent implements OnInit {
  document: Document | null = null;
  comments: Comment[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    public authService: AuthService,
    public dateService: DateService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.loadDocument(id);
      }
    });
  }

  loadDocument(id: string): void {
    this.apiService.getDocument(id).subscribe({
      next: (doc) => {
        this.document = doc;
      },
    });
  }

  onCommentsChange(comments: Comment[]): void {
    this.comments = comments;
  }

  goBack(): void {
    this.router.navigate(['/documents']);
  }

  editDocument(): void {
    if (this.document) {
      this.router.navigate(['/documents', this.document.id, 'edit']);
    }
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      DRAFT: 'gold',
      PENDING_REVIEW: 'blue',
      APPROVED: 'green',
      REJECTED: 'red',
      PUBLISHED: 'green',
    };
    return colors[status] || 'default';
  }

  getStatusText(status: string): string {
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
