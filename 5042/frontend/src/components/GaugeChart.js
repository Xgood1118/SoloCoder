import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import api from '../services/api';

function GaugeChart({ hostId, metricName, title, color = '#1890ff', autoRefresh }) {
  const [value, setValue] = useState(0);

  const fetchData = async () => {
    if (!hostId) return;
    
    try {
      const metrics = await api.getLatestMetrics(hostId);
      const metric = metrics.find(m => m.metric_name === metricName);
      if (metric) {
        setValue(metric.metric_value);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [hostId, metricName, autoRefresh]);

  const option = {
    series: [
      {
        type: 'gauge',
        progress: {
          show: true,
          width: 12,
          itemStyle: {
            color: value > 80 ? '#ff4d4f' : value > 60 ? '#faad14' : color
          }
        },
        axisLine: {
          lineStyle: {
            width: 12,
            color: [[1, '#e8e8e8']]
          }
        },
        axisTick: {
          show: false
        },
        splitLine: {
          show: false
        },
        axisLabel: {
          show: false
        },
        pointer: {
          show: false
        },
        anchor: {
          show: false
        },
        title: {
          show: true,
          fontSize: 14,
          color: '#666',
          offsetCenter: [0, '60%']
        },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          fontWeight: 'bold',
          offsetCenter: [0, '20%'],
          formatter: '{value}%',
          color: value > 80 ? '#ff4d4f' : value > 60 ? '#faad14' : color
        },
        data: [{ value: value, name: title }]
      }
    ]
  };

  return (
    <div className="chart-container" style={{ height: '100%' }}>
      <ReactECharts 
        option={option} 
        style={{ height: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

export default GaugeChart;
