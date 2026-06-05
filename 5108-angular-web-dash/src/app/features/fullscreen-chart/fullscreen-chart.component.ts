import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Observable, of, BehaviorSubject } from 'rxjs';
import { takeUntil, switchMap, take, map, tap, catchError, filter } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { ChartRendererComponent } from '../../shared/components/chart-renderer/chart-renderer.component';
import { WidgetConfig, ChartType, DataPoint, ConnectionStatus, DashboardLayout } from '../../types/dashboard.types';
import { LayoutPersistenceService } from '../../core/services/layout-persistence.service';
import { DataStreamService } from '../../core/services/data-stream.service';

@Component({
  selector: 'app-fullscreen-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartRendererComponent],
  template: `
    <div class="fullscreen-container">
      <header class="fullscreen-header">
        <button class="back-btn" (click)="goBack()">
          ← 返回仪表盘
        </button>
        <h1 class="chart-title">{{ widget?.title || '全屏图表' }}</h1>
        <div class="header-right">
          <div class="chart-type-switcher">
            <button
              *ngFor="let type of chartTypes"
              [class.active]="currentChartType === type.value"
              (click)="switchChartType(type.value)"
            >
              {{ type.icon }} {{ type.label }}
            </button>
          </div>
          <div class="connection-status" [class.connected]="connectionStatus.connected">
            <span class="status-dot"></span>
            {{ connectionStatus.connected ? '实时' : '断开' }}
          </div>
        </div>
      </header>

      <main class="chart-content">
        <ng-container *ngIf="widget && data$; else noDataTemplate">
          <app-chart-renderer
            [data$]="data$"
            [chartType]="currentChartType"
            [color]="widget.color || '#5470c6'"
            [title]="widget.title"
            [widgetId]="widget.id"
          ></app-chart-renderer>
        </ng-container>
        <ng-template #noDataTemplate>
          <div class="no-data">
            <div class="no-data-icon">📊</div>
            <div class="no-data-text">未找到图表数据</div>
            <button class="btn btn-primary" (click)="goBack()">返回仪表盘</button>
          </div>
        </ng-template>
      </main>

      <footer class="fullscreen-footer">
        <div class="stream-info">
          <span class="label">数据流:</span>
          <span class="value">{{ widget?.dataStream }}</span>
        </div>
        <div class="buffer-info">
          <span class="label">数据点:</span>
          <span class="value">{{ dataPointCount }}</span>
        </div>
        <div class="role-info" *ngIf="widget?.role !== 'independent'">
          <span class="label">角色:</span>
          <span class="value" [class.master]="widget?.role === 'master'" [class.slave]="widget?.role === 'slave'">
            {{ widget?.role === 'master' ? '主控' : '联动' }}
          </span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .fullscreen-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #0a0a14;
      color: #e0e0e0;
    }

    .fullscreen-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
      border-bottom: 1px solid #2a2a4a;
    }

    .back-btn {
      background: transparent;
      border: 1px solid #2a2a4a;
      color: #aaa;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .back-btn:hover {
      background: #2a2a4a;
      color: #fff;
      border-color: #5470c6;
    }

    .chart-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      background: linear-gradient(135deg, #5470c6 0%, #91cc75 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .chart-type-switcher {
      display: flex;
      gap: 4px;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px;
      border-radius: 6px;
    }

    .chart-type-switcher button {
      background: transparent;
      border: none;
      color: #888;
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 4px;
      font-size: 13px;
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

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      font-size: 13px;
      color: #888;
    }

    .connection-status.connected {
      color: #91cc75;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      animation: pulse 2s infinite;
    }

    .connection-status.connected .status-dot {
      background: #91cc75;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .chart-content {
      flex: 1;
      padding: 24px;
      overflow: hidden;
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
      font-size: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .no-data-text {
      font-size: 18px;
      margin-bottom: 24px;
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

    .btn-primary {
      background: linear-gradient(135deg, #5470c6 0%, #6680d3 100%);
      color: #fff;
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(84, 112, 198, 0.4);
    }

    .fullscreen-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 48px;
      padding: 12px 24px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid #2a2a4a;
      font-size: 13px;
    }

    .stream-info,
    .buffer-info,
    .role-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .label {
      color: #888;
    }

    .value {
      color: #e0e0e0;
      font-weight: 500;
    }

    .value.master {
      color: #ee6666;
    }

    .value.slave {
      color: #91cc75;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FullscreenChartComponent implements OnInit, OnDestroy {
  widget: WidgetConfig | null = null;
  data$: Observable<DataPoint[]> | null = null;
  currentChartType: ChartType = 'line';
  connectionStatus: ConnectionStatus = { connected: false, reconnecting: false, attempt: 0 };
  dataPointCount = 0;

  readonly chartTypes: Array<{ value: ChartType; label: string; icon: string }> = [
    { value: 'line', label: '折线图', icon: '📈' },
    { value: 'bar', label: '柱状图', icon: '📊' },
    { value: 'pie', label: '饼图', icon: '🥧' },
    { value: 'gauge', label: '仪表盘', icon: '🎯' }
  ];

  private readonly destroy$ = new Subject<void>();
  private readonly widget$ = new BehaviorSubject<WidgetConfig | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly layoutPersistenceService: LayoutPersistenceService,
    private readonly dataStreamService: DataStreamService
  ) {}

  ngOnInit(): void {
    this.setupWidgetSubscription();
    this.setupConnectionStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.widget) {
      this.dataStreamService.unsubscribe(this.widget.dataStream);
    }
  }

  switchChartType(type: ChartType): void {
    if (type === this.currentChartType) return;
    this.currentChartType = type;

    if (this.widget) {
      this.layoutPersistenceService.updateWidget(this.widget.id, { chartType: type })
        .pipe(take(1))
        .subscribe();
    }
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  private setupWidgetSubscription(): void {
    this.route.paramMap.pipe(
      take(1),
      map(params => params.get('widgetId')),
      filter((widgetId): widgetId is string => widgetId !== null),
      switchMap(widgetId => {
        return this.layoutPersistenceService.getActiveLayout$().pipe(
          filter((layout): layout is DashboardLayout => layout !== null),
          map(layout => layout.widgets.find(w => w.id === widgetId))
        );
      }),
      takeUntil(this.destroy$),
      tap(widget => {
        if (widget) {
          this.widget = widget;
          this.widget$.next(widget);
          this.currentChartType = widget.chartType;
          this.setupDataStream(widget);
        }
      }),
      catchError((error: unknown) => {
        console.error('Failed to load widget:', error);
        return of(null);
      })
    ).subscribe();
  }

  private setupDataStream(widget: WidgetConfig): void {
    this.data$ = this.dataStreamService.subscribe(widget.dataStream, widget.bufferSize).pipe(
      tap(data => {
        this.dataPointCount = data.length;
      }),
      takeUntil(this.destroy$)
    );
  }

  private setupConnectionStatus(): void {
    this.dataStreamService.getConnectionStatus$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus = status;
      });
  }
}
