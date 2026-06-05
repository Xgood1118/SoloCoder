import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
  SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Subject,
  BehaviorSubject,
  Observable,
  of
} from 'rxjs';
import {
  takeUntil,
  take,
  tap,
  catchError
} from 'rxjs/operators';
import {
  WidgetConfig,
  ChartType,
  WidgetRole,
  TriggerEventType,
  WIDGET_COLORS,
  DEFAULT_BUFFER_SIZE
} from '../../../types/dashboard.types';
import { DataStreamService } from '../../../core/services/data-stream.service';
import { LayoutPersistenceService } from '../../../core/services/layout-persistence.service';
import { LinkageEventBusService } from '../../../core/services/linkage-event-bus.service';

@Component({
  selector: 'app-widget-config',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="config-overlay" (click)="onBackdropClick($event)">
      <div class="config-panel" (click)="$event.stopPropagation()">
        <div class="config-header">
          <h2>图表配置</h2>
          <button class="close-btn" (click)="onClose()">✕</button>
        </div>

        <form *ngIf="configForm" [formGroup]="configForm" class="config-content">
          <div class="form-section">
            <h3>基本设置</h3>
            <div class="form-row">
              <label>图表标题</label>
              <input type="text" formControlName="title" placeholder="输入图表标题" />
            </div>
            <div class="form-row">
              <label>数据流</label>
              <select formControlName="dataStream">
                <option *ngFor="let stream of availableStreams$ | async" [value]="stream.id">
                  {{ stream.name }} - {{ stream.description }}
                </option>
              </select>
            </div>
            <div class="form-row">
              <label>图表类型</label>
              <div class="chart-type-options">
                <label *ngFor="let type of chartTypes" class="chart-type-option">
                  <input type="radio" [value]="type.value" formControlName="chartType" />
                  <span class="type-icon">{{ type.icon }}</span>
                  <span class="type-label">{{ type.label }}</span>
                </label>
              </div>
            </div>
            <div class="form-row">
              <label>主题颜色</label>
              <div class="color-options">
                <button
                  *ngFor="let color of colors"
                  type="button"
                  class="color-option"
                  [class.selected]="configForm.get('color')?.value === color"
                  [style.background]="color"
                  (click)="selectColor(color)"
                ></button>
              </div>
            </div>
            <div class="form-row">
              <label>数据缓冲大小</label>
              <input type="number" formControlName="bufferSize" min="10" max="1000" />
              <span class="hint">保存的历史数据点数量</span>
            </div>
          </div>

          <div class="form-section">
            <h3>联动设置</h3>
            <div class="form-row">
              <label>角色</label>
              <div class="role-options">
                <label class="role-option">
                  <input type="radio" value="independent" formControlName="role" />
                  <span class="role-label">独立</span>
                  <span class="role-desc">不参与联动</span>
                </label>
                <label class="role-option">
                  <input type="radio" value="master" formControlName="role" />
                  <span class="role-label master">主控</span>
                  <span class="role-desc">发送联动事件</span>
                </label>
                <label class="role-option">
                  <input type="radio" value="slave" formControlName="role" />
                  <span class="role-label slave">被动</span>
                  <span class="role-desc">接收联动事件</span>
                </label>
              </div>
            </div>

            <ng-container *ngIf="configForm.get('role')?.value === 'master'">
              <div class="form-row">
                <label>触发方式</label>
                <select formControlName="triggerEvent">
                  <option value="click">点击数据点</option>
                  <option value="hover">悬停数据点</option>
                </select>
              </div>
              <div class="form-row">
                <label>联动目标</label>
                <div class="target-options">
                  <label *ngFor="let widget of otherWidgets$ | async" class="target-option">
                    <input
                      type="checkbox"
                      [value]="widget.id"
                      [checked]="isTargetSelected(widget.id)"
                      (change)="toggleTarget(widget.id, $event)"
                    />
                    <span class="target-name">{{ widget.title }}</span>
                  </label>
                  <div *ngIf="(otherWidgets$ | async)?.length === 0" class="no-targets">
                    暂无其他图表可联动
                  </div>
                </div>
              </div>
            </ng-container>
          </div>

          <div class="form-section">
            <h3>位置和大小</h3>
            <div class="form-row grid-row">
              <div class="grid-item">
                <label>X 位置</label>
                <input type="number" formControlName="posX" min="0" />
              </div>
              <div class="grid-item">
                <label>Y 位置</label>
                <input type="number" formControlName="posY" min="0" />
              </div>
              <div class="grid-item">
                <label>宽度</label>
                <input type="number" formControlName="posCols" min="2" max="12" />
              </div>
              <div class="grid-item">
                <label>高度</label>
                <input type="number" formControlName="posRows" min="2" max="8" />
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" (click)="onClose()">取消</button>
            <button type="button" class="btn btn-primary" (click)="onSave()" [disabled]="!configForm.valid">
              保存配置
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .config-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .config-panel {
      background: linear-gradient(135deg, #1e1e30 0%, #16162a 100%);
      border-radius: 12px;
      border: 1px solid #2a2a4a;
      width: 90%;
      max-width: 700px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .config-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid #2a2a4a;
    }

    .config-header h2 {
      margin: 0;
      font-size: 18px;
      color: #e0e0e0;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #888;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(238, 102, 102, 0.2);
      color: #ee6666;
    }

    .config-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .form-section {
      margin-bottom: 24px;
    }

    .form-section h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #5470c6;
      font-weight: 600;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a2a4a;
    }

    .form-row {
      margin-bottom: 16px;
    }

    .form-row label {
      display: block;
      color: #aaa;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .form-row input[type="text"],
    .form-row input[type="number"],
    .form-row select {
      width: 100%;
      padding: 8px 12px;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 6px;
      color: #e0e0e0;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    .form-row input:focus,
    .form-row select:focus {
      outline: none;
      border-color: #5470c6;
    }

    .hint {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: #666;
    }

    .chart-type-options {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .chart-type-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .chart-type-option:hover {
      border-color: #5470c6;
    }

    .chart-type-option input {
      position: absolute;
      opacity: 0;
    }

    .chart-type-option:has(input:checked) {
      border-color: #5470c6;
      background: rgba(84, 112, 198, 0.1);
    }

    .type-icon {
      font-size: 24px;
      margin-bottom: 4px;
    }

    .type-label {
      font-size: 11px;
      color: #888;
    }

    .color-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .color-option {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid transparent;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .color-option:hover {
      transform: scale(1.1);
    }

    .color-option.selected {
      border-color: #fff;
      box-shadow: 0 0 0 2px #5470c6;
    }

    .role-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .role-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .role-option:hover {
      border-color: #5470c6;
    }

    .role-option input {
      position: absolute;
      opacity: 0;
    }

    .role-option:has(input:checked) {
      border-color: #5470c6;
      background: rgba(84, 112, 198, 0.1);
    }

    .role-label {
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
    }

    .role-label.master {
      color: #ee6666;
    }

    .role-label.slave {
      color: #91cc75;
    }

    .role-desc {
      font-size: 11px;
      color: #666;
    }

    .target-options {
      max-height: 150px;
      overflow-y: auto;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 6px;
      padding: 8px;
    }

    .target-option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .target-option:hover {
      background: rgba(84, 112, 198, 0.1);
    }

    .target-name {
      font-size: 13px;
      color: #aaa;
    }

    .no-targets {
      padding: 16px;
      text-align: center;
      color: #666;
      font-size: 13px;
    }

    .grid-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .grid-item {
      display: flex;
      flex-direction: column;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid #2a2a4a;
    }

    .btn {
      padding: 10px 24px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #2a2a4a;
      color: #aaa;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #3a3a5a;
      color: #e0e0e0;
    }

    .btn-primary {
      background: #5470c6;
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: #6680d3;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetConfigComponent implements OnInit, OnChanges, OnDestroy {
  @Input() widget!: WidgetConfig | null;
  @Input() allWidgets: WidgetConfig[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<WidgetConfig>();

  configForm!: FormGroup;
  availableStreams$!: Observable<Array<{ id: string; name: string; description: string }>>;
  otherWidgets$!: Observable<WidgetConfig[]>;

  readonly chartTypes: Array<{ value: ChartType; label: string; icon: string }> = [
    { value: 'line', label: '折线图', icon: '📈' },
    { value: 'bar', label: '柱状图', icon: '📊' },
    { value: 'pie', label: '饼图', icon: '🥧' },
    { value: 'gauge', label: '仪表盘', icon: '🎯' }
  ];

  readonly colors = WIDGET_COLORS;

  private readonly destroy$ = new Subject<void>();
  private readonly selectedTargets$ = new BehaviorSubject<string[]>([]);

  constructor(
    private readonly fb: FormBuilder,
    private readonly dataStreamService: DataStreamService,
    private readonly layoutPersistenceService: LayoutPersistenceService,
    private readonly linkageEventBus: LinkageEventBusService
  ) {}

  ngOnInit(): void {
    this.availableStreams$ = of(this.dataStreamService.getAvailableStreams());
    this.initializeForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['widget'] && this.widget) {
      this.initializeForm();
      this.selectedTargets$.next([...this.widget.linkage.targetWidgetIds]);
    }
    if (changes['allWidgets'] || changes['widget']) {
      this.otherWidgets$ = of(
        this.allWidgets.filter(w => w.id !== this.widget?.id)
      );
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isTargetSelected(widgetId: string): boolean {
    return this.selectedTargets$.value.includes(widgetId);
  }

  toggleTarget(widgetId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const currentTargets = this.selectedTargets$.value;

    if (checked) {
      this.selectedTargets$.next([...currentTargets, widgetId]);
    } else {
      this.selectedTargets$.next(currentTargets.filter(id => id !== widgetId));
    }
  }

  selectColor(color: string): void {
    this.configForm.get('color')?.setValue(color);
  }

  onSave(): void {
    if (!this.configForm.valid || !this.widget) return;

    const formValue = this.configForm.value;
    const updatedWidget: WidgetConfig = {
      ...this.widget,
      title: formValue.title,
      dataStream: formValue.dataStream,
      chartType: formValue.chartType,
      color: formValue.color,
      bufferSize: formValue.bufferSize,
      role: formValue.role as WidgetRole,
      position: {
        x: formValue.posX,
        y: formValue.posY,
        cols: formValue.posCols,
        rows: formValue.posRows
      },
      linkage: {
        triggerEvent: formValue.triggerEvent as TriggerEventType,
        targetWidgetIds: this.selectedTargets$.value
      }
    };

    this.layoutPersistenceService.updateWidget(updatedWidget.id, updatedWidget)
      .pipe(
        take(1),
        tap(() => {
          this.linkageEventBus.updateWidgetConfig(updatedWidget);
        }),
        catchError((error: unknown) => {
          console.error('Failed to save widget config:', error);
          return of(null);
        })
      )
      .subscribe(saved => {
        if (saved) {
          this.save.emit(saved as WidgetConfig);
        }
      });
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  private initializeForm(): void {
    if (!this.widget) return;

    this.configForm = this.fb.group({
      title: [this.widget.title, [Validators.required, Validators.maxLength(50)]],
      dataStream: [this.widget.dataStream, Validators.required],
      chartType: [this.widget.chartType, Validators.required],
      color: [this.widget.color || WIDGET_COLORS[0], Validators.required],
      bufferSize: [this.widget.bufferSize || DEFAULT_BUFFER_SIZE, [Validators.min(10), Validators.max(1000)]],
      role: [this.widget.role, Validators.required],
      triggerEvent: [this.widget.linkage.triggerEvent, Validators.required],
      posX: [this.widget.position.x, [Validators.min(0)]],
      posY: [this.widget.position.y, [Validators.min(0)]],
      posCols: [this.widget.position.cols, [Validators.min(2), Validators.max(12)]],
      posRows: [this.widget.position.rows, [Validators.min(2), Validators.max(8)]]
    });

    this.selectedTargets$.next([...this.widget.linkage.targetWidgetIds]);
  }
}
