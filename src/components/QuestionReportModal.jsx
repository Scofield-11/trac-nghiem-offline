import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { submitQuestionReport } from '../api/axiosConfig';

function QuestionReportModal({ show, onClose, question, examId, examTitle }) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  if (!show || !question) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      return toast.warning('Vui lòng nhập nội dung ghi chú / lỗi đáp án!');
    }

    setSending(true);
    try {
      await submitQuestionReport({
        examId,
        examTitle,
        question,
        note: note.trim(),
      });
      toast.success('📨 Đã gửi báo lỗi câu hỏi về cho Admin!');
      setNote('');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi báo cáo cho Admin!');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1070, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden animate-in">
          <div className="modal-header modal-header-gradient">
            <h5 className="modal-title fw-bold">🚩 Báo lỗi câu hỏi / Đáp án</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body bg-light p-3 p-md-4">
              <div className="bg-white p-3 rounded-3 border mb-3 shadow-sm">
                <div className="small text-muted mb-1">Học phần: <strong>{examTitle}</strong></div>
                <div className="fw-bold text-dark mb-2">{question.question}</div>
                <div className="row g-1 small">
                  {question.options?.map((opt, idx) => {
                    const isCorrect = idx + 1 === Number(question.correct_ans);
                    return (
                      <div key={idx} className={`col-12 ${isCorrect ? 'text-success fw-bold' : 'text-muted'}`}>
                        {String.fromCharCode(65 + idx)}. {opt} {isCorrect && '✓ (Đáp án hệ thống)'}
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="form-label fw-bold small text-dark">
                Ghi chú gửi Admin (VD: Đáp án đúng phải là B vì...):
              </label>
              <textarea
                className="form-control rounded-3"
                rows="3"
                placeholder="Nhập ghi chú để Admin kiểm tra và sửa lại đáp án..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
                disabled={sending}
              ></textarea>
            </div>

            <div className="modal-footer bg-white border-0 pt-0 pb-3 px-3 px-md-4 d-flex gap-2">
              <button
                type="button"
                className="btn btn-light border flex-grow-1"
                onClick={onClose}
                disabled={sending}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-accent flex-grow-1"
                disabled={sending}
              >
                {sending ? '⏳ Đang gửi...' : '📨 Gửi cho Admin'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default QuestionReportModal;