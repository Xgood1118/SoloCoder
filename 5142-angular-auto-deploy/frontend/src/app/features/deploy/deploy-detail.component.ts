import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TimelineComponent } from '../../shared/timeline.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DeployRequest } from '../../models';

@Component({
  selector: 'app-deploy-detail',
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
    TimelineComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>description</mat-icon>
        部署详情
        <span class="spacer"></span>
        <app-status-badge [status]="deploy()?.status || 'pending_approval'"></app-status-badge>
      </div>

      @if (deploy()) {
        <div class="detail-grid">
          <mat-card class="info-card">
            <h3>基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">ID</span>
                <span class="value mono">{{ deploy()!.id }}</span>
              </div>
              <div class="info-item">
                <span class="label">标题</span>
                <span class="value">{{ (deploy()!.title || deploy()!.id) }}</span>
              </div>
              <div class="info-item">
                <span class="label">目标环境</span>
                <span class="value">{{ deploy()!.environmentId }}</span>
              </div>
              <div class="info-item">
                <span class="label">状态</span>
                <span class="value"><app-status-badge [status]="deploy()!.status"></app-status-badge></span>
              </div>
            </div>

            @if (canApprove()) {
              <div class="actions-section">
                <button mat-raised-button color="primary" (click)="approve()">
                  <mat-icon>check</mat-icon>
                  批准
                </button>
                <button mat-raised-button color="warn" (click)="reject()">
                  <mat-icon>close</mat-icon>
                  驳回
                </button>
              </div>
            }

            @if (deploy()!.status === 'rejected') {
              <div class="actions-section">
                <button mat-stroked-button (click)="resubmit()">
                  <mat-icon>refresh</mat-icon>
                  重新提交
                </button>
              </div>
            }
          </mat-card>

          <mat-card class="timeline-card">
            <h3>审批历史</h3>
            <app-timeline [nodes]="deploy()!.approvalNodes || []"></app-timeline>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-card, .timeline-card { padding: 20px; }
    h3 { font-size: 16px; margin-bottom: 16px; color: #e2e8f0; }
    h4 { font-size: 14px; color: #94a3b8; margin: 16px 0 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item { display: flex; flex-direction: column; gap: 2px;
      .label { font-size: 12px; color: #64748b; }
      .value { color: #e2e8f0; font-size: 13px; }
      .value.mono { font-family: 'JetBrains Mono', monospace; }
    }
    .deps-section, .actions-section { margin-top: 16px; padding-top: 16px; border-top: 1px solid #363c48; }
    .dep-item { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #60a5fa; padding: 4px 0; }
    .actions-section { display: flex; gap: 12px; }
    .spacer { flex: 1; }

    @media (max-width: 1024px) {
      .detail-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DeployDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  deploy = signal<DeployRequest | null>(null);
  private deployId = '';

  ngOnInit(): void {
    this.deployId = this.route.snapshot.paramMap.get('id') || '';
    if (this.deployId) {
      this.loadDeploy();
    }
  }

  loadDeploy(): void {
    this.api.get<DeployRequest>(`/deployments/${this.deployId}`).subscribe({
      next: (deploy) => this.deploy.set(deploy),
      error: () => this.snackBar.open('加载部署详情失败', '关闭', { duration: 3000 }),
    });
  }

  canApprove(): boolean {
    const d = this.deploy();
    if (!d) return false;
    return (d.status === 'pending_approval' || d.status === 'approving') && this.auth.isApprover();
  }

  approve(): void {
    this.api.post(`/deployments/${this.deployId}/approve`, { status: 'approved' }).subscribe({
      next: () => {
        this.snackBar.open('已批准', '关闭', { duration: 3000 });
        this.loadDeploy();
      },
      error: () => this.snackBar.open('批准失败', '关闭', { duration: 3000 }),
    });
  }

  reject(): void {
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
        this.api.post(`/deployments/${this.deployId}/approve`, { status: 'rejected', comment: reason }).subscribe({
          next: () => {
            this.snackBar.open('已驳回', '关闭', { duration: 3000 });
            this.loadDeploy();
          },
          error: () => this.snackBar.open('驳回失败', '关闭', { duration: 3000 }),
        });
      }
    });
  }

  resubmit(): void {
    this.api.post(`/deployments/${this.deployId}/submit`, {}).subscribe({
      next: () => {
        this.snackBar.open('已重新提交', '关闭', { duration: 3000 });
        this.loadDeploy();
      },
      error: () => this.snackBar.open('重新提交失败', '关闭', { duration: 3000 }),
    });
  }
}
