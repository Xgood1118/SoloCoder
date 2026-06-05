import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NzTreeNodeOptions, NzFormatEmitEvent } from 'ng-zorro-antd/tree';
import { ApiService } from '../core/services/api.service';
import { NotificationService } from '../core/services/notification.service';
import { DateService } from '../core/services/date.service';
import { Category, CreateCategoryRequest } from '../core/models/category.model';

@Component({
  selector: 'app-category-management',
  template: `
    <div class="category-management">
      <div class="page-header">
        <h2>分类管理</h2>
        <button nz-button nzType="primary" (click)="showAddModal()">
          <i nz-icon nzType="plus"></i>
          新建分类
        </button>
      </div>

      <nz-card>
        <div class="category-content">
          <div class="category-tree-section">
            <h3>分类树</h3>
            <nz-tree
              [nzData]="treeNodes"
              [nzExpandedKeys]="expandedKeys"
              [nzSelectedKeys]="selectedKeys"
              (nzClick)="onNodeClick($event)"
            ></nz-tree>
          </div>
          <div class="category-detail-section" *ngIf="selectedCategory">
            <h3>分类详情</h3>
            <div class="detail-item">
              <label>分类名称:</label>
              <span>{{ selectedCategory.name }}</span>
            </div>
            <div class="detail-item">
              <label>层级:</label>
              <span>第 {{ selectedCategory.level }} 级</span>
            </div>
            <div class="detail-item">
              <label>文档数量:</label>
              <span>{{ selectedCategory.documentCount }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间:</label>
              <span>{{ dateService.formatDateTime(selectedCategory.createdAt) }}</span>
            </div>
            <div class="detail-actions">
              <button nz-button (click)="showEditModal()">编辑</button>
              <button nz-button nzDanger (click)="deleteCategory()">删除</button>
              <button nz-button (click)="showMoveModal()">移动</button>
            </div>
          </div>
          <div class="category-detail-section empty-state" *ngIf="!selectedCategory">
            <nz-empty nzDescription="请选择一个分类查看详情"></nz-empty>
          </div>
        </div>
      </nz-card>
    </div>

    <nz-modal
      [(nzVisible)]="isModalVisible"
      [nzTitle]="isEditMode ? '编辑分类' : '新建分类'"
      (nzOnCancel)="cancelModal()"
      (nzOnOk)="saveCategory()"
      [nzOkLoading]="saving"
    >
      <form [formGroup]="categoryForm">
        <nz-form-item>
          <nz-form-label nzRequired>分类名称</nz-form-label>
          <nz-form-control nzErrorTip="请输入分类名称">
            <input type="text" nz-input formControlName="name" placeholder="请输入分类名称" />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item *ngIf="!isEditMode">
          <nz-form-label>父分类</nz-form-label>
          <nz-form-control>
            <nz-tree-select
              formControlName="parentId"
              nzPlaceHolder="选择父分类（不选则为根分类）"
              nzAllowClear
              [nzNodes]="treeNodes"
              [nzDefaultExpandAll]="true"
            ></nz-tree-select>
          </nz-form-control>
        </nz-form-item>
      </form>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="isMoveModalVisible"
      nzTitle="移动分类"
      (nzOnCancel)="cancelMoveModal()"
      (nzOnOk)="moveCategory()"
      [nzOkLoading]="moving"
    >
      <nz-form-item>
        <nz-form-label nzRequired>目标父分类</nz-form-label>
        <nz-form-control nzErrorTip="请选择目标分类">
          <nz-tree-select
            [(ngModel)]="moveTargetId"
            nzPlaceHolder="选择目标父分类"
            nzAllowClear
            [nzNodes]="treeNodes"
            [nzDefaultExpandAll]="true"
          ></nz-tree-select>
        </nz-form-control>
      </nz-form-item>
      <nz-alert
        *ngIf="selectedCategory?.documentCount"
        nzType="warning"
        [nzMessage]="'该分类下有 ' + selectedCategory.documentCount + ' 个文档，移动后文档将随分类一起移动'"
        style="margin-top: 16px;"
      ></nz-alert>
    </nz-modal>
  `,
  styleUrls: ['./category-management.component.scss'],
})
export class CategoryManagementComponent implements OnInit {
  categories: Category[] = [];
  treeNodes: NzTreeNodeOptions[] = [];
  expandedKeys: string[] = [];
  selectedKeys: string[] = [];
  selectedCategory: Category | null = null;

