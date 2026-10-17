import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase, formatLoginEmail } from '../api/supabaseClient';

function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  // Khi đang ở ô Username và bấm Enter / nút Tiếp trên điện thoại -> Chuyển xuống ô Password
  const handleUsernameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.warning('Vui lòng nhập Tên đăng nhập!');
      usernameInputRef.current?.focus();
      return;
    }
    if (!password) {
      toast.warning('Vui lòng nhập Mật khẩu!');
      passwordInputRef.current?.focus();
      return;
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
    <div className="container py-4 py-md-5" style={{ maxWidth: '440px' }}>
      <div className="card shadow-lg border-0 rounded-4 overflow-hidden animate-in">
        <div className="card-header modal-header-gradient text-center py-4">
          <img
            src="/sea_15651557.ico"
            alt="logo"
            className="mb-2 bg-white rounded-circle p-1 shadow-sm"
            style={{ width: '54px', height: '54px', objectFit: 'contain' }}
          />
          <h4 className="fw-bold mb-0 text-white">Thi Trắc Nghiệm</h4>
        </div>

        <div className="card-body p-4 bg-white">
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold small text-muted">Tên đăng nhập (Username)</label>
              <input
                ref={usernameInputRef}
                type="text"
                className="form-control form-control-lg rounded-3"
                placeholder="VD: hocvien01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleUsernameKeyDown}
                enterKeyHint="next"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold small text-muted">Mật khẩu</label>
              <div className="input-group">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  className="form-control form-control-lg"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  enterKeyHint="go"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="btn btn-light border px-3"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
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