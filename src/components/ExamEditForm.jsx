import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import { exportSingleExamToJson } from '../api/axiosConfig';

// Tự động thu gọn kích thước sơ đồ/hình ảnh và nén sang WebP (~15-30KB) để không tốn bộ nhớ
const compressImageToDataUrl = (file, maxWidth = 720, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không thể đọc hình ảnh này!'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file!'));
    reader.readAsDataURL(file);
  });
};

function ExamEditForm({ editTitle, setEditTitle, editSubject, setEditSubject, existingSubjects = [], editQuestions, handleDeleteQuestion, handleUpdateQuestion, handleAddNewQuestionToEdit, setShowImportModal, handleSaveEdit, setEditingExamId }) {
  const [openImageBoxMap, setOpenImageBoxMap] = useState({});

  const toggleImageBox = (idx) => {
    setOpenImageBoxMap(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleImageFileSelect = async (idx, file) => {
    if (!file || !file.type.startsWith('image/')) {
      return toast.warning('Vui lòng chọn đúng định dạng file hình ảnh!');
    }
    try {
      const compressedDataUrl = await compressImageToDataUrl(file);
      handleUpdateQuestion(idx, 'image', compressedDataUrl);
      toast.success('🖼️ Đã nén và đính kèm hình ảnh!');
    } catch (err) {
      toast.error(err.message || 'Lỗi xử lý ảnh!');
    }
  };

  const handlePasteImage = async (idx, e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImageFileSelect(idx, file);
        return;
      }
    }
  };

  const handleExportText = () => {
    const rawText = editQuestions.map(q =>
      `${q.question} | ${q.options[0]} | ${q.options[1]} | ${q.options[2]} | ${q.options[3]} | ${q.correct_ans}${q.image ? ` | ${q.image}` : ''}`
    ).join('\n');
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
        <div className="row g-2 mb-3">
          <div className="col-12 col-md-5">
            <label className="fw-bold small text-muted mb-1">📁 Môn học (Folder):</label>
            <input
              className="form-control form-control-lg fw-bold rounded-3"
              list="edit-subjects-datalist"
              placeholder="Nhập hoặc chọn môn học..."
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
            />
            <datalist id="edit-subjects-datalist">
              {existingSubjects.map(subj => (
                <option key={subj} value={subj} />
              ))}
            </datalist>
          </div>
          <div className="col-12 col-md-7">
            <label className="fw-bold small text-muted mb-1">📄 Tên học phần / Đề thi:</label>
            <input
              className="form-control form-control-lg fw-bold text-primary rounded-3"
              placeholder="Tên bài thi..."
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
          </div>
        </div>

        {/* Lưới nút Xuất / Nhập nhanh cho đề thi này */}
        <div className="mobile-action-grid edit-action-grid mb-4">
          <button className="btn btn-outline-primary mobile-btn-tile bg-white" onClick={() => setShowImportModal(true)}>
            📋 Dán thêm câu
          </button>
          <button className="btn btn-outline-warning mobile-btn-tile bg-white text-dark" onClick={() => exportSingleExamToJson(editTitle, editQuestions, editSubject)}>
            📦 Xuất JSON
          </button>
          <button className="btn btn-outline-info mobile-btn-tile bg-white text-dark" onClick={handleExportText}>
            📄 Xuất Text
          </button>
          <button className="btn btn-outline-success mobile-btn-tile bg-white" onClick={handleExportExcel}>
            📊 Xuất Excel
          </button>
        </div>

        {editQuestions.map((q, idx) => {
          const showImgBox = Boolean(openImageBoxMap[idx] || q.image);
          return (
          <div key={idx} className="card mb-3 border-0 shadow-sm rounded-4" style={{ transform: 'none' }}>
            <div className="card-header bg-white d-flex justify-content-between align-items-center py-2 border-bottom">
              <span className="fw-bold text-primary">Câu {idx + 1}</span>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-mobile-chip ${q.image ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                  onClick={() => toggleImageBox(idx)}
                >
                  🖼️ {q.image ? 'Sửa ảnh' : 'Thêm ảnh'}
                </button>
                <button className="btn btn-outline-danger btn-mobile-chip" onClick={() => handleDeleteQuestion(idx)}>
                  🗑️ Xóa
                </button>
              </div>
            </div>
            <div className="card-body p-3" onPaste={(e) => handlePasteImage(idx, e)}>
              <textarea
                rows="2"
                className="form-control mb-3 rounded-3"
                placeholder="Nội dung câu hỏi... (Có thể bấm Ctrl+V để dán thẳng ảnh chụp màn hình vào câu này)"
                value={q.question}
                onChange={e => handleUpdateQuestion(idx, 'question', e.target.value)}
              />

              {showImgBox && (
                <div className="bg-light border rounded-3 p-2 mb-3">
                  <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                    <label className="btn btn-sm btn-accent mb-0" style={{ cursor: 'pointer' }}>
                      📂 Chọn ảnh / Sơ đồ từ máy
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleImageFileSelect(idx, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm flex-grow-1"
                      placeholder="Hoặc dán link ảnh / Ctrl+V ảnh chụp màn hình..."
                      value={q.image || ''}
                      onChange={e => handleUpdateQuestion(idx, 'image', e.target.value)}
                    />
                    {q.image && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          handleUpdateQuestion(idx, 'image', '');
                          setOpenImageBoxMap(prev => ({ ...prev, [idx]: false }));
                        }}
                      >
                        ✖ Xóa ảnh
                      </button>
                    )}
                  </div>
                  {q.image && (
                    <div className="text-center bg-white p-2 rounded-3 border">
                      <img
                        src={q.image}
                        alt={`Minh họa câu ${idx + 1}`}
                        className="img-fluid rounded-2"
                        style={{ maxHeight: '220px', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                </div>
              )}
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
          );
        })}
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