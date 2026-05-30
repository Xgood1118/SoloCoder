import * as http from 'http';
import { URL } from 'url';
import { PrometheusExporter } from './Exporter';
import { Registry } from './Registry';
import { Alerter } from './Alerter';
import { AlertStatus, AlertSeverity } from './types';
import { Aggregator } from './Aggregator';
import { Collector } from './Collector';

export interface ServerOptions {
  port?: number;
  host?: string;
  metricsPath?: string;
  registry?: Registry;
  exporter?: PrometheusExporter;
  alerter?: Alerter;
  aggregator?: Aggregator;
  collector?: Collector;
}

export class MetricsServer {
  private port: number;
  private host: string;
  private metricsPath: string;
  private registry: Registry;
  private exporter: PrometheusExporter;
  private alerter?: Alerter;
  private aggregator?: Aggregator;
  private collector?: Collector;
  private server?: http.Server;
  private isRunning: boolean = false;

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 9090;
    this.host = options.host || '0.0.0.0';
    this.metricsPath = options.metricsPath || '/metrics';
    this.registry = options.registry || Registry.getInstance();
    this.exporter = options.exporter || new PrometheusExporter({ register: this.registry });
    this.alerter = options.alerter;
    this.aggregator = options.aggregator;
    this.collector = options.collector;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      this.server.listen(this.port, this.host, () => {
        this.isRunning = true;
        console.log(`Metrics server listening on http://${this.host}:${this.port}`);
        console.log(`Metrics endpoint: http://${this.host}:${this.port}${this.metricsPath}`);
        resolve();
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.isRunning = false;
          resolve();
        }
      });
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === this.metricsPath) {
        this.handleMetrics(req, res);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/health') {
        this.handleHealth(req, res);
        return;
      }

      if (url.pathname.startsWith('/api/alerts')) {
        this.handleAlertsAPI(req, res, url);
        return;
      }

      if (url.pathname.startsWith('/api/metrics')) {
        this.handleMetricsAPI(req, res, url);
        return;
      }

      if (url.pathname.startsWith('/api/status')) {
        this.handleStatusAPI(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      console.error('Request handling error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private handleMetrics(_req: http.IncomingMessage, res: http.ServerResponse): void {
    const output = this.exporter.export();
    res.writeHead(200, {
      'Content-Type': this.exporter.contentType(),
      'Content-Length': Buffer.byteLength(output),
    });
    res.end(output);
  }

  private handleHealth(_req: http.IncomingMessage, res: http.ServerResponse): void {
    const response = {
      status: 'ok',
      timestamp: Date.now(),
      isRunning: this.isRunning,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
  }

  private async handleAlertsAPI(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    if (!this.alerter) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Alerter not configured' }));
      return;
    }

    const path = url.pathname.replace('/api/alerts', '');

    if (req.method === 'GET' && (path === '' || path === '/')) {
      const status = url.searchParams.get('status') as AlertStatus | undefined;
      const severity = url.searchParams.get('severity') as AlertSeverity | undefined;
      const alerts = this.alerter.getAlerts(status, severity);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alerts }));
      return;
    }

    if (req.method === 'GET' && path.startsWith('/rules')) {
      const rules = this.alerter.getAllRules();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ rules }));
      return;
    }

    if (req.method === 'GET' && path.startsWith('/stats')) {
      const stats = this.alerter.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.method === 'POST' && path.startsWith('/acknowledge/')) {
      const alertId = path.replace('/acknowledge/', '');
      const body = await this.parseBody(req);
      const acknowledgedBy = body.acknowledgedBy as string || 'anonymous';
      const success = this.alerter.acknowledgeAlert(alertId, acknowledgedBy);
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Alert not found' }));
      }
      return;
    }

    if (req.method === 'POST' && path.startsWith('/resolve/')) {
      const alertId = path.replace('/resolve/', '');
      const success = this.alerter.resolveAlert(alertId);
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Alert not found' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private async handleMetricsAPI(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
  ): Promise<void> {
    const path = url.pathname.replace('/api/metrics', '');

    if (req.method === 'GET' && (path === '' || path === '/')) {
      const snapshots = this.registry.getSnapshots();
      const metricList = snapshots.map((s) => ({
        name: s.name,
        type: s.type,
        help: s.help,
        unit: s.unit,
        values: s.values,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ metrics: metricList }));
      return;
    }

    if (req.method === 'GET' && path.startsWith('/snapshot')) {
      const snapshots = this.registry.getMetricsAsJSON();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: snapshots }));
      return;
    }

    if (req.method === 'POST' && path.startsWith('/ingest')) {
      const body = await this.parseBody(req);
      if (Array.isArray(body)) {
        for (const point of body) {
          const metric = this.registry.get(point.metricName);
          if (metric) {
            if ('inc' in metric && typeof metric.inc === 'function') {
              metric.inc(point.value || 1, point.labels || {});
            } else if ('set' in metric && typeof metric.set === 'function') {
              metric.set(point.value, point.labels || {});
            } else if ('observe' in metric && typeof metric.observe === 'function') {
              metric.observe(point.value, point.labels || {});
            }
          }
          if (this.aggregator) {
            this.aggregator.observe(point.metricName, point.value, point.labels || {});
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: body.length }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid body' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  private handleStatusAPI(_req: http.IncomingMessage, res: http.ServerResponse): void {
    const status: Record<string, unknown> = {
      server: {
        isRunning: this.isRunning,
        port: this.port,
        host: this.host,
      },
      registry: {
        metricCount: this.registry.getMetricNames().length,
        metrics: this.registry.getMetricNames(),
      },
    };

    if (this.aggregator) {
      status.aggregator = this.aggregator.getStats();
    }

    if (this.alerter) {
      status.alerter = this.alerter.getStats();
    }

    if (this.collector) {
      status.collector = this.collector.getStats();
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  private parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  }

  getPort(): number {
    return this.port;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }
}

if (require.main === module) {
  const server = new MetricsServer({ port: 9090 });
  server.start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
