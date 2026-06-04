import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

function Rules({ hosts }) {
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [applyTemplateModal, setApplyTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRules();
    fetchTemplates();
  }, []);

  const fetchRules = async () => {
    try {
      const data = await api.getRules();
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
  };

  const handleAddRule = async (values) => {
    try {
      await api.addRule(values);
      message.success('规则添加成功');
      setAddModal(false);
      form.resetFields();
      fetchRules();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleDeleteRule = async (id) => {
    try {
      await api.deleteRule(id);
      message.success('规则已删除');
      fetchRules();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate || !selectedHostId) {
      message.error('请选择模板和主机');
      return;
    }

    try {
      await api.applyTemplate(selectedTemplate, selectedHostId);
      message.success('模板应用成功');
      setApplyTemplateModal(false);
      fetchRules();
    } catch (error) {
      message.error('应用失败');
    }
  };

  const metricOptions = [
    { label: 'CPU使用率', value: 'cpu_usage' },
    { label: '内存使用率', value: 'memory_usage' },
    { label: '磁盘使用率', value: 'disk_usage' },
    { label: '网络流入', value: 'network_in' },
    { label: '网络流出', value: 'network_out' },
    { label: '进程数', value: 'process_count' }
  ];

  const operatorOptions = [
    { label: '大于 (>)', value: '>' },
    { label: '大于等于 (>=)', value: '>=' },
    { label: '小于 (<)', value: '<' },
    { label: '小于等于 (<=)', value: '<=' }
  ];

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '主机',
      dataIndex: 'host_id',
      key: 'host_id',
      width: 120,
      render: (id) => {
        const host = hosts.find(h => h.id === id);
        return host ? host.hostname : '全部主机';
      }
    },
    {
      title: '指标',
      dataIndex: 'metric_name',
      key: 'metric_name',
      width: 120,
      render: (name) => <Tag color="blue">{name}</Tag>
    },
    {
      title: '阈值',
      key: 'threshold',
      width: 120,
      render: (_, record) => (
        <span>{record.operator} {record.threshold}%</span>
      )
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (val) => `${val}秒`
    },
    {
      title: '连续次数',
      dataIndex: 'consecutive_count',
      key: 'consecutive_count',
      width: 100,
      render: (val) => `${val}次`
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (val) => val 
        ? <Tag color="green">启用</Tag> 
        : <Tag color="gray">禁用</Tag>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定要删除此规则吗？"
            onConfirm={() => handleDeleteRule(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>告警规则</h3>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={() => setApplyTemplateModal(true)}>
            应用模板
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
            添加规则
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={rules}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="添加告警规则"
        open={addModal}
        onCancel={() => setAddModal(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddRule}>
          <Form.Item name="host_id" label="主机">
            <Select placeholder="选择主机(空表示全部)">
              <Select.Option value={null}>全部主机</Select.Option>
              {hosts.map(h => (
                <Select.Option key={h.id} value={h.id}>{h.hostname}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="metric_name" label="指标" rules={[{ required: true }]}>
            <Select options={metricOptions} />
          </Form.Item>
          <Form.Item name="operator" label="比较符" rules={[{ required: true }]}>
            <Select options={operatorOptions} />
          </Form.Item>
          <Form.Item name="threshold" label="阈值(%)" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="duration" label="持续时间(秒)" initialValue={300}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="consecutive_count" label="连续次数" initialValue={3}>
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="应用监控模板"
        open={applyTemplateModal}
        onOk={handleApplyTemplate}
        onCancel={() => setApplyTemplateModal(false)}
      >
        <Form layout="vertical">
          <Form.Item label="选择模板">
            <Select
              value={selectedTemplate}
              onChange={setSelectedTemplate}
              placeholder="请选择模板"
            >
              {templates.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="选择主机">
            <Select
              value={selectedHostId}
              onChange={setSelectedHostId}
              placeholder="请选择主机"
            >
              {hosts.map(h => (
                <Select.Option key={h.id} value={h.id}>{h.hostname}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Rules;
