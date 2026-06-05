import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format } from 'date-fns';
import { useMonitorStore } from '../store/useMonitorStore';
import type { AggregationResult } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

interface MetricChartProps {
  metricName: string;
  title?: string;
  height?: number;
}

const SERVER_COLORS: Record<string, string> = {
  'server-01': '#3b82f6',
  'server-02': '#10b981',
  'server-03': '#f59e0b',
};

export const MetricChart: React.FC<MetricChartProps> = ({
  metricName,
  title,
  height = 300,
}) => {
  const aggregationResults = useMonitorStore((state) => state.aggregationResults);
  const selectedServer = useMonitorStore((state) => state.selectedServer);
  const isPlaybackMode = useMonitorStore((state) => state.isPlaybackMode);
  const playbackStartTime = useMonitorStore((state) => state.playbackStartTime);
  const playbackEndTime = useMonitorStore((state) => state.playbackEndTime);

  const filteredResults = useMemo(() => {
    return aggregationResults.filter((r) => {
      if (r.metricName !== metricName) return false;
      if (selectedServer !== 'all' && r.dimensions.server !== selectedServer) return false;
      if (isPlaybackMode && playbackStartTime && playbackEndTime) {
        if (r.windowStart < playbackStartTime || r.windowEnd > playbackEndTime) return false;
      }
      return true;
    });
  }, [aggregationResults, metricName, selectedServer, isPlaybackMode, playbackStartTime, playbackEndTime]);

  const chartData = useMemo(() => {
    const serverData: Record<string, AggregationResult[]> = {};

    for (const result of filteredResults) {
      const server = result.dimensions.server || 'all';
      if (!serverData[server]) {
        serverData[server] = [];
      }
      serverData[server].push(result);
    }

    const allTimestamps = new Set<number>();
    for (const results of Object.values(serverData)) {
      for (const r of results) {
        allTimestamps.add(r.windowStart);
      }
    }
    const sortedTimestamps = Array.from(allTimestamps).sort();

    const datasets = Object.entries(serverData).map(([server, results]) => {
      const resultMap = new Map(results.map((r) => [r.windowStart, r.value]));
      const data = sortedTimestamps.map((ts) => resultMap.get(ts) ?? null);

      return {
        label: server,
        data,
        borderColor: SERVER_COLORS[server] || '#6b7280',
        backgroundColor: (SERVER_COLORS[server] || '#6b7280') + '20',
        tension: 0.3,
        fill: false,
        pointRadius: 2,
      };
    });

    return {
      labels: sortedTimestamps.map((ts) => format(ts, 'HH:mm:ss')),
      datasets,
    };
  }, [filteredResults]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title || metricName,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div style={{ height }}>
      <Line data={chartData} options={options} />
    </div>
  );
};
