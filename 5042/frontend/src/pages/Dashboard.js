import React, { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { Button, Space, message, Dropdown, Modal, Input, Select } from 'antd';
import { 
  PlusOutlined, 
  SaveOutlined, 
  DeleteOutlined,
  BarChartOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import MetricChart from '../components/MetricChart';
import GaugeChart from '../components/GaugeChart';
import api from '../services/api';

const ResponsiveGridLayout = WidthProvider(Responsive);

const chartTypes = [
  { key: 'cpu_line', name: 'CPU使用率(折线)', type: 'line', metric: 'cpu_usage', title: 'CPU使用率' },
  { key: 'memory_line', name: '内存使用率(折线)', type: 'line', metric: 'memory_usage', title: '内存使用率' },
  { key: 'disk_line', name: '磁盘使用率(折线)', type: 'line', metric: 'disk_usage', title: '磁盘使用率' },
  { key: 'network_in', name: '网络流入(折线)', type: 'line', metric: 'network_in', title: '网络流入(KB/s)' },
  { key: 'network_out', name: '网络流出(折线)', type: 'line', metric: 'network_out', title: '网络流出(KB/s)' },
  { key: 'process_count', name: '进程数(折线)', type: 'line', metric: 'process_count', title: '进程数' },
  { key: 'cpu_gauge', name: 'CPU使用率(仪表盘)', type: 'gauge', metric: 'cpu_usage', title: 'CPU' },
  { key: 'memory_gauge', name: '内存使用率(仪表盘)', type: 'gauge', metric: 'memory_usage', title: '内存' },
  { key: 'disk_gauge', name: '磁盘使用率(仪表盘)', type: 'gauge', metric: 'disk_usage', title: '磁盘' }
];

const colors = ['#1890ff', '#52c41a', '#faad14', '#eb2f96', '#13c2c2', '#722ed1'];

function Dashboard({ host, autoRefresh }) {
  const [layout, setLayout] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [saveModal, setSaveModal] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [currentDashboard, setCurrentDashboard] = useState(null);

  useEffect(() => {
    fetchDashboards();
    loadDefaultLayout();
  }, []);

  const fetchDashboards = async () => {
    try {
      const data = await api.getDashboards();
      setDashboards(data);
    } catch (error) {
      console.error('Failed to fetch dashboards:', error);
    }
  };

  const loadDefaultLayout = () => {
    const defaultLayout = [
      { i: 'cpu_gauge', x: 0, y: 0, w: 2, h: 2 },
      { i: 'memory_gauge', x: 2, y: 0, w: 2, h: 2 },
      { i: 'disk_gauge', x: 4, y: 0, w: 2, h: 2 },
      { i: 'cpu_line', x: 0, y: 2, w: 3, h: 3 },
      { i: 'memory_line', x: 3, y: 2, w: 3, h: 3 },
      { i: 'network_in', x: 0, y: 5, w: 3, h: 3 },
      { i: 'network_out', x: 3, y: 5, w: 3, h: 3 }
    ];
    setLayout(defaultLayout);
  };

  const handleAddChart = (chartKey) => {
    const chartConfig = chartTypes.find(c => c.key === chartKey);
    if (!chartConfig) return;

    const newItem = {
      i: chartKey + '_' + Date.now(),
      chartKey,
      x: 0,
      y: layout.length * 3,
      w: chartConfig.type === 'gauge' ? 2 : 3,
      h: chartConfig.type === 'gauge' ? 2 : 3
    };

    setLayout([...layout, newItem]);
    message.success('已添加图表');
  };

  const handleRemoveChart = (i) => {
    setLayout(layout.filter(item => item.i !== i));
  };

  const handleSaveDashboard = async () => {
    if (!dashboardName) {
      message.error('请输入面板名称');
      return;
    }

    try {
      await api.addDashboard({
        name: dashboardName,
        layout: layout
      });
      message.success('面板保存成功');
      setSaveModal(false);
      setDashboardName('');
      fetchDashboards();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleLoadDashboard = (dashboard) => {
    setLayout(dashboard.layout);
    setCurrentDashboard(dashboard);
    message.success('已加载面板: ' + dashboard.name);
  };

  const renderChart = (item) => {
    const chartConfig = chartTypes.find(c => item.i.startsWith(c.key)) || 
                        chartTypes.find(c => item.chartKey === c.key);
    
    if (!chartConfig) return null;

    const colorIndex = layout.findIndex(l => l.i === item.i) % colors.length;

    return (
      <div key={item.i} style={{ position: 'relative', height: '100%' }}>
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          style={{ position: 'absolute', top: 5, right: 5, zIndex: 10 }}
          onClick={() => handleRemoveChart(item.i)}
        />
        {chartConfig.type === 'gauge' ? (
          <GaugeChart
            hostId={host?.id}
            metricName={chartConfig.metric}
            title={chartConfig.title}
            color={colors[colorIndex]}
            autoRefresh={autoRefresh}
          />
        ) : (
          <MetricChart
            hostId={host?.id}
            metricName={chartConfig.metric}
            title={chartConfig.title}
            color={colors[colorIndex]}
            autoRefresh={autoRefresh}
          />
        )}
      </div>
    );
  };

  const addChartMenu = {
    items: chartTypes.map(c => ({
      key: c.key,
      label: c.name,
      icon: c.type === 'gauge' ? <DashboardOutlined /> : <BarChartOutlined />
    })),
    onClick: ({ key }) => handleAddChart(key)
  };

  const loadDashboardMenu = {
    items: dashboards.map(d => ({
      key: d.id,
      label: d.name,
      onClick: () => handleLoadDashboard(d)
    }))
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Dropdown menu={addChartMenu}>
            <Button type="primary" icon={<PlusOutlined />}>
              添加图表
            </Button>
          </Dropdown>
          <Dropdown menu={loadDashboardMenu}>
            <Button icon={<DashboardOutlined />}>
              加载面板
            </Button>
          </Dropdown>
          <Button onClick={loadDefaultLayout}>
            重置布局
          </Button>
        </Space>
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => setSaveModal(true)}>
            保存面板
          </Button>
        </Space>
      </div>

      <div style={{ height: 'calc(100vh - 200px)', minHeight: 600 }}>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 6, md: 4, sm: 2, xs: 2, xxs: 1 }}
          rowHeight={60}
          onLayoutChange={(newLayout) => setLayout(newLayout)}
        >
          {layout.map(item => (
            <div key={item.i}>
              {renderChart(item)}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>

      <Modal
        title="保存监控面板"
        open={saveModal}
        onOk={handleSaveDashboard}
        onCancel={() => setSaveModal(false)}
      >
        <Input
          placeholder="请输入面板名称"
          value={dashboardName}
          onChange={(e) => setDashboardName(e.target.value)}
        />
      </Modal>
    </div>
  );
}

export default Dashboard;
