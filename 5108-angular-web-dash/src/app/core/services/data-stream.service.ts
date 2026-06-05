import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DataPoint, ConnectionStatus, DEFAULT_BUFFER_SIZE } from '../../types/dashboard.types';
import { WebSocketService } from './websocket.service';
import { MockDataService } from './mock-data.service';

export type DataSourceType = 'websocket' | 'mock';

@Injectable({ providedIn: 'root' })
export class DataStreamService {
  private dataSource: DataSourceType = 'mock';

  constructor(
    private readonly websocketService: WebSocketService,
    private readonly mockDataService: MockDataService
  ) {}

  setDataSource(source: DataSourceType): void {
    this.dataSource = source;
  }

  getDataSource(): DataSourceType {
    return this.dataSource;
  }

  subscribe(streamId: string, bufferSize: number = DEFAULT_BUFFER_SIZE): Observable<DataPoint[]> {
    switch (this.dataSource) {
      case 'websocket':
        return this.websocketService.subscribe(streamId, bufferSize);
      case 'mock':
      default:
        return this.mockDataService.subscribe(streamId, bufferSize);
    }
  }

  unsubscribe(streamId: string): void {
    switch (this.dataSource) {
      case 'websocket':
        this.websocketService.unsubscribe(streamId);
        break;
      case 'mock':
      default:
        this.mockDataService.unsubscribe(streamId);
        break;
    }
  }

  getConnectionStatus$(): Observable<ConnectionStatus> {
    switch (this.dataSource) {
      case 'websocket':
        return this.websocketService.getConnectionStatus$();
      case 'mock':
      default:
        return this.mockDataService.getConnectionStatus$();
    }
  }

  disconnect(): void {
    switch (this.dataSource) {
      case 'websocket':
        this.websocketService.disconnect();
        break;
      case 'mock':
      default:
        this.mockDataService.disconnect();
        break;
    }
  }

  getAvailableStreams(): Array<{ id: string; name: string; description: string }> {
    return this.mockDataService.getAvailableStreams();
  }
}
