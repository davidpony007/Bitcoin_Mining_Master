import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, Input, Select, Row, Col,
  Statistic, Modal, Descriptions, message, Badge, Tooltip, Form, Typography,
  Alert, Spin,
} from 'antd';
import {
  WalletOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, EyeOutlined, ReloadOutlined, SearchOutlined,
  DollarOutlined, CheckSquareOutlined, ThunderboltOutlined,
  SendOutlined, WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { withdrawalAPI } from '../../services/api/withdrawal';
import ResizableTitle from '@/components/ResizableTitle';

const { Option } = Select;
const { Text } = Typography;
const { TextArea } = Input;

// ─────────────────────── 类型 ────────────────────────────────
export interface WithdrawalRecord {
  id: number;
  userId: string;
  email: string;
  googleAccount?: string;
  appleAccount?: string;
  walletAddress?: string;
  binanceUid?: string;
  amount: number;
  networkFee: number;
  receivedAmount: number;
  status: 'pending' | 'success' | 'rejected';
  rejectReason?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────── 状态映射 ────────────────────────────
const STATUS_MAP: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  pending:  { color: 'gold',    text: '待处理', icon: <ClockCircleOutlined /> },
  success:  { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
  rejected: { color: 'error',   text: '已拒绝', icon: <CloseCircleOutlined /> },
};

const shortAddr = (addr?: string) =>
  addr ? (addr.length > 22 ? `${addr.slice(0, 10)}…${addr.slice(-8)}` : addr) : '—';

// ─────────────────────── 主组件 ──────────────────────────────
const Withdrawal: React.FC = () => {
  const [loading,       setLoading]       = useState(false);
  const [approving,     setApproving]     = useState<number | null>(null);
  const [rejecting,     setRejecting]     = useState<number | null>(null);
  const [records,       setRecords]       = useState<WithdrawalRecord[]>([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [pageSize]                        = useState(20);
  const [statusFilter,  setStatusFilter]  = useState<string>('all');
  const [searchText,    setSearchText]    = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [selected,      setSelected]      = useState<WithdrawalRecord | null>(null);

  // 拒绝弹窗
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget,  setRejectTarget]  = useState<WithdrawalRecord | null>(null);
  const [rejectForm]                      = Form.useForm();
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_withdrawal') || '{}'); } catch { return {}; }
  });
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_withdrawal', JSON.stringify(next));
      return next;
    });
  };

  // 批量操作
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkRejecting, setBulkRejecting] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkRejectVisible, setBulkRejectVisible] = useState(false);
  const [bulkRejectForm] = Form.useForm();

  // 币安批量打款
  const [payoutPreviewVisible, setPayoutPreviewVisible] = useState(false);
  const [payoutResultVisible,  setPayoutResultVisible]  = useState(false);
  const [payoutPreviewing,     setPayoutPreviewing]     = useState(false);
  const [payoutRunning,        setPayoutRunning]        = useState(false);
  const [payoutPreview,        setPayoutPreview]        = useState<any[]>([]);
  const [payoutResult,         setPayoutResult]         = useState<{ success: any[]; failed: any[]; manual: any[] } | null>(null);
  const [payoutTargetIds,      setPayoutTargetIds]      = useState<number[]>([]);

  /** 打开预览弹窗（先 dryRun 获取清单） */
  const openPayoutPreview = async (ids: number[]) => {
    setPayoutTargetIds(ids);
    setPayoutPreviewing(true);
    setPayoutPreviewVisible(true);
    try {
      const res: any = await withdrawalAPI.batchPayout({ ids, dryRun: true });
      setPayoutPreview(res?.data?.preview ?? []);
    } catch {
      message.error('获取预览失败');
      setPayoutPreviewVisible(false);
    } finally {
      setPayoutPreviewing(false);
    }
  };

  /** 确认执行打款 */
  const confirmBatchPayout = async () => {
    setPayoutRunning(true);
    try {
      const res: any = await withdrawalAPI.batchPayout({ ids: payoutTargetIds });
      setPayoutResult(res?.data ?? { success: [], failed: [], manual: [] });
      setPayoutPreviewVisible(false);
      setPayoutResultVisible(true);
      setSelectedIds([]);
      fetchList();
    } catch {
      message.error('批量打款失败，请重试');
    } finally {
      setPayoutRunning(false);
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) { message.warning('请先选择要操作的记录'); return; }
    const pendingOnly = records.filter(r => selectedIds.includes(r.id) && r.status === 'pending');
    if (pendingOnly.length === 0) { message.warning('所选记录中没有待处理的申请'); return; }
    Modal.confirm({
      title: `确认批量同意 ${pendingOnly.length} 条提现申请？`,
      okText: '确认同意', cancelText: '取消',
      okButtonProps: { style: { background: '#52c41a', borderColor: '#52c41a' } },
      onOk: async () => {
        setBulkApproving(true);
        try {
          const res: any = await withdrawalAPI.bulkApprove(pendingOnly.map(r => r.id));
          message.success(res?.message || '批量同意完成');
          setSelectedIds([]);
          fetchList();
        } catch { message.error('批量同意失败'); }
        setBulkApproving(false);
      },
    });
  };

  const handleBulkRejectSubmit = async () => {
    try {
      const { reason } = await bulkRejectForm.validateFields();
      const pendingOnly = records.filter(r => selectedIds.includes(r.id) && r.status === 'pending');
      setBulkRejecting(true);
      const res: any = await withdrawalAPI.bulkReject(pendingOnly.map(r => r.id), reason);
      message.success(res?.message || '批量拒绝完成');
      setBulkRejectVisible(false);
      bulkRejectForm.resetFields();
      setSelectedIds([]);
      fetchList();
    } catch { /* form validation */ }
    setBulkRejecting(false);
  };

  // 统计
  const pendingCount  = records.filter(r => r.status === 'pending').length;
  const successCount  = records.filter(r => r.status === 'success').length;
  const rejectedCount = records.filter(r => r.status === 'rejected').length;
  const totalBTC      = records.reduce((s, r) => s + r.amount, 0);

  // ── 拉取列表 ──
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
      // request.ts 拦截器已弹错误提示
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
      message.success(`已同意提现申请 #${record.id}`);
      fetchList();
    } finally {
      setApproving(null);
    }
  };

  // ── 打开拒绝弹窗 ──
  const openRejectModal = (record: WithdrawalRecord) => {
    setRejectTarget(record);
    rejectForm.resetFields();
    setRejectVisible(true);
  };

  // ── 提交拒绝 ──
  const handleRejectSubmit = async () => {
    try {
      const { reason } = await rejectForm.validateFields();
      if (!rejectTarget) return;
      setRejecting(rejectTarget.id);
      await withdrawalAPI.reject(rejectTarget.id, { reason: reason || '管理员拒绝' });
      message.success(`已拒绝提现申请 #${rejectTarget.id}`);
      setRejectVisible(false);
      setRejectTarget(null);
      if (detailVisible) setDetailVisible(false);
      fetchList();
    } catch {
      // 表单校验失败
    } finally {
      setRejecting(null);
    }
  };

  // ─────────────────────── 表格列 ──────────────────────────────
  const columns: ColumnsType<WithdrawalRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 64,
      fixed: 'left',
    },
    {
      title: '用户 ID',
      dataIndex: 'userId',
      width: 120,
      ellipsis: true,
      render: (v: string) => (
        <Text copyable={{ text: v }} style={{ fontSize: 12 }}>{v}</Text>
      ),
    },
    {
      title: 'Google 账号',
      dataIndex: 'googleAccount',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v
        ? <Tooltip title={v}><Text style={{ fontSize: 12 }}>{v}</Text></Tooltip>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Apple 账号',
      dataIndex: 'appleAccount',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v
        ? <Tooltip title={v}><Text style={{ fontSize: 12 }}>{v}</Text></Tooltip>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '钱包地址',
      dataIndex: 'walletAddress',
      width: 180,
      ellipsis: true,
      render: (v?: string) => v
        ? (
          <Tooltip title={v}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortAddr(v)}</span>
          </Tooltip>
        )
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Binance UID',
      dataIndex: 'binanceUid',
      width: 130,
      render: (v?: string) => v
        ? <Text copyable={{ text: v }} style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '申请金额 (BTC)',
      dataIndex: 'amount',
      width: 155,
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
      width: 155,
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
      width: 96,
      render: (s: string) => {
        const m = STATUS_MAP[s] ?? { color: 'default', text: s, icon: null };
        return <Tag color={m.color} icon={m.icon}>{m.text}</Tag>;
      },
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (t: string) => t ? new Date(t).toISOString().slice(0, 19).replace('T', ' ') : '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
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
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={approving === record.id}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => {
                  Modal.confirm({
                    title: '确认同意该提现申请？',
                    content: (
                      <span>
                        将向用户下发{' '}
                        <b style={{ color: '#52c41a' }}>
                          {Number(record.receivedAmount).toFixed(8)} BTC
                        </b>
                      </span>
                    ),
                    okText: '确认同意',
                    cancelText: '取消',
                    onOk: () => handleApprove(record),
                  });
                }}
              >
                同意
              </Button>

              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={rejecting === record.id}
                onClick={() => openRejectModal(record)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });
  // ─────────────────────── 渲染 ─────────────────────────────────
  return (
    <div style={{ padding: '0 4px' }}>
      <h2 style={{ marginBottom: 20 }}>提现管理</h2>

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
              title={<Badge status="warning" text=" 待处理" />}
              value={pendingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={<Badge status="success" text=" 已完成" />}
              value={successCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={<Badge status="error" text=" 已拒绝" />}
              value={rejectedCount}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 总 BTC 条幅 */}
      <Card style={{ marginBottom: 16, background: '#fffbe6', border: '1px solid #ffe58f' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <DollarOutlined style={{ fontSize: 28, color: '#fa8c16' }} />
          </Col>
          <Col>
            <div style={{ fontSize: 13, color: '#8c8c8c' }}>当前列表总申请 BTC</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fa8c16', fontFamily: 'monospace' }}>
              {totalBTC.toFixed(8)} BTC
            </div>
          </Col>
        </Row>
      </Card>

      {/* 筛选工具栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col flex="300px">
            <Input
              allowClear
              placeholder="搜索 用户ID / 邮箱 / 钱包地址 / Binance UID"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(1); }}
            />
          </Col>
          <Col flex="150px">
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

      {/* 批量操作按钮 */}
      {selectedIds.length > 0 && (
        <Card style={{ marginBottom: 12, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
          <Space>
            <CheckSquareOutlined style={{ color: '#1677ff' }} />
            <span>已选 <b>{selectedIds.length}</b> 条，其中待处理 <b>{records.filter(r => selectedIds.includes(r.id) && r.status === 'pending').length}</b> 条</span>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={bulkApproving}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={handleBulkApprove}
            >手动批量同意</Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              onClick={() => {
                const pendingOnly = records.filter(r => selectedIds.includes(r.id) && r.status === 'pending');
                if (pendingOnly.length === 0) { message.warning('所选记录中没有待处理的申请'); return; }
                openPayoutPreview(pendingOnly.map(r => r.id));
              }}
            >币安批量打款</Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                const pendingOnly = records.filter(r => selectedIds.includes(r.id) && r.status === 'pending');
                if (pendingOnly.length === 0) { message.warning('所选记录中没有待处理的申请'); return; }
                bulkRejectForm.resetFields();
                setBulkRejectVisible(true);
              }}
            >批量拒绝</Button>
            <Button onClick={() => setSelectedIds([])}>取消选择</Button>
          </Space>
        </Card>
      )}

      {/* 数据表格 */}
      <Card>
        <Table<WithdrawalRecord>
          rowKey="id"
          loading={loading}
          columns={mergedColumns}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={records}
          scroll={{ x: 1640 }}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
            getCheckboxProps: () => ({}),
          }}
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

      {/* ─── 详情弹窗 ─────────────────────────────────────── */}
      <Modal
        title={`提现详情 #${selected?.id}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          selected?.status === 'pending' ? (
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={approving === selected?.id}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => {
                  if (!selected) return;
                  Modal.confirm({
                    title: '确认同意该提现申请？',
                    content: (
                      <span>
                        将向用户下发{' '}
                        <b style={{ color: '#52c41a' }}>
                          {Number(selected.receivedAmount).toFixed(8)} BTC
                        </b>
                      </span>
                    ),
                    okText: '确认同意',
                    cancelText: '取消',
                    onOk: async () => {
                      await handleApprove(selected);
                      setDetailVisible(false);
                    },
                  });
                }}
              >
                同意提现
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => { if (selected) { setDetailVisible(false); openRejectModal(selected); } }}
              >
                拒绝提现
              </Button>
              <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          )
        }
        width={680}
      >
        {selected && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="记录 ID">{selected.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag
                color={STATUS_MAP[selected.status]?.color}
                icon={STATUS_MAP[selected.status]?.icon}
              >
                {STATUS_MAP[selected.status]?.text}
              </Tag>
            </Descriptions.Item>

            <Descriptions.Item label="用户 ID" span={2}>
              <Text copyable>{selected.userId}</Text>
            </Descriptions.Item>

            {selected.googleAccount && (
              <Descriptions.Item label="Google 账号" span={2}>
                {selected.googleAccount}
              </Descriptions.Item>
            )}
            {selected.appleAccount && (
              <Descriptions.Item label="Apple 账号" span={2}>
                {selected.appleAccount}
              </Descriptions.Item>
            )}
            {selected.walletAddress && (
              <Descriptions.Item label="钱包地址" span={2}>
                <Text
                  copyable
                  style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: 12 }}
                >
                  {selected.walletAddress}
                </Text>
              </Descriptions.Item>
            )}
            {selected.binanceUid && (
              <Descriptions.Item label="Binance UID" span={2}>
                <Text copyable style={{ fontFamily: 'monospace' }}>{selected.binanceUid}</Text>
              </Descriptions.Item>
            )}

            <Descriptions.Item label="申请金额">
              <span style={{ color: '#fa8c16', fontWeight: 600, fontFamily: 'monospace' }}>
                {Number(selected.amount).toFixed(8)} BTC
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="手续费">
              <span style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>
                {Number(selected.networkFee).toFixed(8)} BTC
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="实际到账" span={2}>
              <span style={{ color: '#52c41a', fontWeight: 600, fontFamily: 'monospace' }}>
                {Number(selected.receivedAmount).toFixed(8)} BTC
              </span>
            </Descriptions.Item>

            <Descriptions.Item label="申请时间">
              {selected.createdAt ? new Date(selected.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '—'}
            </Descriptions.Item>
            {selected.updatedAt && (
              <Descriptions.Item label="处理时间">
                {new Date(selected.updatedAt).toISOString().slice(0, 19).replace('T', ' ')}
              </Descriptions.Item>
            )}
            {selected.rejectReason && (
              <Descriptions.Item label="拒绝原因" span={2}>
                <Text type="danger">{selected.rejectReason}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* ─── 批量拒绝弹窗 ──────────────────────────────────── */}
      <Modal
        title={`批量拒绝 ${records.filter(r => selectedIds.includes(r.id) && r.status === 'pending').length} 条提现申请`}
        open={bulkRejectVisible}
        onCancel={() => { setBulkRejectVisible(false); bulkRejectForm.resetFields(); }}
        onOk={handleBulkRejectSubmit}
        okText="确认批量拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: bulkRejecting }}
        width={480}
      >
        <Form form={bulkRejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请填写拒绝原因' }]}
          >
            <TextArea
              rows={4}
              maxLength={200}
              showCount
              placeholder="请填写拒绝原因（将通知用户，余额自动退还）"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── 币安批量打款预览弹窗 ───────────────────────────── */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: '#fa8c16' }} />币安批量打款预览</Space>}
        open={payoutPreviewVisible}
        onCancel={() => { if (!payoutRunning) { setPayoutPreviewVisible(false); setPayoutPreview([]); } }}
        width={780}
        footer={
          <Space>
            <Button onClick={() => setPayoutPreviewVisible(false)} disabled={payoutRunning}>取消</Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={payoutRunning}
              disabled={payoutPreviewing || payoutPreview.length === 0}
              style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              onClick={() => {
                const chainCount = payoutPreview.filter(p => !p.isUID).length;
                const uidCount   = payoutPreview.filter(p => p.isUID).length;
                Modal.confirm({
                  title: '确认执行批量打款？',
                  icon: <WarningOutlined style={{ color: '#fa8c16' }} />,
                  content: (
                    <div>
                      <p>即将通过币安 API 自动打款 <b style={{ color: '#52c41a' }}>{chainCount} 笔</b>（链上地址）</p>
                      {uidCount > 0 && <p><b style={{ color: '#fa8c16' }}>{uidCount} 笔</b> 为币安 UID，需在币安 App 手动转账</p>}
                      <p style={{ color: '#ff4d4f', fontSize: 12, marginTop: 8 }}>⚠️ 链上打款一旦发起不可撤回，请确认金额无误</p>
                    </div>
                  ),
                  okText: '确认打款',
                  cancelText: '再看看',
                  okButtonProps: { style: { background: '#fa8c16', borderColor: '#fa8c16' } },
                  onOk: confirmBatchPayout,
                });
              }}
            >
              确认打款
            </Button>
          </Space>
        }
      >
        {payoutPreviewing ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="正在获取预览数据..." />
          </div>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic
                    title="链上自动打款"
                    value={payoutPreview.filter(p => !p.isUID).length}
                    suffix="笔"
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<SendOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                  <Statistic
                    title="币安UID（需手动）"
                    value={payoutPreview.filter(p => p.isUID).length}
                    suffix="笔"
                    valueStyle={{ color: '#fa8c16' }}
                    prefix={<WarningOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="合计打款金额"
                    value={payoutPreview.reduce((s, p) => s + (p.receivedAmount || 0), 0).toFixed(8)}
                    suffix="BTC"
                    valueStyle={{ color: '#1677ff', fontFamily: 'monospace', fontSize: 16 }}
                  />
                </Card>
              </Col>
            </Row>
            {payoutPreview.filter(p => p.isUID).length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={'币安UID订单在打款完成后，需在币安App手动转账，再到本页面点击"手动批量同意"更新状态'}
              />
            )}
            <Table
              size="small"
              rowKey="id"
              dataSource={payoutPreview}
              pagination={false}
              scroll={{ y: 320 }}
              columns={[
                { title: 'ID', dataIndex: 'id', width: 60 },
                { title: '邮箱', dataIndex: 'email', ellipsis: true, width: 180 },
                {
                  title: '收款方式', dataIndex: 'isUID', width: 120,
                  render: (isUID: boolean, r: any) => isUID
                    ? <Tag color="orange" icon={<WarningOutlined />}>UID: {r.walletAddress}</Tag>
                    : <Tag color="green" icon={<SendOutlined />}>链上地址</Tag>,
                },
                {
                  title: '到账金额 (BTC)', dataIndex: 'receivedAmount', width: 150, align: 'right' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'monospace', color: '#52c41a', fontWeight: 600 }}>
                      {Number(v).toFixed(8)}
                    </span>
                  ),
                },
                {
                  title: '钱包地址', dataIndex: 'walletAddress', ellipsis: true,
                  render: (v: string, r: any) => r.isUID ? '—' : (
                    <Tooltip title={v}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {v ? `${v.slice(0, 12)}…${v.slice(-8)}` : '—'}
                      </span>
                    </Tooltip>
                  ),
                },
              ]}
            />
          </>
        )}
      </Modal>

      {/* ─── 币安批量打款结果弹窗 ─────────────────────────────── */}
      <Modal
        title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />打款完成</Space>}
        open={payoutResultVisible}
        onCancel={() => setPayoutResultVisible(false)}
        footer={<Button type="primary" onClick={() => setPayoutResultVisible(false)}>关闭</Button>}
        width={680}
      >
        {payoutResult && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                  <Statistic title="打款成功" value={payoutResult.success.length} suffix="笔"
                    valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
                  <Statistic title="打款失败" value={payoutResult.failed.length} suffix="笔"
                    valueStyle={{ color: '#ff4d4f' }} prefix={<CloseCircleOutlined />} />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
                  <Statistic title="需手动处理" value={payoutResult.manual.length} suffix="笔"
                    valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} />
                </Card>
              </Col>
            </Row>

            {payoutResult.success.length > 0 && (
              <Card size="small"
                title={<Text style={{ color: '#52c41a' }}>✅ 已自动打款</Text>}
                style={{ marginBottom: 12 }}>
                <Table size="small" dataSource={payoutResult.success} rowKey="id" pagination={false}
                  columns={[
                    { title: 'ID', dataIndex: 'id', width: 60 },
                    {
                      title: '到账金额', dataIndex: 'amount', width: 150,
                      render: (v: number) => <span style={{ fontFamily: 'monospace', color: '#52c41a' }}>{Number(v).toFixed(8)} BTC</span>,
                    },
                    {
                      title: '币安流水号', dataIndex: 'binanceId', ellipsis: true,
                      render: (v: string) => <Text copyable={{ text: v }} style={{ fontSize: 12 }}>{v}</Text>,
                    },
                  ]}
                />
              </Card>
            )}

            {payoutResult.manual.length > 0 && (
              <Card size="small"
                title={<Text style={{ color: '#fa8c16' }}>⚠️ 需在币安App手动转账（UID）</Text>}
                style={{ marginBottom: 12 }}>
                <Table size="small" dataSource={payoutResult.manual} rowKey="id" pagination={false}
                  columns={[
                    { title: 'ID', dataIndex: 'id', width: 60 },
                    { title: '邮箱', dataIndex: 'email', ellipsis: true },
                    {
                      title: '币安 UID', dataIndex: 'uid', width: 130,
                      render: (v: string) => <Text copyable style={{ fontFamily: 'monospace' }}>{v}</Text>,
                    },
                    {
                      title: '金额', dataIndex: 'amount', width: 150,
                      render: (v: number) => <span style={{ fontFamily: 'monospace', color: '#fa8c16' }}>{Number(v).toFixed(8)} BTC</span>,
                    },
                  ]}
                />
              </Card>
            )}

            {payoutResult.failed.length > 0 && (
              <Card size="small" title={<Text type="danger">❌ 打款失败（需排查）</Text>}>
                <Table size="small" dataSource={payoutResult.failed} rowKey="id" pagination={false}
                  columns={[
                    { title: 'ID', dataIndex: 'id', width: 60 },
                    {
                      title: '失败原因', dataIndex: 'reason', ellipsis: true,
                      render: (v: string) => <Text type="danger" style={{ fontSize: 12 }}>{v}</Text>,
                    },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Modal>

      {/* ─── 拒绝原因弹窗 ─────────────────────────────────── */}
      <Modal
        title={`拒绝提现申请 #${rejectTarget?.id}`}
        open={rejectVisible}
        onCancel={() => { setRejectVisible(false); setRejectTarget(null); }}
        onOk={handleRejectSubmit}
        okText="确认拒绝"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: rejecting === rejectTarget?.id }}
        width={480}
      >
        {rejectTarget && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 16px',
              background: '#fff7e6',
              borderRadius: 6,
              border: '1px solid #ffd591',
            }}
          >
            <div style={{ fontSize: 13, color: '#8c8c8c', marginBottom: 4 }}>提现信息</div>
            <div>用户 ID：<b>{rejectTarget.userId}</b></div>
            <div>
              申请金额：
              <b style={{ color: '#fa8c16' }}>
                {Number(rejectTarget.amount).toFixed(8)} BTC
              </b>
            </div>
          </div>
        )}
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请填写拒绝原因' }]}
          >
            <TextArea
              rows={4}
              maxLength={200}
              showCount
              placeholder="请填写拒绝原因（将通知用户，余额自动退还）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Withdrawal;
