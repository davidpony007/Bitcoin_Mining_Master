import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Header from '../Header';
import Sidebar from '../Sidebar';
import './styles.css';

const { Content } = Layout;

const MainLayout: React.FC = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout className="main-layout">
      <Sidebar />
      <Layout>
        <Header />
        <Content className="main-content">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
