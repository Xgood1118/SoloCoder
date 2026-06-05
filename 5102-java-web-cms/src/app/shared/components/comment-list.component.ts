import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { DateService } from '../../core/services/date.service';
import { Comment, CreateCommentRequest } from '../../core/models/comment.model';

@Component({
  selector: 'app-comment-list',
  template: `
    <div class="comment-list">
      <div class="comment-input" *ngIf="authService.isLoggedIn; else loginPrompt">
        <form [formGroup]="commentForm" (ngSubmit)="submitComment()">
          <nz-form-item>
            <nz-form-control>
              <textarea
                nz-input
                formControlName="content"
                rows="3"
                placeholder="发表评论..."
              ></textarea>
            </nz-form-control>
          </nz-form-item>
          <div class="comment-actions">
            <button
              nz-button
              nzType="primary"
              nzSize="small"
              [disabled]="!commentForm.valid || submitting"
            >
              <i *ngIf="submitting" nz-icon nzType="loading"></i>
              发表评论
            </button>
          </div>
        </form>
      </div>

      <ng-template #loginPrompt>
        <nz-alert
          nzType="info"
          nzMessage="请先登录后发表评论"
          style="margin-bottom: 16px;"
        ></nz-alert>
      </ng-template>

      <nz-list
        [nzDataSource]="comments"
        [nzRenderItem]="item"
        nzNoResult="暂无评论"
      >
        <ng-template #item let-comment>
          <nz-comment>
            <nz-comment-avatar>
              <nz-avatar
                [nzText]="comment.author?.realName?.[0] || 'U'"
              ></nz-avatar>
            </nz-comment-avatar>
            <nz-comment-content>
              <nz-comment-author>
                {{ comment.author?.realName || '匿名用户' }}
              </nz-comment-author>
              <nz-comment-datetime>
                {{ dateService.relativeTime(comment.createdAt) }}
              </nz-comment-datetime>
              <nz-comment-content>
                <p>{{ comment.content }}</p>
              </nz-comment-content>
              <nz-comment-action>
                <span (click)="likeComment(comment)">
                  <i nz-icon [nzType]="'like'" [nzTheme]="comment.isLiked ? 'fill' : 'outline'"></i>
                  {{ comment.likes }}
                </span>
                <span (click)="replyTo(comment)" *ngIf="authService.isLoggedIn">
                  <i nz-icon nzType="reply"></i>
                  回复
                </span>
                <span
                  (click)="deleteComment(comment)"
                  *ngIf="authService.canDeleteComment(comment.authorId)"
                >
                  <i nz-icon nzType="delete"></i>
                  删除
                </span>
              </nz-comment-action>
            </nz-comment-content>
          </nz-comment>
        </ng-template>
      </nz-list>

      <div class="reply-form" *ngIf="replyingTo">
        <nz-comment>
          <nz-comment-avatar>
            <nz-avatar
              [nzText]="authService.currentUser?.realName?.[0] || 'U'"
            ></nz-avatar>
          </nz-comment-avatar>
          <nz-comment-content>
            <textarea
              nz-input
              rows="2"
              [(ngModel)]="replyContent"
              placeholder="回复..."
            ></textarea>
            <div class="reply-actions">
              <button
                nz-button
                nzSize="small"
                (click)="cancelReply()"
              >
                取消
              </button>
              <button
                nz-button
                nzType="primary"
                nzSize="small"
                (click)="submitReply()"
                [disabled]="!replyContent.trim() || submitting"
              >
                回复
              </button>
            </div>
          </nz-comment-content>
        </nz-comment>
      </div>
    </div>
  `,
  styleUrls: ['./comment-list.component.scss'],
})
export class CommentListComponent implements OnInit {
  @Input() documentId!: string;
  @Output() commentsChange = new EventEmitter<Comment[]>();

  comments: Comment[] = [];
  commentForm: FormGroup;
  submitting = false;
  replyingTo: Comment | null = null;
  replyContent = '';

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    public authService: AuthService,
    public dateService: DateService,
    private notificationService: NotificationService
  ) {
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.maxLength(1000)]],
    });
  }

  ngOnInit(): void {
    this.loadComments();
  }

  loadComments(): void {
    this.apiService.getComments({ documentId: this.documentId }).subscribe({
      next: (response) => {
        this.comments = response.items;
        this.commentsChange.emit(this.comments);
      },
    });
  }

  submitComment(): void {
    if (this.commentForm.invalid || !this.authService.isLoggedIn) {
      return;
    }

    this.submitting = true;
    const request: CreateCommentRequest = {
      documentId: this.documentId,
      content: this.commentForm.value.content,
    };

    this.apiService.createComment(request).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.commentForm.reset();
        this.submitting = false;
        this.notificationService.success('评论发表成功');
        this.commentsChange.emit(this.comments);
      },
      error: () => {
        this.submitting = false;
      },
    });
  }

  likeComment(comment: Comment): void {
    if (!this.authService.isLoggedIn) {
      this.notificationService.warning('请先登录后点赞');
      return;
    }

    this.apiService.likeComment(comment.id).subscribe({
      next: (result) => {
        comment.likes = result.likes;
        comment.isLiked = true;
      },
    });
  }

  replyTo(comment: Comment): void {
    this.replyingTo = comment;
    this.replyContent = '';
  }

  cancelReply(): void {
    this.replyingTo = null;
    this.replyContent = '';
  }

  submitReply(): void {
    if (!this.replyContent.trim() || !this.replyingTo || !this.authService.isLoggedIn) {
      return;
    }

    this.submitting = true;
    const request: CreateCommentRequest = {
      documentId: this.documentId,
      content: this.replyContent,
      parentId: this.replyingTo.id,
    };

    this.apiService.createComment(request).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.cancelReply();
        this.submitting = false;
        this.notificationService.success('回复发表成功');
        this.commentsChange.emit(this.comments);
      },
      error: () => {
        this.submitting = false;
      },
    });
  }

  deleteComment(comment: Comment): void {
    this.notificationService.confirmDelete(() => {
      this.apiService.deleteComment(comment.id).subscribe({
        next: () => {
          this.comments = this.comments.filter((c) => c.id !== comment.id);
          this.notificationService.success('评论删除成功');
          this.commentsChange.emit(this.comments);
        },
      });
    }, '确定要删除该评论吗？');
  }
}
