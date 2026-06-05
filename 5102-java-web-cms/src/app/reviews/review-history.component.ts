import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { ReviewRecord, ReviewStatus } from '../core/models/review.model';

@Component({
  selector: 'app-review-history',
  template: `
    <div class="review-history">
      <nz-page-header nzTitle="审核记录" [nzSubtitle]="documentId" class="page-header">
      </nz-page-header>

      <nz-card [nzLoading]="loading">
        <nz-timeline *ngIf="reviews.length > 0">
          <nz-timeline-item *ngFor="let review of reviews" [nzColor]="getStatusColor(review.status)">
            <div class="timeline-item">
              <div class="timeline-header">
                <span class="reviewer-name">{{ review.reviewer?.realName || '未知' }}</span>
                <nz-tag [nzColor]="getLevelColor(review.level)" nzSize="small">
                  {{ review.level === 1 ? '一级审核' : '二级审核' }}
                </nz-tag>
                <nz-tag [nzColor]="getStatusColor(review.status)" nzSize="small">
                  {{ getStatusText(review.status) }}
                </nz-tag>
              </div>
              <div class="timeline-comment" *ngIf="review.comment">
                <span class="comment-label">意见:</span> {{ review.comment }}
              </div>
              <div class="timeline-time">
                {{ review.reviewedAt ? dateService.formatDateTime(review.reviewedAt) : dateService.formatDateTime(review.createdAt) }}
              </div>
            </div>
          </nz-timeline-item>
        </nz-timeline>

        <nz-empty *ngIf="!loading && reviews.length === 0" nzDescription="暂无审核记录"></nz-empty>
      </nz-card>
    </div>
  `,
  styleUrls: [],
})
export class ReviewHistoryComponent implements OnInit {
  documentId = '';
  reviews: ReviewRecord[] = [];
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private notificationService: NotificationService,
    public dateService: DateService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.documentId = params.get('documentId') || '';
      if (this.documentId) {
        this.loadReviewHistory();
      }
    });
  }

  loadReviewHistory(): void {
    this.loading = true;
    this.apiService.getReviewHistory(this.documentId).subscribe({
      next: (reviews) => {
        this.reviews = reviews;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.notificationService.error('加载审核记录失败');
      },
    });
  }

  getStatusColor(status: ReviewStatus): string {
    const colors: Record<ReviewStatus, string> = {
      PENDING: 'blue',
      APPROVED: 'green',
      REJECTED: 'red',
    };
    return colors[status];
  }

  getStatusText(status: ReviewStatus): string {
    const texts: Record<ReviewStatus, string> = {
      PENDING: '待审核',
      APPROVED: '已通过',
      REJECTED: '已驳回',
    };
    return texts[status];
  }

  getLevelColor(level: number): string {
    return level === 1 ? 'blue' : 'orange';
  }
}
