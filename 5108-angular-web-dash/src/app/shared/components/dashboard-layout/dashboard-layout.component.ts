import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  Input,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Subject,
  BehaviorSubject,
  Observable,
  fromEvent,
  merge,
  of
} from 'rxjs';
import {
  takeUntil,
  map,
  tap,
  take,
  filter,
  catchError,
  distinctUntilChanged
} from 'rxjs/operators';
import { WidgetComponent } from '../widget/widget.component';
import {
  DashboardLayout as IDashboardLayout,
  WidgetConfig,
  WidgetPosition,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_CELL_SIZE,
  WIDGET_COLORS,
  DEFAULT_BUFFER_SIZE
} from '../../../types/dashboard.types';
import { LayoutPersistenceService } from '../../../core/services/layout-persistence.service';

interface DragState {
  isDragging: boolean;
  widgetId: string | null;
  startX: number;
  startY: number;
  startPosition: WidgetPosition | null;
}

interface ResizeState {
  isResizing: boolean;
  widgetId: string | null;
  startX: number;
  startY: number;
  startPosition: WidgetPosition | null;
}

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, WidgetComponent],
  template: `
    <div class="dashboard-container">
      <div
        class="grid-background"
        [style.width.px]="gridWidth"
        [style.height.px]="gridHeight"
      >
        <svg class="grid-lines" [attr.width]="gridWidth" [attr.height]="gridHeight">
          <defs>
            <pattern id="grid" [attr.width]="cellSize" [attr.height]="cellSize" patternUnits="userSpaceOnUse">
              <path
                [attr.d]="'M ' + cellSize + ' 0 L 0 0 0 ' + cellSize"
                fill="none"
                stroke="#2a2a4a"
                stroke-width="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div class="widgets-container" [style.width.px]="gridWidth" [style.height.px]="gridHeight">
        <app-widget
          *ngFor="let widget of widgets$ | async; trackBy: trackByWidgetId"
          [config]="widget"
          [isDragging]="dragState.isDragging && dragState.widgetId === widget.id"
          [style.left.px]="widget.position.x * cellSize"
          [style.top.px]="widget.position.y * cellSize"
          [style.width.px]="widget.position.cols * cellSize - 8"
          [style.height.px]="widget.position.rows * cellSize - 8"
          (remove)="onRemoveWidget(widget.id)"
          (fullscreen)="onFullscreenWidget($event)"
          (settings)="onSettingsWidget($event)"
          (dragStart)="onWidgetDragStart($event)"
          (resizeStart)="onWidgetResizeStart($event)"
        ></app-widget>
      </div>

      <div
        *ngIf="dragState.isDragging || resizeState.isResizing"
        class="grid-highlight"
        [style.left.px]="highlightPosition.x * cellSize"
        [style.top.px]="highlightPosition.y * cellSize"
        [style.width.px]="highlightPosition.cols * cellSize"
        [style.height.px]="highlightPosition.rows * cellSize"
        [class.dragging]="dragState.isDragging"
        [class.resizing]="resizeState.isResizing"
      ></div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      position: relative;
      overflow: auto;
      width: 100%;
      height: 100%;
      background: #0f0f1a;
    }

    .grid-background {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .grid-lines {
      opacity: 0.5;
    }

    .widgets-container {
      position: relative;
      padding: 4px;
    }

    .grid-highlight {
      position: absolute;
      pointer-events: none;
      border: 2px dashed #5470c6;
      border-radius: 8px;
      background: rgba(84, 112, 198, 0.1);
      transition: all 0.15s ease-out;
      z-index: 999;
    }

    .grid-highlight.dragging {
      border-color: #91cc75;
      background: rgba(145, 204, 117, 0.1);
    }

    .grid-highlight.resizing {
      border-color: #fac858;
      background: rgba(250, 200, 88, 0.1);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  @Input() layout$!: Observable<IDashboardLayout | null>;
  @Output() fullscreenWidget = new EventEmitter<WidgetConfig>();
  @Output() settingsWidget = new EventEmitter<WidgetConfig>();

  readonly widgets$ = new BehaviorSubject<WidgetConfig[]>([]);
  readonly gridCols$ = new BehaviorSubject<number>(DEFAULT_GRID_COLS);
  readonly gridRows$ = new BehaviorSubject<number>(DEFAULT_GRID_ROWS);
  readonly cellSize$ = new BehaviorSubject<number>(DEFAULT_CELL_SIZE);

  readonly dragState: DragState = {
    isDragging: false,
    widgetId: null,
    startX: 0,
    startY: 0,
    startPosition: null
  };

  readonly resizeState: ResizeState = {
    isResizing: false,
    widgetId: null,
    startX: 0,
    startY: 0,
    startPosition: null
  };

  readonly highlightPosition: WidgetPosition = {
    x: 0,
    y: 0,
    cols: 1,
    rows: 1
  };

  private readonly destroy$ = new Subject<void>();
  private currentLayoutId: string | null = null;

  get cellSize(): number {
    return this.cellSize$.value;
  }

  get gridWidth(): number {
    return this.gridCols$.value * this.cellSize$.value;
  }

  get gridHeight(): number {
    return this.gridRows$.value * this.cellSize$.value;
  }

  constructor(
    private readonly layoutPersistenceService: LayoutPersistenceService
  ) {}

  ngOnInit(): void {
    this.setupLayoutSubscription();
    this.setupGlobalEventListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackByWidgetId(_index: number, widget: WidgetConfig): string {
    return widget.id;
  }

  addWidget(widgetConfig: Partial<WidgetConfig>): void {
    if (!this.currentLayoutId) return;

    const position = this.findNextAvailablePosition(3, 2);
    const newWidget: WidgetConfig = {
      id: `widget_${Date.now()}`,
      title: widgetConfig.title || '新图表',
      dataStream: widgetConfig.dataStream || 'cpu-usage',
      chartType: widgetConfig.chartType || 'line',
      position: widgetConfig.position || position,
      role: widgetConfig.role || 'independent',
      linkage: widgetConfig.linkage || {
        triggerEvent: 'click',
        targetWidgetIds: []
      },
      color: widgetConfig.color || WIDGET_COLORS[Math.floor(Math.random() * WIDGET_COLORS.length)],
      bufferSize: widgetConfig.bufferSize || DEFAULT_BUFFER_SIZE
    };

    this.layoutPersistenceService.addWidget(this.currentLayoutId, newWidget)
      .pipe(
        take(1),
        catchError((error: unknown) => {
          console.error('Failed to add widget:', error);
          return of(null);
        })
      )
      .subscribe(added => {
        if (added) {
          const currentWidgets = this.widgets$.value;
          this.widgets$.next([...currentWidgets, added]);
        }
      });
  }

  onWidgetDragStart(event: { event: MouseEvent; widgetId: string }): void {
    const widget = this.widgets$.value.find(w => w.id === event.widgetId);
    if (!widget) return;

    Object.assign(this.dragState, {
      isDragging: true,
      widgetId: event.widgetId,
      startX: event.event.clientX,
      startY: event.event.clientY,
      startPosition: { ...widget.position }
    });

    Object.assign(this.highlightPosition, widget.position);
  }

  onWidgetResizeStart(event: { event: MouseEvent; widgetId: string }): void {
    const widget = this.widgets$.value.find(w => w.id === event.widgetId);
    if (!widget) return;

    Object.assign(this.resizeState, {
      isResizing: true,
      widgetId: event.widgetId,
      startX: event.event.clientX,
      startY: event.event.clientY,
      startPosition: { ...widget.position }
    });

    Object.assign(this.highlightPosition, widget.position);
  }

  onRemoveWidget(widgetId: string): void {
    if (!this.currentLayoutId) return;

    this.layoutPersistenceService.removeWidget(this.currentLayoutId, widgetId)
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          const currentWidgets = this.widgets$.value.filter(w => w.id !== widgetId);
          this.widgets$.next(currentWidgets);
        }
      });
  }

  onFullscreenWidget(widget: WidgetConfig): void {
    this.fullscreenWidget.emit(widget);
  }

  onSettingsWidget(widget: WidgetConfig): void {
    this.settingsWidget.emit(widget);
  }

  updateWidgetPosition(widgetId: string, position: WidgetPosition): void {
    this.layoutPersistenceService.updateWidget(widgetId, { position })
      .pipe(take(1))
      .subscribe(updated => {
        if (updated) {
          const currentWidgets = this.widgets$.value.map(w =>
            w.id === widgetId ? { ...w, position: updated.position } : w
          );
          this.widgets$.next(currentWidgets);
        }
      });
  }

  private setupLayoutSubscription(): void {
    this.layout$.pipe(
      filter((layout): layout is IDashboardLayout => layout !== null),
      distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
      tap(layout => {
        this.currentLayoutId = layout.id;
        this.gridCols$.next(layout.gridCols);
        this.gridRows$.next(layout.gridRows);
        this.cellSize$.next(layout.cellSize);
        this.widgets$.next([...layout.widgets]);
      }),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  private setupGlobalEventListeners(): void {
    const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove');
    const mouseUp$ = fromEvent<MouseEvent>(document, 'mouseup');

    merge(
      mouseMove$.pipe(
        filter(() => this.dragState.isDragging),
        map(event => this.handleDragMove(event))
      ),
      mouseMove$.pipe(
        filter(() => this.resizeState.isResizing),
        map(event => this.handleResizeMove(event))
      ),
      mouseUp$.pipe(
        filter(() => this.dragState.isDragging),
        tap(() => this.handleDragEnd())
      ),
      mouseUp$.pipe(
        filter(() => this.resizeState.isResizing),
        tap(() => this.handleResizeEnd())
      )
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe();
  }

  private handleDragMove(event: MouseEvent): void {
    if (!this.dragState.startPosition) return;

    const dx = event.clientX - this.dragState.startX;
    const dy = event.clientY - this.dragState.startY;

    const newX = Math.round(dx / this.cellSize$.value) + this.dragState.startPosition.x;
    const newY = Math.round(dy / this.cellSize$.value) + this.dragState.startPosition.y;

    const clampedX = Math.max(0, Math.min(newX, this.gridCols$.value - this.dragState.startPosition.cols));
    const clampedY = Math.max(0, Math.min(newY, this.gridRows$.value - this.dragState.startPosition.rows));

    this.highlightPosition.x = clampedX;
    this.highlightPosition.y = clampedY;
  }

  private handleResizeMove(event: MouseEvent): void {
    if (!this.resizeState.startPosition) return;

    const dx = event.clientX - this.resizeState.startX;
    const dy = event.clientY - this.resizeState.startY;

    const newCols = Math.round(dx / this.cellSize$.value) + this.resizeState.startPosition.cols;
    const newRows = Math.round(dy / this.cellSize$.value) + this.resizeState.startPosition.rows;

    const clampedCols = Math.max(2, Math.min(newCols, this.gridCols$.value - this.resizeState.startPosition.x));
    const clampedRows = Math.max(2, Math.min(newRows, this.gridRows$.value - this.resizeState.startPosition.y));

    this.highlightPosition.cols = clampedCols;
    this.highlightPosition.rows = clampedRows;
  }

  private handleDragEnd(): void {
    if (this.dragState.widgetId) {
      this.updateWidgetPosition(this.dragState.widgetId, {
        x: this.highlightPosition.x,
        y: this.highlightPosition.y,
        cols: this.highlightPosition.cols,
        rows: this.highlightPosition.rows
      });
    }

    Object.assign(this.dragState, {
      isDragging: false,
      widgetId: null,
      startX: 0,
      startY: 0,
      startPosition: null
    });
  }

  private handleResizeEnd(): void {
    if (this.resizeState.widgetId) {
      this.updateWidgetPosition(this.resizeState.widgetId, {
        x: this.highlightPosition.x,
        y: this.highlightPosition.y,
        cols: this.highlightPosition.cols,
        rows: this.highlightPosition.rows
      });
    }

    Object.assign(this.resizeState, {
      isResizing: false,
      widgetId: null,
      startX: 0,
      startY: 0,
      startPosition: null
    });
  }

  private findNextAvailablePosition(cols: number, rows: number): WidgetPosition {
    const widgets = this.widgets$.value;
    const gridCols = this.gridCols$.value;
    const gridRows = this.gridRows$.value;

    for (let y = 0; y <= gridRows - rows; y++) {
      for (let x = 0; x <= gridCols - cols; x++) {
        if (!this.isPositionOccupied(x, y, cols, rows, widgets)) {
          return { x, y, cols, rows };
        }
      }
    }

    return { x: 0, y: 0, cols, rows };
  }

  private isPositionOccupied(
    x: number,
    y: number,
    cols: number,
    rows: number,
    widgets: WidgetConfig[]
  ): boolean {
    return widgets.some(widget => {
      const pos = widget.position;
      return !(
        x + cols <= pos.x ||
        x >= pos.x + pos.cols ||
        y + rows <= pos.y ||
        y >= pos.y + pos.rows
      );
    });
  }
}
