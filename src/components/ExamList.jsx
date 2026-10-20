import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api, {
  exportAllDataToJson,
  importDataFromJsonFile,
  renameSubjectFolder
} from '../api/axiosConfig';
import EmptyState from './EmptyState';

function ExamList({
  user,
  profile,
  exams,
  fetchExamsList,
  fetchHistory,
  startExam,
  handleEditClick,
  handleDeleteExam,
  isInstantFeedback,
  setIsInstantFeedback,
  selectedSubject,
  setSelectedSubject
}) {
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [subjectInput, setSubjectInput] = useState("");
  const [showCreateBox, setShowCreateBox] = useState(false);
  const [activeTab, setActiveTab] = useState("system"); // 'system' | 'personal'
  const fileInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const rawTextInputRef = useRef(null);

  const isAdmin = profile?.role === 'admin';

  // Phân tách rõ Học phần được cấp (is_system === true) và Học phần của tôi (is_system === false & owner_id === user.id)
  const systemExams = exams.filter(e => e.is_system === true);
  const personalExams = exams.filter(e => !e.is_system && (!user || e.owner_id === user.id));
  const displayedExams = activeTab === 'system' ? systemExams : personalExams;

  // Gom nhóm học phần thành các Thư mục Môn học (Folder)
  const subjectGroupsMap = displayedExams.reduce((acc, exam) => {
    const subjName = (exam.subject && String(exam.subject).trim()) || 'Chưa phân loại';
    if (!acc[subjName]) {
      acc[subjName] = { name: subjName, exams: [], totalQuestions: 0 };
    }
    acc[subjName].exams.push(exam);
    acc[subjName].totalQuestions += Number(exam.questionCount || 0);
    return acc;
  }, {});

  const subjectFolders = Object.values(subjectGroupsMap).sort((a, b) =>
    a.name.localeCompare(b.name, 'vi')
  );

  const activeFolderExams = selectedSubject
    ? subjectGroupsMap[selectedSubject]?.exams || []
    : [];

  // Chỉ hiển thị thanh công cụ Tạo đề / Nhập JSON ở Tab 2 (Note của tôi), hoặc ở Tab 1 nếu là Admin
  const canManageCurrentTab = activeTab === 'personal' || isAdmin;
  const isCreatingSystemExam = isAdmin && activeTab === 'system';

  const handleOpenCreateBox = (prefillSubject = "") => {
    if (!showCreateBox) {
      setSubjectInput(prefillSubject || selectedSubject || "");
    }
    setShowCreateBox(!showCreateBox);
  };

  const handleCreate = async () => {
    if (!title.trim() || !rawText.trim()) {
      return toast.warning("Vui lòng nhập đủ tên học phần và nội dung câu hỏi!");
    }
    const targetSubject = subjectInput.trim() || selectedSubject || "Chưa phân loại";
    try {
      await api.post("/exams/import", {
        title,
        subject: targetSubject,
        raw_text: rawText,
        is_system: isCreatingSystemExam
      });
      toast.success(
        isCreatingSystemExam
          ? `Đã tạo học phần vào môn [${targetSubject}]!`
          : `Đã tạo Note vào môn [${targetSubject}]!`
      );
      setRawText("");
      setTitle("");
      setShowCreateBox(false);
      setSelectedSubject(targetSubject);
      fetchExamsList();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(e => e.msg).join('; ') : detail || "Lỗi lưu dữ liệu";
      toast.error(msg);
    }
  };

  const handleRenameFolder = async (folderName) => {
    const nextName = window.prompt("Nhập tên mới cho môn học (Folder) này:", folderName);
    if (!nextName || !nextName.trim() || nextName.trim() === folderName) return;
    try {
      await renameSubjectFolder(folderName, nextName.trim(), activeTab === 'system');
      toast.success(`Đã đổi tên môn học thành "${nextName.trim()}"!`);
      if (selectedSubject === folderName) {
        setSelectedSubject(nextName.trim());
      }
      fetchExamsList();
    } catch (err) {
      toast.error(err.message || "Không thể đổi tên môn học!");
    }
  };

  const handleJsonImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importDataFromJsonFile(
        file,
        isCreatingSystemExam,
        selectedSubject || "Chưa phân loại"
      );
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
            setSelectedSubject(null);
            setShowCreateBox(false);
          }}
        >
          <span>🎓 Học phần</span>
          <span className="tab-count-badge">{systemExams.length}</span>
        </button>
        <button
          type="button"
          className={`btn mobile-tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('personal');
            setSelectedSubject(null);
            setShowCreateBox(false);
          }}
        >
          <span>📒 Note của tôi</span>
          <span className="tab-count-badge">{personalExams.length}</span>
        </button>
      </div>

      {/* Cụm nút điều khiển Tạo mới / Nhập Xuất JSON */}
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
              onClick={() => handleOpenCreateBox(selectedSubject || "")}
            >
              {showCreateBox
                ? '✖ Đóng khung tạo đề'
                : isCreatingSystemExam
                ? `➕ Tạo học phần Hệ thống${selectedSubject ? ` (${selectedSubject})` : ''}`
                : `➕ Tạo Note / Học phần mới${selectedSubject ? ` (${selectedSubject})` : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Khung tạo đề có thêm ô chọn/nhập Môn học (Folder) */}
      {canManageCurrentTab && showCreateBox && (
        <div className="card shadow-sm p-3 mb-4 border-0 rounded-4 border-accent-top animate-in">
          <h5 className="mb-2 fw-bold">
            {isCreatingSystemExam ? '🛡️ Tạo học phần Hệ thống (Admin)' : '✏️ Tạo học phần cá nhân (Note)'}
          </h5>
          <p className="text-muted small mb-2">
            Định dạng: <code>Câu hỏi | A | B | C | D | vị trí đúng (1-4)</code>
          </p>

          <label className="small fw-bold text-muted mb-1">
            📁 Môn học (Thư mục):
          </label>
          <input
            className="form-control mb-2 rounded-3"
            list="existing-subjects-datalist"
            placeholder="Nhập tên môn học mới hoặc chọn môn có sẵn..."
            value={subjectInput}
            onChange={e => setSubjectInput(e.target.value)}
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                titleInputRef.current?.focus();
              }
            }}
          />
          <datalist id="existing-subjects-datalist">
            {subjectFolders.map(folder => (
              <option key={folder.name} value={folder.name} />
            ))}
          </datalist>

          <label className="small fw-bold text-muted mb-1">
            📄 Tên học phần / Đề thi:
          </label>
          <input
            ref={titleInputRef}
            className="form-control mb-2 rounded-3"
            placeholder="VD: Chương 1 - Khái niệm cơ bản..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                rawTextInputRef.current?.focus();
              }
            }}
          />
          <textarea
            ref={rawTextInputRef}
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

      {/* Thanh tiêu đề + Điều hướng Folder + Nút bật/tắt Hiện đáp án ngay */}
      <div className="d-flex justify-content-between align-items-center mb-3 mt-2 flex-wrap gap-2">
        {selectedSubject ? (
          <div className="d-flex align-items-center flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-light border btn-mobile-chip text-dark"
              onClick={() => setSelectedSubject(null)}
            >
              ← Tất cả môn
            </button>
            <h5 className="m-0 fw-bold text-break" style={{ color: 'var(--accent)' }}>
              📂 {selectedSubject} ({activeFolderExams.length})
            </h5>
            {canManageCurrentTab && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill"
                onClick={() => handleRenameFolder(selectedSubject)}
                title="Đổi tên môn học này"
              >
                ✏️ Đổi tên môn
              </button>
            )}
          </div>
        ) : (
          <h5 className="m-0 fw-bold">
            {activeTab === 'system'
              ? `📁 Môn học được cấp (${subjectFolders.length} môn • ${systemExams.length} học phần)`
              : `📁 Tủ Note của tôi (${subjectFolders.length} môn • ${personalExams.length} học phần)`}
          </h5>
        )}

        <button
          type="button"
          className={`btn btn-mobile-chip ${isInstantFeedback ? 'btn-primary text-white shadow-sm' : 'btn-outline-secondary bg-white'}`}
          onClick={() => setIsInstantFeedback(!isInstantFeedback)}
        >
          ⚡ Đáp án ngay: {isInstantFeedback ? 'BẬT' : 'TẮT'}
        </button>
      </div>

      {!isAdmin && activeTab === 'system' && (
        <div className="text-muted small mb-3 px-1">
          💬 <em>Hãy nhắn hoặc gửi tên đăng nhập {profile?.username ? <strong>(@{profile.username})</strong> : ''} cho Admin để lấy học phần nhé!</em>
        </div>
      )}

      {displayedExams.length === 0 ? (
        <EmptyState
          title={activeTab === 'system' ? "Chưa có môn học / học phần nào" : "Chưa có Note cá nhân nào"}
          message={
            activeTab === 'system'
              ? (isAdmin
                  ? "Bấm '➕ Tạo học phần Hệ thống' ở trên để thêm môn học mới và phân quyền cho học viên!"
                  : "Hãy nhắn hoặc gửi tài khoản cho Admin để lấy học phần nhé!")
              : "Bạn có thể bấm '➕ Tạo Note', hoặc bấm '⭐ Lưu câu này' khi đang làm bài để gom câu hỏi khó theo từng môn về đây!"
          }
        />
      ) : !selectedSubject ? (
        /* ================= CHẾ ĐỘ 1: HIỂN THỊ DANH SÁCH THƯ MỤC MÔN HỌC (FOLDERS) ================= */
        <div className="row g-3 mb-4">
          {subjectFolders.map(folder => (
            <div className="col-12 col-md-6" key={folder.name}>
              <div
                className="card card-hover shadow-sm border-0 h-100 rounded-4 border-accent-left bg-white"
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedSubject(folder.name)}
              >
                <div className="card-body p-3 p-md-4 d-flex justify-content-between align-items-center gap-3">
                  <div className="d-flex align-items-center gap-3 overflow-hidden">
                    <div
                      className="d-flex align-items-center justify-content-center rounded-4 bg-accent-light flex-shrink-0"
                      style={{ width: '54px', height: '54px', fontSize: '1.65rem' }}
                    >
                      📁
                    </div>
                    <div className="overflow-hidden">
                      <h5
                        className="card-title fw-bold mb-1 text-truncate"
                        style={{ color: 'var(--accent)', fontSize: '1.12rem' }}
                      >
                        {folder.name}
                      </h5>
                      <div className="text-muted small">
                        <strong>{folder.exams.length}</strong> học phần •{' '}
                        <strong>{folder.totalQuestions}</strong> câu hỏi
                      </div>
                    </div>
                  </div>

                  <span
                    className="btn btn-light border rounded-pill fw-bold px-3 flex-shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
                    Mở →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : activeFolderExams.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-muted">Không còn học phần nào trong môn này.</p>
          <button className="btn btn-accent btn-mobile-chip" onClick={() => setSelectedSubject(null)}>
            ← Quay lại danh sách môn học
          </button>
        </div>
      ) : (
        /* ================= CHẾ ĐỘ 2: HIỂN THỊ CÁC HỌC PHẦN BÊN TRONG MÔN HỌC ĐÃ MỞ ================= */
        <div className="row g-3 mb-4 animate-in">
          {activeFolderExams.map(exam => {
            const canEditOrDelete = !exam.is_system || isAdmin;
            return (
              <div className="col-12 col-md-6" key={exam.id}>
                <div className="card shadow-sm border-0 h-100 rounded-4 border-accent-left">
                  <div className="card-body p-3 d-flex flex-column justify-content-between">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                      <div>
                        <span className="badge bg-light text-muted border mb-1">
                          📁 {exam.subject || 'Chưa phân loại'}
                        </span>
                        <h5 className="card-title fw-bold mb-0 text-break" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>
                          {exam.title}
                        </h5>
                      </div>
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