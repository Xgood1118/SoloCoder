import { Component, OnInit } from '@angular/core';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { ReviewRecord, ReviewActionRequest } from '../core/models/review.model';
import { PaginatedResponse } from '../core/models/document.model';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-review-list',
  template: `
    <div class="review-list">
      <nz-page-header nzTitle="审核管理" class="page-header">
        <nz-page-header-extra>
          <nz-tag nzColor="blue">待审核: {{ totalLevel1 }}</nz-tag>
          <nz-tag nzColor="orange">二级待审核: {{ totalLevel2 }}</nz-tag>
        </nz-page-header-extra>
      </nz-page-header>

      <nz-card>
        <nz-tabset [(nzSelectedIndex)]="activeTab" (nzSelectedIndexChange)="onTabChange($event)">
          <nz-tab nzTitle="待审核">
            <nz-table
              #level1Table
              [nzData]="level1Reviews"
              [nzLoading]="loading1"
              [nzTotal]="totalLevel1"
              [nzPageSize]="pageSize"
              [nzPageIndex]="page1"
              [nzShowSizeChanger]="true"
              (nzQueryParams)="onLevel1QueryParamsChange($event)"
            >
              <thead>
                <tr>
                  <th>文档标题</th>
                  <th nzWidth="120px">提交人</th>
                  <th nzWidth="100px">审核级别</th>
                  <th nzWidth="180px">提交时间</th>
                  <th nzWidth="180px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let review of level1Table.data">
                  <td>
                    <a (click)="viewHistory(review.documentId)">{{ review.documentTitle }}</a>
                  </td>
                  <td>{{ review.submitter?.realName || '-' }}</td>
                  <td>
                    <nz-tag nzColor="blue">一级审核</nz-tag>
                  </td>
                  <td>{{ dateService.formatDateTime(review.createdAt) }}</td>
                  <td>
                    <button
                      nz-button
                      nzType="primary"
                      nzSize="small"
                      nz-popconfirm
                      nzPopconfirmTitle="确定通过该审核吗？"
                      (nzOnConfirm)="approve(review)"
                    >
                      通过
                    </button>
                    <button
                      nz-button
                      nzDanger
                      nzSize="small"
                      (click)="showRejectModal(review)"
                    >
                      驳回
                    </button>
                  </td>
                </tr>
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab nzTitle="二级待审核">
            <nz-table
              #level2Table
              [nzData]="level2Reviews"
              [nzLoading]="loading2"
              [nzTotal]="totalLevel2"
              [nzPageSize]="pageSize"
              [nzPageIndex]="page2"
              [nzShowSizeChanger]="true"
              (nzQueryParams)="onLevel2QueryParamsChange($event)"
            >
              <thead>
                <tr>
                  <th>文档标题</th>
                  <th nzWidth="120px">提交人</th>
                  <th nzWidth="100px">审核级别</th>
                  <th nzWidth="180px">提交时间</th>
                  <th nzWidth="180px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let review of level2Table.data">
                  <td>
                    <a (click)="viewHistory(review.documentId)">{{ review.documentTitle }}</a>
                  </td>
                  <td>{{ review.submitter?.realName || '-' }}</td>
                  <td>
                    <nz-tag nzColor="orange">二级审核</nz-tag>
                  </td>
                  <td>{{ dateService.formatDateTime(review.createdAt) }}</td>
                  <td>
                    <button
                      nz-button
                      nzType="primary"
                      nzSize="small"
                      nz-popconfirm
                      nzPopconfirmTitle="确定通过该审核吗？"
                      (nzOnConfirm)="approve(review)"
                    >
                      通过
                    </button>
                    <button
                      nz-button
                      nzDanger
                      nzSize="small"
                      (click)="showRejectModal(review)"
                    >
                      驳回
                    </button>
                  </td>
                </tr>
              </tbody>
            </nz-table>
          </nz-tab>
        </nz-tabset>
      </nz-card>

      <nz-modal
        [(nzVisible)]="rejectModalVisible"
        nzTitle="驳回审核"
        (nzOnCancel)="cancelReject()"
        (nzOnOk)="confirmReject()"
        [nzOkLoading]="rejecting"
      >
        <nz-form-item>
          <nz-form-label nzRequired>驳回原因</nz-form-label>
          <nz-form-control nzErrorTip="请输入驳回原因">
            <textarea
              nz-input
              [(ngModel)]="rejectReason"
              nzPlaceHolder="请输入驳回原因"
              [nzAutosize]="{ minRows: 3, maxRows: 6 }"
            ></textarea>
          </nz-form-control>
        </nz-form-item>
      </nz-modal>
    </div>
  `,
  styleUrls: ['./review-list.component.scss'],
})
export class ReviewListComponent implements OnInit {
  activeTab = 0;
  level1Reviews: ReviewRecord[] = [];
  level2Reviews: ReviewRecord[] = [];
  loading1 = false;
  loading2 = false;
  totalLevel1 = 0;
  totalLevel2 = 0;
  page1 = 1;
  page2 = 1;
  pageSize = environment.defaultPageSize;

