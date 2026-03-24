import React, { useState, useEffect } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, InputNumber,
  Switch, message, Tag, Card, Statistic, Row, Col, Tooltip,
} from 'antd';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { paidProductsApi } from '@/services/api/admin';

interface PaidProduct {
  id: number;
  product_id: string;
  product_name: string;
  product_price: string;
  hashrate: string;
  product_contract_duration: string;
  ios_product_id: string;
  android_product_id: string;
  display_name: string;
  description: string;
  hashrate_raw: number;
  duration_days: number;
  sort_order: number;
  is_active: number;
}

const PaidProducts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<PaidProduct[]>([]);
  const [editing, setEditing] = useState<PaidProduct | null>(null);
  const [form] = Form.useForm();

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res: any = await paidProductsApi.list();
      // 公开接口返回 { success: true, products: [...] }
      const raw: any[] = res?.products ?? res?.data?.products ?? [];
      setList(raw as PaidProduct[]);
    } catch (e: any) {
      message.error('加载产品列表失败: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const openEdit = (record: PaidProduct) => {
    setEditing(record);
    form.setFieldsValue({
      display_name: record.display_name,
      description: record.description,
      ios_product_id: record.ios_product_id,
      android_product_id: record.android_product_id,
      hashrate_raw: record.hashrate_raw,
      duration_days: record.duration_days,
      sort_order: record.sort_order,
      is_active: record.is_active === 1,
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      await paidProductsApi.update(editing.id, {
        ...values,
        is_active: values.is_active ? 1 : 0,
      });
      message.success('保存成功');
      setEditing(null);
      loadProducts();
    } catch (e: any) {
      if (e?.errorFields) return; // validation error
      message.error('保存失败: ' + (e?.message ?? ''));
    }
  };

  const columns: ColumnsType<PaidProduct> = [
    { title: '排序', dataIndex: 'sort_order', key: 'sort_order', width: 60, sorter: (a, b) => a.sort_order - b.sort_order },
    {
      title: '内部ID', dataIndex: 'product_id', key: 'product_id', width: 90,
      render: v => <Tag color="blue">{v}</Tag>,
    },
    { title: '显示名称', dataIndex: 'display_name', key: 'display_name', width: 130 },
    {
      title: '价格', dataIndex: 'product_price', key: 'product_price', width: 80,
      render: v => <span style={{ color: '#52c41a', fontWeight: 600 }}>${v}</span>,
    },
    { title: '算力显示', dataIndex: 'hashrate', key: 'hashrate', width: 120 },
    {
      title: '每秒BTC产出', dataIndex: 'hashrate_raw', key: 'hashrate_raw', width: 150,
      render: v => <Tooltip title={`${v}`}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{Number(v).toExponential(4)}</span></Tooltip>,
    },
    { title: '时长(天)', dataIndex: 'duration_days', key: 'duration_days', width: 80 },
    { title: 'iOS商品ID', dataIndex: 'ios_product_id', key: 'ios_product_id', width: 140 },
    { title: 'Android商品ID', dataIndex: 'android_product_id', key: 'android_product_id', width: 140 },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => v === 1 ? <Tag color="success">上架</Tag> : <Tag color="default">下架</Tag>,
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right',
      render: (_, record) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
      ),
    },
  ];

  const activeCount = list.filter(p => p.is_active === 1).length;

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="产品总数" value={list.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="上架产品" value={activeCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Card
        title="付费产品配置"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadProducts} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="product_id"
          columns={columns}
          dataSource={list}
          loading={loading}
          pagination={false}
          scroll={{ x: 1100 }}
          size="small"
        />
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title={`编辑产品 — ${editing?.product_id ?? ''}`}
        open={!!editing}
        onOk={handleSave}
        onCancel={() => setEditing(null)}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true }]}>
            <Input placeholder="如 Starter Plan" />
          </Form.Item>
          <Form.Item name="description" label="产品描述">
            <Input.TextArea rows={2} placeholder="产品简短描述文案" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="ios_product_id" label="iOS App Store 商品ID">
                <Input placeholder="如 appstore04.99" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="android_product_id" label="Android Google Play 商品ID">
                <Input placeholder="如 p04.99" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="hashrate_raw" label="每秒BTC产出（挖矿算力）" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} step={1e-12} precision={12} placeholder="0.000000000004456" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="duration_days" label="合约时长（天）" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="sort_order" label="显示排序">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_active" label="上架状态" valuePropName="checked">
                <Switch checkedChildren="上架" unCheckedChildren="下架" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default PaidProducts;
