import React, { useState, useEffect } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ExamMode from './components/ExamMode';
import LoginScreen from './components/LoginScreen';
import { supabase } from './api/supabaseClient';
import { clearAllExamCaches, syncAllDataForOffline, fetchQuestionReports } from './api/axiosConfig';

function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);

  const loadPendingReportsCount = async (role) => {
    if (role !== 'admin') return;
    try {
      const reports = await fetchQuestionReports();
      setPendingReportsCount(reports.filter((r) => r.status === 'pending').length);
    } catch {
      // Ignore if offline
    }
  };

  const fetchUserProfile = async (currentUser) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }
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

    const resolvedProfile = data || {
      id: currentUser.id,
      username: currentUser.email?.split('@')[0] || 'user',
      full_name: currentUser.user_metadata?.full_name || '',
      role: currentUser.user_metadata?.role || 'user',
      is_active: true,
    };

    setProfile(resolvedProfile);
    loadPendingReportsCount(resolvedProfile.role);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      fetchUserProfile(currentUser).finally(() => setAuthChecking(false));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserProfile(currentUser);
      } else {
        setProfile(null);
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
    clearAllExamCaches();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    toast.info('Đã đăng xuất!');
  };

  return (
    <div className="container-fluid py-3" style={{ maxWidth: '1140px' }}>
      <header className="mb-3">
        <div className="app-header-card bg-white p-2 p-sm-3 rounded-4 shadow-sm">
          {/* Hàng 1: Logo + Tên Web bên trái & Tên tài khoản bên phải */}
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
              <span className="badge bg-accent-light text-dark px-2 px-sm-3 py-2 rounded-pill text-truncate" style={{ maxWidth: '170px' }}>
                👤 {profile.full_name || profile.username}
                {profile.role === 'admin' && (
                  <strong className="ms-1" style={{ color: 'var(--accent)' }}>
                    (Admin)
                  </strong>
                )}
              </span>
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

      {authChecking ? null : !user ? (
        <LoginScreen
          onLoginSuccess={(loggedUser, loggedProfile) => {
            setUser(loggedUser);
            if (loggedProfile) setProfile(loggedProfile);
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
        />
      )}

      <ToastContainer position="top-center" autoClose={2200} theme="colored" hideProgressBar />
    </div>
  );
}

export default App;