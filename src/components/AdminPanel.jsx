import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { supabase, tempSupabaseAdminClient, formatLoginEmail } from '../api/supabaseClient';
import {
  fetchQuestionReports,
  resolveAndFixQuestionReport,
  deleteQuestionReport,
} from '../api/axiosConfig';

function AdminPanel({ show, onClose, systemExams = [], onExamUpdated, onReportsChanged }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'users' | 'reports'
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedNewUserExams, setSelectedNewUserExams] = useState([]);
  const [creating, setCreating] = useState(false);

  const fullNameRef = useRef(null);
  const passwordRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [draftEdits, setDraftEdits] = useState({}); // { [reportId]: { question_text, options, correct_ans } }
  const [savingReportId, setSavingReportId] = useState(null);

  const fetchUsersAndAssignments = async () => {
    setLoadingUsers(true);
    try {
      const [profilesRes, assignRes] = await Promise.all([
        supabase.from('profiles').select('*').order('username', { ascending: true }),
        supabase.from('exam_assignments').select('user_id, exam_id'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (assignRes.error) throw assignRes.error;

      setUsers(profilesRes.data || []);

      const map = {};
      (assignRes.data || []).forEach((row) => {
        if (!map[row.user_id]) map[row.user_id] = [];
        map[row.user_id].push(Number(row.exam_id));
      });
      setAssignmentsMap(map);
    } catch (err) {
      toast.error('Lỗi tải danh sách tài khoản: ' + (err.message || ''));
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await fetchQuestionReports();
      setReports(data);
      const initialDrafts = {};
      data.forEach((r) => {
        initialDrafts[r.id] = {
          question_text: r.question_text,
          options: Array.isArray(r.options) ? [...r.options] : ['', '', '', ''],
          correct_ans: Number(r.current_correct_ans) || 1,
        };
      });
      setDraftEdits(initialDrafts);
      if (onReportsChanged) onReportsChanged();
    } catch (err) {
      toast.error('Lỗi tải danh sách báo lỗi: ' + (err.message || ''));
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchUsersAndAssignments();
      loadReports();
    }
  }, [show]);

  if (!show) return null;

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  const toggleNewUserExam = (examId) => {
    const id = Number(examId);
    setSelectedNewUserExams((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllNewUserExams = () => {
    if (selectedNewUserExams.length === systemExams.length) {
      setSelectedNewUserExams([]);
    } else {
      setSelectedNewUserExams(systemExams.map((e) => Number(e.id)));
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    if (!cleanUsername || !password) {
      return toast.warning('Vui lòng nhập Username và Mật khẩu!');
    }
    if (password.length < 6) {
      return toast.warning('Mật khẩu phải có tối thiểu 6 ký tự!');
    }

    setCreating(true);
    try {
      const email = formatLoginEmail(cleanUsername);

      const { data, error } = await tempSupabaseAdminClient.auth.signUp({
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

      if (error) throw error;

      const newUserId = data?.user?.id;
      if (!newUserId) {
        throw new Error('Không lấy được ID tài khoản mới tạo.');
      }

      await supabase.from('profiles').upsert({
        id: newUserId,
        username: cleanUsername,
        full_name: cleanFullName || cleanUsername,
        role: 'user',
        is_active: true,
      });

      if (selectedNewUserExams.length > 0) {
        const rows = selectedNewUserExams.map((examId) => ({
          user_id: newUserId,
          exam_id: Number(examId),
        }));
        const { error: assignErr } = await supabase.from('exam_assignments').insert(rows);
        if (assignErr) throw assignErr;
      }

      toast.success(`Đã tạo tài khoản [${cleanUsername}] và cấp ${selectedNewUserExams.length} học phần!`);
      setUsername('');
      setFullName('');
      setPassword('');
      setSelectedNewUserExams([]);
      fetchUsersAndAssignments();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo tài khoản!');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleAssignment = async (userId, examId) => {
    const numericExamId = Number(examId);
    const currentList = assignmentsMap[userId] || [];
    const isAssigned = currentList.includes(numericExamId);

    const updatedList = isAssigned
      ? currentList.filter((id) => id !== numericExamId)
      : [...currentList, numericExamId];

    setAssignmentsMap({
      ...assignmentsMap,
      [userId]: updatedList,
    });

    try {
      if (isAssigned) {
        const { error } = await supabase
          .from('exam_assignments')
          .delete()
          .eq('user_id', userId)
          .eq('exam_id', numericExamId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exam_assignments')
          .insert([{ user_id: userId, exam_id: numericExamId }]);
        if (error) throw error;
      }
    } catch (err) {
      setAssignmentsMap({
        ...assignmentsMap,
        [userId]: currentList,
      });
      toast.error('Lỗi cập nhật phân quyền: ' + (err.message || ''));
    }
  };

  const handleToggleUserActive = async (targetUser) => {
    const nextState = !targetUser.is_active;
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextState } : u))
    );

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: nextState })
      .eq('id', targetUser.id);

    if (error) {
      toast.error('Không thể cập nhật trạng thái tài khoản!');
      fetchUsersAndAssignments();
    } else {
      toast.info(`Đã ${nextState ? 'mở khóa' : 'khóa'} tài khoản ${targetUser.username}`);
    }
  };

  const handleDraftChange = (reportId, field, value, optIdx = null) => {
    setDraftEdits((prev) => {
      const current = prev[reportId] || { question_text: '', options: ['', '', '', ''], correct_ans: 1 };
      if (field === 'option' && optIdx !== null) {
        const nextOpts = [...current.options];
        nextOpts[optIdx] = value;
        return { ...prev, [reportId]: { ...current, options: nextOpts } };
      }
      return { ...prev, [reportId]: { ...current, [field]: value } };
    });
  };

  const handleFixAndResolve = async (report) => {
    const draft = draftEdits[report.id];
    if (!draft) return;

    setSavingReportId(report.id);
    try {
      await resolveAndFixQuestionReport({
        reportId: report.id,
        examId: report.exam_id,
        questionId: report.question_id,
        originalQuestionText: report.question_text,
        updatedQuestionText: draft.question_text,
        updatedOptions: draft.options,
        updatedCorrectAns: draft.correct_ans,
      });
      toast.success('✅ Đã cập nhật đáp án trong học phần và duyệt báo lỗi!');
      if (onExamUpdated) onExamUpdated();
      await loadReports();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật đáp án!');
    } finally {
      setSavingReportId(null);
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await deleteQuestionReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (onReportsChanged) onReportsChanged();
      toast.info('🗑️ Đã xóa thông báo lỗi!');
    } catch {
      toast.error('Không thể xóa thông báo này!');
    }
  };

  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1060, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-fullscreen-md-down">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
          <div className="modal-header modal-header-gradient">
            <h5 className="modal-title fw-bold">🛡️ Quản Trị Hệ Thống & Phân Quyền Học Phần</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body bg-light p-3 p-md-4">
            {/* Thanh chuyển 3 Tab trong Admin Panel gọn gàng trên Mobile */}
            <div className="admin-tab-switcher mb-3">
              <button
                type="button"
                className={`btn mobile-tab-btn ${activeTab === 'create' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('create');
                  setEditingUser(null);
                }}
              >
                ➕ Cấp TK
              </button>
              <button
                type="button"
                className={`btn mobile-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                👥 Học viên ({users.filter((u) => u.role !== 'admin').length})
              </button>
              <button
                type="button"
                className={`btn mobile-tab-btn position-relative ${activeTab === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveTab('reports')}
              >
                🔔 Báo lỗi
                {pendingCount > 0 && (
                  <span className="badge rounded-pill bg-danger ms-1">{pendingCount}</span>
                )}
              </button>
            </div>

            {activeTab === 'create' && (
              <form onSubmit={handleCreateStudent} className="bg-white p-3 p-md-4 rounded-4 shadow-sm">
                <h6 className="fw-bold text-primary mb-3">1. Thông tin đăng nhập</h6>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted">Username (*)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: nguyenvana"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      enterKeyHint="next"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          fullNameRef.current?.focus();
                        }
                      }}
                      required
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted">Họ và tên</label>
                    <input
                      ref={fullNameRef}
                      type="text"
                      className="form-control"
                      placeholder="VD: Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      enterKeyHint="next"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          passwordRef.current?.focus();
                        }
                      }}
                    />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label small fw-bold text-muted">Mật khẩu (*)</label>
                    <input
                      ref={passwordRef}
                      type="text"
                      className="form-control"
                      placeholder="Tối thiểu 6 ký tự"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      enterKeyHint="done"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="fw-bold text-primary mb-0">
                    2. Chọn học phần cấp ngay ({selectedNewUserExams.length}/{systemExams.length})
                  </h6>
                  {systemExams.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={handleSelectAllNewUserExams}
                    >
                      {selectedNewUserExams.length === systemExams.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  )}
                </div>

                <div
                  className="list-group mb-4 border rounded-3"
                  style={{ maxHeight: '240px', overflowY: 'auto' }}
                >
                  {systemExams.length === 0 ? (
                    <div className="text-center py-4 text-muted small">
                      Chưa có học phần hệ thống nào. Hãy tạo đề ở tab "🎓 Học phần" trước!
                    </div>
                  ) : (
                    systemExams.map((exam) => {
                      const checked = selectedNewUserExams.includes(Number(exam.id));
                      return (
                        <label
                          key={exam.id}
                          className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex align-items-center gap-2 text-truncate pe-2">
                            <input
                              type="checkbox"
                              className="form-check-input mt-0"
                              checked={checked}
                              onChange={() => toggleNewUserExam(exam.id)}
                            />
                            <span className="fw-semibold text-truncate">{exam.title}</span>
                          </div>
                          <span className="badge bg-accent-light text-dark rounded-pill">
                            {exam.questionCount || 0} câu
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-accent w-100 mobile-btn-tile"
                  disabled={creating}
                >
                  {creating ? '⏳ Đang khởi tạo tài khoản...' : '✅ Tạo Tài Khoản & Cấp Học Phần'}
                </button>
              </form>
            )}

            {activeTab === 'users' && (
              <div>
                {editingUser ? (
                  <div className="bg-white p-3 p-md-4 rounded-4 shadow-sm animate-in">
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                      <div>
                        <h6 className="fw-bold mb-0 text-primary">
                          🎓 Phân quyền học phần cho: {editingUser.full_name || editingUser.username}
                        </h6>
                        <small className="text-muted">@{editingUser.username}</small>
                      </div>
                      <button
                        className="btn btn-secondary btn-mobile-chip"
                        onClick={() => setEditingUser(null)}
                      >
                        ← Quay lại
                      </button>
                    </div>

                    {systemExams.length === 0 ? (
                      <p className="text-muted text-center py-3 mb-0">
                        Chưa có học phần hệ thống nào để phân quyền.
                      </p>
                    ) : (
                      <div className="list-group">
                        {systemExams.map((exam) => {
                          const userExams = assignmentsMap[editingUser.id] || [];
                          const isChecked = userExams.includes(Number(exam.id));
                          return (
                            <label
                              key={exam.id}
                              className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center rounded-3 mb-2 border ${
                                isChecked ? 'border-primary bg-accent-light' : ''
                              }`}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="d-flex align-items-center gap-3">
                                <input
                                  type="checkbox"
                                  className="form-check-input mt-0"
                                  style={{ width: '20px', height: '20px' }}
                                  checked={isChecked}
                                  onChange={() => handleToggleAssignment(editingUser.id, exam.id)}
                                />
                                <div>
                                  <div className="fw-bold text-dark">{exam.title}</div>
                                  <small className="text-muted">{exam.questionCount || 0} câu hỏi</small>
                                </div>
                              </div>
                              <span
                                className={`badge rounded-pill ${
                                  isChecked ? 'bg-success' : 'bg-secondary'
                                }`}
                              >
                                {isChecked ? 'Đã cấp' : 'Chưa cấp'}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-4 shadow-sm overflow-hidden">
                    {loadingUsers ? (
                      <div className="text-center py-5 text-muted">⏳ Đang tải danh sách tài khoản...</div>
                    ) : users.length === 0 ? (
                      <div className="text-center py-5 text-muted">Chưa có tài khoản nào.</div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th className="ps-3">Tài khoản</th>
                              <th className="text-center">Số học phần</th>
                              <th className="text-end pe-3">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.map((u) => {
                              const assignedCount = (assignmentsMap[u.id] || []).length;
                              return (
                                <tr key={u.id}>
                                  <td className="ps-3">
                                    <div className="fw-bold">
                                      {u.full_name || u.username}{' '}
                                      {u.role === 'admin' && (
                                        <span className="badge bg-danger rounded-pill ms-1">Admin</span>
                                      )}
                                    </div>
                                    <small className="text-muted">@{u.username}</small>
                                  </td>
                                  <td className="text-center">
                                    {u.role === 'admin' ? (
                                      <span className="badge bg-success rounded-pill">Toàn quyền</span>
                                    ) : (
                                      <span className="badge bg-primary rounded-pill">
                                        {assignedCount} đề
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-end pe-3">
                                    {u.role !== 'admin' && (
                                      <div className="d-inline-flex gap-2">
                                        <button
                                          className="btn btn-sm btn-outline-primary fw-bold"
                                          onClick={() => setEditingUser(u)}
                                        >
                                          🎓 Phân quyền học phần
                                        </button>
                                        <button
                                          className={`btn btn-sm ${
                                            u.is_active ? 'btn-outline-danger' : 'btn-success'
                                          }`}
                                          onClick={() => handleToggleUserActive(u)}
                                        >
                                          {u.is_active ? '🔒 Khóa' : '🔓 Mở'}
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                {loadingReports ? (
                  <div className="text-center py-5 text-muted">⏳ Đang tải thông báo lỗi...</div>
                ) : reports.length === 0 ? (
                  <div className="bg-white rounded-4 p-5 text-center text-muted shadow-sm">
                    🎉 Hiện chưa có thông báo lỗi câu hỏi nào!
                  </div>
                ) : (
                  reports.map((report) => {
                    const draft = draftEdits[report.id] || {
                      question_text: report.question_text,
                      options: report.options || ['', '', '', ''],
                      correct_ans: report.current_correct_ans || 1,
                    };
                    const isResolved = report.status === 'resolved';

                    return (
                      <div
                        key={report.id}
                        className={`card border-0 shadow-sm rounded-4 mb-3 overflow-hidden ${
                          isResolved ? 'opacity-75' : 'border-accent-left'
                        }`}
                      >
                        <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom">
                          <div>
                            <span className="badge bg-accent-light text-dark me-2">
                              📚 {report.exam_title}
                            </span>
                            <small className="text-muted">
                              Báo bởi <strong>{report.username}</strong> •{' '}
                              {new Date(report.created_at).toLocaleString('vi-VN')}
                            </small>
                          </div>
                          <div className="d-flex align-items-center gap-2">
                            <span
                              className={`badge rounded-pill ${
                                isResolved ? 'bg-success' : 'bg-warning text-dark'
                              }`}
                            >
                              {isResolved ? '✓ Đã sửa' : '⏳ Chờ xử lý'}
                            </span>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeleteReport(report.id)}
                            >
                              🗑️ Xóa
                            </button>
                          </div>
                        </div>

                        <div className="card-body p-3 bg-white">
                          <div className="alert alert-warning py-2 px-3 mb-3 rounded-3 border-0">
                            <strong>💬 Ghi chú của người dùng:</strong> {report.note}
                          </div>

                          <label className="small fw-bold text-muted mb-1">Nội dung câu hỏi:</label>
                          <textarea
                            className="form-control mb-2 rounded-3"
                            rows="2"
                            value={draft.question_text}
                            onChange={(e) =>
                              handleDraftChange(report.id, 'question_text', e.target.value)
                            }
                          />

                          <div className="row g-2 mb-3">
                            {[0, 1, 2, 3].map((optIdx) => (
                              <div className="col-12 col-md-6" key={optIdx}>
                                <div className="input-group">
                                  <span className="input-group-text fw-bold">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <input
                                    className="form-control"
                                    value={draft.options[optIdx] || ''}
                                    onChange={(e) =>
                                      handleDraftChange(report.id, 'option', e.target.value, optIdx)
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 bg-light p-2 rounded-3">
                            <div className="d-flex align-items-center gap-1 flex-wrap">
                              <span className="fw-bold text-success me-2 small">Chọn đáp án đúng:</span>
                              {[1, 2, 3, 4].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  className={`btn btn-mobile-chip ${
                                    Number(draft.correct_ans) === num
                                      ? 'btn-success text-white'
                                      : 'btn-outline-secondary bg-white'
                                  }`}
                                  onClick={() => handleDraftChange(report.id, 'correct_ans', num)}
                                >
                                  {String.fromCharCode(64 + num)} ({num})
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              className="btn btn-accent btn-mobile-chip"
                              onClick={() => handleFixAndResolve(report)}
                              disabled={savingReportId === report.id}
                            >
                              {savingReportId === report.id
                                ? '⏳ Đang lưu...'
                                : '💾 Lưu sửa đáp án & Duyệt'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;