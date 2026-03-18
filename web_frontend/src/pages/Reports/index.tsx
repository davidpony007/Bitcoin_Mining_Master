import React, { useState, useEffect } from 'react';
import { Card, Button, Space, DatePicker, Select, Table, Tag, List, Row, Col, Statistic, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, EyeOutlined, BarChartOutlined, UserOutlined, DollarOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { reportsApi } from '@/services/api/admin';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface ReportData {
  id: string;
  name: string;
  type: string;
  createTime: string;
  size: string;
  status: 'completed' | 'processing' | 'failed';
}

interface ReportSummary {
  users?: { total: number; countries: number };
  orders?: { total: number; revenue: number };
  mining?: { total: number; active: number };
  withdrawals?: { total: number; amount: number };
  points?: { total: number };
}

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('user');
  const [summary, setSummary] = useState<ReportSummary>({});

  useEffect(() => {
    reportsApi.summary().then((res: any) => {
      setSummary(res?.data || {});
    }).catch(() => {});
  }, []);

  const reportHistory: ReportData[] = [
    {
      id: 'rpt_001',
      name: '用户数据月报-2026年01月',
      type: 'user',
      createTime: '2026-01-29 10:30:00',
      size: '2.3MB',
      status: 'completed'
    },
    {
      id: 'rpt_002',
      name: '订单统计周报-第04周',
      type: 'order',
      createTime: '2026-01-28 15:20:00',
      size: '1.8MB',
      status: 'completed'
    },
    {
      id: 'rpt_003',
      name: '收入分析季报-Q1',
      type: 'revenue',
      createTime: '2026-01-27 09:15:00',
      size: '3.5MB',
      status: 'processing'
    },
    {
      id: 'rpt_004',
      name: '挖矿数据日报-2026-01-26',
      type: 'mining',
      createTime: '2026-01-26 18:00:00',
      size: '1.2MB',
      status: 'completed'
    }
  ];

  const reportTemplates = [
    {
      id: 1,
      name: '用户数据报表',
      description: '包含用户注册、活跃、留存等数据',
      icon: <FileExcelOutlined style={{ fontSize: 32, color: '#52c41a' }} />
    },
    {
      id: 2,
      name: '订单统计报表',
      description: '订单量、交易额、转化率等',
      icon: <FileExcelOutlined style={{ fontSize: 32, color: '#1890ff' }} />
    },
    {
      id: 3,
      name: '收入分析报表',
      description: '收入趋势、渠道分析、增长率',
      icon: <FilePdfOutlined style={{ fontSize: 32, color: '#faad14' }} />
    },
    {
      id: 4,
      name: '挖矿数据报表',
      description: '算力统计、合约数量、每日收益',
      icon: <FileExcelOutlined style={{ fontSize: 32, color: '#722ed1' }} />
    },
    {
      id: 5,
      name: '签到统计报表',
      description: '签到人数、连续签到、奖励发放',
      icon: <FileExcelOutlined style={{ fontSize: 32, color: '#13c2c2' }} />
    },
    {
      id: 6,
      name: '地域分析报表',
      description: '地区用户分布、收入对比',
      icon: <FilePdfOutlined style={{ fontSize: 32, color: '#eb2f96' }} />
    }
  ];

  // 样例数据图表已替换为真实数据摘要

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      message.success('报表生成成功！');
      setLoading(false);
    }, 2000);
  };

  const handleDownload = (record: ReportData) => {
    message.success(`正在下载: ${record.name}`);
  };

  const columns: ColumnsType<ReportData> = [
    {
      title: '报表名称',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
          user: { label: '用户', color: 'blue' },
          order: { label: '订单', color: 'green' },
          revenue: { label: '收入', color: 'orange' },
          mining: { label: '挖矿', color: 'purple' }
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
          completed: { label: '已完成', color: 'success' },
          processing: { label: '生成中', color: 'processing' },
          failed: { label: '失败', color: 'error' }
        };
        const config = statusMap[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      key: 'size',
      width: 100
    },
    {
      title: '生成时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            disabled={record.status !== 'completed'}
          >
            预览
          </Button>
          <Button 
            size="small" 
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            disabled={record.status !== 'completed'}
          >
            下载
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">报表中心</h1>

      {/* 实时数据摘要 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计用户" value={summary.users?.total || 0} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="订单总收入" value={Number(summary.orders?.revenue || 0)} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="活跃矿机合约" value={summary.mining?.active || 0} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="累计积分" value={summary.points?.total || 0} prefix={<BarChartOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* 报表生成 */}
      <Card title="生成报表" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Select 
              value={reportType}
              onChange={setReportType}
              style={{ width: '100%' }}
              placeholder="选择报表类型"
            >
              <Option value="user">用户数据报表</Option>
              <Option value="order">订单统计报表</Option>
              <Option value="revenue">收入分析报表</Option>
              <Option value="mining">挖矿数据报表</Option>
              <Option value="checkin">签到统计报表</Option>
              <Option value="geography">地域分析报表</Option>
            </Select>
          </Col>
          <Col xs={24} md={10}>
            <RangePicker 
              style={{ width: '100%' }}
              defaultValue={[dayjs().subtract(30, 'day'), dayjs()]}
              format="YYYY-MM-DD"
            />
          </Col>
          <Col xs={24} md={6}>
            <Button 
              type="primary" 
              icon={<BarChartOutlined />}
              onClick={handleGenerate}
              loading={loading}
              block
            >
              生成报表
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 报表模板 */}
      <Card title="报表模板" style={{ marginBottom: 24 }}>
        <List
          grid={{
            gutter: 16,
            xs: 1,
            sm: 2,
            md: 3,
            lg: 3,
            xl: 3,
            xxl: 3
          }}
          dataSource={reportTemplates}
          renderItem={item => (
            <List.Item>
              <Card
                hoverable
                actions={[
                  <Button type="link" icon={<EyeOutlined />}>预览</Button>,
                  <Button type="link" icon={<DownloadOutlined />}>生成</Button>
                ]}
              >
                <Card.Meta
                  avatar={item.icon}
                  title={item.name}
                  description={item.description}
                />
              </Card>
            </List.Item>
          )}
        />
      </Card>

      {/* 历史报表 */}
      <Card title="报表历史">
        <Table
          columns={columns}
          dataSource={reportHistory}
          rowKey="id"
          loading={loading}
          pagination={{
            total: reportHistory.length,
            pageSize: 10,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </Card>
    </div>
  );
};

export default Reports;
