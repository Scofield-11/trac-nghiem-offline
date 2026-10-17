import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api, { saveExamHistoryToCloud } from '../api/axiosConfig';
import confetti from 'canvas-confetti';
import QuestionReportModal from './QuestionReportModal';

function ExamTaking({ examData, isInstantFeedback, backToList, fetchHistory, openSaveModal, startExam }) {
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const [reportingQuestion, setReportingQuestion] = useState(null);
  const longPressTimerRef = useRef(null);

  // Xử lý nhấn giữ (Long Press 550ms) vào câu hỏi để mở bảng ghi chú gửi Admin
  const handlePressStart = (question) => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(40);
      setReportingQuestion(question);
    }, 550);
  };

  const handlePressCancel = () => {
    clearTimeout(longPressTimerRef.current);
  };

  const handleBackClick = () => {
    if (!isSubmitted && Object.keys(answers).length > 0) {
      setShowConfirmBack(true);
    } else {
      backToList();
    }
  };

  const handleSelect = (qId, optIndex) => {
    if (isSubmitted) return;
    setAnswers({ ...answers, [qId]: optIndex });
  };

  const scrollToQuestion = (idx) => {
    const element = document.getElementById(`question-${idx}`);
    if (element) {
      const stickyBar = document.querySelector('.mobile-sticky-top');
      const offset = window.innerWidth >= 992 ? 24 : (stickyBar ? stickyBar.offsetHeight + 12 : 120);
      const y = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitted(true);
    const wrongQs = examData.questions.filter(q => answers[q.id] !== q.correct_ans);
    const scoreCount = examData.questions.length - wrongQs.length;

    if (scoreCount / examData.questions.length >= 0.8) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }

    const wrongDetails = wrongQs.map(q => ({
      question: q.question,
      options: [...q.options],
      correct_ans: q.correct_ans,
      user_ans: answers[q.id]
    }));

    try {
      await saveExamHistoryToCloud({
        examId: examData.id,
        title: examData.title,
        score: scoreCount,
        total: examData.questions.length,
        wrongDetails
      });
      fetchHistory();
    } catch (error) {
      console.error("Lỗi lưu lịch sử lên Supabase:", error);
    }
  };

  const handleCreateFromCurrentMistakes = async () => {
    const wrongQs = examData.questions.filter(q => answers[q.id] !== q.correct_ans);
    const newTitle = window.prompt("Vui lòng nhập tên cho đề ôn tập (lưu vào Học phần của tôi):", `Ôn tập câu sai - ${examData.title}`);
    if (!newTitle || !newTitle.trim()) return;

    const rawText = wrongQs.map(q =>
      `${q.question} | ${q.options[0]} | ${q.options[1]} | ${q.options[2]} | ${q.options[3]} | ${q.correct_ans}`
    ).join('\n');

    try {
      const targetSubject = examData.subject || "Chưa phân loại";
      await api.post("/exams/import", {
        title: newTitle.trim(),
        subject: targetSubject,
        raw_text: rawText,
        is_system: false // Luôn lưu đề câu sai vào Note riêng của User theo đúng Môn học
      });
      toast.success(`Đã tạo Note ôn tập trong môn [${targetSubject}]: ${newTitle.trim()}`);
      backToList();
      window.scrollTo(0, 0);
    } catch (error) {
      toast.error("Lỗi khi tạo bài test ôn tập.");
    }
  };

  const wrongQuestions = examData.questions.filter(q => answers[q.id] !== q.correct_ans);
  const score = examData.questions.length - wrongQuestions.length;
  const totalQuestions = examData.questions.length;
  const answeredCount = Object.keys(answers).length;

  const handleCopyQuestion = (q) => {
    const textToCopy = `${q.question}\nA. ${q.options[0]}\nB. ${q.options[1]}\nC. ${q.options[2]}\nD. ${q.options[3]}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.info("📋 Đã sao chép để tra cứu!");
    }).catch(() => {
      toast.error("Lỗi khi sao chép!");
    });
  };

  return (
    <div className="container-fluid mt-3 exam-taking-layout">
      {/* Confirm Back Modal */}
      {showConfirmBack && (
        <div className="modal d-block modal-backdrop-blur" style={{ zIndex: 1050, padding: '10px' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4">
              <div className="modal-header bg-danger text-white border-0">
                <h5 className="modal-title fw-bold">⚠️ Xác nhận thoát</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowConfirmBack(false)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <h5 className="mb-3 text-dark">Bạn đang làm dở bài thi!</h5>
                <p className="text-muted mb-4">Nếu thoát bây giờ, tiến trình của bạn sẽ không được lưu lại. Bạn có muốn nộp bài luôn không?</p>
                <div className="d-flex flex-column gap-2">
                  <button className="btn btn-accent fw-bold rounded-pill" onClick={() => { setShowConfirmBack(false); handleSubmit(); }}>
                    📤 Nộp bài ngay
                  </button>
                  <button className="btn btn-outline-danger fw-bold rounded-pill" onClick={backToList}>
                    🗑️ Hủy bài & Thoát
                  </button>
                  <button className="btn btn-light fw-bold rounded-pill text-muted" onClick={() => setShowConfirmBack(false)}>
                    Tiếp tục làm bài
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thanh điều hướng ghim đỉnh màn hình Mobile / Sidebar phải trên PC */}
      <div className="mobile-sticky-top mb-3 d-print-none">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <button className="btn btn-light border btn-mobile-chip" onClick={handleBackClick}>
            ← Thoát
          </button>
          <div className="text-end">
            <span className="fw-bold small d-block text-truncate exam-sticky-title">
              {examData.title}
            </span>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              Đã chọn: <strong>{answeredCount}/{totalQuestions}</strong> ({Math.round((answeredCount / totalQuestions) * 100)}%)
            </span>
          </div>
        </div>
        <div className="progress-accent mb-2" style={{ height: '6px' }}>
          <div className="progress-bar" role="progressbar" style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}></div>
        </div>
        <div className="question-navigator">
          {examData.questions.map((q, idx) => {
            let btnClass = "btn-outline-secondary bg-white";
            if (isSubmitted) {
              btnClass = answers[q.id] === q.correct_ans ? 'btn-success text-white' : (answers[q.id] ? 'btn-danger text-white' : 'btn-outline-secondary bg-white');
            } else if (answers[q.id]) {
              btnClass = isInstantFeedback
                ? (answers[q.id] === q.correct_ans ? 'btn-success text-white' : 'btn-danger text-white')
                : 'btn-primary text-white';
            }
            return (
              <button
                key={q.id}
                onClick={() => scrollToQuestion(idx)}
                className={`btn nav-question-btn fw-bold ${btnClass}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Cụm nút hành động hiển thị trong Sidebar khi ở trên PC */}
        <div className="desktop-sidebar-actions">
          {!isSubmitted ? (
            <button className="btn btn-accent w-100 mobile-btn-tile" onClick={handleSubmit}>
              📤 Nộp bài ({answeredCount}/{totalQuestions} câu)
            </button>
          ) : (
            <>
              <button
                className="btn btn-warning w-100 mobile-btn-tile text-dark"
                onClick={() => {
                  setAnswers({});
                  setIsSubmitted(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                🔄 Làm lại bài này
              </button>
              {wrongQuestions.length > 0 && (
                <button className="btn btn-accent w-100 mobile-btn-tile" onClick={handleCreateFromCurrentMistakes}>
                  📝 Tạo đề câu sai ({wrongQuestions.length})
                </button>
              )}
              <button className="btn btn-outline-secondary w-100 mobile-btn-tile" onClick={backToList}>
                🏠 Về danh sách đề
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal báo lỗi câu hỏi khi người dùng nhấn giữ */}
      <QuestionReportModal
        show={Boolean(reportingQuestion)}
        onClose={() => setReportingQuestion(null)}
        question={reportingQuestion}
        examId={examData.id}
        examTitle={examData.title}
      />

      {/* Nội dung câu hỏi */}
      <div className="mx-auto exam-questions-col" style={{ maxWidth: '800px' }}>
        <div className="text-muted small mb-2 px-1 d-print-none">
          💡 <em>Mẹo: Nhấn giữ vào bất kỳ câu hỏi nào để ghi chú báo lỗi đáp án cho Admin.</em>
        </div>
        {!isSubmitted ? (
          <>
            {examData.questions.map((q, idx) => (
              <div
                id={`question-${idx}`}
                key={q.id}
                className="bg-white rounded-4 shadow-sm mb-3 p-3 p-md-4"
                onTouchStart={() => handlePressStart(q)}
                onTouchEnd={handlePressCancel}
                onTouchMove={handlePressCancel}
                onMouseDown={() => handlePressStart(q)}
                onMouseUp={handlePressCancel}
                onMouseLeave={handlePressCancel}
              >
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div className="d-flex align-items-start gap-2">
                    <span className="question-number mt-1">{idx + 1}</span>
                    <h5 className="mb-0 fw-bold" style={{ fontSize: '1.05rem', lineHeight: '1.45' }}>{q.question}</h5>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  {q.options.map((opt, oIdx) => {
                    const optNumber = oIdx + 1;
                    const letter = String.fromCharCode(64 + optNumber);
                    let btnClass = "btn-outline-secondary";
                    if (answers[q.id] === optNumber) {
                      btnClass = isInstantFeedback
                        ? (optNumber === q.correct_ans ? 'btn-success text-white' : 'btn-danger text-white')
                        : 'btn-primary text-white';
                    }
                    if (isInstantFeedback && answers[q.id] && optNumber === q.correct_ans) {
                      btnClass = 'btn-success text-white';
                    }

                    return (
                      <div className="col-12 col-sm-6" key={oIdx}>
                        <button
                          className={`btn w-100 answer-option ${btnClass}`}
                          onClick={() => handleSelect(q.id, optNumber)}
                        >
                          <span className="answer-letter">{letter}</span>
                          {opt}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Cụm nút tiện ích dưới chân mỗi câu hỏi */}
                <div className="d-flex justify-content-end gap-2 pt-2 border-top d-print-none">
                  <button className="btn btn-light border btn-mobile-chip text-dark" onClick={() => handleCopyQuestion(q)}>
                    📋 Sao chép
                  </button>
                  <button className="btn btn-warning btn-mobile-chip text-dark" onClick={() => openSaveModal(q)}>
                    ⭐ Lưu câu này
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="mb-4 animate-in">
            <div className={`score-card mb-4 animate-in ${
              score / totalQuestions >= 0.8 ? 'score-card-success' :
              score / totalQuestions >= 0.5 ? 'score-card-warning' : 'score-card-danger'
            }`}>
              <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>
                {score === totalQuestions ? '🏆' : score / totalQuestions >= 0.8 ? '🎉' : score / totalQuestions >= 0.5 ? '💪' : '📖'}
              </div>
              <h3 className="fw-bold mb-1">{score} / {totalQuestions}</h3>
              <p className="mb-0 small" style={{ opacity: 0.95 }}>
                {score === totalQuestions ? 'Tuyệt vời! Điểm tuyệt đối!' :
                 score / totalQuestions >= 0.8 ? 'Xuất sắc! Tiếp tục phát huy!' :
                 score / totalQuestions >= 0.5 ? 'Khá tốt! Cần ôn thêm một chút.' :
                 'Cần ôn luyện thêm nhiều hơn nữa.'}
              </p>
            </div>

            <h5 className="fw-bold mb-3 gradient-text">Chi tiết đáp án:</h5>
            {examData.questions.map((q, idx) => {
              const isCorrect = answers[q.id] === q.correct_ans;
              const cardClass = isCorrect ? 'correct-answer-card' : 'wrong-answer-card';
              return (
                <div
                  id={`question-${idx}`}
                  key={q.id}
                  className={`bg-white ${cardClass} shadow-sm mb-3 p-3 p-md-4`}
                  onTouchStart={() => handlePressStart(q)}
                  onTouchEnd={handlePressCancel}
                  onTouchMove={handlePressCancel}
                  onMouseDown={() => handlePressStart(q)}
                  onMouseUp={handlePressCancel}
                  onMouseLeave={handlePressCancel}
                >
                  <div className="d-flex align-items-start gap-2 mb-3">
                    <span className="question-number mt-1">{idx + 1}</span>
                    <h5 className="mb-0 fw-bold" style={{ fontSize: '1.05rem', lineHeight: '1.45' }}>{q.question}</h5>
                  </div>
                  <div className="row g-2 mb-3">
                    {q.options.map((opt, oIdx) => {
                      const optNumber = oIdx + 1;
                      const letter = String.fromCharCode(64 + optNumber);
                      let btnClass = "btn-outline-secondary";
                      if (optNumber === q.correct_ans) btnClass = 'btn-success text-white';
                      else if (answers[q.id] === optNumber) btnClass = 'btn-danger text-white';

                      return (
                        <div className="col-12 col-sm-6" key={oIdx}>
                          <button
                            className={`btn w-100 answer-option ${btnClass}`}
                            style={{ cursor: 'default', pointerEvents: 'none' }}
                          >
                            <span className="answer-letter">{letter}</span>
                            {opt}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="d-flex justify-content-end gap-2 pt-2 border-top d-print-none">
                    <button className="btn btn-light border btn-mobile-chip text-dark" onClick={() => handleCopyQuestion(q)}>
                      📋 Sao chép
                    </button>
                    {!isCorrect && (
                      <button className="btn btn-warning btn-mobile-chip text-dark" onClick={() => openSaveModal(q)}>
                        ⭐ Lưu câu sai
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Thanh nút bấm ghim cố định ở đáy màn hình Mobile */}
      <div className="mobile-bottom-bar d-print-none">
        <div className="mobile-bottom-bar-inner">
          {!isSubmitted ? (
            <button className="btn btn-accent w-100 mobile-btn-tile" onClick={handleSubmit}>
              📤 Nộp bài ({answeredCount}/{totalQuestions} câu)
            </button>
          ) : (
            <>
              <button
                className="btn btn-warning flex-grow-1 mobile-btn-tile text-dark"
                onClick={() => {
                  setAnswers({});
                  setIsSubmitted(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                🔄 Làm lại
              </button>
              {wrongQuestions.length > 0 && (
                <button className="btn btn-accent flex-grow-1 mobile-btn-tile" onClick={handleCreateFromCurrentMistakes}>
                  📝 Đề câu sai ({wrongQuestions.length})
                </button>
              )}
              <button className="btn btn-secondary mobile-btn-tile px-3" onClick={backToList}>
                🏠
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExamTaking;