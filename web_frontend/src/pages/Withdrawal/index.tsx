import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Input, Select, Row, Col,
  Statistic, Modal, Descriptions, message, Popconfirm, Badge, Tooltip,
} from 'antd';
import {
  WalletOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, EyeOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { withdrawalAPI } from '../../services/api/withdrawal';

const { Option } = Select;

// ────────────────────────────── 类型定义 ──────────────────────────────
export interface WithdrawalRecord {
  id: number;
  userId: string;
  email: string;
  walletAddress: string;
  amount: number;
  networkFee: number;
  receivedAmount: number;
  status: 'pending' | 'success' | 'rejected';
  googleAccount?: string;
  appleId?: string;
  createdAt: string;
}

// ────────────────────────────── 状态映射 ──────────────────────────────
const STATUS_MAP: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending:  { color: 'gold',    text: '待处理', icon: <ClockCircleOutlined /> },
  success:  { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
  rejected: { color: 'error',   text: '已拒绝', icon: <CloseCircleOutlined /> },
};

// ────────────────────────────── 组件主体 ──────────────────────────────
const Withdrawal: React.FC = () => {
  const [loading, setLoading]               = useState(false);
  const [approving, setApproving]           = useState<number | null>(null);
  const [rejecting, setRejecting]           = useState<number | null>(null);
  const [records, setRecords]               = useState<WithdrawalRecord[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [pageSize]                          = useState(20);
  const [statusFilter, setStatusFilter]     = useState<string>('all');
  const [searchText, setSearchText]         = useState('');
  const [detailVisible, setDetailVisible]   = useState(false);
  const [selected, setSelected]             = useState<WithdrawalRecord | null>(null);

  // 统计数据
  const pendingCount  = records.filter(r => r.status === 'pending').length;
  const successCount  = records.filter(r => r.status === 'success').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;
  const totalBTC      = records.reduce((s, r) => s + r.amount, 0);

  // ── 加载列表 ──
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await withdrawalAPI.adminList({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchText || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      setRecords(res.data?.withdrawals ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
      // request.ts 拦截器已弹出错误提示
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchText, page, pageSize]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── 同意提现 ──
  const handleApprove = async (record: WithdrawalRecord) => {
    setApproving(record.id);
    try {
      await withdrawalAPI.approve(record.id);
      message.success(`已同意提现 #${record.id}`);
      fetchList();
    } finally {
      setApproving(null);
    }
  };

  // ── 拒绝提现 ──
  const handleReject = async (record: WithdrawalRecord) => {
    setRejecting(record.id);
    try {
      await withdrawalAPI.reject(record.id, { reason: '管理员拒绝' });
      message.success(`已拒绝提现 #${record.id}`);
      fetchList();
    } finally {
      setRejecting(null);
    }
  };

  // ────────────────── 表格列 ──────────────────
  const columns: ColumnsType<WithdrawalRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
      fixed: 'left',
    },
    {
      title: '用户邮箱',
      dataIndex: 'email',
      width: 220,
      ellipsis: true,
      filterDropdown: false,
    },
    {
      title: '钱包地址',
      dataIndex: 'walletAddress',
      width: 200,
      ellipsis: true,
      render: (addr: string) => (
        <Tooltip title={addr}>
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {addr.length > 20 ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : addr}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '申请金额 (BTC)',
      dataIndex: 'amount',
      width: 150,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace', color: '#fa8c16', fontWeight: 600 }}>
          {Number(v).toFixed(8)}
        </span>
      ),
    },
    {
      title: '手续费 (BTC)',
      dataIndex: 'networkFee',
      width: 130,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace', color: '#8c8c8c', fontSize: 12 }}>
          {Number(v).toFixed(8)}
        </span>
      ),
    },
    {
      title: '实际到账 (BTC)',
      dataIndex: 'receivedAmount',
      width: 150,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace', color: '#52c41a', fontWeight: 600 }}>
          {Number(v).toFixed(8)}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => {
        const m = STATUS_MAP[s] ?? { color: 'default', text: s, icon: null };
        return <Tag color={m.color} icon={m.icon}>{m.text}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_: unknown, record: WithdrawalRecord) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setSelected(record); setDetailVisible(true); }}
          >
            详情
          </Button>

          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确认同意提现？"
                description={`将向用户下发 ${Number(record.receivedAmount).toFixed(8)} BTC`}
                okText="确认同意"
                cancelText="取消"
                okButtonProps={{ danger: false, type: 'primary' }}
                onConfirm={() => handleApprove(record)}
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approving === record.id}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  同意提现
                </Button>
              </Popconfirm>

              <Popconfirm
                title="确认拒绝提现？"
                description="余额将退还给用户"
                okText="确认拒绝"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleReject(record)}
              >
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={rejecting === record.id}
                >
                  拒绝
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ────────────────────────────── 渲染 ──────────────────────────────
  return (
    <div style={{ padding: '0 4px' }}>
      <h2 style={{ marginBottom: 20 }}>提现详情</h2>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总提现笔数"
              value={total}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={<Badge status="warning" text="待处理" />}
              value={pendingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={<Badge status="success" text="已完成" />}
              value={successCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总申请 BTC"
              value={totalBTC.toFixed(8)}
              suffix="BTC"
              valueStyle={{ color: '#fa8c16', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 筛选工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="240px">
            <Input
              allowClear
              placeholder="搜索邮箱 / 钱包地址 / 用户ID"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(1); }}
            />
          </Col>
          <Col flex="140px">
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={v => { setStatusFilter(v); setPage(1); }}
            >
              <Option value="all">全部状态</Option>
              <Option value="pending">待处理</Option>
              <Option value="success">已完成</Option>
              <Option value="rejected">已拒绝</Option>
            </Select>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table<WithdrawalRecord>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={records}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: t => `共 ${t} 条`,
            onChange: p => setPage(p),
          }}
          rowClassName={r => r.status === 'pending' ? 'row-pending' : ''}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={`提现详情 #${selected?.id}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          selected?.status === 'pending' ? (
            <Space>
              <Popconfirm
                title="确认同意提现？"
                onConfirm={async () => {
                  if (selected) {
                    await handleApprove(selected);
                    setDetailVisible(false);
                  }
                }}
              >
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={approving === selected?.id}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  同意提现
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认拒绝提现？余额将退还"
                onConfirm={async () => {
                  if (selected) {
                    await handleReject(selected);
                    setDetailVisible(false);
                  }
                }}
              >
                <Button danger icon={<CloseCircleOutlined />} loading={rejecting === selected?.id}>
                  拒绝提现
                </Button>
              </Popconfirm>
              <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          )
        }
        width={640}
      >
        {selected && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="记录 ID">{selected.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={STATUS_MAP[selected.status]?.color} icon={STATUS_MAP[selected.status]?.icon}>
                {STATUS_MAP[selected.status]?.text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="用户 ID" span={2}>{selected.userId}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{selected.email}</Descriptions.Item>
            <Descriptions.Item label="钱包地址" span={2}>
              <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {selected.walletAddress}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="申请金额">
              <span style={{ color: '#fa8c16', fontWeight: 600 }}>
                {Number(selected.amount).toFixed(8)} BTC
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="手续费">
              {Number(selected.networkFee).toFixed(8)} BTC
            </Descriptions.Item>
            <Descriptions.Item label="实际到账">
              <span style={{ color: '#52c41a', fontWeight: 600 }}>
                {Number(selected.receivedAmount).toFixed(8)} BTC
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="申请时间">
              {selected.createdAt ? new Date(selected.createdAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            {selected.googleAccount && (
              <Descriptions.Item label="Google 账号" span={2}>
                {selected.googleAccount}
              </Descriptions.Item>
            )}
            {selected.appleId && (
              <Descriptions.Item label="Apple ID" span={2}>
                {selected.appleId}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Withdrawal;
