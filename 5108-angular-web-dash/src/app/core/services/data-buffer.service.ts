import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { DataPoint, DEFAULT_BUFFER_SIZE } from '../../types/dashboard.types';

@Injectable({ providedIn: 'root' })
export class DataBufferService {
  private readonly buffers = new Map<string, RingBuffer>();
  private readonly destroy$ = new Subject<void>();

  createBuffer(streamId: string, size: number = DEFAULT_BUFFER_SIZE): BehaviorSubject<DataPoint[]> {
    if (!this.buffers.has(streamId)) {
      this.buffers.set(streamId, new RingBuffer(size));
    }
    return this.buffers.get(streamId)!.getData$();
  }

  getBuffer(streamId: string): BehaviorSubject<DataPoint[]> | undefined {
    return this.buffers.get(streamId)?.getData$();
  }

  addDataPoint(streamId: string, dataPoint: DataPoint): void {
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.add(dataPoint);
    }
  }

  addDataPoints(streamId: string, dataPoints: DataPoint[]): void {
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.addMany(dataPoints);
    }
  }

  getData$(streamId: string): Observable<DataPoint[]> | undefined {
    return this.buffers.get(streamId)?.getData$().asObservable();
  }

  getLatestDataPoint(streamId: string): DataPoint | undefined {
    return this.buffers.get(streamId)?.getLatest();
  }

  clearBuffer(streamId: string): void {
    this.buffers.get(streamId)?.clear();
  }

  destroyBuffer(streamId: string): void {
    const buffer = this.buffers.get(streamId);
    if (buffer) {
      buffer.complete();
      this.buffers.delete(streamId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.buffers.forEach(buffer => buffer.complete());
    this.buffers.clear();
  }
}

class RingBuffer {
  private readonly data: DataPoint[] = [];
  private readonly subject: BehaviorSubject<DataPoint[]>;
  private writeIndex = 0;

  constructor(private readonly maxSize: number) {
    this.subject = new BehaviorSubject<DataPoint[]>([]);
  }

  add(item: DataPoint): void {
    if (this.data.length < this.maxSize) {
      this.data.push(item);
    } else {
      this.data[this.writeIndex] = item;
      this.writeIndex = (this.writeIndex + 1) % this.maxSize;
    }
    this.emit();
  }

  addMany(items: DataPoint[]): void {
    items.forEach(item => this.add(item));
  }

  getLatest(): DataPoint | undefined {
    if (this.data.length === 0) return undefined;
    const latestIndex = this.writeIndex === 0 ? this.data.length - 1 : this.writeIndex - 1;
    return this.data[latestIndex];
  }

  getData$(): BehaviorSubject<DataPoint[]> {
    return this.subject;
  }

  clear(): void {
    this.data.length = 0;
    this.writeIndex = 0;
    this.emit();
  }

  complete(): void {
    this.subject.complete();
  }

  private emit(): void {
    const orderedData = this.getOrderedData();
    this.subject.next([...orderedData]);
  }

  private getOrderedData(): DataPoint[] {
    if (this.data.length < this.maxSize) {
      return this.data;
    }
    return [
      ...this.data.slice(this.writeIndex),
      ...this.data.slice(0, this.writeIndex)
    ];
  }
}
