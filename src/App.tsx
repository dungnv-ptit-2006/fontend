import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CustomerManagement from '../src/components/customer';
import ProductManagement from '../src/components/Products';
import OrderManagement from '../src/components/oder';
import StockInManagement from '../src/components/stockIn';
import ReportManagement from '../src/components/Reports';
import Search from '../src/components/Serch';
import HistoryManager from '../src/components/History';
import Dashboard from '../src/components/Home';
import Manager from '../src/components/manager';
import Login from '../src/components/Login';
import Layout from './Layout/Layout';


export type UserRole = 'manager' | 'staff';

export interface User {
  user_id: number;
  username: string;
  role: UserRole;
  full_name: string;
  email?: string;
  phone?: string;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Kiểm tra token và user từ localStorage
  const checkAuth = () => {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');
    if (token && userStr) {
      setUser(JSON.parse(userStr));
      setIsAuthenticated(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Login
  const handleLogin = (token: string, user: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    setUser(user);
    setIsAuthenticated(true);
  };

  // Logout
  const handleLogout = () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', flexDirection: 'column', gap: '16px'
      }}>
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <Layout onLogout={handleLogout} user={user}>
        <Routes>
          {/* Chỉ manager mới có trang chủ */}
          {user.role === 'manager' && (
            <Route path="/home" element={<Dashboard />} />
            
          )}

          <Route path="/products" element={<ProductManagement />} />
          <Route path="/customers" element={<CustomerManagement />} />
          <Route path="/orders" element={<OrderManagement />} />
          
          {/* Chỉ manager mới thấy stockIn & reports */}
          {user.role === 'manager' && (
            <>
              <Route path="/stockIn" element={<StockInManagement />} />
              <Route path="/reports" element={<ReportManagement />} />
              <Route path="/manager" element={<Manager />} />
            </>
          )}

          <Route path="/serch" element={<Search />} />
          <Route path="/history" element={<HistoryManager />} />

          {/* Redirect mặc định */}
          <Route path="/" element={
            user.role === 'manager' ? <Navigate to="/home" replace /> 
                                     : <Navigate to="/customers" replace />
          } />
          <Route path="*" element={
            user.role === 'manager' ? <Navigate to="/home" replace /> 
                                     : <Navigate to="/customers" replace />
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;