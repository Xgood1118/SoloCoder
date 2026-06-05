import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useMonitorStore } from '../store/useMonitorStore';
import type { AlertEvent, AlertLevel, AlertStatus } from '../types';

const LEVEL_COLORS: Record<AlertLevel, string> = {
  info: 'bg-blue-100 text-blue-800 border-blue-300',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  critical: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_COLORS: Record<AlertStatus, string> = {
  active: 'bg-red-500',
  resolved: 'bg-green-500',
  acknowledged: 'bg-blue-500',
};

const STATUS_LABELS: Record<AlertStatus, string> = {
  active: '活动',
  resolved: '已恢复',
  acknowledged: '已确认',
};

export const AlertList: React.FC = () => {
  const alertEvents = useMonitorStore((state) => state.alertEvents);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/alert-events/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '已确认' }),
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 h-full overflow-hidden flex flex-col">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <span className="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
        告警事件 ({alertEvents.length})
      </h3>
      <div className="flex-1 overflow-y-auto space-y-2">
        {alertEvents.length === 0 ? (
          <div className="text-gray-500 text-center py-8">暂无告警</div>
        ) : (
          alertEvents.map((event) => (
            <AlertEventItem
              key={event.id}
              event={event}
              onAcknowledge={() => acknowledgeAlert(event.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface AlertEventItemProps {
  event: AlertEvent;
  onAcknowledge: () => void;
}

const AlertEventItem: React.FC<AlertEventItemProps> = ({ event, onAcknowledge }) => {
  const metricValues = Object.entries(event.metricValues);

  return (
    <div
      className={`p-3 rounded-lg border ${LEVEL_COLORS[event.level]} transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[event.status]}`}></span>
          <span className="font-medium">{event.ruleName}</span>
        </div>
        <span className="text-xs px-2 py-1 bg-white rounded">
          {STATUS_LABELS[event.status]}
        </span>
      </div>
      <div className="text-sm space-y-1">
        {metricValues.map(([metric, value]) => (
          <div key={metric} className="flex justify-between">
            <span>{metric}:</span>
            <span className="font-mono">
              {value.toFixed(2)} (阈值: {event.thresholdValues[metric]})
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-opacity-30 border-current">
        <span className="text-xs opacity-75">
          {formatDistanceToNow(event.triggeredAt, {
            addSuffix: true,
            locale: zhCN,
          })}
        </span>
        {event.status === 'active' && (
          <button
            onClick={onAcknowledge}
            className="text-xs px-2 py-1 bg-white bg-opacity-50 hover:bg-opacity-70 rounded transition-colors"
          >
            确认
          </button>
        )}
      </div>
    </div>
  );
};
