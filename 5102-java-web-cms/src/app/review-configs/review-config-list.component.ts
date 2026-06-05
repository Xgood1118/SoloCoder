import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { ReviewConfig, ReviewConfigCreateRequest, ReviewConfigUpdateRequest } from '../core/models/review.model';
import { Category } from '../core/models/category.model';

@Component({
  selector: 'app-review-config-list',
  template: `
    <div class="review-config-list">
      <nz-page-header nzTitle="审核配置" class="page-header">
        <nz-page-header-extra>
          <button nz-button nzType="primary" (click)="showCreateModal()">
            <i nz-icon nzType="plus"></i>
            新建配置
          </button>
        </nz-page-header-extra>
      </nz-page-header>

      <nz-card>
        <nz-table
          #configTable
          [nzData]="configs"
          [nzLoading]="loading"
          nzShowPagination="false"
        >
          <thead>
            <tr>
              <th>分类名称</th>
              <th nzWidth="100px">审核级别</th>
              <th nzWidth="120px">一级审核角色</th>
              <th nzWidth="120px">二级审核角色</th>
              <th nzWidth="80px">是否启用</th>
              <th nzWidth="150px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let config of configTable.data">
              <td>{{ config.categoryName || '-' }}</td>
              <td>
                <nz-tag [nzColor]="config.reviewLevel === 2 ? 'orange' : 'blue'" nzSize="small">
                  {{ config.reviewLevel === 2 ? '二级审核' : '一级审核' }}
                </nz-tag>
              </td>
              <td>{{ getRoleName(config.levelOneRole) }}</td>
              <td>{{ config.reviewLevel === 2 ? getRoleName(config.levelTwoRole) : '-' }}</td>
              <td>
                <nz-tag [nzColor]="config.enabled ? 'green' : 'red'" nzSize="small">
                  {{ config.enabled ? '启用' : '停用' }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzType="link" nzSize="small" (click)="showEditModal(config)">
                  编辑
                </button>
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  nzDanger
                  nz-popconfirm
                  nzPopconfirmTitle="确定删除该配置吗？"
                  (nzOnConfirm)="deleteConfig(config.id)"
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
        [nzTitle]="isEditMode ? '编辑配置' : '新建配置'"
        (nzOnCancel)="cancelModal()"
        (nzOnOk)="saveConfig()"
        [nzOkLoading]="saving"
      >
        <form [formGroup]="configForm">
          <nz-form-item>
            <nz-form-label nzRequired>分类</nz-form-label>
            <nz-form-control nzErrorTip="请选择分类">
              <nz-select
                formControlName="categoryId"
                nzPlaceHolder="选择分类"
              >
                <nz-option *ngFor="let cat of flatCategories" [nzValue]="cat.id" [nzLabel]="cat.name"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>审核级别</nz-form-label>
            <nz-form-control>
              <nz-radio-group formControlName="reviewLevel">
                <label nz-radio-button [nzValue]="1">一级审核</label>
                <label nz-radio-button [nzValue]="2">二级审核</label>
              </nz-radio-group>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>一级审核角色</nz-form-label>
            <nz-form-control nzErrorTip="请选择一级审核角色">
              <nz-select formControlName="levelOneRole" nzPlaceHolder="选择一级审核角色">
                <nz-option nzValue="ADMIN" nzLabel="管理员"></nz-option>
                <nz-option nzValue="CONTRIBUTOR" nzLabel="编辑"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item *ngIf="configForm.get('reviewLevel')?.value === 2">
            <nz-form-label nzRequired>二级审核角色</nz-form-label>
            <nz-form-control nzErrorTip="请选择二级审核角色">
              <nz-select formControlName="levelTwoRole" nzPlaceHolder="选择二级审核角色">
                <nz-option nzValue="ADMIN" nzLabel="管理员"></nz-option>
                <nz-option nzValue="CONTRIBUTOR" nzLabel="编辑"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>是否启用</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="enabled"></nz-switch>
            </nz-form-control>
          </nz-form-item>
        </form>
      </nz-modal>
    </div>
  `,
  styleUrls: ['./review-config-list.component.scss'],
})
export class ReviewConfigListComponent implements OnInit {
  configs: ReviewConfig[] = [];
  loading = false;
  modalVisible = false;
  isEditMode = false;
  saving = false;
  editingId = '';
  categories: Category[] = [];
  flatCategories: Category[] = [];
  configForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService,
    public dateService: DateService
  ) {
    this.configForm = this.fb.group({
      categoryId: ['', [Validators.required]],
      reviewLevel: [1, [Validators.required]],
      levelOneRole: ['', [Validators.required]],
      levelTwoRole: [''],
      enabled: [true],
    });
  }

  ngOnInit(): void {
    this.loadConfigs();
    this.loadCategories();
  }

  loadConfigs(): void {
    this.loading = true;
    this.apiService.getReviewConfigs().subscribe({
      next: (configs) => {
        this.configs = configs;
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

  getRoleName(role: string): string {
    const names: Record<string, string> = {
      ADMIN: '管理员',
      CONTRIBUTOR: '编辑',
      READER: '读者',
    };
    return names[role] || role;
  }

  showCreateModal(): void {
    this.isEditMode = false;
    this.editingId = '';
    this.configForm.reset({ categoryId: '', reviewLevel: 1, levelOneRole: '', levelTwoRole: '', enabled: true });
    this.modalVisible = true;
  }

  showEditModal(config: ReviewConfig): void {
    this.isEditMode = true;
    this.editingId = config.id;
    this.configForm.patchValue({
      categoryId: config.categoryId,
      reviewLevel: config.reviewLevel,
      levelOneRole: config.levelOneRole,
      levelTwoRole: config.levelTwoRole || '',
      enabled: config.enabled,
    });
    this.modalVisible = true;
  }

  cancelModal(): void {
    this.modalVisible = false;
    this.configForm.reset();
  }

  saveConfig(): void {
    if (this.configForm.invalid) {
      Object.values(this.configForm.controls).forEach((control) => {
        if (control.invalid) {
          control.markAsDirty();
          control.updateValueAndValidity();
        }
      });
      return;
    }

    this.saving = true;
    const formValue = this.configForm.value;

    if (this.isEditMode) {
      const request: ReviewConfigUpdateRequest = {
        categoryId: formValue.categoryId,
        reviewLevel: formValue.reviewLevel,
        levelOneRole: formValue.levelOneRole,
        levelTwoRole: formValue.reviewLevel === 2 ? formValue.levelTwoRole : undefined,
        enabled: formValue.enabled,
      };
      this.apiService.updateReviewConfig(this.editingId, request).subscribe({
        next: () => {
          this.notificationService.success('配置更新成功');
          this.saving = false;
          this.modalVisible = false;
          this.loadConfigs();
        },
        error: () => {
          this.saving = false;
          this.notificationService.error('配置更新失败');
        },
      });
    } else {
      const request: ReviewConfigCreateRequest = {
        categoryId: formValue.categoryId,
        reviewLevel: formValue.reviewLevel,
        levelOneRole: formValue.levelOneRole,
        levelTwoRole: formValue.reviewLevel === 2 ? formValue.levelTwoRole : undefined,
        enabled: formValue.enabled,
      };
      this.apiService.createReviewConfig(request).subscribe({
        next: () => {
          this.notificationService.success('配置创建成功');
          this.saving = false;
          this.modalVisible = false;
          this.loadConfigs();
        },
        error: () => {
          this.saving = false;
          this.notificationService.error('配置创建失败');
        },
      });
    }
  }

  deleteConfig(id: string): void {
    this.apiService.deleteReviewConfig(id).subscribe({
      next: () => {
        this.notificationService.success('配置删除成功');
        this.loadConfigs();
      },
      error: () => {
        this.notificationService.error('配置删除失败');
      },
    });
  }
}
