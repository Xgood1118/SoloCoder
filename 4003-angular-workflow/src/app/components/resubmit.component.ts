import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { TemplateService } from '../services/template.service';
import { FlowInstance, FlowTemplate } from '../models/workflow.model';

@Component({
  selector: 'app-resubmit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container" *ngIf="instance && template">
      <div class="flex-between mb-16">
        <button class="btn btn-default" [routerLink]="['/my-instances']">← 返回我的流程</button>
        <button class="btn btn-primary" (click)="resubmit()">重新提交</button>
      </div>

      <div class="card">
        <div class="card-title">
          修改后重新提交: {{ instance.templateName }}
        </div>
        <div class="alert alert-warning">
          <strong>提示：</strong>此流程曾被驳回，请根据驳回意见修改后重新提交。
        </div>
        <div *ngIf="rejectRecord" class="reject-info">
          <div class="reject-header">
            <span class="reject-user">{{ rejectRecord.approver.name }}</span>
            <span class="tag tag-red">驳回</span>
            <span class="reject-time">{{ formatDate(rejectRecord.createdAt) }}</span>
          </div>
          <div class="reject-node">驳回节点: {{ rejectRecord.nodeName }}</div>
          <div class="reject-comment">驳回意见: {{ rejectRecord.comment || '无' }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">表单修改</div>
        
        <div *ngFor="let field of template.formFields" class="form-group">
          <label class="form-label">
            {{ field.label }}
            <span *ngIf="field.required" style="color: #ff4d4f;">*</span>
          </label>
          <input *ngIf="field.type === 'text'" 
                 class="form-input" 
                 [(ngModel)]="formData[field.name]"
                 [placeholder]="field.placeholder">
          <textarea *ngIf="field.type === 'textarea'" 
                    class="form-input" 
                    [(ngModel)]="formData[field.name]"
                    [placeholder]="field.placeholder"></textarea>
          <input *ngIf="field.type === 'number'" 
                 class="form-input" 
                 type="number"
                 [(ngModel)]="formData[field.name]"
                 [placeholder]="field.placeholder">
          <input *ngIf="field.type === 'date'" 
                 class="form-input" 
                 type="date"
                 [(ngModel)]="formData[field.name]">
        </div>

        <div class="form-group">
          <label class="form-label">重新提交备注</label>
          <textarea class="form-input" [(ngModel)]="formData._resubmitComment" placeholder="可选：添加重新提交备注"></textarea>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .alert {
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .alert-warning {
      background: #fff7e6;
      border: 1px solid #ffd591;
      color: #d46b08;
    }
    .reject-info {
      background: #fff2f0;
      border: 1px solid #ffccc7;
      border-radius: 4px;
      padding: 16px;
      margin-top: 16px;
    }
    .reject-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .reject-user {
      font-weight: 600;
    }
    .reject-time {
      color: #999;
      font-size: 12px;
      margin-left: auto;
    }
    .reject-node {
      color: #666;
      margin-bottom: 4px;
    }
    .reject-comment {
      color: #333;
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
  `]
})
export class ResubmitComponent implements OnInit {
  instance: FlowInstance | undefined;
  template: FlowTemplate | undefined;
  formData: Record<string, any> = {};

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
      this.formData = { ...this.instance.formData };
    }
  }

  get rejectRecord(): any {
    if (!this.instance) return undefined;
    return this.instance.approvalHistory
      .filter(r => r.action === 'reject')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
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

  resubmit(): void {
    if (!this.instance) return;

    if (!this.validateForm()) return;

    this.processService.resubmit(this.instance.id, { ...this.formData });
    alert('已重新提交');
    this.router.navigate(['/my-instances']);
  }

  validateForm(): boolean {
    if (!this.template) return false;
    
    for (const field of this.template.formFields) {
      if (field.required && !this.formData[field.name]) {
        alert(`请填写必填项: ${field.label}`);
        return false;
      }
    }
    return true;
  }
}
