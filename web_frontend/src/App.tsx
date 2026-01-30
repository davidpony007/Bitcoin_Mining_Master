import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import Ads from './pages/Ads';
import Orders from './pages/Orders';
import Geography from './pages/Geography';
import CheckIn from './pages/CheckIn';
import Mining from './pages/Mining';
import Points from './pages/Points';
import Reports from './pages/Reports';
import DataCenter from './pages/DataCenter';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <Routes>
      {/* 登录页 */}
      <Route path="/login" element={<Login />} />
      
      {/* 主应用 */}
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="ads" element={<Ads />} />
        <Route path="orders" element={<Orders />} />
        <Route path="geography" element={<Geography />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="mining" element={<Mining />} />
        <Route path="points" element={<Points />} />
        <Route path="reports" element={<Reports />} />
        <Route path="datacenter" element={<DataCenter />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
