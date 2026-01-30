import React, { useState } from 'react';
import { Card, Table, Space, Tag, Select, Row, Col, Statistic } from 'antd';
import { GlobalOutlined, UserOutlined, DollarOutlined, RiseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';

const { Option } = Select;

interface GeographyData {
  id: string;
  country: string;
  region: string;
  users: number;
  activeUsers: number;
  revenue: number;
  orders: number;
  growth: number;
}

const Geography: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'users' | 'revenue'>('users');

  const geographyData: GeographyData[] = [
    {
      id: 'geo_001',
      country: '美国',
      region: '北美',
      users: 15420,
      activeUsers: 8850,
      revenue: 580000,
      orders: 12800,
      growth: 12.5
    },
    {
      id: 'geo_002',
      country: '中国',
      region: '亚洲',
      users: 23500,
      activeUsers: 15200,
      revenue: 450000,
      orders: 18500,
      growth: 8.3
    },
    {
      id: 'geo_003',
      country: '日本',
      region: '亚洲',
      users: 9800,
      activeUsers: 6200,
      revenue: 380000,
      orders: 8900,
      growth: -2.1
    },
    {
      id: 'geo_004',
      country: '英国',
      region: '欧洲',
      users: 8500,
      activeUsers: 5100,
      revenue: 320000,
      orders: 7200,
      growth: 15.7
    },
    {
      id: 'geo_005',
      country: '德国',
      region: '欧洲',
      users: 7200,
      activeUsers: 4500,
      revenue: 290000,
      orders: 6500,
      growth: 6.2
    },
    {
      id: 'geo_006',
      country: '加拿大',
      region: '北美',
      users: 6800,
      activeUsers: 3900,
      revenue: 250000,
      orders: 5800,
      growth: 9.8
    },
    {
      id: 'geo_007',
      country: '澳大利亚',
      region: '大洋洲',
      users: 5500,
      activeUsers: 3200,
      revenue: 220000,
      orders: 4900,
      growth: 11.2
    },
    {
      id: 'geo_008',
      country: '韩国',
      region: '亚洲',
      users: 5200,
      activeUsers: 3100,
      revenue: 180000,
      orders: 4200,
      growth: 7.5
    }
  ];

  // 世界地图配置
  const getWorldMapOption = () => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const data = geographyData.find(item => item.country === params.name);
        if (data) {
          return `${params.name}<br/>用户数: ${data.users.toLocaleString()}<br/>收入: $${data.revenue.toLocaleString()}`;
        }
        return params.name;
      }
    },
    visualMap: {
      min: 0,
      max: 25000,
      text: ['高', '低'],
      realtime: false,
      calculable: true,
      inRange: {
        color: ['#e0f3ff', '#91d5ff', '#40a9ff', '#1890ff', '#096dd9']
      }
    },
    series: [
      {
        name: '用户分布',
        type: 'map',
        map: 'world',
        roam: true,
        itemStyle: {
          areaColor: '#f0f0f0',
          borderColor: '#ccc'
        },
        emphasis: {
          itemStyle: {
            areaColor: '#40a9ff'
          },
          label: {
            show: true
          }
        },
        data: geographyData.map(item => ({
          name: item.country,
          value: selectedMetric === 'users' ? item.users : item.revenue
        }))
      }
    ]
  });

  // 地区分布柱状图
  const getRegionChartOption = () => {
    const regionStats = geographyData.reduce((acc, item) => {
      if (!acc[item.region]) {
        acc[item.region] = { users: 0, revenue: 0 };
      }
      acc[item.region].users += item.users;
      acc[item.region].revenue += item.revenue;
      return acc;
    }, {} as Record<string, { users: number; revenue: number }>);

    const regions = Object.keys(regionStats);
    const users = regions.map(r => regionStats[r].users);
    const revenue = regions.map(r => regionStats[r].revenue);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: {
        data: ['用户数', '收入']
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: regions
      },
      yAxis: [
        {
          type: 'value',
          name: '用户数',
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
          type: 'bar',
          data: users,
          itemStyle: { color: '#1890ff' }
        },
        {
          name: '收入',
          type: 'line',
          yAxisIndex: 1,
          data: revenue,
          itemStyle: { color: '#52c41a' }
        }
      ]
    };
  };

  const columns: ColumnsType<GeographyData> = [
    {
      title: '国家/地区',
      dataIndex: 'country',
      key: 'country',
      width: 120,
      fixed: 'left'
    },
    {
      title: '大区',
      dataIndex: 'region',
      key: 'region',
      width: 100,
      render: (region: string) => {
        const colorMap: Record<string, string> = {
          '亚洲': 'blue',
          '欧洲': 'purple',
          '北美': 'green',
          '大洋洲': 'orange'
        };
        return <Tag color={colorMap[region]}>{region}</Tag>;
      }
    },
    {
      title: '用户总数',
      dataIndex: 'users',
      key: 'users',
      width: 120,
      sorter: (a, b) => a.users - b.users,
      render: (users: number) => users.toLocaleString()
    },
    {
      title: '活跃用户',
      dataIndex: 'activeUsers',
      key: 'activeUsers',
      width: 120,
      render: (active: number, record) => (
        <div>
          <div>{active.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {((active / record.users) * 100).toFixed(1)}%
          </div>
        </div>
      )
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (revenue: number) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
          ${revenue.toLocaleString()}
        </span>
      )
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      width: 100,
      sorter: (a, b) => a.orders - b.orders,
      render: (orders: number) => orders.toLocaleString()
    },
    {
      title: '增长率',
      dataIndex: 'growth',
      key: 'growth',
      width: 100,
      sorter: (a, b) => a.growth - b.growth,
      render: (growth: number) => {
        const color = growth >= 0 ? '#52c41a' : '#ff4d4f';
        const icon = growth >= 0 ? '↑' : '↓';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {icon} {Math.abs(growth).toFixed(1)}%
          </span>
        );
      }
    }
  ];

  const totalStats = {
    totalUsers: geographyData.reduce((sum, item) => sum + item.users, 0),
    totalRevenue: geographyData.reduce((sum, item) => sum + item.revenue, 0),
    countries: geographyData.length,
    avgGrowth: geographyData.reduce((sum, item) => sum + item.growth, 0) / geographyData.length
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">地域分析</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={totalStats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收入"
              value={totalStats.totalRevenue}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="覆盖国家"
              value={totalStats.countries}
              prefix={<GlobalOutlined />}
              suffix="个"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均增长率"
              value={totalStats.avgGrowth}
              prefix={<RiseOutlined />}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card 
            title="全球用户分布地图"
            extra={
              <Select 
                value={selectedMetric} 
                onChange={setSelectedMetric}
                style={{ width: 120 }}
              >
                <Option value="users">用户数</Option>
                <Option value="revenue">收入</Option>
              </Select>
            }
          >
            <div style={{ background: '#f0f2f5', padding: 20, borderRadius: 8 }}>
              <div style={{ textAlign: 'center', color: '#999' }}>
                地图组件需要引入 echarts 地图数据
                <br />
                请查看文档：https://echarts.apache.org/zh/tutorial.html#在地理坐标系上显示数据
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24}>
          <Card title="地区分布统计">
            <ReactECharts option={getRegionChartOption()} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 地区详情表格 */}
      <Card title="地区详情">
        <Table
          columns={columns}
          dataSource={geographyData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            total: geographyData.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个国家/地区`
          }}
        />
      </Card>
    </div>
  );
};

export default Geography;
