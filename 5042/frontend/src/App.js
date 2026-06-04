import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Space, Modal, Form, Input, Select, message } from 'antd';
import {
  DashboardOutlined,
  AlertOutlined,
  SettingOutlined,
  DesktopOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Hosts from './pages/Hosts';
import Rules from './pages/Rules';
import api from './services/api';

const { Header, Sider, Content } = Layout;
const { Option } = Select;

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [addHostModal, setAddHostModal] = useState(false);
  const [form] = Form.useForm();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchHosts();
  }, []);

  const fetchHosts = async () => {
    try {
      const data = await api.getHosts();
      setHosts(data);
      if (data.length > 0 && !selectedHost) {
        setSelectedHost(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch hosts:', error);
    }
  };

  const handleAddHost = async (values) => {
    try {
      await api.addHost(values);
      message.success('主机添加成功');
      setAddHostModal(false);
      form.resetFields();
      fetchHosts();
    } catch (error) {
      message.error('添加失败');
    }
  };

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '监控面板' },
    { key: 'alerts', icon: <AlertOutlined />, label: '告警管理' },
    { key: 'hosts', icon: <DesktopOutlined />, label: '主机管理' },
    { key: 'rules', icon: <SettingOutlined />, label: '告警规则' }
  ];

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard host={selectedHost} autoRefresh={autoRefresh} />;
      case 'alerts':
        return <Alerts />;
      case 'hosts':
        return <Hosts hosts={hosts} onRefresh={fetchHosts} />;
      case 'rules':
        return <Rules hosts={hosts} />;
      default:
        return <Dashboard host={selectedHost} autoRefresh={autoRefresh} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: '#001529',
        padding: '0 24px'
      }}>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
          系统监控平台
        </div>
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择主机"
            value={selectedHost?.id}
            onChange={(id) => setSelectedHost(hosts.find(h => h.id === id))}
          >
            {hosts.map(h => (
              <Option key={h.id} value={h.id}>{h.hostname}</Option>
            ))}
          </Select>
          <Button 
            type={autoRefresh ? 'primary' : 'default'}
            icon={<ReloadOutlined />}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '自动刷新中' : '自动刷新已暂停'}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddHostModal(true)}>
            添加主机
          </Button>
        </Space>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ background: '#fff', padding: 24, borderRadius: 8, minHeight: 500 }}>
            {renderPage()}
          </Content>
        </Layout>
      </Layout>

      <Modal
        title="添加主机"
        open={addHostModal}
        onCancel={() => setAddHostModal(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddHost}>
          <Form.Item name="hostname" label="主机名" rules={[{ required: true }]}>
            <Input placeholder="请输入主机名" />
          </Form.Item>
          <Form.Item name="ip" label="IP地址">
            <Input placeholder="请输入IP地址" />
          </Form.Item>
          <Form.Item name="os" label="操作系统">
            <Select placeholder="请选择操作系统">
              <Option value="linux">Linux</Option>
              <Option value="win32">Windows</Option>
              <Option value="darwin">macOS</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              添加
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
