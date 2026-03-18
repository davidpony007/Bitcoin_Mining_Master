import React, { useState, useEffect } from 'react';
import { Card, Table, Row, Col, Statistic, Spin } from 'antd';
import { EyeOutlined, UserOutlined, DollarOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import { adsApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';

interface AdsStats {
  totalViews: number;
  todayViews: number;
  weekViews: number;
  totalRewards: number;
}

interface AdsTrendItem {
  date: string;
  views: number;
  watchers: number;
  rewards: number;
}

interface AdsTopUser {
  user_id: number;
  email: string;
  total_ad_views: number;
  points_earned: number;
}

const Ads: React.FC = () => {
  const [stats, setStats] = useState<AdsStats>({ totalViews: 0, todayViews: 0, weekViews: 0, totalRewards: 0 });
  const [trend, setTrend] = useState<AdsTrendItem[]>([]);
  const [topUsers, setTopUsers] = useState<AdsTopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => ({ ...prev, [key]: size.width }));
  };

  useEffect(() => {
    Promise.all([
      adsApi.stats(),
      adsApi.trend(30),
      adsApi.topUsers(20),
    ]).then(([statsRes, trendRes, topRes]: any[]) => {
      setStats(statsRes?.data || { totalViews: 0, todayViews: 0, weekViews: 0, totalRewards: 0 });
      setTrend(trendRes?.data || []);
      setTopUsers(topRes?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const getTrendOption = () => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['观看次数', '观看用户数', '获得积分'] },
    grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trend.map(d => d.date), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' },
    series: [
      { name: '观看次数', type: 'line', data: trend.map(d => Number(d.views) || 0), smooth: true, itemStyle: { color: '#1890ff' } },
      { name: '观看用户数', type: 'line', data: trend.map(d => Number(d.watchers) || 0), smooth: true, itemStyle: { color: '#52c41a' } },
      { name: '获得积分', type: 'line', data: trend.map(d => Number(d.rewards) || 0), smooth: true, itemStyle: { color: '#faad14' } },
    ]
  });

  const columns: ColumnsType<AdsTopUser> = [
    { title: '#', key: 'rank', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 100 },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '累计观看次数', dataIndex: 'total_ad_views', key: 'total_ad_views',
      sorter: (a: AdsTopUser, b: AdsTopUser) => (Number(a.total_ad_views) || 0) - (Number(b.total_ad_views) || 0),
      render: (v: number) => (Number(v) || 0).toLocaleString()
    },
    { title: '累计获得积分', dataIndex: 'points_earned', key: 'points_earned', render: (v: number) => (Number(v) || 0).toLocaleString() },
  ];
  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">广告观看统计</h1>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计广告观看量" value={stats.totalViews || 0} prefix={<EyeOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="今日观看量" value={stats.todayViews || 0} prefix={<BarChartOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="本周观看量" value={stats.weekViews || 0} prefix={<UserOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计奖励积分" value={stats.totalRewards || 0} prefix={<DollarOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Card title="近30天广告观看趋势" style={{ marginBottom: 24 }}>
        {loading ? <Spin /> : <ReactECharts option={getTrendOption()} style={{ height: 300 }} />}
      </Card>

      <Card title="广告观看 Top 20 用户">
        <Table
          columns={mergedColumns}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={topUsers}
          rowKey="user_id"
          loading={loading}
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default Ads;

