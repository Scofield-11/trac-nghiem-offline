import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase } from '../api/supabaseClient';

function ChangePasswordModal({ show, onClose, user, profile, onProfileUpdated }) {
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirmPassRef = useRef(null);

  useEffect(() => {
    if (show && profile) {
      setFullName(profile.full_name || profile.username || '');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [show, profile]);

  if (!show) return null;

  const handleNewPassKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmPassRef.current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanFullName = fullName.trim();
    if (!cleanFullName) {
      return toast.warning('Họ và tên hiển thị không được để trống!');
    }

    const isChangingPassword = newPassword.length > 0 || confirmPassword.length > 0;
    if (isChangingPassword) {
      if (newPassword.length < 6) {
        return toast.warning('Mật khẩu mới phải có tối thiểu 6 ký tự!');
      }
      if (newPassword !== confirmPassword) {
        return toast.error('Mật khẩu xác nhận không khớp!');
      }
    }

    setLoading(true);
    try {
      // 1. Cập nhật Họ và tên trong bảng profiles
      if (user?.id && cleanFullName !== profile?.full_name) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({ full_name: cleanFullName })
          .eq('id', user.id);

        if (profileErr) throw profileErr;
      }

      // 2. Cập nhật user_metadata và mật khẩu (nếu có nhập) trong Supabase Auth
      const authUpdatePayload = {
        data: { full_name: cleanFullName },
      };
      if (isChangingPassword) {
        authUpdatePayload.password = newPassword;
      }

      const { error: authErr } = await supabase.auth.updateUser(authUpdatePayload);
      if (authErr) throw authErr;

      if (onProfileUpdated && profile) {
        onProfileUpdated({ ...profile, full_name: cleanFullName });
      }

      toast.success('✅ Đã cập nhật thông tin tài khoản!');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật thông tin lúc này!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1080, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden animate-in">
          <div className="modal-header modal-header-gradient">
            <h5 className="modal-title fw-bold">👤 Thông tin tài khoản & Mật khẩu</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body bg-light p-3 p-md-4">
              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">
                  Tên đăng nhập (Không thể thay đổi)
                </label>
                <input
                  type="text"
                  className="form-control bg-secondary-subtle text-muted"
                  value={profile?.username || ''}
                  disabled
                  readOnly
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">Họ và tên hiển thị</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nhập họ và tên..."
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <hr className="my-3" />
              <div className="small text-muted mb-2">
                <em>Để trống phần dưới nếu bạn chỉ muốn đổi tên hiển thị:</em>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small text-muted">Mật khẩu mới</label>
                <div className="input-group">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Tối thiểu 6 ký tự..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onKeyDown={handleNewPassKeyDown}
                    enterKeyHint="next"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={() => setShowPass(!showPass)}
                    tabIndex={-1}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label fw-bold small text-muted">Nhập lại mật khẩu mới</label>
                <input
                  ref={confirmPassRef}
                  type={showPass ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  enterKeyHint="done"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="modal-footer bg-white border-0 pt-0 pb-3 px-3 px-md-4 d-flex gap-2">
              <button
                type="button"
                className="btn btn-light border flex-grow-1"
                onClick={onClose}
                disabled={loading}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-accent flex-grow-1"
                disabled={loading}
              >
                {loading ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordModal;