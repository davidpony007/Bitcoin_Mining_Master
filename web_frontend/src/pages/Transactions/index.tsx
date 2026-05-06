import React, { useState, useCallback, useEffect } from 'react';
import { Card, Table, Input, Space, Select, DatePicker, Tabs, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import dayjs from 'dayjs';
import { bitcoinTxApi } from '@/services/api/admin';
import 'react-resizable/css/styles.css';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

// ─── 可拖拽表头 ──────────────────────────────────────────────────────────────
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width}
      height={0}
      handle={<span className="react-resizable-handle" onClick={e => e.stopPropagation()} />}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

// ─── Bitcoin Transaction 类型标签颜色 ────────────────────────────────────────
const typeColor: Record<string, string> = {
  'Free Ad Reward': 'orange',
  'Daily Check-in Reward': 'gold',
  'Invite Friend Reward': 'blue',
  'Bind Referrer Reward': 'cyan',
  'subordinate rebate': 'green',
  'withdrawal': 'red',
  'refund for withdrawal failure': 'purple',
  'mining_reward': 'volcano',
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

// ─── 初始列宽配置 ─────────────────────────────────────────────────────────────
const TX_COL_WIDTHS_INIT = { id: 80, userId: 180, type: 180, amount: 200, balanceAfter: 200, description: 300, status: 90, createdAt: 175 };
const RBT_COL_WIDTHS_INIT = { id: 80, userId: 180, invitationCode: 130, subordinateUserId: 180, amount: 200, createdAt: 175 };

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
  const [txColWidths, setTxColWidths] = useState(TX_COL_WIDTHS_INIT);

  const handleTxResize = (col: keyof typeof TX_COL_WIDTHS_INIT) => (_: any, { size }: { size: { width: number } }) => {
    setTxColWidths(prev => ({ ...prev, [col]: size.width }));
  };

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
    {
      title: 'ID', dataIndex: 'id', width: txColWidths.id,
      onHeaderCell: () => ({ width: txColWidths.id, onResize: handleTxResize('id') } as any),
    },
    {
      title: '用户ID', dataIndex: 'userId', width: txColWidths.userId, ellipsis: true,
      onHeaderCell: () => ({ width: txColWidths.userId, onResize: handleTxResize('userId') } as any),
    },
    {
      title: '类型', dataIndex: 'type', width: txColWidths.type,
      onHeaderCell: () => ({ width: txColWidths.type, onResize: handleTxResize('type') } as any),
      render: (v: string) => <Tag color={typeColor[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '金额 (BTC)', dataIndex: 'amount', width: txColWidths.amount,
      onHeaderCell: () => ({ width: txColWidths.amount, onResize: handleTxResize('amount') } as any),
      render: (v: number, r: TxRecord) => (
        <span style={{ color: r.type === 'withdrawal' ? '#f5222d' : '#52c41a', fontFamily: 'monospace', fontSize: 12 }}>
          {r.type === 'withdrawal' ? '-' : '+'}{Number(v).toFixed(18)}
        </span>
      ),
    },
    {
      title: '余额 (BTC)', dataIndex: 'balanceAfter', width: txColWidths.balanceAfter,
      onHeaderCell: () => ({ width: txColWidths.balanceAfter, onResize: handleTxResize('balanceAfter') } as any),
      render: (v: number | null) => v != null
        ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{Number(v).toFixed(18)}</span>
        : '-',
    },
    {
      title: '说明', dataIndex: 'description', width: txColWidths.description, ellipsis: true,
      onHeaderCell: () => ({ width: txColWidths.description, onResize: handleTxResize('description') } as any),
    },
    {
      title: '状态', dataIndex: 'status', width: txColWidths.status,
      onHeaderCell: () => ({ width: txColWidths.status, onResize: handleTxResize('status') } as any),
      render: (v: string) => (
        <Tag color={v === 'success' ? 'success' : v === 'pending' ? 'warning' : 'error'}>{v}</Tag>
      ),
    },
    {
      title: '时间', dataIndex: 'createdAt', width: txColWidths.createdAt,
      onHeaderCell: () => ({ width: txColWidths.createdAt, onResize: handleTxResize('createdAt') } as any),
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
  const [rbtColWidths, setRbtColWidths] = useState(RBT_COL_WIDTHS_INIT);

  const handleRbtResize = (col: keyof typeof RBT_COL_WIDTHS_INIT) => (_: any, { size }: { size: { width: number } }) => {
    setRbtColWidths(prev => ({ ...prev, [col]: size.width }));
  };

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
    {
      title: 'ID', dataIndex: 'id', width: rbtColWidths.id,
      onHeaderCell: () => ({ width: rbtColWidths.id, onResize: handleRbtResize('id') } as any),
    },
    {
      title: '用户ID', dataIndex: 'userId', width: rbtColWidths.userId, ellipsis: true,
      onHeaderCell: () => ({ width: rbtColWidths.userId, onResize: handleRbtResize('userId') } as any),
    },
    {
      title: '邀请码', dataIndex: 'invitationCode', width: rbtColWidths.invitationCode,
      onHeaderCell: () => ({ width: rbtColWidths.invitationCode, onResize: handleRbtResize('invitationCode') } as any),
    },
    {
      title: '下级用户ID', dataIndex: 'subordinateUserId', width: rbtColWidths.subordinateUserId, ellipsis: true,
      onHeaderCell: () => ({ width: rbtColWidths.subordinateUserId, onResize: handleRbtResize('subordinateUserId') } as any),
    },
    {
      title: '返利金额 (BTC)', dataIndex: 'amount', width: rbtColWidths.amount,
      onHeaderCell: () => ({ width: rbtColWidths.amount, onResize: handleRbtResize('amount') } as any),
      render: (v: number) => <span style={{ color: '#52c41a', fontFamily: 'monospace', fontSize: 12 }}>+{Number(v).toFixed(18)}</span>,
    },
    {
      title: '时间', dataIndex: 'createdAt', width: rbtColWidths.createdAt,
      onHeaderCell: () => ({ width: rbtColWidths.createdAt, onResize: handleRbtResize('createdAt') } as any),
      render: (v: string) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-',
    },
  ];

  // 页面挂载时自动加载交易记录（默认日期范围）
  useEffect(() => {
    loadTx(1, '', '', txDates);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                style={{ width: 200 }}
                value={txType || undefined}
                onChange={v => { setTxType(v || ''); setTxPage(1); loadTx(1, txUserId, v || '', txDates); }}
              >
                <Option value="all">全部</Option>
                <Option value="mining_reward">挖矿收益（付费合约）</Option>
                <Option value="Free Ad Reward">广告奖励</Option>
                <Option value="Daily Check-in Reward">签到奖励</Option>
                <Option value="Invite Friend Reward">邀请奖励</Option>
                <Option value="Bind Referrer Reward">绑定奖励</Option>
                <Option value="subordinate rebate">返利收入</Option>
                <Option value="withdrawal">提现</Option>
                <Option value="refund for withdrawal failure">提现退款</Option>
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
              components={{ header: { cell: ResizableTitle } }}
              scroll={{ x: 'max-content' }}
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
              components={{ header: { cell: ResizableTitle } }}
              scroll={{ x: 'max-content' }}
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
