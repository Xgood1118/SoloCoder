import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Environment, DeployRequest, RollbackRequest } from '../../models';

@Component({
  selector: 'app-rollback-new',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>restore</mat-icon>
        发起回滚
      </div>

      <div class="rollback-grid">
        <mat-card>
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="rollback-form">
            <mat-form-field appearance="outline">
              <mat-label>目标环境</mat-label>
              <mat-select formControlName="targetEnvironmentId" (ngModelChange)="onEnvironmentChange($event)">
                @for (env of environments; track env.id) {
                  <mat-option [value]="env.id">{{ env.name }} ({{ env.type }})</mat-option>
                }
              </mat-select>
              <mat-error>请选择目标环境</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>选择部署历史版本</mat-label>
              <mat-select formControlName="originalDeployId">
                @for (hist of deployHistory; track hist.id) {
                  <mat-option [value]="hist.id">
                    {{ hist.title || hist.id.slice(0, 8) }} - {{ hist.createdAt | date:'yyyy-MM-dd HH:mm' }}
                  </mat-option>
                }
              </mat-select>
              <mat-error>请选择版本</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>目标版本</mat-label>
              <input matInput formControlName="targetVersion" placeholder="v1.2.3">
              <mat-error>请输入目标版本</mat-error>
            </mat-form-field>

            <div class="form-actions">
              <button mat-button type="button" routerLink="/rollback">
                <mat-icon>arrow_back</mat-icon>
                返回
              </button>
              <button mat-raised-button color="warn" type="submit" [disabled]="form.invalid || submitting">
                @if (submitting) {
                  <mat-icon>hourglass_empty</mat-icon>
                }
                提交回滚
              </button>
            </div>
          </form>
        </mat-card>

        <mat-card class="history-card">
          <h3>部署历史</h3>
          @if (deployHistory.length > 0) {
            <mat-list>
              @for (hist of deployHistory; track hist.id) {
                <mat-list-item>
                  <mat-icon matListItemIcon>commit</mat-icon>
                  <span matListItemTitle class="mono">{{ hist.title || hist.id.slice(0, 8) }}</span>
                  <span matListItemLine>{{ hist.createdAt | date:'yyyy-MM-dd HH:mm:ss' }}</span>
                </mat-list-item>
              }
            </mat-list>
          } @else if (form.get('targetEnvironmentId')?.value) {
            <p class="empty-hint">该环境暂无部署历史</p>
          } @else {
            <p class="empty-hint">请先选择目标环境</p>
          }
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .rollback-grid { display: grid; grid-template-columns: 1fr 380px; gap: 16px; }
    .rollback-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .history-card { padding: 20px; max-height: 500px; overflow-y: auto; }
    h3 { font-size: 16px; margin-bottom: 12px; color: #e2e8f0; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .empty-hint { color: #64748b; text-align: center; padding: 20px; font-size: 14px; }
    .form-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      padding-top: 16px; border-top: 1px solid #363c48;
    }
    @media (max-width: 1024px) {
      .rollback-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class RollbackNewComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  form: FormGroup = this.fb.group({
    targetEnvironmentId: ['', Validators.required],
    originalDeployId: ['', Validators.required],
    targetVersion: ['', Validators.required],
  });

  environments: Environment[] = [];
  deployHistory: DeployRequest[] = [];
  submitting = false;

  constructor() {
    this.loadEnvironments();
  }

  loadEnvironments(): void {
    this.api.get<Environment[]>('/environments').subscribe({
      next: (envs) => this.environments = envs.filter((e) => e.enabled),
    });
  }

  onEnvironmentChange(envId: string): void {
    this.deployHistory = [];
    this.form.get('originalDeployId')?.setValue('');
    if (envId) {
      this.loadDeployHistory(envId);
    }
  }

  loadDeployHistory(envId: string): void {
    this.api.get<DeployRequest[]>(`/environments/${envId}/deploy-history`).subscribe({
      next: (history) => this.deployHistory = history,
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;

    const request = {
      targetEnvironmentId: this.form.value.targetEnvironmentId,
      originalDeployId: this.form.value.originalDeployId,
      targetVersion: this.form.value.targetVersion,
      reason: '用户发起回滚',
    };

    this.api.post<RollbackRequest>('/rollbacks', request).subscribe({
      next: () => {
        this.snackBar.open('回滚申请已创建', '关闭', { duration: 3000 });
        this.router.navigate(['/rollback']);
      },
      error: () => {
        this.snackBar.open('创建回滚申请失败', '关闭', { duration: 3000 });
        this.submitting = false;
      },
    });
  }
}
