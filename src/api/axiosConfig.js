import { supabase } from './supabaseClient';

const EXAMS_LIST_CACHE_KEY = 'exams_list_cache';
const HISTORY_CACHE_KEY = 'exam_history_cache';
const getExamCacheKey = (id) => `exam_cache_${id}`;

const createError = (detailMessage) => ({
  response: { data: { detail: detailMessage } }
});

// ================= CACHE-FIRST HELPERS (0ms UX) =================
export const getCachedExamsList = () => {
  try {
    return JSON.parse(sessionStorage.getItem(EXAMS_LIST_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setCachedExamsList = (list) => {
  try {
    sessionStorage.setItem(EXAMS_LIST_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedExamById = (id) => {
  try {
    const raw = sessionStorage.getItem(getExamCacheKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedExamById = (id, examData) => {
  try {
    sessionStorage.setItem(getExamCacheKey(id), JSON.stringify(examData));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedHistory = () => {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setCachedHistory = (historyList) => {
  try {
    sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(historyList));
  } catch {
    // Ignore storage quota errors
  }
};

export const clearAllExamCaches = () => {
  try {
    sessionStorage.clear();
  } catch {
    // Ignore
  }
};

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

const mapExamSummary = (row) => ({
  id: row.id,
  title: row.title,
  questionCount: row.question_count ?? 0,
  is_system: Boolean(row.is_system),
  owner_id: row.owner_id,
  created_at: row.created_at
});

const api = {
  get: async (url) => {
    // 1. Lấy danh sách đề: TUYỆT ĐỐI KHÔNG select cột questions để phản hồi tức thì
    if (url === "/exams") {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, question_count, is_system, owner_id, created_at')
        .order('created_at', { ascending: false });

      if (error) throw createError(error.message || "Không thể tải danh sách đề thi");

      const mapped = (data || []).map(mapExamSummary);
      setCachedExamsList(mapped);
      return { data: mapped };
    }

    // 2. Lấy chi tiết 1 đề thi: Kiểm tra sessionStorage trước (0ms), nếu chưa có mới gọi Supabase
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const cached = getCachedExamById(id);
      if (cached && Array.isArray(cached.questions)) {
        return { data: cached };
      }

      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) throw createError("Không tìm thấy bài thi hoặc bạn không có quyền truy cập");

      const examDetail = {
        id: data.id,
        title: data.title,
        questions: Array.isArray(data.questions) ? data.questions : [],
        questionCount: data.question_count ?? (Array.isArray(data.questions) ? data.questions.length : 0),
        is_system: Boolean(data.is_system),
        owner_id: data.owner_id,
        created_at: data.created_at
      };

      setCachedExamById(id, examDetail);
      return { data: examDetail };
    }

    throw createError("Đường dẫn không hợp lệ");
  },

  post: async (url, payload) => {
    if (url === "/exams/import") {
      const title = payload?.title?.trim();
      if (!title) throw createError("Tên bài thi không được để trống");

      const questions = parseRawTextToQuestions(payload.raw_text);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw createError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!");

      // Mặc định luôn là false (Note của User), chỉ true khi Admin chủ động tạo ở Tab Hệ Thống
      const isSystem = Boolean(payload?.is_system);

      const { data, error } = await supabase
        .from('exams')
        .insert([{
          title,
          questions,
          owner_id: user.id,
          is_system: isSystem
        }])
        .select('*')
        .single();

      if (error) throw createError(error.message || "Lỗi tạo đề thi trên Supabase");

      const fullExam = {
        id: data.id,
        title: data.title,
        questions: data.questions || questions,
        questionCount: data.question_count ?? questions.length,
        is_system: Boolean(data.is_system),
        owner_id: data.owner_id,
        created_at: data.created_at
      };

      // Cập nhật ngay vào cache để mở trong 0ms
      setCachedExamById(data.id, fullExam);
      const currentList = getCachedExamsList();
      setCachedExamsList([mapExamSummary({ ...data, question_count: fullExam.questionCount }), ...currentList]);

      return { data: { message: "Tạo bài test thành công", exam_id: data.id } };
    }
    throw createError("Đường dẫn không hợp lệ");
  },

  put: async (url, payload) => {
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const title = payload?.title?.trim();
      if (!title) throw createError("Tên bài thi không được để trống");

      const questions = parseRawTextToQuestions(payload.raw_text);

      const { data, error } = await supabase
        .from('exams')
        .update({ title, questions })
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) throw createError(error?.message || "Không thể cập nhật bài thi");

      const updatedExam = {
        id: data.id,
        title: data.title,
        questions: data.questions || questions,
        questionCount: data.question_count ?? questions.length,
        is_system: Boolean(data.is_system),
        owner_id: data.owner_id,
        created_at: data.created_at
      };

      // Ghi đè cache chi tiết đề thi và danh sách đề thi ngay lập tức
      setCachedExamById(id, updatedExam);
      const currentList = getCachedExamsList();
      setCachedExamsList(
        currentList.map(item =>
          Number(item.id) === id
            ? { ...item, title: updatedExam.title, questionCount: updatedExam.questionCount }
            : item
        )
      );

      return { data: { message: "Cập nhật thành công" } };
    }
    throw createError("Đường dẫn không hợp lệ");
  },

  delete: async (url) => {
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', id);

      if (error) throw createError(error.message || "Không thể xóa bài thi");

      sessionStorage.removeItem(getExamCacheKey(id));
      const currentList = getCachedExamsList();
      setCachedExamsList(currentList.filter(e => Number(e.id) !== id));

      return { data: { message: "Đã xóa bài thi" } };
    }
    throw createError("Đường dẫn không hợp lệ");
  }
};

// ================= LỊCH SỬ LÀM BÀI SUPABASE CLOUD =================
const formatHistoryRow = (row) => ({
  id: row.id,
  examId: row.exam_id,
  title: row.title,
  score: row.score,
  total: row.total,
  date: new Date(row.created_at).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }),
  wrongDetails: Array.isArray(row.wrong_details) ? row.wrong_details : []
});

export const fetchExamHistoryFromCloud = async () => {
  const { data, error } = await supabase
    .from('exam_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  const formatted = (data || []).map(formatHistoryRow);
  setCachedHistory(formatted);
  return formatted;
};

export const saveExamHistoryToCloud = async ({ examId, title, score, total, wrongDetails }) => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('exam_history')
    .insert([{
      user_id: user.id,
      exam_id: examId,
      title,
      score,
      total,
      wrong_details: wrongDetails
    }])
    .select('*')
    .single();

  if (error) throw error;

  const formattedRow = formatHistoryRow(data);
  const current = getCachedHistory();
  setCachedHistory([formattedRow, ...current].slice(0, 50));
  return formattedRow;
};

export const clearExamHistoryOnCloud = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const { error } = await supabase
    .from('exam_history')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
  setCachedHistory([]);
};

// ================= XUẤT / NHẬP JSON VỚI SUPABASE =================
export const exportAllDataToJson = async (onlyPersonal = true) => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;

  let query = supabase.from('exams').select('*').order('created_at', { ascending: false });
  if (onlyPersonal && user) {
    query = query.eq('is_system', false).eq('owner_id', user.id);
  }

  const { data: examsData } = await query;

  const backupData = {
    version: 2,
    exportedAt: new Date().toISOString(),
    exams: (examsData || []).map(e => ({
      id: e.id,
      title: e.title,
      questions: e.questions || []
    })),
    history: getCachedHistory()
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
    title: String(rawExam.title).trim(),
    questions: validQuestions
  };
};

export const importDataFromJsonFile = (file, isSystem = false) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        let importedExams = [];

        if (parsed && Array.isArray(parsed.exams)) {
          importedExams = parsed.exams
            .map((e, i) => normalizeExamObject(e, i))
            .filter(Boolean);
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

        if (importedExams.length === 0) {
          return reject(new Error("Không tìm thấy đề thi hoặc câu hỏi hợp lệ trong file JSON!"));
        }

        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return reject(new Error("Vui lòng đăng nhập trước khi nhập file JSON!"));

        const rowsToInsert = importedExams.map(exam => ({
          title: exam.title,
          questions: exam.questions,
          owner_id: user.id,
          is_system: Boolean(isSystem)
        }));

        const { data, error } = await supabase
          .from('exams')
          .insert(rowsToInsert)
          .select('id, title, question_count, is_system, owner_id, created_at');

        if (error) return reject(new Error(error.message || "Lỗi lưu đề thi lên Cloud!"));

        const currentList = getCachedExamsList();
        const newlyAdded = (data || []).map(mapExamSummary);
        setCachedExamsList([...newlyAdded, ...currentList]);

        resolve({
          addedExams: importedExams.length,
          addedHistory: 0
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