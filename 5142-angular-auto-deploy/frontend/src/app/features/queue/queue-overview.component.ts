import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { ApiService } from '../../core/api.service';
import { WebSocketService } from '../../core/websocket.service';
import { QueueItem, Environment } from '../../models';

interface QueueColumn {
  environment: Environment;
  items: QueueItem[];
}

@Component({
  selector: 'app-queue-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-title">
        <mat-icon>view_kanban</mat-icon>
        任务队列总览
        <span class="spacer"></span>
        <button mat-stroked-button routerLink="/queue/graph">
          <mat-icon>account_tree</mat-icon>
          依赖图
        </button>
      </div>

      <div class="kanban">
        @for (column of columns; track column.environment.id) {
          <div class="kanban-column">
            <div class="column-header">
              <span class="column-title">{{ column.environment.name }}</span>
              <span class="column-count">{{ column.items.length }} 个任务</span>
            </div>
            <div class="column-body">
              @for (item of column.items; track item.id) {
                <mat-card class="task-card" [class]="item.status">
                  <div class="task-header">
                    <span class="task-id mono">#{{ item.deployRequestId.slice(0, 8) }}</span>
                    <app-status-badge [status]="item.status"></app-status-badge>
                  </div>
                  <div class="task-position">
                    位置: {{ item.position }}
                  </div>
                  @if (getDepCount(item) > 0) {
                    <div class="task-deps">
                      <mat-icon class="dep-icon">link</mat-icon>
                      {{ getDepCount(item) }} 个依赖
                    </div>
                  }
                  <div class="task-actions">
                    <button mat-icon-button
                            [routerLink]="['/deploy', item.deployRequestId]"
                            matTooltip="查看详情">
                      <mat-icon>visibility</mat-icon>
                    </button>
                  </div>
                </mat-card>
              }
              @if (column.items.length === 0) {
                <div class="empty-column">
                  <mat-icon>inbox</mat-icon>
                  <p>队列为空</p>
                </div>
              }
            </div>
          </div>
        }
        @if (columns.length === 0) {
          <div class="empty-state">
            <mat-icon>view_kanban</mat-icon>
            <p>暂无队列数据</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .kanban {
      display: flex; gap: 16px; overflow-x: auto;
      padding-bottom: 16px; min-height: 400px;
    }
    .kanban-column {
      min-width: 280px; max-width: 320px; flex: 1;
      background: #22262e; border-radius: 12px; border: 1px solid #363c48;
      display: flex; flex-direction: column;
    }
    .column-header {
      padding: 16px; border-bottom: 1px solid #363c48;
      display: flex; justify-content: space-between; align-items: center;
    }
    .column-title { font-weight: 600; color: #e2e8f0; font-size: 15px; }
    .column-count { color: #64748b; font-size: 12px; }
    .column-body { padding: 12px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
    .task-card { padding: 12px; transition: all 0.3s ease; }
    .task-card.executing { border-left: 3px solid #3b82f6; }
    .task-card.waiting_prerequisite { border-left: 3px solid #f59e0b; }
    .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .task-id { font-size: 13px; color: #60a5fa; }
    .task-position { font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
    .task-deps { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b; }
    .dep-icon { font-size: 14px; width: 14px; height: 14px; }
    .task-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
    .empty-column, .empty-state { text-align: center; color: #64748b; padding: 40px 20px;
      mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 8px; }
    }
    .spacer { flex: 1; }
  `],
})
export class QueueOverviewComponent implements OnInit, OnDestroy {
  columns: QueueColumn[] = [];

  private api = inject(ApiService);
  private ws = inject(WebSocketService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.loadQueue();
    this.ws.connect('ws://localhost:3000');
    this.ws.messages$.subscribe((msg) => {
      if (msg.type === 'queue_update') {
        this.loadQueue();
      }
    });
  }

  ngOnDestroy(): void {
    this.ws.disconnect();
  }

  loadQueue(): void {
    this.api.get<QueueItem[]>('/queue').subscribe({
      next: (items) => this.organizeColumns(items),
      error: () => this.snackBar.open('加载队列失败', '关闭', { duration: 3000 }),
    });
  }

  getDepCount(item: QueueItem): number {
    try {
      const deps = JSON.parse(item.dependencyIds || '[]');
      return Array.isArray(deps) ? deps.length : 0;
    } catch {
      return 0;
    }
  }

  private organizeColumns(items: QueueItem[]): void {
    this.api.get<Environment[]>('/environments').subscribe({
      next: (envs) => {
        const envMap = new Map(envs.map((e) => [e.id, e]));
        const grouped = new Map<string, QueueItem[]>();

        items.forEach((item) => {
          const list = grouped.get(item.environmentId) || [];
          list.push(item);
          grouped.set(item.environmentId, list);
        });

        this.columns = Array.from(grouped.entries()).map(([envId, envItems]) => ({
          environment: envMap.get(envId) || { id: envId, name: envId, type: 'testing' as const, serverHost: '', deployPath: '', credentials: '', enabled: true, createdAt: '', updatedAt: '' },
          items: envItems.sort((a, b) => a.position - b.position),
        }));
      },
    });
  }
}
