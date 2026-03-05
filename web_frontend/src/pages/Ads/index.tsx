import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, InputNumber, message, Row, Col, Statistic } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined, EyeOutlined, DollarOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';

const { Search } = Input;
const { Option } = Select;

interface AdData {
  id: string;
  title: string;
  type: string;
  status: 'active' | 'paused' | 'completed';
  views: number;
  clicks: number;
  revenue: number;
  ctr: number;
  createTime: string;
}

const Ads: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAd, setEditingAd] = useState<AdData | null>(null);
  const [form] = Form.useForm();

  // 模拟广告数据
  const [adsData, setAdsData] = useState<AdData[]>([
    {
      id: 'ad_001',
      title: '比特币挖矿新手指南',
      type: 'banner',
      status: 'active',
      views: 25400,
      clicks: 1850,
      revenue: 3200,
      ctr: 7.28,
      createTime: '2026-01-15 10:30:00'
    },
    {
      id: 'ad_002',
      title: '限时优惠 - 算力提升50%',
      type: 'video',
      status: 'active',
      views: 18200,
      clicks: 2340,
      revenue: 4580,
      ctr: 12.86,
      createTime: '2026-01-20 14:20:00'
    },
    {
      id: 'ad_003',
      title: '邀请好友获得奖励',
      type: 'popup',
      status: 'paused',
      views: 32100,
      clicks: 980,
      revenue: 1520,
      ctr: 3.05,
      createTime: '2026-01-10 09:15:00'
    },
    {
      id: 'ad_004',
      title: 'VIP会员专享福利',
      type: 'banner',
      status: 'active',
      views: 42000,
      clicks: 3680,
      revenue: 7200,
      ctr: 8.76,
      createTime: '2026-01-18 16:45:00'
    },
    {
      id: 'ad_005',
      title: '新用户注册送积分',
      type: 'native',
      status: 'completed',
      views: 15800,
      clicks: 1120,
      revenue: 2100,
      ctr: 7.09,
      createTime: '2026-01-05 11:00:00'
    }
  ]);

  // 广告效果图表
  const getAdPerformanceOption = () => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['展示量', '点击量', '收入']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: adsData.slice(0, 5).map(ad => ad.title.substring(0, 8) + '...')
    },
    yAxis: [
      {
        type: 'value',
        name: '数量',
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
        name: '展示量',
        type: 'bar',
        data: adsData.slice(0, 5).map(ad => ad.views),
        itemStyle: { color: '#1890ff' }
      },
      {
        name: '点击量',
        type: 'bar',
        data: adsData.slice(0, 5).map(ad => ad.clicks),
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '收入',
        type: 'line',
        yAxisIndex: 1,
        data: adsData.slice(0, 5).map(ad => ad.revenue),
        itemStyle: { color: '#faad14' }
      }
    ]
  });

  const handleEdit = (record: AdData) => {
    setEditingAd(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个广告吗？',
      onOk: () => {
        setAdsData(adsData.filter(ad => ad.id !== id));
        message.success('删除成功');
      }
    });
  };

  const handleStatusChange = (id: string, status: 'active' | 'paused') => {
    setAdsData(adsData.map(ad => 
      ad.id === id ? { ...ad, status } : ad
    ));
    message.success(status === 'active' ? '广告已启用' : '广告已暂停');
  };

  const columns: ColumnsType<AdData> = [
    {
      title: '广告ID',
      dataIndex: 'id',
      key: 'id',
      width: 120
    },
    {
      title: '广告标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          banner: { label: '横幅', color: 'blue' },
          video: { label: '视频', color: 'purple' },
          popup: { label: '弹窗', color: 'orange' },
          native: { label: '原生', color: 'green' }
        };
        const config = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          active: { label: '进行中', color: 'success' },
          paused: { label: '已暂停', color: 'warning' },
          completed: { label: '已完成', color: 'default' }
        };
        const config = statusMap[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '展示量',
      dataIndex: 'views',
      key: 'views',
      width: 100,
      sorter: (a, b) => a.views - b.views,
      render: (views: number) => views.toLocaleString()
    },
    {
      title: '点击量',
      dataIndex: 'clicks',
      key: 'clicks',
      width: 100,
      sorter: (a, b) => a.clicks - b.clicks,
      render: (clicks: number) => clicks.toLocaleString()
    },
    {
      title: 'CTR',
      dataIndex: 'ctr',
      key: 'ctr',
      width: 80,
      sorter: (a, b) => a.ctr - b.ctr,
      render: (ctr: number) => `${ctr.toFixed(2)}%`
    },
    {
      title: '收入',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 100,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (revenue: number) => `$${revenue.toLocaleString()}`
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'active' ? (
            <Button 
              size="small" 
              icon={<PauseCircleOutlined />}
              onClick={() => handleStatusChange(record.id, 'paused')}
            >
              暂停
            </Button>
          ) : record.status === 'paused' ? (
            <Button 
              size="small" 
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStatusChange(record.id, 'active')}
            >
              启用
            </Button>
          ) : null}
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const totalStats = {
    views: adsData.reduce((sum, ad) => sum + ad.views, 0),
    clicks: adsData.reduce((sum, ad) => sum + ad.clicks, 0),
    revenue: adsData.reduce((sum, ad) => sum + ad.revenue, 0),
    ctr: adsData.length > 0 
      ? (adsData.reduce((sum, ad) => sum + ad.clicks, 0) / adsData.reduce((sum, ad) => sum + ad.views, 0) * 100)
      : 0
  };

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">广告管理</h1>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总展示量"
              value={totalStats.views}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总点击量"
              value={totalStats.clicks}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收入"
              value={totalStats.revenue}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均CTR"
              value={totalStats.ctr}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表 */}
      <Card title="广告效果对比" style={{ marginBottom: 24 }}>
        <ReactECharts option={getAdPerformanceOption()} style={{ height: 300 }} />
      </Card>

      {/* 工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Search placeholder="搜索广告标题" style={{ width: 250 }} />
          <Select 
            value={selectedType} 
            onChange={setSelectedType}
            style={{ width: 120 }}
          >
            <Option value="all">全部类型</Option>
            <Option value="banner">横幅广告</Option>
            <Option value="video">视频广告</Option>
            <Option value="popup">弹窗广告</Option>
            <Option value="native">原生广告</Option>
          </Select>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingAd(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            新建广告
          </Button>
        </Space>
      </Card>

      {/* 广告列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={adsData}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            total: adsData.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </Card>

      {/* 编辑/新建弹窗 */}
      <Modal
        title={editingAd ? '编辑广告' : '新建广告'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => {
          form.validateFields().then(values => {
            message.success(editingAd ? '修改成功' : '创建成功');
            setModalVisible(false);
            form.resetFields();
          });
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="广告标题" rules={[{ required: true }]}>
            <Input placeholder="请输入广告标题" />
          </Form.Item>
          <Form.Item name="type" label="广告类型" rules={[{ required: true }]}>
            <Select placeholder="请选择广告类型">
              <Option value="banner">横幅广告</Option>
              <Option value="video">视频广告</Option>
              <Option value="popup">弹窗广告</Option>
              <Option value="native">原生广告</Option>
            </Select>
          </Form.Item>
          <Form.Item name="revenue" label="目标收入" rules={[{ required: true }]}>
            <InputNumber 
              style={{ width: '100%' }} 
              placeholder="请输入目标收入"
              prefix="$"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Ads;
