import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Row, Col, Statistic, Progress } from 'antd';
import { ThunderboltOutlined, DollarOutlined, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';

const { Search } = Input;
const { Option } = Select;

interface MiningData {
  id: string;
  userId: string;
  userName: string;
  contractType: string;
  hashrate: number;
  duration: number;
  startTime: string;
  endTime: string;
  totalRevenue: number;
  dailyRevenue: number;
  status: 'active' | 'completed' | 'expired';
  progress: number;
}

const Mining: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 模拟挖矿数据
  const miningData: MiningData[] = [
    {
      id: 'mining_001',
      userId: 'user_10001',
      userName: 'Alice Chen',
      contractType: '标准合约',
      hashrate: 100,
      duration: 30,
      startTime: '2026-01-01',
      endTime: '2026-01-31',
      totalRevenue: 1250.50,
      dailyRevenue: 41.68,
      status: 'active',
      progress: 93
    },
    {
      id: 'mining_002',
      userId: 'user_10002',
      userName: 'Bob Wang',
      contractType: '高级合约',
      hashrate: 500,
      duration: 90,
      startTime: '2026-01-15',
      endTime: '2026-04-15',
      totalRevenue: 8920.00,
      dailyRevenue: 99.11,
      status: 'active',
      progress: 16
    },
    {
      id: 'mining_003',
      userId: 'user_10003',
      userName: 'Carol Li',
      contractType: 'VIP合约',
      hashrate: 1000,
      duration: 180,
      startTime: '2025-12-01',
      endTime: '2026-05-30',
      totalRevenue: 25680.00,
      dailyRevenue: 142.67,
      status: 'active',
      progress: 33
    },
    {
      id: 'mining_004',
      userId: 'user_10004',
      userName: 'David Zhang',
      contractType: '标准合约',
      hashrate: 200,
      duration: 30,
      startTime: '2025-12-15',
      endTime: '2026-01-14',
      totalRevenue: 2580.00,
      dailyRevenue: 86.00,
      status: 'completed',
      progress: 100
    },
    {
      id: 'mining_005',
      userId: 'user_10005',
      userName: 'Eva Liu',
      contractType: '高级合约',
      hashrate: 300,
      duration: 60,
      startTime: '2026-01-20',
      endTime: '2026-03-21',
      totalRevenue: 4320.00,
      dailyRevenue: 72.00,
      status: 'active',
      progress: 15
    }
  ];

  // 算力分布图表
  const getHashrateDistribution = () => ({
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c}T ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '算力分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        data: [
          { value: 1000, name: 'VIP合约', itemStyle: { color: '#722ed1' } },
          { value: 800, name: '高级合约', itemStyle: { color: '#1890ff' } },
          { value: 300, name: '标准合约', itemStyle: { color: '#52c41a' } }
        ]
      }
    ]
  });

  // 每日收益趋势
  const getRevenueChart = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
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
      name: '收益 ($)'
    },
    series: [
      {
        name: '每日收益',
        type: 'line',
        data: [320, 350, 380, 360, 420, 450, 480],
        smooth: true,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.5)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.1)' }
            ]
          }
        },
        itemStyle: { color: '#1890ff' }
      }
    ]
  });

  const columns: ColumnsType<MiningData> = [
    {
      title: '合约ID',
      dataIndex: 'id',
      key: 'id',
      width: 130
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.userId}</div>
        </div>
      )
    },
    {
      title: '合约类型',
      dataIndex: 'contractType',
      key: 'contractType',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          '标准合约': 'green',
          '高级合约': 'blue',
          'VIP合约': 'purple'
        };
        return <Tag color={typeMap[type]}>{type}</Tag>;
      }
    },
    {
      title: '算力',
      dataIndex: 'hashrate',
      key: 'hashrate',
      width: 100,
      sorter: (a, b) => a.hashrate - b.hashrate,
      render: (hashrate: number) => `${hashrate}T`
    },
    {
      title: '周期',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number) => `${duration}天`
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number) => (
        <Progress 
          percent={progress} 
          size="small"
          status={progress === 100 ? 'success' : 'active'}
        />
      )
    },
    {
      title: '每日收益',
      dataIndex: 'dailyRevenue',
      key: 'dailyRevenue',
      width: 120,
      sorter: (a, b) => a.dailyRevenue - b.dailyRevenue,
      render: (revenue: number) => <span style={{ color: '#52c41a' }}>${revenue.toFixed(2)}</span>
    },
    {
      title: '总收益',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 120,
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: (revenue: number) => <span style={{ color: '#faad14', fontWeight: 'bold' }}>${revenue.toFixed(2)}</span>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          active: { label: '挖矿中', color: 'success' },
          completed: { label: '已完成', color: 'default' },
          expired: { label: '已过期', color: 'error' }
        };
        const config = statusMap[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 120
    },
    {
      title: '结束时间',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 120
    }
  ];

  const totalStats = {
    hashrate: miningData.filter(m => m.status === 'active').reduce((sum, m) => sum + m.hashrate, 0),
    dailyRevenue: miningData.filter(m => m.status === 'active').reduce((sum, m) => sum + m.dailyRevenue, 0),
    totalRevenue: miningData.reduce((sum, m) => sum + m.totalRevenue, 0),
    activeContracts: miningData.filter(m => m.status === 'active').length
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">挖矿管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总算力"
              value={totalStats.hashrate}
              suffix="T"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="每日收益"
              value={totalStats.dailyRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收益"
              value={totalStats.totalRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃合约"
              value={totalStats.activeContracts}
              prefix={<FireOutlined />}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="每日收益趋势">
            <ReactECharts option={getRevenueChart()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="算力分布">
            <ReactECharts option={getHashrateDistribution()} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Search placeholder="搜索用户/合约ID" style={{ width: 250 }} />
          <Select 
            value={statusFilter} 
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="active">挖矿中</Option>
            <Option value="completed">已完成</Option>
            <Option value="expired">已过期</Option>
          </Select>
        </Space>
      </Card>

      {/* 合约列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={miningData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            total: miningData.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
};

export default Mining;
