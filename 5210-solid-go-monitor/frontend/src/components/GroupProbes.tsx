import { For } from 'solid-js';
import { A } from '@solidjs/router';
import type { Probe } from '../types';

interface Props {
  probes: Probe[];
  group: string;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent, group: string) => void;
}

export default function GroupProbes(props: Props) {
  const onDragStart = (e: DragEvent, probe: Probe) => {
    e.dataTransfer!.setData('text/plain', probe.id);
    e.dataTransfer!.effectAllowed = 'move';
  };

  return (
    <div
      class="drop-zone"
      onDragOver={props.onDragOver}
      onDrop={(e) => props.onDrop(e, props.group)}
    >
      <div class="probes-grid">
        <For each={props.probes}>
          {(probe) => (
            <A
              href={`/probes/${probe.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                class="probe-card"
                draggable={true}
                onDragStart={(e) => onDragStart(e, probe)}
              >
                <div class="probe-name">
                  <span class={`status-dot ${probe.status}`}></span>
                  {probe.name}
                </div>
                <div class="probe-target">{probe.target}</div>
                <div class="probe-meta">
                  <span class={`probe-type-badge ${probe.type}`}>
                    {probe.type}
                  </span>
                  <span>{probe.interval}s</span>
                </div>
              </div>
            </A>
          )}
        </For>
      </div>
    </div>
  );
}
