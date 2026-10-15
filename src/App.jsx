import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ExamMode from './components/ExamMode';

function App() {
  return (
    <div className="container-fluid py-3" style={{ maxWidth: '1140px' }}>
      <header className="text-center mb-3">
        <h1 className="fw-bold fs-3 gradient-text d-flex align-items-center justify-content-center gap-2 mb-1">
          <img src="/sea_15651557.ico" alt="logo" style={{ width: '34px', height: '34px', objectFit: 'contain' }} />
          Thi Trắc Nghiệm
        </h1>
        <p className="text-muted small mb-0">Phiên bản Offline Mobile — Lưu trữ JSON</p>
      </header>
      <ExamMode />
      <ToastContainer position="top-center" autoClose={2200} theme="colored" hideProgressBar />
    </div>
  );
}

export default App;