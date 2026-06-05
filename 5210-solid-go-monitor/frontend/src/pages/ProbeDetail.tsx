import { createSignal, createResource, onMount, onCleanup, For } from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { api } from '../api';
import type { Probe, ProbeResult, ProbeStats } from '../types';

const TIME_RANGES = [
  { label: '1小时', hours: 1 },
  { label: '6小时', hours: 6 },
  { label: '24小时', hours: 24 },
  { label: '7天', hours: 24 * 7 },
];

export default function ProbeDetail() {
  const params = useParams();
  const probeId = () => params.id;

  const [probe, setProbe] = createSignal<Probe | null>(null);
  const [stats, setStats] = createSignal<ProbeStats>({
    successRate: 0, p50: 0, p95: 0, p99: 0,
    totalCount: 0, upCount: 0, downCount: 0,
  });
  const [results, setResults] = createSignal<ProbeResult[]>([]);
  const [failures, setFailures] = createSignal<ProbeResult[]>([]);
  const [timeRange, setTimeRange] = createSignal(24);
  const [testResult, setTestResult] = createSignal<ProbeResult | null>(null);
  const [testing, setTesting] = createSignal(false);

  const loadData = async () => {
    try {
      const [p, s, f] = await Promise.all([
        api.getProbe(probeId()),
        api.getStats(probeId()),
        api.getFailures(probeId(), 10),
      ]);
      setProbe(p);
      setStats(s);
      setFailures(f);
      loadResults();
    } catch (e) {
      console.error(e);
    }
  };

  const loadResults = async () => {
    try {
      const since = new Date(Date.now() - timeRange() * 3600 * 1000).toISOString();
      const data = await api.getResults(probeId(), { since });
      setResults(data);
    } catch (e) {
      console.error(e);
    }
  };

  let timer: number;
  onMount(() => {
    loadData();
    timer = window.setInterval(loadData, 10000);
  });
  onCleanup(() => clearInterval(timer));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testProbe(probeId());
      setTestResult(res);
    } catch (e) {
      alert('测试失败');
    } finally {
      setTesting(false);
    }
  };

  const exportPNG = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = results();
    if (data.length === 0) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;

    const times = data.map((r) => new Date(r.timestamp).getTime());
    const values = data.map((r) => r.responseTime);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const maxVal = Math.max(...values, 1);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
    }

    const gradient = ctx.createLinearGradient(0, padding, 0, padding + chartHeight);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');

    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    data.forEach((r, i) => {
      const x = padding + ((times[i] - minTime) / (maxTime - minTime || 1)) * chartWidth;
      const y = padding + chartHeight - (values[i] / maxVal) * chartHeight;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(canvas.width - padding, padding + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    data.forEach((r, i) => {
      const x = padding + ((times[i] - minTime) / (maxTime - minTime || 1)) * chartWidth;
      const y = padding + chartHeight - (values[i] / maxVal) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const y = padding + (chartHeight / 4) * i;
      const val = Math.round((maxVal / 4) * (4 - i));
      ctx.fillText(val + 'ms', padding - 8, y + 4);
    }

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${probe()?.name || ''} - 响应时间趋势`, padding, 20);

    const link = document.createElement('a');
    link.download = `probe-${probeId()}-chart.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const renderChart = () => {
    const data = results();
    if (data.length === 0) {
      return <div class="empty">暂无数据</div>;
    }

    const maxTime = Math.max(...data.map((r) => new Date(r.timestamp).getTime()));
    const minTime = Math.min(...data.map((r) => new Date(r.timestamp).getTime()));
    const maxVal = Math.max(...data.map((r) => r.responseTime), 1);

    const points = data.map((r) => {
      const x = ((new Date(r.timestamp).getTime() - minTime) / (maxTime - minTime || 1)) * 100;
      const y = 100 - (r.responseTime / maxVal) * 100;
      return `${x},${y}`;
    }).join(' ');

    const upCount = data.filter((r) => r.status === 'up').length;
    const successRate = ((upCount / data.length) * 100).toFixed(1);

    return (
      <div class="chart-container">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width: 100%; height: 100%;">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 25, 50, 75, 100].map((y) => (
            <line x1="0" y1={y} x2="100" y2={y} stroke="#f1f5f9" stroke-width="0.2" />
          ))}
          <polygon points={`0,100 ${points} 100,100`} fill="url(#chartGradient)" />
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            stroke-width="0.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div style="position: absolute; bottom: 8px; right: 12px; font-size: 12px; color: #64748b;">
          成功率: {successRate}%
        </div>
      </div>
    );
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTime = (t: string) => {
    const d = new Date(t);
    return d.toLocaleString('zh-CN');
  };

  return (
    <div>
      <A href="/probes" class="back-link">← 返回探针列表</A>

      <div class="page-header">
        <div>
          <h1 class="page-title">
            <span class={`status-dot ${probe()?.status || 'unknown'}`}></span>
            {probe()?.name || '加载中...'}
          </h1>
          <div style="color: #64748b; font-size: 14px; margin-top: 4px;">
            {probe()?.target}
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onClick={handleTest} disabled={testing()}>
            {testing() ? '测试中...' : '🔍 立即测试'}
          </button>
          <button class="btn btn-secondary" onClick={exportPNG}>
            📥 导出 PNG
          </button>
        </div>
      </div>

      {testResult() && (
        <div class="card" style="border-left: 4px solid #3b82f6;">
          <div class="card-header">
            <h3 class="card-title">测试结果</h3>
            <button class="btn btn-ghost btn-sm" onClick={() => setTestResult(null)}>✕</button>
          </div>
          <div style="display: flex; gap: 24px; flex-wrap: wrap;">
            <div class="info-item">
              <span class="info-label">状态</span>
              <span class={`info-value status-${testResult()!.status}`}>
                {testResult()!.status === 'up' ? '正常' : '异常'}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">响应时间</span>
              <span class="info-value">{testResult()!.responseTime}ms</span>
            </div>
            {testResult()!.httpStatus && (
              <div class="info-item">
                <span class="info-label">HTTP 状态</span>
                <span class="info-value">{testResult()!.httpStatus}</span>
              </div>
            )}
            {testResult()!.errorMessage && (
              <div class="info-item" style="flex: 1; min-width: 200px;">
                <span class="info-label">错误信息</span>
                <span class="info-value" style="color: #ef4444; font-family: monospace; font-size: 12px; word-break: break-all;">
                  {testResult()!.errorMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {probe() && (
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">基本信息</h2>
          </div>
          <div class="detail-info">
            <div class="info-item">
              <span class="info-label">类型</span>
              <span class="info-value">
                <span class={`probe-type-badge ${probe()!.type}`}>
                  {probe()!.type.toUpperCase()}
                </span>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">目标</span>
              <span class="info-value" style="font-family: monospace;">{probe()!.target}</span>
            </div>
            <div class="info-item">
              <span class="info-label">分组</span>
              <span class="info-value">{probe()!.group}</span>
            </div>
            <div class="info-item">
              <span class="info-label">检测间隔</span>
              <span class="info-value">{probe()!.interval} 秒</span>
            </div>
            <div class="info-item">
              <span class="info-label">超时</span>
              <span class="info-value">{probe()!.timeout} 秒</span>
            </div>
            <div class="info-item">
              <span class="info-label">失败阈值</span>
              <span class="info-value">{probe()!.failureThreshold} 次</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <span class="info-value">
                {probe()!.enabled ? '已启用' : '已禁用'}
              </span>
            </div>
            {probe()!.webhookUrl && (
              <div class="info-item" style="flex: 1; min-width: 200px;">
                <span class="info-label">Webhook</span>
                <span class="info-value" style="font-family: monospace; font-size: 12px;">
                  {probe()!.webhookUrl}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-label">成功率</div>
          <div class={`stat-card-value ${stats().successRate >= 99 ? 'up' : stats().successRate >= 80 ? 'warning' : 'down'}`}>
            {stats().successRate.toFixed(1)}%
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">P50 响应时间</div>
          <div class="stat-card-value">{formatDuration(stats().p50)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">P95 响应时间</div>
          <div class="stat-card-value">{formatDuration(stats().p95)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">P99 响应时间</div>
          <div class="stat-card-value">{formatDuration(stats().p99)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">总检测次数</div>
          <div class="stat-card-value">{stats().totalCount}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">响应时间趋势</h2>
          <div class="time-range-selector">
            <For each={TIME_RANGES}>
              {(r) => (
                <button
                  class={`time-btn ${timeRange() === r.hours ? 'active' : ''}`}
                  onClick={() => {
                    setTimeRange(r.hours);
                    loadResults();
                  }}
                >
                  {r.label}
                </button>
              )}
            </For>
          </div>
        </div>
        {renderChart()}
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">最近 10 次失败</h2>
          <span style="font-size: 13px; color: #64748b;">
            共 {failures().length} 次
          </span>
        </div>
        {failures().length === 0 ? (
          <div class="empty">暂无失败记录</div>
        ) : (
          <ul class="failure-list">
            <For each={failures()}>
              {(f) => (
                <li class="failure-item">
                  <div class="failure-time">{formatTime(f.timestamp)}</div>
                  <div class="failure-msg">
                    {f.errorMessage || '未知错误'}
                    {f.httpStatus && ` (HTTP ${f.httpStatus})`}
                  </div>
                </li>
              )}
            </For>
          </ul>
        )}
      </div>
    </div>
  );
}
