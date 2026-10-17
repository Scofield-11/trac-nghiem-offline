import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Thiếu cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env");
}

// 1. Client chính dùng cho toàn bộ ứng dụng
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// 2. Client phụ độc lập dành riêng cho Admin khi tạo tài khoản học viên mới (không làm văng session của Admin)
export const tempSupabaseAdminClient = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-temp-admin-signup-token',
  },
});

// Chuẩn hóa username thành email nội bộ nếu không có ký tự @
export const formatLoginEmail = (usernameOrEmail) => {
  const clean = String(usernameOrEmail || '').trim().toLowerCase();
  if (!clean) return '';
  return clean.includes('@') ? clean : `${clean}@tracnghiem.local`;
};