// components/manager.tsx
import React, { useState, useEffect } from 'react';
import './manager.css';
import { 
  FiUserPlus,   // Thêm người dùng
  FiEdit,       // Sửa người dùng  
  FiTrash2,     // Xóa người dùng
  FiLock,       // Đổi mật khẩu
  FiRefreshCw,  // Làm mới
  FiX           // Đóng
} from 'react-icons/fi';
interface User {
  user_id: number;
  username: string;
  role: 'manager' | 'staff';
  is_active: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
}

interface CreateUserData {
  username: string;
  password: string;
  role: 'manager' | 'staff';
  full_name: string;
  email: string;
  phone: string;
}

interface UpdateUserData {
  username?: string;
  role?: 'manager' | 'staff';
  is_active?: string;
  full_name?: string;
  email?: string;
  phone?: string;
}

const Manager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Form states
  const [createForm, setCreateForm] = useState<CreateUserData>({
    username: '',
    password: '',
    role: 'staff',
    full_name: '',
    email: '',
    phone: ''
  });

  const [editForm, setEditForm] = useState<UpdateUserData>({});
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const API_URL = 'http://localhost:5000/api/users';

  // Auth headers
  const getAuthHeaders = () => {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  };

  // Fetch all users
  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(API_URL, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data.users || []);
      } else {
        throw new Error(result.message || 'Failed to fetch users');
      }
    } catch (err: any) {
      console.error('Fetch users error:', err);
      setError(err.message || 'Có lỗi xảy ra khi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Create user
  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(createForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to create user');
      }

      setSuccess('Tạo người dùng thành công!');
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        password: '',
        role: 'staff',
        full_name: '',
        email: '',
        phone: ''
      });
      fetchUsers(); // Refresh list
    } catch (err: any) {
      console.error('Create user error:', err);
      setError(err.message || 'Có lỗi xảy ra khi tạo người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Update user
  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/${selectedUser.user_id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editForm),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update user');
      }

      setSuccess('Cập nhật người dùng thành công!');
      setShowEditModal(false);
      setSelectedUser(null);
      setEditForm({});
      fetchUsers(); // Refresh list
    } catch (err: any) {
      console.error('Update user error:', err);
      setError(err.message || 'Có lỗi xảy ra khi cập nhật người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Change password
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/${selectedUser.user_id}/change-password`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          newPassword: passwordForm.newPassword
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to change password');
      }

      setSuccess('Đổi mật khẩu thành công!');
      setShowChangePasswordModal(false);
      setSelectedUser(null);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      console.error('Change password error:', err);
      setError(err.message || 'Có lỗi xảy ra khi đổi mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const deleteUser = async (userId: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa người dùng này?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete user');
      }

      setSuccess('Xóa người dùng thành công!');
      fetchUsers(); // Refresh list
    } catch (err: any) {
      console.error('Delete user error:', err);
      setError(err.message || 'Có lỗi xảy ra khi xóa người dùng');
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone
    });
    setShowEditModal(true);
  };

  // Open change password modal
  const openChangePasswordModal = (user: User) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowChangePasswordModal(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Effects
  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="manager-page">
      {/* Header */}
      <div className="manager-header">
        <h1>Quản lý người dùng</h1>
        <p className="manager-subtitle">Quản lý tài khoản nhân viên và quản lý</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="alert alert-error">
          <div className="alert-content">
            <span className="alert-icon">⚠️</span>
            {error}
          </div>
          <button className="alert-close" onClick={clearMessages}>×</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <div className="alert-content">
            <span className="alert-icon">✅</span>
            {success}
          </div>
          <button className="alert-close" onClick={clearMessages}>×</button>
        </div>
      )}

      {/* Actions */}
      <div className="manager-actions">
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
        >
          <FiUserPlus /> Thêm người dùng
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={fetchUsers}
          disabled={loading}
        >
          <FiRefreshCw /> Làm mới
        </button>
      </div>

      {/* Users Table */}
      <div className="manager-card">
        <div className="card-header">
          <h3>Danh sách người dùng</h3>
          <span className="total-count">{users.length} người dùng</span>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : users.length > 0 ? (
          <div className="table-responsive">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Vai trò</th>
                  <th>Email</th>
                  <th>Điện thoại</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td className="user-id">#{user.user_id}</td>
                    <td className="username">{user.username}</td>
                    <td className="full-name">{user.full_name || '-'}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                      </span>
                    </td>
                    <td className="email">{user.email || '-'}</td>
                    <td className="phone">{user.phone || '-'}</td>
                    <td>
                      <span className={`status-badge ${user.is_active}`}>
                        {user.is_active === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </td>
                    <td className="created-at">{formatDate(user.created_at)}</td>
                    <td className="actions">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => openEditModal(user)}
                        title="Sửa"
                      >
                        <FiEdit />
                      </button>
                      <button
                        className="btn-icon btn-password"
                        onClick={() => openChangePasswordModal(user)}
                        title="Đổi mật khẩu"
                      >
                        <FiLock />
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => deleteUser(user.user_id)}
                        title="Xóa"
                        disabled={loading}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-text">Không có người dùng nào</p>
            <p className="empty-hint">Nhấn "Thêm người dùng" để tạo người dùng mới</p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Tạo người dùng mới</h3>
              <button 
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={createUser} className="modal-form">
              <div className="form-group">
                <label className="form-label">Tên đăng nhập *</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                  required
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu *</label>
                <input
                  type="password"
                  className="form-input"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vai trò</label>
                <select
                  className="form-select"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({...createForm, role: e.target.value as 'manager' | 'staff'})}
                >
                  <option value="staff">Nhân viên</option>
                  <option value="manager">Quản lý</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Họ tên</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({...createForm, full_name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Điện thoại</label>
                <input
                  type="tel"
                  className="form-input"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Đang tạo...' : 'Tạo người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Sửa người dùng</h3>
              <button 
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={updateUser} className="modal-form">
              <div className="form-group">
                <label className="form-label">Tên đăng nhập</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.username || ''}
                  onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                  minLength={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Vai trò</label>
                <select
                  className="form-select"
                  value={editForm.role || 'staff'}
                  onChange={(e) => setEditForm({...editForm, role: e.target.value as 'manager' | 'staff'})}
                >
                  <option value="staff">Nhân viên</option>
                  <option value="manager">Quản lý</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select
                  className="form-select"
                  value={editForm.is_active || 'active'}
                  onChange={(e) => setEditForm({...editForm, is_active: e.target.value})}
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Họ tên</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email || ''}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Điện thoại</label>
                <input
                  type="tel"
                  className="form-input"
                  value={editForm.phone || ''}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Đổi mật khẩu</h3>
              <button 
                className="modal-close"
                onClick={() => setShowChangePasswordModal(false)}
              >
                <FiX />
              </button>
            </div>
            <form onSubmit={changePassword} className="modal-form">
              <div className="form-group">
                <label className="form-label">Mật khẩu mới *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  required
                  minLength={6}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowChangePasswordModal(false)}
                  disabled={loading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Đang đổi...' : 'Đổi mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Manager;