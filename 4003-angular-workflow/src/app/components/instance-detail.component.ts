import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { TemplateService } from '../services/template.service';
import { FlowInstance, FlowTemplate, FlowNode } from '../models/workflow.model';

@Component({
  selector: 'app-instance-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container" *ngIf="instance && template">
      <div class="flex-between mb-16">
        <button class="btn btn-default" (click)="goBack()">← 返回</button>
        <div>
          <button *ngIf="instance.status === 'rejected' && !instance.isDraft" 
                  class="btn btn-primary mr-8" 
                  [routerLink]="['/resubmit', instance.id]">修改重提</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">流程信息</div>
        <div class="flex" style="gap: 40px;">
          <div style="flex: 1;">
            <div class="info-row">
              <span class="info-label">流程名称:</span>
              <span class="tag tag-blue">{{ instance.templateName }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">状态:</span>
              <span class="tag" 
                    [class.tag-green]="instance.status === 'completed'"
                    [class.tag-red]="instance.status === 'rejected'"
                    [class.tag-orange]="instance.status === 'pending'"
                    [class.tag-gray]="instance.status === 'draft'">
                {{ getStatusLabel(instance.status) }}
              </span>
              <span *ngIf="instance.isDraft" class="tag tag-gray">草稿</span>
            </div>
            <div class="info-row">
              <span class="info-label">发起人:</span>
              {{ instance.createdBy.name }}
            </div>
            <div class="info-row">
              <span class="info-label">提交时间:</span>
              {{ formatDate(instance.createdAt) }}
            </div>
            <div class="info-row" *ngIf="instance.updatedAt !== instance.createdAt">
              <span class="info-label">更新时间:</span>
              {{ formatDate(instance.updatedAt) }}
            </div>
          </div>
          <div style="flex: 1;">
            <div class="info-row">
              <span class="info-label">当前节点:</span>
              {{ getCurrentNodeName() }}
            </div>
            <div class="info-row">
              <span class="info-label">当前审批人:</span>
              <span *ngFor="let approver of instance.currentApprovers" class="tag tag-blue mr-8">
                {{ approver.name }}
              </span>
              <span *ngIf="instance.currentApprovers.length === 0">-</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">审批进度</div>
        <div class="progress-bar">
          <div *ngFor="let step of progress.steps; let i = index" class="progress-item">
            <div class="progress-dot" 
                 [class.dot-completed]="step.status === 'completed'"
                 [class.dot-current]="step.status === 'current'">
              {{ step.status === 'completed' ? '✓' : (i + 1) }}
            </div>
            <div class="progress-label"
                 [class.label-completed]="step.status === 'completed'"
                 [class.label-current]="step.status === 'current'">
              {{ step.name }}
            </div>
            <div *ngIf="i < progress.steps.length - 1" class="progress-line"
                 [class.line-completed]="step.status === 'completed'"></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">表单数据</div>
        <div class="form-data">
          <div *ngFor="let field of template.formFields" class="form-item">
            <div class="form-item-label">{{ field.label }}:</div>
            <div class="form-item-value">{{ instance.formData[field.name] || '-' }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">审批历史</div>
        <div class="timeline">
          <div *ngFor="let record of instance.approvalHistory" class="timeline-item">
            <div class="timeline-dot" 
                 [class.dot-approve]="record.action === 'approve'"
                 [class.dot-reject]="record.action === 'reject'"
                 [class.dot-submit]="record.action === 'submit' || record.action === 'resubmit'"
                 [class.dot-transfer]="record.action === 'transfer'">
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-user">{{ record.approver.name }}</span>
                <span class="tag" 
                      [class.tag-green]="record.action === 'approve'"
                      [class.tag-red]="record.action === 'reject'"
                      [class.tag-blue]="record.action === 'submit' || record.action === 'resubmit'"
                      [class.tag-orange]="record.action === 'transfer'">
                  {{ getActionLabel(record.action) }}
                </span>
                <span class="timeline-time">{{ formatDate(record.createdAt) }}</span>
              </div>
              <div class="timeline-node">节点: {{ record.nodeName }}</div>
              <div *ngIf="record.comment" class="timeline-comment">意见: {{ record.comment }}</div>
              <div *ngIf="record.transferTo" class="timeline-comment">转交给: {{ record.transferTo.name }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card" *ngIf="nodeApprovalDetails.length > 0">
        <div class="card-title">各节点审批详情</div>
        <div *ngFor="let detail of nodeApprovalDetails" class="node-approval-item">
          <div class="node-approval-header">
            <span class="node-name">{{ detail.nodeName }}</span>
            <span class="tag"
                  [class.tag-green]="detail.status === 'completed'"
                  [class.tag-orange]="detail.status === 'current'"
                  [class.tag-gray]="detail.status === 'pending'">
              {{ getNodeStatusLabel(detail.status) }}
            </span>
          </div>
          <div *ngFor="let record of detail.records" class="approval-record">
            <div class="record-info">
              <span class="record-user">{{ record.approver.name }}</span>
              <span class="tag"
                    [class.tag-green]="record.action === 'approve'"
                    [class.tag-red]="record.action === 'reject'">
                {{ getActionLabel(record.action) }}
              </span>
              <span class="record-time">{{ formatDate(record.createdAt) }}</span>
            </div>
            <div *ngIf="record.comment" class="record-comment">{{ record.comment }}</div>
          </div>
          <div *ngIf="detail.records.length === 0" class="no-records">暂无审批记录</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-row {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
    }
    .info-label {
      display: inline-block;
      width: 100px;
      color: #666;
    }
    .form-data {
      background: #fafafa;
      padding: 16px;
      border-radius: 4px;
    }
    .form-item {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f0f0f0;
    }
    .form-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    .form-item-label {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .form-item-value {
      color: #333;
    }
    .progress-bar {
      display: flex;
      align-items: flex-start;
      padding: 20px 0;
    }
    .progress-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      flex: 1;
    }
    .progress-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #d9d9d9;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      z-index: 1;
    }
    .dot-completed {
      background: #52c41a;
    }
    .dot-current {
      background: #1890ff;
    }
    .progress-label {
      margin-top: 8px;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
    .label-completed {
      color: #52c41a;
    }
    .label-current {
      color: #1890ff;
      font-weight: 600;
    }
    .progress-line {
      position: absolute;
      top: 16px;
      left: 50%;
      width: 100%;
      height: 2px;
      background: #d9d9d9;
    }
    .line-completed {
      background: #52c41a;
    }
    .timeline {
      position: relative;
      padding-left: 24px;
    }
    .timeline-item {
      position: relative;
      padding-bottom: 20px;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -20px;
      top: 8px;
      bottom: -12px;
      width: 2px;
      background: #e8e8e8;
    }
    .timeline-item:last-child::before {
      display: none;
    }
    .timeline-dot {
      position: absolute;
      left: -28px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #1890ff;
    }
    .dot-approve {
      background: #52c41a;
    }
    .dot-reject {
      background: #ff4d4f;
    }
    .dot-submit {
      background: #1890ff;
    }
    .dot-transfer {
      background: #fa8c16;
    }
    .timeline-content {
      background: #fafafa;
      padding: 12px;
      border-radius: 4px;
    }
    .timeline-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .timeline-user {
      font-weight: 600;
    }
    .timeline-time {
      color: #999;
      font-size: 12px;
      margin-left: auto;
    }
    .timeline-node {
      color: #666;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .timeline-comment {
      color: #333;
      font-size: 13px;
    }
    .node-approval-item {
      margin-bottom: 16px;
      padding: 12px;
      background: #fafafa;
      border-radius: 4px;
    }
    .node-approval-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e8e8e8;
    }
    .node-name {
      font-weight: 600;
    }
    .approval-record {
      padding: 8px;
      background: white;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .record-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .record-user {
      font-weight: 500;
    }
    .record-time {
      color: #999;
      font-size: 12px;
      margin-left: auto;
    }
    .record-comment {
      color: #666;
      font-size: 13px;
    }
    .no-records {
      color: #999;
      font-size: 12px;
      text-align: center;
      padding: 8px;
    }
  `]
})
export class InstanceDetailComponent implements OnInit {
  instance: FlowInstance | undefined;
  template: FlowTemplate | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private templateService: TemplateService
  ) {}

  ngOnInit(): void {
    const instanceId = this.route.snapshot.params['id'];
    this.loadInstance(instanceId);
  }

  loadInstance(id: string): void {
    this.instance = this.processService.getInstance(id);
    if (this.instance) {
      this.template = this.templateService.getTemplate(this.instance.templateId);
    }
  }

  get progress() {
    if (!this.instance || !this.template) {
      return { currentStep: 0, totalSteps: 0, steps: [] };
    }
    return this.processService.getProcessProgress(this.instance, this.template);
  }

  get nodeApprovalDetails(): { nodeId: string; nodeName: string; status: string; records: any[] }[] {
    if (!this.template || !this.instance) return [];
    
    const sortedNodes = this.template.nodes
      .filter(n => n.type !== 'start')
      .sort((a, b) => a.order - b.order);

    return sortedNodes.map(node => {
      const records = this.instance!.approvalResults[node.id] || [];
      let status = 'pending';
      
      if (records.length > 0) {
        const hasApprove = records.some((r: any) => r.action === 'approve');
        if (hasApprove) {
          status = 'completed';
        }
      }
      if (node.id === this.instance!.currentNodeId) {
        status = 'current';
      }
      if (this.instance!.status === 'completed' && node.type === 'end') {
        status = 'completed';
      }

      return {
        nodeId: node.id,
        nodeName: node.name,
        status,
        records
      };
    });
  }

  getCurrentNodeName(): string {
    if (!this.template || !this.instance) return '-';
    const node = this.template.nodes.find(n => n.id === this.instance!.currentNodeId);
    return node?.name || '-';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: '草稿',
      pending: '审批中',
      approved: '已通过',
      rejected: '已驳回',
      completed: '已完成'
    };
    return labels[status] || status;
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      submit: '提交',
      resubmit: '重新提交',
      approve: '通过',
      reject: '驳回',
      transfer: '转交',
      end: '结束'
    };
    return labels[action] || action;
  }

  getNodeStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: '待审批',
      current: '审批中',
      completed: '已完成'
    };
    return labels[status] || status;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  goBack(): void {
    history.back();
  }
}