  isModalVisible = false;
  isEditMode = false;
  saving = false;
  categoryForm: FormGroup;

  isMoveModalVisible = false;
  moving = false;
  moveTargetId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private notificationService: NotificationService,
    public dateService: DateService
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required]],
      parentId: [null],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe((categories) => {
      this.categories = categories;
      this.treeNodes = this.buildTree(categories);
      this.expandedKeys = this.getAllNodeKeys(categories);
    });
  }

  private buildTree(categories: Category[]): NzTreeNodeOptions[] {
    return categories.map((cat) => ({
      key: cat.id,
      title: `${cat.name} (${cat.documentCount})`,
      children: cat.children ? this.buildTree(cat.children) : undefined,
      isLeaf: !cat.children || cat.children.length === 0,
    }));
  }

  private getAllNodeKeys(categories: Category[]): string[] {
    const keys: string[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach((cat) => {
        if (cat.children && cat.children.length > 0) {
          keys.push(cat.id);
          traverse(cat.children);
        }
      });
    };
    traverse(categories);
    return keys;
  }

  private findCategory(categories: Category[], id: string): Category | null {
    for (const cat of categories) {
      if (cat.id === id) return cat;
      if (cat.children) {
        const found = this.findCategory(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  onNodeClick(event: NzFormatEmitEvent): void {
    if (event.node) {
      this.selectedKeys = [event.node.key];
      this.selectedCategory = this.findCategory(this.categories, event.node.key);
    }
  }

  showAddModal(): void {
    this.isEditMode = false;
    this.categoryForm.reset({ name: '', parentId: null });
    this.isModalVisible = true;
  }

  showEditModal(): void {
    if (!this.selectedCategory) return;
    this.isEditMode = true;
    this.categoryForm.patchValue({
      name: this.selectedCategory.name,
    });
    this.isModalVisible = true;
  }

  cancelModal(): void {
    this.isModalVisible = false;
    this.categoryForm.reset();
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;
    this.saving = true;

    const formValue = this.categoryForm.value;

    if (this.isEditMode && this.selectedCategory) {
      this.apiService.updateCategory(this.selectedCategory.id, { name: formValue.name }).subscribe({
        next: () => {
          this.notificationService.success('分类更新成功');
          this.saving = false;
          this.isModalVisible = false;
          this.loadCategories();
        },
        error: () => {
          this.saving = false;
        },
      });
    } else {
      const request: CreateCategoryRequest = {
        name: formValue.name,
        parentId: formValue.parentId || null,
      };
      this.apiService.createCategory(request).subscribe({
        next: () => {
          this.notificationService.success('分类创建成功');
          this.saving = false;
          this.isModalVisible = false;
          this.loadCategories();
        },
        error: () => {
          this.saving = false;
        },
      });
    }
  }

  deleteCategory(): void {
    if (!this.selectedCategory) return;

    const hasDocuments = this.selectedCategory.documentCount > 0;
    const message = hasDocuments
      ? `该分类下有 ${this.selectedCategory.documentCount} 个文档，删除后文档将移至根分类，确认删除？`
      : '确定要删除该分类吗？';

    this.notificationService.confirmDelete(() => {
      this.apiService.deleteCategory(this.selectedCategory!.id, true).subscribe({
        next: () => {
          this.notificationService.success('分类删除成功');
          this.selectedCategory = null;
          this.selectedKeys = [];
          this.loadCategories();
        },
      });
    }, message);
  }

  showMoveModal(): void {
    if (!this.selectedCategory) return;
    this.moveTargetId = null;
    this.isMoveModalVisible = true;
  }

  cancelMoveModal(): void {
    this.isMoveModalVisible = false;
    this.moveTargetId = null;
  }

  moveCategory(): void {
    if (!this.selectedCategory) return;
    this.moving = true;

    this.apiService
      .updateCategory(this.selectedCategory.id, { parentId: this.moveTargetId })
      .subscribe({
        next: () => {
          this.notificationService.success('分类移动成功');
          this.moving = false;
          this.isMoveModalVisible = false;
          this.loadCategories();
        },
        error: () => {
          this.moving = false;
        },
      });
  }
}
