import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, InputNumber, message, Row, Col, Statistic, Tabs } from 'antd';
import { GiftOutlined, PlusOutlined, MinusOutlined, HistoryOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

interface PointsRecord {
  id: string;
  userId: string;
  userName: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdate: string;
}

interface PointsHistory {
  id: string;
  userId: string;
  userName: string;
  type: 'earn' | 'spend';
  amount: number;
  reason: string;
  balance: number;
  time: string;
}

const Points: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [operationType, setOperationType] = useState<'add' | 'deduct'>('add');
  const [form] = Form.useForm();

  const pointsData: PointsRecord[] = [
    {
      id: 'user_10001',
      userId: 'user_10001',
      userName: 'Alice Chen',
      balance: 15800,
      totalEarned: 28500,
      totalSpent: 12700,
      lastUpdate: '2026-01-29 10:30:00'
    },
    {
      id: 'user_10002',
      userId: 'user_10002',
      userName: 'Bob Wang',
      balance: 23500,
      totalEarned: 35000,
      totalSpent: 11500,
      lastUpdate: '2026-01-29 09:15:00'
    },
    {
      id: 'user_10003',
      userId: 'user_10003',
      userName: 'Carol Li',
      balance: 8920,
      totalEarned: 15600,
      totalSpent: 6680,
      lastUpdate: '2026-01-28 16:45:00'
    }
  ];

  const historyData: PointsHistory[] = [
    {
      id: 'pts_001',
      userId: 'user_10001',
      userName: 'Alice Chen',
      type: 'earn',
      amount: 500,
      reason: '每日签到',
      balance: 15800,
      time: '2026-01-29 10:30:00'
    },
    {
      id: 'pts_002',
      userId: 'user_10002',
      userName: 'Bob Wang',
      type: 'earn',
      amount: 1000,
      reason: '邀请好友',
      balance: 23500,
      time: '2026-01-29 09:15:00'
    },
    {
      id: 'pts_003',
      userId: 'user_10001',
      userName: 'Alice Chen',
      type: 'spend',
      amount: 800,
      reason: '兑换礼品',
      balance: 15300,
      time: '2026-01-28 18:20:00'
    },
    {
      id: 'pts_004',
      userId: 'user_10003',
      userName: 'Carol Li',
      type: 'earn',
      amount: 2000,
      reason: '完成任务',
      balance: 8920,
      time: '2026-01-28 16:45:00'
    }
  ];

  // 积分趋势图
  const getPointsTrendChart = () => ({
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['获得积分', '消费积分']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['01-23', '01-24', '01-25', '01-26', '01-27', '01-28', '01-29']
    },
    yAxis: {
      type: 'value',
      name: '积分'
    },
    series: [
      {
        name: '获得积分',
        type: 'bar',
        data: [3200, 2800, 4100, 3500, 5200, 4800, 3800],
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '消费积分',
        type: 'bar',
        data: [1500, 1200, 1800, 1600, 2200, 1900, 1400],
        itemStyle: { color: '#ff4d4f' }
      }
    ]
  });

  const handleOperation = () => {
    form.validateFields().then(values => {
      console.log('积分操作:', { ...values, type: operationType });
      message.success(operationType === 'add' ? '积分发放成功' : '积分扣除成功');
      setModalVisible(false);
      form.resetFields();
    });
  };

  const balanceColumns: ColumnsType<PointsRecord> = [
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 120
    },
    {
      title: '用户名',
      dataIndex: 'userName',
      key: 'userName',
      width: 120
    },
    {
      title: '当前余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 120,
      sorter: (a, b) => a.balance - b.balance,
      render: (balance: number) => (
        <span style={{ color: '#1890ff', fontWeight: 'bold', fontSize: 16 }}>
          {balance.toLocaleString()}
        </span>
      )
    },
    {
      title: '累计获得',
      dataIndex: 'totalEarned',
      key: 'totalEarned',
      width: 120,
      sorter: (a, b) => a.totalEarned - b.totalEarned,
      render: (total: number) => (
        <span style={{ color: '#52c41a' }}>
          +{total.toLocaleString()}
        </span>
      )
    },
    {
      title: '累计消费',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      width: 120,
      sorter: (a, b) => a.totalSpent - b.totalSpent,
      render: (total: number) => (
        <span style={{ color: '#ff4d4f' }}>
          -{total.toLocaleString()}
        </span>
      )
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdate',
      key: 'lastUpdate',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setOperationType('add');
              form.setFieldsValue({ userId: record.userId });
              setModalVisible(true);
            }}
          >
            发放
          </Button>
          <Button 
            size="small" 
            danger
            icon={<MinusOutlined />}
            onClick={() => {
              setOperationType('deduct');
              form.setFieldsValue({ userId: record.userId });
              setModalVisible(true);
            }}
          >
            扣除
          </Button>
        </Space>
      )
    }
  ];

  const historyColumns: ColumnsType<PointsHistory> = [
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 120
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'earn' ? 'success' : 'error'}>
          {type === 'earn' ? '获得' : '消费'}
        </Tag>
      )
    },
    {
      title: '数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number, record) => (
        <span style={{ color: record.type === 'earn' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>
          {record.type === 'earn' ? '+' : '-'}{amount.toLocaleString()}
        </span>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason'
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 120,
      render: (balance: number) => balance.toLocaleString()
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180
    }
  ];

  const totalStats = {
    totalBalance: pointsData.reduce((sum, p) => sum + p.balance, 0),
    totalEarned: pointsData.reduce((sum, p) => sum + p.totalEarned, 0),
    totalSpent: pointsData.reduce((sum, p) => sum + p.totalSpent, 0),
    users: pointsData.length
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">积分系统</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="积分总余额"
              value={totalStats.totalBalance}
              prefix={<GiftOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计发放"
              value={totalStats.totalEarned}
              prefix={<PlusOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计消费"
              value={totalStats.totalSpent}
              prefix={<MinusOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="用户数量"
              value={totalStats.users}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 积分趋势图 */}
      <Card title="积分趋势" style={{ marginBottom: 24 }}>
        <ReactECharts option={getPointsTrendChart()} style={{ height: 300 }} />
      </Card>

      {/* 标签页 */}
      <Card>
        <Tabs defaultActiveKey="balance">
          <TabPane tab={<span><GiftOutlined />积分余额</span>} key="balance">
            <Space style={{ marginBottom: 16 }}>
              <Search placeholder="搜索用户" style={{ width: 250 }} />
            </Space>
            <Table
              columns={balanceColumns}
              dataSource={pointsData}
              rowKey="id"
              loading={loading}
              pagination={{
                total: pointsData.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`
              }}
            />
          </TabPane>
          <TabPane tab={<span><HistoryOutlined />积分记录</span>} key="history">
            <Space style={{ marginBottom: 16 }}>
              <Search placeholder="搜索用户" style={{ width: 250 }} />
              <Select defaultValue="all" style={{ width: 120 }}>
                <Option value="all">全部类型</Option>
                <Option value="earn">获得</Option>
                <Option value="spend">消费</Option>
              </Select>
            </Space>
            <Table
              columns={historyColumns}
              dataSource={historyData}
              rowKey="id"
              loading={loading}
              pagination={{
                total: historyData.length,
                pageSize: 10,
                showTotal: (total) => `共 ${total} 条记录`
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 积分操作弹窗 */}
      <Modal
        title={operationType === 'add' ? '发放积分' : '扣除积分'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleOperation}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="userId" label="用户ID" rules={[{ required: true }]}>
            <Input placeholder="请输入用户ID" />
          </Form.Item>
          <Form.Item name="amount" label="积分数量" rules={[{ required: true }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              min={1}
              placeholder="请输入积分数量"
            />
          </Form.Item>
          <Form.Item name="reason" label="操作原因" rules={[{ required: true }]}>
            <Input.TextArea 
              rows={3}
              placeholder="请输入操作原因"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Points;
