import React, { useState, useEffect } from 'react';
import api, {
  getCachedExamsList,
  getCachedExamById,
  getCachedHistory,
  fetchExamHistoryFromCloud,
  clearExamHistoryOnCloud
} from '../api/axiosConfig';
import { toast } from 'react-toastify';
import ExamList from './ExamList';
import ExamTaking from './ExamTaking';
import LoadingSkeleton from './LoadingSkeleton';
import ExamImportModal from './ExamImportModal';
import ExamSaveModal from './ExamSaveModal';
import ExamEditForm from './ExamEditForm';
import ExamHistoryTable from './ExamHistoryTable';
import AdminPanel from './AdminPanel';

function ExamMode({ user, profile, showAdminPanel, setShowAdminPanel, syncTrigger, onReportsChanged, onFocusModeChange }) {
  const [editingExamId, setEditingExamId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("Chưa phân loại");
  const [editQuestions, setEditQuestions] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Khởi tạo từ Cache trước để chuyển màn hình 0ms không bị khựng
  const [exams, setExams] = useState(() => getCachedExamsList());
  const [examData, setExamData] = useState(null);
  const [isInstantFeedback, setIsInstantFeedback] = useState(false);

  const [history, setHistory] = useState(() => getCachedHistory());
  const [viewHistory, setViewHistory] = useState(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [questionToSave, setQuestionToSave] = useState(null);
  const [newSaveTitle, setNewSaveTitle] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isLoading, setIsLoading] = useState(() => getCachedExamsList().length === 0);

  const handleCopyQuestion = (q) => {
    const textToCopy = `${q.question}\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.info("📋 Đã sao chép để tra cứu!");
    });
  };

  const fetchHistory = async () => {
    const cached = getCachedHistory();
    if (cached.length > 0) setHistory(cached);
    try {
      const cloudHistory = await fetchExamHistoryFromCloud();
      setHistory(cloudHistory);
    } catch (error) {
      console.error("Lỗi đồng bộ lịch sử:", error);
    }
  };

  const fetchExamsList = async () => {
    const cached = getCachedExamsList();
    if (cached.length > 0) setExams(cached);
    try {
      const res = await api.get("/exams");
      setExams(res.data);
    } catch (error) {
      console.error("Lỗi lấy danh sách đề thi:", error);
    }
  };

  useEffect(() => {
    fetchExamsList().finally(() => setIsLoading(false));
    fetchHistory();
  }, [user?.id, syncTrigger]);

  // Tự động ẩn thanh Header (Cập nhật / Đăng xuất) khi đang làm bài, sửa đề hoặc xem chi tiết lịch sử
  useEffect(() => {
    if (onFocusModeChange) {
      onFocusModeChange(Boolean(examData || editingExamId || viewHistory));
    }
    return () => {
      if (onFocusModeChange) onFocusModeChange(false);
    };
  }, [examData, editingExamId, viewHistory, onFocusModeChange]);

  const handleClearHistory = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử làm bài của tài khoản này?")) {
      try {
        await clearExamHistoryOnCloud();
        setHistory([]);
        toast.success("Đã xóa lịch sử thành công!");
      } catch {
        toast.error("Lỗi khi xóa lịch sử làm bài!");
      }
    }
  };

  const handleEditClick = async (examId) => {
    try {
      // Phản hồi 0ms nếu đề thi đã có trong sessionStorage
      const cached = getCachedExamById(examId);
      const data = cached || (await api.get(`/exams/${examId}`)).data;
      setEditTitle(data.title);
      setEditSubject(data.subject || "Chưa phân loại");

      const formattedQuestions = data.questions.map(q => ({
        question: q.question,
        options: [...q.options],
        correct_ans: q.correct_ans
      }));

      setEditQuestions(formattedQuestions);
      setEditingExamId(examId);
      window.scrollTo(0, 0);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi lấy dữ liệu bài thi");
    }
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...editQuestions];
    if (field.startsWith('opt')) {
      const optIndex = parseInt(field.replace('opt', '')) - 1;
      updated[index].options[optIndex] = value;
    } else {
      updated[index][field] = value;
    }
    setEditQuestions(updated);
  };

  const handleDeleteQuestion = (index) => {
    const updated = editQuestions.filter((_, i) => i !== index);
    setEditQuestions(updated);
  };

  const handleAddNewQuestionToEdit = () => {
    setEditQuestions([...editQuestions, { question: "", options: ["", "", "", ""], correct_ans: 1 }]);
  };

  const handleImportToEdit = () => {
    if (!importText.trim()) return toast.warning("Vui lòng nhập nội dung!");

    const lines = importText.trim().split('\n');
    const newQuestions = [];
    let errorCount = 0;

    for (let line of lines) {
      if (!line.trim()) continue;
      const parts = line.split('|').map(p => p.trim());
      if (parts.length === 6) {
        newQuestions.push({
          question: parts[0],
          options: [parts[1], parts[2], parts[3], parts[4]],
          correct_ans: parseInt(parts[5]) || 1
        });
      } else {
        errorCount++;
      }
    }

    if (newQuestions.length > 0) {
      setEditQuestions([...editQuestions, ...newQuestions]);
      toast.success(`Đã gộp thêm ${newQuestions.length} câu vào đề. Có ${errorCount} dòng bị lỗi bị bỏ qua.`);
      setImportText("");
      setShowImportModal(false);
      setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100);
    } else {
      toast.error("Không tìm thấy câu hỏi hợp lệ. Vui lòng kiểm tra định dạng |");
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) return toast.warning("Tên bài thi không được để trống!");
    const cleanSubject = editSubject.trim() || "Chưa phân loại";
    const raw = editQuestions.map(q => `${q.question} | ${q.options[0]} | ${q.options[1]} | ${q.options[2]} | ${q.options[3]} | ${q.correct_ans}`).join('\n');
    try {
      await api.put(`/exams/${editingExamId}`, {
        title: editTitle,
        subject: cleanSubject,
        raw_text: raw
      });
      toast.success("Cập nhật bài test thành công!");
      setSelectedSubject(cleanSubject);
      setEditingExamId(null);
      fetchExamsList();
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map(e => e.msg).join('; ') : detail || "Lỗi lưu dữ liệu";
      toast.error(msg);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài kiểm tra này?")) return;
    try {
      await api.delete(`/exams/${examId}`);
      fetchExamsList();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi khi xóa bài thi");
    }
  };

  const startExam = async (examId) => {
    try {
      // Mở ngay trong 0ms nếu đã có trong sessionStorage
      const cached = getCachedExamById(examId);
      if (cached) {
        setExamData(cached);
        return;
      }
      const res = await api.get(`/exams/${examId}`);
      setExamData(res.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Không thể mở đề thi này!");
    }
  };

  const backToList = () => {
    setExamData(null);
    fetchExamsList();
  };

  const openSaveModal = (q) => {
    setQuestionToSave(q);
    setShowSaveModal(true);
  };

  const closeSaveModal = () => {
    setShowSaveModal(false);
    setQuestionToSave(null);
    setNewSaveTitle("");
  };

  const saveToExisting = async (exam) => {
    try {
      const res = await api.get(`/exams/${exam.id}`);
      const existingData = res.data;

      const isExist = existingData.questions.some(eq => eq.question === questionToSave.question);
      if (isExist) {
        toast.warning(`Câu hỏi này đã có trong bộ [${exam.title}]!`);
        return;
      }

      const existingRaw = existingData.questions.map(eq =>
        `${eq.question} | ${eq.options[0]} | ${eq.options[1]} | ${eq.options[2]} | ${eq.options[3]} | ${eq.correct_ans}`
      ).join('\n');

      const rawLine = `${questionToSave.question} | ${questionToSave.options[0]} | ${questionToSave.options[1]} | ${questionToSave.options[2]} | ${questionToSave.options[3]} | ${questionToSave.correct_ans}`;
      const newRawText = existingRaw ? existingRaw + '\n' + rawLine : rawLine;

      await api.put(`/exams/${exam.id}`, {
        title: exam.title,
        raw_text: newRawText
      });
      toast.success(`Đã lưu câu hỏi vào [${exam.title}]`);
      fetchExamsList();
      closeSaveModal();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi khi lưu câu hỏi!");
    }
  };

  const saveToNew = async () => {
    if (!newSaveTitle.trim()) return toast.warning("Vui lòng nhập tên đề thi mới!");
    try {
      const inheritedSubject = examData?.subject || selectedSubject || "Chưa phân loại";
      const rawLine = `${questionToSave.question} | ${questionToSave.options[0]} | ${questionToSave.options[1]} | ${questionToSave.options[2]} | ${questionToSave.options[3]} | ${questionToSave.correct_ans}`;
      await api.post("/exams/import", {
        title: newSaveTitle.trim(),
        subject: inheritedSubject,
        raw_text: rawLine,
        is_system: false // Luôn lưu vào Học phần cá nhân (Note) cùng Môn học
      });
      toast.success(`Đã tạo Note [${newSaveTitle.trim()}] trong môn [${inheritedSubject}]!`);
      fetchExamsList();
      closeSaveModal();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Lỗi khi tạo và lưu đề mới!");
    }
  };

  if (isLoading) return <LoadingSkeleton />;

  if (viewHistory) {
    return (
      <div className="container mt-4" style={{ maxWidth: '900px' }}>
        <ExamSaveModal show={showSaveModal} onClose={closeSaveModal} newSaveTitle={newSaveTitle} setNewSaveTitle={setNewSaveTitle} saveToNew={saveToNew} saveToExisting={saveToExisting} exams={exams} />
        <button className="btn btn-outline-secondary fw-bold rounded-pill mb-4 px-4 shadow-sm" onClick={() => setViewHistory(null)}>← Quay lại danh sách</button>
        <div className={`score-card animate-in mb-4 shadow-sm ${
          viewHistory.score / viewHistory.total >= 0.8 ? 'score-card-success' :
          viewHistory.score / viewHistory.total >= 0.5 ? 'score-card-warning' : 'score-card-danger'
        }`}>
          <div style={{fontSize: '2.5rem', marginBottom: '10px'}}>
            {viewHistory.score === viewHistory.total ? '🏆' : viewHistory.score / viewHistory.total >= 0.8 ? '🎉' : viewHistory.score / viewHistory.total >= 0.5 ? '💪' : '📖'}
          </div>
          <h4 className="fw-bold mb-3 text-white">{viewHistory.title}</h4>
          <p className="mb-0 text-white" style={{opacity: 0.9}}>
            Ngày làm: <strong>{viewHistory.date}</strong> <br/>
            Kết quả: <strong className="fs-4">{viewHistory.score} / {viewHistory.total}</strong>
          </p>
        </div>

        {viewHistory.wrongDetails && viewHistory.wrongDetails.length === 0 ? (
          <div className="alert alert-success fw-bold p-4 rounded-4 shadow-sm border-0">Tuyệt vời! Bạn không làm sai câu nào trong phiên này.</div>
        ) : (
          <div>
            <h5 className="text-danger fw-bold mb-4">Các câu làm sai:</h5>
            {viewHistory.wrongDetails && viewHistory.wrongDetails.map((q, i) => (
              <div key={i} className="bg-white wrong-answer-card shadow-sm mb-4 p-4" style={{ transform: 'none' }}>
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <h5 className="mb-0 text-dark fw-bold">{q.question}</h5>
                  <div className="d-flex gap-2 ms-3">
                    <button className="btn btn-sm btn-outline-info fw-bold text-dark text-nowrap" onClick={() => handleCopyQuestion(q)} title="Sao chép câu hỏi">
                      📋 Chép
                    </button>
                    <button className="btn btn-sm btn-outline-warning fw-bold text-dark text-nowrap" onClick={() => openSaveModal(q)} title="Lưu câu hỏi này">
                      ⭐ Lưu
                    </button>
                  </div>
                </div>
                <div className="row g-2">
                  {q.options ? q.options.map((opt, oIdx) => {
                    const optNumber = oIdx + 1;
                    let btnClass = "btn-outline-secondary";
                    if (optNumber === q.correct_ans) btnClass = "btn-success text-white border-success";
                    else if (q.user_ans === optNumber) btnClass = "btn-danger text-white border-danger";
                    return (
                      <div className="col-sm-6" key={oIdx}>
                        <button className={`btn answer-option w-100 fw-bold ${btnClass}`} style={{ cursor: 'default', pointerEvents: 'none', textAlign: 'left' }}>
                          <span className="answer-letter">{String.fromCharCode(65 + oIdx)}</span>
                          {opt}
                        </button>
                      </div>
                    );
                  }) : (
                    <p className="text-muted fst-italic">Dữ liệu lịch sử cũ không hỗ trợ xem. Vui lòng làm lại bài mới.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (examData) {
    return (
      <>
        <ExamSaveModal show={showSaveModal} onClose={closeSaveModal} newSaveTitle={newSaveTitle} setNewSaveTitle={setNewSaveTitle} saveToNew={saveToNew} saveToExisting={saveToExisting} exams={exams} profile={profile} />
        <ExamTaking
          examData={examData}
          isInstantFeedback={isInstantFeedback}
          backToList={backToList}
          fetchHistory={fetchHistory}
          openSaveModal={openSaveModal}
          startExam={startExam}
        />
      </>
    );
  }

  return (
    <div className="container mt-2 mt-md-4 px-0 px-sm-2" style={{ maxWidth: '900px' }}>
      {profile?.role === 'admin' && (
        <AdminPanel
          show={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
          systemExams={exams.filter(e => e.is_system)}
          onExamUpdated={fetchExamsList}
          onReportsChanged={onReportsChanged}
        />
      )}

      <ExamImportModal show={showImportModal} onClose={() => setShowImportModal(false)} importText={importText} setImportText={setImportText} onImport={handleImportToEdit} />

      {editingExamId ? (
        <ExamEditForm
          editTitle={editTitle} setEditTitle={setEditTitle}
          editSubject={editSubject} setEditSubject={setEditSubject}
          existingSubjects={Array.from(new Set(exams.map(e => e.subject || 'Chưa phân loại')))}
          editQuestions={editQuestions}
          handleDeleteQuestion={handleDeleteQuestion} handleUpdateQuestion={handleUpdateQuestion}
          handleAddNewQuestionToEdit={handleAddNewQuestionToEdit} setShowImportModal={setShowImportModal}
          handleSaveEdit={handleSaveEdit} setEditingExamId={setEditingExamId}
        />
      ) : (
        <ExamList
          user={user}
          profile={profile}
          exams={exams} fetchExamsList={fetchExamsList} fetchHistory={fetchHistory} startExam={startExam}
          handleEditClick={handleEditClick} handleDeleteExam={handleDeleteExam}
          isInstantFeedback={isInstantFeedback} setIsInstantFeedback={setIsInstantFeedback}
          selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject}
        />
      )}

      {!editingExamId && (
        <ExamHistoryTable history={history} setViewHistory={setViewHistory} handleClearHistory={handleClearHistory} />
      )}
    </div>
  );
}

export default ExamMode;