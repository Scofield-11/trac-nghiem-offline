import React from 'react';

function LoadingSkeleton() {
  return (
    <div className="container mt-5" style={{ maxWidth: '850px' }}>
      <div className="text-center mb-4">
        <span className="shimmer-bg col-4 d-inline-block rounded" style={{ height: '35px' }}></span>
      </div>
      {[1, 2, 3].map((i, index) => (
        <div
          key={i}
          className="card shadow-sm border-0 rounded-4 mb-4 animate-in"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className="card-body p-4">
            <h5 className="card-title shimmer-bg col-5 rounded" style={{ height: '24px' }}></h5>
            <p className="card-text shimmer-bg col-8 rounded mb-2" style={{ height: '16px' }}></p>
            <p className="card-text shimmer-bg col-4 rounded" style={{ height: '16px' }}></p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LoadingSkeleton;