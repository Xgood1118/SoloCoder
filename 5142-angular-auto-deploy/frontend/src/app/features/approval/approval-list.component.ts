import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DeployRequest } from '../../models';

@Component({
  selector: 'app-approval-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>fact_check</mat-icon>
        审批管理
        <span class="spacer"></span>
        <button mat-stroked-button routerLink="/approval/config" *ngIf="auth.isAdmin()">
          <mat-icon>settings</mat-icon>
          审批配置
        </button>
      </div>

      <div class="approval-list">
        @for (item of pendingApprovals; track item.id) {
          <mat-card class="approval-card">
            <div class="card-header">
              <div class="card-info">
                <span class="card-id mono">#{{ item.id.slice(0, 8) }}</span>
                <app-status-badge [status]="item.status"></app-status-badge>
              </div>
              <span class="card-time">{{ item.createdAt | date:'yyyy-MM-dd HH:mm' }}</span>
            </div>
            <div class="card-body">
              <div class="card-detail">
                <span class="label">标题:</span>
                <span>{{ item.title }}</span>
              </div>
              <div class="card-detail">
                <span class="label">目标环境:</span>
                <span>{{ item.environmentId }}</span>
              </div>
            </div>
            <div class="card-actions">
              <button mat-raised-button color="primary" (click)="approve(item.id)">
                <mat-icon>check</mat-icon>
                批准
              </button>
              <button mat-raised-button color="warn" (click)="reject(item.id)">
                <mat-icon>close</mat-icon>
                驳回
              </button>
              <button mat-icon-button [routerLink]="['/deploy', item.id]" matTooltip="查看详情">
                <mat-icon>visibility</mat-icon>
              </button>
            </div>
          </mat-card>
        }
        @if (pendingApprovals.length === 0) {
          <div class="empty-state">
            <mat-icon>check_circle</mat-icon>
            <p>暂无待审批项</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .approval-list { display: flex; flex-direction: column; gap: 12px; }
    .approval-card { padding: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .card-info { display: flex; align-items: center; gap: 12px; }
    .card-id { font-size: 14px; color: #60a5fa; }
    .card-time { color: #64748b; font-size: 13px; }
    .card-body { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .card-detail { font-size: 13px;
      .label { color: #64748b; margin-right: 8px; }
    }
    .card-actions { display: flex; gap: 8px; align-items: center; padding-top: 12px; border-top: 1px solid #363c48; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .spacer { flex: 1; }
    .empty-state { text-align: center; padding: 60px 20px; color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
      p { font-size: 15px; }
    }
  `],
})
export class ApprovalListComponent implements OnInit {
  pendingApprovals: DeployRequest[] = [];

  private api = inject(ApiService);
  auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending(): void {
    this.api.get<DeployRequest[]>('/deployments').subscribe({
      next: (items) => this.pendingApprovals = items.filter((i) => i.status === 'pending_approval' || i.status === 'approving'),
      error: () => this.snackBar.open('加载审批列表失败', '关闭', { duration: 3000 }),
    });
  }

  approve(id: string): void {
    this.api.post(`/deployments/${id}/approve`, { status: 'approved' }).subscribe({
      next: () => {
        this.snackBar.open('已批准', '关闭', { duration: 3000 });
        this.loadPending();
      },
      error: () => this.snackBar.open('批准失败', '关闭', { duration: 3000 }),
    });
  }

  reject(id: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '驳回部署申请',
        message: '请输入驳回理由',
        confirmText: '驳回',
        requireInput: true,
        inputLabel: '驳回理由',
        inputPlaceholder: '请说明驳回原因...',
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((reason: string | boolean) => {
      if (reason && typeof reason === 'string') {
        this.api.post(`/deployments/${id}/approve`, { status: 'rejected', comment: reason }).subscribe({
          next: () => {
            this.snackBar.open('已驳回', '关闭', { duration: 3000 });
            this.loadPending();
          },
          error: () => this.snackBar.open('驳回失败', '关闭', { duration: 3000 }),
        });
      }
    });
  }
}
