import React from 'react';
import { Form, Input, Button, Card } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@store/hooks';
import { setCredentials } from '@store/slices/authSlice';
import './styles.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const onFinish = (values: any) => {
    // 模拟登录
    dispatch(setCredentials({
      token: 'mock-token-' + Date.now(),
      user: {
        id: '1',
        username: values.username,
        email: 'admin@example.com',
      },
    }));
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <h1 className="login-title">Bitcoin Mining Master</h1>
        <h2 className="login-subtitle">数据中心管理系统</h2>
        
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
