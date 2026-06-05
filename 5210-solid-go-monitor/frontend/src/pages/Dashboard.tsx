import { createSignal, createResource, onMount, onCleanup, For, lazy, Suspense } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import type { Probe, Overview } from '../types';

const LazyGroupProbes = lazy(() => import('../components/GroupProbes'));

export default function Dashboard() {
  const [overview, setOverview] = createSignal<Overview | null>(null);
  const [probes, setProbes] = createSignal<Probe[]>([]);
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = createSignal<string>('all');

  const loadData = async () => {
    try {
      const [ov, pr] = await Promise.all([
        api.getOverview(),
        api.getProbes(),
      ]);
      setOverview(ov);
      setProbes(pr);

      const groups = new Set(ov.groups);
      setExpandedGroups(groups);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  };

  let timer: number;
  onMount(() => {
    loadData();
    timer = window.setInterval(loadData, 10000);
  });
  onCleanup(() => clearInterval(timer));

  const toggleGroup = (group: string) => {
    const newSet = new Set(expandedGroups());
    if (newSet.has(group)) {
      newSet.delete(group);
    } else {
      newSet.add(group);
    }
    setExpandedGroups(newSet);
  };

  const filteredProbes = () => {
    const filter = statusFilter();
    if (filter === 'all') return probes();
    return probes().filter(p => {
      if (filter === 'enabled') return p.enabled;
      if (filter === 'disabled') return !p.enabled;
      if (filter === 'alert') return p.status === 'down' && p.enabled;
      return p.status === filter;
    });
  };

  const groupedProbes = () => {
    const groups: Record<string, Probe[]> = {};
    for (const probe of filteredProbes()) {
      if (!groups[probe.group]) {
        groups[probe.group] = [];
      }
      groups[probe.group].push(probe);
    }
    return groups;
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
  };

  const onDrop = async (e: DragEvent, group: string) => {
    e.preventDefault();
    const probeId = e.dataTransfer!.getData('text/plain');
    if (!probeId) return;

    try {
      await api.patchProbe(probeId, { group });
      loadData();
    } catch (err) {
      console.error('Failed to move probe:', err);
    }
  };

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">监控总览</h1>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-label">探针总数</div>
          <div class="stat-card-value">{overview()?.total ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">正常</div>
          <div class="stat-card-value up">{overview()?.up ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">异常</div>
          <div class="stat-card-value down">{overview()?.down ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">当前告警</div>
          <div class="stat-card-value warning">{overview()?.alerts ?? 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">已禁用</div>
          <div class="stat-card-value">{overview()?.disabled ?? 0}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">探针分组</h2>
          <div class="filter-group">
            <button
              class={`filter-btn ${statusFilter() === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              全部
            </button>
            <button
              class={`filter-btn ${statusFilter() === 'up' ? 'active' : ''}`}
              onClick={() => setStatusFilter('up')}
            >
              正常
            </button>
            <button
              class={`filter-btn ${statusFilter() === 'alert' ? 'active' : ''}`}
              onClick={() => setStatusFilter('alert')}
            >
              告警
            </button>
            <button
              class={`filter-btn ${statusFilter() === 'disabled' ? 'active' : ''}`}
              onClick={() => setStatusFilter('disabled')}
            >
              禁用
            </button>
          </div>
        </div>

        <div class="groups-container">
          <For each={Object.entries(groupedProbes())}>
            {([group, groupProbes]) => (
              <div class="group-section">
                <div class="group-header" onClick={() => toggleGroup(group)}>
                  <div class="group-name">
                    <span>{expandedGroups().has(group) ? '▼' : '▶'}</span>
                    {group}
                    <span class="group-count">({groupProbes.length})</span>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <span class="status-dot up" style="margin-left: 8px;"></span>
                    <span style="font-size: 12px; color: #64748b;">
                      {groupProbes.filter(p => p.status === 'up').length} 正常
                    </span>
                    <span class="status-dot down"></span>
                    <span style="font-size: 12px; color: #64748b;">
                      {groupProbes.filter(p => p.status === 'down').length} 异常
                    </span>
                  </div>
                </div>
                {expandedGroups().has(group) && (
                  <Suspense fallback={<div class="loading">加载中...</div>}>
                    <LazyGroupProbes
                      probes={groupProbes}
                      group={group}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                    />
                  </Suspense>
                )}
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
