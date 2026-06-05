import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Subject,
  Observable,
  of,
  combineLatest
} from 'rxjs';
import {
  takeUntil,
  tap,
  switchMap,
  map,
  take,
  catchError,
  distinctUntilChanged,
  filter
} from 'rxjs/operators';
import { DashboardLayoutComponent } from '../../shared/components/dashboard-layout/dashboard-layout.component';
import { WidgetConfigComponent } from '../../shared/components/widget-config/widget-config.component';
import {
  DashboardLayout as IDashboardLayout,
  WidgetConfig,
  ConnectionStatus,
  WIDGET_COLORS,
  DEFAULT_BUFFER_SIZE
} from '../../types/dashboard.types';
import { LayoutPersistenceService } from '../../core/services/layout-persistence.service';
import { DataStreamService, DataSourceType } from '../../core/services/data-stream.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardLayoutComponent, WidgetConfigComponent],
  template: `
    <div class="dashboard-page">
      <header class="dashboard-header">
        <div class="header-left">
          <h1 class="logo">📊 实时数据监控面板</h1>
          <div class="connection-status" [class.connected]="connectionStatus.connected" [class.reconnecting]="connectionStatus.reconnecting">
            <span class="status-indicator"></span>
            <span class="status-text">
              {{ connectionStatus.reconnecting ? '连接中...' : connectionStatus.connected ? '实时连接' : '连接失败' }}
            </span>
            <span class="retry-info" *ngIf="connectionStatus.reconnecting">
              (第 {{ connectionStatus.attempt }} 次重试)
            </span>
          </div>
        </div>
        <div class="header-right">
          <div class="data-source-switch">
            <label>数据源:</label>
            <select [(ngModel)]="dataSource" (change)="onDataSourceChange()">
              <option value="mock">模拟数据</option>
              <option value="websocket">WebSocket</option>
            </select>
          </div>
          <div class="layout-selector">
            <label>布局:</label>
            <select [(ngModel)]="selectedLayoutId" (change)="onLayoutChange()">
              <option *ngFor="let layout of layouts$ | async" [value]="layout.id">
                {{ layout.name }}
              </option>
            </select>
          </div>
          <button class="btn btn-primary" (click)="onAddWidget()">
            + 添加图表
          </button>
        </div>
      </header>

      <main class="dashboard-main">
        <app-dashboard-layout
          #dashboardLayout
          [layout$]="activeLayout$"
          (fullscreenWidget)="onFullscreenWidget($event)"
          (settingsWidget)="onSettingsWidget($event)"
        ></app-dashboard-layout>
      </main>

      <app-widget-config
        *ngIf="showConfigPanel"
        [widget]="configWidget"
        [allWidgets]="allWidgets"
        (close)="showConfigPanel = false"
        (save)="onConfigSave($event)"
      ></app-widget-config>

      <div *ngIf="showAddWidgetModal" class="modal-overlay" (click)="showAddWidgetModal = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>选择数据流</h3>
            <button class="close-btn" (click)="showAddWidgetModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="stream-grid">
              <div
                *ngFor="let stream of availableStreams" class="stream-card" (click)="addWidgetFromStream(stream)">
                <div class="stream-icon">📊</div>
                <div class="stream-info">
                  <div class="stream-name">{{ stream.name }}</div>
                  <div class="stream-desc">{{ stream.description }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showAddWidgetModal = false">取消</button>
          </div>
        </div>
      </div>

      <footer class="dashboard-footer">
        <div class="legend">
          <span class="legend-item">
            <span class="legend-color master"></span>
            主控图表
          </span>
          <span class="legend-item">
            <span class="legend-color slave"></span>
            联动图表
          </span>
          <span class="legend-item">
            <span class="legend-color independent"></span>
            独立图表
          </span>
        </div>
        <div class="tips">
          💡 提示: 拖动标题栏移动图表，拖动右下角调整大小，点击⚙️配置联动关系
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .dashboard-page {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #0a0a14;
      color: #e0e0e0;
      overflow: hidden;
    }

    .dashboard-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%);
      border-bottom: 1px solid #2a2a4a;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .logo {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      background: linear-gradient(135deg, #5470c6 0%, #91cc75 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: #888;
    }

    .connection-status.connected {
      color: #91cc75;
    }

    .connection-status.reconnecting {
      color: #fac858;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #666;
      animation: pulse 2s infinite;
    }

    .connection-status.connected .status-indicator {
      background: #91cc75;
    }

    .connection-status.reconnecting .status-indicator {
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

    .retry-info {
      font-size: 11px;
      opacity: 0.8;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .data-source-switch,
    .layout-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #aaa;
    }

    .data-source-switch select,
    .layout-selector select {
      padding: 6px 12px;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 6px;
      color: #e0e0e0;
      font-size: 13px;
      cursor: pointer;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
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

    .btn-secondary {
      background: #2a2a4a;
      color: #aaa;
    }

    .btn-secondary:hover {
      background: #3a3a5a;
      color: #e0e0e0;
    }

    .dashboard-main {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .dashboard-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 24px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid #2a2a4a;
      font-size: 12px;
      flex-shrink: 0;
    }

    .legend {
      display: flex;
      gap: 20px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #888;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .legend-color.master {
      background: #ee6666;
    }

    .legend-color.slave {
      background: #91cc75;
    }

    .legend-color.independent {
      background: #5470c6;
    }

    .tips {
      color: #666;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .modal-content {
      background: linear-gradient(135deg, #1e1e30 0%, #16162a 100%);
      border-radius: 12px;
      border: 1px solid #2a2a4a;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid #2a2a4a;
    }

    .modal-header h3 {
      margin: 0;
      font-size: 16px;
      color: #e0e0e0;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .close-btn:hover {
      background: rgba(238, 102, 102, 0.2);
      color: #ee6666;
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .stream-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .stream-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #0f0f1a;
      border: 1px solid #2a2a4a;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .stream-card:hover {
      border-color: #5470c6;
      background: rgba(84, 112, 198, 0.1);
      transform: translateY(-2px);
    }

    .stream-icon {
      font-size: 32px;
    }

    .stream-info {
      flex: 1;
    }

    .stream-name {
      font-size: 14px;
      font-weight: 500;
      color: #e0e0e0;
      margin-bottom: 4px;
    }

    .stream-desc {
      font-size: 12px;
      color: #888;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      background: rgba(0, 0, 0, 0.3);
      border-top: 1px solid #2a2a4a;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('dashboardLayout') dashboardLayout!: DashboardLayoutComponent;

  readonly layouts$: Observable<IDashboardLayout[]>;
  readonly activeLayout$: Observable<IDashboardLayout | null>;

  connectionStatus: ConnectionStatus = { connected: false, reconnecting: false, attempt: 0 };
  selectedLayoutId: string | null = null;
  showAddWidgetModal = false;
  showConfigPanel = false;
  configWidget: WidgetConfig | null = null;
  allWidgets: WidgetConfig[] = [];
  dataSource: DataSourceType = 'mock';

  readonly availableStreams = this.dataStreamService.getAvailableStreams();

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly router: Router,
    private readonly layoutPersistenceService: LayoutPersistenceService,
    private readonly dataStreamService: DataStreamService
  ) {
    this.layouts$ = this.layoutPersistenceService.getLayouts$();
    this.activeLayout$ = this.layoutPersistenceService.getActiveLayout$();
  }

  ngOnInit(): void {
    this.setupConnectionStatus();
    this.setupActiveLayout();
    this.initializeDefaultLayout();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onDataSourceChange(): void {
    this.dataStreamService.setDataSource(this.dataSource);
  }

  onLayoutChange(): void {
    if (this.selectedLayoutId) {
      this.layoutPersistenceService.setActiveLayout(this.selectedLayoutId)
        .pipe(take(1))
        .subscribe();
    }
  }

  onAddWidget(): void {
    this.showAddWidgetModal = true;
  }

  addWidgetFromStream(stream: { id: string; name: string; description: string }): void {
    const colorIndex = this.allWidgets.length % WIDGET_COLORS.length;

    this.dashboardLayout.addWidget({
      title: stream.name,
      dataStream: stream.id,
      color: WIDGET_COLORS[colorIndex],
      bufferSize: DEFAULT_BUFFER_SIZE
    });

    this.showAddWidgetModal = false;
  }

  onFullscreenWidget(widget: WidgetConfig): void {
    this.router.navigate(['/fullscreen', widget.id]);
  }

  onSettingsWidget(widget: WidgetConfig): void {
    this.configWidget = { ...widget };
    this.showConfigPanel = true;
  }

  onConfigSave(updatedWidget: WidgetConfig): void {
    this.showConfigPanel = false;
    this.configWidget = null;
  }

  private setupConnectionStatus(): void {
    this.dataStreamService.getConnectionStatus$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.connectionStatus = status;
      });
  }

  private setupActiveLayout(): void {
    this.activeLayout$
      .pipe(
        distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(layout => {
        if (layout) {
          this.selectedLayoutId = layout.id;
          this.allWidgets = [...layout.widgets];
        }
      });
  }

  private initializeDefaultLayout(): void {
    combineLatest([this.layouts$, this.activeLayout$])
      .pipe(
        take(1),
        filter(([layouts]) => layouts.length > 0 && layouts[0].widgets.length === 0),
        switchMap(([layouts, activeLayout]) => {
          if (!activeLayout) return of(null);

          const defaultWidgets: WidgetConfig[] = this.createDefaultWidgets(activeLayout.id);

          return this.layoutPersistenceService.saveLayout({
            ...activeLayout,
            widgets: defaultWidgets
          });
        }),
        catchError((error: unknown) => {
          console.error('Failed to initialize default layout:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  private createDefaultWidgets(layoutId: string): WidgetConfig[] {
    const now = Date.now();

    return [
      {
        id: `widget_${now}_1`,
        title: 'CPU 使用率',
        dataStream: 'cpu-usage',
        chartType: 'line',
        position: { x: 0, y: 0, cols: 6, rows: 3 },
        role: 'master',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: [`widget_${now}_2`]
        },
        color: '#5470c6',
        bufferSize: 100
      },
      {
        id: `widget_${now}_2`,
        title: '内存使用率',
        dataStream: 'memory-usage',
        chartType: 'line',
        position: { x: 6, y: 0, cols: 6, rows: 3 },
        role: 'slave',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#91cc75',
        bufferSize: 100
      },
      {
        id: `widget_${now}_3`,
        title: '网络入流量',
        dataStream: 'network-in',
        chartType: 'bar',
        position: { x: 0, y: 3, cols: 4, rows: 3 },
        role: 'independent',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#fac858',
        bufferSize: 100
      },
      {
        id: `widget_${now}_4`,
        title: '网络出流量',
        dataStream: 'network-out',
        chartType: 'bar',
        position: { x: 4, y: 3, cols: 4, rows: 3 },
        role: 'independent',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#ee6666',
        bufferSize: 100
      },
      {
        id: `widget_${now}_5`,
        title: '服务器负载',
        dataStream: 'server-load',
        chartType: 'gauge',
        position: { x: 8, y: 3, cols: 4, rows: 3 },
        role: 'independent',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#73c0de',
        bufferSize: 100
      },
      {
        id: `widget_${now}_6`,
        title: '磁盘使用率',
        dataStream: 'disk-usage',
        chartType: 'pie',
        position: { x: 0, y: 6, cols: 6, rows: 2 },
        role: 'independent',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#3ba272',
        bufferSize: 100
      },
      {
        id: `widget_${now}_7`,
        title: '响应时间',
        dataStream: 'response-time',
        chartType: 'line',
        position: { x: 6, y: 6, cols: 6, rows: 2 },
        role: 'independent',
        linkage: {
          triggerEvent: 'click',
          targetWidgetIds: []
        },
        color: '#fc8452',
        bufferSize: 100
      }
    ];
  }
}
