import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Row, Col, Statistic, message } from 'antd';
import { ThunderboltOutlined, ClockCircleOutlined, FireOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import { miningApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';

const { Option } = Select;

interface MiningRow {
  id: number;
  user_id: string;
  email: string | null;
  contract_type: string;
  contract_creation_time: string;
  contract_end_time: string;
  hashrate: string;
  status: 'active' | 'expired';
}

const contractTypeColors: Record<string, string> = {
  'Free Ad Reward': 'blue',
  'Daily Check-in Reward': 'green',
  'Invite Friend Reward': 'purple',
  'paid contract': 'gold',
};

const Mining: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<MiningRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [stats, setStats] = useState<any>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_mining') || '{}'); } catch { return {}; }
  });
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_mining', JSON.stringify(next));
      return next;
    });
  };

  const loadList = useCallback(async (p: number, s: string, t: string) => {
    try {
      setLoading(true);
      const res = await miningApi.list({ page: p, limit: 20, search: s || undefined, type: t || undefined });
      if (res?.success) { setList(res.data.list); setTotal(res.data.total); }
    } catch { message.error('加载挖矿数据失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    miningApi.stats().then(res => { if (res?.success) setStats(res.data); });
    loadList(1, '', '');
  }, []);

  const getTypeDistributionOption = () => {
    const data = (stats.byType || []).map((r: any) => ({ value: r.cnt, name: r.contract_type }));
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'vertical', left: 'left', top: 'middle' },
      series: [{ name: '合约类型分布', type: 'pie', radius: ['40%', '70%'], data, label: { formatter: '{b}: {d}%' } }]
    };
  };

  const columns: ColumnsType<MiningRow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true, render: v => v || '-' },
    {
      title: '合约类型', dataIndex: 'contract_type', key: 'contract_type', width: 170,
      render: (v: string) => <Tag color={contractTypeColors[v] || 'default'}>{v}</Tag>
    },
    { title: '算力', dataIndex: 'hashrate', key: 'hashrate', width: 140, render: v => parseFloat(v).toExponential(3) },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '活跃' : '已过期'}</Tag>
    },
    { title: '创建时间', dataIndex: 'contract_creation_time', key: 'contract_creation_time', width: 160, render: v => new Date(v).toISOString().slice(0, 19).replace('T', ' ') },
    { title: '结束时间', dataIndex: 'contract_end_time', key: 'contract_end_time', width: 160, render: v => new Date(v).toISOString().slice(0, 19).replace('T', ' ') },
  ];
  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">挖矿管理</h1>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="合约总数" value={stats.total ?? 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="活跃合约" value={stats.active ?? 0} prefix={<FireOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="总算力(活跃)" value={stats.totalHashrate ? stats.totalHashrate.toExponential(3) : 0} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="合约类型数" value={(stats.byType || []).length} valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>
      {(stats.byType || []).length > 0 && (
        <Card title="合约类型分布" style={{ marginBottom: 24 }}>
          <ReactECharts option={getTypeDistributionOption()} style={{ height: 300 }} />
        </Card>
      )}
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input placeholder="搜索用户ID/邮箱" prefix={<SearchOutlined />} style={{ width: 260 }} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => { setPage(1); loadList(1, search, typeFilter); }} />
          <Select placeholder="合约类型" allowClear style={{ width: 180 }} value={typeFilter || undefined} onChange={v => { setTypeFilter(v || ''); setPage(1); loadList(1, search, v || ''); }}>
            <Option value="Free Ad Reward">广告奖励</Option>
            <Option value="Daily Check-in Reward">签到奖励</Option>
            <Option value="Invite Friend Reward">邀请奖励</Option>
            <Option value="paid contract">付费合约</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); loadList(1, search, typeFilter); }}>搜索</Button>
        </Space>
        <Table<MiningRow>
          columns={mergedColumns} components={{ header: { cell: ResizableTitle } }} dataSource={list} rowKey="id" loading={loading} scroll={{ x: 1100 }}
          pagination={{ total, current: page, pageSize: 20, showSizeChanger: false, showQuickJumper: true, showTotal: t => `共 ${t} 条`, onChange: p => { setPage(p); loadList(p, search, typeFilter); } }}
        />
      </Card>
    </div>
  );
};

export default Mining;
