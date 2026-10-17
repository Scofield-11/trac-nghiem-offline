import React from 'react';

function ExamSaveModal({ show, onClose, newSaveTitle, setNewSaveTitle, saveToNew, saveToExisting, exams, profile }) {
  if (!show) return null;

  // Với user thường: chỉ liệt kê các học phần cá nhân (!exam.is_system) để gom câu hỏi vào Note riêng
  const savableExams = profile?.role === 'admin'
    ? exams
    : exams.filter(exam => !exam.is_system);

  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1050, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
          <div className="modal-header bg-warning text-dark">
            <h5 className="modal-title fw-bold">⭐ Lưu câu hỏi vào Note</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body bg-light">
            <div className="mb-4">
              <label className="fw-bold mb-2">Tạo học phần cá nhân (Note) mới:</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Tên Note mới..."
                  value={newSaveTitle}
                  onChange={e => setNewSaveTitle(e.target.value)}
                  enterKeyHint="done"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveToNew();
                    }
                  }}
                />
                <button className="btn btn-accent fw-bold text-nowrap" onClick={saveToNew}>Tạo & Lưu</button>
              </div>
            </div>
            <hr />
            <label className="fw-bold mb-2">Hoặc lưu vào Note cá nhân có sẵn:</label>
            <div className="list-group shadow-sm" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {savableExams.length === 0 ? (
                <div className="text-center py-3 text-muted">Chưa có Note cá nhân nào. Hãy tạo mới ở ô bên trên!</div>
              ) : (
                savableExams.map(exam => (
                  <button key={exam.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center rounded-3 mb-1 border" onClick={() => saveToExisting(exam)}>
                    <div className="text-truncate pe-3 text-start">
                      <div className="fw-bold text-truncate">
                        {exam.is_system ? '🎓 ' : '📒 '}
                        {exam.title}
                      </div>
                      <small className="text-muted">📁 {exam.subject || 'Chưa phân loại'}</small>
                    </div>
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