import { createSignal, onMount, onCleanup, For } from 'solid-js';
import { A } from '@solidjs/router';
import { api } from '../api';
import type { Event, ProbeStatus } from '../types';

export default function Events() {
  const [events, setEvents] = createSignal<Event[]>([]);

  const loadEvents = async () => {
    try {
      const data = await api.getEvents(200);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
  };

  let timer: number;
  onMount(() => {
    loadEvents();
    timer = window.setInterval(loadEvents, 10000);
  });
  onCleanup(() => clearInterval(timer));

  const handleAck = async (id: string) => {
    try {
      await api.ackEvent(id);
      loadEvents();
    } catch (e) {
      alert('确认失败');
    }
  };

  const formatTime = (t: string) => {
    return new Date(t).toLocaleString('zh-CN');
  };

  const statusLabel = (s: ProbeStatus) => {
    const map: Record<ProbeStatus, string> = {
      up: '正常',
      down: '异常',
      unknown: '未知',
      disabled: '已禁用',
    };
    return map[s] || s;
  };

  return (
    <div>
      <div class="page-header">
        <h1 class="page-title">事件流</h1>
        <span style="font-size: 14px; color: #64748b;">
          最近 {events().length} 条事件
        </span>
      </div>

      <div class="card">
        {events().length === 0 ? (
          <div class="empty">暂无事件</div>
        ) : (
          <div style="max-height: 70vh; overflow-y: auto;">
            <For each={events()}>
              {(event) => (
                <div class="event-item">
                  <div class="event-time">{formatTime(event.timestamp)}</div>
                  <div class="event-content">
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>
                      <A href={`/probes/${event.probeId}`} style="color: inherit; text-decoration: none;">
                        {event.probeName}
                      </A>
                    </span>
                    <span style="color: #94a3b8; margin: '0 8px';">
                      {' '}状态变更:{' '}
                    </span>
                    <span class={`status-${event.prevStatus}`}>
                      {statusLabel(event.prevStatus)}
                    </span>
                    <span style="color: #94a3b8;"> → </span>
                    <span class={`status-${event.currStatus}`}>
                      {statusLabel(event.currStatus)}
                    </span>
                    {event.message && (
                      <div style="font-size: 12px; color: #ef4444; margin-top: 4px; font-family: monospace;">
                        {event.message}
                      </div>
                    )}
                  </div>
                  <div style="display: flex; gap: 6px; align-items: flex-start;">
                    {event.acknowledged ? (
                      <span class="event-ack">
                        ✓ 已确认 ({event.ackBy})
                      </span>
                    ) : (
                      <button
                        class="btn btn-sm btn-ghost"
                        onClick={() => handleAck(event.id)}
                      >
                        确认
                      </button>
                    )}
                  </div>
                </div>
              )}
            </For>
          </div>
        )}
      </div>
    </div>
  );
}
