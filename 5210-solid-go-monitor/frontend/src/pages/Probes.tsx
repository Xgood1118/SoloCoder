import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import type { Probe, CreateProbeRequest, ProbeType } from '../types';

export default function Probes() {
  const [probes, setProbes] = createSignal<Probe[]>([]);
  const [showModal, setShowModal] = createSignal(false);
  const [editingProbe, setEditingProbe] = createSignal<Probe | null>(null);
  const [statusFilter, setStatusFilter] = createSignal<string>('all');
  const [importText, setImportText] = createSignal('');
  const [showImport, setShowImport] = createSignal(false);

  const [form, setForm] = createSignal<CreateProbeRequest>({
    name: '',
    type: 'http',
    target: '',
    interval: 30,
    timeout: 10,
    group: 'default',
    enabled: true,
    failureThreshold: 3,
    webhookUrl: '',
  });

  const loadProbes = async () => {
    try {
      const data = await api.getProbes();
      setProbes(data);
    } catch (e) {
      console.error(e);
    }
  };

  let timer: number;
  onMount(() => {
    loadProbes();
    timer = window.setInterval(loadProbes, 10000);
  });
  onCleanup(() => clearInterval(timer));

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

  const openCreate = () => {
    setEditingProbe(null);
    setForm({
      name: '',
      type: 'http',
      target: '',
      interval: 30,
      timeout: 10,
      group: 'default',
      enabled: true,
      failureThreshold: 3,
      webhookUrl: '',
    });
    setShowModal(true);
  };

  const openEdit = (probe: Probe) => {
    setEditingProbe(probe);
    setForm({
      name: probe.name,
      type: probe.type,
      target: probe.target,
      interval: probe.interval,
      timeout: probe.timeout,
      group: probe.group,
      enabled: probe.enabled,
      failureThreshold: probe.failureThreshold,
      webhookUrl: probe.webhookUrl || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    try {
      if (editingProbe()) {
        await api.updateProbe(editingProbe()!.id, form());
      } else {
        await api.createProbe(form());
      }
      setShowModal(false);
      loadProbes();
    } catch (e) {
      alert('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个探针吗？')) return;
    try {
      await api.deleteProbe(id);
      loadProbes();
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleClone = async (id: string) => {
    try {
      await api.cloneProbe(id);
      loadProbes();
    } catch (e) {
      alert('克隆失败');
    }
  };

  const toggleEnabled = async (probe: Probe) => {
    try {
      await api.patchProbe(probe.id, { enabled: !probe.enabled });
      loadProbes();
    } catch (e) {
      alert('操作失败');
    }
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importText());
      await api.importProbes(data);
      setShowImport(false);
      setImportText('');
      loadProbes();
    } catch (e) {
      alert('导入失败，请检查 JSON 格式');
    }
  };

  const formatType = (type: ProbeType) => {
    const map: Record<ProbeType, string> = {
      http: 'HTTP',
      tcp: 'TCP',
      process: '进程',
    };
    return map[type] || type;
  };

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">探针管理</h1>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onClick={() => setShowImport(true)}>
            📥 批量导入
          </button>
          <button class="btn btn-primary" onClick={openCreate}>
            + 新建探针
          </button>
        </div>
      </div>

      <div class="card">
        <div class="filter-bar">
          <div class="filter-group">
            <button
              class={`filter-btn ${statusFilter() === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              全部 ({probes().length})
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
              已禁用
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>名称</th>
                <th>类型</th>
                <th>目标</th>
                <th>分组</th>
                <th>间隔</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <For each={filteredProbes()}>
                {(probe) => (
                  <tr>
                    <td>
                      <span class={`status-dot ${probe.status}`}></span>
                      <span class={`status-${probe.status}`}>
                        {probe.status === 'up' ? '正常' : probe.status === 'down' ? '异常' : probe.status === 'disabled' ? '已禁用' : '未知'}
                      </span>
                    </td>
                    <td>
                      <A href={`/probes/${probe.id}`} style="color: inherit; text-decoration: none; font-weight: 500;">
                        {probe.name}
                      </A>
                    </td>
                    <td>
                      <span class={`probe-type-badge ${probe.type}`}>
                        {formatType(probe.type)}
                      </span>
                    </td>
                    <td style="font-family: monospace; font-size: 13px;">{probe.target}</td>
                    <td>{probe.group}</td>
                    <td>{probe.interval}s</td>
                    <td>
                      <div style="display: flex; gap: 4px;">
                        <button
                          class="btn btn-sm btn-ghost"
                          onClick={() => toggleEnabled(probe)}
                          title={probe.enabled ? '禁用' : '启用'}
                        >
                          {probe.enabled ? '⏸' : '▶'}
                        </button>
                        <button
                          class="btn btn-sm btn-ghost"
                          onClick={() => handleClone(probe.id)}
                          title="克隆"
                        >
                          📋
                        </button>
                        <button
                          class="btn btn-sm btn-ghost"
                          onClick={() => openEdit(probe)}
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          class="btn btn-sm btn-ghost"
                          onClick={() => handleDelete(probe.id)}
                          title="删除"
                          style="color: #ef4444;"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          {filteredProbes().length === 0 && (
            <div class="empty">暂无探针</div>
          )}
        </div>
      </div>

      {showModal() && (
        <div class="modal-overlay" onClick={() => setShowModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3 class="modal-title">
                {editingProbe() ? '编辑探针' : '新建探针'}
              </h3>
              <button class="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div class="form-group">
                <label class="form-label">名称</label>
                <input
                  class="form-input"
                  type="text"
                  value={form().name}
                  onInput={(e) => setForm({ ...form(), name: e.currentTarget.value })}
                  required
                />
              </div>
              <div class="form-group">
                <label class="form-label">类型</label>
                <select
                  class="form-select"
                  value={form().type}
                  onChange={(e) => setForm({ ...form(), type: e.currentTarget.value as ProbeType })}
                >
                  <option value="http">HTTP 接口</option>
                  <option value="tcp">TCP 端口</option>
                  <option value="process">进程</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">目标</label>
                <input
                  class="form-input"
                  type="text"
                  placeholder={
                    form().type === 'http'
                      ? 'https://example.com'
                      : form().type === 'tcp'
                      ? 'host:port'
                      : '进程名（如 nginx）'
                  }
                  value={form().target}
                  onInput={(e) => setForm({ ...form(), target: e.currentTarget.value })}
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">检测间隔（秒）</label>
                  <input
                    class="form-input"
                    type="number"
                    min="5"
                    value={form().interval}
                    onInput={(e) => setForm({ ...form(), interval: parseInt(e.currentTarget.value) || 30 })}
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">超时（秒）</label>
                  <input
                    class="form-input"
                    type="number"
                    min="1"
                    value={form().timeout}
                    onInput={(e) => setForm({ ...form(), timeout: parseInt(e.currentTarget.value) || 10 })}
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">分组</label>
                  <input
                    class="form-input"
                    type="text"
                    value={form().group}
                    onInput={(e) => setForm({ ...form(), group: e.currentTarget.value })}
                  />
                </div>
                <div class="form-group">
                  <label class="form-label">失败阈值</label>
                  <input
                    class="form-input"
                    type="number"
                    min="1"
                    value={form().failureThreshold}
                    onInput={(e) => setForm({ ...form(), failureThreshold: parseInt(e.currentTarget.value) || 3 })}
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Webhook URL（可选）</label>
                <input
                  class="form-input"
                  type="text"
                  placeholder="告警时 POST 通知的 URL"
                  value={form().webhookUrl}
                  onInput={(e) => setForm({ ...form(), webhookUrl: e.currentTarget.value })}
                />
              </div>
              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input
                    type="checkbox"
                    checked={form().enabled}
                    onChange={(e) => setForm({ ...form(), enabled: e.currentTarget.checked })}
                  />
                  <span>启用探针</span>
                </label>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  {editingProbe() ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showImport() && (
        <div class="modal-overlay" onClick={() => setShowImport(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3 class="modal-title">批量导入探针</h3>
              <button class="btn btn-ghost" onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div class="form-group">
              <label class="form-label">JSON 数据</label>
              <textarea
                class="form-textarea"
                rows={12}
                placeholder={`[\n  {"name": "Probe 1", "type": "http", "target": "https://..."},\n  {"name": "Probe 2", "type": "tcp", "target": "host:port"}\n]`}
                value={importText()}
                onInput={(e) => setImportText(e.currentTarget.value)}
                style="font-family: monospace; font-size: 12px;"
              />
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onClick={() => setShowImport(false)}>
                取消
              </button>
              <button type="button" class="btn btn-primary" onClick={handleImport}>
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
