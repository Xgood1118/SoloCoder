import { Injectable } from '@angular/core';
import {
  Observable,
  interval,
  Subject,
  of,
  BehaviorSubject
} from 'rxjs';
import {
  map,
  takeUntil,
  tap,
  share,
  catchError,
  distinctUntilChanged
} from 'rxjs/operators';
import {
  DataPoint,
  ConnectionStatus,
  DEFAULT_BUFFER_SIZE
} from '../../types/dashboard.types';
import { DataBufferService } from './data-buffer.service';

interface StreamSimulator {
  destroy$: Subject<void>;
  config: {
    streamId: string;
    minValue: number;
    maxValue: number;
    interval: number;
    trend: 'random' | 'increasing' | 'decreasing' | 'sine';
  };
}

@Injectable({ providedIn: 'root' })
export class MockDataService {
  private readonly simulators = new Map<string, StreamSimulator>();
  private readonly connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
    connected: true,
    reconnecting: false,
    attempt: 0
  });

  constructor(private readonly dataBufferService: DataBufferService) {}

  getConnectionStatus$(): Observable<ConnectionStatus> {
    return this.connectionStatus$.asObservable().pipe(distinctUntilChanged());
  }

  subscribe(streamId: string, bufferSize: number = DEFAULT_BUFFER_SIZE): Observable<DataPoint[]> {
    if (!this.simulators.has(streamId)) {
      this.createSimulator(streamId, bufferSize);
    }
    return this.dataBufferService.getData$(streamId) ?? of([]);
  }

  unsubscribe(streamId: string): void {
    const simulator = this.simulators.get(streamId);
    if (simulator) {
      simulator.destroy$.next();
      simulator.destroy$.complete();
      this.simulators.delete(streamId);
    }
    this.dataBufferService.destroyBuffer(streamId);
  }

  disconnect(): void {
    this.simulators.forEach(sim => {
      sim.destroy$.next();
      sim.destroy$.complete();
    });
    this.simulators.clear();
    this.connectionStatus$.next({
      connected: false,
      reconnecting: false,
      attempt: 0
    });
  }

  private createSimulator(streamId: string, bufferSize: number): void {
    const config = this.getStreamConfig(streamId);
    const destroy$ = new Subject<void>();

    this.dataBufferService.createBuffer(streamId, bufferSize);

    interval(config.interval).pipe(
      takeUntil(destroy$),
      map(() => this.generateDataPoint(config)),
      tap(dataPoint => this.dataBufferService.addDataPoint(streamId, dataPoint)),
      catchError((error: unknown) => {
        console.error(`Mock stream ${streamId} error:`, error);
        return of(null);
      }),
      share()
    ).subscribe();

    this.simulators.set(streamId, { destroy$, config });
  }

  private getStreamConfig(streamId: string): StreamSimulator['config'] {
    const configs: Record<string, Partial<StreamSimulator['config']>> = {
      'cpu-usage': { minValue: 10, maxValue: 90, interval: 1000, trend: 'sine' },
      'memory-usage': { minValue: 30, maxValue: 80, interval: 1500, trend: 'random' },
      'disk-io': { minValue: 0, maxValue: 100, interval: 800, trend: 'random' },
      'network-in': { minValue: 10, maxValue: 100, interval: 500, trend: 'random' },
      'network-out': { minValue: 5, maxValue: 80, interval: 500, trend: 'random' },
      'response-time': { minValue: 50, maxValue: 500, interval: 2000, trend: 'sine' },
      'error-rate': { minValue: 0, maxValue: 10, interval: 3000, trend: 'random' },
      'active-users': { minValue: 100, maxValue: 1000, interval: 2000, trend: 'sine' },
      'server-load': { minValue: 0, maxValue: 100, interval: 1200, trend: 'random' },
      'disk-usage': { minValue: 20, maxValue: 95, interval: 5000, trend: 'increasing' },
      'database-conn': { minValue: 10, maxValue: 100, interval: 1500, trend: 'random' },
      'api-requests': { minValue: 100, maxValue: 10000, interval: 1000, trend: 'sine' }
    };

    const baseConfig = {
      streamId,
      minValue: 0,
      maxValue: 100,
      interval: 1000,
      trend: 'random' as const
    };

    return { ...baseConfig, ...configs[streamId] };
  }

  private generateDataPoint(config: StreamSimulator['config']): DataPoint {
    const now = Date.now();
    let value: number;

    switch (config.trend) {
      case 'sine':
        value = this.generateSineValue(config, now);
        break;
      case 'increasing':
        value = this.generateIncreasingValue(config, now);
        break;
      case 'decreasing':
        value = this.generateDecreasingValue(config, now);
        break;
      default:
        value = this.generateRandomValue(config);
    }

    return {
      timestamp: now,
      value: Math.round(value * 100) / 100,
      label: this.generateLabel(config.streamId, value)
    };
  }

  private generateRandomValue(config: StreamSimulator['config']): number {
    return config.minValue + Math.random() * (config.maxValue - config.minValue);
  }

  private generateSineValue(config: StreamSimulator['config'], time: number): number {
    const period = 60000;
    const amplitude = (config.maxValue - config.minValue) / 2;
    const offset = config.minValue + amplitude;
    const phase = (time % period) / period * 2 * Math.PI;
    return offset + Math.sin(phase) * amplitude * (0.8 + Math.random() * 0.4);
  }

  private generateIncreasingValue(config: StreamSimulator['config'], time: number): number {
    const period = 300000;
    const progress = (time % period) / period;
    const baseValue = config.minValue + progress * (config.maxValue - config.minValue);
    return baseValue + (Math.random() - 0.5) * 5;
  }

  private generateDecreasingValue(config: StreamSimulator['config'], time: number): number {
    const period = 300000;
    const progress = 1 - (time % period) / period;
    const baseValue = config.minValue + progress * (config.maxValue - config.minValue);
    return baseValue + (Math.random() - 0.5) * 5;
  }

  private generateLabel(streamId: string, value: number): string {
    const labels: Record<string, (value: number) => string> = {
      'cpu-usage': (v) => `${v.toFixed(1)}%`,
      'memory-usage': (v) => `${v.toFixed(1)}%`,
      'disk-io': (v) => `${v.toFixed(1)} MB/s`,
      'network-in': (v) => `${v.toFixed(1)} Mbps`,
      'network-out': (v) => `${v.toFixed(1)} Mbps`,
      'response-time': (v) => `${v.toFixed(0)} ms`,
      'error-rate': (v) => `${v.toFixed(2)}%`,
      'active-users': (v) => `${v.toFixed(0)}`,
      'server-load': (v) => `${v.toFixed(1)}%`,
      'disk-usage': (v) => `${v.toFixed(1)}%`,
      'database-conn': (v) => `${v.toFixed(0)}`,
      'api-requests': (v) => `${v.toFixed(0)}/s`
    };

    const formatter = labels[streamId];
    return formatter ? formatter(value) : value.toFixed(2);
  }

  getAvailableStreams(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'cpu-usage', name: 'CPU 使用率', description: '服务器 CPU 使用率百分比' },
      { id: 'memory-usage', name: '内存使用率', description: '服务器内存使用率百分比' },
      { id: 'disk-io', name: '磁盘 I/O', description: '磁盘读写速率' },
      { id: 'network-in', name: '网络入流量', description: '网络入口带宽' },
      { id: 'network-out', name: '网络出流量', description: '网络出口带宽' },
      { id: 'response-time', name: '响应时间', description: 'API 平均响应时间' },
      { id: 'error-rate', name: '错误率', description: '请求错误率' },
      { id: 'active-users', name: '活跃用户', description: '当前活跃用户数' },
      { id: 'server-load', name: '服务器负载', description: '服务器综合负载' },
      { id: 'disk-usage', name: '磁盘使用率', description: '磁盘空间使用率' },
      { id: 'database-conn', name: '数据库连接', description: '数据库连接数' },
      { id: 'api-requests', name: 'API 请求量', description: '每秒 API 请求数' }
    ];
  }
}
