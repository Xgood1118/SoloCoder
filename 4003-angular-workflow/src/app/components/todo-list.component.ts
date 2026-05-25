import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { StorageService } from '../services/storage.service';
import { TemplateService } from '../services/template.service';
import { FlowInstance, User, FlowTemplate } from '../models/workflow.model';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="card">
        <div class="card-title flex-between">
          <span>待办列表</span>
          <div>
            <button class="btn btn-sm btn-success mr-8" (click)="showBatchApprove = true" [disabled]="selectedIds.length === 0">
              批量通过 ({{ selectedIds.length }})
            </button>
            <button class="btn btn-sm btn-default" (click)="refresh()">刷新</button>
          </div>
        </div>

        <div *ngIf="todoList.length === 0" class="text-center" style="padding: 40px; color: #999;">
          暂无待办事项
        </div>

        <table *ngIf="todoList.length > 0" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #fafafa; border-bottom: 1px solid #f0f0f0;">
              <th style="padding: 12px; width: 40px;">
                <input type="checkbox" [checked]="isAllSelected()" (change)="toggleSelectAll($event)">
              </th>
              <th style="padding: 12px; text-align: left;">流程名称</th>
              <th style="padding: 12px; text-align: left;">标题</th>
              <th style="padding: 12px; text-align: left;">当前节点</th>
              <th style="padding: 12px; text-align: left;">发起人</th>
              <th style="padding: 12px; text-align: left;">提交时间</th>
              <th style="padding: 12px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inst of todoList" style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 12px;">
                <input type="checkbox" [checked]="selectedIds.includes(inst.id)" (change)="toggleSelect(inst.id, $event)">
              </td>
              <td style="padding: 12px;">
                <span class="tag tag-blue">{{ inst.templateName }}</span>
              </td>
              <td style="padding: 12px;">{{ inst.formData.title || '-' }}</td>
              <td style="padding: 12px;">
                <span class="tag tag-orange">{{ getCurrentNodeName(inst) }}</span>
              </td>
              <td style="padding: 12px;">{{ inst.createdBy.name }}</td>
              <td style="padding: 12px; color: #999;">{{ formatDate(inst.createdAt) }}</td>
              <td style="padding: 12px; text-align: center;">
                <button class="btn btn-sm btn-primary mr-8" [routerLink]="['/approve', inst.id]">审批</button>
                <button class="btn btn-sm btn-default" [routerLink]="['/instance', inst.id]">查看</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="showBatchApprove" class="modal-overlay" (click)="showBatchApprove = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">批量审批</div>
          <div class="modal-body">
            <p>确定要批量通过 {{ selectedIds.length }} 个流程吗？</p>
            <div class="form-group">
              <label class="form-label">审批意见</label>
              <textarea class="form-input" [(ngModel)]="batchComment" placeholder="请输入审批意见"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="showBatchApprove = false">取消</button>
            <button class="btn btn-success" (click)="batchApprove()">确认通过</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
export class TodoListComponent implements OnInit {
  todoList: FlowInstance[] = [];
  selectedIds: string[] = [];
  showBatchApprove = false;
  batchComment = '';
  currentUser: User;

  constructor(
    private processService: ProcessService,
    private templateService: TemplateService,
    private storage: StorageService
  ) {
    this.currentUser = this.storage.getCurrentUser();
  }

  ngOnInit(): void {
    this.loadTodoList();
  }

  loadTodoList(): void {
    this.todoList = this.processService.getMyPendingApprovals(this.currentUser.id);
  }

  refresh(): void {
    this.loadTodoList();
  }

  getCurrentNodeName(inst: FlowInstance): string {
    const template = this.templateService.getTemplate(inst.templateId);
    if (template) {
      const node = template.nodes.find(n => n.id === inst.currentNodeId);
      return node?.name || '未知节点';
    }
    return '未知节点';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  toggleSelect(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.push(id);
    } else {
      this.selectedIds = this.selectedIds.filter(i => i !== id);
    }
  }

  isAllSelected(): boolean {
    return this.todoList.length > 0 && this.selectedIds.length === this.todoList.length;
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds = this.todoList.map(i => i.id);
    } else {
      this.selectedIds = [];
    }
  }

  batchApprove(): void {
    this.processService.batchApprove(this.selectedIds, this.batchComment || '批量通过');
    this.selectedIds = [];
    this.showBatchApprove = false;
    this.batchComment = '';
    this.loadTodoList();
  }
}
