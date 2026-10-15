import React from 'react';

function ExamSaveModal({ show, onClose, newSaveTitle, setNewSaveTitle, saveToNew, saveToExisting, exams }) {
  if (!show) return null;
  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1050, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title fw-bold">⭐ Lưu câu hỏi</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body bg-light">
            <div className="mb-4">
              <label className="fw-bold mb-2">Tạo bộ kiểm tra mới:</label>
              <div className="input-group">
                <input type="text" className="form-control" placeholder="Tên bài kiểm tra..." value={newSaveTitle} onChange={e => setNewSaveTitle(e.target.value)} />
                <button className="btn btn-accent fw-bold text-nowrap" onClick={saveToNew}>Tạo & Lưu</button>
              </div>
            </div>
            <hr />
            <label className="fw-bold mb-2">Hoặc lưu vào bài có sẵn:</label>
            <div className="list-group shadow-sm" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {exams.length === 0 ? (
                <div className="text-center py-3 text-muted">Chưa có bài kiểm tra nào.</div>
              ) : (
                exams.map(exam => (
                  <button key={exam.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center rounded-3 mb-1 border" onClick={() => saveToExisting(exam)}>
                    <span className="text-truncate pe-3">{exam.title}</span>
                    <span className="badge bg-primary rounded-pill">+</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamSaveModal;