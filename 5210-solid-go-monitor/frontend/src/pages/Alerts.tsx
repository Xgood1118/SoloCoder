import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import type { Alert } from '../types';

export default function Alerts() {
  const [activeTab, setActiveTab] = createSignal<'active' | 'history'>('active');
  const [alerts, setAlerts] = createSignal<Alert[]>([]);
  const [history, setHistory] = createSignal<Alert[]>([]);
  const [selected, setSelected] = createSignal<Set<string>>(new Set());
  const [sortBy, setSortBy] = createSignal<'time' | 'name'>('time');
  const [silenceMinutes, setSilenceMinutes] = createSignal(30);
  const [showSilenceModal, setShowSilenceModal] = createSignal(false);
  const [silenceTarget, setSilenceTarget] = createSignal<string | null>(null);

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.getAlertHistory(200);
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  let timer: number;
  onMount(() => {
    loadAlerts();
    loadHistory();
    timer = window.setInterval(loadAlerts, 5000);
  });
  onCleanup(() => clearInterval(timer));

  const sortedAlerts = () => {
    const list = [...alerts()];
    if (sortBy() === 'name') {
      list.sort((a, b) => a.probeName.localeCompare(b.probeName));
    } else {
      list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
    return list;
  };

  const sortedHistory = () => {
    const list = [...history()];
    list.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    return list;
  };

  const toggleSelect = (probeId: string) => {
    const newSet = new Set(selected());
    if (newSet.has(probeId)) {
      newSet.delete(probeId);
    } else {
      newSet.add(probeId);
    }
    setSelected(newSet);
  };

  const selectAll = () => {
    if (selected().size === sortedAlerts().length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedAlerts().map((a) => a.probeId)));
    }
  };

  const handleAck = async (probeId: string) => {
    try {
      await api.ackAlert(probeId);
      loadAlerts();
    } catch (e) {
      alert('确认失败');
    }
  };

  const handleBatchAck = async () => {
    if (selected().size === 0) return;
    try {
      await api.ackAlertsBatch(Array.from(selected()));
      setSelected(new Set());
      loadAlerts();
    } catch (e) {
      alert('批量确认失败');
    }
  };

  const openSilence = (probeId: string | null) => {
    setSilenceTarget(probeId);
    setShowSilenceModal(true);
  };

  const handleSilence = async () => {
    try {
      if (silenceTarget() === null) {
        if (selected().size === 0) return;
        await api.silenceAlertsBatch(Array.from(selected()), silenceMinutes());
        setSelected(new Set());
      } else {
        await api.silenceAlert(silenceTarget()!, silenceMinutes());
      }
      setShowSilenceModal(false);
      loadAlerts();
    } catch (e) {
      alert('静默失败');
    }
  };

  const formatTime = (t: string) => {
    return new Date(t).toLocaleString('zh-CN');
  };

  const getAlertClass = (alert: Alert) => {
    let cls = 'alert-item';
    if (alert.escalated) cls += ' escalated';
    else if (alert.silenced) cls += ' silenced';
    else if (alert.acknowledged) cls += ' acknowledged';
    return cls;
  };

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">告警中心</h1>
      </div>

      <div class="tabs">
        <button
          class={`tab ${activeTab() === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          当前告警 ({alerts().length})
        </button>
        <button
          class={`tab ${activeTab() === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history');
            loadHistory();
          }}
        >
          历史告警
        </button>
      </div>

      {activeTab() === 'active' ? (
        <div>
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="filter-group">
                <button
                  class={`filter-btn ${sortBy() === 'time' ? 'active' : ''}`}
                  onClick={() => setSortBy('time')}
                >
                  按时间倒序
                </button>
                <button
                  class={`filter-btn ${sortBy() === 'name' ? 'active' : ''}`}
                  onClick={() => setSortBy('name')}
                >
                  按名称排序
                </button>
              </div>
            </div>
            <div class="toolbar-right">
              <button
                class="btn btn-sm btn-secondary"
                disabled={selected().size === 0}
                onClick={handleBatchAck}
              >
                ✓ 批量确认 ({selected().size})
              </button>
              <button
                class="btn btn-sm btn-secondary"
                disabled={selected().size === 0}
                onClick={() => openSilence(null)}
              >
                🔕 批量静默
              </button>
            </div>
          </div>

          {sortedAlerts().length === 0 ? (
            <div class="card">
              <div class="empty">
                🎉 没有当前告警
              </div>
            </div>
          ) : (
            <div class="card" style="padding: 0;">
              <table>
                <thead>
                  <tr>
                    <th class="checkbox-cell">
                      <input
                        type="checkbox"
                        checked={selected().size === sortedAlerts().length && sortedAlerts().length > 0}
                        onChange={selectAll}
                      />
                    </th>
                    <th>探针</th>
                    <th>级别</th>
                    <th>消息</th>
                    <th>开始时间</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedAlerts()}>
                    {(alert) => (
                      <tr style={alert.escalated ? { background: '#fef2f2' } : {}}>
                        <td class="checkbox-cell">
                          <input
                            type="checkbox"
                            checked={selected().has(alert.probeId)}
                            onChange={() => toggleSelect(alert.probeId)}
                          />
                        </td>
                        <td>
                          <A href={`/probes/${alert.probeId}`} style="color: inherit; text-decoration: none; font-weight: 500;">
                            {alert.probeName}
                          </A>
                          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                            {alert.probeGroup}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: alert.level === 'critical' ? '#fee2e2' : alert.level === 'error' ? '#fef3c7' : '#fef3c7',
                              color: alert.level === 'critical' ? '#991b1b' : alert.level === 'error' ? '#92400e' : '#92400e',
                            }}
                          >
                            {alert.level === 'critical' ? '严重' : alert.level === 'error' ? '错误' : '警告'}
                          </span>
                        </td>
                        <td style="font-size: 13px; color: #7f1d1d; max-width: 300px;">
                          {alert.message}
                        </td>
                        <td style="font-size: 13px; color: #64748b;">
                          {formatTime(alert.startTime)}
                        </td>
                        <td>
                          {alert.escalated && (
                            <span style="font-size: 11px; color: #dc2626; display: block;">
                              ⚠ 已升级
                            </span>
                          )}
                          {alert.acknowledged && (
                            <span style="font-size: 11px; color: #f59e0b; display: block;">
                              ✓ 已确认
                            </span>
                          )}
                          {alert.silenced && (
                            <span style="font-size: 11px; color: #94a3b8; display: block;">
                              🔕 已静默
                            </span>
                          )}
                        </td>
                        <td>
                          <div style="display: flex; gap: 4px;">
                            {!alert.acknowledged && (
                              <button
                                class="btn btn-sm btn-secondary"
                                onClick={() => handleAck(alert.probeId)}
                              >
                                确认
                              </button>
                            )}
                            {!alert.silenced && (
                              <button
                                class="btn btn-sm btn-ghost"
                                onClick={() => openSilence(alert.probeId)}
                              >
                                静默
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div class="card">
          <div style="font-size: 14px; color: #64748b; margin-bottom: 12px;">
            最近 7 天已恢复的告警
          </div>
          {sortedHistory().length === 0 ? (
            <div class="empty">暂无历史告警</div>
          ) : (
            <div style="overflow-x: auto;">
              <table>
                <thead>
                  <tr>
                    <th>探针</th>
                    <th>级别</th>
                    <th>消息</th>
                    <th>开始时间</th>
                    <th>恢复时间</th>
                    <th>持续时长</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={sortedHistory()}>
                    {(alert) => (
                      <tr>
                        <td>
                          <A href={`/probes/${alert.probeId}`} style="color: inherit; text-decoration: none; font-weight: 500;">
                            {alert.probeName}
                          </A>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 500,
                              background: '#fee2e2',
                              color: '#991b1b',
                            }}
                          >
                            {alert.level === 'critical' ? '严重' : alert.level === 'error' ? '错误' : '警告'}
                          </span>
                        </td>
                        <td style="font-size: 13px; color: #64748b; max-width: 300px;">
                          {alert.message}
                        </td>
                        <td style="font-size: 13px; color: #64748b;">
                          {formatTime(alert.startTime)}
                        </td>
                        <td style="font-size: 13px; color: #22c55e;">
                          {formatTime(alert.endTime!)}
                        </td>
                        <td style="font-size: 13px; color: #64748b;">
                          {alert.duration}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showSilenceModal() && (
        <div class="modal-overlay" onClick={() => setShowSilenceModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3 class="modal-title">
                {silenceTarget() === null ? `静默 ${selected().size} 个告警` : '静默告警'}
              </h3>
              <button class="btn btn-ghost" onClick={() => setShowSilenceModal(false)}>✕</button>
            </div>
            <div class="form-group">
              <label class="form-label">静默时长（分钟）</label>
              <input
                class="form-input"
                type="number"
                min="1"
                value={silenceMinutes()}
                onInput={(e) => setSilenceMinutes(parseInt(e.currentTarget.value) || 30)}
              />
            </div>
            <div class="form-row">
              <button
                class="btn btn-secondary"
                onClick={() => setSilenceMinutes(15)}
              >
                15分钟
              </button>
              <button
                class="btn btn-secondary"
                onClick={() => setSilenceMinutes(30)}
              >
                30分钟
              </button>
              <button
                class="btn btn-secondary"
                onClick={() => setSilenceMinutes(60)}
              >
                1小时
              </button>
              <button
                class="btn btn-secondary"
                onClick={() => setSilenceMinutes(360)}
              >
                6小时
              </button>
            </div>
            <div class="form-actions">
              <button class="btn btn-secondary" onClick={() => setShowSilenceModal(false)}>
                取消
              </button>
              <button class="btn btn-primary" onClick={handleSilence}>
                确认静默
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
