import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { TemplateService } from '../services/template.service';
import { StorageService } from '../services/storage.service';
import { FlowInstance, FlowTemplate, User } from '../models/workflow.model';

@Component({
  selector: 'app-approve-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container" *ngIf="instance && template">
      <div class="flex-between mb-16">
        <button class="btn btn-default" [routerLink]="['/todo']">← 返回待办</button>
        <div>
          <button class="btn btn-default mr-8" (click)="showTransferModal = true">转交</button>
          <button class="btn btn-danger mr-8" (click)="showRejectModal = true">驳回</button>
          <button class="btn btn-success" (click)="showApproveModal = true">通过</button>
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
              <span class="info-label">当前节点:</span>
              <span class="tag tag-orange">{{ currentNode?.name }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">发起人:</span>
              {{ instance.createdBy.name }}
            </div>
            <div class="info-row">
              <span class="info-label">提交时间:</span>
              {{ formatDate(instance.createdAt) }}
            </div>
          </div>
          <div style="flex: 1;">
            <div class="info-row">
              <span class="info-label">审批类型:</span>
              {{ getApprovalTypeLabel(currentNode?.approvalType) }}
            </div>
            <div class="info-row">
              <span class="info-label">当前审批人:</span>
              <span *ngFor="let approver of instance.currentApprovers" class="tag tag-blue mr-8">
                {{ approver.name }}
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">审批状态:</span>
              <span class="tag" [class.tag-green]="instance.status === 'completed'"
                    [class.tag-red]="instance.status === 'rejected'"
                    [class.tag-orange]="instance.status === 'pending'">
                {{ getStatusLabel(instance.status) }}
              </span>
            </div>
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
        <div class="card-title">审批历史</div>
        <div class="timeline">
          <div *ngFor="let record of instance.approvalHistory" class="timeline-item">
            <div class="timeline-dot" 
                 [class.dot-approve]="record.action === 'approve'"
                 [class.dot-reject]="record.action === 'reject'"
                 [class.dot-submit]="record.action === 'submit' || record.action === 'resubmit'">
            </div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-user">{{ record.approver.name }}</span>
                <span class="tag" 
                      [class.tag-green]="record.action === 'approve'"
                      [class.tag-red]="record.action === 'reject'"
                      [class.tag-blue]="record.action === 'submit' || record.action === 'resubmit'">
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

      <div *ngIf="showApproveModal" class="modal-overlay" (click)="showApproveModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">审批通过</div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">审批意见</label>
              <textarea class="form-input" [(ngModel)]="approveComment" placeholder="请输入审批意见"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="showApproveModal = false">取消</button>
            <button class="btn btn-success" (click)="approve()">确认通过</button>
          </div>
        </div>
      </div>

      <div *ngIf="showRejectModal" class="modal-overlay" (click)="showRejectModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">审批驳回</div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">驳回原因</label>
              <textarea class="form-input" [(ngModel)]="rejectComment" placeholder="请输入驳回原因"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">驳回方式</label>
              <div>
                <label style="margin-right: 16px;">
                  <input type="radio" [(ngModel)]="returnToSubmitter" [value]="true"> 退回修改
                </label>
                <label>
                  <input type="radio" [(ngModel)]="returnToSubmitter" [value]="false"> 直接终止
                </label>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="showRejectModal = false">取消</button>
            <button class="btn btn-danger" (click)="reject()">确认驳回</button>
          </div>
        </div>
      </div>

      <div *ngIf="showTransferModal" class="modal-overlay" (click)="showTransferModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">转交审批</div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">选择转交人</label>
              <select class="form-input" [(ngModel)]="selectedTransferId">
                <option value="">请选择</option>
                <option *ngFor="let user of users" [value]="user.id">{{ user.name }} - {{ user.department }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">转交说明</label>
              <textarea class="form-input" [(ngModel)]="transferComment" placeholder="请输入转交说明"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="showTransferModal = false">取消</button>
            <button class="btn btn-primary" (click)="transfer()">确认转交</button>
          </div>
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
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: white;
      border-radius: 8px;
      padding: 24px;
      min-width: 400px;
      max-width: 500px;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 20px;
    }
  `]
})
export class ApproveDetailComponent implements OnInit {
  instance: FlowInstance | undefined;
  template: FlowTemplate | undefined;
  users: User[] = [];
  showApproveModal = false;
  showRejectModal = false;
  showTransferModal = false;
  approveComment = '';
  rejectComment = '';
  transferComment = '';
  returnToSubmitter = true;
  selectedTransferId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private templateService: TemplateService,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.users = this.storage.getUsers();
    const instanceId = this.route.snapshot.params['id'];
    this.loadInstance(instanceId);
  }

  loadInstance(id: string): void {
    this.instance = this.processService.getInstance(id);
    if (this.instance) {
      this.template = this.templateService.getTemplate(this.instance.templateId);
    }
  }

  get currentNode() {
    if (!this.template || !this.instance) return undefined;
    return this.template.nodes.find(n => n.id === this.instance!.currentNodeId);
  }

  get progress() {
    if (!this.instance || !this.template) {
      return { currentStep: 0, totalSteps: 0, steps: [] };
    }
    return this.processService.getProcessProgress(this.instance, this.template);
  }

  getApprovalTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      single: '单人审批',
      or_sign: '或签（一人通过即可）',
      countersign: '会签（所有人通过）'
    };
    return labels[type || ''] || '-';
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

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  approve(): void {
    if (!this.instance) return;
    this.processService.approve(this.instance.id, this.approveComment);
    this.showApproveModal = false;
    this.approveComment = '';
    this.router.navigate(['/todo']);
  }

  reject(): void {
    if (!this.instance) return;
    if (!this.rejectComment.trim()) {
      alert('请输入驳回原因');
      return;
    }
    this.processService.reject(this.instance.id, this.rejectComment, this.returnToSubmitter);
    this.showRejectModal = false;
    this.rejectComment = '';
    this.router.navigate(['/todo']);
  }

  transfer(): void {
    if (!this.instance) return;
    if (!this.selectedTransferId) {
      alert('请选择转交人');
      return;
    }
    const targetUser = this.users.find(u => u.id === this.selectedTransferId);
    if (targetUser) {
      this.processService.transfer(this.instance.id, targetUser, this.transferComment);
      this.showTransferModal = false;
      this.transferComment = '';
      this.selectedTransferId = '';
      this.router.navigate(['/todo']);
    }
  }
}
