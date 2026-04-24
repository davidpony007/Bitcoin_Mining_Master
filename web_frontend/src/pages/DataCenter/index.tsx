import React, { useState, useEffect } from 'react';
import { Card, Button, DatePicker, Table, Space, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import dayjs from 'dayjs';
import 'react-resizable/css/styles.css';
import './styles.css';
import { dataCenterApi } from '@/services/api/admin';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 可调整大小的列头组件
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
      width={width}
      height={0}
      handle={
        <span className="react-resizable-handle" onClick={(e) => e.stopPropagation()} />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

interface DailyRow {
  date: string;
  newUsers: number;
  dau: number;
  firstSubOrders: number;
  firstSubRevenue: number;
  adViews: number;
  adRewards: number;
  renewalCount: number;
  renewalAmount: number;
  withdrawals: number;
  withdrawalBtcAmount: number;
  checkins: number;
}

const DataCenter: React.FC = () => {
  const [data, setData] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const utcToday = new Date().toISOString().slice(0, 10);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(utcToday).subtract(13, 'day'),
    dayjs(utcToday),
  ]);
  const [platform, setPlatform] = useState('all');

  const fetchData = () => {
    setLoading(true);
    const [start, end] = dateRange;
    dataCenterApi.daily({
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      platform,
    }).then((res: any) => {
      setData(res?.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const [columns, setColumns] = useState<ColumnsType<DailyRow>>([
    { title: '日期', dataIndex: 'date', key: 'date', fixed: 'left', width: 110 },
    { title: '新增用户', dataIndex: 'newUsers', key: 'newUsers', width: 100 },
    { title: 'DAU', dataIndex: 'dau', key: 'dau', width: 90 },
    { title: '首次订阅单数', dataIndex: 'firstSubOrders', key: 'firstSubOrders', width: 120 },
    { title: '首次订阅金额', dataIndex: 'firstSubAmount', key: 'firstSubAmount', width: 120,
      render: (v: number) => `$${(Number(v) || 0).toFixed(2)}` },
    { title: '首次订阅收入', dataIndex: 'firstSubRevenue', key: 'firstSubRevenue', width: 120,
      render: (v: number) => `$${(Number(v) || 0).toFixed(2)}` },
    { title: '续期数', dataIndex: 'renewalCount', key: 'renewalCount', width: 90 },
    { title: '续期金额', dataIndex: 'renewalAmount', key: 'renewalAmount', width: 110,
      render: (v: number) => `$${(Number(v) || 0).toFixed(2)}` },
    { title: '续期收入', dataIndex: 'renewalRevenue', key: 'renewalRevenue', width: 110,
      render: (v: number) => `$${(Number(v) || 0).toFixed(2)}` },
    { title: '广告观看量', dataIndex: 'adViews', key: 'adViews', width: 110 },
    { title: '广告奖励积分', dataIndex: 'adRewards', key: 'adRewards', width: 120,
      render: (v: number) => Number(v) || 0 },
    { title: '提现单数', dataIndex: 'withdrawals', key: 'withdrawals', width: 100 },
    { title: 'BTC提现成功总数量', dataIndex: 'withdrawalBtcAmount', key: 'withdrawalBtcAmount', width: 160,
      render: (v: number) => (Number(v) || 0).toFixed(8) },
    { title: '签到人次', dataIndex: 'checkins', key: 'checkins', width: 100 },
  ]);

  const handleResize = (index: number) => (_e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], width: size.width };
    setColumns(newColumns);
  };

  const mergedColumns = columns.map((col, index) => ({
    ...col,
    onHeaderCell: (column: any) => ({
      width: column.width,
      onResize: handleResize(index),
    }),
  }));

  return (
    <div className="data-center-page">
      <h1 className="page-title">数据中心【每日业务数据汇总】</h1>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <span style={{ fontWeight: 500 }}>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
            format="YYYY/MM/DD"
            style={{ width: 250 }}
          />
          <span style={{ fontWeight: 500 }}>查询类型：</span>
          <Select value={platform} onChange={setPlatform} style={{ width: 110 }}>
            <Option value="all">全部</Option>
            <Option value="Android">Android</Option>
            <Option value="iOS">iOS</Option>
          </Select>
          <Button type="primary" style={{ backgroundColor: '#00bfbf', borderColor: '#00bfbf' }} onClick={fetchData}>
            查询
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={mergedColumns}
          dataSource={data}
          rowKey="date"
          loading={loading}
          scroll={{ x: 1400, y: 600 }}
          pagination={{ pageSize: 31, showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条`, size: 'small' }}
          size="small"
          bordered
          style={{ fontSize: 12 }}
          components={{ header: { cell: ResizableTitle } }}
        />
      </Card>
    </div>
  );
};

export default DataCenter;
