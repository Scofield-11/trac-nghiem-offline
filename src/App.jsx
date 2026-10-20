import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ExamMode from './components/ExamMode';
import LoginScreen from './components/LoginScreen';
import ChangePasswordModal from './components/ChangePasswordModal';
import { supabase } from './api/supabaseClient';
import {
  clearAllExamCaches,
  syncAllDataForOffline,
  fetchQuestionReports,
  getCachedAuthUser,
  setCachedAuthUser,
  getCachedUserProfile,
  setCachedUserProfile,
} from './api/axiosConfig';

function App() {
  const [user, setUser] = useState(() => getCachedAuthUser());
  const [profile, setProfile] = useState(() => getCachedUserProfile());
  const [authChecking, setAuthChecking] = useState(() => !getCachedAuthUser());
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isHideHeader, setIsHideHeader] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  const loadPendingReportsCount = async (role) => {
    if (role !== 'admin' || !navigator.onLine) return;
    try {
      const reports = await fetchQuestionReports();
      setPendingReportsCount(reports.filter((r) => r.status === 'pending').length);
    } catch {
      // Ignore if offline
    }
  };

  const fetchUserProfile = async (currentUser) => {
    if (!currentUser) {
      if (navigator.onLine) {
        setProfile(null);
        setCachedUserProfile(null);
      }
      return;
    }

    const fallbackProfile = getCachedUserProfile() || {
      id: currentUser.id,
      username: currentUser.email?.split('@')[0] || 'user',
      full_name: currentUser.user_metadata?.full_name || '',
      role: currentUser.user_metadata?.role || 'user',
      is_active: true,
    };

    // Nếu đang Offline thì dùng ngay Profile trong máy, không gọi mạng tránh treo app
    if (!navigator.onLine) {
      setProfile(fallbackProfile);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (data && data.is_active === false) {
        await supabase.auth.signOut();
        clearAllExamCaches();
        setUser(null);
        setProfile(null);
        toast.error('Tài khoản của bạn đã bị khóa!');
        return;
      }

      const resolvedProfile = data || fallbackProfile;
      setProfile(resolvedProfile);
      setCachedUserProfile(resolvedProfile);
      loadPendingReportsCount(resolvedProfile.role);
    } catch {
      setProfile(fallbackProfile);
    }
  };

  useEffect(() => {
    // Nếu mở app khi đang Offline và đã có tài khoản lưu trong máy thì vào thẳng 0ms
    if (!navigator.onLine && getCachedAuthUser()) {
      setAuthChecking(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        if (currentUser) {
          setUser(currentUser);
          setCachedAuthUser(currentUser);
          return fetchUserProfile(currentUser);
        } else if (!navigator.onLine && getCachedAuthUser()) {
          // Giữ nguyên phiên Offline nếu mạng rớt làm refresh token thất bại
          return;
        } else {
          setUser(null);
          setProfile(null);
          setCachedAuthUser(null);
          setCachedUserProfile(null);
        }
      })
      .catch(() => {})
      .finally(() => setAuthChecking(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        setUser(currentUser);
        setCachedAuthUser(currentUser);
        fetchUserProfile(currentUser);
      } else if (event === 'SIGNED_OUT' && navigator.onLine) {
        setUser(null);
        setProfile(null);
        setCachedAuthUser(null);
        setCachedUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      return toast.warning('Thiết bị đang Offline. Bạn vẫn có thể làm các học phần đã lưu!');
    }
    setIsSyncing(true);
    try {
      const syncedList = await syncAllDataForOffline();
      if (profile?.role === 'admin') {
        await loadPendingReportsCount('admin');
      }
      setSyncTrigger((prev) => prev + 1);
      toast.success(`Đã cập nhật ${syncedList.length} học phần (Sẵn sàng dùng Offline)!`);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật dữ liệu!');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này?')) return;
    clearAllExamCaches();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsHideHeader(false);
    toast.info('Đã đăng xuất!');
  };

  return (
    <div className="container-fluid py-2 py-md-3" style={{ maxWidth: '1140px' }}>
      <ChangePasswordModal
        show={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        user={user}
        profile={profile}
        onProfileUpdated={(updatedProfile) => setProfile(updatedProfile)}
      />

      {/* Tự động ẩn toàn bộ Header khi đang làm bài, sửa đề hoặc xem lại câu sai để không bấm nhầm */}
      {!isHideHeader && (
        <header className="mb-3">
          <div className="app-header-card bg-white p-2 p-sm-3 rounded-4 shadow-sm">
            {/* Hàng 1: Logo + Tên Web bên trái & Nút tài khoản (bấm để đổi mật khẩu) bên phải */}
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div className="d-flex align-items-center gap-2">
                <img
                  src="/sea_15651557.ico"
                  alt="logo"
                  style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                />
                <h1 className="fw-bold fs-5 gradient-text mb-0">Thi Trắc Nghiệm</h1>
              </div>

              {user && profile && (
                <button
                  type="button"
                  className="btn badge bg-accent-light text-dark px-2 px-sm-3 py-2 rounded-pill text-truncate border-0"
                  style={{ maxWidth: '195px', minHeight: '34px' }}
                  onClick={() => setShowChangePassword(true)}
                  title="Bấm để đổi mật khẩu"
                >
                  👤 {profile.full_name || profile.username}
                  {profile.role === 'admin' && (
                    <strong className="ms-1" style={{ color: 'var(--accent)' }}>
                      (Admin)
                    </strong>
                  )}
                  <span className="ms-1 opacity-75">🔑</span>
                </button>
              )}
            </div>

            {/* Hàng 2: Cụm nút điều khiển chia cột đều đặn trên Mobile */}
            {user && profile && (
              <div className={`header-actions-grid mt-2 pt-2 border-top ${profile.role === 'admin' ? 'cols-3' : 'cols-2'}`}>
                <button
                  className="btn btn-outline-primary btn-header-action"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Tải dữ liệu mới nhất và lưu dùng Offline"
                >
                  {isSyncing ? '⏳ Đang tải...' : '🔄 Cập nhật'}
                </button>

                {profile.role === 'admin' && (
                  <button
                    className="btn btn-warning btn-header-action text-dark position-relative"
                    onClick={() => setShowAdminPanel(true)}
                  >
                    🛡️ Quản trị
                    {pendingReportsCount > 0 && (
                      <span className="badge rounded-pill bg-danger ms-1">
                        {pendingReportsCount}
                      </span>
                    )}
                  </button>
                )}

                <button className="btn btn-outline-danger btn-header-action" onClick={handleLogout}>
                  🚪 Đăng xuất
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {authChecking ? null : !user ? (
        <LoginScreen
          onLoginSuccess={(loggedUser, loggedProfile) => {
            setUser(loggedUser);
            setCachedAuthUser(loggedUser);
            if (loggedProfile) {
              setProfile(loggedProfile);
              setCachedUserProfile(loggedProfile);
            }
          }}
        />
      ) : (
        <ExamMode
          user={user}
          profile={profile}
          showAdminPanel={showAdminPanel}
          setShowAdminPanel={setShowAdminPanel}
          syncTrigger={syncTrigger}
          onReportsChanged={() => loadPendingReportsCount(profile?.role)}
          onFocusModeChange={setIsHideHeader}
        />
      )}

      <ToastContainer position="top-center" autoClose={2200} theme="colored" hideProgressBar />
    </div>
  );
}

export default App;