import { Injectable } from '@angular/core';
import {
  Observable,
  Subject,
  BehaviorSubject,
  filter,
  map,
  withLatestFrom
} from 'rxjs';
import {
  LinkageEvent,
  WidgetConfig,
  TriggerEventType
} from '../../types/dashboard.types';

interface LinkageState {
  masterWidgets: Map<string, WidgetConfig>;
  slaveWidgets: Map<string, string[]>;
  lastEvent: Map<string, LinkageEvent>;
}

@Injectable({ providedIn: 'root' })
export class LinkageEventBusService {
  private readonly eventBus$ = new Subject<LinkageEvent>();
  private readonly state$ = new BehaviorSubject<LinkageState>({
    masterWidgets: new Map(),
    slaveWidgets: new Map(),
    lastEvent: new Map()
  });

  emit(event: LinkageEvent): void {
    this.eventBus$.next(event);
    this.updateLastEvent(event);
  }

  registerWidget(widget: WidgetConfig): void {
    if (widget.role === 'master') {
      this.registerMasterWidget(widget);
    } else if (widget.role === 'slave') {
      this.registerSlaveWidget(widget);
    }
  }

  unregisterWidget(widgetId: string): void {
    const currentState = this.state$.value;
    currentState.masterWidgets.delete(widgetId);
    currentState.slaveWidgets.forEach((masterIds, slaveId) => {
      currentState.slaveWidgets.set(
        slaveId,
        masterIds.filter(id => id !== widgetId)
      );
    });
    currentState.lastEvent.delete(widgetId);
    this.state$.next({ ...currentState });
  }

  updateWidgetConfig(widget: WidgetConfig): void {
    this.unregisterWidget(widget.id);
    this.registerWidget(widget);
  }

  getEventsForWidget(
    widgetId: string,
    eventTypes?: TriggerEventType[]
  ): Observable<LinkageEvent> {
    return this.eventBus$.pipe(
      withLatestFrom(this.state$),
      filter(([event, state]) => {
        const slaveMasters = state.slaveWidgets.get(widgetId);
        if (!slaveMasters?.includes(event.sourceWidgetId)) return false;
        if (eventTypes && !eventTypes.includes(event.eventType)) return false;
        return true;
      }),
      map(([event]) => event)
    );
  }

  getLastEvent(masterWidgetId: string): LinkageEvent | undefined {
    return this.state$.value.lastEvent.get(masterWidgetId);
  }

  getLastEvent$(widgetId: string): Observable<LinkageEvent | undefined> {
    return this.state$.pipe(
      map(state => {
        const slaveMasters = state.slaveWidgets.get(widgetId);
        if (!slaveMasters || slaveMasters.length === 0) return undefined;
        return state.lastEvent.get(slaveMasters[0]);
      })
    );
  }

  getMasterWidgets$(): Observable<WidgetConfig[]> {
    return this.state$.pipe(
      map(state => Array.from(state.masterWidgets.values()))
    );
  }

  isMasterWidget(widgetId: string): boolean {
    return this.state$.value.masterWidgets.has(widgetId);
  }

  isSlaveWidget(widgetId: string): boolean {
    return this.state$.value.slaveWidgets.has(widgetId);
  }

  getLinkedMasterIds(widgetId: string): string[] {
    return this.state$.value.slaveWidgets.get(widgetId) ?? [];
  }

  private registerMasterWidget(widget: WidgetConfig): void {
    const currentState = this.state$.value;
    currentState.masterWidgets.set(widget.id, widget);

    widget.linkage.targetWidgetIds.forEach(targetId => {
      const existingMasters = currentState.slaveWidgets.get(targetId) ?? [];
      if (!existingMasters.includes(widget.id)) {
        currentState.slaveWidgets.set(targetId, [...existingMasters, widget.id]);
      }
    });

    this.state$.next({ ...currentState });
  }

  private registerSlaveWidget(widget: WidgetConfig): void {
    const currentState = this.state$.value;
    if (!currentState.slaveWidgets.has(widget.id)) {
      currentState.slaveWidgets.set(widget.id, []);
    }
    this.state$.next({ ...currentState });
  }

  private updateLastEvent(event: LinkageEvent): void {
    const currentState = this.state$.value;
    currentState.lastEvent.set(event.sourceWidgetId, event);
    this.state$.next({ ...currentState });
  }
}
