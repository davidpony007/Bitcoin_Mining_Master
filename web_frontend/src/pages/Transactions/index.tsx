import React, { useState, useCallback } from 'react';
import { Card, Table, Input, Space, Select, DatePicker, Tabs, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { bitcoinTxApi } from '@/services/api/admin';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

// ─── Bitcoin Transaction 类型标签颜色 ────────────────────────────────────────
const typeColor: Record<string, string> = {
  'Free Ad Reward': 'orange',
  'Daily Check-in Reward': 'gold',
  'Invite Friend Reward': 'blue',
  'Bind Referrer Reward': 'cyan',
  'subordinate rebate': 'green',
  'withdrawal': 'red',
  'refund for withdrawal failure': 'purple',
};

interface TxRecord {
  id: number;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number | null;
  description: string | null;
  createdAt: string;
  status: string;
}

interface RebateRecord {
  id: number;
  userId: string;
  invitationCode: string;
  subordinateUserId: string;
  amount: number;
  createdAt: string;
}

const Transactions: React.FC = () => {
  // ─── 交易记录 Tab ────────────────────────────────────────────────────────
  const [txList, setTxList] = useState<TxRecord[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txLoading, setTxLoading] = useState(false);
  const [txUserId, setTxUserId] = useState('');
  const [txType, setTxType] = useState('');
  const [txDates, setTxDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => {
    const utcToday = new Date().toISOString().slice(0, 10);
    return [dayjs(utcToday).subtract(2, 'day'), dayjs(utcToday)];
  });

  const loadTx = useCallback(async (p: number, uid: string, t: string, dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setTxLoading(true);
    try {
      const res: any = await bitcoinTxApi.list({
        page: p,
        limit: 20,
        userId: uid || undefined,
        type: t || undefined,
        startDate: dates ? dates[0].format('YYYY-MM-DD') : undefined,
        endDate: dates ? dates[1].format('YYYY-MM-DD') : undefined,
      });
      if (res?.success) {
        setTxList(res.data.records);
        setTxTotal(res.data.pagination.total);
        setTxPage(p);
      }
    } catch {
      message.error('加载失败');
    }
    setTxLoading(false);
  }, []);

  const txColumns: ColumnsType<TxRecord> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户ID', dataIndex: 'userId', width: 160, ellipsis: true },
    {
      title: '类型', dataIndex: 'type', width: 170,
      render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '金额 (BTC)', dataIndex: 'amount', width: 140,
      render: (v: number, r: TxRecord) => (
        <span style={{ color: r.type === 'withdrawal' ? '#f5222d' : '#52c41a' }}>
          {r.type === 'withdrawal' ? '-' : '+'}{v.toFixed(8)}
        </span>
      ),
    },
    {
      title: '余额 (BTC)', dataIndex: 'balanceAfter', width: 140,
      render: (v: number | null) => v != null ? v.toFixed(8) : '-',
    },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => (
        <Tag color={v === 'success' ? 'success' : v === 'pending' ? 'warning' : 'error'}>{v}</Tag>
      ),
    },
    {
      title: '时间', dataIndex: 'createdAt', width: 170,
      render: (v: string) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-',
    },
  ];

  // ─── 返利记录 Tab ────────────────────────────────────────────────────────
  const [rbtList, setRbtList] = useState<RebateRecord[]>([]);
  const [rbtTotal, setRbtTotal] = useState(0);
  const [rbtPage, setRbtPage] = useState(1);
  const [rbtLoading, setRbtLoading] = useState(false);
  const [rbtUserId, setRbtUserId] = useState('');
  const [rbtDates, setRbtDates] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(() => {
    const utcToday = new Date().toISOString().slice(0, 10);
    return [dayjs(utcToday).subtract(2, 'day'), dayjs(utcToday)];
  });

  const loadRebate = useCallback(async (p: number, uid: string, dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setRbtLoading(true);
    try {
      const res: any = await bitcoinTxApi.rebateList({
        page: p,
        limit: 20,
        userId: uid || undefined,
        startDate: dates ? dates[0].format('YYYY-MM-DD') : undefined,
        endDate: dates ? dates[1].format('YYYY-MM-DD') : undefined,
      });
      if (res?.success) {
        setRbtList(res.data.records);
        setRbtTotal(res.data.pagination.total);
        setRbtPage(p);
      }
    } catch {
      message.error('加载失败');
    }
    setRbtLoading(false);
  }, []);

  const rebateColumns: ColumnsType<RebateRecord> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户ID', dataIndex: 'userId', width: 160, ellipsis: true },
    { title: '邀请码', dataIndex: 'invitationCode', width: 120 },
    { title: '下级用户ID', dataIndex: 'subordinateUserId', width: 160, ellipsis: true },
    {
      title: '返利金额 (BTC)', dataIndex: 'amount', width: 150,
      render: (v: number) => <span style={{ color: '#52c41a' }}>+{v.toFixed(8)}</span>,
    },
    {
      title: '时间', dataIndex: 'createdAt', width: 170,
      render: (v: string) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="比特币记录查询（管理员）" style={{ marginBottom: 0 }}>
        <Tabs defaultActiveKey="tx">
          {/* ─── 交易记录 ───────────────────────────────────────── */}
          <TabPane tab="交易记录" key="tx">
            <Space wrap style={{ marginBottom: 16 }}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="用户ID"
                style={{ width: 200 }}
                value={txUserId}
                onChange={e => setTxUserId(e.target.value)}
                onPressEnter={() => { setTxPage(1); loadTx(1, txUserId, txType, txDates); }}
              />
              <Select
                placeholder="交易类型"
                allowClear
                style={{ width: 180 }}
                value={txType || undefined}
                onChange={v => { setTxType(v || ''); setTxPage(1); loadTx(1, txUserId, v || '', txDates); }}
              >
                <Option value="all">全部</Option>
                <Option value="Free Ad Reward">广告奖励</Option>
                <Option value="Daily Check-in Reward">签到奖励</Option>
                <Option value="Invite Friend Reward">邀请奖励</Option>
                <Option value="Bind Referrer Reward">绑定奖励</Option>
                <Option value="subordinate rebate">返利收入</Option>
                <Option value="withdrawal">提现</Option>
              </Select>
              <RangePicker
                value={txDates}
                onChange={v => setTxDates(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                allowClear
              />
              <span
                style={{ cursor: 'pointer', color: '#1890ff' }}
                onClick={() => { setTxPage(1); loadTx(1, txUserId, txType, txDates); }}
              >
                查询
              </span>
            </Space>
            <Table<TxRecord>
              rowKey="id"
              loading={txLoading}
              dataSource={txList}
              columns={txColumns}
              scroll={{ x: 1100 }}
              pagination={{
                total: txTotal,
                current: txPage,
                pageSize: 20,
                showSizeChanger: false,
                showTotal: t => `共 ${t} 条`,
                onChange: p => { setTxPage(p); loadTx(p, txUserId, txType, txDates); },
              }}
            />
          </TabPane>

          {/* ─── 返利记录 ───────────────────────────────────────── */}
          <TabPane tab="邀请返利记录" key="rebate">
            <Space wrap style={{ marginBottom: 16 }}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="用户ID"
                style={{ width: 200 }}
                value={rbtUserId}
                onChange={e => setRbtUserId(e.target.value)}
                onPressEnter={() => { setRbtPage(1); loadRebate(1, rbtUserId, rbtDates); }}
              />
              <RangePicker
                value={rbtDates}
                onChange={v => setRbtDates(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                allowClear
              />
              <span
                style={{ cursor: 'pointer', color: '#1890ff' }}
                onClick={() => { setRbtPage(1); loadRebate(1, rbtUserId, rbtDates); }}
              >
                查询
              </span>
            </Space>
            <Table<RebateRecord>
              rowKey="id"
              loading={rbtLoading}
              dataSource={rbtList}
              columns={rebateColumns}
              scroll={{ x: 900 }}
              pagination={{
                total: rbtTotal,
                current: rbtPage,
                pageSize: 20,
                showSizeChanger: false,
                showTotal: t => `共 ${t} 条`,
                onChange: p => { setRbtPage(p); loadRebate(p, rbtUserId, rbtDates); },
              }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Transactions;
