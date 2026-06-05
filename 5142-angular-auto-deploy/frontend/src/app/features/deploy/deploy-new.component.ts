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
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApiService } from '../../core/api.service';
import { BuildTask, Environment, DeployRequest } from '../../models';

@Component({
  selector: 'app-deploy-new',
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
    MatCheckboxModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>rocket_launch</mat-icon>
        新建部署申请
      </div>

      <mat-card>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="deploy-form">
          <mat-form-field appearance="outline">
            <mat-label>部署标题</mat-label>
            <input matInput formControlName="title" placeholder="例如：v2.1.0 部署到测试环境">
            <mat-error>请输入部署标题</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>描述（可选）</mat-label>
            <textarea matInput formControlName="description" rows="2" placeholder="部署说明"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>构建产物</mat-label>
            <mat-select formControlName="buildTaskId">
              @for (build of builds; track build.id) {
                <mat-option [value]="build.id">
                  {{ build.name || build.branch }} ({{ build.id.slice(0, 8) }})
                </mat-option>
              }
            </mat-select>
            <mat-error>请选择构建产物</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>目标环境</mat-label>
            <mat-select formControlName="environmentId">
              @for (env of environments; track env.id) {
                <mat-option [value]="env.id">{{ env.name }} ({{ env.type }})</mat-option>
              }
            </mat-select>
            <mat-error>请选择目标环境</mat-error>
          </mat-form-field>

          <div class="deps-section">
            <h4>前置依赖任务（可选）</h4>
            @for (dep of deployOptions; track dep.id) {
              <mat-checkbox [checked]="selectedDeps.has(dep.id)"
                            (change)="toggleDep(dep.id, $event.checked)">
                {{ dep.id.slice(0, 8) }} - {{ dep.environmentId }}
              </mat-checkbox>
            }
            @if (deployOptions.length === 0) {
              <p class="no-deps">暂无可选依赖任务</p>
            }
          </div>

          <div class="form-actions">
            <button mat-button type="button" routerLink="/deploy">
              <mat-icon>arrow_back</mat-icon>
              返回
            </button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || submitting">
              @if (submitting) {
                <mat-icon>hourglass_empty</mat-icon>
              }
              提交部署
            </button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
  styles: [`
    .deploy-form { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
    .deps-section {
      h4 { color: #94a3b8; margin-bottom: 12px; font-size: 14px; }
      display: flex; flex-direction: column; gap: 8px;
    }
    .no-deps { color: #64748b; font-size: 13px; }
    .form-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      padding-top: 16px; border-top: 1px solid #363c48;
    }
  `],
})
export class DeployNewComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  form: FormGroup = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    buildTaskId: ['', Validators.required],
    environmentId: ['', Validators.required],
  });

  builds: BuildTask[] = [];
  environments: Environment[] = [];
  deployOptions: DeployRequest[] = [];
  selectedDeps = new Set<string>();
  submitting = false;

  constructor() {
    this.loadBuilds();
    this.loadEnvironments();
    this.loadDeployOptions();
  }

  loadBuilds(): void {
    this.api.get<BuildTask[]>('/builds').subscribe({
      next: (builds) => this.builds = builds.filter((b) => b.status === 'success'),
    });
  }

  loadEnvironments(): void {
    this.api.get<Environment[]>('/environments').subscribe({
      next: (envs) => this.environments = envs.filter((e) => e.enabled),
    });
  }

  loadDeployOptions(): void {
    this.api.get<DeployRequest[]>('/deployments').subscribe({
      next: (deploys) => this.deployOptions = deploys,
    });
  }

  toggleDep(id: string, checked: boolean): void {
    if (checked) {
      this.selectedDeps.add(id);
    } else {
      this.selectedDeps.delete(id);
    }
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    const request = {
      title: this.form.value.title,
      description: this.form.value.description,
      buildTaskId: this.form.value.buildTaskId,
      environmentId: this.form.value.environmentId,
    };

    this.api.post<DeployRequest>('/deployments', request).subscribe({
      next: (deploy) => {
        this.snackBar.open('部署申请已创建', '关闭', { duration: 3000 });
        this.router.navigate(['/deploy', deploy.id]);
      },
      error: () => {
        this.snackBar.open('创建部署申请失败', '关闭', { duration: 3000 });
        this.submitting = false;
      },
    });
  }
}
