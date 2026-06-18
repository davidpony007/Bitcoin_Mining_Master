import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, message, DatePicker, Tag, Descriptions,
  Card, Statistic, Row, Col, Alert, Tooltip,
} from 'antd';
import { DeleteOutlined, PlusOutlined, ExportOutlined, SearchOutlined, EyeOutlined, TeamOutlined, FileTextOutlined, SyncOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'react-resizable/css/styles.css';
import { ordersApi } from '@/services/api/admin';

const { Option } = Select;


// ─── 可调列宽标题组件 ─────────────────────────────────────────────
const ResizableTitle = (
  props: React.HTMLAttributes<any> & {
    onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    width: number;
  }
) => {
  const { onResize, width, ...rest } = props;
  if (!width) return <th {...rest} />;
  return (
    <Resizable width={width} height={0}
      handle={<span className="react-resizable-handle" onClick={e => e.stopPropagation()} />}
      onResize={onResize} draggableOpts={{ enableUserSelectHack: false }}>
      <th {...rest} />
    </Resizable>
  );
};

interface OrderRow {
  id: number;
  user_id: string;
  email: string;
  google_account: string | null;
  apple_account: string | null;
  product_id: string;
  product_name: string;
  product_price: string;
  order_status: string;
  order_creation_time: string;
  payment_time: string | null;
  currency_type: string;
  country_code: string | null;
  country_name_cn: string | null;  // 来自 user_information 的中文国家名
  payment_gateway_id: string;
  payment_network_id: string;
  sub_seq: number | string;   // 该用户该产品第几次订阅（1=首购）
  user_seq: number | string;  // 该用户第几笔订单总
  has_prior_refund: number;   // 同用户同档位是否有更早的退款成功订单
}

interface PlanStat {
  product_name: string;
  product_price: string;
  user_cnt: number;
  plan_cnt: number;
  total_cnt?: number;
}

interface SubStats {
  summary: {
    activeUsers: number;
    activePlans: number;
    cancelledUsers: number;
    cancelledPlans: number;
    refundedPlans: number;
  };
  activeByPlan: PlanStat[];
  cancelledByPlan: PlanStat[];
}

const PRODUCTS = [
  { id: 'p0499', name: 'contract_4.99',  price: '4.99'  },
  { id: 'p0699', name: 'contract_6.99',  price: '6.99'  },
  { id: 'p0999', name: 'contract_9.99',  price: '9.99'  },
  { id: 'p1999', name: 'contract_19.99', price: '19.99' },
  { id: 'p4999', name: 'contract_49.99', price: '49.99' },
  { id: 'p9999', name: 'contract_99.99', price: '99.99' },
];

const fmtTime = (v: string | null) =>
  v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '-';

const statusMap: Record<string, { label: string; color: string }> = {
  active:                        { label: '激活中',   color: 'blue'    },
  renewing:                      { label: '续订中',   color: 'cyan'    },
  renewed:                       { label: '已过期',   color: 'volcano' },
  plan_switch:                   { label: '已切换',   color: 'purple'  },
  complete:                      { label: '取消订阅', color: 'gold'    },
  expired:                       { label: '已过期',   color: 'volcano'  },
  'refund successful':           { label: '已退款',   color: 'default' },
  error:                         { label: 'error',    color: 'red'     },
};

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading]       = useState(false);
  const [list, setList]             = useState<OrderRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [searchKw, setSearchKw]     = useState('');        // 统一搜索：user_id / 订单号 / 流水号
  const [platform, setPlatform]     = useState('');
  const [orderType, setOrderType]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [productNameFilter, setProductNameFilter] = useState('');  // 标题筛选
  const [countryFilter, setCountryFilter]         = useState('');  // 国家筛选
  const [startDate, setStartDate]   = useState<dayjs.Dayjs>(() => dayjs(new Date().toISOString().slice(0, 10)).subtract(6, 'day'));
  const [endDate, setEndDate]       = useState<dayjs.Dayjs>(() => dayjs(new Date().toISOString().slice(0, 10)));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addVisible, setAddVisible]       = useState(false);
  const [selected, setSelected]     = useState<OrderRow | null>(null);
  const [addForm]                   = Form.useForm();
  const [subStats, setSubStats]     = useState<SubStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [sortOrder, setSortOrder]       = useState<'ascend' | 'descend' | null>(null);
  const [syncLoading, setSyncLoading]   = useState(false);
  const [syncVisible, setSyncVisible]   = useState(false);
  const [syncResult, setSyncResult]     = useState<any>(null);
  const [colWidths, setColWidths]   = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('col_widths_orders') || '{}'); } catch { return {}; }
  });
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    setColWidths(prev => {
      const next = { ...prev, [key]: size.width };
      localStorage.setItem('col_widths_orders', JSON.stringify(next));
      return next;
    });
  };

  const fetchList = useCallback(async (
    p: number, ps: number, kw: string, pl: string, sd: string, ed: string, ot: string,
    st: string, pn: string, ct: string, so: string = ''
  ) => {
    setLoading(true);
    try {
      const res: any = await ordersApi.list({
        page: p, limit: ps,
        search: kw || undefined,
        platform: pl || undefined,
        startDate: sd || undefined,
        endDate: ed || undefined,
        orderType: ot || undefined,
        status: st || undefined,
        productName: pn || undefined,
        country: ct || undefined,
        sortBy: so ? 'payment_time' : undefined,
        sortOrder: so || undefined,
      });
      if (res?.success) { setList(res.data.list); setTotal(res.data.total); }
    } catch { message.error('加载订单失败'); }
    setLoading(false);
  }, []);

  const fetchSubStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res: any = await ordersApi.subscriptionStats();
      if (res?.success) setSubStats(res.data);
    } catch { message.error('加载订阅统计失败'); }
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    fetchList(1, 10, '', '', new Date(Date.now() - 6*86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10), '', '', '', '', '');
    fetchSubStats();
  }, []);

  const doSearch = () => {
    setPage(1); setSelectedIds([]);
    fetchList(1, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
  };

  const handleBulkMarkInvalid = () => {
    if (selectedIds.length === 0) { message.warning('请先勾选要标记的订单'); return; }
    Modal.confirm({
      title: `确认将 ${selectedIds.length} 条订单标记为无效？`,
      content: '订单状态将变为 error（无效），实付金额清零，此操作不可撤销。',
      okText: '确认标记', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          const res: any = await ordersApi.bulkMarkInvalid(selectedIds);
          message.success(`已标记 ${res?.updated ?? selectedIds.length} 条订单为无效`);
          setSelectedIds([]);
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
        } catch { message.error('标记失败'); }
      },
    });
  };

  const handleMarkInvalid = (id: number) => {
    Modal.confirm({
      title: '确认将该订单标记为无效？',
      content: '订单状态将变为 error（无效），实付金额清零。',
      okText: '确认', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await ordersApi.bulkMarkInvalid([id]);
          message.success('已标记为无效');
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
        } catch { message.error('标记失败'); }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) { message.warning('请先选择要删除的订单'); return; }
    Modal.confirm({
      title: `确认删除 ${selectedIds.length} 条订单？`,
      okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await ordersApi.bulkDelete(selectedIds);
          message.success('删除成功');
          setSelectedIds([]);
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除该订单？', okText: '确认删除', okType: 'danger', cancelText: '取消',
      onOk: async () => {
        try {
          await ordersApi.deleteOne(id);
          message.success('删除成功');
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
        } catch { message.error('删除失败'); }
      },
    });
  };

  const handleAdd = async (values: any) => {
    try {
      const product = PRODUCTS.find(p => p.id === values.product_id)!;
      await ordersApi.add({
        ...values,
        product_name: product.name,
        product_price: product.price,
        payment_time: values.payment_time ? values.payment_time.format('YYYY-MM-DD HH:mm:ss') : null,
      });
      message.success('添加成功');
      setAddVisible(false);
      addForm.resetFields();
      fetchList(1, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
    } catch { message.error('添加失败'); }
  };

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      const res: any = await ordersApi.syncStatus({ platform: 'all', daysBack: 90 });
      if (res?.success) {
        setSyncResult(res.results);
        setSyncVisible(true);
        const total = (res.results?.android?.updated?.length || 0) + (res.results?.ios?.updated?.length || 0);
        const bothConfigError = res.results?.android?.configError && res.results?.ios?.configError;
        const eitherConfigError = res.results?.android?.configError || res.results?.ios?.configError;
        if (total > 0) {
          message.success(`同步完成，共更新 ${total} 条订单状态`);
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
          fetchSubStats();
        } else if (bothConfigError) {
          message.warning('平台凭证未配置，无法同步，详见弹窗说明');
        } else if (eitherConfigError) {
          message.info('部分平台凭证未配置，已同步可用平台');
        } else {
          message.info('同步完成，未发现状态变化');
        }
      } else {
        message.error('同步失败，请重试');
      }
    } catch {
      message.error('同步请求失败，请检查网络');
    }
    setSyncLoading(false);
  };

  const [exportLoading, setExportLoading] = useState(false);

  const exportCSV = async () => {
    setExportLoading(true);
    try {
      const res: any = await ordersApi.export({
        search: searchKw || undefined,
        status: statusFilter || undefined,
        platform: platform || undefined,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
        orderType: orderType || undefined,
        productName: productNameFilter || undefined,
        country: countryFilter || undefined,
      });
      if (!res?.success || !res.data) { message.error('导出失败'); return; }
      const escapeCell = (v: any) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const statusLabel = (s: string) => statusMap[s?.toLowerCase()]?.label || s || '-';
      const platformLabel = (gwId: string) => gwId?.startsWith('GPA.') ? 'Android' : 'iOS';
      const headers = ['ID', '用户ID', '邮箱', '平台', '标题', '实付金额($)', '国家', '状态', '订单号（购买令牌）', '流水号（订单ID）', '支付时间', '创建时间'];
      const rows = (res.data as any[]).map(r => [
        r.id, r.user_id, r.email || '',
        platformLabel(r.payment_gateway_id),
        r.product_name, r.product_price,
        r.country_name_cn || r.country_code || '',
        statusLabel(r.order_status),
        r.payment_network_id, r.payment_gateway_id,
        fmtTime(r.payment_time), fmtTime(r.order_creation_time),
      ].map(escapeCell).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = `orders_${startDate.format('YYYYMMDD')}_${endDate.format('YYYYMMDD')}.csv`;
      a.click();
      message.success(`已导出 ${res.data.length} 条订单`);
    } catch { message.error('导出失败，请重试'); }
    setExportLoading(false);
  };

  const renderSubType = (record: OrderRow) => {
    const sub = Number(record.sub_seq);
    const usr = Number(record.user_seq);
    const status = (record.order_status || '').toLowerCase();
    // 无效：error 状态
    if (status === 'error')
      return <Tag color="default">无效</Tag>;

    // 已退款重订：同档位存在更早的退款成功订单，且当前订单为活跃
    if (Number(record.has_prior_refund) > 0 && (status === 'active' || status === 'renewing'))
      return <Tag color="purple">🔁已退款重订</Tag>;
    // 仅当后端订单状态明确为 renewing 时展示“续订”标签，
    // 避免异常重复单（状态仍为 active）被误判为续订。
    if (status === 'renewing')
      return <Tag color="orange">&#x267B;续订 #{sub > 1 ? sub : 2}</Tag>;

    // sub > 1 且状态为 active：说明同一档位存在多条活跃单，属于异常重复订单
    if (sub > 1 && status === 'active')
      return <Tag color="red">⚠️异常重复单</Tag>;

    if (sub === 1 && usr === 1)
      return <Tag color="green">&#x1F195;新用户首购</Tag>;
    if (sub === 1)
      return <Tag color="blue">&#x1F504;跨产品首购</Tag>;
    return <Tag color="default">首购</Tag>;
  };

  const baseColumns: ColumnsType<OrderRow> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90, fixed: 'left' },
    { title: '用户id', dataIndex: 'user_id', key: 'user_id', width: 110 },
    {
      title: '平台', key: 'platform', width: 80,
      render: (_: any, r: OrderRow) => {
        const isAndroid = r.payment_gateway_id && r.payment_gateway_id.startsWith('GPA.');
        return isAndroid
          ? <Tag color="green">Android</Tag>
          : <Tag color="blue">iOS</Tag>;
      },
    },
    { title: '标题', dataIndex: 'product_name', key: 'product_name', width: 180 },
    {
      title: '订阅类型', key: 'sub_type', width: 130,
      render: (_: any, record: OrderRow) => renderSubType(record),
    },
    { title: '订单号（购买令牌）', dataIndex: 'payment_network_id', key: 'payment_network_id', width: 220, ellipsis: true },
    { title: '实付金额', dataIndex: 'product_price', key: 'product_price', width: 110,
      render: (v: string, r: OrderRow) => {
        if (r.order_status === 'plan_switch')
          return <span style={{ color: '#999', fontWeight: 400 }}><span style={{ textDecoration: 'line-through', marginRight: 4 }}>{v}</span><span style={{ color: '#ff7875', fontSize: 11 }}>$0(切换)</span></span>;
        if (r.order_status === 'error')
          return <span style={{ color: '#999' }}>0.00</span>;
        return <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span>;
      },
    },
    {
      title: '国家', key: 'country_code', width: 90,
      render: (_: any, r: OrderRow) => r.country_name_cn || r.country_code || '-',
    },
    { title: '流水号（订单ID）', dataIndex: 'payment_gateway_id', key: 'payment_gateway_id', width: 210, ellipsis: true },
    { title: '支付时间', dataIndex: 'payment_time', key: 'payment_time', width: 160, render: fmtTime,
      sorter: true, sortOrder: sortOrder },
    { title: '创建时间', dataIndex: 'order_creation_time', key: 'order_creation_time', width: 160, render: fmtTime },
    {
      title: '操作', key: 'action', width: 130, fixed: 'right',
      render: (_: any, record: OrderRow) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<InfoCircleOutlined />}
            onClick={() => navigate(`/users?uid=${record.user_id}`)}>详情</Button>
          <Button size="small" type="link" icon={<EyeOutlined />}
            onClick={() => { setSelected(record); setDetailVisible(true); }} />
          <Button size="small" type="link" danger icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)} />
          <Button size="small" type="link" danger
            title="标记无效"
            onClick={() => handleMarkInvalid(record.id)}
            style={{ color: '#999', padding: '0 2px', fontSize: 12 }}>⛔</Button>
        </Space>
      ),
    },
    {
      title: '状态', key: 'status', width: 120, fixed: 'right',
      render: (_: any, record: OrderRow) => {
        const config = statusMap[(record.order_status || '').toLowerCase()] || { label: record.order_status || '-', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
  ];

  const columns = baseColumns.map(col => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] ?? (col as any).width ?? 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  // 合并各档位活跃与取消数据为一张表
  const planTableData = PRODUCTS.map(p => {
    const act = subStats?.activeByPlan?.find(r => r.product_name === p.name);
    const can = subStats?.cancelledByPlan?.find(r => r.product_name === p.name);
    return {
      key: p.id,
      product_name: p.name,
      product_price: p.price,
      activeUsers:    act?.user_cnt  ?? 0,
      activePlans:    act?.plan_cnt  ?? 0,
      totalOrders:    act?.total_cnt  ?? 0,
      cancelledPlans: can?.plan_cnt  ?? 0,
    };
  });

  const planColumns: ColumnsType<typeof planTableData[0]> = [
    { title: '产品档位', dataIndex: 'product_name', key: 'product_name', width: 180,
      render: (v: string, r: any) => <span style={{ fontWeight: 600 }}>{v} <span style={{ color: '#faad14' }}>(${r.product_price})</span></span> },
    { title: '活跃用户数', dataIndex: 'activeUsers', key: 'activeUsers', width: 120, align: 'center' as const,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: v > 0 ? 600 : 400 }}>{v}</span> },
    { title: '历史总计订单数', dataIndex: 'totalOrders', key: 'totalOrders', width: 140, align: 'center' as const,
      render: (v: number) => <span style={{ color: '#1890ff', fontWeight: v > 0 ? 600 : 400 }}>{v}</span> },
    { title: '已结束/取消数', dataIndex: 'cancelledPlans', key: 'cancelledPlans', width: 140, align: 'center' as const,
      render: (v: number) => <span style={{ color: v > 0 ? '#ff4d4f' : '#999' }}>{v}</span> },
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">订单管理</h1>

      {/* 订阅统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" loading={statsLoading} style={{ borderLeft: '3px solid #52c41a' }}>
            <Statistic title="正在订阅用户数" value={subStats?.summary?.activeUsers ?? '-'}
              prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={statsLoading} style={{ borderLeft: '3px solid #1890ff' }}>
            <Statistic title="活跃订阅plan总数" value={subStats?.summary?.activePlans ?? '-'}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={statsLoading} style={{ borderLeft: '3px solid #ff4d4f' }}>
            <Statistic title="已取消订阅用户数" value={subStats?.summary?.cancelledUsers ?? '-'}
              prefix={<TeamOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={statsLoading} style={{ borderLeft: '3px solid #fa8c16' }}>
            <Statistic title="已取消plan总数" value={subStats?.summary?.cancelledPlans ?? '-'}
              prefix={<FileTextOutlined style={{ color: '#fa8c16' }} />}
              valueStyle={{ color: '#fa8c16', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" loading={statsLoading} style={{ borderLeft: '3px solid #722ed1' }}>
            <Statistic title="已退款Plan总数" value={subStats?.summary?.refundedPlans ?? '-'}
              prefix={<RollbackOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 24 }} />
          </Card>
        </Col>
      </Row>

      {/* 各档位统计明细 */}
      <Card size="small" title="各档位订阅统计" style={{ marginBottom: 16 }}
        extra={<span style={{ color: '#999', fontSize: 12 }}>已结束/取消 = 订阅周期已完成或主动取消</span>}>
        <Table
          columns={planColumns}
          dataSource={planTableData}
          loading={statsLoading}
          pagination={false}
          size="small"
          bordered
          rowKey="key"
        />
      </Card>

      {/* 搜索栏 */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span>搜索：</span>
        <DatePicker value={startDate} onChange={d => d && setStartDate(d)}
          format="YYYY-MM-DD" style={{ width: 130 }} allowClear={false} />
        <DatePicker value={endDate} onChange={d => d && setEndDate(d)}
          format="YYYY-MM-DD" style={{ width: 130 }} allowClear={false} />
        <Input placeholder="用户ID / 订单号（购买令牌）/ 流水号（订单ID）" value={searchKw} onChange={e => setSearchKw(e.target.value)}
          onPressEnter={doSearch} style={{ width: 220 }} allowClear />
        <span>标题：</span>
        <Select value={productNameFilter || '全部'}
          onChange={v => setProductNameFilter(v === '全部' ? '' : v)} style={{ width: 140 }}>
          <Option value="全部">全部</Option>
          {PRODUCTS.map(p => <Option key={p.name} value={p.name}>{p.name}</Option>)}
        </Select>
        <span>国家：</span>
        <Input placeholder="如 CN / 澳大利亚" value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          onPressEnter={doSearch} style={{ width: 130 }} allowClear />
        <span>平台：</span>
        <Select value={platform || '全部'} onChange={v => setPlatform(v === '全部' ? '' : v)} style={{ width: 100 }}>
          <Option value="全部">全部</Option>
          <Option value="iOS">iOS</Option>
          <Option value="Android">Android</Option>
        </Select>
        <span>状态：</span>
        <Select value={statusFilter || '全部'} onChange={v => setStatusFilter(v === '全部' ? '' : v)} style={{ width: 120 }}>
          <Option value="全部">全部</Option>
          <Option value="active">激活中</Option>
          <Option value="renewing">续订中</Option>
          <Option value="complete">取消订阅</Option>
          <Option value="expired">已过期</Option>
          <Option value="refund successful">已退款</Option>
        </Select>
        <span>订阅：</span>
        <Select value={orderType || '全部'} onChange={v => setOrderType(v === '全部' ? '' : v)} style={{ width: 130 }}>
          <Option value="全部">全部</Option>
          <Option value="new_user_first">🆕 新用户首购</Option>
          <Option value="cross_product">🔄 跨产品首购</Option>
          <Option value="renewal">♻ 续订</Option>
          <Option value="refund_resub">🔁 已退款重订</Option>
          <Option value="invalid">⛔ 无效</Option>
        </Select>
        <Button type="primary" icon={<SearchOutlined />} onClick={doSearch}
          style={{ background: '#0dab9a', borderColor: '#0dab9a' }} />
      </div>

      {/* 操作按钮行 */}
      <Space style={{ marginBottom: 12 }}>
        <Button
          danger
          icon={<WarningOutlined />}
          onClick={handleBulkMarkInvalid}
          disabled={selectedIds.length === 0}
          style={{ borderColor: '#ff7875' }}>
          批量标记无效{selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete}
          disabled={selectedIds.length === 0}>
          批量删除{selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
        </Button>
        <Button type="primary" icon={<PlusOutlined />}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
          onClick={() => setAddVisible(true)}>添加</Button>
        <Button icon={<ExportOutlined />}
          style={{ background: '#13c2c2', borderColor: '#13c2c2', color: '#fff' }}
          loading={exportLoading}
          onClick={exportCSV}>导出数据</Button>
        <Tooltip title="通过 Google Play / App Store API 检查退款和取消订阅状态，自动更新数据库">
          <Button
            icon={<SyncOutlined spin={syncLoading} />}
            loading={syncLoading}
            onClick={handleSync}
            style={{ background: '#722ed1', borderColor: '#722ed1', color: '#fff' }}>
            同步状态
          </Button>
        </Tooltip>
      </Space>

      {/* 表格 */}
      <Table<OrderRow>
        rowSelection={{ selectedRowKeys: selectedIds, onChange: keys => setSelectedIds(keys as number[]) }}
        components={{ header: { cell: ResizableTitle } }}
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        size="small"
        bordered
        onChange={(_, __, sorter: any, extra: any) => {
          if (extra?.action !== 'sort') return;
          const newOrder = sorter?.columnKey === 'payment_time' ? (sorter.order || null) : null;
          setSortOrder(newOrder);
          setPage(1); setSelectedIds([]);
          fetchList(1, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, newOrder || '');
        }}
        pagination={{
          total, current: page, pageSize,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p); setPageSize(ps); setSelectedIds([]);
            fetchList(p, ps, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, statusFilter, productNameFilter, countryFilter, sortOrder || '');
          },
        }}
      />

      {/* 详情弹窗 */}
      <Modal title="订单详情" open={detailVisible} onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>} width={640}>
        {selected && (
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="ID">{selected.id}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{selected.user_id}</Descriptions.Item>
            <Descriptions.Item label="邮箱" span={2}>{selected.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="Apple 账号" span={2}>{selected.apple_account || '-'}</Descriptions.Item>
            <Descriptions.Item label="标题" span={2}>{selected.product_name}</Descriptions.Item>
            <Descriptions.Item label="订单号（购买令牌）" span={2}>{selected.payment_network_id}</Descriptions.Item>
            <Descriptions.Item label="实付金额">
              <span style={{ color: '#faad14', fontWeight: 600 }}>{selected.product_price}</span>
            </Descriptions.Item>
            <Descriptions.Item label="货币">{selected.currency_type}</Descriptions.Item>
            <Descriptions.Item label="国家">{selected.country_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[(selected.order_status || '').toLowerCase()]?.color}>
                {statusMap[(selected.order_status || '').toLowerCase()]?.label || selected.order_status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="流水号（订单ID）" span={2}>{selected.payment_gateway_id}</Descriptions.Item>
            <Descriptions.Item label="支付时间" span={2}>{fmtTime(selected.payment_time)}</Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{fmtTime(selected.order_creation_time)}</Descriptions.Item>
            <Descriptions.Item label="订阅类型" span={2}>{renderSubType(selected)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 添加订单弹窗 */}
      <Modal title="添加订单" open={addVisible}
        onOk={() => addForm.submit()}
        onCancel={() => { setAddVisible(false); addForm.resetFields(); }}
        okText="确定" cancelText="取消" width={520}>
        <Form form={addForm} onFinish={handleAdd} layout="vertical" size="small">
          <Form.Item name="user_id" label="用户ID" rules={[{ required: true, message: '请输入用户ID' }]}>
            <Input placeholder="请输入用户ID" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="apple_account" label="Apple 账号">
            <Input placeholder="选填，Apple 登录账号" />
          </Form.Item>
          <Form.Item name="product_id" label="产品" rules={[{ required: true, message: '请选择产品' }]}>
            <Select placeholder="选择产品">
              {PRODUCTS.map(p => <Option key={p.id} value={p.id}>{p.name}（${p.price}）</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="payment_gateway_id" label="流水号（订单ID）" rules={[{ required: true, message: '请输入流水号（订单ID）' }]}>
            <Input placeholder="GPA.xxxx 或 Apple流水号（订单ID）" />
          </Form.Item>
          <Form.Item name="payment_network_id" label="订单号（购买令牌）" rules={[{ required: true, message: '请输入订单号（购买令牌）' }]}>
            <Input placeholder="订单号（购买令牌）" />
          </Form.Item>
          <Form.Item name="country_code" label="国家代码">
            <Input placeholder="如 CN, US" />
          </Form.Item>
          <Form.Item name="currency_type" label="货币" initialValue="USD">
            <Input />
          </Form.Item>
          <Form.Item name="order_status" label="状态" initialValue="active">
            <Select>
              {Object.entries(statusMap).map(([k, v]) => <Option key={k} value={k}>{v.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="payment_time" label="支付时间">
            <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 同步状态结果弹窗 */}
      <Modal
        title={<Space><SyncOutlined style={{ color: '#722ed1' }} /> 平台状态同步结果</Space>}
        open={syncVisible}
        onCancel={() => setSyncVisible(false)}
        footer={<Button type="primary" onClick={() => setSyncVisible(false)}>关闭</Button>}
        width={700}
      >
        {syncResult && (() => {
          const android = syncResult.android || {};
          const ios     = syncResult.ios     || {};
          const allUpdated = [...(android.updated || []), ...(ios.updated || [])];
          return (
            <div>
              {/* Android 摘要 */}
              <Card size="small" title={<span style={{ color: '#52c41a' }}>🤖 Google Play（Android）</span>}
                style={{ marginBottom: 12 }}>
                {android.configError
                  ? <Alert type="warning" showIcon icon={<WarningOutlined />}
                      message="未初始化" description={android.configError} />
                  : <>
                    <Row gutter={16}>
                      <Col span={6}><Statistic title="检查订单数" value={android.checked ?? 0} /></Col>
                      <Col span={6}><Statistic title="退款更新" value={android.refunded ?? 0}
                        valueStyle={{ color: android.refunded > 0 ? '#ff4d4f' : '#999' }} /></Col>
                      <Col span={6}><Statistic title="取消更新" value={android.cancelled ?? 0}
                        valueStyle={{ color: android.cancelled > 0 ? '#fa8c16' : '#999' }} /></Col>
                      <Col span={6}><Statistic title="API 错误" value={android.errors ?? 0}
                        valueStyle={{ color: android.errors > 0 ? '#ff7875' : '#999' }} /></Col>
                    </Row>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      实付金额修正为 0：<b>{android.priceFixed ?? 0}</b> 条
                    </div>
                  </>
                }
              </Card>

              {/* iOS 摘要 */}
              <Card size="small" title={<span style={{ color: '#1890ff' }}>🍎 App Store（iOS）</span>}
                style={{ marginBottom: 12 }}>
                {ios.configError
                  ? <Alert type="warning" showIcon icon={<WarningOutlined />}
                      message="未配置 Apple App Store Server API"
                      description={
                        <div>
                          <div>{ios.configError}</div>
                          <div style={{ marginTop: 6, fontSize: 12, color: '#666' }}>
                            请在 <a href="https://appstoreconnect.apple.com/access/api" target="_blank" rel="noreferrer">App Store Connect → Users & Access → Integrations → App Store Connect API</a> 生成 P8 私钥，并设置以上 4 个环境变量后重启后端。
                          </div>
                        </div>
                      } />
                  : <>
                    <Row gutter={16}>
                      <Col span={6}><Statistic title="检查订单数" value={ios.checked ?? 0} /></Col>
                      <Col span={6}><Statistic title="退款更新" value={ios.refunded ?? 0}
                        valueStyle={{ color: ios.refunded > 0 ? '#ff4d4f' : '#999' }} /></Col>
                      <Col span={6}><Statistic title="取消更新" value={ios.cancelled ?? 0}
                        valueStyle={{ color: ios.cancelled > 0 ? '#fa8c16' : '#999' }} /></Col>
                      <Col span={6}><Statistic title="API 错误" value={ios.errors ?? 0}
                        valueStyle={{ color: ios.errors > 0 ? '#ff7875' : '#999' }} /></Col>
                    </Row>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                      实付金额修正为 0：<b>{ios.priceFixed ?? 0}</b> 条
                    </div>
                  </>
                }
              </Card>

              {/* 退款兜底修复摘要 */}
              <Card size="small" title={<span style={{ color: '#13c2c2' }}>🛠 退款兜底修复</span>}
                style={{ marginBottom: 12 }}>
                <Row gutter={16}>
                  <Col span={6}><Statistic title="已退款订单巡检" value={syncResult?.repair?.refundedChecked ?? 0} /></Col>
                  <Col span={6}><Statistic title="停止挖矿任务" value={syncResult?.repair?.contractsStopped ?? 0}
                    valueStyle={{ color: (syncResult?.repair?.contractsStopped ?? 0) > 0 ? '#fa8c16' : '#999' }} /></Col>
                  <Col span={6}><Statistic title="追回执行(笔)" value={syncResult?.repair?.reclaimApplied ?? 0}
                    valueStyle={{ color: (syncResult?.repair?.reclaimApplied ?? 0) > 0 ? '#ff4d4f' : '#999' }} /></Col>
                  <Col span={6}><Statistic title="追回检查(交易)" value={syncResult?.repair?.reclaimChecked ?? 0} /></Col>
                </Row>
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  追回 BTC：<b>{syncResult?.repair?.reclaimedBtcTotal ?? 0}</b>，追回积分：<b>{syncResult?.repair?.reclaimedPointsTotal ?? 0}</b>
                </div>
              </Card>

              {/* 变更明细 */}
              {allUpdated.length > 0 && (
                <Card size="small" title={<span style={{ color: '#52c41a' }}><CheckCircleOutlined /> 已更新订单明细（{allUpdated.length} 条）</span>}>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={allUpdated.map((u: any, i: number) => ({ ...u, key: i }))}
                      columns={[
                        { title: '订单ID', dataIndex: 'id', width: 80 },
                        { title: '原状态', dataIndex: 'oldStatus', width: 120,
                          render: (v: string) => <Tag color={statusMap[v?.toLowerCase()]?.color || 'default'}>{statusMap[v?.toLowerCase()]?.label || v}</Tag> },
                        { title: '新状态', dataIndex: 'newStatus', width: 120,
                          render: (v: string) => <Tag color={statusMap[v?.toLowerCase()]?.color || 'default'}>{statusMap[v?.toLowerCase()]?.label || v}</Tag> },
                        { title: '原因', dataIndex: 'reason', ellipsis: true },
                      ]}
                    />
                  </div>
                </Card>
              )}
              {allUpdated.length === 0 && !android.configError && !ios.configError && (
                <Alert type="success" showIcon message="所有已检查订单状态均与平台一致，无需更新" />
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default Orders;
