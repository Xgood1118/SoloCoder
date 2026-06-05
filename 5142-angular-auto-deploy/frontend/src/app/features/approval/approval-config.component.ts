import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/api.service';
import { User } from '../../models';

@Component({
  selector: 'app-approval-config',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
        <mat-icon>settings</mat-icon>
        审批配置
      </div>

      <mat-card>
        <form [formGroup]="form" (ngSubmit)="onSave()" class="config-form">
          <h3>审批链配置</h3>
          <p class="hint">配置多级审批人，按顺序逐级审批。拖动可调整顺序。</p>

          <div formArrayName="chain" class="chain-list">
            @for (level of chainControls; track i; let i = $index) {
              <div [formGroupName]="i" class="chain-item">
                <div class="level-badge">第 {{ i + 1 }} 级</div>
                <mat-form-field appearance="outline" class="approver-field">
                  <mat-label>审批人</mat-label>
                  <mat-select formControlName="approverId">
                    @for (user of approvers; track user.id) {
                      <mat-option [value]="user.id">{{ user.username }} ({{ user.role }})</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-icon-button color="warn" (click)="removeLevel(i)" [disabled]="chainControls.length <= 1">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }
          </div>

          <button mat-stroked-button type="button" (click)="addLevel()">
            <mat-icon>add</mat-icon>
            添加审批级别
          </button>

          <div class="form-actions">
            <button mat-raised-button color="primary" type="submit">保存配置</button>
          </div>
        </form>
      </mat-card>
    </div>
  `,
  styles: [`
    .config-form { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    h3 { font-size: 16px; color: #e2e8f0; margin-bottom: 4px; }
    .hint { color: #64748b; font-size: 13px; margin-bottom: 8px; }
    .chain-list { display: flex; flex-direction: column; gap: 12px; }
    .chain-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px; background: #22262e; border-radius: 8px; border: 1px solid #363c48;
    }
    .level-badge {
      background: #3b82f6; color: white; padding: 4px 12px;
      border-radius: 4px; font-size: 13px; font-weight: 500;
      font-family: 'JetBrains Mono', monospace; white-space: nowrap;
    }
    .approver-field { flex: 1; }
    .form-actions {
      padding-top: 16px; border-top: 1px solid #363c48;
      display: flex; justify-content: flex-end;
    }
  `],
})
export class ApprovalConfigComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  form: FormGroup = this.fb.group({
    chain: this.fb.array([]),
  });

  approvers: User[] = [];

  get chainControls() {
    return (this.form.get('chain') as FormArray).controls as FormGroup[];
  }

  ngOnInit(): void {
    this.loadApprovers();
    this.loadConfig();
  }

  loadApprovers(): void {
    this.api.get<User[]>('/auth/users').subscribe({
      next: (users) => this.approvers = users.filter((u) => u.role === 'approver' || u.role === 'admin'),
    });
  }

  loadConfig(): void {
    this.api.get<{ levels: { approverId: string }[] }>('/approval-config').subscribe({
      next: (config) => {
        const chainArray = this.form.get('chain') as FormArray;
        chainArray.clear();
        if (config?.levels?.length) {
          config.levels.forEach((level) => {
            chainArray.push(this.fb.group({ approverId: [level.approverId] }));
          });
        } else {
          this.addLevel();
        }
      },
      error: () => this.addLevel(),
    });
  }

  addLevel(): void {
    const chainArray = this.form.get('chain') as FormArray;
    chainArray.push(this.fb.group({ approverId: [''] }));
  }

  removeLevel(index: number): void {
    const chainArray = this.form.get('chain') as FormArray;
    chainArray.removeAt(index);
  }

  onSave(): void {
    if (this.form.invalid) return;
    const levels = this.form.value.chain;
    this.api.post('/approval-config', { levels }).subscribe({
      next: () => this.snackBar.open('审批配置已保存', '关闭', { duration: 3000 }),
      error: () => this.snackBar.open('保存配置失败', '关闭', { duration: 3000 }),
    });
  }
}
