import React from 'react';
import { useMonitorStore } from '../store/useMonitorStore';

const STATUS_CONFIG = {
  connected: { color: 'bg-green-500', label: '已连接', textColor: 'text-green-600' },
  disconnected: { color: 'bg-red-500', label: '已断开', textColor: 'text-red-600' },
  connecting: { color: 'bg-yellow-500', label: '连接中...', textColor: 'text-yellow-600' },
};

export const ConnectionStatus: React.FC = () => {
  const connectionStatus = useMonitorStore((state) => state.connectionStatus);
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${config.color} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`}></span>
      <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
    </div>
  );
};
