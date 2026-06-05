import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { DocumentTemplate, TemplateCreateRequest, TemplateUpdateRequest } from '../core/models/template.model';
import { Category } from '../core/models/category.model';

@Component({
  selector: 'app-template-list',
  template: `
    <div class="template-list">
      <nz-page-header nzTitle="模板管理" class="page-header">
        <nz-page-header-extra>
          <button nz-button nzType="primary" (click)="showCreateModal()">
            <i nz-icon nzType="plus"></i>
            新建模板
          </button>
        </nz-page-header-extra>
      </nz-page-header>

      <nz-card>
        <nz-table
          #templateTable
          [nzData]="templates"
          [nzLoading]="loading"
          nzShowPagination="false"
        >
          <thead>
            <tr>
              <th>模板名称</th>
              <th nzWidth="200px">描述</th>
              <th nzWidth="120px">关联分类</th>
              <th nzWidth="80px">是否默认</th>
              <th nzWidth="180px">创建时间</th>
              <th nzWidth="150px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let tpl of templateTable.data">
              <td>{{ tpl.name }}</td>
              <td>{{ tpl.description || '-' }}</td>
              <td>{{ tpl.categoryName || '-' }}</td>
              <td>
                <nz-tag [nzColor]="tpl.isDefault ? 'green' : 'default'" nzSize="small">
                  {{ tpl.isDefault ? '是' : '否' }}
                </nz-tag>
              </td>
              <td>{{ dateService.formatDateTime(tpl.createdAt) }}</td>
              <td>
                <button nz-button nzType="link" nzSize="small" (click)="showEditModal(tpl)">
                  编辑
                </button>
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  nzDanger
                  nz-popconfirm
                  nzPopconfirmTitle="确定删除该模板吗？"
                  (nzOnConfirm)="deleteTemplate(tpl.id)"
                >
                  删除
                </button>
              </td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>

      <nz-modal
        [(nzVisible)]="modalVisible"
        [nzTitle]="isEditMode ? '编辑模板' : '新建模板'"
        (nzOnCancel)="cancelModal()"
        (nzOnOk)="saveTemplate()"
        [nzOkLoading]="saving"
        [nzWidth]="640"
      >
        <form [formGroup]="templateForm">
          <nz-form-item>
            <nz-form-label nzRequired>模板名称</nz-form-label>
            <nz-form-control nzErrorTip="请输入模板名称">
              <input type="text" nz-input formControlName="name" placeholder="请输入模板名称" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>描述</nz-form-label>
            <nz-form-control>
              <textarea
                nz-input
                formControlName="description"
                placeholder="请输入模板描述"
                [nzAutosize]="{ minRows: 2, maxRows: 4 }"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>关联分类</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="categoryId"
                nzAllowClear
                nzPlaceHolder="选择关联分类"
              >
                <nz-option *ngFor="let cat of flatCategories" [nzValue]="cat.id" [nzLabel]="cat.name"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>是否默认</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="isDefault"></nz-switch>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>模板结构</nz-form-label>
            <nz-form-control>
              <textarea
                nz-input
                formControlName="structure"
                placeholder='请输入 JSON 结构，例如: {"title":"","content":"","tags":[]}'
                [nzAutosize]="{ minRows: 4, maxRows: 10 }"
              ></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </nz-modal>
    </div>
  `,
  styleUrls: ['./template-list.component.scss'],
})
export class TemplateListComponent implements OnInit {
  templates: DocumentTemplate[] = [];
  loading = false;
  modalVisible = false;
  isEditMode = false;
  saving = false;
  editingId = '';
  categories: Category[] = [];
  flatCategories: Category[] = [];
  templateForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService,
    public dateService: DateService
  ) {
    this.templateForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      categoryId: [''],
      isDefault: [false],
      structure: [''],
    });
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadCategories();
  }

  loadTemplates(): void {
    this.loading = true;
    this.apiService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = templates;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe((categories) => {
      this.categories = categories;
      this.flatCategories = this.flattenCategories(categories);
    });
  }

  private flattenCategories(categories: Category[]): Category[] {
    const result: Category[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach((cat) => {
        result.push(cat);
        if (cat.children) {
          traverse(cat.children);
        }
      });
    };
    traverse(categories);
    return result;
  }

  showCreateModal(): void {
    this.isEditMode = false;
    this.editingId = '';
    this.templateForm.reset({ name: '', description: '', categoryId: '', isDefault: false, structure: '' });
    this.modalVisible = true;
  }

  showEditModal(tpl: DocumentTemplate): void {
    this.isEditMode = true;
    this.editingId = tpl.id;
    this.templateForm.patchValue({
      name: tpl.name,
      description: tpl.description || '',
      categoryId: tpl.categoryId || '',
      isDefault: tpl.isDefault,
      structure: tpl.structure || '',
    });
    this.modalVisible = true;
  }

  cancelModal(): void {
    this.modalVisible = false;
    this.templateForm.reset();
  }

  saveTemplate(): void {
    if (this.templateForm.invalid) {
      Object.values(this.templateForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity();
        }
      });
      return;
    }

    this.saving = true;
    const formValue = this.templateForm.value;

    if (this.isEditMode) {
      const request: TemplateUpdateRequest = {
        name: formValue.name,
        description: formValue.description || undefined,
        categoryId: formValue.categoryId || undefined,
        isDefault: formValue.isDefault,
        structure: formValue.structure || undefined,
      };
      this.apiService.updateTemplate(this.editingId, request).subscribe({
        next: () => {
          this.notificationService.success('模板更新成功');
          this.saving = false;
          this.modalVisible = false;
          this.loadTemplates();
        },
        error: () => {
          this.saving = false;
          this.notificationService.error('模板更新失败');
        },
      });
    } else {
      const request: TemplateCreateRequest = {
        name: formValue.name,
        description: formValue.description || undefined,
        categoryId: formValue.categoryId || undefined,
        isDefault: formValue.isDefault,
        structure: formValue.structure || undefined,
      };
      this.apiService.createTemplate(request).subscribe({
        next: () => {
          this.notificationService.success('模板创建成功');
          this.saving = false;
          this.modalVisible = false;
          this.loadTemplates();
        },
        error: () => {
          this.saving = false;
          this.notificationService.error('模板创建失败');
        },
      });
    }
  }

  deleteTemplate(id: string): void {
    this.apiService.deleteTemplate(id).subscribe({
      next: () => {
        this.notificationService.success('模板删除成功');
        this.loadTemplates();
      },
      error: () => {
        this.notificationService.error('模板删除失败');
      },
    });
  }
}
