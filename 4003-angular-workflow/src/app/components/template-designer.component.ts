import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TemplateService } from '../services/template.service';
import { StorageService } from '../services/storage.service';
import { FlowTemplate, FlowNode, FormField, ConditionRule, User, ApprovalType } from '../models/workflow.model';

@Component({
  selector: 'app-template-designer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="flex-between mb-16">
        <button class="btn btn-default" [routerLink]="['/templates']">← 返回列表</button>
        <button class="btn btn-primary" (click)="saveTemplate()">保存模板</button>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title">基本信息</div>
        <div class="flex" style="gap: 16px;">
          <div class="form-group" style="flex: 1;">
            <label class="form-label">模板名称</label>
            <input class="form-input" [(ngModel)]="template.name" placeholder="请输入模板名称">
          </div>
          <div class="form-group" style="flex: 1;">
            <label class="form-label">模板描述</label>
            <input class="form-input" [(ngModel)]="template.description" placeholder="请输入模板描述">
          </div>
        </div>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title flex-between">
          <span>流程节点设计</span>
          <div>
            <button class="btn btn-sm btn-primary mr-8" (click)="addNode('approval')">+ 添加审批节点</button>
            <button class="btn btn-sm btn-default" (click)="addNode('condition')">+ 添加条件节点</button>
          </div>
        </div>

        <div class="flow-canvas">
          <div *ngFor="let node of sortedNodes" 
               class="flow-node" 
               [class.node-start]="node.type === 'start'"
               [class.node-end]="node.type === 'end'"
               [class.node-approval]="node.type === 'approval'"
               [class.node-condition]="node.type === 'condition'"
               [class.condition-branch]="node.isConditionBranch"
               (dragover)="onDragOver($event, node)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event, node)">
            <div class="node-header">
              <span class="node-icon">{{ getNodeIcon(node.type) }}</span>
              <span class="node-name" (dblclick)="editingNodeId = node.id" *ngIf="editingNodeId !== node.id">{{ node.name }}</span>
              <input *ngIf="editingNodeId === node.id" 
                     class="form-input" 
                     style="display:inline-block; width: 120px;"
                     [(ngModel)]="node.name" 
                     (blur)="editingNodeId = ''"
                     (keyup.enter)="editingNodeId = ''"
                     autofocus>
            </div>
            
            <div *ngIf="node.type === 'approval'" class="node-body">
              <div class="form-group" style="margin-bottom: 8px;">
                <label class="form-label" style="font-size: 12px;">审批类型</label>
                <select class="form-input" [(ngModel)]="node.approvalType" (change)="saveTemplate()">
                  <option value="single">单人审批</option>
                  <option value="or_sign">或签（一人通过即可）</option>
                  <option value="countersign">会签（所有人通过）</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom: 8px;">
                <label class="form-label" style="font-size: 12px;">审批人</label>
                <div class="approver-tags">
                  <span *ngFor="let approver of node.approvers" class="tag tag-blue">
                    {{ approver.name }}
                    <span style="cursor:pointer; margin-left: 4px;" (click)="removeApprover(node, approver)">×</span>
                  </span>
                  <select class="form-input" style="width: 100px;" [(ngModel)]="selectedApproverId" (change)="addApprover(node, $event)">
                    <option value="">选择审批人</option>
                    <option *ngFor="let user of users" [value]="user.id">{{ user.name }}</option>
                  </select>
                </div>
              </div>
              <div style="font-size: 12px; color: #999; margin-top: 4px;">
                共 {{ node.approvers?.length || 0 }} 人
              </div>
            </div>

            <div *ngIf="node.type === 'condition'" class="node-body">
              <div *ngFor="let cond of node.conditions; let i = index" class="condition-row">
                <select class="form-input" style="width: 80px;" [(ngModel)]="cond.field" (change)="saveTemplate()">
                  <option *ngFor="let field of template.formFields" [value]="field.name">{{ field.label }}</option>
                </select>
                <select class="form-input" style="width: 60px;" [(ngModel)]="cond.operator" (change)="saveTemplate()">
                  <option value=">">></option>
                  <option value="<"><</option>
                  <option value=">=">>=</option>
                  <option value="<="><=</option>
                  <option value="==">=</option>
                </select>
                <input class="form-input" style="width: 80px;" type="number" [(ngModel)]="cond.value" (change)="saveTemplate()">
                <button class="btn btn-sm btn-danger" (click)="removeCondition(node, i)">×</button>
              </div>
              <button class="btn btn-sm btn-default" (click)="addCondition(node)">+ 添加条件</button>
              <div style="font-size: 12px; color: #999; margin-top: 4px;">
                满足条件时走分支节点
              </div>
            </div>

            <div *ngIf="node.type === 'approval' && node.isConditionBranch" class="node-footer">
              <span class="tag tag-orange">条件分支节点</span>
            </div>

            <div *ngIf="node.type !== 'start' && node.type !== 'end'" class="node-actions">
              <button class="btn btn-sm btn-default" (click)="moveNode(node, 'up')" [disabled]="canMoveUp(node)">↑</button>
              <button class="btn btn-sm btn-default" (click)="moveNode(node, 'down')" [disabled]="canMoveDown(node)">↓</button>
              <button class="btn btn-sm btn-danger" (click)="removeNode(node)">删除</button>
              <button *ngIf="node.type === 'approval'" class="btn btn-sm btn-default" (click)="toggleConditionBranch(node)">
                {{ node.isConditionBranch ? '取消分支' : '设为分支' }}
              </button>
            </div>
          </div>
          <ng-container *ngFor="let node of sortedNodes; let i = index">
            <div class="flow-connector" *ngIf="i < sortedNodes.length - 1">
              ↓
            </div>
          </ng-container>
        </div>
      </div>

      <div *ngIf="template" class="card">
        <div class="card-title flex-between">
          <span>表单字段配置</span>
          <button class="btn btn-sm btn-primary" (click)="addFormField()">+ 添加字段</button>
        </div>
        <table style="width:100%;">
          <thead>
            <tr style="background: #fafafa;">
              <th style="padding: 8px; text-align: left;">字段标签</th>
              <th style="padding: 8px; text-align: left;">字段名称</th>
              <th style="padding: 8px; text-align: left;">类型</th>
              <th style="padding: 8px; text-align: left;">必填</th>
              <th style="padding: 8px; text-align: left;">占位符</th>
              <th style="padding: 8px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let field of template.formFields" style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 8px;">
                <input class="form-input" [(ngModel)]="field.label" placeholder="标签">
              </td>
              <td style="padding: 8px;">
                <input class="form-input" [(ngModel)]="field.name" placeholder="字段名">
              </td>
              <td style="padding: 8px;">
                <select class="form-input" [(ngModel)]="field.type">
                  <option value="text">单行文本</option>
                  <option value="textarea">多行文本</option>
                  <option value="number">数字</option>
                  <option value="date">日期</option>
                </select>
              </td>
              <td style="padding: 8px;">
                <input type="checkbox" [(ngModel)]="field.required">
              </td>
              <td style="padding: 8px;">
                <input class="form-input" [(ngModel)]="field.placeholder" placeholder="占位符">
              </td>
              <td style="padding: 8px; text-align: center;">
                <button class="btn btn-sm btn-danger" (click)="removeFormField(field.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .flow-canvas {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
      background: #fafafa;
      border-radius: 8px;
      min-height: 200px;
    }
    .flow-node {
      min-width: 200px;
      max-width: 300px;
      background: white;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 8px 0;
      border-left: 4px solid #1890ff;
    }
    .node-start {
      border-left-color: #52c41a;
      background: #f6ffed;
    }
    .node-end {
      border-left-color: #ff4d4f;
      background: #fff2f0;
    }
    .node-approval {
      border-left-color: #1890ff;
    }
    .node-condition {
      border-left-color: #fa8c16;
      background: #fff7e6;
    }
    .condition-branch {
      margin-left: 40px;
      border-left-color: #722ed1;
      background: #f9f0ff;
    }
    .node-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f0f0f0;
    }
    .node-icon {
      font-size: 18px;
    }
    .node-name {
      font-weight: 600;
      cursor: pointer;
    }
    .node-body {
      font-size: 13px;
    }
    .approver-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .condition-row {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    .node-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }
    .node-footer {
      margin-top: 8px;
    }
    .flow-connector {
      font-size: 20px;
      color: #999;
    }
    .drag-over {
      border: 2px dashed #1890ff;
    }
  `]
})
export class TemplateDesignerComponent implements OnInit {
  template: FlowTemplate | undefined;
  users: User[] = [];
  editingNodeId: string | null = null;
  selectedApproverId: string = '';
  draggedNode: FlowNode | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: TemplateService,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.users = this.storage.getUsers();
    const templateId = this.route.snapshot.params['id'];
    this.template = this.templateService.getTemplate(templateId);
    if (!this.template) {
      this.router.navigate(['/templates']);
    }
  }

  get sortedNodes(): FlowNode[] {
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

  addNode(type: 'approval' | 'condition'): void {
    if (!this.template) return;
    const name = type === 'approval' ? '审批节点' : '条件节点';
    this.templateService.addNode(this.template, type, name);
  }

  removeNode(node: FlowNode): void {
    if (!this.template) return;
    if (confirm(`确定要删除节点"${node.name}"吗？`)) {
      this.templateService.removeNode(this.template, node.id);
    }
  }

  moveNode(node: FlowNode, direction: 'up' | 'down'): void {
    if (!this.template) return;
    this.templateService.moveNode(this.template, node.id, direction);
  }

  canMoveUp(node: FlowNode): boolean {
    const sorted = this.sortedNodes;
    const idx = sorted.findIndex(n => n.id === node.id);
    if (idx <= 1) return true;
    const prevNode = sorted[idx - 1];
    return prevNode.type === 'start';
  }

  canMoveDown(node: FlowNode): boolean {
    const sorted = this.sortedNodes;
    const idx = sorted.findIndex(n => n.id === node.id);
    if (idx >= sorted.length - 2) return true;
    const nextNode = sorted[idx + 1];
    return nextNode.type === 'end';
  }

  addApprover(node: FlowNode, event: Event): void {
    const userId = (event.target as HTMLSelectElement).value;
    const user = this.users.find(u => u.id === userId);
    if (user && node.approvers) {
      if (!node.approvers.some(a => a.id === user.id)) {
        node.approvers.push(user);
      }
    }
    this.selectedApproverId = '';
  }

  removeApprover(node: FlowNode, approver: User): void {
    if (node.approvers) {
      node.approvers = node.approvers.filter(a => a.id !== approver.id);
    }
  }

  addCondition(node: FlowNode): void {
    if (!node.conditions) {
      node.conditions = [];
    }
    node.conditions.push({
      field: this.template?.formFields[0]?.name || '',
      operator: '>',
      value: 0
    });
  }

  removeCondition(node: FlowNode, index: number): void {
    this.templateService.removeCondition(this.template!, node.id, index);
  }

  toggleConditionBranch(node: FlowNode): void {
    node.isConditionBranch = !node.isConditionBranch;
  }

  addFormField(): void {
    if (!this.template) return;
    const field: FormField = {
      id: 'ff_' + this.storage.generateId(),
      name: 'field_' + Date.now(),
      label: '新字段',
      type: 'text',
      required: false,
      placeholder: '请输入'
    };
    this.templateService.addFormField(this.template, field);
  }

  removeFormField(fieldId: string): void {
    if (!this.template) return;
    if (confirm('确定要删除该字段吗？')) {
      this.templateService.removeFormField(this.template, fieldId);
    }
  }

  saveTemplate(): void {
    if (this.template) {
      this.templateService.saveTemplate(this.template);
    }
  }

  onDragOver(event: DragEvent, node: FlowNode): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('drag-over');
  }

  onDragLeave(event: DragEvent): void {
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
  }

  onDrop(event: DragEvent, node: FlowNode): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('drag-over');
  }
}
