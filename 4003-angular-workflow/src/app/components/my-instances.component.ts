import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ProcessService } from '../services/process.service';
import { StorageService } from '../services/storage.service';
import { TemplateService } from '../services/template.service';
import { FlowInstance, User } from '../models/workflow.model';

@Component({
  selector: 'app-my-instances',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="card">
        <div class="card-title flex-between">
          <span>我的流程</span>
          <div>
            <button class="btn btn-sm btn-primary mr-8" [class.active]="filter === 'all'" (click)="filter = 'all'">全部</button>
            <button class="btn btn-sm btn-default mr-8" [class.active]="filter === 'pending'" (click)="filter = 'pending'">审批中</button>
            <button class="btn btn-sm btn-default mr-8" [class.active]="filter === 'completed'" (click)="filter = 'completed'">已完成</button>
            <button class="btn btn-sm btn-default" [class.active]="filter === 'rejected'" (click)="filter = 'rejected'">已驳回</button>
          </div>
        </div>

        <div *ngIf="filteredInstances.length === 0" class="text-center" style="padding: 40px; color: #999;">
          暂无流程记录
        </div>

        <table *ngIf="filteredInstances.length > 0" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #fafafa; border-bottom: 1px solid #f0f0f0;">
              <th style="padding: 12px; text-align: left;">流程名称</th>
              <th style="padding: 12px; text-align: left;">标题</th>
              <th style="padding: 12px; text-align: left;">状态</th>
              <th style="padding: 12px; text-align: left;">当前节点</th>
              <th style="padding: 12px; text-align: left;">提交时间</th>
              <th style="padding: 12px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inst of filteredInstances" style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 12px;">
                <span class="tag tag-blue">{{ inst.templateName }}</span>
              </td>
              <td style="padding: 12px;">{{ inst.formData.title || '-' }}</td>
              <td style="padding: 12px;">
                <span class="tag" 
                      [class.tag-green]="inst.status === 'completed'"
                      [class.tag-red]="inst.status === 'rejected'"
                      [class.tag-orange]="inst.status === 'pending'"
                      [class.tag-gray]="inst.status === 'draft'">
                  {{ getStatusLabel(inst.status) }}
                </span>
                <span *ngIf="inst.isDraft" class="tag tag-gray">草稿</span>
              </td>
              <td style="padding: 12px;">{{ getCurrentNodeName(inst) }}</td>
              <td style="padding: 12px; color: #999;">{{ formatDate(inst.createdAt) }}</td>
              <td style="padding: 12px; text-align: center;">
                <button class="btn btn-sm btn-default mr-8" [routerLink]="['/instance', inst.id]">查看</button>
                <button *ngIf="inst.status === 'rejected' && !inst.isDraft" 
                        class="btn btn-sm btn-primary mr-8" 
                        [routerLink]="['/resubmit', inst.id]">修改重提</button>
                <button *ngIf="inst.isDraft" 
                        class="btn btn-sm btn-primary mr-8" 
                        [routerLink]="['/start', inst.templateId]" 
                        [queryParams]="{ draft: inst.id }">编辑</button>
                <button class="btn btn-sm btn-danger" (click)="deleteInstance(inst.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .btn.active {
      background-color: #1890ff;
      color: white;
    }
  `]
})
export class MyInstancesComponent implements OnInit {
  instances: FlowInstance[] = [];
  currentUser: User;
  filter: 'all' | 'pending' | 'completed' | 'rejected' = 'all';

  constructor(
    private processService: ProcessService,
    private templateService: TemplateService,
    private storage: StorageService
  ) {
    this.currentUser = this.storage.getCurrentUser();
  }

  ngOnInit(): void {
    this.loadInstances();
  }

  loadInstances(): void {
    this.instances = this.processService.getMyInstances(this.currentUser.id);
  }

  get filteredInstances(): FlowInstance[] {
    if (this.filter === 'all') {
      return this.instances;
    }
    return this.instances.filter(i => i.status === this.filter);
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

  getCurrentNodeName(inst: FlowInstance): string {
    const template = this.templateService.getTemplate(inst.templateId);
    if (template) {
      const node = template.nodes.find(n => n.id === inst.currentNodeId);
      return node?.name || '-';
    }
    return '-';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }

  deleteInstance(id: string): void {
    if (confirm('确定要删除该流程吗？')) {
      this.processService.deleteInstance(id);
      this.loadInstances();
    }
  }
}
