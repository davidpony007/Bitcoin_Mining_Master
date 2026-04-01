import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Space, Input, Row, Col, Statistic, message } from 'antd';
import { CheckCircleOutlined, TrophyOutlined, FireOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ReactECharts from 'echarts-for-react';
import { checkinApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';

interface CheckInRow {
  user_id: string;
  email: string | null;
  totalDays: number;
  maxCumulative: number;
  lastCheckIn: string | null;
  totalRewards: number;
}

const CheckIn: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<CheckInRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_checkin') || '{}'); } catch { return {}; }
  });
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_checkin', JSON.stringify(next));
      return next;
    });
  };

  const loadList = useCallback(async (p: number, s: string) => {
    try { setLoading(true);
      const res = await checkinApi.list({ page: p, limit: 20, search: s || undefined });
      if (res?.success) { setList(res.data.list); setTotal(res.data.total); }
    } catch { message.error('加载签到数据失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    checkinApi.stats().then(res => { if (res?.success) setStats(res.data); });
    loadList(1, '');
  }, []);

  const getTrendOption = () => {
    const trend = stats.trend || [];
    return {
      title: { text: '近30天每日签到人数', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: trend.map((r: any) => { const d = r.d instanceof Date ? r.d.toISOString().slice(5, 10) : String(r.d).slice(5, 10); return d; }) },
      yAxis: { type: 'value', name: '签到人数' },
      series: [{ name: '签到人数', type: 'bar', data: trend.map((r: any) => r.cnt), itemStyle: { color: '#52c41a' } }]
    };
  };

  const columns: ColumnsType<CheckInRow> = [
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true, render: v => v || '-' },
    { title: '累计签到天数', dataIndex: 'totalDays', key: 'totalDays', width: 120, sorter: (a, b) => a.totalDays - b.totalDays },
    { title: '最大连续天数', dataIndex: 'maxCumulative', key: 'maxCumulative', width: 120, sorter: (a, b) => a.maxCumulative - b.maxCumulative },
    { title: '获得积分', dataIndex: 'totalRewards', key: 'totalRewards', width: 100, render: v => <span style={{ color: '#faad14' }}>{v}</span> },
    { title: '最后签到', dataIndex: 'lastCheckIn', key: 'lastCheckIn', width: 130, render: v => v ? String(v).slice(0, 10) : '-' },
  ];
  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">签到管理</h1>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日签到人数" value={stats.todayCount ?? 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="签到总记录" value={stats.totalRecords ?? 0} prefix={<FireOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="参与用户数" value={stats.totalUsers ?? 0} prefix={<UserOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="周活跃签到用户" value={stats.weekActiveUsers ?? 0} prefix={<TrophyOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>
      {(stats.trend || []).length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <ReactECharts option={getTrendOption()} style={{ height: 280 }} />
        </Card>
      )}
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Input placeholder="搜索用户ID/邮箱" style={{ width: 260 }} value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => { setPage(1); loadList(1, search); }} />
          <span style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => { setPage(1); loadList(1, search); }}>搜索</span>
        </Space>
        <Table<CheckInRow>
          columns={mergedColumns} components={{ header: { cell: ResizableTitle } }} dataSource={list} rowKey="user_id" loading={loading}
          pagination={{ total, current: page, pageSize: 20, showSizeChanger: false, showTotal: t => `共 ${t} 位用户`, onChange: p => { setPage(p); loadList(p, search); } }}
        />
      </Card>
    </div>
  );
};

export default CheckIn;
