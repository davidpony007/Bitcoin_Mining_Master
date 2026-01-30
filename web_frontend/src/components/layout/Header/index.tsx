import React from 'react';
import { Layout, Avatar, Dropdown, Space } from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@store/hooks';
import { logout } from '@store/slices/authSlice';
import './styles.css';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const menuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntHeader className="header">
      <div className="header-content">
        <div className="header-left">
          <h2>Bitcoin Mining Master - 数据中心</h2>
        </div>
        <div className="header-right">
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space className="user-menu">
              <Avatar icon={<UserOutlined />} />
              <span>管理员</span>
            </Space>
          </Dropdown>
        </div>
      </div>
    </AntHeader>
  );
};

export default Header;
