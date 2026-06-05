import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import {
  Document,
  DocumentStatus,
  DocumentAccess,
  CreateDocumentRequest,
  UpdateDocumentRequest,
} from '../core/models/document.model';
import { Category } from '../core/models/category.model';
import { Tag } from '../core/models/tag.model';
import { DocumentTemplate } from '../core/models/template.model';
import { ReviewRecord } from '../core/models/review.model';

@Component({
  selector: 'app-document-editor',
  template: `
    <div class="document-editor">
      <nz-page-header class="page-header" nzBackIcon (nzBack)="goBack()">
        <nz-page-header-title>
          {{ isEdit ? '编辑文档' : '新建文档' }}
        </nz-page-header-title>
        <nz-page-header-extra>
          <nz-tag *ngIf="document?.status === 'PENDING_REVIEW'" nzColor="blue">待审核</nz-tag>
          <nz-tag *ngIf="document?.status === 'REJECTED'" nzColor="red">已驳回</nz-tag>
          <nz-tag *ngIf="document?.status === 'PUBLISHED'" nzColor="green">已发布</nz-tag>
        </nz-page-header-extra>
      </nz-page-header>

      <nz-alert *ngIf="document?.status === 'REJECTED' && rejectionComment"
        nzType="error" nzMessage="文档被驳回" [nzDescription]="rejectionComment"
        nzCloseable nzShowIcon style="margin-bottom: 16px;">
      </nz-alert>

      <nz-card class="editor-card">
        <form [formGroup]="documentForm" class="editor-form">
          <nz-form-item *ngIf="!isEdit">
            <nz-form-label>选择模板</nz-form-label>
            <nz-form-control>
              <nz-select
                formControlName="templateId"
                nzPlaceHolder="选择模板快速填充（可选）"
                nzAllowClear
                (ngModelChange)="onTemplateChange($event)"
              >
                <nz-option-group nzLabel="默认模板">
                  <nz-option *ngFor="let t of defaultTemplates" [nzValue]="t.id" [nzLabel]="t.name"></nz-option>
                </nz-option-group>
                <nz-option-group *ngIf="categoryTemplates.length > 0" nzLabel="分类模板">
                  <nz-option *ngFor="let t of categoryTemplates" [nzValue]="t.id" [nzLabel]="t.name"></nz-option>
                </nz-option-group>
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired>标题</nz-form-label>
            <nz-form-control nzErrorTip="请输入文档标题">
              <input type="text" nz-input formControlName="title" placeholder="请输入文档标题" />
            </nz-form-control>
          </nz-form-item>

          <div class="form-row">
            <nz-form-item class="form-item-half">
              <nz-form-label nzRequired>分类</nz-form-label>
              <nz-form-control nzErrorTip="请选择分类">
                <nz-select formControlName="categoryId" nzPlaceHolder="请选择分类" (ngModelChange)="onCategoryChange($event)">
                  <nz-option *ngFor="let cat of flatCategories" [nzValue]="cat.id" [nzLabel]="cat.name"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item class="form-item-half">
              <nz-form-label nzRequired>标签</nz-form-label>
              <nz-form-control>
                <nz-select
                  formControlName="tagIds"
                  nzMode="tags"
                  nzPlaceHolder="选择或输入标签"
                  [nzMaxTagCount]="5"
                  (nzOnSearch)="onTagSearch($event)"
                  (ngModelChange)="onTagChange($event)"
                >
                  <nz-option *ngFor="let tag of availableTags" [nzValue]="tag.id" [nzLabel]="tag.name"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="form-row">
            <nz-form-item class="form-item-half">
              <nz-form-label nzRequired>访问权限</nz-form-label>
              <nz-form-control nzErrorTip="请选择访问权限">
                <nz-select formControlName="accessLevel" nzPlaceHolder="请选择访问权限">
                  <nz-option nzValue="PUBLIC" nzLabel="公开 - 所有人可见"></nz-option>
                  <nz-option nzValue="INTERNAL" nzLabel="内部 - 登录用户可见"></nz-option>
                  <nz-option nzValue="PRIVATE" nzLabel="私有 - 仅作者和管理员可见"></nz-option>
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item class="form-item-half">
              <nz-form-label>允许评论</nz-form-label>
              <nz-form-control>
                <nz-switch formControlName="allowComments" nzCheckedChildren="开" nzUnCheckedChildren="关"></nz-switch>
              </nz-form-control>
            </nz-form-item>
          </div>

          <nz-form-item>
            <nz-form-label nzRequired>正文</nz-form-label>
            <nz-form-control nzErrorTip="请输入文档正文">
              <div class="rich-editor">
                <div class="editor-toolbar">
                  <button type="button" nz-button nzSize="small" (click)="execCmd('bold')" title="加粗"><b>B</b></button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('italic')" title="斜体"><i>I</i></button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('underline')" title="下划线"><u>U</u></button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('strikeThrough')" title="删除线"><s>S</s></button>
                  <nz-divider nzType="vertical"></nz-divider>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('formatBlock', '<h1>')" title="标题1">H1</button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('formatBlock', '<h2>')" title="标题2">H2</button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('formatBlock', '<p>')" title="正文">P</button>
                  <nz-divider nzType="vertical"></nz-divider>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('insertUnorderedList')" title="无序列表">•列表</button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('insertOrderedList')" title="有序列表">1.列表</button>
                  <nz-divider nzType="vertical"></nz-divider>
                  <button type="button" nz-button nzSize="small" (click)="insertLink()" title="插入链接">🔗链接</button>
                  <button type="button" nz-button nzSize="small" (click)="insertImage()" title="插入图片">🖼图片</button>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('insertHorizontalRule')" title="分隔线">——</button>
                  <nz-divider nzType="vertical"></nz-divider>
                  <button type="button" nz-button nzSize="small" (click)="execCmd('removeFormat')" title="清除格式">清除</button>
                </div>
                <div class="editor-body" contenteditable="true"
                     [innerHTML]="richContent"
                     (input)="onEditorInput($event)"
                     (blur)="onEditorBlur()">
                </div>
              </div>
              <input type="hidden" formControlName="content">
            </nz-form-control>
          </nz-form-item>

          <div class="form-actions">
            <button nz-button (click)="goBack()">取消</button>
            <button nz-button nzType="default" (click)="saveDraft()" [disabled]="saving">
              <i *ngIf="saving" nz-icon nzType="loading"></i>
              保存草稿
            </button>
            <button
              *ngIf="isEdit && (document?.status === 'DRAFT' || document?.status === 'REJECTED')"
              nz-button
              nzType="warning"
              (click)="submitForReview()"
              [disabled]="saving || !documentForm.valid"
            >
              <i nz-icon nzType="audit"></i>
              提交审核
            </button>
            <button
              *ngIf="isEdit && document?.status === 'REJECTED'"
              nz-button
              nzType="primary"
              (click)="saveAndResubmit()"
              [disabled]="saving || !documentForm.valid"
            >
              <i *ngIf="saving" nz-icon nzType="loading"></i>
              修改并重新提交
            </button>
            <button
              *ngIf="!isEdit"
              nz-button
              nzType="primary"
              (click)="saveDocument()"
              [disabled]="saving || !documentForm.valid"
            >
              <i *ngIf="saving" nz-icon nzType="loading"></i>
              创建文档
            </button>
          </div>
        </form>
      </nz-card>

      <nz-card *ngIf="isEdit && reviewHistory.length > 0" class="review-history-card" nzTitle="审核记录">
        <nz-timeline>
          <nz-timeline-item *ngFor="let record of reviewHistory" [nzColor]="getReviewStatusColor(record.status)">
            <div class="review-record">
              <span class="review-level">第{{ record.level }}级审核</span>
              <nz-tag [nzColor]="getReviewStatusColor(record.status)">{{ getReviewStatusText(record.status) }}</nz-tag>
              <span class="review-reviewer">{{ record.reviewerName || '审核人' }}</span>
              <span class="review-time">{{ record.reviewedAt ? (record.reviewedAt | date:'yyyy-MM-dd HH:mm') : '待审核' }}</span>
              <div *ngIf="record.comment" class="review-comment">{{ record.comment }}</div>
            </div>
          </nz-timeline-item>
        </nz-timeline>
      </nz-card>
    </div>
  `,
  styleUrls: ['./document-editor.component.scss'],
})
export class DocumentEditorComponent implements OnInit {
  isEdit = false;
  documentId: string | null = null;
  document: Document | null = null;
  saving = false;
  rejectionComment = '';
  richContent = '';

