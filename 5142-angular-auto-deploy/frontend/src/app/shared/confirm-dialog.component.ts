import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
      @if (data.requireInput) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ data.inputLabel || '请输入' }}</mat-label>
          <textarea matInput
                    [(ngModel)]="inputValue"
                    [placeholder]="data.inputPlaceholder || ''"
                    rows="3">
          </textarea>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ data.cancelText || '取消' }}
      </button>
      <button mat-raised-button
              color="primary"
              [disabled]="data.requireInput && !inputValue.trim()"
              (click)="onConfirm()">
        {{ data.confirmText || '确认' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-top: 16px; }
    mat-dialog-content p { color: #94a3b8; margin-bottom: 8px; }
  `],
})
export class ConfirmDialogComponent {
  data: ConfirmDialogData = {
    title: '确认',
    message: '确定要执行此操作吗？',
  };
  inputValue = '';

  private dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  onConfirm(): void {
    if (this.data.requireInput) {
      this.dialogRef.close(this.inputValue);
    } else {
      this.dialogRef.close(true);
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
