import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { ApiService } from '../../core/api.service';
import { RollbackRequest } from '../../models';

@Component({
  selector: 'app-rollback-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSnackBarModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>restore</mat-icon>
        回滚操作
        <span class="spacer"></span>
        <button mat-raised-button color="primary" routerLink="/rollback/new">
          <mat-icon>add</mat-icon>
          发起回滚
        </button>
      </div>

      <mat-card>
        <table mat-table [dataSource]="rollbacks">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>ID</th>
            <td mat-cell *matCellDef="let row">{{ row.id.slice(0, 8) }}</td>
          </ng-container>
          <ng-container matColumnDef="targetEnvironmentId">
            <th mat-header-cell *matHeaderCellDef>目标环境</th>
            <td mat-cell *matCellDef="let row">{{ row.targetEnvironmentId }}</td>
          </ng-container>
          <ng-container matColumnDef="targetVersion">
            <th mat-header-cell *matHeaderCellDef>目标版本</th>
            <td mat-cell *matCellDef="let row" class="mono">{{ row.targetVersion }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>状态</th>
            <td mat-cell *matCellDef="let row">
              <app-status-badge [status]="row.status"></app-status-badge>
            </td>
          </ng-container>
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>创建时间</th>
            <td mat-cell *matCellDef="let row">{{ row.createdAt | date:'yyyy-MM-dd HH:mm:ss' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>操作</th>
            <td mat-cell *matCellDef="let row">
              <button mat-icon-button [routerLink]="['/deploy', row.originalDeployId]" matTooltip="查看原始部署">
                <mat-icon>link</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
    .spacer { flex: 1; }
  `],
})
export class RollbackListComponent implements OnInit {
  rollbacks: RollbackRequest[] = [];
  displayedColumns = ['id', 'targetEnvironmentId', 'targetVersion', 'status', 'createdAt', 'actions'];

  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadRollbacks();
  }

  loadRollbacks(): void {
    this.api.get<RollbackRequest[]>('/rollbacks').subscribe({
      next: (rollbacks) => this.rollbacks = rollbacks,
      error: () => this.snackBar.open('加载回滚列表失败', '关闭', { duration: 3000 }),
    });
  }
}
