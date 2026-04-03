import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, InputNumber, Button, Space, Typography, Statistic,
  Row, Col, Tag, message, Tooltip, Popconfirm, Spin, Alert,
} from 'antd';
import {
  ThunderboltOutlined, GlobalOutlined, SaveOutlined, ReloadOutlined, EditOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { rateConfigApi } from '@/services/api/admin';

const { Title, Text } = Typography;

interface CountryConfig {
  id: number;
  country_code: string;
  country_name: string;
  country_name_cn: string;
  mining_multiplier: number;
  is_active: boolean;
}

interface EditingRow {
  code: string;
  value: number;
}

const RateConfig: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baseHashrate, setBaseHashrate] = useState<number>(0.000000000000139);
  const [baseInput, setBaseInput] = useState<number | null>(null);
  const [editingBase, setEditingBase] = useState(false);
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [batchEdits, setBatchEdits] = useState<Record<string, number>>({});
  const [batchMode, setBatchMode] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await rateConfigApi.getConfig();
      const d = res?.data ?? res;
      setBaseHashrate(parseFloat(d.baseHashrate) || 0.000000000000139);
      setCountries(d.countries || []);
    } catch (e: any) {
      message.error('加载配置失败: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 基础速率保存 ──────────────────────────────────────────────────────────
  const handleSaveBase = async () => {
    const val = baseInput;
    if (!val || val <= 0) { message.warning('请输入有效的速率值'); return; }
    setSaving(true);
    try {
      const res: any = await rateConfigApi.updateBaseRate(val);
      const d = res?.data ?? res;
      message.success(d.message || '基础速率已更新');
      setBaseHashrate(val);
      setEditingBase(false);
      setBaseInput(null);
    } catch (e: any) {
      message.error('保存失败: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  // ── 单行国家倍率保存 ──────────────────────────────────────────────────────
  const handleSaveCountry = async (code: string, multiplier: number) => {
    if (isNaN(multiplier) || multiplier < 0.01) { message.warning('倍率至少 0.01'); return; }
    setSaving(true);
    try {
      const res: any = await rateConfigApi.updateCountry(code, multiplier);
      const d = res?.data ?? res;
      message.success(d.message || `${code} 倍率已更新`);
      setCountries(prev => prev.map(c => c.country_code === code ? { ...c, mining_multiplier: multiplier } : c));
      setEditingRow(null);
    } catch (e: any) {
      message.error('保存失败: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  // ── 批量保存 ──────────────────────────────────────────────────────────────
  const handleBatchSave = async () => {
    const updates = Object.entries(batchEdits).map(([code, multiplier]) => ({ code, multiplier }));
    if (updates.length === 0) { message.info('没有修改任何倍率'); return; }
    setSaving(true);
    try {
      const res: any = await rateConfigApi.batchUpdateCountries(updates);
      const d = res?.data ?? res;
      message.success(d.message || `已保存 ${updates.length} 个国家倍率`);
      // 合并到本地状态
      setCountries(prev => prev.map(c => {
        const edit = batchEdits[c.country_code];
        return edit !== undefined ? { ...c, mining_multiplier: edit } : c;
      }));
      setBatchEdits({});
      setBatchMode(false);
    } catch (e: any) {
      message.error('批量保存失败: ' + (e?.message ?? ''));
    } finally {
      setSaving(false);
    }
  };

  // ── 表格列定义 ────────────────────────────────────────────────────────────
  const columns: ColumnsType<CountryConfig> = [
    {
      title: '代码', dataIndex: 'country_code', key: 'country_code', width: 70,
      sorter: (a, b) => a.country_code.localeCompare(b.country_code),
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '国家（英文）', dataIndex: 'country_name', key: 'country_name', width: 160, ellipsis: true,
      sorter: (a, b) => a.country_name.localeCompare(b.country_name),
    },
    {
      title: '国家（中文）', dataIndex: 'country_name_cn', key: 'country_name_cn', width: 120, ellipsis: true,
      sorter: (a, b) => a.country_name_cn.localeCompare(b.country_name_cn, 'zh-CN'),
    },
    {
      title: '当前倍率',
      dataIndex: 'mining_multiplier',
      key: 'mining_multiplier',
      width: 110,
      sorter: (a, b) => parseFloat(String(a.mining_multiplier)) - parseFloat(String(b.mining_multiplier)),
      render: (v: number) => {
        const n = parseFloat(String(v));
        const color = n > 1.5 ? 'green' : n < 1 ? 'orange' : 'default';
        return <Tag color={color}>{n.toFixed(2)}x</Tag>;
      },
    },
    {
      title: '修改倍率',
      key: 'edit',
      width: 220,
      render: (_: any, record: CountryConfig) => {
        const code = record.country_code;
        const curVal = parseFloat(String(record.mining_multiplier));

        if (batchMode) {
          return (
            <InputNumber
              size="small"
              min={0.01} max={999.99} step={0.1} precision={2}
              defaultValue={curVal}
              style={{ width: 110 }}
              onChange={v => { if (v !== null) setBatchEdits(prev => ({ ...prev, [code]: v })); }}
            />
          );
        }

        if (editingRow?.code === code) {
          return (
            <Space>
              <InputNumber
                size="small" min={0.01} max={999.99} step={0.1} precision={2}
                value={editingRow.value}
                style={{ width: 100 }}
                onChange={v => { if (v !== null) setEditingRow({ code, value: v }); }}
              />
              <Button size="small" type="primary" icon={<CheckOutlined />} loading={saving}
                onClick={() => handleSaveCountry(code, editingRow.value)} />
              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingRow(null)} />
            </Space>
          );
        }

        return (
          <Button size="small" icon={<EditOutlined />}
            onClick={() => setEditingRow({ code, value: curVal })}>
            编辑
          </Button>
        );
      },
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: (v: boolean) => v ? <Tag color="success">启用</Tag> : <Tag color="default">禁用</Tag>,
    },
  ];

  const pendingCount = Object.keys(batchEdits).length;

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <ThunderboltOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        速率配置
      </Title>

      {/* ── 基础挖矿速率 ────────────────────────────────────────────── */}
      <Card
        title={<Space><ThunderboltOutlined /><span>基础挖矿速率（免费合约）</span></Space>}
        style={{ marginBottom: 24 }}
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">刷新</Button>
        }
      >
        <Alert
          type="info"
          showIcon
          message="修改基础速率后将立即同步到所有正在运行的免费合约（广告/签到/邀请合约），无需重启服务。"
          style={{ marginBottom: 16 }}
        />
        <Row gutter={24} align="middle">
          <Col>
            <Statistic
              title="当前基础速率 (BTC/秒)"
              value={baseHashrate.toExponential(4)}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff', fontFamily: 'monospace' }}
            />
          </Col>
          <Col>
            {editingBase ? (
              <Space>
                <InputNumber
                  style={{ width: 220, fontFamily: 'monospace' }}
                  value={baseInput ?? baseHashrate}
                  precision={18}
                  step={1e-15}
                  min={1e-18}
                  max={1}
                  onChange={v => setBaseInput(v)}
                  placeholder="例: 0.000000000000139"
                />
                <Popconfirm
                  title="确认更新基础速率？"
                  description={`将更新为 ${(baseInput ?? 0).toExponential(4)} BTC/s，并立即同步到所有活跃免费合约`}
                  onConfirm={handleSaveBase}
                  okText="确认更新"
                  cancelText="取消"
                >
                  <Button type="primary" icon={<SaveOutlined />} loading={saving}>保存生效</Button>
                </Popconfirm>
                <Button onClick={() => { setEditingBase(false); setBaseInput(null); }}>取消</Button>
              </Space>
            ) : (
              <Button icon={<EditOutlined />} onClick={() => { setEditingBase(true); setBaseInput(baseHashrate); }}>
                修改速率
              </Button>
            )}
          </Col>
        </Row>
        <Text type="secondary" style={{ marginTop: 12, display: 'block', fontSize: 12 }}>
          当前值：{baseHashrate}（精确值）&nbsp;|&nbsp;
          科学计数：{baseHashrate.toExponential(6)}
        </Text>
      </Card>

      {/* ── 国家倍率配置 ─────────────────────────────────────────────── */}
      <Card
        title={<Space><GlobalOutlined /><span>国家挖矿倍率配置</span></Space>}
        extra={
          <Space>
            {batchMode && pendingCount > 0 && (
              <Tag color="orange">{pendingCount} 项待保存</Tag>
            )}
            {batchMode ? (
              <>
                <Popconfirm
                  title={`确认批量更新 ${pendingCount} 个国家倍率？`}
                  onConfirm={handleBatchSave}
                  okText="确认"
                  cancelText="取消"
                  disabled={pendingCount === 0}
                >
                  <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={pendingCount === 0}>
                    批量保存生效
                  </Button>
                </Popconfirm>
                <Button onClick={() => { setBatchMode(false); setBatchEdits({}); }}>取消批量</Button>
              </>
            ) : (
              <Button icon={<EditOutlined />} onClick={() => setBatchMode(true)}>批量编辑</Button>
            )}
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="修改国家倍率后立即更新该国家所有用户的挖矿速率，并清除 Redis 缓存，无需重启服务。"
          style={{ marginBottom: 16 }}
        />
        <Spin spinning={loading}>
          <Table
            rowKey="country_code"
            columns={columns}
            dataSource={countries}
            pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `共 ${t} 个国家` }}
            scroll={{ y: 520 }}
            size="small"
          />
        </Spin>
      </Card>
    </div>
  );
};

export default RateConfig;
