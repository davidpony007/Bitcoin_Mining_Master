import React, { useState } from 'react';
import { Card, Button, DatePicker, Table, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import dayjs from 'dayjs';
import 'react-resizable/css/styles.css';
import './styles.css';

const { RangePicker } = DatePicker;

// 可调整大小的列头组件
const ResizableTitle = (
  props: React.HTMLAttributes<any> & {
    onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    width: number;
  }
) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

interface DataType {
  key: string;
  date: string;
  totalCost: number;
  adNew: number;
  naturalNew: number;
  totalNew: string;
  retention: string;
  dau: number;
  cpa: number;
  adCpa: number;
  firstSubOrders: number;
  subCost: number;
  subRate: string;
  firstSubSales: number;
  firstSubRevenue: number;
  cancelSubs: number;
  cancelRate: string;
  renewOrders: number;
  renewAmount: number;
  renewRevenue: number;
  adImpressions: number;
  avgAdPerUser: number;
  ecpm: number;
  adRevenue: number;
  totalRevenue: number;
  btcSent: number;
  btcSentValue: number;
  btcSentAvgPrice: number;
  btcWithdraw: number;
  btcWithdrawValue: number;
  actualCost: number;
  profitMinusSent: number;
  profitMinusWithdraw: number;
  btcSentRoi: string;
  btcWithdrawRoi: string;
  arppu: number;
  revenue: number;
  profit: number;
  roi: string;
}

const DataCenter: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs('2026-01-22'),
    dayjs('2026-01-28')
  ]);

  // 列宽状态管理
  const [columns, setColumns] = useState<ColumnsType<DataType>>([
    { title: '日期', dataIndex: 'date', key: 'date', fixed: 'left', width: 110 },
    { title: '总消耗', dataIndex: 'totalCost', key: 'totalCost', width: 100 },
    { title: '投放新增', dataIndex: 'adNew', key: 'adNew', width: 100 },
    { title: '新增自然量', dataIndex: 'naturalNew', key: 'naturalNew', width: 110 },
    { title: '总新增', dataIndex: 'totalNew', key: 'totalNew', width: 90 },
    { title: '次留率', dataIndex: 'retention', key: 'retention', width: 90 },
    { title: 'DAU', dataIndex: 'dau', key: 'dau', width: 90 },
    { title: 'CPA', dataIndex: 'cpa', key: 'cpa', width: 80 },
    { title: '投放CPA', dataIndex: 'adCpa', key: 'adCpa', width: 100 },
    { title: '首次订阅单数', dataIndex: 'firstSubOrders', key: 'firstSubOrders', width: 120 },
    { title: '订阅成本', dataIndex: 'subCost', key: 'subCost', width: 100 },
    { title: '订阅率', dataIndex: 'subRate', key: 'subRate', width: 90 },
    { title: '首次订阅销售额', dataIndex: 'firstSubSales', key: 'firstSubSales', width: 130 },
    { title: '首次订阅实际收入', dataIndex: 'firstSubRevenue', key: 'firstSubRevenue', width: 140 },
    { title: '取消订阅数', dataIndex: 'cancelSubs', key: 'cancelSubs', width: 110 },
    { title: '取消订阅率', dataIndex: 'cancelRate', key: 'cancelRate', width: 110 },
    { title: '续期订单数', dataIndex: 'renewOrders', key: 'renewOrders', width: 110 },
    { title: '续期金额', dataIndex: 'renewAmount', key: 'renewAmount', width: 100 },
    { title: '续期实际收入', dataIndex: 'renewRevenue', key: 'renewRevenue', width: 120 },
    { title: '广告展现量', dataIndex: 'adImpressions', key: 'adImpressions', width: 110 },
    { title: '人均广告次数', dataIndex: 'avgAdPerUser', key: 'avgAdPerUser', width: 120 },
    { title: 'ECPM', dataIndex: 'ecpm', key: 'ecpm', width: 90 },
    { title: '广告收益', dataIndex: 'adRevenue', key: 'adRevenue', width: 100 },
    { title: '总收入', dataIndex: 'totalRevenue', key: 'totalRevenue', width: 100 },
    { title: '送出BTC数量', dataIndex: 'btcSent', key: 'btcSent', width: 120 },
    { title: '送币价值', dataIndex: 'btcSentValue', key: 'btcSentValue', width: 100 },
    { title: '送币平均价格', dataIndex: 'btcSentAvgPrice', key: 'btcSentAvgPrice', width: 120 },
    { title: '提现BTC数量', dataIndex: 'btcWithdraw', key: 'btcWithdraw', width: 130 },
    { title: '提现价值', dataIndex: 'btcWithdrawValue', key: 'btcWithdrawValue', width: 100 },
    { title: '总成本(实际)', dataIndex: 'actualCost', key: 'actualCost', width: 120 },
    { title: '减送币利润', dataIndex: 'profitMinusSent', key: 'profitMinusSent', width: 110 },
    { title: '减提现利润', dataIndex: 'profitMinusWithdraw', key: 'profitMinusWithdraw', width: 110 },
    { title: '送币ROI', dataIndex: 'btcSentRoi', key: 'btcSentRoi', width: 100 },
    { title: '提现ROI', dataIndex: 'btcWithdrawRoi', key: 'btcWithdrawRoi', width: 100 },
    { title: 'ARPPU', dataIndex: 'arppu', key: 'arppu', width: 90 },
    { title: '收入', dataIndex: 'revenue', key: 'revenue', width: 110 },
    { title: '利润', dataIndex: 'profit', key: 'profit', width: 110 },
    { title: 'ROI', dataIndex: 'roi', key: 'roi', width: 110 },
  ]);

  // 处理列宽调整
  const handleResize = (index: number) => (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    const newColumns = [...columns];
    newColumns[index] = {
      ...newColumns[index],
      width: size.width,
    };
    setColumns(newColumns);
  };

  // 合并列配置和调整功能
  const mergedColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column: any) => ({
      width: column.width,
      onResize: handleResize(index),
    }),
  }));

  const data: DataType[] = [
    {
      key: '1', date: '2026-01-22', totalCost: 2629.28, adNew: 2946, naturalNew: 33.30, totalNew: '32782',
      retention: '0.62%', dau: 8250, cpa: 0.93, adCpa: 124, firstSubOrders: 18.58, subCost: 4.21,
      subRate: '1737...', firstSubSales: 1488.10, firstSubRevenue: 12.00, cancelSubs: 10, cancelRate: '0.08%',
      renewOrders: 169, renewAmount: 2062.31, renewRevenue: 1752.96, adImpressions: 3831, avgAdPerUser: 11.50,
      ecpm: 6.72, adRevenue: 3870.37, totalRevenue: 7117, btcSent: 0.018, btcSentValue: 1600.38,
      btcSentAvgPrice: 60908.56, btcWithdraw: 0, btcWithdrawValue: 2726.89, actualCost: 3086.77,
      profitMinusSent: 4068.15, profitMinusWithdraw: 3578.89, btcSentRoi: '1.25', btcWithdrawRoi: '1.42',
      arppu: 0.08, revenue: 169, profit: 2062.31, roi: '1752.96',
    },
    {
      key: '2', date: '2026-01-23', totalCost: 2475.81, adNew: 2963, naturalNew: 33.33, totalNew: '32766',
      retention: '0.94%', dau: 8450, cpa: 0.93, adCpa: 106, firstSubOrders: 21.36, subCost: 3.39,
      subRate: '1742', firstSubSales: 1051.90, firstSubRevenue: 11.30, cancelSubs: 18, cancelRate: '0.15%',
      renewOrders: 167, renewAmount: 2468.13, renewRevenue: 1570.91, adImpressions: 3881, avgAdPerUser: 12.21,
      ecpm: 8.37, adRevenue: 3882.17, totalRevenue: 6634, btcSent: 0.017, btcSentValue: 1059.23,
      btcSentAvgPrice: 60638.17, btcWithdraw: 0, btcWithdrawValue: 3026.11, actualCost: 3086.17,
      profitMinusSent: 3578.89, profitMinusWithdraw: 3972.62, btcSentRoi: '1.48', btcWithdrawRoi: '1.62',
      arppu: 0.15, revenue: 167, profit: 2468.13, roi: '1570.91',
    },
    {
      key: '3', date: '2026-01-24', totalCost: 2479.86, adNew: 3102, naturalNew: 30.82, totalNew: '32464',
      retention: '0.80%', dau: 8680, cpa: 0.91, adCpa: 106, firstSubOrders: 23.61, subCost: 3.38,
      subRate: '1096', firstSubSales: 932.41, firstSubRevenue: 8.80, cancelSubs: 6, cancelRate: '0.04%',
      renewOrders: 178, renewAmount: 1880.24, renewRevenue: 1683.20, adImpressions: 4051, avgAdPerUser: 12.48,
      ecpm: 9.11, adRevenue: 3740.07, totalRevenue: 6335, btcSent: 0.017, btcSentValue: 1605.63,
      btcSentAvgPrice: 60683.74, btcWithdraw: 0, btcWithdrawValue: 2291.37, actualCost: 2271.38,
      profitMinusSent: 3472.62, profitMinusWithdraw: 3972.62, btcSentRoi: '1.38', btcWithdrawRoi: '1.42',
      arppu: 0.04, revenue: 178, profit: 1880.24, roi: '1683.20',
    },
  ];

  return (
    <div className="data-center-page">
      <h1 className="page-title">项目计数【当日项目1每一天/成本走势】</h1>
      
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <span style={{ fontWeight: 500 }}>筛选：</span>
          <RangePicker value={dateRange} onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])} format="YYYY/MM/DD" style={{ width: 250 }} />
          <span style={{ marginLeft: 20 }}>类型：</span>
          <span style={{ color: '#1890ff' }}>全部</span>
          <Button type="primary" style={{ backgroundColor: '#00bfbf', borderColor: '#00bfbf' }}>查询</Button>
          <Button type="default" style={{ marginLeft: 40 }}>查询详情</Button>
          <Button type="default" style={{ backgroundColor: '#00bfbf', color: 'white', borderColor: '#00bfbf' }}>查询广告数据</Button>
          <Button type="default">查询合计数据</Button>
        </Space>
        <div style={{ marginTop: 16, fontSize: 12, color: '#666' }}>
          <Space split="|" size="large">
            <span>用户最新使用订单号码：3.314105671611327</span>
            <span>用户最新接收订单号码：1.8026313326086365</span>
            <span>用户最新接收订单号码：8260223.4480</span>
            <span>用户最新接收订单号码：8165760.1679</span>
          </Space>
        </div>
      </Card>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button size="small">显示数量</Button>
        </div>
        <Table 
          columns={mergedColumns} 
          dataSource={data} 
          scroll={{ x: 5000, y: 600 }} 
          pagination={{ pageSize: 20, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条`, size: 'small' }} 
          size="small" 
          bordered 
          style={{ fontSize: 12 }}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
        />
      </Card>
    </div>
  );
};

export default DataCenter;
