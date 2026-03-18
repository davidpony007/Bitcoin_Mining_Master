import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Spin, message } from 'antd';
import { 
  UserOutlined, 
  ArrowUpOutlined, 
  DollarOutlined,
  ShoppingOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { dashboardApi } from '@/services/api/admin';
import './styles.css';

interface TrendItem {
  date: string;
  newUsers: number;
  dau: number;
  orders: number;
  revenue: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState<any>(null);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [statsRes, trendRes] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.trend(7),
        ]);
        if (statsRes?.success) setStatsData(statsRes.data);
        if (trendRes?.success) setTrendData(trendRes.data);
      } catch (e) {
        message.error('加载仪表盘数据失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const s = statsData || {};
  const stats = [
    { title: '总用户数', value: s.totalUsers ?? 0, prefix: <UserOutlined />, suffix: '人', precision: 0 },
    { title: '今日活跃', value: s.todayActive ?? 0, prefix: <ArrowUpOutlined />, suffix: '人', precision: 0 },
    { title: '总收入', value: s.totalRevenue ?? 0, prefix: <DollarOutlined />, suffix: '$', precision: 2 },
    { title: '今日订单', value: s.todayOrders ?? 0, prefix: <ShoppingOutlined />, suffix: '单', precision: 0 },
    { title: '今日新增', value: s.newUsersToday ?? 0, prefix: <RiseOutlined />, suffix: '人', precision: 0 },
  ];

  const dates = trendData.map(r => r.date.slice(5));

  const columns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: 'DAU', dataIndex: 'dau', key: 'dau' },
    { title: '新增用户', dataIndex: 'newUsers', key: 'newUsers' },
    { title: '订单数', dataIndex: 'orders', key: 'orders' },
    { title: '收入($)', dataIndex: 'revenue', key: 'revenue', render: (v: number) => v.toFixed(2) },
  ];

  const getUserGrowthOption = () => ({
    title: { text: '用户增长趋势', left: 'center', textStyle: { fontSize: 16, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['日活用户', '新增用户'], bottom: 10 },
    grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: dates },
    yAxis: { type: 'value' },
    series: [
      {
        name: '日活用户', type: 'line', data: trendData.map(r => r.dau), smooth: true,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.5)' }, { offset: 1, color: 'rgba(24,144,255,0.1)' }] } },
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '新增用户', type: 'line', data: trendData.map(r => r.newUsers), smooth: true,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(82,196,26,0.5)' }, { offset: 1, color: 'rgba(82,196,26,0.1)' }] } },
        itemStyle: { color: '#52c41a' }
      },
    ]
  });

  const getRevenueOption = () => ({
    title: { text: '每日收入($)', left: 'center', textStyle: { fontSize: 16, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: '收入($)' },
    series: [{
      name: '收入', type: 'bar', data: trendData.map(r => r.revenue.toFixed(2)),
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#faad14' }, { offset: 1, color: '#ffd666' }] } },
      barWidth: '60%'
    }]
  });

  const getOrdersOption = () => ({
    title: { text: '每日订单数', left: 'center', textStyle: { fontSize: 16, fontWeight: 'bold' } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value', name: '订单数' },
    series: [{
      name: '订单', type: 'bar', data: trendData.map(r => r.orders),
      itemStyle: { color: '#722ed1' }, barWidth: '60%'
    }]
  });

  return (
    <div className="dashboard">
      <h1 className="page-title">数据概览</h1>
      <Spin spinning={loading}>
        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {stats.map((stat, index) => (
            <Col xs={24} sm={12} lg={index < 3 ? 6 : 6} key={index}>
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

        {/* 图表 */}
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
          <Col xs={24}>
            <Card>
              <ReactECharts option={getOrdersOption()} style={{ height: 300 }} />
            </Card>
          </Col>
        </Row>

        {/* 数据表格 */}
        <Card title="最近7日数据">
          <Table
            columns={columns}
            dataSource={trendData.map((r, i) => ({ ...r, key: i }))}
            pagination={false}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Dashboard;
