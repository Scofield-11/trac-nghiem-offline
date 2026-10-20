import { supabase } from './supabaseClient';

const EXAMS_LIST_CACHE_KEY = 'exams_list_cache';
const HISTORY_CACHE_KEY = 'exam_history_cache';
const AUTH_USER_CACHE_KEY = 'cached_auth_user';
const USER_PROFILE_CACHE_KEY = 'cached_user_profile';
const getExamCacheKey = (id) => `exam_cache_${id}`;

export const getCachedAuthUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCachedAuthUser = (userObj) => {
  try {
    if (userObj) localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(userObj));
    else localStorage.removeItem(AUTH_USER_CACHE_KEY);
  } catch {
    // Ignore
  }
};

export const getCachedUserProfile = () => {
  try {
    const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCachedUserProfile = (profileObj) => {
  try {
    if (profileObj) localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profileObj));
    else localStorage.removeItem(USER_PROFILE_CACHE_KEY);
  } catch {
    // Ignore
  }
};

const createError = (detailMessage) => ({
  response: { data: { detail: detailMessage } }
});

// ================= CACHE-FIRST & OFFLINE HELPERS (0ms UX) =================
export const getCachedExamsList = () => {
  try {
    return JSON.parse(localStorage.getItem(EXAMS_LIST_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setCachedExamsList = (list) => {
  try {
    localStorage.setItem(EXAMS_LIST_CACHE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedExamById = (id) => {
  try {
    const raw = localStorage.getItem(getExamCacheKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const setCachedExamById = (id, examData) => {
  try {
    localStorage.setItem(getExamCacheKey(id), JSON.stringify(examData));
  } catch {
    // Ignore storage quota errors
  }
};

export const getCachedHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
};

const setCachedHistory = (historyList) => {
  try {
    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(historyList));
  } catch {
    // Ignore storage quota errors
  }
};

export const clearAllExamCaches = () => {
  try {
    localStorage.removeItem(EXAMS_LIST_CACHE_KEY);
    localStorage.removeItem(HISTORY_CACHE_KEY);
    localStorage.removeItem(AUTH_USER_CACHE_KEY);
    localStorage.removeItem(USER_PROFILE_CACHE_KEY);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('exam_cache_')) {
        localStorage.removeItem(key);
      }
    });
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
    if (parts.length === 6 || parts.length === 7) {
      const qObj = {
        id: Date.now() + idx + Math.floor(Math.random() * 10000),
        question: parts[0],
        options: [parts[1], parts[2], parts[3], parts[4]],
        correct_ans: parseInt(parts[5], 10) || 1
      };
      if (parts[6]) {
        qObj.image = parts[6];
      }
      questions.push(qObj);
    }
  });

  if (questions.length < 1) {
    throw createError("Bài thi phải có tối thiểu 1 câu hỏi hợp lệ (có đủ 6 phần cách nhau bởi dấu |)");
  }

  return questions;
};

const normalizeSubject = (s) => (s && String(s).trim() ? String(s).trim() : 'Chưa phân loại');

const mapExamSummary = (row) => ({
  id: row.id,
  title: row.title,
  subject: normalizeSubject(row.subject),
  questionCount: row.question_count ?? 0,
  is_system: Boolean(row.is_system),
  owner_id: row.owner_id,
  created_at: row.created_at
});

const api = {
  get: async (url) => {
    // 1. Lấy danh sách đề: Nếu đang Offline thì trả ngay từ localStorage
    if (url === "/exams") {
      if (!navigator.onLine) {
        return { data: getCachedExamsList() };
      }

      const { data, error } = await supabase
        .from('exams')
        .select('id, title, subject, question_count, is_system, owner_id, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        const fallback = getCachedExamsList();
        if (fallback.length > 0) return { data: fallback };
        throw createError(error.message || "Không thể tải danh sách đề thi");
      }

      const mapped = (data || []).map(mapExamSummary);
      setCachedExamsList(mapped);

      // Tự động tải ngầm nội dung câu hỏi của các đề chưa có trong máy để sẵn sàng dùng Offline
      const missingIds = mapped
        .filter((item) => !getCachedExamById(item.id))
        .map((item) => item.id);

      if (missingIds.length > 0) {
        supabase
          .from('exams')
          .select('*')
          .in('id', missingIds)
          .then(({ data: fullExams }) => {
            (fullExams || []).forEach((item) => {
              setCachedExamById(item.id, {
                id: item.id,
                title: item.title,
                subject: normalizeSubject(item.subject),
                questions: Array.isArray(item.questions) ? item.questions : [],
                questionCount:
                  item.question_count ??
                  (Array.isArray(item.questions) ? item.questions.length : 0),
                is_system: Boolean(item.is_system),
                owner_id: item.owner_id,
                created_at: item.created_at,
              });
            });
          })
          .catch(() => {});
      }

      return { data: mapped };
    }

    // 2. Lấy chi tiết 1 đề thi: Kiểm tra sessionStorage trước (0ms), nếu chưa có mới gọi Supabase
    if (url.startsWith("/exams/")) {
      const id = Number(url.split("/")[2]);
      const cached = getCachedExamById(id);
      if (cached && Array.isArray(cached.questions)) {
        return { data: { ...cached, subject: normalizeSubject(cached.subject) } };
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
        subject: normalizeSubject(data.subject),
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

      const subject = normalizeSubject(payload?.subject);
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
          subject,
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
        subject: normalizeSubject(data.subject || subject),
        questions: data.questions || questions,
        questionCount: data.question_count ?? questions.length,
        is_system: Boolean(data.is_system),
        owner_id: data.owner_id,
        created_at: data.created_at
      };

      // Cập nhật ngay vào cache để mở trong 0ms
      setCachedExamById(data.id, fullExam);
      const currentList = getCachedExamsList();
      setCachedExamsList([mapExamSummary({ ...data, subject: fullExam.subject, question_count: fullExam.questionCount }), ...currentList]);

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
      const updateFields = { title, questions };
      if (payload?.subject !== undefined) {
        updateFields.subject = normalizeSubject(payload.subject);
      }

      const { data, error } = await supabase
        .from('exams')
        .update(updateFields)
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) throw createError(error?.message || "Không thể cập nhật bài thi");

      const updatedExam = {
        id: data.id,
        title: data.title,
        subject: normalizeSubject(data.subject),
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
            ? { ...item, title: updatedExam.title, subject: updatedExam.subject, questionCount: updatedExam.questionCount }
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

      localStorage.removeItem(getExamCacheKey(id));
      const currentList = getCachedExamsList();
      setCachedExamsList(currentList.filter(e => Number(e.id) !== id));

      return { data: { message: "Đã xóa bài thi" } };
    }
    throw createError("Đường dẫn không hợp lệ");
  }
};

// ================= ĐỒNG BỘ DỮ LIỆU OFFLINE & CẬP NHẬT PWA =================
export const syncAllDataForOffline = async () => {
  // 1. Lấy toàn bộ đề thi mà user có quyền xem để lưu vào localStorage dùng Offline
  const { data: allExams, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message || 'Không thể đồng bộ dữ liệu từ đám mây!');

  const summaries = (allExams || []).map(mapExamSummary);
  setCachedExamsList(summaries);

  (allExams || []).forEach((item) => {
    setCachedExamById(item.id, {
      id: item.id,
      title: item.title,
      subject: normalizeSubject(item.subject),
      questions: Array.isArray(item.questions) ? item.questions : [],
      questionCount: item.question_count ?? (Array.isArray(item.questions) ? item.questions.length : 0),
      is_system: Boolean(item.is_system),
      owner_id: item.owner_id,
      created_at: item.created_at,
    });
  });

  // 2. Đồng bộ lịch sử làm bài
  await fetchExamHistoryFromCloud();

  // 3. Kiểm tra và kích hoạt bản cập nhật PWA Service Worker (nếu có)
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  }

  return summaries;
};

// ================= BÁO LỖI CÂU HỎI & ADMIN XỬ LÝ =================
export const submitQuestionReport = async ({ examId, examTitle, question, note }) => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error('Vui lòng đăng nhập để gửi báo lỗi!');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', user.id)
    .single();

  const senderName = profileData?.full_name || profileData?.username || user.email?.split('@')[0] || 'Học viên';

  const { error } = await supabase.from('question_reports').insert([{
    exam_id: Number(examId),
    exam_title: examTitle,
    question_id: Number(question.id) || 0,
    question_text: question.question,
    options: question.options,
    current_correct_ans: Number(question.correct_ans) || 1,
    user_id: user.id,
    username: senderName,
    note,
    status: 'pending'
  }]);

  if (error) throw new Error(error.message || 'Không thể gửi báo lỗi!');
};

export const fetchQuestionReports = async () => {
  const { data, error } = await supabase
    .from('question_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const resolveAndFixQuestionReport = async ({
  reportId,
  examId,
  questionId,
  originalQuestionText,
  updatedQuestionText,
  updatedOptions,
  updatedCorrectAns
}) => {
  // 1. Lấy đề thi gốc từ Supabase
  const { data: examData, error: fetchErr } = await supabase
    .from('exams')
    .select('*')
    .eq('id', Number(examId))
    .single();

  if (fetchErr || !examData) {
    throw new Error('Không tìm thấy học phần gốc để cập nhật!');
  }

  // 2. Tìm và cập nhật câu hỏi bị sai trong mảng questions
  const updatedQuestions = (examData.questions || []).map((q) => {
    const isMatched =
      (Number(q.id) && Number(q.id) === Number(questionId)) ||
      q.question?.trim() === originalQuestionText?.trim();

    if (isMatched) {
      return {
        ...q,
        question: updatedQuestionText.trim(),
        options: updatedOptions.map((o) => String(o).trim()),
        correct_ans: Number(updatedCorrectAns)
      };
    }
    return q;
  });

  // 3. Lưu lại mảng questions vào bảng exams
  const { data: savedExam, error: updateExamErr } = await supabase
    .from('exams')
    .update({ questions: updatedQuestions })
    .eq('id', Number(examId))
    .select('*')
    .single();

  if (updateExamErr) throw new Error(updateExamErr.message || 'Lỗi khi lưu đáp án mới!');

  // Cập nhật ngay vào localStorage cache
  setCachedExamById(examId, {
    id: savedExam.id,
    title: savedExam.title,
    questions: savedExam.questions || updatedQuestions,
    questionCount: savedExam.question_count ?? updatedQuestions.length,
    is_system: Boolean(savedExam.is_system),
    owner_id: savedExam.owner_id,
    created_at: savedExam.created_at
  });

  // 4. Đánh dấu báo cáo đã xử lý
  const { error: reportErr } = await supabase
    .from('question_reports')
    .update({ status: 'resolved', current_correct_ans: Number(updatedCorrectAns) })
    .eq('id', reportId);

  if (reportErr) throw new Error(reportErr.message || 'Lỗi cập nhật trạng thái báo cáo!');
};

export const deleteQuestionReport = async (reportId) => {
  const { error } = await supabase
    .from('question_reports')
    .delete()
    .eq('id', reportId);
  if (error) throw error;
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
    version: 3,
    exportedAt: new Date().toISOString(),
    exams: (examsData || []).map(e => ({
      id: e.id,
      title: e.title,
      subject: normalizeSubject(e.subject),
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

export const exportSingleExamToJson = (title, questions, subject = 'Chưa phân loại') => {
  const examData = {
    title: title || "De_thi",
    subject: normalizeSubject(subject),
    questions: questions.map((q, idx) => ({
      id: q.id || idx + 1,
      question: q.question,
      options: q.options,
      correct_ans: Number(q.correct_ans) || 1,
      ...(q.image ? { image: q.image } : {})
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

export const renameSubjectFolder = async (oldSubject, newSubject, isSystem) => {
  const cleanNew = normalizeSubject(newSubject);
  const examIds = getCachedExamsList()
    .filter(e => Boolean(e.is_system) === Boolean(isSystem) && normalizeSubject(e.subject) === oldSubject)
    .map(e => Number(e.id));

  if (examIds.length === 0) return;

  const { error } = await supabase
    .from('exams')
    .update({ subject: cleanNew })
    .in('id', examIds);

  if (error) throw new Error(error.message || 'Không thể đổi tên môn học!');

  const currentList = getCachedExamsList();
  setCachedExamsList(
    currentList.map(item =>
      examIds.includes(Number(item.id)) ? { ...item, subject: cleanNew } : item
    )
  );

  examIds.forEach(id => {
    const cached = getCachedExamById(id);
    if (cached) {
      setCachedExamById(id, { ...cached, subject: cleanNew });
    }
  });
};

const normalizeExamObject = (rawExam, indexOffset = 0, fallbackSubject = 'Chưa phân loại') => {
  if (!rawExam || !rawExam.title || !Array.isArray(rawExam.questions)) return null;

  const validQuestions = rawExam.questions
    .filter(q => q && q.question && Array.isArray(q.options) && q.options.length >= 4)
    .map((q, idx) => ({
      id: Date.now() + indexOffset * 1000 + idx + Math.floor(Math.random() * 1000),
      question: String(q.question).trim(),
      options: q.options.slice(0, 4).map(opt => String(opt).trim()),
      correct_ans: Number(q.correct_ans) >= 1 && Number(q.correct_ans) <= 4 ? Number(q.correct_ans) : 1,
      ...(q.image && String(q.image).trim() ? { image: String(q.image).trim() } : {})
    }));

  if (validQuestions.length === 0) return null;

  return {
    title: String(rawExam.title).trim(),
    subject: normalizeSubject(rawExam.subject || fallbackSubject),
    questions: validQuestions
  };
};

export const importDataFromJsonFile = (file, isSystem = false, defaultSubject = 'Chưa phân loại') => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        let importedExams = [];

        if (parsed && Array.isArray(parsed.exams)) {
          importedExams = parsed.exams
            .map((e, i) => normalizeExamObject(e, i, defaultSubject))
            .filter(Boolean);
        } else if (Array.isArray(parsed)) {
          importedExams = parsed
            .map((e, i) => normalizeExamObject(e, i, defaultSubject))
            .filter(Boolean);
        } else if (parsed && parsed.title && Array.isArray(parsed.questions)) {
          const single = normalizeExamObject(parsed, 0, defaultSubject);
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
          subject: normalizeSubject(exam.subject),
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