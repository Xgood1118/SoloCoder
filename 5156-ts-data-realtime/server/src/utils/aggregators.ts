import type { AggregationType } from '../types';

export interface Aggregator {
  add(value: number): void;
  remove(value: number): void;
  getResult(): number;
  reset(): void;
}

class SumAggregator implements Aggregator {
  private sum: number = 0;
  private count: number = 0;

  add(value: number): void {
    this.sum += value;
    this.count++;
  }

  remove(value: number): void {
    this.sum -= value;
    this.count--;
  }

  getResult(): number {
    return this.count === 0 ? 0 : this.sum;
  }

  reset(): void {
    this.sum = 0;
    this.count = 0;
  }
}

class AvgAggregator implements Aggregator {
  private sum: number = 0;
  private count: number = 0;

  add(value: number): void {
    this.sum += value;
    this.count++;
  }

  remove(value: number): void {
    this.sum -= value;
    this.count--;
  }

  getResult(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  reset(): void {
    this.sum = 0;
    this.count = 0;
  }
}

class MaxAggregator implements Aggregator {
  private values: number[] = [];

  add(value: number): void {
    this.values.push(value);
  }

  remove(value: number): void {
    const index = this.values.indexOf(value);
    if (index !== -1) {
      this.values.splice(index, 1);
    }
  }

  getResult(): number {
    return this.values.length === 0 ? 0 : Math.max(...this.values);
  }

  reset(): void {
    this.values = [];
  }
}

class MinAggregator implements Aggregator {
  private values: number[] = [];

  add(value: number): void {
    this.values.push(value);
  }

  remove(value: number): void {
    const index = this.values.indexOf(value);
    if (index !== -1) {
      this.values.splice(index, 1);
    }
  }

  getResult(): number {
    return this.values.length === 0 ? 0 : Math.min(...this.values);
  }

  reset(): void {
    this.values = [];
  }
}

class CountAggregator implements Aggregator {
  private count: number = 0;

  add(): void {
    this.count++;
  }

  remove(): void {
    this.count--;
  }

  getResult(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
  }
}

const aggregatorFactories: Record<AggregationType, () => Aggregator> = {
  sum: () => new SumAggregator(),
  avg: () => new AvgAggregator(),
  max: () => new MaxAggregator(),
  min: () => new MinAggregator(),
  count: () => new CountAggregator(),
};

export function createAggregator(type: AggregationType): Aggregator {
  const factory = aggregatorFactories[type];
  if (!factory) {
    throw new Error(`Unknown aggregation type: ${type}`);
  }
  return factory();
}
