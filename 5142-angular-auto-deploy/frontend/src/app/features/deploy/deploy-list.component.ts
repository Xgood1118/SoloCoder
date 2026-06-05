import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { ApiService } from '../../core/api.service';
import { DeployRequest, DeployStatus } from '../../models';

@Component({
  selector: 'app-deploy-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    MatSnackBarModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>rocket_launch</mat-icon>
        部署审批
        <span class="spacer"></span>
        <button mat-raised-button color="primary" routerLink="/deploy/new">
          <mat-icon>add</mat-icon>
          新建部署
        </button>
      </div>

      <mat-card>
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>搜索</mat-label>
            <input matInput [(ngModel)]="searchTerm" (ngModelChange)="onSearch()">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>状态筛选</mat-label>
            <mat-select [(ngModel)]="statusFilter" (ngModelChange)="onSearch()">
              <mat-option value="">全部</mat-option>
              <mat-option value="pending_approval">待审批</mat-option>
              <mat-option value="approved">已批准</mat-option>
              <mat-option value="rejected">已驳回</mat-option>
              <mat-option value="queued">排队中</mat-option>
              <mat-option value="deploying">部署中</mat-option>
              <mat-option value="success">成功</mat-option>
              <mat-option value="failed">失败</mat-option>
              <mat-option value="waiting_prerequisite">等待前置</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <table mat-table [dataSource]="deploys">
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef>ID</th>
            <td mat-cell *matCellDef="let row">{{ row.id.slice(0, 8) }}</td>
          </ng-container>
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>标题</th>
            <td mat-cell *matCellDef="let row">{{ row.title }}</td>
          </ng-container>
          <ng-container matColumnDef="environmentId">
            <th mat-header-cell *matHeaderCellDef>目标环境</th>
            <td mat-cell *matCellDef="let row">{{ row.environmentId }}</td>
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
              <button mat-icon-button [routerLink]="['/deploy', row.id]" matTooltip="查看详情">
                <mat-icon>visibility</mat-icon>
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
    .filter-bar { padding: 16px 16px 0; display: flex; gap: 16px; flex-wrap: wrap; }
    .filter-field { flex: 1; min-width: 200px; max-width: 300px; }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
    .spacer { flex: 1; }
  `],
})
export class DeployListComponent implements OnInit {
  deploys: DeployRequest[] = [];
  displayedColumns = ['id', 'title', 'environmentId', 'status', 'createdAt', 'actions'];
  searchTerm = '';
  statusFilter: DeployStatus | '' = '';

  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadDeploys();
  }

  loadDeploys(): void {
    this.api.get<DeployRequest[]>('/deployments').subscribe({
      next: (deploys) => {
        let filtered = deploys;
        if (this.statusFilter) {
          filtered = filtered.filter((d) => d.status === this.statusFilter);
        }
        if (this.searchTerm) {
          const term = this.searchTerm.toLowerCase();
          filtered = filtered.filter((d) =>
            d.id.toLowerCase().includes(term) ||
            d.title.toLowerCase().includes(term),
          );
        }
        this.deploys = filtered;
      },
      error: () => this.snackBar.open('加载部署列表失败', '关闭', { duration: 3000 }),
    });
  }

  onSearch(): void {
    this.loadDeploys();
  }
}
