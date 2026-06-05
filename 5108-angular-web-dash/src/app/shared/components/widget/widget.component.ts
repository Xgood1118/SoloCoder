import {
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  Output,
  EventEmitter,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Subject,
  BehaviorSubject,
  Observable,
  of
} from 'rxjs';
import {
  takeUntil,
  switchMap,
  catchError,
  tap,
  filter,
  map,
  distinctUntilChanged
} from 'rxjs/operators';
import { ChartRendererComponent } from '../chart-renderer/chart-renderer.component';
import {
  WidgetConfig,
  ChartType,
  DataPoint,
  LinkageEvent,
  ConnectionStatus,
  TriggerEventType,
  WIDGET_COLORS,
  DEFAULT_BUFFER_SIZE
} from '../../../types/dashboard.types';
import { DataStreamService } from '../../../core/services/data-stream.service';
import { LinkageEventBusService } from '../../../core/services/linkage-event-bus.service';
import { LayoutPersistenceService } from '../../../core/services/layout-persistence.service';

@Component({
  selector: 'app-widget',
  standalone: true,
  imports: [CommonModule, ChartRendererComponent],
  template: `
    <div
      class="widget"
      [class.dragging]="isDragging"
      [class.master-widget]="config.role === 'master'"
      [class.slave-widget]="config.role === 'slave'"
      [style.borderTopColor]="config.color"
    >
      <div class="widget-header" (mousedown)="onDragStart($event)">
        <div class="widget-title">
          <span class="role-indicator" *ngIf="config.role !== 'independent'" [class.master]="config.role === 'master'">
            {{ config.role === 'master' ? '主控' : '联动' }}
          </span>
          <span class="title-text">{{ config.title }}</span>
        </div>
        <div class="widget-actions">
          <span class="connection-status" [class.connected]="connectionStatus.connected" [class.reconnecting]="connectionStatus.reconnecting">
            <span class="status-dot"></span>
            {{ connectionStatus.reconnecting ? '重连中...' : connectionStatus.connected ? '已连接' : '已断开' }}
          </span>
          <div class="chart-type-switcher">
            <button
              *ngFor="let type of chartTypes"
              [class.active]="currentChartType === type.value"
              (click)="switchChartType(type.value)"
              [title]="type.label"
            >
              {{ type.icon }}
            </button>
          </div>
          <button class="action-btn" (click)="onSettingsClick()" title="设置">
            ⚙️
          </button>
          <button class="action-btn" (click)="onFullscreenClick()" title="全屏">
            ⛶
          </button>
          <button class="action-btn remove-btn" (click)="onRemoveClick()" title="移除">
            ✕
          </button>
        </div>
      </div>

      <div class="widget-content" [class.loading]="!hasData">
        <ng-container *ngIf="hasData; else noDataTemplate">
          <app-chart-renderer
            [data$]="widgetData$"
            [chartType]="currentChartType"
            [color]="config.color || '#5470c6'"
            [title]="config.title"
            [widgetId]="config.id"
            [highlightTimestamp]="highlightTimestamp$ | async"
            (linkageEvent)="onLinkageEvent($event)"
          ></app-chart-renderer>
        </ng-container>
        <ng-template #noDataTemplate>
          <div class="no-data">
            <div class="no-data-icon">📊</div>
            <div class="no-data-text">等待数据...</div>
          </div>
        </ng-template>
      </div>

      <div class="resize-handle" (mousedown)="onResizeStart($event)"></div>
    </div>
  `,
  styles: [`
    .widget {
      position: absolute;
      background: linear-gradient(135deg, #1e1e30 0%, #16162a 100%);
      border-radius: 8px;
      border: 1px solid #2a2a4a;
      border-top: 3px solid #5470c6;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: box-shadow 0.3s, transform 0.2s;
    }

    .widget:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .widget.dragging {
      opacity: 0.8;
      transform: scale(1.02);
      z-index: 1000;
      cursor: grabbing;
    }

    .widget.master-widget {
      border-top-color: #ee6666;
    }

    .widget.slave-widget {
      border-top-color: #91cc75;
    }

    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid #2a2a4a;
      cursor: move;
      user-select: none;
    }

    .widget-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .role-indicator {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #3a3a5a;
      color: #aaa;
    }

    .role-indicator.master {
      background: rgba(238, 102, 102, 0.2);
      color: #ee6666;
    }

    .title-text {
      color: #e0e0e0;
      font-size: 13px;
      font-weight: 500;
    }

    .widget-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #888;
    }

    .connection-status.connected {
      color: #91cc75;
    }

    .connection-status.reconnecting {
      color: #fac858;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #666;
      animation: pulse 2s infinite;
    }

    .connection-status.connected .status-dot {
      background: #91cc75;
    }

    .connection-status.reconnecting .status-dot {
      background: #fac858;
      animation: blink 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    .chart-type-switcher {
      display: flex;
      gap: 2px;
      background: rgba(0, 0, 0, 0.3);
      padding: 2px;
      border-radius: 4px;
    }

    .chart-type-switcher button {
      background: transparent;
      border: none;
      color: #888;
      padding: 4px 6px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 12px;
      transition: all 0.2s;
    }

    .chart-type-switcher button:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .chart-type-switcher button.active {
      background: rgba(84, 112, 198, 0.5);
      color: #fff;
    }

    .action-btn {
      background: transparent;
      border: none;
      color: #888;
      padding: 4px 6px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .remove-btn:hover {
      background: rgba(238, 102, 102, 0.3);
      color: #ee6666;
    }

    .widget-content {
      flex: 1;
      position: relative;
      min-height: 0;
      overflow: hidden;
    }

    .widget-content.loading::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(84, 112, 198, 0.1), transparent);
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .no-data {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #666;
    }

    .no-data-icon {
      font-size: 32px;
      margin-bottom: 8px;
      opacity: 0.5;
    }

    .no-data-text {
      font-size: 12px;
    }

    .resize-handle {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 16px;
      height: 16px;
      cursor: se-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(84, 112, 198, 0.5) 50%);
    }

    .resize-handle:hover {
      background: linear-gradient(135deg, transparent 50%, #5470c6 50%);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() config!: WidgetConfig;
  @Input() isDragging = false;

  @Output() remove = new EventEmitter<string>();
  @Output() fullscreen = new EventEmitter<WidgetConfig>();
  @Output() settings = new EventEmitter<WidgetConfig>();
  @Output() dragStart = new EventEmitter<{ event: MouseEvent; widgetId: string }>();
  @Output() resizeStart = new EventEmitter<{ event: MouseEvent; widgetId: string }>();

  readonly chartTypes: Array<{ value: ChartType; label: string; icon: string }> = [
    { value: 'line', label: '折线图', icon: '📈' },
    { value: 'bar', label: '柱状图', icon: '📊' },
    { value: 'pie', label: '饼图', icon: '🥧' },
    { value: 'gauge', label: '仪表盘', icon: '🎯' }
  ];

  readonly widgetData$: Observable<DataPoint[]>;
  readonly highlightTimestamp$ = new BehaviorSubject<number | null>(null);
  readonly connectionStatus$: Observable<ConnectionStatus>;

  private readonly destroy$ = new Subject<void>();
  private readonly chartType$ = new BehaviorSubject<ChartType>('line');
  private readonly hasData$ = new BehaviorSubject<boolean>(false);

  currentChartType: ChartType = 'line';
  hasData = false;
  connectionStatus: ConnectionStatus = { connected: false, reconnecting: false, attempt: 0 };

  constructor(
    private readonly dataStreamService: DataStreamService,
    private readonly linkageEventBus: LinkageEventBusService,
    private readonly layoutPersistenceService: LayoutPersistenceService
  ) {
    this.widgetData$ = this.initializeDataStream();
    this.connectionStatus$ = this.dataStreamService.getConnectionStatus$();
  }

  ngOnInit(): void {
    this.chartType$.next(this.config.chartType);
    this.currentChartType = this.config.chartType;
    this.linkageEventBus.registerWidget(this.config);
    this.setupLinkageListener();
    this.setupConnectionStatus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] && !changes['config'].isFirstChange()) {
      this.linkageEventBus.updateWidgetConfig(this.config);
      this.chartType$.next(this.config.chartType);
      this.currentChartType = this.config.chartType;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.dataStreamService.unsubscribe(this.config.dataStream);
    this.linkageEventBus.unregisterWidget(this.config.id);
  }

  switchChartType(type: ChartType): void {
    if (type === this.currentChartType) return;

    this.currentChartType = type;
    this.chartType$.next(type);

    this.layoutPersistenceService.updateWidget(this.config.id, {
      chartType: type
    }).subscribe();
  }

  onLinkageEvent(event: { eventType: TriggerEventType; data: LinkageEvent['data'] }): void {
    if (this.config.role !== 'master') return;

    if (this.config.linkage.triggerEvent === event.eventType) {
      this.linkageEventBus.emit({
        sourceWidgetId: this.config.id,
        eventType: event.eventType,
        data: event.data
      });
    }
  }

  onDragStart(event: MouseEvent): void {
    event.preventDefault();
    this.dragStart.emit({ event, widgetId: this.config.id });
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizeStart.emit({ event, widgetId: this.config.id });
  }

  onRemoveClick(): void {
    this.remove.emit(this.config.id);
  }

  onFullscreenClick(): void {
    this.fullscreen.emit(this.config);
  }

  onSettingsClick(): void {
    this.settings.emit(this.config);
  }

  private initializeDataStream(): Observable<DataPoint[]> {
    return this.chartType$.pipe(
      distinctUntilChanged(),
      switchMap(() =>
        this.dataStreamService.subscribe(
          this.config.dataStream,
          this.config.bufferSize || DEFAULT_BUFFER_SIZE
        )
      ),
      tap(data => {
        this.hasData$.next(data.length > 0);
        this.hasData = data.length > 0;
      }),
      takeUntil(this.destroy$),
      catchError((error: unknown) => {
        console.error(`Widget ${this.config.id} data error:`, error);
        return of([]);
      })
    );
  }

  private setupLinkageListener(): void {
    if (this.config.role !== 'slave') return;

    this.linkageEventBus.getEventsForWidget(this.config.id)
      .pipe(
        takeUntil(this.destroy$),
        filter(event => event.data.timestamp != null),
        map(event => event.data.timestamp as number)
      )
      .subscribe(timestamp => {
        this.highlightTimestamp$.next(timestamp);
      });
  }

  private setupConnectionStatus(): void {
    this.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus = status;
      });
  }
}
