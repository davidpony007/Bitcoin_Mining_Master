import React, { useState } from 'react';
import { Card, Form, Input, Switch, Button, Select, InputNumber, Space, message, Tabs, Divider, Row, Col } from 'antd';
import { SaveOutlined, ReloadOutlined, LockOutlined, BellOutlined, GlobalOutlined, ApiOutlined } from '@ant-design/icons';

const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [basicForm] = Form.useForm();
  const [securityForm] = Form.useForm();
  const [notificationForm] = Form.useForm();
  const [apiForm] = Form.useForm();

  const handleSave = (formName: string) => {
    setLoading(true);
    setTimeout(() => {
      message.success(`${formName}设置已保存`);
      setLoading(false);
    }, 1000);
  };

  // 基本设置
  const renderBasicSettings = () => (
    <Card>
      <Form
        form={basicForm}
        layout="vertical"
        initialValues={{
          siteName: 'Bitcoin Mining Master',
          siteUrl: 'https://smartearningtool.top',
          adminEmail: 'davidpony007@gmail.com',
          timezone: 'Europe/London',
          language: 'zh-CN',
          itemsPerPage: 100,
          enableCache: true,
          enableDebug: false
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Form.Item name="siteName" label="系统名称" rules={[{ required: true }]}>
              <Input placeholder="请输入系统名称" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="siteUrl" label="系统地址" rules={[{ required: true, type: 'url' }]}>
              <Input placeholder="请输入系统地址" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="adminEmail" label="管理员邮箱" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="请输入管理员邮箱" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="timezone" label="时区" rules={[{ required: true }]}>
              <Select>
                <Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Option>
                <Option value="America/New_York">美国东部时间 (UTC-5)</Option>
                <Option value="Europe/London">英国时间 (UTC+0)</Option>
                <Option value="Asia/Tokyo">日本时间 (UTC+9)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="language" label="默认语言" rules={[{ required: true }]}>
              <Select>
                <Option value="zh-CN">简体中文</Option>
                <Option value="en-US">English</Option>
                <Option value="ja-JP">日本語</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="itemsPerPage" label="每页显示数量">
              <InputNumber min={10} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableCache" label="启用缓存" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableDebug" label="调试模式" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Divider />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('基本')} loading={loading}>
            保存设置
          </Button>
          <Button icon={<ReloadOutlined />}>
            重置
          </Button>
        </Space>
      </Form>
    </Card>
  );

  // 安全设置
  const renderSecuritySettings = () => (
    <Card>
      <Form
        form={securityForm}
        layout="vertical"
        initialValues={{
          sessionTimeout: 30,
          maxLoginAttempts: 5,
          passwordMinLength: 8,
          requireStrongPassword: true,
          enableTwoFactor: false,
          enableIPWhitelist: false,
          allowedIPs: ''
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Form.Item name="sessionTimeout" label="会话超时(分钟)">
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="maxLoginAttempts" label="最大登录尝试次数">
              <InputNumber min={3} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="passwordMinLength" label="密码最小长度">
              <InputNumber min={6} max={20} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="requireStrongPassword" label="强制强密码" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableTwoFactor" label="启用双因素认证" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableIPWhitelist" label="启用IP白名单" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="allowedIPs" label="允许的IP地址(每行一个)">
              <TextArea rows={4} placeholder="例如: 192.168.1.1" />
            </Form.Item>
          </Col>
        </Row>
        <Divider />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('安全')} loading={loading}>
            保存设置
          </Button>
          <Button icon={<ReloadOutlined />}>
            重置
          </Button>
        </Space>
      </Form>
    </Card>
  );

  // 通知设置
  const renderNotificationSettings = () => (
    <Card>
      <Form
        form={notificationForm}
        layout="vertical"
        initialValues={{
          emailNotification: true,
          smsNotification: false,
          pushNotification: true,
          notifyNewUser: true,
          notifyNewOrder: true,
          notifySystemError: true,
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpUser: '',
          smtpPassword: ''
        }}
      >
        <h3>通知类型</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item name="emailNotification" label="邮件通知" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="smsNotification" label="短信通知" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="pushNotification" label="推送通知" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <h3>通知事件</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item name="notifyNewUser" label="新用户注册" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="notifyNewOrder" label="新订单" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="notifySystemError" label="系统错误" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Divider />
        <h3>SMTP配置</h3>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Form.Item name="smtpHost" label="SMTP服务器">
              <Input placeholder="smtp.example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="smtpPort" label="SMTP端口">
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="smtpUser" label="SMTP用户名">
              <Input placeholder="user@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="smtpPassword" label="SMTP密码">
              <Input.Password placeholder="输入SMTP密码" />
            </Form.Item>
          </Col>
        </Row>
        <Divider />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('通知')} loading={loading}>
            保存设置
          </Button>
          <Button icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button>发送测试邮件</Button>
        </Space>
      </Form>
    </Card>
  );

  // API设置
  const renderApiSettings = () => (
    <Card>
      <Form
        form={apiForm}
        layout="vertical"
        initialValues={{
          apiUrl: 'http://localhost:8888/api',
          wsUrl: 'ws://localhost:8888',
          apiTimeout: 10000,
          enableApiLog: true,
          apiRateLimit: 1000,
          enableCors: true,
          corsOrigins: 'http://localhost:3000'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Form.Item name="apiUrl" label="API地址" rules={[{ required: true }]}>
              <Input placeholder="http://localhost:8888/api" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="wsUrl" label="WebSocket地址">
              <Input placeholder="ws://localhost:8888" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="apiTimeout" label="请求超时(毫秒)">
              <InputNumber min={1000} max={60000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="apiRateLimit" label="频率限制(次/小时)">
              <InputNumber min={100} max={10000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableApiLog" label="启用API日志" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} lg={12}>
            <Form.Item name="enableCors" label="启用CORS" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="corsOrigins" label="允许的源(逗号分隔)">
              <TextArea rows={3} placeholder="http://localhost:3000,https://example.com" />
            </Form.Item>
          </Col>
        </Row>
        <Divider />
        <Space>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => handleSave('API')} loading={loading}>
            保存设置
          </Button>
          <Button icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button>测试连接</Button>
        </Space>
      </Form>
    </Card>
  );

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">系统设置</h1>
      
      <Card>
        <Tabs defaultActiveKey="basic" type="card">
          <TabPane 
            tab={<span><GlobalOutlined />基本设置</span>} 
            key="basic"
          >
            {renderBasicSettings()}
          </TabPane>
          <TabPane 
            tab={<span><LockOutlined />安全设置</span>} 
            key="security"
          >
            {renderSecuritySettings()}
          </TabPane>
          <TabPane 
            tab={<span><BellOutlined />通知设置</span>} 
            key="notification"
          >
            {renderNotificationSettings()}
          </TabPane>
          <TabPane 
            tab={<span><ApiOutlined />API设置</span>} 
            key="api"
          >
            {renderApiSettings()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Settings;
