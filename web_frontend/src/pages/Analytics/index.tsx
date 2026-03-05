import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Select, Table, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, UserOutlined, DollarOutlined, LineChartOutlined, FireOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface TrendData {
  date: string;
  users: number;
  revenue: number;
  orders: number;
}

interface RankData {
  rank: number;
  country: string;
  users: number;
  revenue: number;
  growth: number;
}

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(false);

  // 模拟数据
  const trendData: TrendData[] = [
    { date: '01-23', users: 1200, revenue: 45000, orders: 320 },
    { date: '01-24', users: 1350, revenue: 48000, orders: 340 },
    { date: '01-25', users: 1500, revenue: 52000, orders: 380 },
    { date: '01-26', users: 1420, revenue: 49000, orders: 350 },
    { date: '01-27', users: 1680, revenue: 58000, orders: 420 },
    { date: '01-28', users: 1850, revenue: 62000, orders: 450 },
    { date: '01-29', users: 2000, revenue: 68000, orders: 480 },
  ];

  const rankData: RankData[] = [
    { rank: 1, country: '美国', users: 15420, revenue: 580000, growth: 12.5 },
    { rank: 2, country: '中国', users: 12300, revenue: 450000, growth: 8.3 },
    { rank: 3, country: '日本', users: 9800, revenue: 380000, growth: -2.1 },
    { rank: 4, country: '英国', users: 8500, revenue: 320000, growth: 15.7 },
    { rank: 5, country: '德国', users: 7200, revenue: 290000, growth: 6.2 },
  ];

  // 趋势图表配置
  const getTrendOption = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
    },
    legend: {
      data: ['用户数', '收入', '订单数']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendData.map(item => item.date)
    },
    yAxis: [
      {
        type: 'value',
        name: '用户/订单',
        position: 'left'
      },
      {
        type: 'value',
        name: '收入',
        position: 'right'
      }
    ],
    series: [
      {
        name: '用户数',
        type: 'line',
        data: trendData.map(item => item.users),
        smooth: true,
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '收入',
        type: 'line',
        yAxisIndex: 1,
        data: trendData.map(item => item.revenue),
        smooth: true,
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '订单数',
        type: 'line',
        data: trendData.map(item => item.orders),
        smooth: true,
        itemStyle: { color: '#faad14' }
      }
    ]
  });

  // 用户来源饼图
  const getUserSourceOption = () => ({
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '用户来源',
        type: 'pie',
        radius: '50%',
        data: [
          { value: 3500, name: '自然流量' },
          { value: 2800, name: '推广链接' },
          { value: 2200, name: '社交媒体' },
          { value: 1800, name: '搜索引擎' },
          { value: 1200, name: '其他' }
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

  // 表格列定义
  const columns: ColumnsType<RankData> = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => {
        const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        return <span style={{ color: rank <= 3 ? colors[rank - 1] : undefined, fontWeight: 'bold' }}>
          #{rank}
        </span>;
      }
    },
    {
      title: '国家/地区',
      dataIndex: 'country',
      key: 'country',
    },
    {
      title: '用户数',
      dataIndex: 'users',
      key: 'users',
      render: (users: number) => users.toLocaleString()
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (revenue: number) => `$${revenue.toLocaleString()}`
    },
    {
      title: '增长率',
      dataIndex: 'growth',
      key: 'growth',
      render: (growth: number) => (
        <span style={{ color: growth >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {growth >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {Math.abs(growth)}%
        </span>
      )
    }
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">数据分析</h1>
      
      {/* 筛选器 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <span>时间范围：</span>
          <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
            <Option value="day">今日</Option>
            <Option value="week">本周</Option>
            <Option value="month">本月</Option>
          </Select>
          <RangePicker 
            defaultValue={[dayjs().subtract(7, 'day'), dayjs()]}
            format="YYYY-MM-DD"
          />
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={11270}
              prefix={<UserOutlined />}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}>
                <ArrowUpOutlined /> 12.5%
              </span>}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收入"
              value={2388000}
              prefix={<DollarOutlined />}
              suffix={<span style={{ fontSize: 14, color: '#52c41a' }}>
                <ArrowUpOutlined /> 8.2%
              </span>}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="日活跃用户"
              value={2850}
              prefix={<FireOutlined />}
              suffix={<span style={{ fontSize: 14, color: '#ff4d4f' }}>
                <ArrowDownOutlined /> 2.1%
              </span>}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="转化率"
              value={18.5}
              prefix={<LineChartOutlined />}
              suffix="%"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="数据趋势" bordered={false}>
            <ReactECharts option={getTrendOption()} style={{ height: 400 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="用户来源分布" bordered={false}>
            <ReactECharts option={getUserSourceOption()} style={{ height: 400 }} />
          </Card>
        </Col>
      </Row>

      {/* 排名表格 */}
      <Card title="地区排名" bordered={false}>
        <Table
          columns={columns}
          dataSource={rankData}
          rowKey="rank"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Analytics;
