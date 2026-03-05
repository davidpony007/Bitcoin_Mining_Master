import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, DatePicker, Row, Col, Statistic, Modal, Descriptions } from 'antd';
import { ShoppingOutlined, DollarOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface OrderData {
  id: string;
  userId: string;
  userName: string;
  type: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payMethod: string;
  createTime: string;
  completeTime?: string;
}

const Orders: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);

  const ordersData: OrderData[] = [
    {
      id: 'ORD20260129001',
      userId: 'user_10001',
      userName: 'Alice Chen',
      type: '购买算力',
      amount: 299.00,
      status: 'completed',
      payMethod: '支付宝',
      createTime: '2026-01-29 10:30:22',
      completeTime: '2026-01-29 10:30:45'
    },
    {
      id: 'ORD20260129002',
      userId: 'user_10002',
      userName: 'Bob Wang',
      type: 'VIP会员',
      amount: 999.00,
      status: 'completed',
      payMethod: '微信支付',
      createTime: '2026-01-29 11:15:33',
      completeTime: '2026-01-29 11:15:52'
    },
    {
      id: 'ORD20260129003',
      userId: 'user_10003',
      userName: 'Carol Li',
      type: '购买积分',
      amount: 50.00,
      status: 'pending',
      payMethod: '支付宝',
      createTime: '2026-01-29 12:20:10'
    },
    {
      id: 'ORD20260129004',
      userId: 'user_10004',
      userName: 'David Zhang',
      type: '购买算力',
      amount: 599.00,
      status: 'failed',
      payMethod: '信用卡',
      createTime: '2026-01-29 13:45:28'
    },
    {
      id: 'ORD20260128001',
      userId: 'user_10005',
      userName: 'Eva Liu',
      type: '续费会员',
      amount: 199.00,
      status: 'refunded',
      payMethod: '微信支付',
      createTime: '2026-01-28 15:30:00',
      completeTime: '2026-01-28 16:20:00'
    }
  ];

  // 订单统计图表
  const getOrderStatsChart = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['订单数', '交易额']
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
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        position: 'left'
      },
      {
        type: 'value',
        name: '交易额',
        position: 'right'
      }
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: [45, 52, 61, 58, 70, 65, 75],
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '交易额',
        type: 'line',
        yAxisIndex: 1,
        data: [12500, 15800, 18200, 16900, 21000, 19500, 22800],
        smooth: true,
        itemStyle: { color: '#52c41a' }
      }
    ]
  });

  const viewDetail = (record: OrderData) => {
    setSelectedOrder(record);
    setDetailVisible(true);
  };

  const columns: ColumnsType<OrderData> = [
    {
      title: '订单号',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      fixed: 'left'
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (name, record) => (
        <div>
          <div>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.userId}</div>
        </div>
      )
    },
    {
      title: '订单类型',
      dataIndex: 'type',
      key: 'type',
      width: 120
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      sorter: (a, b) => a.amount - b.amount,
      render: (amount: number) => (
        <span style={{ color: '#faad14', fontWeight: 'bold' }}>
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '支付方式',
      dataIndex: 'payMethod',
      key: 'payMethod',
      width: 100
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          pending: { label: '待支付', color: 'warning' },
          completed: { label: '已完成', color: 'success' },
          failed: { label: '失败', color: 'error' },
          refunded: { label: '已退款', color: 'default' }
        };
        const config = statusMap[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 170
    },
    {
      title: '完成时间',
      dataIndex: 'completeTime',
      key: 'completeTime',
      width: 170,
      render: (time) => time || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Button 
          size="small" 
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];

  const totalStats = {
    total: ordersData.length,
    completed: ordersData.filter(o => o.status === 'completed').length,
    amount: ordersData.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0),
    pending: ordersData.filter(o => o.status === 'pending').length
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">订单管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={totalStats.total}
              prefix={<ShoppingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已完成"
              value={totalStats.completed}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="交易总额"
              value={totalStats.amount}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理"
              value={totalStats.pending}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Card title="订单趋势" style={{ marginBottom: 24 }}>
        <ReactECharts option={getOrderStatsChart()} style={{ height: 300 }} />
      </Card>

      {/* 筛选工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Search placeholder="搜索订单号/用户" style={{ width: 250 }} />
          <Select 
            value={statusFilter} 
            onChange={setStatusFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="pending">待支付</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
            <Option value="refunded">已退款</Option>
          </Select>
          <RangePicker placeholder={['开始日期', '结束日期']} />
        </Space>
      </Card>

      {/* 订单列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={ordersData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            total: ordersData.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {selectedOrder && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="订单号" span={2}>{selectedOrder.id}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selectedOrder.userId}</Descriptions.Item>
            <Descriptions.Item label="用户名">{selectedOrder.userName}</Descriptions.Item>
            <Descriptions.Item label="订单类型">{selectedOrder.type}</Descriptions.Item>
            <Descriptions.Item label="金额">
              <span style={{ color: '#faad14', fontWeight: 'bold' }}>
                ¥{selectedOrder.amount.toFixed(2)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="支付方式">{selectedOrder.payMethod}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedOrder.status === 'completed' ? 'success' : 'warning'}>
                {selectedOrder.status === 'completed' ? '已完成' : '待支付'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{selectedOrder.createTime}</Descriptions.Item>
            <Descriptions.Item label="完成时间" span={2}>
              {selectedOrder.completeTime || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
