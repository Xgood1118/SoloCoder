import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { Environment, EnvironmentType } from '../../models';

@Component({
  selector: 'app-environment-form',
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
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>{{ isEdit ? 'edit' : 'add_circle' }}</mat-icon>
        {{ isEdit ? '编辑环境' : '新增环境' }}
      </div>

      <mat-card>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="env-form">
          <mat-form-field appearance="outline">
            <mat-label>环境名称</mat-label>
            <input matInput formControlName="name" placeholder="如: production-east">
            <mat-error>请输入环境名称</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>环境类型</mat-label>
            <mat-select formControlName="type">
              <mat-option value="testing">测试</mat-option>
              <mat-option value="staging">预发布</mat-option>
              <mat-option value="production">生产</mat-option>
            </mat-select>
            <mat-error>请选择环境类型</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>描述</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="环境描述"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>服务器地址</mat-label>
            <input matInput formControlName="serverHost" placeholder="如: 192.168.1.100">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>部署路径</mat-label>
            <input matInput formControlName="deployPath" placeholder="如: /var/www/app">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>凭据信息</mat-label>
            <input matInput type="password" formControlName="credentials" placeholder="输入凭据（加密存储）">
          </mat-form-field>

          <div class="form-actions">
            <button mat-button type="button" routerLink="/environments">
              <mat-icon>arrow_back</mat-icon>
              返回
            </button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
              {{ isEdit ? '保存修改' : '创建环境' }}
            </button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
  styles: [`
    .env-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    h4 { color: #94a3b8; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .hosts-section { display: flex; flex-direction: column; gap: 8px; }
    .hosts-list { display: flex; flex-direction: column; gap: 8px; }
    .host-row { display: flex; align-items: center; gap: 8px; }
    .host-field { flex: 1; }
    .credentials-section { padding-top: 8px; border-top: 1px solid #363c48; }
    .cred-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      padding-top: 16px; border-top: 1px solid #363c48;
    }
  `],
})
export class EnvironmentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: ['', Validators.required],
    description: [''],
    serverHost: [''],
    deployPath: [''],
    credentials: [''],
  });

  isEdit = false;
  envId = '';
  submitting = false;

  ngOnInit(): void {
    this.envId = this.route.snapshot.paramMap.get('id') || '';
    this.isEdit = !!this.envId;
    if (this.isEdit) {
      this.loadEnvironment();
    }
  }

  loadEnvironment(): void {
    this.api.get<Environment>(`/environments/${this.envId}`).subscribe({
      next: (env) => {
        this.form.patchValue({
          name: env.name,
          type: env.type,
          description: env.description || '',
          serverHost: env.serverHost || '',
          deployPath: env.deployPath || '',
          credentials: '',
        });
      },
      error: () => this.snackBar.open('加载环境信息失败', '关闭', { duration: 3000 }),
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;

    const request = {
      name: this.form.value.name,
      type: this.form.value.type,
      description: this.form.value.description,
      serverHost: this.form.value.serverHost,
      deployPath: this.form.value.deployPath,
      credentials: this.form.value.credentials || undefined,
      enabled: true,
    };

    const obs = this.isEdit
      ? this.api.put(`/environments/${this.envId}`, request)
      : this.api.post('/environments', request);

    obs.subscribe({
      next: () => {
        this.snackBar.open(this.isEdit ? '环境已更新' : '环境已创建', '关闭', { duration: 3000 });
        this.router.navigate(['/environments']);
      },
      error: () => {
        this.snackBar.open(this.isEdit ? '更新失败' : '创建失败', '关闭', { duration: 3000 });
        this.submitting = false;
      },
    });
  }
}
