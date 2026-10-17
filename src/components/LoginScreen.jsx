import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { supabase, formatLoginEmail } from '../api/supabaseClient';

function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      return toast.warning('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!');
    }

    setLoading(true);
    try {
      const email = formatLoginEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error('Tài khoản hoặc mật khẩu không chính xác!');
      }

      if (data?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileData && profileData.is_active === false) {
          await supabase.auth.signOut();
          return toast.error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin!');
        }

        toast.success('Đăng nhập thành công!');
        if (onLoginSuccess) onLoginSuccess(data.user, profileData);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đăng nhập!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: '460px' }}>
      <div className="card shadow-lg border-0 rounded-4 overflow-hidden animate-in">
        <div className="card-header modal-header-gradient text-center py-4">
          <img
            src="/sea_15651557.ico"
            alt="logo"
            className="mb-2 bg-white rounded-circle p-1 shadow-sm"
            style={{ width: '54px', height: '54px', objectFit: 'contain' }}
          />
          <h4 className="fw-bold mb-1 text-white">Thi Trắc Nghiệm Cloud</h4>
          <p className="small mb-0 text-white opacity-75">Đăng nhập để đồng bộ học phần & lịch sử</p>
        </div>

        <div className="card-body p-4 bg-white">
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold small text-muted">Tên đăng nhập (Username)</label>
              <input
                type="text"
                className="form-control form-control-lg rounded-3"
                placeholder="VD: hocvien01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold small text-muted">Mật khẩu</label>
              <input
                type="password"
                className="form-control form-control-lg rounded-3"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-accent w-100 mobile-btn-tile"
              disabled={loading}
            >
              {loading ? '⏳ Đang xác thực...' : '🚀 Đăng Nhập Ngay'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;