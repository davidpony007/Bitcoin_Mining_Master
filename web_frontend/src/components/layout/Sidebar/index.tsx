import React from 'react';
import { Layout, Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  BarChartOutlined,
  DollarOutlined,
  ShoppingOutlined,
  GlobalOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FileTextOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import './styles.css';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: '数据分析',
    },
    {
      key: '/ads',
      icon: <DollarOutlined />,
      label: '广告数据',
    },
    {
      key: '/orders',
      icon: <ShoppingOutlined />,
      label: '订单管理',
    },
    {
      key: '/withdrawals',
      icon: <WalletOutlined />,
      label: '提现详情',
    },
    {
      key: '/geography',
      icon: <GlobalOutlined />,
      label: '地域分析',
    },
    {
      key: '/checkin',
      icon: <CalendarOutlined />,
      label: '签到数据',
    },
    {
      key: '/mining',
      icon: <ThunderboltOutlined />,
      label: '挖矿数据',
    },
    {
      key: '/points',
      icon: <TrophyOutlined />,
      label: '积分系统',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报表中心',
    },
    {
      key: '/datacenter',
      icon: <BarChartOutlined />,
      label: '数据中心',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <Sider width={220} className="sidebar">
      <div className="logo">
        <ThunderboltOutlined style={{ fontSize: 24 }} />
        <span>BTC Mining</span>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default Sidebar;
