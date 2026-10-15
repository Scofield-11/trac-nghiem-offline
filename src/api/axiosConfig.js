const EXAMS_STORAGE_KEY = 'scofieldExamsData';
const HISTORY_STORAGE_KEY = 'scofieldExamHistory';

const getStoredExams = () => {
  try {
    return JSON.parse(localStorage.getItem(EXAMS_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveStoredExams = (exams) => {
  localStorage.setItem(EXAMS_STORAGE_KEY, JSON.stringify(exams));
};

const createError = (detailMessage) => ({
  response: { data: { detail: detailMessage } }
});

const parseRawTextToQuestions = (rawText) => {
  if (!rawText || !String(rawText).trim()) {
    throw createError("Nội dung bài thi không được để trống");
  }

  const lines = String(rawText).trim().split('\n');
  const questions = [];

  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const parts = line.split('|').map(p => p.trim());
    if (parts.length === 6) {
      questions.push({
        id: Date.now() + idx + Math.floor(Math.random() * 10000),
        question: parts[0],
        options: [parts[1], parts[2], parts[3], parts[4]],
        correct_ans: parseInt(parts[5], 10) || 1
      });
    }
  });

  if (questions.length < 1) {
    throw createError("Bài thi phải có tối thiểu 1 câu hỏi hợp lệ (có đủ 6 phần cách nhau bởi dấu |)");
  }

  return questions;
};

const api = {
  get: async (url) => {
    const exams = getStoredExams();

    if (url === "/exams") {
      return {
        data: exams.map(({ id, title, questions }) => ({
          id,
          title,
          questionCount: questions ? questions.length : 0
        }))
      };
    }

    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const exam = exams.find(e => Number(e.id) === id);
      if (!exam) throw createError("Không tìm thấy bài thi");
      return { data: exam };
    }

    throw createError("Đường dẫn không hợp lệ");
  },

  post: async (url, payload) => {
    if (url === "/exams/import") {
      const title = payload?.title?.trim();
      if (!title) throw createError("Tên bài thi không được để trống");

      const questions = parseRawTextToQuestions(payload.raw_text);
      const exams = getStoredExams();

      const newExam = {
        id: Date.now(),
        title,
        questions
      };

      exams.unshift(newExam);
      saveStoredExams(exams);
      return { data: { message: "Tạo bài test thành công", exam_id: newExam.id } };
    }
    throw createError("Đường dẫn không hợp lệ");
  },

  put: async (url, payload) => {
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const title = payload?.title?.trim();
      if (!title) throw createError("Tên bài thi không được để trống");

      const questions = parseRawTextToQuestions(payload.raw_text);
      const exams = getStoredExams();
      const index = exams.findIndex(e => Number(e.id) === id);

      if (index === -1) throw createError("Không tìm thấy bài thi");

      exams[index] = {
        ...exams[index],
        title,
        questions
      };

      saveStoredExams(exams);
      return { data: { message: "Cập nhật thành công" } };
    }
    throw createError("Đường dẫn không hợp lệ");
  },

  delete: async (url) => {
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const exams = getStoredExams();
      const filtered = exams.filter(e => Number(e.id) !== id);
      saveStoredExams(filtered);
      return { data: { message: "Đã xóa bài thi" } };
    }
    throw createError("Đường dẫn không hợp lệ");
  }
};

export const exportAllDataToJson = () => {
  const backupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exams: getStoredExams(),
    history: JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]')
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `trac_nghiem_backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportSingleExamToJson = (title, questions) => {
  const examData = {
    title: title || "De_thi",
    questions: questions.map((q, idx) => ({
      id: q.id || idx + 1,
      question: q.question,
      options: q.options,
      correct_ans: Number(q.correct_ans) || 1
    }))
  };

  const blob = new Blob([JSON.stringify(examData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(title || 'De_thi').replace(/\s+/g, '_')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeExamObject = (rawExam, indexOffset = 0) => {
  if (!rawExam || !rawExam.title || !Array.isArray(rawExam.questions)) return null;

  const validQuestions = rawExam.questions
    .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 4)
    .map((q, idx) => ({
      id: Date.now() + indexOffset * 1000 + idx + Math.floor(Math.random() * 1000),
      question: String(q.question).trim(),
      options: q.options.slice(0, 4).map(opt => String(opt).trim()),
      correct_ans: Number(q.correct_ans) >= 1 && Number(q.correct_ans) <= 4 ? Number(q.correct_ans) : 1
    }));

  if (validQuestions.length === 0) return null;

  return {
    id: Date.now() + indexOffset + Math.floor(Math.random() * 1000),
    title: String(rawExam.title).trim(),
    questions: validQuestions
  };
};

export const importDataFromJsonFile = (file, overwrite = false) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const currentExams = overwrite ? [] : getStoredExams();
        let importedExams = [];
        let importedHistoryCount = 0;

        if (parsed && Array.isArray(parsed.exams)) {
          importedExams = parsed.exams
            .map((e, i) => normalizeExamObject(e, i))
            .filter(Boolean);

          if (Array.isArray(parsed.history)) {
            const currentHistory = overwrite
              ? []
              : JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
            const mergedHistory = [...parsed.history, ...currentHistory].slice(0, 100);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(mergedHistory));
            importedHistoryCount = parsed.history.length;
          }
        } else if (Array.isArray(parsed)) {
          importedExams = parsed
            .map((e, i) => normalizeExamObject(e, i))
            .filter(Boolean);
        } else if (parsed && parsed.title && Array.isArray(parsed.questions)) {
          const single = normalizeExamObject(parsed, 0);
          if (single) importedExams.push(single);
        } else {
          return reject(new Error("Cấu trúc file JSON không đúng định dạng đề thi!"));
        }

        if (importedExams.length === 0 && importedHistoryCount === 0) {
          return reject(new Error("Không tìm thấy đề thi hoặc câu hỏi hợp lệ trong file JSON!"));
        }

        const updatedExams = [...importedExams, ...currentExams];
        saveStoredExams(updatedExams);

        resolve({
          addedExams: importedExams.length,
          addedHistory: importedHistoryCount
        });
      } catch {
        reject(new Error("File JSON bị lỗi cú pháp hoặc không thể đọc được!"));
      }
    };
    reader.onerror = () => reject(new Error("Không thể đọc file trên thiết bị này!"));
    reader.readAsText(file);
  });
};

export default api;