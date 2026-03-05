import React from 'react';
import { Row, Col, Card, Statistic, Table, Progress } from 'antd';
import { 
  UserOutlined, 
  ArrowUpOutlined, 
  DollarOutlined,
  ShoppingOutlined 
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import './styles.css';

const Dashboard: React.FC = () => {
  // 模拟数据
  const stats = [
    {
      title: '总用户数',
      value: 12580,
      prefix: <UserOutlined />,
      suffix: '人',
      precision: 0,
    },
    {
      title: '今日活跃',
      value: 3658,
      prefix: <ArrowUpOutlined />,
      suffix: '人',
      precision: 0,
    },
    {
      title: '总收入',
      value: 285420,
      prefix: <DollarOutlined />,
      suffix: '$',
      precision: 2,
    },
    {
      title: '今日订单',
      value: 452,
      prefix: <ShoppingOutlined />,
      suffix: '单',
      precision: 0,
    },
  ];

  const columns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: 'DAU', dataIndex: 'dau', key: 'dau' },
    { title: '新增用户', dataIndex: 'newUsers', key: 'newUsers' },
    { title: '订单数', dataIndex: 'orders', key: 'orders' },
    { title: '收入($)', dataIndex: 'revenue', key: 'revenue' },
  ];

  const data = [
    { key: '1', date: '2026-01-29', dau: 3658, newUsers: 156, orders: 452, revenue: 12580 },
    { key: '2', date: '2026-01-28', dau: 3542, newUsers: 142, orders: 438, revenue: 11920 },
    { key: '3', date: '2026-01-27', dau: 3421, newUsers: 138, orders: 425, revenue: 11560 },
    { key: '4', date: '2026-01-26', dau: 3389, newUsers: 145, orders: 416, revenue: 11340 },
    { key: '5', date: '2026-01-25', dau: 3256, newUsers: 132, orders: 402, revenue: 10980 },
  ];

  // 用户增长趋势图
  const getUserGrowthOption = () => ({
    title: {
      text: '用户增长趋势',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['日活用户', '新增用户'],
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
      boundaryGap: false,
      data: ['01-23', '01-24', '01-25', '01-26', '01-27', '01-28', '01-29']
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        name: '日活用户',
        type: 'line',
        data: [3100, 3150, 3256, 3389, 3421, 3542, 3658],
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.5)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
            ]
          }
        },
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '新增用户',
        type: 'line',
        data: [125, 128, 132, 145, 138, 142, 156],
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(82, 196, 26, 0.5)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.1)' }
            ]
          }
        },
        itemStyle: { color: '#52c41a' }
      }
    ]
  });

  // 收入统计图
  const getRevenueOption = () => ({
    title: {
      text: '收入统计',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['01-23', '01-24', '01-25', '01-26', '01-27', '01-28', '01-29']
    },
    yAxis: {
      type: 'value',
      name: '收入($)'
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: [10500, 10800, 10980, 11340, 11560, 11920, 12580],
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#faad14' },
              { offset: 1, color: '#ffd666' }
            ]
          }
        },
        barWidth: '60%'
      }
    ]
  });

  // 订单状态分布
  const getOrderStatusOption = () => ({
    title: {
      text: '订单状态分布',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
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
        name: '订单状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {d}%'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: [
          { value: 280, name: '已完成', itemStyle: { color: '#52c41a' } },
          { value: 120, name: '处理中', itemStyle: { color: '#1890ff' } },
          { value: 35, name: '待支付', itemStyle: { color: '#faad14' } },
          { value: 17, name: '已取消', itemStyle: { color: '#ff4d4f' } }
        ]
      }
    ]
  });

  // 实时数据监控
  const getRealTimeOption = () => ({
    title: {
      text: '实时数据监控',
      left: 'center',
      textStyle: { fontSize: 16, fontWeight: 'bold' }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['在线用户', '系统负载'],
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
      data: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00']
    },
    yAxis: [
      {
        type: 'value',
        name: '在线用户',
        position: 'left'
      },
      {
        type: 'value',
        name: '负载(%)',
        position: 'right',
        max: 100
      }
    ],
    series: [
      {
        name: '在线用户',
        type: 'line',
        data: [1200, 1450, 1680, 1850, 1950, 2100, 2280, 2450, 2680, 2850],
        smooth: true,
        itemStyle: { color: '#722ed1' }
      },
      {
        name: '系统负载',
        type: 'line',
        yAxisIndex: 1,
        data: [35, 42, 48, 52, 58, 62, 68, 65, 72, 75],
        smooth: true,
        itemStyle: { color: '#eb2f96' }
      }
    ]
  });

  return (
    <div className="dashboard">
      <h1 className="page-title">数据概览</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                precision={stat.precision}
                prefix={stat.prefix}
                suffix={stat.suffix}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 图表展示区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getUserGrowthOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getRevenueOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getOrderStatusOption()} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts option={getRealTimeOption()} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      {/* 数据表格 */}
      <Card title="最近7日数据">
        <Table 
          columns={columns} 
          dataSource={data} 
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Dashboard;
