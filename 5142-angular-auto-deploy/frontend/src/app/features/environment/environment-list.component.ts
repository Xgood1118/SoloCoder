import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { ApiService } from '../../core/api.service';
import { Environment, EnvironmentType } from '../../models';

const TYPE_LABELS: Record<EnvironmentType, string> = {
  testing: '测试',
  staging: '预发布',
  production: '生产',
};

const TYPE_COLORS: Record<EnvironmentType, string> = {
  testing: '#22c55e',
  staging: '#f59e0b',
  production: '#ef4444',
};

@Component({
  selector: 'app-environment-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>cloud</mat-icon>
        环境管理
        <span class="spacer"></span>
        <button mat-raised-button color="primary" routerLink="/environments/new">
          <mat-icon>add</mat-icon>
          新增环境
        </button>
      </div>

      <div class="card-grid">
        @for (env of environments; track env.id) {
          <mat-card class="env-card" [class.disabled]="!env.enabled">
            <div class="env-header">
              <div class="env-type-badge" [style.background-color]="getTypeColor(env.type) + '22'" [style.color]="getTypeColor(env.type)" [style.border-color]="getTypeColor(env.type) + '44'">
                {{ getTypeLabel(env.type) }}
              </div>
              <mat-slide-toggle [checked]="env.enabled" (change)="toggleEnvironment(env)" color="primary">
              </mat-slide-toggle>
            </div>
            <h3 class="env-name">{{ env.name }}</h3>
            <div class="env-detail">
              <span class="label">服务器</span>
              <span class="mono">{{ env.serverHost || '-' }}</span>
            </div>
            <div class="env-detail">
              <span class="label">部署路径</span>
              <span class="mono">{{ env.deployPath || '-' }}</span>
            </div>
            <div class="env-detail">
              <span class="label">凭据</span>
              <span class="masked">••••••••</span>
            </div>
            <div class="env-actions">
              <button mat-icon-button [routerLink]="['/environments', env.id]" matTooltip="编辑">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteEnvironment(env)" matTooltip="删除">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .env-card { padding: 20px; transition: opacity 0.3s ease; }
    .env-card.disabled { opacity: 0.5; }
    .env-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .env-type-badge {
      font-size: 12px; font-weight: 500; padding: 3px 10px;
      border-radius: 4px; border: 1px solid;
    }
    .env-name { font-size: 18px; margin-bottom: 12px; color: #e2e8f0; }
    .env-hosts { margin-bottom: 8px;
      .label { font-size: 12px; color: #64748b; display: block; margin-bottom: 4px; }
    }
    .host-chip { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .env-detail { margin-bottom: 6px; font-size: 13px;
      .label { color: #64748b; margin-right: 8px; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .masked { color: #64748b; letter-spacing: 2px; }
    }
    .env-actions { display: flex; gap: 4px; justify-content: flex-end; margin-top: 12px; padding-top: 12px; border-top: 1px solid #363c48; }
    .spacer { flex: 1; }
  `],
})
export class EnvironmentListComponent implements OnInit {
  environments: Environment[] = [];

  private api = inject(ApiService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadEnvironments();
  }

  loadEnvironments(): void {
    this.api.get<Environment[]>('/environments').subscribe({
      next: (envs) => this.environments = envs,
      error: () => this.snackBar.open('加载环境列表失败', '关闭', { duration: 3000 }),
    });
  }

  toggleEnvironment(env: Environment): void {
    this.api.post(`/environments/${env.id}/toggle`, {}).subscribe({
      next: () => {
        env.enabled = !env.enabled;
        this.snackBar.open(env.enabled ? '环境已启用' : '环境已禁用', '关闭', { duration: 3000 });
      },
      error: () => this.snackBar.open('操作失败', '关闭', { duration: 3000 }),
    });
  }

  deleteEnvironment(env: Environment): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: '删除环境',
        message: `确定要删除环境 "${env.name}" 吗？如果存在关联的待处理部署任务，将无法删除。`,
        confirmText: '删除',
      } as ConfirmDialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.api.delete(`/environments/${env.id}`).subscribe({
          next: () => {
            this.snackBar.open('环境已删除', '关闭', { duration: 3000 });
            this.loadEnvironments();
          },
          error: (err) => {
            const msg = err?.error?.message || '删除失败';
            this.snackBar.open(msg, '关闭', { duration: 5000 });
          },
        });
      }
    });
  }

  getTypeLabel(type: EnvironmentType): string {
    return TYPE_LABELS[type] || type;
  }

  getTypeColor(type: EnvironmentType): string {
    return TYPE_COLORS[type] || '#64748b';
  }
}
