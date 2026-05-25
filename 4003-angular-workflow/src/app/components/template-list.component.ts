import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { TemplateService } from '../services/template.service';
import { FlowTemplate } from '../models/workflow.model';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <div class="card">
        <div class="card-title flex-between">
          <span>流程模板管理</span>
          <div>
            <button class="btn btn-primary mr-8" (click)="showCreateModal = true">+ 新建模板</button>
            <button class="btn btn-default" (click)="triggerImport()">导入JSON</button>
            <input type="file" #importFile accept=".json" style="display:none" (change)="handleImport($event)">
          </div>
        </div>

        <div *ngIf="templates.length === 0" class="text-center" style="padding: 40px; color: #999;">
          暂无流程模板，点击上方按钮创建
        </div>

        <table *ngIf="templates.length > 0" style="width:100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #fafafa; border-bottom: 1px solid #f0f0f0;">
              <th style="padding: 12px; text-align: left;">模板名称</th>
              <th style="padding: 12px; text-align: left;">描述</th>
              <th style="padding: 12px; text-align: left;">节点数</th>
              <th style="padding: 12px; text-align: left;">创建时间</th>
              <th style="padding: 12px; text-align: left;">更新时间</th>
              <th style="padding: 12px; text-align: center;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let tpl of templates" style="border-bottom: 1px solid #f0f0f0;">
              <td style="padding: 12px;">{{ tpl.name }}</td>
              <td style="padding: 12px; color: #666;">{{ tpl.description || '-' }}</td>
              <td style="padding: 12px;">{{ tpl.nodes.length }}</td>
              <td style="padding: 12px; color: #999;">{{ formatDate(tpl.createdAt) }}</td>
              <td style="padding: 12px; color: #999;">{{ formatDate(tpl.updatedAt) }}</td>
              <td style="padding: 12px; text-align: center;">
                <button class="btn btn-sm btn-primary mr-8" [routerLink]="['/template', tpl.id]">编辑</button>
                <button class="btn btn-sm btn-default mr-8" (click)="copyTemplate(tpl.id)">复制</button>
                <button class="btn btn-sm btn-default mr-8" (click)="exportTemplate(tpl.id)">导出</button>
                <button class="btn btn-sm btn-default mr-8" [routerLink]="['/start', tpl.id]">发起</button>
                <button class="btn btn-sm btn-danger" (click)="deleteTemplate(tpl.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="showCreateModal" class="modal-overlay" (click)="showCreateModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-title">新建流程模板</div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">模板名称</label>
              <input class="form-input" [(ngModel)]="newTemplateName" placeholder="请输入模板名称">
            </div>
            <div class="form-group">
              <label class="form-label">模板描述</label>
              <textarea class="form-input" [(ngModel)]="newTemplateDesc" placeholder="请输入模板描述"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-default" (click)="showCreateModal = false">取消</button>
            <button class="btn btn-primary" (click)="createTemplate()">创建</button>
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
export class TemplateListComponent implements OnInit {
  templates: FlowTemplate[] = [];
  showCreateModal = false;
  newTemplateName = '';
  newTemplateDesc = '';

  constructor(
    private templateService: TemplateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.templates = this.templateService.getAllTemplates();
  }

  createTemplate(): void {
    if (!this.newTemplateName.trim()) {
      alert('请输入模板名称');
      return;
    }
    const tpl = this.templateService.createTemplate(this.newTemplateName, this.newTemplateDesc);
    this.showCreateModal = false;
    this.newTemplateName = '';
    this.newTemplateDesc = '';
    this.loadTemplates();
    this.router.navigate(['/template', tpl.id]);
  }

  copyTemplate(id: string): void {
    this.templateService.copyTemplate(id);
    this.loadTemplates();
  }

  deleteTemplate(id: string): void {
    if (confirm('确定要删除该模板吗？')) {
      this.templateService.deleteTemplate(id);
      this.loadTemplates();
    }
  }

  exportTemplate(id: string): void {
    const json = this.templateService.exportTemplate(id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport(): void {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input.click();
  }

  handleImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = e.target?.result as string;
          this.templateService.importTemplate(json);
          this.loadTemplates();
          alert('导入成功');
        } catch (err) {
          alert('导入失败：JSON格式错误');
        }
      };
      reader.readAsText(file);
    }
    input.value = '';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  }
}
