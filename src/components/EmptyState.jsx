import React from 'react';

function EmptyState({ title = "Chưa có dữ liệu", message = "Hãy thêm mới dữ liệu để bắt đầu nhé!" }) {
  return (
    <div
      className="text-center py-5 px-3"
      style={{ background: 'rgba(124,58,237,0.03)', borderRadius: 'var(--radius-lg)' }}
    >
      <div className="animate-float mb-4">
        <svg
          width="100"
          height="100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-75"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      </div>
      <h4 className="fw-bold gradient-text">{title}</h4>
      <p className="text-muted mb-0">{message}</p>
    </div>
  );
}

export default EmptyState;