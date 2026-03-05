import React, { useState } from 'react';
import { Card, Table, Space, Tag, Input, DatePicker, Row, Col, Statistic, Calendar, Badge } from 'antd';
import { CheckCircleOutlined, TrophyOutlined, FireOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

const { Search } = Input;
const { RangePicker } = DatePicker;

interface CheckInData {
  id: string;
  userId: string;
  userName: string;
  continuousDays: number;
  totalDays: number;
  lastCheckIn: string;
  rewards: number;
}

const CheckIn: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const checkInData: CheckInData[] = [
    {
      id: 'checkin_001',
      userId: 'user_10001',
      userName: 'Alice Chen',
      continuousDays: 28,
      totalDays: 120,
      lastCheckIn: '2026-01-29 08:30:00',
      rewards: 5600
    },
    {
      id: 'checkin_002',
      userId: 'user_10002',
      userName: 'Bob Wang',
      continuousDays: 15,
      totalDays: 85,
      lastCheckIn: '2026-01-29 09:15:00',
      rewards: 3200
    },
    {
      id: 'checkin_003',
      userId: 'user_10003',
      userName: 'Carol Li',
      continuousDays: 45,
      totalDays: 200,
      lastCheckIn: '2026-01-29 07:45:00',
      rewards: 12800
    },
    {
      id: 'checkin_004',
      userId: 'user_10004',
      userName: 'David Zhang',
      continuousDays: 8,
      totalDays: 45,
      lastCheckIn: '2026-01-28 18:20:00',
      rewards: 1800
    },
    {
      id: 'checkin_005',
      userId: 'user_10005',
      userName: 'Eva Liu',
      continuousDays: 60,
      totalDays: 150,
      lastCheckIn: '2026-01-29 10:00:00',
      rewards: 9500
    }
  ];

  // 签到趋势图
  const getCheckInTrendChart = () => ({
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['签到人数', '新增签到']
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
      type: 'value'
    },
    series: [
      {
        name: '签到人数',
        type: 'line',
        data: [1850, 1920, 2100, 2050, 2280, 2150, 2320],
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
      },
      {
        name: '新增签到',
        type: 'bar',
        data: [120, 135, 150, 128, 175, 142, 165],
        itemStyle: { color: '#52c41a' }
      }
    ]
  });

  // 连续签到分布
  const getContinuousDistChart = () => ({
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c}人 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left'
    },
    series: [
      {
        name: '连续签到',
        type: 'pie',
        radius: '50%',
        data: [
          { value: 850, name: '1-7天', itemStyle: { color: '#91d5ff' } },
          { value: 520, name: '8-14天', itemStyle: { color: '#69c0ff' } },
          { value: 380, name: '15-30天', itemStyle: { color: '#40a9ff' } },
          { value: 280, name: '31-60天', itemStyle: { color: '#1890ff' } },
          { value: 120, name: '60天+', itemStyle: { color: '#096dd9' } }
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

  // 日历数据
  const getListData = (value: Dayjs) => {
    const day = value.date();
    // 模拟数据：标记本月已签到的日期
    if (day <= 29 && day > 0) {
      return [{ type: 'success', content: `${Math.floor(Math.random() * 1000 + 1500)}人签到` }];
    }
    return [];
  };

  const dateCellRender = (value: Dayjs) => {
    const listData = getListData(value);
    return (
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {listData.map((item, index) => (
          <li key={index}>
            <Badge status={item.type as any} text={item.content} />
          </li>
        ))}
      </ul>
    );
  };

  const columns: ColumnsType<CheckInData> = [
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
      title: '连续签到',
      dataIndex: 'continuousDays',
      key: 'continuousDays',
      width: 120,
      sorter: (a, b) => a.continuousDays - b.continuousDays,
      render: (days: number) => {
        let color = '#52c41a';
        if (days >= 60) color = '#722ed1';
        else if (days >= 30) color = '#1890ff';
        else if (days >= 7) color = '#52c41a';
        else color = '#faad14';
        return (
          <Tag color={color} icon={<FireOutlined />}>
            {days}天
          </Tag>
        );
      }
    },
    {
      title: '累计签到',
      dataIndex: 'totalDays',
      key: 'totalDays',
      width: 120,
      sorter: (a, b) => a.totalDays - b.totalDays,
      render: (days: number) => `${days}天`
    },
    {
      title: '获得奖励',
      dataIndex: 'rewards',
      key: 'rewards',
      width: 120,
      sorter: (a, b) => a.rewards - b.rewards,
      render: (rewards: number) => (
        <span style={{ color: '#faad14', fontWeight: 'bold' }}>
          {rewards.toLocaleString()}积分
        </span>
      )
    },
    {
      title: '最后签到',
      dataIndex: 'lastCheckIn',
      key: 'lastCheckIn',
      width: 180
    }
  ];

  const totalStats = {
    todayCheckIn: 2320,
    totalUsers: 15680,
    avgContinuous: 18.5,
    totalRewards: checkInData.reduce((sum, item) => sum + item.rewards, 0)
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">签到管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日签到"
              value={totalStats.todayCheckIn}
              prefix={<CheckCircleOutlined />}
              suffix="人"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="签到总人数"
              value={totalStats.totalUsers}
              prefix={<UserOutlined />}
              suffix="人"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均连签天数"
              value={totalStats.avgContinuous}
              prefix={<FireOutlined />}
              suffix="天"
              precision={1}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="累计发放奖励"
              value={totalStats.totalRewards}
              prefix={<TrophyOutlined />}
              suffix="积分"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="签到趋势">
            <ReactECharts option={getCheckInTrendChart()} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="连续签到分布">
            <ReactECharts option={getContinuousDistChart()} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 签到日历 */}
      <Card title="签到日历" style={{ marginBottom: 24 }}>
        <Calendar 
          dateCellRender={dateCellRender}
          headerRender={({ value, type, onChange, onTypeChange }) => {
            const month = value.month();
            const year = value.year();
            return (
              <div style={{ padding: 8, display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 'bold' }}>
                  {year}年{month + 1}月签到情况
                </span>
              </div>
            );
          }}
        />
      </Card>

      {/* 工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Search placeholder="搜索用户" style={{ width: 250 }} />
          <RangePicker placeholder={['开始日期', '结束日期']} />
        </Space>
      </Card>

      {/* 用户签到列表 */}
      <Card title="用户签到记录">
        <Table
          columns={columns}
          dataSource={checkInData}
          rowKey="id"
          loading={loading}
          pagination={{
            total: checkInData.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
};

export default CheckIn;
