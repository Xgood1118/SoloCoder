import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, message, Popconfirm } from 'antd';
import { DeleteOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';

function Hosts({ hosts, onRefresh }) {
  const [viewKeyModal, setViewKeyModal] = useState(false);
  const [selectedHost, setSelectedHost] = useState(null);

  const handleDelete = async (id) => {
    try {
      await api.deleteHost(id);
      message.success('主机已删除');
      onRefresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const copyAgentKey = (host) => {
    navigator.clipboard.writeText(host.agent_key);
    message.success('Agent Key 已复制到剪贴板');
  };

  const viewAgentKey = (host) => {
    setSelectedHost(host);
    setViewKeyModal(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '主机名',
      dataIndex: 'hostname',
      key: 'hostname',
      width: 150
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 130
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
      width: 120,
      render: (os) => {
        const osMap = {
          'linux': <Tag color="blue">Linux</Tag>,
          'win32': <Tag color="orange">Windows</Tag>,
          'darwin': <Tag color="cyan">macOS</Tag>
        };
        return osMap[os] || <Tag>{os}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        return status === 'online' 
          ? <Tag color="green">在线</Tag> 
          : <Tag color="red">离线</Tag>;
      }
    },
    {
      title: '最后心跳',
      dataIndex: 'last_heartbeat',
      key: 'last_heartbeat',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '-'
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => viewAgentKey(record)}>
            查看Key
          </Button>
          <Button size="small" icon={<CopyOutlined />} onClick={() => copyAgentKey(record)}>
            复制Key
          </Button>
          <Popconfirm
            title="确定要删除此主机吗？"
            onConfirm={() => handleDelete(record.id)}
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
        <h3>主机管理</h3>
        <Button onClick={onRefresh}>刷新</Button>
      </div>

      <Table
        columns={columns}
        dataSource={hosts}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Agent Key"
        open={viewKeyModal}
        onCancel={() => setViewKeyModal(false)}
        footer={[
          <Button key="copy" onClick={() => copyAgentKey(selectedHost)}>
            复制到剪贴板
          </Button>,
          <Button key="close" onClick={() => setViewKeyModal(false)}>
            关闭
          </Button>
        ]}
      >
        <p><strong>主机名:</strong> {selectedHost?.hostname}</p>
        <p><strong>Agent Key:</strong></p>
        <div style={{ 
          background: '#f5f5f5', 
          padding: '12px', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          wordBreak: 'break-all'
        }}>
          {selectedHost?.agent_key}
        </div>
        <div style={{ marginTop: 16 }}>
          <p><strong>Agent 启动命令:</strong></p>
          <div style={{ 
            background: '#f5f5f5', 
            padding: '12px', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            AGENT_KEY={selectedHost?.agent_key} npm start
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Hosts;
