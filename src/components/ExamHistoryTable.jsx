import React from 'react';
import EmptyState from './EmptyState';

function ExamHistoryTable({ history, setViewHistory, handleClearHistory }) {
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4 mt-5">
        <div className="section-header flex-grow-1 me-3" style={{ marginBottom: 0 }}>
          <h4 className="m-0 fw-bold">📊 Lịch sử làm bài</h4>
        </div>
        {history.length > 0 && (
          <button className="btn btn-outline-danger btn-sm rounded-pill fw-bold px-3" onClick={handleClearHistory}>
            🗑️ Xóa lịch sử
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState title="Chưa có dữ liệu" message="Lịch sử làm bài thi của bạn sẽ được hiển thị tại đây." />
      ) : (
        <>
          <div className="history-table-desktop">
            <div className="card shadow-sm border-0 mb-5 rounded-4 overflow-hidden">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle" style={{ minWidth: '600px' }}>
                  <thead className="table-light">
                    <tr>
                      <th className="py-3 px-4">Thời gian</th>
                      <th className="py-3">Tên bài thi</th>
                      <th className="py-3 text-center">Kết quả</th>
                      <th className="py-3 px-4 text-end">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(record => (
                      <tr key={record.id} style={{ cursor: 'pointer' }} onClick={() => setViewHistory(record)}>
                        <td className="text-muted small px-4">{record.date}</td>
                        <td className="fw-bold">{record.title}</td>
                        <td className="text-center">
                          <span className={`badge rounded-pill px-3 py-2 ${record.score === record.total ? 'bg-success' : 'bg-primary'}`}>
                            {record.score === record.total && '⭐ '}{record.score} / {record.total}
                          </span>
                        </td>
                        <td className="text-end px-4">
                          <button className="btn btn-sm btn-outline-info fw-bold rounded-pill px-3" onClick={(e) => { e.stopPropagation(); setViewHistory(record); }}>
                            Xem lại
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="history-cards-mobile mb-5" style={{ display: 'none' }}>
            {history.map(record => (
              <div key={record.id} className="history-card-mobile bg-white p-3 mb-3 rounded-4 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => setViewHistory(record)}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold text-truncate" style={{ maxWidth: '65%', fontSize: '1rem' }}>{record.title}</span>
                  <span className={`badge rounded-pill px-3 py-2 ${record.score === record.total ? 'bg-success' : 'bg-primary'}`}>
                    {record.score === record.total && '⭐ '}{record.score}/{record.total}
                  </span>
                </div>
                <div className="d-flex justify-content-between align-items-center mt-2 pt-2 border-top">
                  <small className="text-muted">🕒 {record.date}</small>
                  <span className="fw-bold small" style={{ color: 'var(--accent)' }}>Xem lại câu sai →</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default ExamHistoryTable;