import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Input, Space, Tag, Row, Col, Statistic, Select, message } from 'antd';
import { SearchOutlined, UserOutlined, TeamOutlined, RiseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { usersApi } from '@/services/api/admin';
import ResizableTitle from '@/components/ResizableTitle';
import './styles.css';

const { Option } = Select;

interface UserRow {
  user_id: string;
  email: string;
  google_account: string | null;
  country_code: string | null;
  user_level: number;
  user_points: number;
  total_ad_views: number;
  system: string | null;
  user_status: string | null;
  last_login_time: string | null;
  user_creation_time: string;
  current_bitcoin_balance: string | null;
}

const statusMap: Record<string, { color: string; label: string }> = {
  'active within 3 days': { color: 'green', label: '近3天活跃' },
  'no login within 7 days': { color: 'orange', label: '7天未登录' },
  'disabled': { color: 'red', label: '已禁用' },
  'deleted': { color: 'default', label: '已删除' },
  'normal': { color: 'blue', label: '正常' },
};

const Users: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [stats, setStats] = useState<any>({});
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const handleResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: any) => {
    setColWidths(prev => ({ ...prev, [key]: size.width }));
  };

  const loadList = useCallback(async (p = page, s = search, st = status) => {
    try {
      setLoading(true);
      const res = await usersApi.list({ page: p, limit: 20, search: s || undefined, status: st || undefined });
      if (res?.success) {
        setList(res.data.list);
        setTotal(res.data.total);
      }
    } catch {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    usersApi.stats().then(res => { if (res?.success) setStats(res.data); });
    loadList(1, '', '');
  }, []);

  const handleSearch = () => { setPage(1); loadList(1, search, status); };

  const columns: ColumnsType<UserRow> = [
    { title: 'User ID', dataIndex: 'user_id', key: 'user_id', width: 160, ellipsis: true },
    { title: '邮箱', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: '国家', dataIndex: 'country_code', key: 'country_code', width: 80, render: v => v || '-' },
    { title: '等级', dataIndex: 'user_level', key: 'user_level', width: 70 },
    { title: '积分', dataIndex: 'user_points', key: 'user_points', width: 80 },
    { title: '广告观看', dataIndex: 'total_ad_views', key: 'total_ad_views', width: 90 },
    {
      title: '系统', dataIndex: 'system', key: 'system', width: 90,
      render: (v: string) => v === 'iOS' ? <Tag color="blue">iOS</Tag> : v === 'Android' ? <Tag color="green">Android</Tag> : <Tag color="default">-</Tag>
    },
    {
      title: '状态', dataIndex: 'user_status', key: 'user_status', width: 120,
      render: (v: string) => {
        const m = statusMap[v] || { color: 'default', label: v || '未知' };
        return <Tag color={m.color}>{m.label}</Tag>;
      }
    },
    { title: '最后登录', dataIndex: 'last_login_time', key: 'last_login_time', width: 160, render: v => v ? new Date(v).toLocaleString() : '-' },
    { title: '注册时间', dataIndex: 'user_creation_time', key: 'user_creation_time', width: 160, render: v => new Date(v).toLocaleDateString() },
  ];
  const mergedColumns = columns.map((col) => {
    const k = String((col as any).key ?? (col as any).dataIndex ?? '');
    const w = colWidths[k] || (col as any).width || 120;
    return { ...col, width: w, onHeaderCell: () => ({ width: w, onResize: handleResize(k) }) };
  });

  return (
    <div className="users-page">
      <h1 className="page-title">用户管理</h1>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="总用户数" value={stats.total ?? 0} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="今日新增" value={stats.newToday ?? 0} prefix={<RiseOutlined />} suffix="人" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="近3天活跃" value={stats.active ?? 0} prefix={<TeamOutlined />} suffix="人" valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title="本周新增" value={stats.newThisWeek ?? 0} prefix={<RiseOutlined />} suffix="人" valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>
      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="搜索邮箱 / User ID"
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onPressEnter={handleSearch}
          />
          <Select placeholder="用户状态" style={{ width: 160 }} value={status || undefined} allowClear onChange={v => { setStatus(v || ''); setPage(1); loadList(1, search, v || ''); }}>
            <Option value="active within 3 days">近3天活跃</Option>
            <Option value="no login within 7 days">7天未登录</Option>
            <Option value="normal">正常</Option>
            <Option value="disabled">已禁用</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        </Space>
        <Table<UserRow>
          columns={mergedColumns}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={list}
          rowKey="user_id"
          loading={loading}
          pagination={{ total, current: page, pageSize: 20, showSizeChanger: false, showQuickJumper: true, onChange: p => { setPage(p); loadList(p, search, status); } }}
        />
      </Card>
    </div>
  );
};

export default Users;