  documentForm: FormGroup;
  categories: Category[] = [];
  flatCategories: Category[] = [];
  availableTags: Tag[] = [];
  allTags: Tag[] = [];
  templates: DocumentTemplate[] = [];
  defaultTemplates: DocumentTemplate[] = [];
  categoryTemplates: DocumentTemplate[] = [];
  reviewHistory: ReviewRecord[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {
    this.documentForm = this.fb.group({
      title: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      tagIds: [[]],
      accessLevel: ['PUBLIC', [Validators.required]],
      allowComments: [true],
      content: ['', [Validators.required]],
      templateId: [null],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadTags();
    this.loadTemplates();

    this.route.params.subscribe((params) => {
      this.documentId = params['id'];
      this.isEdit = !!(this.documentId && this.documentId !== 'new');

      if (this.isEdit && this.documentId) {
        this.loadDocument(this.documentId);
      }
    });
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe((categories) => {
      this.categories = categories;
      this.flatCategories = this.flattenCategories(categories);
    });
  }

  loadTags(): void {
    this.apiService.getAllTags().subscribe((tags) => {
      this.allTags = tags;
      this.availableTags = tags;
    });
  }

  loadTemplates(): void {
    this.apiService.getTemplates().subscribe((templates) => {
      this.templates = templates;
      this.defaultTemplates = templates.filter((t) => t.isDefault);
    });
  }

  loadCategoryTemplates(categoryId: string): void {
    this.apiService.getTemplatesByCategory(categoryId).subscribe((templates) => {
      this.categoryTemplates = templates.filter((t) => !t.isDefault);
    });
  }

  loadReviewHistory(documentId: string): void {
    this.apiService.getReviewHistory(documentId).subscribe((records) => {
      this.reviewHistory = records;
      const lastRejected = records.find((r) => r.status === 'REJECTED');
      if (lastRejected) {
        this.rejectionComment = lastRejected.comment || '';
      }
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

  loadDocument(id: string): void {
    this.apiService.getDocument(id).subscribe({
      next: (doc) => {
        this.document = doc;
        this.documentForm.patchValue({
          title: doc.title,
          categoryId: doc.categoryId,
          tagIds: doc.tags ? doc.tags.map((t) => t.id) : [],
          accessLevel: doc.accessLevel,
          allowComments: doc.allowComments !== false,
          content: doc.content,
        });
        this.richContent = doc.content;
        if (doc.categoryId) {
          this.loadCategoryTemplates(doc.categoryId);
        }
        this.loadReviewHistory(id);
      },
    });
  }

  onCategoryChange(categoryId: string): void {
    if (categoryId) {
      this.loadCategoryTemplates(categoryId);
    } else {
      this.categoryTemplates = [];
    }
  }

  onTemplateChange(templateId: string): void {
    if (!templateId) return;
    const template = this.templates.find((t) => t.id === templateId);
    if (template) {
      try {
        const structure = JSON.parse(template.structure || '{}');
        if (structure.title && !this.documentForm.get('title')?.value) {
          this.documentForm.patchValue({ title: structure.title });
        }
        if (structure.content) {
          this.documentForm.patchValue({ content: structure.content });
          this.richContent = structure.content;
        }
        this.notificationService.success('模板已应用');
      } catch {
        const fallback = template.structure || '';
        this.documentForm.patchValue({ content: fallback });
        this.richContent = fallback;
      }
    }
  }

  execCmd(command: string, value?: string): void {
    document.execCommand(command, false, value || undefined);
  }

  insertLink(): void {
    const url = prompt('请输入链接地址:');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }

  insertImage(): void {
    const url = prompt('请输入图片地址:');
    if (url) {
      document.execCommand('insertImage', false, url);
    }
  }

  onEditorInput(event: Event): void {
    const html = (event.target as HTMLElement).innerHTML;
    this.richContent = html;
    this.documentForm.patchValue({ content: html }, { emitEvent: false });
  }

  onEditorBlur(): void {
    const editorEl = document.querySelector('.editor-body') as HTMLElement;
    if (editorEl) {
      this.richContent = editorEl.innerHTML;
      this.documentForm.patchValue({ content: this.richContent }, { emitEvent: false });
    }
  }

  onTagSearch(keyword: string): void {
    if (!keyword) {
      this.availableTags = this.allTags;
      return;
    }
    this.availableTags = this.allTags.filter((t) =>
      t.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  onTagChange(tagIds: string[]): void {
    const existingIds = this.allTags.map((t) => t.id);
    const newTags = tagIds.filter((id) => !existingIds.includes(id));

    newTags.forEach((name) => {
      this.apiService.createTag(name).subscribe({
        next: (tag) => {
          this.allTags.push(tag);
          const currentIds = this.documentForm.get('tagIds')?.value as string[];
          const index = currentIds.indexOf(name);
          if (index > -1) {
            currentIds[index] = tag.id;
            this.documentForm.patchValue({ tagIds: currentIds }, { emitEvent: false });
          }
        },
      });
    });
  }

  saveDraft(): void {
    const formValue = this.documentForm.value;
    const request = {
      ...formValue,
      status: 'DRAFT' as DocumentStatus,
    };
    delete request.templateId;
    this.save(request);
  }

  saveDocument(): void {
    if (this.documentForm.invalid) {
      return;
    }
    const formValue = this.documentForm.value;
    delete formValue.templateId;
    this.save(formValue);
  }

  submitForReview(): void {
    if (!this.documentId) return;
    this.notificationService.confirm('确认提交审核', '确认提交审核？提交后将由审核人员审核。', () => {
      this.apiService.submitForReview(this.documentId!).subscribe({
        next: () => {
          this.notificationService.success('已提交审核');
          this.router.navigate(['/reviews']);
        },
        error: (err) => {
          this.notificationService.error(err?.message || '提交审核失败');
        },
      });
    });
  }

  saveAndResubmit(): void {
    if (this.documentForm.invalid || !this.documentId) return;
    this.saving = true;
    const formValue = this.documentForm.value;
    delete formValue.templateId;

    this.apiService.updateDocument(this.documentId, formValue as UpdateDocumentRequest).subscribe({
      next: () => {
        this.apiService.resubmitForReview(this.documentId!).subscribe({
          next: () => {
            this.notificationService.success('已修改并重新提交审核');
            this.saving = false;
            this.router.navigate(['/reviews']);
          },
          error: (err) => {
            this.notificationService.error(err?.message || '重新提交失败');
            this.saving = false;
          },
        });
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  private save(formValue: CreateDocumentRequest | UpdateDocumentRequest): void {
    this.saving = true;

    if (this.isEdit && this.documentId) {
      this.apiService.updateDocument(this.documentId, formValue as UpdateDocumentRequest).subscribe({
        next: () => {
          this.notificationService.success('文档保存成功');
          this.saving = false;
          this.router.navigate(['/documents', this.documentId]);
        },
        error: () => {
          this.saving = false;
        },
      });
    } else {
      this.apiService.createDocument(formValue as CreateDocumentRequest).subscribe({
        next: (doc) => {
          this.notificationService.success('文档创建成功');
          this.saving = false;
          this.router.navigate(['/documents', doc.id]);
        },
        error: () => {
          this.saving = false;
        },
      });
    }
  }

  getReviewStatusColor(status: string): string {
    switch (status) {
      case 'PENDING': return 'blue';
      case 'APPROVED': return 'green';
      case 'REJECTED': return 'red';
      default: return 'gray';
    }
  }

  getReviewStatusText(status: string): string {
    switch (status) {
      case 'PENDING': return '待审核';
      case 'APPROVED': return '已通过';
      case 'REJECTED': return '已驳回';
      default: return status;
    }
  }

  goBack(): void {
    if (this.isEdit && this.documentId) {
      this.router.navigate(['/documents', this.documentId]);
    } else {
      this.router.navigate(['/documents']);
    }
  }
}
