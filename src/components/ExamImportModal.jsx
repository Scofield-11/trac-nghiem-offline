import React from 'react';

function ExamImportModal({ show, onClose, importText, setImportText, onImport }) {
  if (!show) return null;
  return (
    <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1050, padding: '10px' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-md-down">
        <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden h-100">
          <div className="modal-header modal-header-gradient">
            <h5 className="modal-title fw-bold">📥 Import thêm hàng loạt</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body bg-light">
            <p className="text-muted small mb-2">
              Dán danh sách câu hỏi theo định dạng: <br/>
              <code>Câu hỏi | Đáp án 1 | Đáp án 2 | Đáp án 3 | Đáp án 4 | Vị trí đúng</code>
            </p>
            <textarea
              className="form-control mb-3 rounded-3"
              rows="8"
              placeholder="Câu hỏi 1 | A | B | C | D | 1&#10;Câu hỏi 2 | A | B | C | D | 3"
              value={importText}
              onChange={e => setImportText(e.target.value)}
            ></textarea>
            <button className="btn btn-accent w-100 fw-bold btn-lg rounded-3" onClick={onImport}>Gộp vào đề này</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamImportModal;