import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ApprovalNode } from '../models';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="timeline">
      @for (node of nodes; track node.id; let last = $last) {
        <div class="timeline-item" [class.last]="last">
          <div class="timeline-marker" [class]="node.status">
            @switch (node.status) {
              @case ('approved') { <mat-icon>check_circle</mat-icon> }
              @case ('rejected') { <mat-icon>cancel</mat-icon> }
              @default { <mat-icon>radio_button_unchecked</mat-icon> }
            }
          </div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="approver">审批人: {{ node.approverId }}</span>
              <span class="level">第 {{ node.order }} 级</span>
            </div>
            <div class="timeline-status" [class]="node.status">
              @switch (node.status) {
                @case ('approved') { 已批准 }
                @case ('rejected') { 已驳回 }
                @default { 待审批 }
              }
            </div>
            @if (node.comment) {
              <div class="timeline-comment">{{ node.comment }}</div>
            }
            @if (node.processedAt) {
              <div class="timeline-time">{{ node.processedAt | date:'yyyy-MM-dd HH:mm' }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline { padding-left: 8px; }
    .timeline-item {
      display: flex;
      gap: 16px;
      padding-bottom: 24px;
      position: relative;
    }
    .timeline-item:not(.last)::after {
      content: '';
      position: absolute;
      left: 15px;
      top: 36px;
      bottom: 0;
      width: 2px;
      background: #363c48;
    }
    .timeline-marker {
      flex-shrink: 0;
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
      &.approved mat-icon { color: #22c55e; }
      &.rejected mat-icon { color: #ef4444; }
      &.pending mat-icon { color: #64748b; }
    }
    .timeline-content {
      flex: 1;
      min-width: 0;
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .approver { color: #e2e8f0; font-weight: 500; }
      .level { color: #64748b; font-size: 12px; }
    }
    .timeline-status {
      font-size: 13px;
      margin-top: 4px;
      &.approved { color: #22c55e; }
      &.rejected { color: #ef4444; }
      &.pending { color: #f59e0b; }
    }
    .timeline-comment {
      margin-top: 6px;
      padding: 8px 12px;
      background: #22262e;
      border-radius: 6px;
      color: #94a3b8;
      font-size: 13px;
    }
    .timeline-time {
      color: #64748b;
      font-size: 12px;
      margin-top: 4px;
    }
  `],
})
export class TimelineComponent {
  @Input() nodes: ApprovalNode[] = [];
}