  rejectModalVisible = false;
  rejecting = false;
  rejectReason = '';
  selectedReview: ReviewRecord | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private notificationService: NotificationService,
    public dateService: DateService
  ) {}

  ngOnInit(): void {
    this.loadLevel1Reviews();
    this.loadLevel2Reviews();
  }

  loadLevel1Reviews(): void {
    this.loading1 = true;
    const userId = this.authService.currentUser?.id || '';
    this.apiService
      .getPendingReviews(userId, 1, this.page1, this.pageSize)
      .subscribe({
        next: (response: PaginatedResponse<ReviewRecord>) => {
          this.level1Reviews = response.items;
          this.totalLevel1 = response.total;
          this.loading1 = false;
        },
        error: () => {
          this.loading1 = false;
        },
      });
  }

  loadLevel2Reviews(): void {
    this.loading2 = true;
    const userId = this.authService.currentUser?.id || '';
    this.apiService
      .getPendingReviews(userId, 2, this.page2, this.pageSize)
      .subscribe({
        next: (response: PaginatedResponse<ReviewRecord>) => {
          this.level2Reviews = response.items;
          this.totalLevel2 = response.total;
          this.loading2 = false;
        },
        error: () => {
          this.loading2 = false;
        },
      });
  }

  onTabChange(index: number): void {
    if (index === 0) {
      this.loadLevel1Reviews();
    } else {
      this.loadLevel2Reviews();
    }
  }

  onLevel1QueryParamsChange(params: NzTableQueryParams): void {
    this.page1 = params.pageIndex;
    this.pageSize = params.pageSize;
    this.loadLevel1Reviews();
  }

  onLevel2QueryParamsChange(params: NzTableQueryParams): void {
    this.page2 = params.pageIndex;
    this.pageSize = params.pageSize;
    this.loadLevel2Reviews();
  }

  approve(review: ReviewRecord): void {
    const userId = this.authService.currentUser?.id || '';
    const request: ReviewActionRequest = {
      reviewRecordId: review.id,
      comment: '审核通过',
    };
    this.apiService.approveReview(request, userId).subscribe({
      next: () => {
        this.notificationService.success('审核通过');
        this.refreshCurrentTab();
      },
      error: () => {
        this.notificationService.error('审核操作失败');
      },
    });
  }

  showRejectModal(review: ReviewRecord): void {
    this.selectedReview = review;
    this.rejectReason = '';
    this.rejectModalVisible = true;
  }

  cancelReject(): void {
    this.rejectModalVisible = false;
    this.selectedReview = null;
    this.rejectReason = '';
  }

  confirmReject(): void {
    if (!this.rejectReason.trim()) {
      this.notificationService.warning('请输入驳回原因');
      return;
    }
    if (!this.selectedReview) return;

    this.rejecting = true;
    const userId = this.authService.currentUser?.id || '';
    const request: ReviewActionRequest = {
      reviewRecordId: this.selectedReview.id,
      comment: this.rejectReason,
    };
    this.apiService.rejectReview(request, userId).subscribe({
      next: () => {
        this.notificationService.success('已驳回审核');
        this.rejecting = false;
        this.rejectModalVisible = false;
        this.selectedReview = null;
        this.rejectReason = '';
        this.refreshCurrentTab();
      },
      error: () => {
        this.rejecting = false;
        this.notificationService.error('审核操作失败');
      },
    });
  }

  viewHistory(documentId: string): void {
    window.open(`/reviews/history/${documentId}`, '_blank');
  }

  private refreshCurrentTab(): void {
    if (this.activeTab === 0) {
      this.loadLevel1Reviews();
    } else {
      this.loadLevel2Reviews();
    }
  }
}
