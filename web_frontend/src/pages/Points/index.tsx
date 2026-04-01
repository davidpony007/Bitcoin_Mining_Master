import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Space, Tag, Input, Select, Row, Col, Statistic, Tabs, message } from 'antd';
import { GiftOutlined, HistoryOutlined, TrophyOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { pointsApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';

const { Option } = Select;
const { TabPane } = Tabs;

interface LeaderboardRow {
  user_id: string;
  email: string;
  user_points: number;
  user_level: number;
  total_ad_views: number;
  user_creation_time: string;
}

interface TxRow {
  id: number;
  user_id: string;
  email: string | null;
  points_type: string;
  points_amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

const Points: React.FC = () => {
  const [tab, setTab] = useState('leaderboard');
  const [loading, setLoading] = useState(false);
  const [lbList, setLbList] = useState<LeaderboardRow[]>([]);
  const [lbTotal, setLbTotal] = useState(0);
  const [lbPage, setLbPage] = useState(1);
  const [lbSearch, setLbSearch] = useState('');
  const [txList, setTxList] = useState<TxRow[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txUserId, setTxUserId] = useState('');
  const [txType, setTxType] = useState('');
  const [stats, setStats] = useState<any>({});
  const [lbColWidths, setLbColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_points_lb') || '{}'); } catch { return {}; }
  });
  const handleLbResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setLbColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_points_lb', JSON.stringify(next));
      return next;
    });
  };
  const [txColWidths, setTxColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_points_tx') || '{}'); } catch { return {}; }
  });
  const handleTxResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setTxColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_points_tx', JSON.stringify(next));
      return next;
    });
  };

  const loadLeaderboard = useCallback(async (p: number, s: string) => {
    try { setLoading(true);
      const res = await pointsApi.leaderboard({ page: p, limit: 20, search: s || undefined });
      if (res?.success) { setLbList(res.data.list); setLbTotal(res.data.total); }
    } catch { message.error('加载排行榜失败'); } finally { setLoading(false); }
  }, []);

  const loadTransactions = useCallback(async (p: number, uid: string, t: string) => {
    try { setLoading(true);
      const res = await pointsApi.transactions({ page: p, limit: 20, userId: uid || undefined, type: t || undefined });
      if (res?.success) { setTxList(res.data.list); setTxTotal(res.data.total); }
    } catch { message.error('加载积分记录失败'); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    pointsApi.stats().then(res => { if (res?.success) setStats(res.data); });
    loadLeaderboard(1, '');
  }, []);

  const lbColumns: ColumnsType<LeaderboardRow> = [
    { title: '排名', key: 'rank', width: 70, render: (_, __, i) => (lbPage - 1) * 20 + i + 1 },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: '积分', dataIndex: 'user_points', key: 'user_points', width: 100, render: v => <span style={{ color: '#faad14', fontWeight: 'bold' }}>{v}</span> },
    { title: '等级', dataIndex: 'user_level', key: 'user_level', width: 70 },
    { title: '广告观看', dataIndex: 'total_ad_views', key: 'total_ad_views', width: 90 },
    { title: '注册时间', dataIndex: 'user_creation_time', key: 'user_creation_time', width: 160, render: v => new Date(v).toISOString().slice(0, 19).replace('T', ' ') },
  ];
  const mergedLbColumns = lbColumns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = lbColWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleLbResize(k) }) };
  });

  const txColumns: ColumnsType<TxRow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true, render: v => v || '-' },
    {
      title: '类型', dataIndex: 'points_type', key: 'points_type', width: 160, ellipsis: true,
      render: v => <Tag color={v?.includes?.('EARN') || v?.includes?.('ADD') || v?.includes?.('CHECKIN') || v?.includes?.('AD') || v?.includes?.('REFERRAL') ? 'green' : 'orange'}>{v}</Tag>
    },
    {
      title: '积分变动', dataIndex: 'points_amount', key: 'points_amount', width: 100,
      render: (v: number) => <span style={{ color: v > 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{v > 0 ? '+' : ''}{v}</span>
    },
    { title: '余额', dataIndex: 'balance_after', key: 'balance_after', width: 90 },
    { title: '说明', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: v => new Date(v).toISOString().slice(0, 19).replace('T', ' ') },
  ];
  const mergedTxColumns = txColumns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = txColWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleTxResize(k) }) };
  });

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">积分管理</h1>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="全平台积分" value={stats.totalPoints ?? 0} prefix={<GiftOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="用户总数" value={stats.users ?? 0} prefix={<TrophyOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日发放积分" value={stats.todayEarned ?? 0} prefix={<GiftOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} lg={6}><Card><Statistic title="今日交易次数" value={stats.todayTx ?? 0} prefix={<HistoryOutlined />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>
      <Card>
        <Tabs activeKey={tab} onChange={k => { setTab(k); if (k === 'transactions' && txList.length === 0) loadTransactions(1, '', ''); }}>
          <TabPane tab="积分排行榜" key="leaderboard">
            <Space style={{ marginBottom: 16 }} wrap>
              <Input placeholder="搜索用户ID/邮箱" prefix={<SearchOutlined />} style={{ width: 260 }} value={lbSearch} onChange={e => setLbSearch(e.target.value)} onPressEnter={() => { setLbPage(1); loadLeaderboard(1, lbSearch); }} />
              <span style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => { setLbPage(1); loadLeaderboard(1, lbSearch); }}>搜索</span>
            </Space>
            <Table<LeaderboardRow>
              columns={mergedLbColumns} components={{ header: { cell: ResizableTitle } }} dataSource={lbList} rowKey="user_id" loading={loading}
              pagination={{ total: lbTotal, current: lbPage, pageSize: 20, showSizeChanger: false, showTotal: t => `共 ${t}`, onChange: p => { setLbPage(p); loadLeaderboard(p, lbSearch); } }}
            />
          </TabPane>
          <TabPane tab="积分交易记录" key="transactions">
            <Space style={{ marginBottom: 16 }} wrap>
              <Input placeholder="用户ID" style={{ width: 200 }} value={txUserId} onChange={e => setTxUserId(e.target.value)} onPressEnter={() => { setTxPage(1); loadTransactions(1, txUserId, txType); }} />
              <Select placeholder="筛选类型" allowClear style={{ width: 180 }} value={txType || undefined} onChange={v => { setTxType(v || ''); setTxPage(1); loadTransactions(1, txUserId, v || ''); }}>
                <Option value="CHECKIN">签到</Option>
                <Option value="AD_VIEW">广告</Option>
                <Option value="REFERRAL_1">邀请奖励</Option>
                <Option value="ADMIN_ADD">管理员增加</Option>
                <Option value="ADMIN_DEDUCT">管理员扣减</Option>
              </Select>
              <span style={{ cursor: 'pointer', color: '#1890ff' }} onClick={() => { setTxPage(1); loadTransactions(1, txUserId, txType); }}>查询</span>
            </Space>
            <Table<TxRow>
              columns={mergedTxColumns} components={{ header: { cell: ResizableTitle } }} dataSource={txList} rowKey="id" loading={loading}
              pagination={{ total: txTotal, current: txPage, pageSize: 20, showSizeChanger: false, showTotal: t => `共 ${t}`, onChange: p => { setTxPage(p); loadTransactions(p, txUserId, txType); } }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Points;
