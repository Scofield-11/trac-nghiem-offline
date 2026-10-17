import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api, { exportAllDataToJson, importDataFromJsonFile } from '../api/axiosConfig';
import EmptyState from './EmptyState';

function ExamList({ user, profile, exams, fetchExamsList, fetchHistory, startExam, handleEditClick, handleDeleteExam, isInstantFeedback, setIsInstantFeedback }) {
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [activeTab, setActiveTab] = useState("system"); // 'system' | 'personal'
  const fileInputRef = useRef(null);

  const isAdmin = profile?.role === 'admin';

  // Phân tách rõ Học phần được cấp (is_system === true) và Học phần của tôi (is_system === false & owner_id === user.id)
  const systemExams = exams.filter(e => e.is_system === true);
  const personalExams = exams.filter(e => !e.is_system && (!user || e.owner_id === user.id));
  const displayedExams = activeTab === 'system' ? systemExams : personalExams;

  // Chỉ hiển thị thanh công cụ Tạo đề / Nhập JSON ở Tab 2 (Note của tôi), hoặc ở Tab 1 nếu là Admin
  const canManageCurrentTab = activeTab === 'personal' || isAdmin;
  const isCreatingSystemExam = isAdmin && activeTab === 'system';

  const handleCreate = async () => {
    if (!title.trim() || !rawText.trim()) return toast.warning("Vui lòng nhập đủ tên và nội dung bài test!");
    try {
      await api.post("/exams/import", {
        title,
        raw_text: rawText,
        is_system: isCreatingSystemExam
      });
      toast.success(
        isCreatingSystemExam
          ? "Đã tạo Học phần hệ thống thành công!"
          : "Đã tạo Học phần cá nhân (Note) thành công!"
      );
      setRawText("");
      setTitle("");
      setShowCreateBox(false);
      fetchExamsList();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(e => e.msg).join('; ') : detail || "Lỗi lưu dữ liệu";
      toast.error(msg);
    }
  };

  const handleJsonImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importDataFromJsonFile(file, isCreatingSystemExam);
      toast.success(`Đã thêm ${res.addedExams} đề thi từ file JSON!`);
      fetchExamsList();
      if (fetchHistory) fetchHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      {/* Thanh chuyển đổi 2 Tab dạng Segmented Pill cân đối trên Mobile */}
      <div className="mobile-tab-switcher mb-3">
        <button
          type="button"
          className={`btn mobile-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('system');
            setShowCreateBox(false);
          }}
        >
          <span>🎓 Học phần</span>
          <span className="tab-count-badge">{systemExams.length}</span>
        </button>
        <button
          type="button"
          className={`btn mobile-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <span>📒 Note của tôi</span>
          <span className="tab-count-badge">{personalExams.length}</span>
        </button>
      </div>

      {/* Cụm nút điều khiển Tạo mới / Nhập Xuất JSON (Luôn hiện ở Tab Note cá nhân hoặc khi Admin ở Tab Hệ thống) */}
      {canManageCurrentTab && (
        <div className="card shadow-sm p-3 mb-3 border-0 rounded-4 bg-white">
          <input
            type="file"
            accept=".json,application/json"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleJsonImport}
          />
          <div className="exam-list-toolbar">
            <div className="mobile-action-grid mb-2">
              <button
                className="btn btn-outline-primary mobile-btn-tile"
                onClick={() => fileInputRef.current?.click()}
              >
                📥 Nhập JSON
              </button>
              <button
                className="btn btn-outline-success mobile-btn-tile"
                onClick={() => {
                  if (displayedExams.length === 0) return toast.warning("Chưa có đề thi nào trong mục này để xuất!");
                  exportAllDataToJson(activeTab === 'personal');
                  toast.info("Đang tải file JSON sao lưu!");
                }}
              >
                📤 Xuất JSON
              </button>
            </div>

            <button
              className={`btn w-100 mobile-btn-tile ${showCreateBox ? 'btn-secondary' : 'btn-accent'}`}
              onClick={() => setShowCreateBox(!showCreateBox)}
            >
              {showCreateBox
                ? '✖ Đóng khung tạo đề'
                : isCreatingSystemExam
                ? '➕ Tạo học phần Hệ thống (Admin)'
                : '➕ Tạo Note / Học phần cá nhân mới'}
            </button>
          </div>
        </div>
      )}

      {/* Khung tạo đề đóng/mở gọn gàng */}
      {canManageCurrentTab && showCreateBox && (
        <div className="card shadow-sm p-3 mb-4 border-0 rounded-4 border-accent-top animate-in">
          <h5 className="mb-2 fw-bold">
            {isCreatingSystemExam ? '🛡️ Tạo học phần Hệ thống (Admin)' : '✏️ Tạo học phần cá nhân (Note)'}
          </h5>
          <p className="text-muted small mb-2">
            Định dạng: <code>Câu hỏi | A | B | C | D | vị trí đúng (1-4)</code>
          </p>
          <input
            className="form-control mb-2 rounded-3"
            placeholder="Nhập tên học phần..."
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="form-control mb-3 rounded-3"
            rows="4"
            placeholder="Câu hỏi 1 | Đáp án A | Đáp án B | Đáp án C | Đáp án D | 1"
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          ></textarea>
          <button className="btn btn-accent w-100 mobile-btn-tile" onClick={handleCreate}>
            🚀 Lưu Học Phần Ngay
          </button>
        </div>
      )}

      {/* Thanh tiêu đề + Nút bật/tắt Hiện đáp án ngay */}
      <div className="d-flex justify-content-between align-items-center mb-3 mt-2 flex-wrap gap-2">
        <h5 className="m-0 fw-bold">
          {activeTab === 'system'
            ? `🎓 Học phần (${systemExams.length})`
            : `📒 Học phần của tôi (${personalExams.length})`}
        </h5>
        <button
          type="button"
          className={`btn btn-mobile-chip ${isInstantFeedback ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary bg-white'}`}
          onClick={() => setIsInstantFeedback(!isInstantFeedback)}
        >
          ⚡ Đáp án ngay: {isInstantFeedback ? 'BẬT' : 'TẮT'}
        </button>
      </div>

      {displayedExams.length === 0 ? (
        <EmptyState
          title={activeTab === 'system' ? "Chưa có học phần nào" : "Chưa có Note cá nhân nào"}
          message={
            activeTab === 'system'
              ? (isAdmin
                  ? "Bấm '➕ Tạo học phần Hệ thống' ở trên để thêm đề và phân quyền cho học viên!"
                  : "Vui lòng liên hệ Admin để được cấp quyền truy cập học phần.")
              : "Bạn có thể bấm '➕ Tạo Note', hoặc bấm '⭐ Lưu câu này' khi đang làm bài để gom câu hỏi khó về đây!"
          }
        />
      ) : (
        <div className="row g-3 mb-4">
          {displayedExams.map(exam => {
            const canEditOrDelete = !exam.is_system || isAdmin;
            return (
              <div className="col-12 col-md-6" key={exam.id}>
                <div className="card shadow-sm border-0 h-100 rounded-4 border-accent-left">
                  <div className="card-body p-3 d-flex flex-column justify-content-between">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <h5 className="card-title fw-bold mb-0 text-break" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                        {exam.title}
                      </h5>
                      <span className="badge bg-accent-light text-nowrap rounded-pill px-2 py-1" style={{ color: 'var(--accent)' }}>
                        {exam.questionCount || 0} câu
                      </span>
                    </div>

                    <div>
                      <button
                        className={`btn btn-accent w-100 mobile-btn-tile ${canEditOrDelete ? 'mb-2' : ''}`}
                        onClick={() => startExam(exam.id)}
                      >
                        ▶ Bắt đầu làm bài
                      </button>

                      {canEditOrDelete && (
                        <div className="mobile-action-grid">
                          <button
                            className="btn btn-light border btn-mobile-chip text-dark"
                            onClick={() => handleEditClick(exam.id)}
                          >
                            ✏️ Chỉnh sửa / Xuất
                          </button>
                          <button
                            className="btn btn-outline-danger btn-mobile-chip"
                            onClick={() => handleDeleteExam(exam.id)}
                          >
                            🗑️ Xóa đề
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default ExamList;