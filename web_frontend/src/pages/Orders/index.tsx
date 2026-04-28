import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Input, Select, Modal, Form, message, DatePicker, Tag, Descriptions,
  Card, Statistic, Row, Col,
} from 'antd';
import { DeleteOutlined, PlusOutlined, ExportOutlined, SearchOutlined, EyeOutlined, TeamOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
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
}

interface PlanStat {
  product_name: string;
  product_price: string;
  user_cnt: number;
  plan_cnt: number;
}

interface SubStats {
  summary: {
    activeUsers: number;
    activePlans: number;
    cancelledUsers: number;
    cancelledPlans: number;
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
  renewing:                      { label: '续费中',   color: 'cyan'    },
  complete:                      { label: '已完成',   color: 'green'   },
  error:                         { label: '错误',     color: 'red'     },
  'refund request in progress':  { label: '退款中',   color: 'orange'  },
  'refund successful':           { label: '已退款',   color: 'default' },
  'refund rejected':             { label: '退款拒绝', color: 'volcano' },
};

const Orders: React.FC = () => {
  const [loading, setLoading]       = useState(false);
  const [list, setList]             = useState<OrderRow[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(10);
  const [searchKw, setSearchKw]     = useState('');        // 统一搜索：user_id / 订单号 / 流水号
  const [platform, setPlatform]     = useState('');
  const [orderType, setOrderType]   = useState('');
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
    pn: string, ct: string
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
        productName: pn || undefined,
        country: ct || undefined,
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
    fetchList(1, 10, '', '', new Date(Date.now() - 6*86400000).toISOString().slice(0, 10), new Date().toISOString().slice(0, 10), '', '', '');
    fetchSubStats();
  }, []);

  const doSearch = () => {
    setPage(1); setSelectedIds([]);
    fetchList(1, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, productNameFilter, countryFilter);
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
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, productNameFilter, countryFilter);
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
          fetchList(page, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, productNameFilter, countryFilter);
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
      fetchList(1, pageSize, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, productNameFilter, countryFilter);
    } catch { message.error('添加失败'); }
  };

  const exportCSV = () => {
    const headers = ['ID', '用户ID', '标题', '订单号', '实付金额', '国家', '流水号', '支付时间', '创建时间'];
    const rows = list.map(r => [
      r.id, r.user_id, r.product_name, r.payment_network_id, r.product_price,
      r.country_code || '', r.payment_gateway_id, fmtTime(r.payment_time), fmtTime(r.order_creation_time),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `orders_${dayjs().format('YYYYMMDD')}.csv`;
    a.click();
  };

  const renderSubType = (record: OrderRow) => {
    const sub = Number(record.sub_seq);
    const usr = Number(record.user_seq);
    if (sub === 1 && usr === 1)
      return <Tag color="green">&#x1F195;新用户首购</Tag>;
    if (sub === 1)
      return <Tag color="blue">&#x1F504;跨产品首购</Tag>;
    return <Tag color="orange">&#x267B;续订 #{sub}</Tag>;
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
    { title: '订单号', dataIndex: 'payment_network_id', key: 'payment_network_id', width: 200, ellipsis: true },
    {
      title: '实付金额', dataIndex: 'product_price', key: 'product_price', width: 90,
      render: (v: string) => <span style={{ color: '#faad14', fontWeight: 600 }}>{v}</span>,
    },
    {
      title: '国家', key: 'country_code', width: 90,
      render: (_: any, r: OrderRow) => r.country_name_cn || r.country_code || '-',
    },
    { title: '流水号', dataIndex: 'payment_gateway_id', key: 'payment_gateway_id', width: 200, ellipsis: true },
    { title: '支付时间', dataIndex: 'payment_time', key: 'payment_time', width: 160, render: fmtTime },
    { title: '创建时间', dataIndex: 'order_creation_time', key: 'order_creation_time', width: 160, render: fmtTime },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right',
      render: (_: any, record: OrderRow) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EyeOutlined />}
            onClick={() => { setSelected(record); setDetailVisible(true); }} />
          <Button size="small" type="link" danger icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)} />
        </Space>
      ),
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
      cancelledPlans: can?.plan_cnt  ?? 0,
    };
  });

  const planColumns: ColumnsType<typeof planTableData[0]> = [
    { title: '产品档位', dataIndex: 'product_name', key: 'product_name', width: 180,
      render: (v: string, r: any) => <span style={{ fontWeight: 600 }}>{v} <span style={{ color: '#faad14' }}>(${r.product_price})</span></span> },
    { title: '活跃用户数', dataIndex: 'activeUsers', key: 'activeUsers', width: 120, align: 'center' as const,
      render: (v: number) => <span style={{ color: '#52c41a', fontWeight: v > 0 ? 600 : 400 }}>{v}</span> },
    { title: '活跃订阅数', dataIndex: 'activePlans', key: 'activePlans', width: 120, align: 'center' as const,
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
        <Input placeholder="用户ID / 订单号 / 流水号" value={searchKw} onChange={e => setSearchKw(e.target.value)}
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
        <span>订阅：</span>
        <Select value={orderType || '全部'} onChange={v => setOrderType(v === '全部' ? '' : v)} style={{ width: 130 }}>
          <Option value="全部">全部</Option>
          <Option value="new_user_first">🆕 新用户首购</Option>
          <Option value="cross_product">🔄 跨产品首购</Option>
          <Option value="renewal">♻ 续订</Option>
        </Select>
        <Button type="primary" icon={<SearchOutlined />} onClick={doSearch}
          style={{ background: '#0dab9a', borderColor: '#0dab9a' }} />
      </div>

      {/* 操作按钮行 */}
      <Space style={{ marginBottom: 12 }}>
        <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete}
          disabled={selectedIds.length === 0}>
          批量删除{selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
        </Button>
        <Button type="primary" icon={<PlusOutlined />}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
          onClick={() => setAddVisible(true)}>添加</Button>
        <Button icon={<ExportOutlined />}
          style={{ background: '#13c2c2', borderColor: '#13c2c2', color: '#fff' }}
          onClick={exportCSV}>导出数据</Button>
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
        pagination={{
          total, current: page, pageSize,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: t => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p); setPageSize(ps); setSelectedIds([]);
            fetchList(p, ps, searchKw, platform, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), orderType, productNameFilter, countryFilter);
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
            <Descriptions.Item label="订单号" span={2}>{selected.payment_network_id}</Descriptions.Item>
            <Descriptions.Item label="实付金额">
              <span style={{ color: '#faad14', fontWeight: 600 }}>{selected.product_price}</span>
            </Descriptions.Item>
            <Descriptions.Item label="货币">{selected.currency_type}</Descriptions.Item>
            <Descriptions.Item label="国家">{selected.country_code || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={statusMap[selected.order_status]?.color}>
                {statusMap[selected.order_status]?.label || selected.order_status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="流水号" span={2}>{selected.payment_gateway_id}</Descriptions.Item>
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
          <Form.Item name="payment_gateway_id" label="流水号" rules={[{ required: true, message: '请输入流水号' }]}>
            <Input placeholder="GPA.xxxx 或 Apple流水号" />
          </Form.Item>
          <Form.Item name="payment_network_id" label="订单号" rules={[{ required: true, message: '请输入订单号' }]}>
            <Input placeholder="订单号" />
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
    </div>
  );
};

export default Orders;
