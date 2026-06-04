import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Modal, Input, Select, message } from 'antd';
import { CheckOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

const { TextArea } = Input;

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [resolveModal, setResolveModal] = useState(false);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.getAlerts(statusFilter || undefined);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
    setLoading(false);
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(alertId);
      message.success('告警已确认');
      fetchAlerts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleResolve = async () => {
    if (!currentAlert) return;
    
    try {
      await api.resolveAlert(currentAlert.id, resolveNote);
      message.success('告警已解决');
      setResolveModal(false);
      setResolveNote('');
      setCurrentAlert(null);
      fetchAlerts();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const openResolveModal = (alert) => {
    setCurrentAlert(alert);
    setResolveModal(true);
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 'triggered':
        return <Tag color="red" icon={<WarningOutlined />}>触发中</Tag>;
      case 'acknowledged':
        return <Tag color="orange" icon={<CheckOutlined />}>已确认</Tag>;
      case 'resolved':
        return <Tag color="green" icon={<CheckCircleOutlined />}>已解决</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '主机',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 120
    },
    {
      title: '指标',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 120
    },
    {
      title: '当前值',
      dataIndex: 'metric_value',
      key: 'metric_value',
      width: 100,
      render: (val, record) => (
        <span style={{ color: val > record.threshold ? '#ff4d4f' : 'inherit' }}>
          {val}%
        </span>
      )
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
      render: (val) => `${val}%`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: getStatusTag
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 'triggered' && (
            <Button size="small" onClick={() => handleAcknowledge(record.id)}>
              确认
            </Button>
          )}
          {record.status !== 'resolved' && (
            <Button size="small" type="primary" onClick={() => openResolveModal(record)}>
              解决
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>告警记录</h3>
        <Space>
          <Select
            style={{ width: 150 }}
            placeholder="状态筛选"
            value={statusFilter || undefined}
            onChange={setStatusFilter}
            allowClear
          >
            <Select.Option value="triggered">触发中</Select.Option>
            <Select.Option value="acknowledged">已确认</Select.Option>
            <Select.Option value="resolved">已解决</Select.Option>
          </Select>
          <Button onClick={fetchAlerts}>刷新</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={alerts}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="处理告警"
        open={resolveModal}
        onOk={handleResolve}
        onCancel={() => setResolveModal(false)}
      >
        <p><strong>告警ID:</strong> {currentAlert?.id}</p>
        <p><strong>指标:</strong> {currentAlert?.metric_name}</p>
        <p><strong>当前值:</strong> {currentAlert?.metric_value}%</p>
        <div style={{ marginTop: 16 }}>
          <label>处理备注:</label>
          <TextArea
            rows={4}
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="请输入处理说明"
          />
        </div>
      </Modal>
    </div>
  );
}

export default Alerts;
