import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../services/api';

function MetricChart({ hostId, metricName, title, color = '#1890ff', autoRefresh }) {
  const [data, setData] = useState([]);

  const fetchData = async () => {
    if (!hostId) return;
    
    try {
      const end = dayjs().toISOString();
      const start = dayjs().subtract(1, 'hour').toISOString();
      
      const metrics = await api.getMetrics(hostId, {
        metric: metricName,
        start,
        end
      });
      
      const sorted = metrics
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map(m => [dayjs(m.timestamp).format('HH:mm:ss'), m.metric_value]);
      
      setData(sorted);
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
    tooltip: {
      trigger: 'axis'
    },
    grid: {
      left: '10%',
      right: '10%',
      top: '15%',
      bottom: '15%'
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d[0]),
      axisLabel: {
        fontSize: 10
      }
    },
    yAxis: {
      type: 'value',
      max: metricName.includes('usage') ? 100 : null,
      axisLabel: {
        fontSize: 10
      }
    },
    series: [
      {
        data: data.map(d => d[1]),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          color,
          width: 2
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' },
              { offset: 1, color: color + '05' }
            ]
          }
        }
      }
    ]
  };

  return (
    <div className="chart-container">
      <div className="chart-title">{title}</div>
      <ReactECharts 
        option={option} 
        style={{ height: 'calc(100% - 30px)' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}

export default MetricChart;
