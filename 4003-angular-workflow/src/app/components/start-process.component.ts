import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TemplateService } from '../services/template.service';
import { ProcessService } from '../services/process.service';
import { FlowTemplate, FlowInstance } from '../models/workflow.model';

@Component({
  selector: 'app-start-process',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="flex-between mb-16">
        <button class="btn btn-default" [routerLink]="['/templates']">← 返回模板列表</button>
        <div>
          <button class="btn btn-default mr-8" (click)="saveDraft()">保存草稿</button>
          <button class="btn btn-primary" (click)="submitForm()">提交审批</button>
        </div>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title">
          发起流程: {{ template.name }}
        </div>
        <div style="color: #666; margin-bottom: 16px;">
          {{ template.description }}
        </div>

        <div style="margin-bottom: 20px;">
          <span class="tag tag-blue">流程节点: {{ template.nodes.length }} 个</span>
          <span class="tag tag-green">表单字段: {{ template.formFields.length }} 个</span>
        </div>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title">表单填写</div>
        
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
          <label class="form-label">提交备注</label>
          <textarea class="form-input" [(ngModel)]="formData._submitComment" placeholder="可选：添加提交备注"></textarea>
        </div>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title">流程预览</div>
        <div class="process-preview">
          <div *ngFor="let node of sortedNodes; let i = index" class="process-step" 
               [class.step-start]="node.type === 'start'"
               [class.step-end]="node.type === 'end'"
               [class.step-approval]="node.type === 'approval'"
               [class.step-condition]="node.type === 'condition'">
            <div class="step-icon">{{ getNodeIcon(node.type) }}</div>
            <div class="step-info">
              <div class="step-name">{{ node.name }}</div>
              <div *ngIf="node.type === 'approval'" class="step-detail">
                审批人: {{ getApprovers(node) }}
              </div>
              <div *ngIf="node.type === 'approval'" class="step-detail">
                类型: {{ getApprovalTypeLabel(node.approvalType) }}
              </div>
              <div *ngIf="node.type === 'condition'" class="step-detail">
                条件: {{ getConditionLabel(node) }}
              </div>
            </div>
            <div *ngIf="i < sortedNodes.length - 1" class="step-arrow">→</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .process-preview {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .process-step {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: #f5f5f5;
      border-radius: 8px;
      gap: 12px;
    }
    .step-start {
      background: #f6ffed;
      border: 1px solid #b7eb8f;
    }
    .step-end {
      background: #fff2f0;
      border: 1px solid #ffccc7;
    }
    .step-approval {
      background: #e6f7ff;
      border: 1px solid #91d5ff;
    }
    .step-condition {
      background: #fff7e6;
      border: 1px solid #ffd591;
    }
    .step-icon {
      font-size: 20px;
    }
    .step-info {
      font-size: 14px;
    }
    .step-name {
      font-weight: 600;
      margin-bottom: 2px;
    }
    .step-detail {
      font-size: 12px;
      color: #666;
    }
    .step-arrow {
      font-size: 18px;
      color: #999;
      margin: 0 4px;
    }
  `]
})
export class StartProcessComponent implements OnInit {
  template: FlowTemplate | undefined;
  formData: Record<string, any> = {};
  draftInstance: FlowInstance | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: TemplateService,
    private processService: ProcessService
  ) {}

  ngOnInit(): void {
    const templateId = this.route.snapshot.params['id'];
    const draftId = this.route.snapshot.queryParams['draft'];
    
    if (draftId) {
      this.draftInstance = this.processService.getInstance(draftId);
      if (this.draftInstance) {
        this.formData = { ...this.draftInstance.formData };
        this.template = this.templateService.getTemplate(this.draftInstance.templateId);
      }
    }
    
    if (!this.template) {
      this.template = this.templateService.getTemplate(templateId);
    }

    if (this.template) {
      for (const field of this.template.formFields) {
        if (this.formData[field.name] === undefined) {
          this.formData[field.name] = field.type === 'number' ? 0 : '';
        }
      }
    }
  }

  get sortedNodes() {
    if (!this.template) return [];
    return [...this.template.nodes].sort((a, b) => a.order - b.order);
  }

  getNodeIcon(type: string): string {
    const icons: Record<string, string> = {
      start: '▶️',
      end: '🏁',
      approval: '👤',
      condition: '❓'
    };
    return icons[type] || '●';
  }

  getApprovalTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      single: '单人审批',
      or_sign: '或签',
      countersign: '会签'
    };
    return labels[type || ''] || '';
  }

  getConditionLabel(node: any): string {
    if (!node.conditions || node.conditions.length === 0) {
      return '未设置';
    }
    return node.conditions.map((c: any) => `${c.field} ${c.operator} ${c.value}`).join(' 或 ');
  }

  getApprovers(node: any): string {
    if (!node.approvers || node.approvers.length === 0) {
      return '未设置';
    }
    return node.approvers.map((a: any) => a.name).join(', ');
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

  saveDraft(): void {
    if (!this.template) return;
    
    if (this.draftInstance) {
      this.draftInstance.formData = { ...this.formData };
      this.processService['storage'].saveInstance(this.draftInstance);
      alert('草稿已更新');
    } else {
      this.draftInstance = this.processService.createDraft(this.template.id, { ...this.formData });
      alert('草稿已保存');
    }
  }

  submitForm(): void {
    if (!this.validateForm()) return;
    
    if (this.draftInstance) {
      this.processService.submitInstance(this.draftInstance.id, { ...this.formData });
    } else if (this.template) {
      const draft = this.processService.createDraft(this.template.id, { ...this.formData });
      this.processService.submitInstance(draft.id, { ...this.formData });
    }
    
    alert('流程已提交');
    this.router.navigate(['/my-instances']);
  }
}
