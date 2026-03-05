import React from 'react';
import { Card, Table, Button, Input, Space, Tag, Row, Col, Statistic } from 'antd';
import { SearchOutlined, DownloadOutlined, UserOutlined, TeamOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import './styles.css';

const Users: React.FC = () => {
  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '国家', dataIndex: 'country', key: 'country' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '活跃' : '非活跃'}
        </Tag>
      ),
    },
    { title: '注册时间', dataIndex: 'registeredAt', key: 'registeredAt' },
    { 
      title: '操作', 
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small">查看</Button>
          <Button type="link" size="small">编辑</Button>
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: '1',
      id: '10001',
      username: 'user_001',
      email: 'user001@example.com',
      country: 'USA',
      status: 'active',
      registeredAt: '2026-01-15',
    },
    {
      key: '2',
      id: '10002',
      username: 'user_002',
      email: 'user002@example.com',
      country: 'China',
      status: 'active',
      registeredAt: '2026-01-18',
    },
    // ... 更多数据
  ];

  // 用户增长趋势图
  const getUserTrendOption = () => ({
    title: {
      text: '用户增长趋势',
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['新增用户', '累计用户'],
      bottom: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['01-23', '01-24', '01-25', '01-26', '01-27', '01-28', '01-29']
    },
    yAxis: [
      {
        type: 'value',
        name: '新增',
        position: 'left'
      },
      {
        type: 'value',
        name: '累计',
        position: 'right'
      }
    ],
    series: [
      {
        name: '新增用户',
        type: 'bar',
        data: [125, 128, 132, 145, 138, 142, 156],
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '累计用户',
        type: 'line',
        yAxisIndex: 1,
        data: [12100, 12228, 12360, 12505, 12643, 12785, 12941],
        smooth: true,
        itemStyle: { color: '#52c41a' }
      }
    ]
  });

  // 用户来源分布
  const getUserSourceOption = () => ({
    title: {
      text: '用户来源分布',
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle'
    },
    series: [
      {
        name: '来源',
        type: 'pie',
        radius: '55%',
        center: ['50%', '55%'],
        data: [
          { value: 3850, name: '自然搜索', itemStyle: { color: '#1890ff' } },
          { value: 2820, name: '推荐注册', itemStyle: { color: '#52c41a' } },
          { value: 2100, name: '社交媒体', itemStyle: { color: '#faad14' } },
          { value: 1580, name: '广告投放', itemStyle: { color: '#722ed1' } },
          { value: 1230, name: '其他', itemStyle: { color: '#13c2c2' } }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  });

  // 用户活跃度分布
  const getUserActivityOption = () => ({
    title: {
      text: '用户活跃度分布',
      left: 'center',
      textStyle: { fontSize: 16 }
    },
    tooltip: {
      trigger: 'item'
    },
    radar: {
      indicator: [
        { name: '登录频率', max: 100 },
        { name: '停留时长', max: 100 },
        { name: '互动次数', max: 100 },
        { name: '消费金额', max: 100 },
        { name: '分享次数', max: 100 }
      ]
    },
    series: [
      {
        name: '活跃度指标',
        type: 'radar',
        data: [
          {
            value: [85, 78, 92, 68, 75],
            name: '高活跃用户',
            itemStyle: { color: '#52c41a' }
          },
          {
            value: [65, 55, 68, 45, 52],
            name: '中活跃用户',
            itemStyle: { color: '#1890ff' }
          },
          {
            value: [35, 28, 32, 22, 25],
            name: '低活跃用户',
            itemStyle: { color: '#faad14' }
          }
        ]
      }
    ]
  });

  return (
    <div className="users-page">
      <h1 className="page-title">用户管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={12941}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日新增"
              value={156}
              prefix={<RiseOutlined />}
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={3658}
              prefix={<TeamOutlined />}
              suffix="人"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="流失用户"
              value={285}
              prefix={<FallOutlined />}
              suffix="人"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表展示 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getUserTrendOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getUserSourceOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card>
            <ReactECharts option={getUserActivityOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>
      
      {/* 用户列表 */}
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="搜索用户"
            prefix={<SearchOutlined />}
            style={{ width: 300 }}
          />
          <Button type="primary" icon={<DownloadOutlined />}>
            导出数据
          </Button>
        </Space>
        
        <Table 
          columns={columns} 
          dataSource={data}
          pagination={{
            total: 100,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Card>
    </div>
  );
};

export default Users;
