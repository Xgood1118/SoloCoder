import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-key-value-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <div class="kv-container">
      @for (group of pairs.controls; track i; let i = $index) {
        <div class="kv-row" [formGroup]="$any(group)">
          <mat-form-field appearance="outline" class="kv-key">
            <mat-label>键</mat-label>
            <input matInput formControlName="key" placeholder="KEY">
          </mat-form-field>
          <span class="kv-equal">=</span>
          <mat-form-field appearance="outline" class="kv-value">
            <mat-label>值</mat-label>
            <input matInput formControlName="value" placeholder="value">
          </mat-form-field>
          <button mat-icon-button color="warn" (click)="removePair(i)" matTooltip="删除">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      <button mat-stroked-button (click)="addPair()">
        <mat-icon>add</mat-icon>
        添加参数
      </button>
    </div>
  `,
  styles: [`
    .kv-container { display: flex; flex-direction: column; gap: 8px; }
    .kv-row { display: flex; align-items: center; gap: 8px; }
    .kv-key { flex: 1; }
    .kv-value { flex: 1; }
    .kv-equal { color: #64748b; font-family: 'JetBrains Mono', monospace; margin-bottom: 22px; }
  `],
})
export class KeyValueInputComponent implements OnInit {
  @Input() initialPairs: Record<string, string> = {};
  @Output() valueChange = new EventEmitter<Record<string, string>>();

  private fb = inject(FormBuilder);
  pairs: FormArray = this.fb.array([]);

  ngOnInit(): void {
    Object.entries(this.initialPairs).forEach(([key, value]) => {
      this.pairs.push(this.fb.group({ key: [key], value: [value] }));
    });
    if (this.pairs.length === 0) {
      this.addPair();
    }
    this.pairs.valueChanges.subscribe(() => this.emitValue());
  }

  addPair(): void {
    this.pairs.push(this.fb.group({ key: [''], value: [''] }));
  }

  removePair(index: number): void {
    this.pairs.removeAt(index);
    this.emitValue();
  }

  emitValue(): void {
    const result: Record<string, string> = {};
    this.pairs.controls.forEach((group) => {
      const key = group.get('key')?.value?.trim();
      const value = group.get('value')?.value?.trim();
      if (key) {
        result[key] = value || '';
      }
    });
    this.valueChange.emit(result);
  }
}
