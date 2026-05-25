import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { TemplateService } from '../services/template.service';
import { StorageService } from '../services/storage.service';
import { FlowInstance, FlowTemplate, User } from '../models/workflow.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-icon stat-icon-blue">📋</div>
          <div class="stat-info">
            <div class="stat-value">{{ templatesCount }}</div>
            <div class="stat-label">流程模板</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-orange">⏳</div>
          <div class="stat-info">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">待我审批</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-green">✅</div>
          <div class="stat-info">
            <div class="stat-value">{{ myCompletedCount }}</div>
            <div class="stat-label">我已审批</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon stat-icon-purple">📝</div>
          <div class="stat-info">
            <div class="stat-value">{{ myInstancesCount }}</div>
            <div class="stat-label">我的流程</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title flex-between">
          <span>快速操作</span>
        </div>
        <div class="quick-actions">
          <button class="action-btn" [routerLink]="['/templates']">
            <span class="action-icon">📋</span>
            <span>管理流程模板</span>
          </button>
          <button class="action-btn" [routerLink]="['/todo']">
            <span class="action-icon">⏳</span>
            <span>查看待办</span>
          </button>
          <button class="action-btn" [routerLink]="['/my-instances']">
            <span class="action-icon">📝</span>
            <span>我的流程</span>
          </button>
          <button class="action-btn" (click)="startNewProcess()">
            <span class="action-icon">🚀</span>
            <span>发起新流程</span>
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-title flex-between">
          <span>最新待办</span>
          <button class="btn btn-sm btn-default" [routerLink]="['/todo']">查看全部</button>
        </div>
        <div *ngIf="recentTodos.length === 0" class="empty-state">
          暂无待办事项
        </div>
        <div *ngIf="recentTodos.length > 0" class="todo-list">
          <div *ngFor="let inst of recentTodos" class="todo-item" [routerLink]="['/approve', inst.id]">
            <div class="todo-dot"></div>
            <div class="todo-info">
              <div class="todo-title">{{ inst.formData.title || inst.templateName }}</div>
              <div class="todo-meta">
                <span class="tag tag-blue">{{ inst.templateName }}</span>
                <span class="todo-user">{{ inst.createdBy.name }}</span>
                <span class="todo-time">{{ formatDate(inst.createdAt) }}</span>
              </div>
            </div>
            <button class="btn btn-sm btn-primary">审批</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title flex-between">
          <span>我的最新流程</span>
          <button class="btn btn-sm btn-default" [routerLink]="['/my-instances']">查看全部</button>
        </div>
        <div *ngIf="recentInstances.length === 0" class="empty-state">
          暂无流程记录
        </div>
        <div *ngIf="recentInstances.length > 0" class="instance-list">
          <div *ngFor="let inst of recentInstances" class="instance-item" [routerLink]="['/instance', inst.id]">
            <div class="instance-info">
              <div class="instance-title">{{ inst.formData.title || inst.templateName }}</div>
              <div class="instance-meta">
                <span class="tag tag-blue">{{ inst.templateName }}</span>
                <span class="tag"
                      [class.tag-green]="inst.status === 'completed'"
                      [class.tag-red]="inst.status === 'rejected'"
                      [class.tag-orange]="inst.status === 'pending'">
                  {{ getStatusLabel(inst.status) }}
                </span>
                <span class="instance-time">{{ formatDate(inst.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      flex: 1;
      background: white;
      border-radius: 8px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .stat-icon-blue {
      background: #e6f7ff;
    }
    .stat-icon-orange {
      background: #fff7e6;
    }
    .stat-icon-green {
      background: #f6ffed;
    }
    .stat-icon-purple {
      background: #f9f0ff;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
    }
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .action-btn {
      padding: 20px;
      background: #fafafa;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: #e6f7ff;
      border-color: #1890ff;
    }
    .action-icon {
      font-size: 28px;
    }
    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }
    .todo-list {
      display: flex;
      flex-direction: column;
    }
    .todo-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .todo-item:hover {
      background: #fafafa;
    }
    .todo-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fa8c16;
    }
    .todo-info {
      flex: 1;
    }
    .todo-title {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .todo-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #666;
    }
    .todo-user {
      color: #999;
    }
    .todo-time {
      color: #999;
      margin-left: auto;
    }
    .instance-list {
      display: flex;
      flex-direction: column;
    }
    .instance-item {
      padding: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .instance-item:hover {
      background: #fafafa;
    }
    .instance-title {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .instance-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }
    .instance-time {
      color: #999;
      margin-left: auto;
    }
  `]
})
export class DashboardComponent implements OnInit {
  currentUser: User;
  templatesCount = 0;
  pendingCount = 0;
  myCompletedCount = 0;
  myInstancesCount = 0;
  recentTodos: FlowInstance[] = [];
  recentInstances: FlowInstance[] = [];
  templates: FlowTemplate[] = [];

  constructor(
    private processService: ProcessService,
    private templateService: TemplateService,
    private storage: StorageService,
    private router: Router
  ) {
    this.currentUser = this.storage.getCurrentUser();
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.templates = this.templateService.getAllTemplates();
    this.templatesCount = this.templates.length;
    
    const pendingList = this.processService.getMyPendingApprovals(this.currentUser.id);
    this.pendingCount = pendingList.length;
    this.recentTodos = pendingList.slice(0, 5);
    
    const myInstances = this.processService.getMyInstances(this.currentUser.id);
    this.myInstancesCount = myInstances.length;
    this.recentInstances = myInstances.slice(0, 5);
    
    this.myCompletedCount = this.processService.getMyCompletedApprovals(this.currentUser.id).length;
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
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

  startNewProcess(): void {
    if (this.templates.length === 0) {
      alert('请先创建流程模板');
      this.router.navigate(['/templates']);
    } else if (this.templates.length === 1) {
      this.router.navigate(['/start', this.templates[0].id]);
    } else {
      this.router.navigate(['/templates']);
    }
  }
}
