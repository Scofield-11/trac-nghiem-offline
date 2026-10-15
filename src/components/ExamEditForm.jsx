import React from 'react';
import * as XLSX from 'xlsx';
import { exportSingleExamToJson } from '../api/axiosConfig';

function ExamEditForm({ editTitle, setEditTitle, editQuestions, handleDeleteQuestion, handleUpdateQuestion, handleAddNewQuestionToEdit, setShowImportModal, handleSaveEdit, setEditingExamId }) {
  const handleExportText = () => {
    const rawText = editQuestions.map(q => `${q.question} | ${q.options[0]} | ${q.options[1]} | ${q.options[2]} | ${q.options[3]} | ${q.correct_ans}`).join('\n');
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${editTitle || 'De_thi'}_export.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const data = editQuestions.map(q => ({
      "Câu hỏi": q.question,
      "Đáp án A": q.options[0],
      "Đáp án B": q.options[1],
      "Đáp án C": q.options[2],
      "Đáp án D": q.options[3],
      "Vị trí đúng (1-4)": q.correct_ans
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");
    XLSX.writeFile(wb, `${editTitle || 'De_thi'}_export.xlsx`);
  };

  return (
    <div className="card shadow-sm border-0 mb-5 rounded-4 overflow-hidden">
      <div className="card-header modal-header-gradient fw-bold d-flex justify-content-between align-items-center py-3">
        <span className="fs-6">✏️ Sửa đề ({editQuestions.length} câu)</span>
        <button className="btn btn-light btn-mobile-chip text-dark" onClick={() => setEditingExamId(null)}>
          ✖ Đóng
        </button>
      </div>

      <div className="card-body bg-light p-3">
        <label className="fw-bold small text-muted mb-1">Tên đề thi:</label>
        <input
          className="form-control form-control-lg mb-3 fw-bold text-primary rounded-3"
          placeholder="Tên bài thi..."
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
        />

        {/* Lưới nút Xuất / Nhập nhanh cho đề thi này */}
        <div className="mobile-action-grid edit-action-grid mb-4">
          <button className="btn btn-outline-primary mobile-btn-tile bg-white" onClick={() => setShowImportModal(true)}>
            📋 Dán thêm câu
          </button>
          <button className="btn btn-outline-warning mobile-btn-tile bg-white text-dark" onClick={() => exportSingleExamToJson(editTitle, editQuestions)}>
            📦 Xuất JSON
          </button>
          <button className="btn btn-outline-info mobile-btn-tile bg-white text-dark" onClick={handleExportText}>
            📄 Xuất Text
          </button>
          <button className="btn btn-outline-success mobile-btn-tile bg-white" onClick={handleExportExcel}>
            📊 Xuất Excel
          </button>
        </div>

        {editQuestions.map((q, idx) => (
          <div key={idx} className="card mb-3 border-0 shadow-sm rounded-4" style={{ transform: 'none' }}>
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-2 border-bottom">
              <span className="fw-bold text-primary">Câu {idx + 1}</span>
              <button className="btn btn-outline-danger btn-mobile-chip" onClick={() => handleDeleteQuestion(idx)}>
                🗑️ Xóa
              </button>
            </div>
            <div className="card-body p-3">
              <textarea
                rows="2"
                className="form-control mb-3 rounded-3"
                placeholder="Nội dung câu hỏi..."
                value={q.question}
                onChange={e => handleUpdateQuestion(idx, 'question', e.target.value)}
              />
              <div className="row g-2 mb-3">
                {[0, 1, 2, 3].map(optIdx => (
                  <div className="col-12 col-md-6" key={optIdx}>
                    <div className="input-group">
                      <span className="input-group-text fw-bold">{String.fromCharCode(65 + optIdx)}</span>
                      <input
                        className="form-control"
                        value={q.options[optIdx]}
                        onChange={e => handleUpdateQuestion(idx, `opt${optIdx + 1}`, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded-3">
                <label className="fw-bold text-success mb-0">Đáp án đúng:</label>
                <div className="d-flex gap-1">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`btn btn-mobile-chip ${q.correct_ans === num ? 'btn-success text-white' : 'btn-outline-secondary bg-white'}`}
                      onClick={() => handleUpdateQuestion(idx, 'correct_ans', num)}
                    >
                      {String.fromCharCode(64 + num)} ({num})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Thanh ghim đáy màn hình khi sửa đề trên Mobile */}
      <div className="mobile-bottom-bar">
        <div className="mobile-bottom-bar-inner">
          <button
            className="btn btn-outline-primary bg-white mobile-btn-tile px-3"
            onClick={() => {
              handleAddNewQuestionToEdit();
              setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
            }}
          >
            ➕ Thêm câu
          </button>
          <button className="btn btn-accent flex-grow-1 mobile-btn-tile" onClick={handleSaveEdit}>
            💾 Lưu tất cả ({editQuestions.length} câu)
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExamEditForm;