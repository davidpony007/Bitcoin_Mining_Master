import React, { useState, useEffect } from 'react';
import { Card, Table, Row, Col, Statistic, Spin } from 'antd';
import { GlobalOutlined, UserOutlined, DollarOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import { geographyApi } from '@/services/api/admin';

interface GeoItem {
  country: string;
  users: number;
  orders: number;
  revenue: number;
}

const Geography: React.FC = () => {
  const [data, setData] = useState<GeoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    geographyApi.data().then((res: any) => {
      setData(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalUsers = data.reduce((s, d) => s + (Number(d.users) || 0), 0);
  const totalRevenue = data.reduce((s, d) => s + (Number(d.revenue) || 0), 0);
  const totalOrders = data.reduce((s, d) => s + (Number(d.orders) || 0), 0);

  const getBarOption = () => {
    const top20 = data.slice(0, 20);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: '3%', right: '4%', bottom: '20%', containLabel: true },
      xAxis: { type: 'category', data: top20.map(d => d.country), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '用户数' },
      series: [{
        name: '用户数',
        type: 'bar',
        data: top20.map(d => Number(d.users) || 0),
        itemStyle: { color: '#1890ff' }
      }]
    };
  };

  const columns: ColumnsType<GeoItem> = [
    { title: '#', key: 'rank', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: '国家/地区', dataIndex: 'country', key: 'country' },
    {
      title: '用户数', dataIndex: 'users', key: 'users',
      sorter: (a: GeoItem, b: GeoItem) => (Number(a.users) || 0) - (Number(b.users) || 0),
      render: (v: number) => (Number(v) || 0).toLocaleString()
    },
    {
      title: '订单数', dataIndex: 'orders', key: 'orders',
      sorter: (a: GeoItem, b: GeoItem) => (Number(a.orders) || 0) - (Number(b.orders) || 0),
      render: (v: number) => (Number(v) || 0).toLocaleString()
    },
    {
      title: '收入', dataIndex: 'revenue', key: 'revenue',
      sorter: (a: GeoItem, b: GeoItem) => (Number(a.revenue) || 0) - (Number(b.revenue) || 0),
      render: (v: number) => `$${(Number(v) || 0).toLocaleString()}`
    },
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">地域分析</h1>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="覆盖国家" value={data.length} prefix={<GlobalOutlined />} suffix="个" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="用户总数" value={totalUsers} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="订单总数" value={totalOrders} prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总收入" value={totalRevenue} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card title="Top 20 国家/地区用户分布" style={{ marginBottom: 24 }}>
        {loading ? <Spin /> : <ReactECharts option={getBarOption()} style={{ height: 300 }} />}
      </Card>

      <Card title="地区详情">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="country"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 个国家/地区` }}
        />
      </Card>
    </div>
  );
};

export default Geography;
