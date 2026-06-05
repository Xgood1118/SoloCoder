import { useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useMonitorStore, useAlertStats } from './store/useMonitorStore';
import { MetricChart } from './components/MetricChart';
import { AlertList } from './components/AlertList';
import { PlaybackControls } from './components/PlaybackControls';
import { ConnectionStatus } from './components/ConnectionStatus';

const CHART_METRICS = [
  { metricName: 'cpu_usage', title: 'CPU 使用率 (%)' },
  { metricName: 'memory_usage', title: '内存使用率 (%)' },
  { metricName: 'request_count', title: '请求计数' },
  { metricName: 'error_rate', title: '错误率 (%)' },
];

export default function App() {
  useWebSocket();

  const { active, warning, critical } = useAlertStats();
  const servers = useMonitorStore((state) => state.servers);
  const selectedServer = useMonitorStore((state) => state.selectedServer);
  const isPlaybackMode = useMonitorStore((state) => state.isPlaybackMode);
  const setSelectedServer = useMonitorStore((state) => state.setSelectedServer);
  const setMetrics = useMonitorStore((state) => state.setMetrics);
  const setServers = useMonitorStore((state) => state.setServers);
  const setAlertRules = useMonitorStore((state) => state.setAlertRules);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/metrics');
        const data = await response.json();
        setMetrics(data.metrics);
        setServers(data.servers);
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    const fetchAlertRules = async () => {
      try {
        const response = await fetch('/api/alert-rules');
        const data = await response.json();
        setAlertRules(data.rules);
      } catch (error) {
        console.error('Error fetching alert rules:', error);
      }
    };

    fetchMetadata();
    fetchAlertRules();
  }, [setMetrics, setServers, setAlertRules]);

  const generateAnomaly = async () => {
    try {
      await fetch('/api/generate-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricName: 'cpu_usage', factor: 3 }),
      });
    } catch (error) {
      console.error('Error generating anomaly:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">实时数据监控平台</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isPlaybackMode 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {isPlaybackMode ? '历史回放模式' : '实时模式'}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <ConnectionStatus />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  <span className="text-sm text-gray-600">活动告警: {active}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                  <span className="text-sm text-gray-600">警告: {warning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600"></span>
                  <span className="text-sm text-gray-600">严重: {critical}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 space-y-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">服务器筛选:</label>
                  <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="all">全部服务器</option>
                    {servers.map((server) => (
                      <option key={server} value={server}>
                        {server}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={generateAnomaly}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  模拟异常
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {CHART_METRICS.map(({ metricName, title }) => (
                <div key={metricName} className="bg-white rounded-lg shadow p-4">
                  <MetricChart metricName={metricName} title={title} height={280} />
                </div>
              ))}
            </div>

            <PlaybackControls />
          </div>

          <div className="w-80">
            <div className="sticky top-6 h-[calc(100vh-120px)]">
              <AlertList />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
