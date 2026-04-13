import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Space, Tag, Row, Col, Statistic, Select,
  message, Modal, Popconfirm, Drawer, Tabs, Descriptions, InputNumber,
  Form, Typography, Badge, Divider, Tooltip, Empty,
} from 'antd';
import {
  SearchOutlined, UserOutlined, TeamOutlined, RiseOutlined,
  PlusCircleOutlined, MinusCircleOutlined, InfoCircleOutlined,
  DollarOutlined, CrownOutlined, ReloadOutlined, DeleteOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { usersApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';
import './styles.css';

const { Option } = Select;
const { Text } = Typography;
const { TabPane } = Tabs;

// ─── 类型定义 ────────────────────────────────────────────────────────────────

interface UserRow {
  user_id: string;
  invitation_code: string | null;
  email: string;
  google_account: string | null;
  apple_account: string | null;
  nickname: string | null;
  country_code: string | null;
  country_name_cn: string | null;
  user_level: number;
  user_points: number;
  total_ad_views: number;
  system: string | null;
  device_id: string | null;
  acquisition_channel: string | null;
  user_status: string | null;
  is_banned: number;
  ban_reason: string | null;
  last_login_time: string | null;
  user_creation_time: string;
  current_bitcoin_balance: string | null;
  bitcoin_accumulated_amount: string | null;
  total_withdrawal_amount: string | null;
  total_invitation_rebate: string | null;
  mining_rate_per_second: string | null;
  country_multiplier: string | null;
  miner_level_multiplier: string | null;
}

interface UserDetail {
  basic: UserRow & {
    device_id: string | null;
    gaid: string | null;
    idfa: string | null;
    att_status: number | null;
    att_consent_updated_at: string | null;
    register_ip: string | null;
    country_multiplier: string | null;
    miner_level_multiplier: string | null;
    banned_at: string | null;
    apple_id: string | null;
    app_version: string | null;
  };
  referrer: {
    referrer_user_id: string;
    referrer_email: string | null;
    referrer_invitation_code: string;
    invitation_creation_time: string;
  } | null;
  invitedCount: number;
  invitedList: { user_id: string; email: string; invitation_creation_time: string }[];
  recentTxs: {
    transaction_type: string;
    transaction_amount: string;
    balance_after: string | null;
    description: string | null;
    transaction_creation_time: string;
    transaction_status: string;
  }[];
  contractStats: { total_contracts: number; active_contracts: number; paid_contracts: number; expired_contracts: number };
  orderStats: { total_orders: number; total_spent: string; refund_count: number };
  recentWithdrawals: {
    withdrawal_request_amount: string;
    received_amount: string;
    withdrawal_status: string;
    wallet_address: string;
    created_at: string;
  }[];
  totalCheckinDays: number;
  totalMiningRatePerSecond: string;
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────

const fmtBtc = (v: string | number | null | undefined): string => {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? '0.000000000000000000' : n.toFixed(18);
};

// 从 device_id 推断平台（当 system 字段为空时的后备方案）
const inferPlatform = (system: string | null, deviceId: string | null): string | null => {
  if (system) return system;
  if (!deviceId) return null;
  if (deviceId.toUpperCase().startsWith('IOS_')) return 'iOS';
  if (deviceId.toUpperCase().startsWith('AND_') || deviceId.match(/^[0-9a-f]{16}$/i)) return 'Android';
  return null;
};

// 统一使用 UTC+00 显示时间，格式 YYYY-MM-DD HH:mm:ss
const fmtTime = (v: string | null | undefined): string =>
  v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-';

const statusMap: Record<string, { color: string; label: string }> = {
  'active within 3 days': { color: 'green', label: '近3天活跃' },
  'no login within 7 days': { color: 'orange', label: '7天未登录' },
  'disabled': { color: 'red', label: '已禁用' },
  'deleted': { color: 'default', label: '已删除' },
  'normal': { color: 'blue', label: '正常' },
};

const txTypeLabel: Record<string, string> = {
  'Free Ad Reward': '广告奖励',
  'Daily Check-in Reward': '签到奖励',
  'Invite Friend Reward': '邀请奖励',
  'Bind Referrer Reward': '绑定推荐人',
  'mining_reward': '挖矿收益',
  'withdrawal': '提现',
  'subordinate rebate': '下级返利',
  'admin_add': '管理员增加',
  'admin_deduct': '管理员扣减',
  'refund for withdrawal failure': '提现失败退款',
};

const attLabels: Record<number, string> = { 0: '未询问', 1: '受限', 2: '拒绝', 3: '已授权' };

// ─── 主组件 ──────────────────────────────────────────────────────────────────

const Users: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [systemFilter, setSystemFilter] = useState<string>('');
  const [acquisitionFilter, setAcquisitionFilter] = useState<string>('');
  const [stats, setStats] = useState<any>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_users') || '{}'); } catch { return {}; }
  });

  const [inviteColWidths, setInviteColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_users_invite') || '{}'); } catch { return {}; }
  });
  const handleInviteResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setInviteColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_users_invite', JSON.stringify(next));
      return next;
    });
  };

  const [txColWidths, setTxColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_users_tx') || '{}'); } catch { return {}; }
  });
  const handleTxResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setTxColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_users_tx', JSON.stringify(next));
      return next;
    });
  };

  const [wdColWidths, setWdColWidths] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_users_wd') || '{}'); } catch { return {}; }
  });
  const handleWdResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setWdColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_users_wd', JSON.stringify(next));
      return next;
    });
  };

  const [btcPrice, setBtcPrice] = useState<number>(0);

  const [sortField, setSortField] = useState<string>('user_creation_time');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [countries, setCountries] = useState<{ country_code: string; country_name_cn: string | null }[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<UserDetail | null>(null);

  const [btcModalOpen, setBtcModalOpen] = useState(false);
  const [btcModalType, setBtcModalType] = useState<'add' | 'deduct'>('add');
  const [btcTargetUser, setBtcTargetUser] = useState<UserRow | null>(null);
  const [btcForm] = Form.useForm();
  const [btcLoading, setBtcLoading] = useState(false);

  // ─── 积分调整 ─────────────────────────────────────────────────────────
  const [ptModalOpen, setPtModalOpen] = useState(false);
  const [ptModalType, setPtModalType] = useState<'add' | 'deduct'>('add');
  const [ptTargetUser, setPtTargetUser] = useState<UserRow | null>(null);
  const [ptForm] = Form.useForm();
  const [ptLoading, setPtLoading] = useState(false);

  // ─── 国家编辑 ─────────────────────────────────────────────────────────
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countryTargetUser, setCountryTargetUser] = useState<UserRow | null>(null);
  const [countryForm] = Form.useForm();
  const [countryLoading, setCountryLoading] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = (record: UserRow) => {
    Modal.confirm({
      title: '确认删除用户？',
      content: (
        <div>
          <p style={{ color: '#ff4d4f', fontWeight: 600 }}>此操作不可逆，将永久删除该用户的所有数据！</p>
          <p>用户：{record.email || record.user_id}</p>
        </div>
      ),
      okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res: any = await usersApi.deleteUser(record.user_id);
          if (res?.success) { message.success('用户已删除'); loadList(page, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder); }
          else message.error(res?.message || '删除失败');
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    Modal.confirm({
      title: `确认批量删除 ${selectedRowKeys.length} 个用户？`,
      content: (
        <div>
          <p style={{ color: '#ff4d4f', fontWeight: 600 }}>此操作不可逆，将永久删除所选用户的所有数据！</p>
        </div>
      ),
      okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          setDeleteLoading(true);
          const res: any = await usersApi.bulkDeleteUsers(selectedRowKeys as string[]);
          if (res?.success) {
            message.success(res.message || '批量删除成功');
            setSelectedRowKeys([]);
            loadList(1, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder);
          } else message.error(res?.message || '删除失败');
        } catch { message.error('删除失败'); }
        finally { setDeleteLoading(false); }
      },
    });
  };

  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_users', JSON.stringify(next));
      return next;
    });
  };

  const loadList = useCallback(async (
    p = page, s = search, st = status, sys = systemFilter, acq = acquisitionFilter,
    ctry = countryFilter, lvl = levelFilter, sf = sortField, so = sortOrder, sfield = searchField
  ) => {
    try {
      setLoading(true);
      const res = await usersApi.list({
        page: p, limit: 20, search: s || undefined,
        searchField: sfield || undefined,
        status: st || undefined, system: sys || undefined, acquisition: acq || undefined,
        country: ctry || undefined, level: lvl || undefined,
        sortBy: sf || undefined, sortOrder: so || undefined,
      });
      if (res?.success) { setList(res.data.list); setTotal(res.data.total); }
    } catch { message.error('加载用户列表失败'); }
    finally { setLoading(false); }
  }, [page, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder, searchField]);

  useEffect(() => {
    usersApi.stats().then(res => { if (res?.success) setStats(res.data); });
    usersApi.getBtcPrice().then((res: any) => { if (res?.data?.price > 0) setBtcPrice(res.data.price); });
    usersApi.countries().then((res: any) => { if (res?.success) setCountries(res.data || []); });
    loadList(1, '', '');
  }, []);

  const handleSearch = () => { setPage(1); loadList(1, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder, searchField); };

  const handleRefresh = () => {
    usersApi.stats().then(res => { if (res?.success) setStats(res.data); });
    loadList(page, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder);
  };

  const handleTableChange = (_pagination: any, _filters: any, sorter: any) => {
    const field = sorter.field || 'user_creation_time';
    const order: 'ASC' | 'DESC' = sorter.order === 'ascend' ? 'ASC' : 'DESC';
    setSortField(field);
    setSortOrder(order);
    setPage(1);
    loadList(1, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, field, order);
  };

  const openDetail = async (record: UserRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await usersApi.detail(record.user_id);
      if (res?.success) setDetailData(res.data);
      else message.error('加载详情失败');
    } catch { message.error('加载详情失败'); }
    finally { setDetailLoading(false); }
  };

  const handleBan = (record: UserRow) => {
    Modal.confirm({
      title: '确认禁用用户？',
      content: `将禁用用户 ${record.email || record.user_id}，提现功能将受限。`,
      okText: '确认禁用', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try { await usersApi.ban(record.user_id); message.success('用户已禁用'); loadList(page, search, status, systemFilter, acquisitionFilter); }
        catch { message.error('操作失败'); }
      },
    });
  };

  const handleUnban = async (record: UserRow) => {
    try { await usersApi.unban(record.user_id); message.success('用户已解除禁用'); loadList(page, search, status, systemFilter, acquisitionFilter); }
    catch { message.error('操作失败'); }
  };

  const openBtcModal = (record: UserRow, type: 'add' | 'deduct') => {
    setBtcTargetUser(record); setBtcModalType(type); btcForm.resetFields(); setBtcModalOpen(true);
  };

  const openPtModal = (record: UserRow, type: 'add' | 'deduct') => {
    setPtTargetUser(record); setPtModalType(type); ptForm.resetFields(); setPtModalOpen(true);
  };

  const openCountryModal = (record: UserRow) => {
    setCountryTargetUser(record);
    countryForm.setFieldsValue({
      country_code: record.country_code || '',
      country_name_cn: record.country_name_cn || '',
    });
    setCountryModalOpen(true);
  };

  const handlePtSubmit = async () => {
    if (!ptTargetUser) return;
    try {
      const values = await ptForm.validateFields();
      setPtLoading(true);
      const signed = ptModalType === 'add' ? Math.abs(values.amount) : -Math.abs(values.amount);
      const res = await usersApi.adjustPoints(ptTargetUser.user_id, signed, values.reason);
      if (res?.success) {
        message.success(res.message || '积分已调整');
        setPtModalOpen(false);
        loadList(page, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder);
        if (detailOpen && detailData?.basic.user_id === ptTargetUser.user_id) openDetail(ptTargetUser);
      } else { message.error(res?.message || '操作失败'); }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || '操作失败');
    } finally { setPtLoading(false); }
  };

  const handleCountrySubmit = async () => {
    if (!countryTargetUser) return;
    try {
      const values = await countryForm.validateFields();
      setCountryLoading(true);
      const res = await usersApi.updateCountry(countryTargetUser.user_id, values.country_code, values.country_name_cn);
      if (res?.success) {
        message.success(res.message || '国家信息已更新');
        setCountryModalOpen(false);
        loadList(page, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder);
        if (detailOpen && detailData?.basic.user_id === countryTargetUser.user_id) openDetail(countryTargetUser);
      } else { message.error(res?.message || '操作失败'); }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || '操作失败');
    } finally { setCountryLoading(false); }
  };

  const handleBtcSubmit = async () => {
    if (!btcTargetUser) return;
    try {
      const values = await btcForm.validateFields();
      setBtcLoading(true);
      // 用字符串保留精确精度，避免 JSON number → JS float 的精度丢失
      const absStr = String(values.amount).trim();
      const signedAmountStr = btcModalType === 'add' ? absStr : `-${absStr}`;
      const res = await usersApi.adjustBtc(btcTargetUser.user_id, signedAmountStr, values.reason);
      if (res?.success) {
        message.success(res.message || 'BTC余额已调整');
        setBtcModalOpen(false);
        loadList(page, search, status, systemFilter, acquisitionFilter);
        if (detailOpen && detailData?.basic.user_id === btcTargetUser.user_id) {
          openDetail(btcTargetUser);
        }
      } else {
        message.error(res?.message || '操作失败');
      }
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || '操作失败');
    } finally { setBtcLoading(false); }
  };

  // ─── 表格列 ──────────────────────────────────────────────────────────────

  const getSO = (key: string) => sortField === key ? (sortOrder === 'ASC' ? 'ascend' as const : 'descend' as const) : null;

  const columns: ColumnsType<UserRow> = [
    {
      title: 'User ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true,
      render: (v: string) => <Text copyable={{ text: v }} style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '国家', dataIndex: 'country_code', key: 'country_code', width: 90,
      render: (v: string, r: UserRow) => {
        const name = r.country_name_cn || v;
        return name ? <Tooltip title={v}><span>{name}</span></Tooltip> : '-';
      },
    },
    {
      title: '平台', dataIndex: 'system', key: 'system', width: 75,
      render: (v: string, r: UserRow) => {
        const p = inferPlatform(v, r.device_id ?? null);
        return p === 'iOS' ? <Tag color="blue">iOS</Tag> : p === 'Android' ? <Tag color="green">Android</Tag> : <Tag color="default">-</Tag>;
      },
    },
    {
      title: '等级', dataIndex: 'user_level', key: 'user_level', width: 65,
      sorter: true, sortOrder: getSO('user_level'),
      render: (v: number) => <Tag color="gold"><CrownOutlined /> {v}</Tag>,
    },
    {
      title: '国家倍率', dataIndex: 'country_multiplier', key: 'country_multiplier', width: 80,
      render: (v: string | null) => <Text style={{ color: '#52c41a' }}>{v ? parseFloat(v).toFixed(2) : '1.00'}</Text>,
    },
    {
      title: '等级倍率', dataIndex: 'miner_level_multiplier', key: 'miner_level_multiplier', width: 80,
      render: (v: string | null) => <Text style={{ color: '#1890ff' }}>{v ? parseFloat(v).toFixed(2) : '1.00'}</Text>,
    },
    {
      title: '积分', dataIndex: 'user_points', key: 'user_points', width: 70,
      sorter: true, sortOrder: getSO('user_points'),
    },
    {
      title: '广告观看次数', dataIndex: 'total_ad_views', key: 'total_ad_views', width: 100,
      sorter: true, sortOrder: getSO('total_ad_views'),
    },
    {
      title: '实时挖矿速率', dataIndex: 'mining_rate_per_second', key: 'mining_rate_per_second', width: 155,
      sorter: true, sortOrder: getSO('mining_rate_per_second'),
      render: (v: string | null) => (
        <span>
          <Text style={{ color: '#13c2c2', fontWeight: 600 }}>{v ? parseFloat(v).toFixed(18) : '0.000000000000000000'}</Text>
          <Text type="secondary" style={{ fontSize: 10, marginLeft: 3 }}>BTC/s</Text>
        </span>
      ),
    },
    {
      title: 'BTC余额', dataIndex: 'current_bitcoin_balance', key: 'current_bitcoin_balance', width: 130,
      sorter: true, sortOrder: getSO('current_bitcoin_balance'),
      render: (v: string) => <Text style={{ color: '#f7931a', fontWeight: 600 }}>{fmtBtc(v)}</Text>,
    },
    {
      title: 'BTC余额实时价值', key: 'btc_value', width: 140,
      render: (_: any, r: UserRow) => {
        const bal = parseFloat(r.current_bitcoin_balance || '0');
        return btcPrice > 0
          ? <Text style={{ color: '#faad14', fontWeight: 600 }}>${(bal * btcPrice).toFixed(4)}</Text>
          : <Text type="secondary">-</Text>;
      },
    },
    {
      title: '累计挖矿', dataIndex: 'bitcoin_accumulated_amount', key: 'bitcoin_accumulated_amount', width: 130,
      render: (v: string) => <Text style={{ color: '#52c41a' }}>{fmtBtc(v)}</Text>,
    },
    {
      title: '累计提现', dataIndex: 'total_withdrawal_amount', key: 'total_withdrawal_amount', width: 130,
      render: (v: string) => <Text style={{ color: '#1890ff' }}>{fmtBtc(v)}</Text>,
    },
    {
      title: '邀请返利', dataIndex: 'total_invitation_rebate', key: 'total_invitation_rebate', width: 120,
      sorter: true, sortOrder: getSO('total_invitation_rebate'),
      render: (v: string) => <Text style={{ color: '#722ed1' }}>{fmtBtc(v)}</Text>,
    },
    {
      title: '来源', dataIndex: 'acquisition_channel', key: 'acquisition_channel', width: 75,
      render: (v: string | null) => {
        if (v === 'invited') return <Tag color="purple">邀请</Tag>;
        if (v && v.startsWith('paid_')) return <Tag color="gold">付费</Tag>;
        if (v === 'organic') return <Tag color="cyan">自然</Tag>;
        return <Tag color="default">-</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'user_status', key: 'user_status', width: 110,
      render: (v: string, r: UserRow) => {
        if (r.is_banned) return <Tag color="red">已禁用</Tag>;
        const m = statusMap[v] || { color: 'default', label: v || '未知' };
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: '最后登录', dataIndex: 'last_login_time', key: 'last_login_time', width: 150,
      sorter: true, sortOrder: getSO('last_login_time'),
      render: (v: string) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-',
    },
    {
      title: '注册时间', dataIndex: 'user_creation_time', key: 'user_creation_time', width: 175,
      sorter: true, sortOrder: getSO('user_creation_time'),
      render: (v: string) => new Date(v).toISOString().slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作', key: 'action', width: 390, fixed: 'right' as const,
      render: (_: any, record: UserRow) => (
        <Space size={4} wrap>
          <Button size="small" icon={<InfoCircleOutlined />} onClick={() => openDetail(record)}>详情</Button>
          <Button size="small" type="primary" ghost icon={<PlusCircleOutlined />}
            style={{ borderColor: '#52c41a', color: '#52c41a' }}
            onClick={() => openBtcModal(record, 'add')}>加BTC</Button>
          <Button size="small" danger ghost icon={<MinusCircleOutlined />}
            onClick={() => openBtcModal(record, 'deduct')}>减BTC</Button>
          <Button size="small" icon={<PlusCircleOutlined />}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
            onClick={() => openPtModal(record, 'add')}>加积分</Button>
          <Button size="small" icon={<MinusCircleOutlined />}
            style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
            onClick={() => openPtModal(record, 'deduct')}>减积分</Button>
          <Button size="small" icon={<InfoCircleOutlined />}
            onClick={() => openCountryModal(record)}>改国家</Button>
          {record.is_banned ? (
            <Popconfirm title="确认解除禁用？" okText="确认" cancelText="取消" onConfirm={() => handleUnban(record)}>
              <Button size="small">启用</Button>
            </Popconfirm>
          ) : (
            <Button size="small" danger onClick={() => handleBan(record)}>禁用</Button>
          )}
          <Button size="small" danger type="primary" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
        </Space>
      ),
    },
  ];

  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  // ─── 详情抽屉 ─────────────────────────────────────────────────────────────

  const renderDetail = () => {
    if (!detailData) return null;
    const { basic, referrer, invitedCount, invitedList, recentTxs, contractStats, orderStats, recentWithdrawals, totalCheckinDays, totalMiningRatePerSecond } = detailData;

    return (
      <Tabs defaultActiveKey="basic" size="small">
        <TabPane tab="基本信息" key="basic">
          <Descriptions column={2} size="small" bordered labelStyle={{ width: 120, background: '#fafafa' }}>
            <Descriptions.Item label="User ID" span={2}><Text copyable>{basic.user_id}</Text></Descriptions.Item>
            <Descriptions.Item label="邀请码"><Text copyable>{basic.invitation_code || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="昵称">{basic.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{basic.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Google账号" span={2}>{basic.google_account || '-'}</Descriptions.Item>
            <Descriptions.Item label="Apple账号">{basic.apple_account || '-'}</Descriptions.Item>
            <Descriptions.Item label="Apple ID">
              <Text style={{ fontSize: 11 }} copyable={{ text: basic.apple_id || '' }}>
                {basic.apple_id ? basic.apple_id.slice(0, 20) + '...' : '-'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="平台">
              {(() => { const p = inferPlatform(basic.system, basic.device_id); return p === 'iOS' ? <Tag color="blue">iOS</Tag> : p === 'Android' ? <Tag color="green">Android</Tag> : <Tag color="default">-</Tag>; })()}
            </Descriptions.Item>
            <Descriptions.Item label="来源渠道">{basic.acquisition_channel || '-'}</Descriptions.Item>
            <Descriptions.Item label="国家">{basic.country_name_cn || basic.country_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="国家挖矿倍率">{basic.country_multiplier || '1.00'}</Descriptions.Item>
            <Descriptions.Item label="矿工等级倍率">{basic.miner_level_multiplier || '1.000000'}</Descriptions.Item>
            <Descriptions.Item label="用户等级"><Tag color="gold"><CrownOutlined /> Lv.{basic.user_level}</Tag></Descriptions.Item>
            <Descriptions.Item label="积分">{basic.user_points}</Descriptions.Item>
            <Descriptions.Item label="广告观看次数">{basic.total_ad_views}</Descriptions.Item>
            <Descriptions.Item label="注册IP">{basic.register_ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备ID" span={2}><Text style={{ fontSize: 11 }}>{basic.device_id || '-'}</Text></Descriptions.Item>
            <Descriptions.Item label="GAID">{basic.gaid || '-'}</Descriptions.Item>
            <Descriptions.Item label="IDFA">{basic.idfa || '-'}</Descriptions.Item>
            <Descriptions.Item label="ATT授权状态">
              {basic.att_status != null ? (attLabels[basic.att_status] ?? String(basic.att_status)) : <Text type="secondary">未记录</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="ATT更新时间">{fmtTime(basic.att_consent_updated_at)}</Descriptions.Item>
            <Descriptions.Item label="应用版本">{basic.app_version || '-'}</Descriptions.Item>
            <Descriptions.Item label="累计签到天数"><Text style={{ color: '#13c2c2', fontWeight: 600 }}>{totalCheckinDays} 天</Text></Descriptions.Item>
            <Descriptions.Item label="实时挖矿速率" span={2}>
              <Text style={{ color: '#f7931a', fontWeight: 600 }}>{totalMiningRatePerSecond}</Text>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>BTC/s</Text>
            </Descriptions.Item>
            <Descriptions.Item label="账号状态">
              {basic.is_banned
                ? <Tag color="red">已禁用{basic.banned_at ? `（${fmtTime(basic.banned_at)}）` : ''}</Tag>
                : (() => { const m = statusMap[basic.user_status ?? ''] || { color: 'blue', label: '正常' }; return <Tag color={m.color}>{m.label}</Tag>; })()
              }
            </Descriptions.Item>
            <Descriptions.Item label="禁用原因">{basic.ban_reason || '-'}</Descriptions.Item>
            <Descriptions.Item label="最后登录">{fmtTime(basic.last_login_time)}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{fmtTime(basic.user_creation_time)}</Descriptions.Item>
          </Descriptions>

          <Divider />
          <Row gutter={12}>
            {[
              { label: '合约总数', value: contractStats.total_contracts, sub: `生效中 ${contractStats.active_contracts}`, color: '#faad14', bg: '#fffbe6' },
              { label: '付费合约', value: contractStats.paid_contracts, sub: `已过期 ${contractStats.expired_contracts}`, color: '#52c41a', bg: '#f6ffed' },
              { label: '订单总数', value: orderStats.total_orders, sub: `退款 ${orderStats.refund_count}`, color: '#1890ff', bg: '#e6f7ff' },
              { label: '消费总额', value: `$${parseFloat(orderStats.total_spent || '0').toFixed(2)}`, color: '#eb2f96', bg: '#fff0f6' },
            ].map((item, i) => (
              <Col span={6} key={i}>
                <Card size="small" style={{ textAlign: 'center', background: item.bg }}>
                  <div style={{ fontSize: 12, color: '#888' }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
                  {item.sub && <div style={{ fontSize: 11, color: '#52c41a' }}>{item.sub}</div>}
                </Card>
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab={<span><DollarOutlined /> 余额信息</span>} key="balance">
          <Descriptions column={2} size="small" bordered labelStyle={{ width: 130, background: '#fafafa' }}>
            <Descriptions.Item label="当前BTC余额" span={2}>
              <Text style={{ color: '#f7931a', fontSize: 18, fontWeight: 700 }}>{fmtBtc(basic.current_bitcoin_balance)} BTC</Text>
            </Descriptions.Item>
            <Descriptions.Item label="累计挖矿总量">
              <Text style={{ color: '#52c41a' }}>{fmtBtc(basic.bitcoin_accumulated_amount)} BTC</Text>
            </Descriptions.Item>
            <Descriptions.Item label="累计提现总额">
              <Text style={{ color: '#1890ff' }}>{fmtBtc(basic.total_withdrawal_amount)} BTC</Text>
            </Descriptions.Item>
            <Descriptions.Item label="邀请返利总额" span={2}>
              <Text style={{ color: '#722ed1' }}>{fmtBtc(basic.total_invitation_rebate)} BTC</Text>
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left" plain style={{ marginTop: 16 }}>近期BTC交易（最新20条）</Divider>
          {recentTxs.length === 0 ? <Empty description="暂无交易记录" /> : (
            <Table size="small" pagination={false} scroll={{ y: 260 }}
              dataSource={recentTxs} rowKey={(_: any, i?: number) => String(i)}
              components={{ header: { cell: ResizableTitle } }}
              columns={[
                {
                  title: '类型', dataIndex: 'transaction_type', key: 'tx_type',
                  width: txColWidths['tx_type'] || 110,
                  onHeaderCell: () => ({ width: txColWidths['tx_type'] || 110, onResize: handleTxResize('tx_type') }),
                  render: (v: string) => (
                    <Tag color={v === 'admin_add' ? 'green' : v === 'admin_deduct' ? 'red' : 'default'} style={{ fontSize: 11 }}>
                      {txTypeLabel[v] || v}
                    </Tag>
                  ),
                },
                {
                  title: '金额(BTC)', dataIndex: 'transaction_amount', key: 'tx_amount',
                  width: txColWidths['tx_amount'] || 125,
                  onHeaderCell: () => ({ width: txColWidths['tx_amount'] || 125, onResize: handleTxResize('tx_amount') }),
                  render: (v: string, r: any) => {
                    const isOut = r.transaction_type === 'withdrawal' || r.transaction_type === 'admin_deduct';
                    return <Text style={{ color: isOut ? '#ff4d4f' : '#52c41a' }}>{isOut ? '-' : '+'}{fmtBtc(v)}</Text>;
                  },
                },
                {
                  title: '余额(BTC)', dataIndex: 'balance_after', key: 'tx_balance',
                  width: txColWidths['tx_balance'] || 125,
                  onHeaderCell: () => ({ width: txColWidths['tx_balance'] || 125, onResize: handleTxResize('tx_balance') }),
                  render: (v: string | null) => v != null ? fmtBtc(v) : '-',
                },
                {
                  title: '描述', dataIndex: 'description', key: 'tx_desc', ellipsis: true,
                  width: txColWidths['tx_desc'] || undefined,
                  onHeaderCell: () => ({ width: txColWidths['tx_desc'] || 200, onResize: handleTxResize('tx_desc') }),
                },
                {
                  title: '时间', dataIndex: 'transaction_creation_time', key: 'tx_time',
                  width: txColWidths['tx_time'] || 148,
                  onHeaderCell: () => ({ width: txColWidths['tx_time'] || 148, onResize: handleTxResize('tx_time') }),
                  render: (v: string) => fmtTime(v),
                },
                {
                  title: '状态', dataIndex: 'transaction_status', key: 'tx_status',
                  width: txColWidths['tx_status'] || 65,
                  onHeaderCell: () => ({ width: txColWidths['tx_status'] || 65, onResize: handleTxResize('tx_status') }),
                  render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'error' ? 'red' : 'orange'} style={{ fontSize: 11 }}>{v}</Tag>,
                },
              ]}
            />
          )}

          <Divider orientation="left" plain style={{ marginTop: 16 }}>近期提现（最新5条）</Divider>
          {recentWithdrawals.length === 0 ? <Empty description="暂无提现记录" /> : (
            <Table size="small" pagination={false} dataSource={recentWithdrawals} rowKey={(_: any, i?: number) => String(i)}
              components={{ header: { cell: ResizableTitle } }}
              columns={[
                {
                  title: '申请金额', dataIndex: 'withdrawal_request_amount', key: 'wd_req',
                  width: wdColWidths['wd_req'] || 110,
                  onHeaderCell: () => ({ width: wdColWidths['wd_req'] || 110, onResize: handleWdResize('wd_req') }),
                  render: (v: string) => fmtBtc(v),
                },
                {
                  title: '到账金额', dataIndex: 'received_amount', key: 'wd_recv',
                  width: wdColWidths['wd_recv'] || 110,
                  onHeaderCell: () => ({ width: wdColWidths['wd_recv'] || 110, onResize: handleWdResize('wd_recv') }),
                  render: (v: string) => fmtBtc(v),
                },
                {
                  title: '状态', dataIndex: 'withdrawal_status', key: 'wd_status',
                  width: wdColWidths['wd_status'] || 80,
                  onHeaderCell: () => ({ width: wdColWidths['wd_status'] || 80, onResize: handleWdResize('wd_status') }),
                  render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'pending' ? 'orange' : 'red'}>{v}</Tag>,
                },
                {
                  title: '钱包地址', dataIndex: 'wallet_address', key: 'wd_wallet', ellipsis: true,
                  width: wdColWidths['wd_wallet'] || undefined,
                  onHeaderCell: () => ({ width: wdColWidths['wd_wallet'] || 200, onResize: handleWdResize('wd_wallet') }),
                },
                {
                  title: '时间', dataIndex: 'created_at', key: 'wd_time',
                  width: wdColWidths['wd_time'] || 148,
                  onHeaderCell: () => ({ width: wdColWidths['wd_time'] || 148, onResize: handleWdResize('wd_time') }),
                  render: (v: string) => fmtTime(v),
                },
              ]}
            />
          )}
        </TabPane>

        <TabPane tab={<span><TeamOutlined /> 邀请关系</span>} key="invitation">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="我的推荐人">
              {referrer ? (
                <Space>
                  <Tag color="purple">{referrer.referrer_user_id}</Tag>
                  <Text>{referrer.referrer_email || '未知邮箱'}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>（{fmtTime(referrer.invitation_creation_time)}）</Text>
                </Space>
              ) : <Text type="secondary">无推荐人（自然注册）</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="已邀请人数">
              <Badge count={invitedCount} showZero color="#722ed1" />
            </Descriptions.Item>
          </Descriptions>

          {invitedCount > 0 && (
            <>
              <Divider orientation="left" plain style={{ marginTop: 16 }}>已邀请用户（共 {invitedCount} 人）</Divider>
              <Table
                size="small"
                pagination={false}
                dataSource={invitedList}
                rowKey="user_id"
                components={{ header: { cell: ResizableTitle } }}
                columns={[
                  { title: 'User ID', dataIndex: 'user_id', key: 'inv_user_id',
                    width: inviteColWidths['inv_user_id'] || 180,
                    render: (v: string) => <Text copyable style={{ fontSize: 11 }}>{v}</Text>,
                    onHeaderCell: () => ({ width: inviteColWidths['inv_user_id'] || 180, onResize: handleInviteResize('inv_user_id') }),
                  },
                  { title: '邮箱', dataIndex: 'email', key: 'inv_email',
                    ellipsis: true,
                    width: inviteColWidths['inv_email'] || 220,
                    onHeaderCell: () => ({ width: inviteColWidths['inv_email'] || 220, onResize: handleInviteResize('inv_email') }),
                  },
                  { title: '邀请关系建立时间', dataIndex: 'invitation_creation_time', key: 'inv_time',
                    width: inviteColWidths['inv_time'] || 175,
                    render: (v: string) => fmtTime(v),
                    onHeaderCell: () => ({ width: inviteColWidths['inv_time'] || 175, onResize: handleInviteResize('inv_time') }),
                  },
                ]}
              />
            </>
          )}
        </TabPane>
      </Tabs>
    );
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────

  return (
    <div className="users-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>用户管理</h1>
        {btcPrice > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #ff6b35 0%, #f7931a 100%)',
            borderRadius: 8, padding: '4px 12px', boxShadow: '0 2px 8px rgba(247,147,26,0.35)'
          }}>
            <span style={{ fontSize: 15 }}>₿</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>
              ${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>USD 实时</span>
          </div>
        )}
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: '总用户数', value: stats.total ?? 0, prefix: <UserOutlined />, color: '#1890ff' },
          { title: '今日新增', value: stats.newToday ?? 0, prefix: <RiseOutlined />, suffix: '人', color: '#52c41a' },
          { title: '近3天活跃', value: stats.active ?? 0, prefix: <TeamOutlined />, suffix: '人', color: '#faad14' },
          { title: '本周新增', value: stats.newThisWeek ?? 0, prefix: <RiseOutlined />, suffix: '人', color: '#722ed1' },
          { title: 'iOS 用户', value: stats.iosCount ?? 0, suffix: '人', color: '#1890ff' },
          { title: 'Android 用户', value: stats.androidCount ?? 0, suffix: '人', color: '#52c41a' },
          { title: '邀请用户', value: stats.invitedCount ?? 0, suffix: '人', color: '#722ed1' },
          { title: '自然用户', value: stats.organicCount ?? 0, suffix: '人', color: '#13c2c2' },
          { title: '付费用户', value: stats.paidCount ?? 0, suffix: '人', color: '#faad14' },
        ].map((item, i) => (
          <Col xs={12} sm={8} lg={6} xl={4} key={i}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Statistic title={item.title} value={item.value} prefix={item.prefix} suffix={item.suffix}
                valueStyle={{ color: item.color, fontSize: 20 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Group compact>
            <Select value={searchField || ''} onChange={(v: string) => setSearchField(v)} style={{ width: 120 }}>
              <Option value="">全部字段</Option>
              <Option value="email">邮箱</Option>
              <Option value="user_id">User ID</Option>
              <Option value="google_account">Google账号</Option>
              <Option value="apple_account">Apple账号</Option>
              <Option value="apple_id">Apple ID</Option>
              <Option value="device_id">设备ID</Option>
              <Option value="idfa">IDFA</Option>
              <Option value="gaid">GAID</Option>
              <Option value="register_ip">注册IP</Option>
            </Select>
            <Input
              placeholder={searchField ? ({ email:'邮箱', user_id:'User ID', google_account:'Google账号', apple_account:'Apple账号', apple_id:'Apple ID', device_id:'设备ID', idfa:'IDFA', gaid:'GAID', register_ip:'注册IP' } as any)[searchField] || '关键词' : '搜索邮箱 / User ID / Google账号…'}
              prefix={<SearchOutlined />} style={{ width: 240 }}
              value={search} onChange={e => setSearch(e.target.value)} onPressEnter={handleSearch} />
          </Input.Group>
          <Select placeholder="系统平台" style={{ width: 120 }} value={systemFilter || undefined} allowClear
            onChange={(v: string) => { setSystemFilter(v || ''); setPage(1); loadList(1, search, status, v || '', acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder); }}>
            <Option value="iOS">iOS</Option>
            <Option value="Android">Android</Option>
          </Select>
          <Select placeholder="来源渠道" style={{ width: 120 }} value={acquisitionFilter || undefined} allowClear
            onChange={(v: string) => { setAcquisitionFilter(v || ''); setPage(1); loadList(1, search, status, systemFilter, v || '', countryFilter, levelFilter, sortField, sortOrder); }}>
            <Option value="invited">邀请注册</Option>
            <Option value="organic">自然安装</Option>
            <Option value="paid">付费推广</Option>
          </Select>
          <Select placeholder="用户状态" style={{ width: 140 }} value={status || undefined} allowClear
            onChange={(v: string) => { setStatus(v || ''); setPage(1); loadList(1, search, v || '', systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder); }}>
            <Option value="active within 3 days">近3天活跃</Option>
            <Option value="no login within 7 days">7天未登录</Option>
            <Option value="normal">正常</Option>
            <Option value="disabled">已禁用</Option>
          </Select>
          <Select placeholder="国家" style={{ width: 140 }} value={countryFilter || undefined} allowClear showSearch optionFilterProp="children"
            onChange={(v: string) => { setCountryFilter(v || ''); setPage(1); loadList(1, search, status, systemFilter, acquisitionFilter, v || '', levelFilter, sortField, sortOrder); }}>
            {countries.map(c => <Option key={c.country_code} value={c.country_code}>{c.country_name_cn || c.country_code}</Option>)}
          </Select>
          <Select placeholder="等级" style={{ width: 90 }} value={levelFilter || undefined} allowClear
            onChange={(v: string) => { setLevelFilter(v || ''); setPage(1); loadList(1, search, status, systemFilter, acquisitionFilter, countryFilter, v || '', sortField, sortOrder); }}>
            {[1,2,3,4,5,6,7,8,9,10].map(l => <Option key={l} value={String(l)}>Lv.{l}</Option>)}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} title="刷新数据">刷新</Button>
          {selectedRowKeys.length > 0 && (
            <Button danger icon={<DeleteOutlined />} loading={deleteLoading} onClick={handleBulkDelete}>
              删除所选（{selectedRowKeys.length}）
            </Button>
          )}
        </Space>

        <Table<UserRow>
          columns={mergedColumns}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={list}
          rowKey="user_id"
          loading={loading}
          scroll={{ x: 2500 }}
          onChange={handleTableChange}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            total, current: page, pageSize: 20, showSizeChanger: false,
            showQuickJumper: true, showTotal: (t: number) => `共 ${t} 条`,
            onChange: (p: number) => { setPage(p); loadList(p, search, status, systemFilter, acquisitionFilter, countryFilter, levelFilter, sortField, sortOrder); },
          }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title={
          detailData ? (
            <Space>
              <UserOutlined />
              <span>{detailData.basic.email || detailData.basic.user_id}</span>
              {detailData.basic.is_banned ? <Tag color="red">已禁用</Tag> : null}
            </Space>
          ) : '用户详情'
        }
        width={820}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        loading={detailLoading}
        extra={
          detailData ? (
            <Space>
              <Button size="small" type="primary" ghost icon={<PlusCircleOutlined />}
                style={{ borderColor: '#52c41a', color: '#52c41a' }}
                onClick={() => openBtcModal(detailData.basic as unknown as UserRow, 'add')}>加BTC</Button>
              <Button size="small" danger ghost icon={<MinusCircleOutlined />}
                onClick={() => openBtcModal(detailData.basic as unknown as UserRow, 'deduct')}>减BTC</Button>
              <Button size="small" icon={<PlusCircleOutlined />}
                style={{ borderColor: '#722ed1', color: '#722ed1' }}
                onClick={() => openPtModal(detailData.basic as unknown as UserRow, 'add')}>加积分</Button>
              <Button size="small" icon={<MinusCircleOutlined />}
                style={{ borderColor: '#fa8c16', color: '#fa8c16' }}
                onClick={() => openPtModal(detailData.basic as unknown as UserRow, 'deduct')}>减积分</Button>
              <Button size="small" icon={<InfoCircleOutlined />}
                onClick={() => openCountryModal(detailData.basic as unknown as UserRow)}>改国家</Button>
            </Space>
          ) : null
        }
      >
        {renderDetail()}
      </Drawer>

      {/* BTC 调整弹窗 */}
      <Modal
        title={
          <Space>
            {btcModalType === 'add'
              ? <><PlusCircleOutlined style={{ color: '#52c41a' }} /> 手动增加 BTC</>
              : <><MinusCircleOutlined style={{ color: '#ff4d4f' }} /> 手动减少 BTC</>}
          </Space>
        }
        open={btcModalOpen}
        onCancel={() => setBtcModalOpen(false)}
        onOk={handleBtcSubmit}
        confirmLoading={btcLoading}
        okText="确认操作"
        okButtonProps={{ danger: btcModalType === 'deduct' }}
        destroyOnClose
      >
        {btcTargetUser ? (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>操作用户：</Text>
              <Text strong>{btcTargetUser.email || btcTargetUser.user_id}</Text>
              <Text style={{ fontSize: 12 }}>当前余额：<Text style={{ color: '#f7931a' }}>{fmtBtc(btcTargetUser.current_bitcoin_balance)} BTC</Text></Text>
            </Space>
          </div>
        ) : null}
        <Form form={btcForm} layout="vertical">
          <Form.Item
            name="amount"
            label={`${btcModalType === 'add' ? '增加' : '减少'} BTC 数量`}
            rules={[
              { required: true, message: '请输入金额' },
              { validator: (_: any, v: number) => v > 0 ? Promise.resolve() : Promise.reject(new Error('金额必须大于0')) },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={0.000000001} step={0.00000001} precision={18}
              placeholder="输入BTC数量，如 0.00100000" addonAfter="BTC" />
          </Form.Item>
          <Form.Item name="reason" label="操作原因（必填）"
            rules={[{ required: true, message: '请填写操作原因' }]}>
            <Input.TextArea rows={3} placeholder="请详细说明操作原因，此内容将记录在交易日志中" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>
      {/* 积分调整弹窗 */}
      <Modal
        title={
          <Space>
            {ptModalType === 'add'
              ? <><PlusCircleOutlined style={{ color: '#722ed1' }} /> 手动增加积分</>
              : <><MinusCircleOutlined style={{ color: '#fa8c16' }} /> 手动减少积分</>}
          </Space>
        }
        open={ptModalOpen}
        onCancel={() => setPtModalOpen(false)}
        onOk={handlePtSubmit}
        confirmLoading={ptLoading}
        okText="确认操作"
        okButtonProps={{ style: ptModalType === 'add' ? { background: '#722ed1', borderColor: '#722ed1' } : { background: '#fa8c16', borderColor: '#fa8c16' } }}
        destroyOnClose
      >
        {ptTargetUser ? (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>操作用户：</Text>
              <Text strong>{ptTargetUser.email || ptTargetUser.user_id}</Text>
              <Text style={{ fontSize: 12 }}>当前积分：<Text style={{ color: '#722ed1' }}>{ptTargetUser.user_points} 分</Text></Text>
            </Space>
          </div>
        ) : null}
        <Form form={ptForm} layout="vertical">
          <Form.Item
            name="amount"
            label={`${ptModalType === 'add' ? '增加' : '减少'} 积分数量`}
            rules={[
              { required: true, message: '请输入积分数量' },
              { validator: (_: any, v: number) => v > 0 ? Promise.resolve() : Promise.reject(new Error('积分必须大于0')) },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} precision={0} placeholder="输入整数积分，如 100" addonAfter="分" />
          </Form.Item>
          <Form.Item name="reason" label="操作原因（必填）"
            rules={[{ required: true, message: '请填写操作原因' }]}>
            <Input.TextArea rows={3} placeholder="请详细说明操作原因，此内容将记录在积分流水中" maxLength={200} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 国家信息编辑弹窗 */}
      <Modal
        title={<Space><InfoCircleOutlined style={{ color: '#1890ff' }} /> 修改用户国家信息</Space>}
        open={countryModalOpen}
        onCancel={() => setCountryModalOpen(false)}
        onOk={handleCountrySubmit}
        confirmLoading={countryLoading}
        okText="确认修改"
        destroyOnClose
      >
        {countryTargetUser ? (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>操作用户：</Text>
              <Text strong>{countryTargetUser.email || countryTargetUser.user_id}</Text>
              <Text style={{ fontSize: 12 }}>当前国家：<Text style={{ color: '#1890ff' }}>{countryTargetUser.country_code || '-'}{countryTargetUser.country_name_cn ? `（${countryTargetUser.country_name_cn}）` : ''}</Text></Text>
            </Space>
          </div>
        ) : null}
        <Form form={countryForm} layout="vertical">
          <Form.Item
            name="country_code"
            label="国家代码（2-3位大写字母）"
            rules={[
              { required: true, message: '请输入国家代码' },
              { pattern: /^[A-Za-z]{2,3}$/, message: '格式：2-3位字母，如 CN、US、HK' },
            ]}
          >
            <Input placeholder="如 CN、US、HK、SG" maxLength={3} style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item
            name="country_name_cn"
            label="国家中文名称"
            rules={[{ required: true, message: '请输入国家中文名称' }]}
          >
            <Input placeholder="如 中国、美国、香港、新加坡" maxLength={50} />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>提示：修改后将自动同步该国家在系统中的挖矿倍率配置（若存在）</Text>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
