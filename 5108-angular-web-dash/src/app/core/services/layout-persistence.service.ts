import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  of,
  switchMap,
  catchError,
  tap,
  map
} from 'rxjs';
import {
  DashboardLayout,
  WidgetConfig,
  DEFAULT_GRID_COLS,
  DEFAULT_GRID_ROWS,
  DEFAULT_CELL_SIZE
} from '../../types/dashboard.types';

const STORAGE_KEY = 'dashboard_layouts';
const ACTIVE_LAYOUT_KEY = 'active_dashboard_layout';

@Injectable({ providedIn: 'root' })
export class LayoutPersistenceService {
  private readonly layouts$ = new BehaviorSubject<DashboardLayout[]>([]);
  private readonly activeLayoutId$ = new BehaviorSubject<string | null>(null);

  constructor() {
    this.initializeFromStorage();
  }

  getLayouts$(): Observable<DashboardLayout[]> {
    return this.layouts$.asObservable();
  }

  getActiveLayout$(): Observable<DashboardLayout | null> {
    return this.activeLayoutId$.pipe(
      switchMap((activeId: string | null) =>
        this.layouts$.pipe(
          map(layouts => layouts.find(l => l.id === activeId) ?? null)
        )
      )
    );
  }

  getActiveLayoutId(): string | null {
    return this.activeLayoutId$.value;
  }

  saveLayout(layout: DashboardLayout): Observable<DashboardLayout> {
    const existingIndex = this.layouts$.value.findIndex(l => l.id === layout.id);
    const layouts = [...this.layouts$.value];

    if (existingIndex >= 0) {
      layouts[existingIndex] = layout;
    } else {
      layouts.push(layout);
    }

    this.layouts$.next(layouts);
    return this.persistToStorage().pipe(
      map(() => layout),
      catchError((error: unknown) => {
        console.error('Failed to save layout:', error);
        return of(layout);
      })
    );
  }

  updateWidget(widgetId: string, updates: Partial<WidgetConfig>): Observable<WidgetConfig | null> {
    const activeId = this.activeLayoutId$.value;
    if (!activeId) return of(null);

    const layouts = [...this.layouts$.value];
    const layoutIndex = layouts.findIndex(l => l.id === activeId);

    if (layoutIndex < 0) return of(null);

    const layout = { ...layouts[layoutIndex] };
    const widgetIndex = layout.widgets.findIndex(w => w.id === widgetId);

    if (widgetIndex < 0) return of(null);

    const updatedWidget = { ...layout.widgets[widgetIndex], ...updates };
    layout.widgets = [...layout.widgets];
    layout.widgets[widgetIndex] = updatedWidget;
    layouts[layoutIndex] = layout;

    this.layouts$.next(layouts);

    return this.persistToStorage().pipe(
      map(() => updatedWidget),
      catchError((error: unknown) => {
        console.error('Failed to update widget:', error);
        return of(null);
      })
    );
  }

  addWidget(layoutId: string, widget: WidgetConfig): Observable<WidgetConfig> {
    const layouts = [...this.layouts$.value];
    const layoutIndex = layouts.findIndex(l => l.id === layoutId);

    if (layoutIndex < 0) {
      return of(widget);
    }

    const layout = { ...layouts[layoutIndex] };
    layout.widgets = [...layout.widgets, widget];
    layouts[layoutIndex] = layout;

    this.layouts$.next(layouts);

    return this.persistToStorage().pipe(
      map(() => widget),
      catchError((error: unknown) => {
        console.error('Failed to add widget:', error);
        return of(widget);
      })
    );
  }

  removeWidget(layoutId: string, widgetId: string): Observable<boolean> {
    const layouts = [...this.layouts$.value];
    const layoutIndex = layouts.findIndex(l => l.id === layoutId);

    if (layoutIndex < 0) return of(false);

    const layout = { ...layouts[layoutIndex] };
    layout.widgets = layout.widgets.filter(w => w.id !== widgetId);
    layouts[layoutIndex] = layout;

    this.layouts$.next(layouts);

    return this.persistToStorage().pipe(
      map(() => true),
      catchError((error: unknown) => {
        console.error('Failed to remove widget:', error);
        return of(false);
      })
    );
  }

  deleteLayout(layoutId: string): Observable<boolean> {
    const layouts = this.layouts$.value.filter(l => l.id !== layoutId);
    this.layouts$.next(layouts);

    if (this.activeLayoutId$.value === layoutId) {
      const firstLayout = layouts[0];
      this.activeLayoutId$.next(firstLayout?.id ?? null);
    }

    return this.persistToStorage().pipe(
      map(() => true),
      catchError((error: unknown) => {
        console.error('Failed to delete layout:', error);
        return of(false);
      })
    );
  }

  setActiveLayout(layoutId: string): Observable<boolean> {
    this.activeLayoutId$.next(layoutId);
    localStorage.setItem(ACTIVE_LAYOUT_KEY, layoutId);
    return of(true);
  }

  createDefaultLayout(): DashboardLayout {
    return {
      id: `layout_${Date.now()}`,
      name: '默认仪表盘',
      widgets: [],
      gridCols: DEFAULT_GRID_COLS,
      gridRows: DEFAULT_GRID_ROWS,
      cellSize: DEFAULT_CELL_SIZE
    };
  }

  getLayoutById(layoutId: string): DashboardLayout | undefined {
    return this.layouts$.value.find(l => l.id === layoutId);
  }

  private initializeFromStorage(): void {
    try {
      const savedLayouts = localStorage.getItem(STORAGE_KEY);
      const activeLayoutId = localStorage.getItem(ACTIVE_LAYOUT_KEY);

      if (savedLayouts) {
        const layouts = JSON.parse(savedLayouts) as DashboardLayout[];
        this.layouts$.next(layouts);

        if (activeLayoutId && layouts.some(l => l.id === activeLayoutId)) {
          this.activeLayoutId$.next(activeLayoutId);
        } else if (layouts.length > 0) {
          this.activeLayoutId$.next(layouts[0].id);
        }
      } else {
        const defaultLayout = this.createDefaultLayout();
        this.layouts$.next([defaultLayout]);
        this.activeLayoutId$.next(defaultLayout.id);
        this.persistToStorage().subscribe();
      }
    } catch (error: unknown) {
      console.error('Failed to load layouts from storage:', error);
      const defaultLayout = this.createDefaultLayout();
      this.layouts$.next([defaultLayout]);
      this.activeLayoutId$.next(defaultLayout.id);
    }
  }

  private persistToStorage(): Observable<void> {
    return of(void 0).pipe(
      tap(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layouts$.value));
        if (this.activeLayoutId$.value) {
          localStorage.setItem(ACTIVE_LAYOUT_KEY, this.activeLayoutId$.value);
        }
      })
    );
  }
}
