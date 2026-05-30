import {
  Labels,
  MetricType,
  MetricOptions,
  MetricSnapshot,
} from '../types';
import { labelsToKey, validateLabelName, validateMetricName } from '../utils';

export abstract class Metric<T extends MetricOptions> {
  protected readonly name: string;
  protected readonly help: string;
  protected readonly type: MetricType;
  protected readonly unit?: string;
  protected readonly labelNames: string[];

  constructor(options: T) {
    if (!validateMetricName(options.name)) {
      throw new Error(`Invalid metric name: ${options.name}`);
    }
    if (options.labelNames) {
      for (const labelName of options.labelNames) {
        if (!validateLabelName(labelName)) {
          throw new Error(`Invalid label name: ${labelName}`);
        }
      }
    }

    this.name = options.name;
    this.help = options.help;
    this.type = options.type;
    this.unit = options.unit;
    this.labelNames = options.labelNames || [];
  }

  getName(): string {
    return this.name;
  }

  getType(): MetricType {
    return this.type;
  }

  getHelp(): string {
    return this.help;
  }

  getUnit(): string | undefined {
    return this.unit;
  }

  getLabelNames(): string[] {
    return [...this.labelNames];
  }

  protected getKey(labels: Labels): string {
    const providedLabelNames = Object.keys(labels);
    const missingLabels = this.labelNames.filter((ln) => !providedLabelNames.includes(ln));
    if (missingLabels.length > 0) {
      throw new Error(`Missing labels for metric ${this.name}: ${missingLabels.join(', ')}`);
    }

    const extraLabels = providedLabelNames.filter((ln) => !this.labelNames.includes(ln));
    if (extraLabels.length > 0) {
      throw new Error(`Extra labels for metric ${this.name}: ${extraLabels.join(', ')}`);
    }

    return labelsToKey(labels);
  }

  abstract reset(): void;

  abstract get(labels?: Labels): number;

  abstract getSnapshot(): MetricSnapshot;

  abstract collect(): MetricSnapshot;
}
