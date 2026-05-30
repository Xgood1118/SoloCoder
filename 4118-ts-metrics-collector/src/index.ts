export * from './types';
export * from './utils';
export * from './metrics';
export * from './Registry';
export * from './Exporter';
export * from './Aggregator';
export * from './Collector';
export * from './Alerter';
export * from './storage';
export * from './server';

import { Registry, defaultRegistry, register } from './Registry';
import { Counter } from './metrics/Counter';
import { Gauge } from './metrics/Gauge';
import { Histogram } from './metrics/Histogram';
import { Summary } from './metrics/Summary';
import { PrometheusExporter, prometheusExporter } from './Exporter';
import { Aggregator } from './Aggregator';
import { Alerter } from './Alerter';
import { Collector } from './Collector';
import { MetricsServer } from './server';

export const metrics = {
  Registry,
  defaultRegistry,
  register,
  Counter,
  Gauge,
  Histogram,
  Summary,
  PrometheusExporter,
  prometheusExporter,
  Aggregator,
  Alerter,
  Collector,
  MetricsServer,

  createCounter: (options: ConstructorParameters<typeof Counter>[0]) => {
    return defaultRegistry.createCounter(options);
  },

  createGauge: (options: ConstructorParameters<typeof Gauge>[0]) => {
    return defaultRegistry.createGauge(options);
  },

  createHistogram: (options: ConstructorParameters<typeof Histogram>[0]) => {
    return defaultRegistry.createHistogram(options);
  },

  createSummary: (options: ConstructorParameters<typeof Summary>[0]) => {
    return defaultRegistry.createSummary(options);
  },

  collect: () => defaultRegistry.collect(),
  export: () => prometheusExporter.export(),
  exportAsJSON: () => prometheusExporter.exportAsJSON(),
};

export default metrics;
