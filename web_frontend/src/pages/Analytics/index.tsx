import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Select, Table, Space, Tabs, Button, DatePicker,
         Typography } from 'antd';
import {
  UserOutlined, DollarOutlined, LineChartOutlined, FireOutlined,
  BarChartOutlined, DatabaseOutlined, SearchOutlined, ExportOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import dayjs from 'dayjs';
import 'react-resizable/css/styles.css';
import { analyticsApi, dataCenterApi } from '@/services/api/admin';

const { Option } = Select;
const { Text } = Typography;

// ─── 可调列宽组件 ────────────────────────────────────────────────
const ResizableTitle = (
  props: React.HTMLAttributes<any> & {
    onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    width: number;
  }
) => {
  const { onResize, width, ...restProps } = props;
  if (!width) return <th {...restProps} />;
  return (
    <Resizable
      width={width} height={0}
      handle={<span className="react-resizable-handle" onClick={(e) => e.stopPropagation()} />}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

// ─── 趋势分析 数据类型 ───────────────────────────────────────────
interface TrendItem {
  date: string;
  users: number;
  orders: number;
  revenue: number;
  checkins: number;
}

interface RankItem {
  country: string;
  users: number;
  revenue: number;
}

// ─── 每日汇总 数据类型 ───────────────────────────────────────────
interface DailyRow {
  date: string;
  totalSpend: number;
  googleSpend: number;
  applovinSpend: number;
  mintegralSpend: number;
  adNewUsers: number;
  newUsersM1: number;
  newUsersM2: number;
  newUsersM3: number;
  totalNewUsers: number;
  retentionRate: string | number;
  retentionRatePct: string | number;
  dau: number | string;
  cpa: number;
  adCpa: number;
  subOrders: number;
  subCost: number;
  subRate: string;
  salesAmount: number;
  subRevenue: number;
  arppu: number;
  cancelCount: number;
  cancelRate: string;
  renewalCount: number;
  renewalAmount: number;
  renewalRevenue: number;
  adCount: number;
  adPerUser: number | string;
  ecpm: number;
  adRevenue: number;
  totalRevenue: number;
  btcSentAmount: number;
  btcSentValue: number;
  btcAvgPrice: number | string;
  withdrawalBtcAmount: number;
  withdrawalBtcValue: number;
  actualCost: number;
  profitSent: number;
  profitWithdraw: number;
  roi: string;
  roiWithdraw: string;
}
interface BtcSummary {
  totalBtcBalance: number;
  totalBtcBalanceUsd: string;
  totalWithdrawn: number;
  totalWithdrawnUsd: string;
  btcPrice?: number;
}

// ─── 趋势分析 Tab ────────────────────────────────────────────────
const TrendTab: React.FC = () => {
  const [timeRange, setTimeRange] = useState<number>(7);
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [rankData, setRankData] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankColWidths, setRankColWidths] = useState<Record<string, number>>({});
  const handleRankResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    setRankColWidths(prev => ({ ...prev, [key]: size.width }));
  };

  const fetchData = (days: number) => {
    setLoading(true);
    Promise.all([
      analyticsApi.trend(days),
      analyticsApi.countryRank(),
    ]).then(([trendRes, rankRes]: any[]) => {
      setTrendData(trendRes?.data || []);
      setRankData(rankRes?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(timeRange); }, [timeRange]);

  const totalUsers = trendData.reduce((s, d) => s + (Number(d.users) || 0), 0);
  const totalOrders = trendData.reduce((s, d) => s + (Number(d.orders) || 0), 0);
  const totalRevenue = trendData.reduce((s, d) => s + (Number(d.revenue) || 0), 0);
  const totalCheckins = trendData.reduce((s, d) => s + (Number(d.checkins) || 0), 0);

  const getTrendOption = () => ({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: ['新增用户', '订单数', '签到人次'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: trendData.map(d => d.date) },
    yAxis: { type: 'value' },
    series: [
      { name: '新增用户', type: 'line', data: trendData.map(d => Number(d.users) || 0), smooth: true, itemStyle: { color: '#1890ff' } },
      { name: '订单数', type: 'line', data: trendData.map(d => Number(d.orders) || 0), smooth: true, itemStyle: { color: '#52c41a' } },
      { name: '签到人次', type: 'line', data: trendData.map(d => Number(d.checkins) || 0), smooth: true, itemStyle: { color: '#faad14' } },
    ]
  });

  const rankCols: ColumnsType<RankItem> = [
    {
      title: '排名', key: 'rank', width: rankColWidths['rank'] || 80,
      render: (_: any, __: any, i: number) => {
        const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];
        return <span style={{ color: i < 3 ? colors[i] : undefined, fontWeight: 'bold' }}>#{i + 1}</span>;
      },
      onHeaderCell: () => ({ width: rankColWidths['rank'] || 80, onResize: handleRankResize('rank') }),
    },
    {
      title: '国家/地区', dataIndex: 'country', key: 'country', width: rankColWidths['country'] || 150,
      onHeaderCell: () => ({ width: rankColWidths['country'] || 150, onResize: handleRankResize('country') }),
    },
    {
      title: '用户数', dataIndex: 'users', key: 'users', width: rankColWidths['users'] || 120,
      render: (v: number) => (Number(v) || 0).toLocaleString(),
      onHeaderCell: () => ({ width: rankColWidths['users'] || 120, onResize: handleRankResize('users') }),
    },
    {
      title: '收入', dataIndex: 'revenue', key: 'revenue', width: rankColWidths['revenue'] || 120,
      render: (v: number) => `$${(Number(v) || 0).toLocaleString()}`,
      onHeaderCell: () => ({ width: rankColWidths['revenue'] || 120, onResize: handleRankResize('revenue') }),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <span>时间范围：</span>
          <Select value={timeRange} onChange={(v) => setTimeRange(v)} style={{ width: 120 }}>
            <Option value={1}>今日</Option>
            <Option value={7}>近 7 天</Option>
            <Option value={30}>近 30 天</Option>
          </Select>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title={`新增用户（近${timeRange}天）`} value={totalUsers} prefix={<UserOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title={`订单数（近${timeRange}天）`} value={totalOrders} prefix={<LineChartOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title={`收入（近${timeRange}天）`} value={totalRevenue} prefix={<DollarOutlined />} precision={2} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card><Statistic title={`签到人次（近${timeRange}天）`} value={totalCheckins} prefix={<FireOutlined />} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
      </Row>

      <Card title="数据趋势" style={{ marginBottom: 24 }}>
        <ReactECharts option={getTrendOption()} style={{ height: 400 }} notMerge />
      </Card>

      <Card title="国家/地区排名（Top 20）" bordered={false}>
        <Table
          columns={rankCols}
          components={{ header: { cell: ResizableTitle } }}
          dataSource={rankData}
          rowKey="country"
          loading={loading}
          pagination={false}
        />
      </Card>
    </>
  );
};

// ─── 每日汇总 Tab ────────────────────────────────────────────────
const DailySummaryTab: React.FC = () => {
  const [data, setData] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<BtcSummary | null>(null);
  const [startDate, setStartDate] = useState<dayjs.Dayjs>(dayjs().subtract(7, 'day'));
  const [endDate, setEndDate]     = useState<dayjs.Dayjs>(dayjs());
  const [platform, setPlatform]   = useState('all');
  const [selectedRows, setSelectedRows] = useState<DailyRow[]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const handleColResize = (key: string) => (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    setColWidths(prev => ({ ...prev, [key]: size.width }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await dataCenterApi.dailyReport(
        startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), platform);
      setData(res?.data || []);
      setSummary(res?.summary || null);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const exportCSV = () => {
    const headers = ['日期','总消耗','Google','Axon','Mintegral','投放新增','邀请新增','自然量新增','总新增','次留数','次留率','DAU','CPA','投放CPA','首次订阅单数','首次订阅成本','首次订阅率','首次订阅金额','首次订阅实际收入','首次订阅用户平均订阅金额','取消订阅数','取消订阅率','续期数','续期金额','续期收入','广告数','人均广告数','ecpm','广告收入','总收入','送出BTC数量','送出价值','送币时单价','提现BTC数量','提现价值','成本(实际)','利润(送币后)','利润(提现后)','ROI(送币后)','ROI(提现后)'];
    const rows = (selectedRows.length ? selectedRows : data).map(r =>
      [r.date,r.totalSpend,r.googleSpend,r.applovinSpend,r.mintegralSpend,
       r.adNewUsers,r.newUsersM1,r.newUsersM2,r.totalNewUsers,
       r.retentionRate,r.retentionRatePct,r.dau,r.cpa,r.adCpa,r.subOrders,r.subCost,r.subRate,
       r.salesAmount,r.subRevenue,r.arppu,r.cancelCount,r.cancelRate,r.renewalCount,r.renewalAmount,
       r.renewalRevenue,r.adCount,r.adPerUser,r.ecpm,r.adRevenue,r.totalRevenue,
       r.btcSentAmount,r.btcSentValue,r.btcAvgPrice,
       r.withdrawalBtcAmount,r.withdrawalBtcValue,r.actualCost,r.profitSent,r.profitWithdraw,r.roi,r.roiWithdraw
      ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `daily_report_${startDate.format('YYYYMMDD')}_${endDate.format('YYYYMMDD')}.csv`;
    a.click();
  };

  const fmtN = (v: any) => (typeof v === 'number' ? v.toFixed(2) : v);

  const baseColumns: ColumnsType<DailyRow> = [
    { title: '日期',       dataIndex: 'date',          key: 'date',          fixed: 'left', width: 100,
      render: (v: string) => <span style={{ fontWeight: v === '总计' ? 700 : undefined }}>{v}</span> },
    { title: '总消耗',                   dataIndex: 'totalSpend',         key: 'totalSpend',         width: 88,  render: fmtN },
    { title: 'Google',                  dataIndex: 'googleSpend',        key: 'googleSpend',        width: 88,  render: fmtN },
    { title: 'Axon',                    dataIndex: 'applovinSpend',      key: 'applovinSpend',      width: 88,  render: fmtN },
    { title: 'Mintegral',               dataIndex: 'mintegralSpend',     key: 'mintegralSpend',     width: 88,  render: fmtN },
    { title: '投放新增',                 dataIndex: 'adNewUsers',         key: 'adNewUsers',         width: 80 },
    { title: '邀请新增',                 dataIndex: 'newUsersM1',         key: 'newUsersM1',         width: 80 },
    { title: '自然量新增',               dataIndex: 'newUsersM2',         key: 'newUsersM2',         width: 90 },
    { title: '总新增',                   dataIndex: 'totalNewUsers',      key: 'totalNewUsers',      width: 70 },
    { title: '次留数',                   dataIndex: 'retentionRate',      key: 'retentionRate',      width: 72 },
    { title: '次留率',                   dataIndex: 'retentionRatePct',   key: 'retentionRatePct',   width: 72 },
    { title: 'DAU',                     dataIndex: 'dau',                key: 'dau',                width: 70 },
    { title: 'CPA',                     dataIndex: 'cpa',                key: 'cpa',                width: 70,  render: fmtN },
    { title: '投放CPA',                  dataIndex: 'adCpa',              key: 'adCpa',              width: 80,  render: fmtN },
    { title: '首次订阅单数',              dataIndex: 'subOrders',          key: 'subOrders',          width: 105 },
    { title: '首次订阅成本',              dataIndex: 'subCost',            key: 'subCost',            width: 105, render: fmtN },
    { title: '首次订阅率',               dataIndex: 'subRate',            key: 'subRate',            width: 90 },
    { title: '首次订阅金额',              dataIndex: 'salesAmount',        key: 'salesAmount',        width: 105, render: fmtN },
    { title: '首次订阅实际收入',           dataIndex: 'subRevenue',         key: 'subRevenue',         width: 120, render: fmtN },
    { title: '首次订阅用户平均订阅金额',    dataIndex: 'arppu',              key: 'arppu',              width: 160, render: fmtN },
    { title: '取消订阅数',               dataIndex: 'cancelCount',        key: 'cancelCount',        width: 90 },
    { title: '取消订阅率',               dataIndex: 'cancelRate',         key: 'cancelRate',         width: 90 },
    { title: '续期数',                   dataIndex: 'renewalCount',       key: 'renewalCount',       width: 70 },
    { title: '续期金额',                 dataIndex: 'renewalAmount',      key: 'renewalAmount',      width: 80,  render: fmtN },
    { title: '续期收入',                 dataIndex: 'renewalRevenue',     key: 'renewalRevenue',     width: 80,  render: fmtN },
    { title: '广告数',                   dataIndex: 'adCount',            key: 'adCount',            width: 72 },
    { title: '人均广告数',               dataIndex: 'adPerUser',          key: 'adPerUser',          width: 90,  render: fmtN },
    { title: 'ecpm',                    dataIndex: 'ecpm',               key: 'ecpm',               width: 72,  render: fmtN },
    { title: '广告收入',                 dataIndex: 'adRevenue',          key: 'adRevenue',          width: 80,  render: fmtN },
    { title: '总收入',                   dataIndex: 'totalRevenue',       key: 'totalRevenue',       width: 80,  render: fmtN },
    { title: '送出BTC数量',              dataIndex: 'btcSentAmount',      key: 'btcSentAmount',      width: 110, render: (v: any) => (typeof v === 'number' ? v.toFixed(8) : v) },
    { title: '送出价值',                 dataIndex: 'btcSentValue',       key: 'btcSentValue',       width: 80,  render: fmtN },
    { title: '送币时单价',               dataIndex: 'btcAvgPrice',        key: 'btcAvgPrice',        width: 90,  render: fmtN },
    { title: '提现BTC数量',              dataIndex: 'withdrawalBtcAmount',key: 'withdrawalBtcAmount',width: 110, render: (v: any) => (typeof v === 'number' ? v.toFixed(8) : v) },
    { title: '提现价值',                 dataIndex: 'withdrawalBtcValue', key: 'withdrawalBtcValue', width: 80,  render: fmtN },
    { title: '成本(实际)',               dataIndex: 'actualCost',         key: 'actualCost',         width: 90,  render: fmtN },
    { title: '利润(送币后)',              dataIndex: 'profitSent',         key: 'profitSent',         width: 100, render: fmtN },
    { title: '利润(提现后)',              dataIndex: 'profitWithdraw',     key: 'profitWithdraw',     width: 100, render: fmtN },
    { title: 'ROI(送币后)',              dataIndex: 'roi',                key: 'roi',                width: 90 },
    { title: 'ROI(提现后)',              dataIndex: 'roiWithdraw',        key: 'roiWithdraw',        width: 90 },
  ];

  const columns = baseColumns.map(col => ({
    ...col,
    width: colWidths[col.key as string] ?? col.width,
    onHeaderCell: (column: any) => ({
      width: column.width,
      onResize: handleColResize(col.key as string),
    }),
  }));

  return (
    <>
      {/* 标题 + BTC 汇总 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>【每日统计（当日统计前一天的信息）】</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* 实时 BTC 价格——红框区域 */}
          {summary?.btcPrice != null && summary.btcPrice > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, #ff6b35 0%, #f7931a 100%)',
              borderRadius: 8, padding: '6px 14px', boxShadow: '0 2px 8px rgba(247,147,26,0.35)'
            }}>
              <span style={{ fontSize: 16 }}>₿</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>
                ${summary.btcPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11 }}>USD 实时</span>
            </div>
          )}
          {summary && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
              <span>
                <Text type="secondary">用户总剩余BTC数量：</Text><Text strong>{summary.totalBtcBalance.toFixed(18)}</Text>
                &nbsp;&nbsp;<Text type="secondary">用户总剩余BTC价値：</Text><Text strong>${summary.totalBtcBalanceUsd}</Text>
              </span>
              <span>
                <Text type="secondary">用户总提现BTC数量：</Text><Text strong>{summary.totalWithdrawn.toFixed(18)}</Text>
                &nbsp;&nbsp;<Text type="secondary">用户总提现BTC价値：</Text><Text strong>${summary.totalWithdrawnUsd}</Text>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 过滤栏 */}
      <Card style={{ marginBottom: 10 }} bodyStyle={{ padding: '8px 16px' }}>
        <Space wrap>
          <span>搜索：</span>
          <DatePicker value={startDate} onChange={d => d && setStartDate(d)} format="YYYYMMDD" style={{ width: 120 }} />
          <DatePicker value={endDate}   onChange={d => d && setEndDate(d)}   format="YYYY-MM-DD" style={{ width: 130 }} />
          <span>类型：</span>
          <Select value={platform} onChange={setPlatform} style={{ width: 110 }}>
            <Option value="all">全部</Option>
            <Option value="Android">Android</Option>
            <Option value="iOS">iOS</Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={fetchData} />
        </Space>
      </Card>

      {/* 操作按钮 */}
      <Space style={{ marginBottom: 10 }}>
        <Button onClick={fetchData}>缓存统计数据</Button>
        <Button type="primary" icon={<ExportOutlined />} onClick={exportCSV}>导出数据</Button>
      </Space>

      {/* 表格 */}
      <Table
        rowSelection={{ onChange: (_: any, rows: DailyRow[]) => setSelectedRows(rows) }}
        components={{ header: { cell: ResizableTitle } }}
        columns={columns}
        dataSource={data}
        rowKey="date"
        loading={loading}
        scroll={{ x: 4200, y: 540 }}
        pagination={{ pageSize: 100, pageSizeOptions: [10, 100], showSizeChanger: true, showTotal: t => `共 ${t} 条`, size: 'small' }}
        size="small"
        bordered
        style={{ fontSize: 12 }}
        rowClassName={r => r.date === '总计' ? 'total-row' : ''}
      />

    </>
  );
};

// ─── 主组件 ──────────────────────────────────────────────────────
const Analytics: React.FC = () => {
  const tabItems = [
    {
      key: 'daily',
      label: <span><DatabaseOutlined />每日汇总</span>,
      children: <DailySummaryTab />,
    },
    {
      key: 'trend',
      label: <span><BarChartOutlined />趋势分析</span>,
      children: <TrendTab />,
    },
  ];

  return (
    <div style={{ padding: '0 24px' }}>
      <h1 className="page-title">数据分析</h1>
      <Tabs defaultActiveKey="daily" items={tabItems} size="large" style={{ marginTop: -8 }} />
    </div>
  );
};

export default Analytics;
