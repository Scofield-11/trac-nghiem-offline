import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase, formatLoginEmail } from '../api/supabaseClient';

function LoginScreen({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const usernameInputRef = useRef(null);
  const fullNameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  const switchMode = (registerMode) => {
    setIsRegisterMode(registerMode);
    setPassword('');
    setConfirmPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
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
      const email = formatLoginEmail(cleanUsername);
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

  const handleRegister = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    if (!cleanUsername) {
      toast.warning('Vui lòng nhập Tên đăng nhập!');
      usernameInputRef.current?.focus();
      return;
    }
    if (/\s/.test(cleanUsername)) {
      toast.warning('Tên đăng nhập không được chứa khoảng trắng!');
      usernameInputRef.current?.focus();
      return;
    }
    if (password.length < 6) {
      toast.warning('Mật khẩu phải có tối thiểu 6 ký tự!');
      passwordInputRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp!');
      confirmPasswordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const email = formatLoginEmail(cleanUsername);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: cleanUsername,
            full_name: cleanFullName || cleanUsername,
            role: 'user',
          },
        },
      });

      if (error) {
        if (error.message?.toLowerCase().includes('already registered')) {
          throw new Error('Tên đăng nhập này đã tồn tại!');
        }
        throw error;
      }

      const newUser = data?.user;
      if (!newUser?.id) {
        throw new Error('Không thể khởi tạo tài khoản. Vui lòng thử lại!');
      }

      const newProfile = {
        id: newUser.id,
        username: cleanUsername,
        full_name: cleanFullName || cleanUsername,
        role: 'user',
        is_active: true,
      };

      await supabase.from('profiles').upsert(newProfile);

      toast.success('🎉 Đăng ký tài khoản thành công!');
      if (data?.session && onLoginSuccess) {
        onLoginSuccess(newUser, newProfile);
      } else {
        switchMode(false);
      }
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đăng ký tài khoản!');
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
          <div className="mobile-tab-switcher mb-4 bg-light">
            <button
              type="button"
              className={`btn mobile-tab-btn ${!isRegisterMode ? 'active' : ''}`}
              onClick={() => switchMode(false)}
              disabled={loading}
            >
              🔑 Đăng nhập
            </button>
            <button
              type="button"
              className={`btn mobile-tab-btn ${isRegisterMode ? 'active' : ''}`}
              onClick={() => switchMode(true)}
              disabled={loading}
            >
              ➕ Đăng ký
            </button>
          </div>

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
            <div className="mb-3">
              <label className="form-label fw-bold small text-muted">
                Tên đăng nhập (Username) *
              </label>
              <input
                ref={usernameInputRef}
                type="text"
                className="form-control form-control-lg rounded-3"
                placeholder="VD: hocvien01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isRegisterMode) fullNameInputRef.current?.focus();
                    else passwordInputRef.current?.focus();
                  }
                }}
                enterKeyHint="next"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                autoComplete="username"
                disabled={loading}
              />
            </div>

            {isRegisterMode && (
              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">Họ và tên hiển thị</label>
                <input
                  ref={fullNameInputRef}
                  type="text"
                  className="form-control form-control-lg rounded-3"
                  placeholder="VD: Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      passwordInputRef.current?.focus();
                    }
                  }}
                  enterKeyHint="next"
                  disabled={loading}
                />
              </div>
            )}

            <div className={isRegisterMode ? 'mb-3' : 'mb-4'}>
              <label className="form-label fw-bold small text-muted">Mật khẩu *</label>
              <div className="input-group">
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  className="form-control form-control-lg"
                  placeholder={isRegisterMode ? 'Tối thiểu 6 ký tự' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (isRegisterMode && e.key === 'Enter') {
                      e.preventDefault();
                      confirmPasswordInputRef.current?.focus();
                    }
                  }}
                  enterKeyHint={isRegisterMode ? 'next' : 'go'}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
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

            {isRegisterMode && (
              <div className="mb-4">
                <label className="form-label fw-bold small text-muted">Nhập lại mật khẩu *</label>
                <input
                  ref={confirmPasswordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  className="form-control form-control-lg rounded-3"
                  placeholder="Nhập lại mật khẩu..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  enterKeyHint="go"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-accent w-100 mobile-btn-tile"
              disabled={loading}
            >
              {loading
                ? '⏳ Đang xử lý...'
                : isRegisterMode
                ? '✅ Tạo Tài Khoản Mới'
                : '🚀 Đăng Nhập Ngay'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;