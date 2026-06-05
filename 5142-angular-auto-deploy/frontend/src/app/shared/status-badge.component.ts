import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';

type BadgeStatus =
  | 'queued' | 'building' | 'success' | 'failed'
  | 'pending_approval' | 'approving' | 'approved' | 'rejected' | 'deploying'
  | 'rolling_back' | 'executing' | 'completed' | 'waiting_prerequisite'
  | 'pending';

const STATUS_CONFIG: { [key: string]: { label: string; color: string } } = {
  queued:              { label: '排队中',     color: '#64748b' },
  building:            { label: '构建中',     color: '#3b82f6' },
  success:             { label: '成功',       color: '#22c55e' },
  failed:              { label: '失败',       color: '#ef4444' },
  pending_approval:    { label: '待审批',     color: '#f59e0b' },
  approving:           { label: '审批中',     color: '#3b82f6' },
  approved:            { label: '已批准',     color: '#22c55e' },
  rejected:            { label: '已驳回',     color: '#ef4444' },
  deploying:           { label: '部署中',     color: '#3b82f6' },
  rolling_back:        { label: '回滚中',     color: '#3b82f6' },
  executing:           { label: '执行中',     color: '#3b82f6' },
  completed:           { label: '已完成',     color: '#22c55e' },
  waiting_prerequisite:{ label: '等待前置',   color: '#f59e0b' },
  pending:             { label: '待处理',     color: '#f59e0b' },
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, MatChipsModule],
  template: `
    <mat-chip [style.background-color]="config().color + '22'"
              [style.color]="config().color"
              [style.border]="'1px solid ' + config().color + '44'"
              class="status-chip">
      {{ config().label }}
    </mat-chip>
  `,
  styles: [`
    .status-chip {
      font-size: 12px;
      font-weight: 500;
      height: 26px;
      min-height: 26px;
      border-radius: 4px;
      padding: 0 10px;
    }
  `],
})
export class StatusBadgeComponent {
  @Input() status: BadgeStatus = 'pending';

  config = () => STATUS_CONFIG[this.status] || STATUS_CONFIG['pending'];
}
