const BASE = "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("knotty_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("knotty_refresh");
}

let _refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (!res.ok) return null;
    localStorage.setItem("knotty_token", json.accessToken);
    localStorage.setItem("knotty_refresh", json.refreshToken);
    return json.accessToken as string;
  } catch {
    return null;
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem("knotty_token");
  localStorage.removeItem("knotty_refresh");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

const SKIP_REFRESH = ["/auth/login", "/auth/refresh-token"];

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers),
  });

  // Auto-refresh on 401 for all routes except auth endpoints
  if (res.status === 401 && !SKIP_REFRESH.some((p) => path.startsWith(p))) {
    // Deduplicate concurrent refresh calls
    if (!_refreshing) _refreshing = refreshAccessToken().finally(() => { _refreshing = null; });
    const newToken = await _refreshing;

    if (!newToken) { clearSessionAndRedirect(); throw new Error("Session expired. Please log in again."); }

    // Retry original request with new token
    const retry = await fetch(`${BASE}${path}`, {
      ...options,
      headers: buildHeaders(newToken, options.headers),
    });
    const retryJson = await retry.json();
    if (!retry.ok) throw new Error(retryJson.message || `Request failed: ${retry.status}`);
    return retryJson as T;
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Request failed: ${res.status}`);
  return json as T;
}

async function requestBlob(path: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) {
    if (!_refreshing) _refreshing = refreshAccessToken().finally(() => { _refreshing = null; });
    const newToken = await _refreshing;
    if (!newToken) { clearSessionAndRedirect(); throw new Error("Session expired."); }
    const retry = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retry.ok) throw new Error(`Request failed: ${retry.status}`);
    return retry.blob();
  }

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.blob();
}

// ─── Auth ────────────────────────────────────────────────
export interface LoginResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: string;
    school_id: string;
    first_name: string;
    last_name: string;
    email: string;
    profile_photo: string | null;
  };
}

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ success: boolean; user: LoginResponse["user"] }>("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
};

// ─── Schools ─────────────────────────────────────────────
export interface DashboardStats {
  total_students: number;
  total_teachers: number;
  present_today: number;
  fee_collected: number;
  canteen_revenue_today: number;
  canteen_transactions_today: number;
  low_balance_cards: number;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absence: number;
}

export const schools = {
  stats: (schoolId: string) =>
    request<{ success: boolean; data: DashboardStats }>(`/schools/${schoolId}/dashboard-stats`),
  trend: (schoolId: string, days = 9) =>
    request<{ success: boolean; data: AttendanceTrendPoint[] }>(`/schools/${schoolId}/attendance-trend?days=${days}`),
};

// ─── Structure (Levels & Classes) ────────────────────────
export interface Level { id: string; name: string; description?: string; _count?: { classes: number; students: number } }
export interface Class { id: string; name: string; level: Level; academic_year?: string; _count?: { students: number } }

export interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export const structure = {
  levels: () => request<{ success: boolean; data: Level[] }>("/structure/levels"),
  createLevel: (data: { name: string; description?: string; order_index?: number }) =>
    request<{ success: boolean; data: Level }>("/structure/levels", { method: "POST", body: JSON.stringify(data) }),
  deleteLevel: (id: string) => request(`/structure/levels/${id}`, { method: "DELETE" }),
  classes: () => request<{ success: boolean; data: Class[] }>("/structure/classes"),
  createClass: (data: { name: string; level_id: string; academic_year?: string }) =>
    request<{ success: boolean; data: Class }>("/structure/classes", { method: "POST", body: JSON.stringify(data) }),
  deleteClass: (id: string) => request(`/structure/classes/${id}`, { method: "DELETE" }),
  classStudents: (classId: string) =>
    request<{ success: boolean; data: StudentBase[] }>(`/structure/classes/${classId}/students`),
  staff: () => request<{ success: boolean; data: StaffMember[] }>("/structure/staff"),
  createStaff: (data: { email: string; first_name: string; last_name: string; role: string; password: string }) =>
    request<{ success: boolean; data: StaffMember }>("/structure/staff", { method: "POST", body: JSON.stringify(data) }),
  toggleStaff: (id: string) => request<{ success: boolean; data: { id: string; is_active: boolean } }>(`/structure/staff/${id}/toggle`, { method: "PUT" }),
};

// ─── Students ────────────────────────────────────────────
export interface StudentBase {
  id: string;
  student_code: string;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  user: { first_name: string; last_name: string; email: string; phone: string | null; profile_photo: string | null };
  level: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  card: { id: string; card_number: string; wallet_balance: number; is_active: boolean; is_frozen: boolean; nfc_uid: string | null; qr_code: string; expires_at: string } | null;
}

export type Student = StudentBase;

export interface StudentListResponse {
  success: boolean;
  data: Student[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface FullProfile extends StudentBase {
  parent: { first_name: string; last_name: string; phone: string; email: string } | null;
  attendances: AttendanceRecord[];
  reports: AcademicReport[];
  health: HealthRecord[];
  discipline: DisciplineRecord[];
  achievements: Achievement[];
}

export const students = {
  list: (params?: { page?: number; limit?: number; search?: string; classId?: string; levelId?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<StudentListResponse>(`/students${qs ? `?${qs}` : ""}`);
  },
  getOne: (id: string) => request<{ success: boolean; data: StudentBase }>(`/students/${id}`),
  fullProfile: (id: string) => request<{ success: boolean; data: FullProfile }>(`/students/${id}/full-profile`),
  create: (data: Record<string, unknown>) =>
    request<{ success: boolean; data: StudentBase }>("/students", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ success: boolean; data: StudentBase }>(`/students/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id: string) => request(`/students/${id}`, { method: "DELETE" }),
};

// ─── Attendance ───────────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  check_in_time: string | null;
  check_out_time: string | null;
  note: string | null;
  action?: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT";
  tap_out_available_at?: string | null;
  card_number?: string;
}

export interface CardScanFull {
  card_number: string;
  wallet_balance: number;
  issued_at: string;
  expires_at: string;
  is_frozen: boolean;
  student: {
    id: string;
    name: string;
    photo: string | null;
    class: string;
    student_code: string;
    school_name: string;
    school_logo: string | null;
  };
  today_attendance: string | null;
  tap_out_available_at: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
}

export interface AttendanceSettings {
  tap_out_after_minutes: number;
  school_start_time: string;
}

export interface AttendanceTodaySummary {
  summary: { PRESENT: number; ABSENT: number; LATE: number; EXCUSED: number };
  total: number;
  recent: Array<{
    status: string;
    check_in_time: string | null;
    student: { user: { first_name: string; last_name: string; profile_photo: string | null }; class: { name: string } | null };
  }>;
}

export const attendance = {
  scan: (card_number: string) =>
    request<{ success: boolean; data: AttendanceRecord }>("/attendance/scan", { method: "POST", body: JSON.stringify({ card_number }) }),
  scanNFC: (nfc_uid: string) =>
    request<{ success: boolean; data: AttendanceRecord }>("/attendance/scan-nfc", { method: "POST", body: JSON.stringify({ nfc_uid }) }),
  getSettings: () =>
    request<{ success: boolean; data: AttendanceSettings }>("/schools/settings/attendance"),
  updateSettings: (data: Partial<AttendanceSettings>) =>
    request<{ success: boolean; data: AttendanceSettings }>("/schools/settings/attendance", { method: "PUT", body: JSON.stringify(data) }),
  bulk: (class_id: string, records: { student_id: string; status: string; note?: string }[]) =>
    request<{ success: boolean; data: AttendanceRecord[]; count: number }>("/attendance/bulk", { method: "POST", body: JSON.stringify({ class_id, records }) }),
  todaySummary: () =>
    request<{ success: boolean } & AttendanceTodaySummary>("/attendance/today-summary"),
  byStudent: (studentId: string, page = 1, limit = 30) =>
    request<{ success: boolean; data: AttendanceRecord[]; pagination: unknown }>(`/attendance/student/${studentId}?page=${page}&limit=${limit}`),
  byClass: (classId: string, date?: string) =>
    request<{ success: boolean; data: unknown[] }>(`/attendance/class/${classId}${date ? `?date=${date}` : ""}`),
  report: (studentId: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
    return request<{ success: boolean; records: AttendanceRecord[]; summary: Record<string, number>; total: number }>(`/attendance/report/${studentId}${qs ? `?${qs}` : ""}`);
  },
};

// ─── Cards ────────────────────────────────────────────────
export interface KnottyCard {
  id: string;
  card_number: string;
  qr_code: string;
  nfc_uid: string | null;
  wallet_balance: number;
  is_active: boolean;
  is_frozen: boolean;
  issued_at: string;
  expires_at: string;
  student: {
    id: string;
    student_code: string;
    user: { first_name: string; last_name: string; profile_photo: string | null };
    level: { name: string } | null;
    class: { name: string } | null;
  };
}

export interface CardScanResult {
  card_number: string;
  wallet_balance: number;
  student: { id: string; name: string; photo: string | null; class: string; student_code: string };
  today_attendance: string | null;
}

export const cards = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: KnottyCard[]; pagination: unknown }>(`/cards${qs ? `?${qs}` : ""}`);
  },
  scan: (cardNumber: string) =>
    request<{ success: boolean; data: CardScanFull }>(`/cards/${cardNumber}/scan`),
  scanNFC: (nfcUid: string) =>
    request<{ success: boolean; data: CardScanResult }>(`/cards/nfc/${nfcUid}`),
  issue: (studentId: string) =>
    request<{ success: boolean; data: KnottyCard }>(`/cards/issue/${studentId}`, { method: "POST" }),
  freeze: (id: string) => request(`/cards/${id}/freeze`, { method: "PUT" }),
  unfreeze: (id: string) => request(`/cards/${id}/unfreeze`, { method: "PUT" }),
  linkNFC: (id: string, nfc_uid: string) =>
    request(`/cards/${id}/nfc`, { method: "PUT", body: JSON.stringify({ nfc_uid }) }),
  topUpCash: (id: string, amount: number) =>
    request(`/cards/${id}/top-up-cash`, { method: "POST", body: JSON.stringify({ amount }) }),
  topUpMomo: (id: string, amount: number, phone: string) =>
    request(`/cards/${id}/top-up`, { method: "POST", body: JSON.stringify({ amount, phone }) }),
  transactions: (id: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: WalletTransaction[]; pagination: unknown }>(`/cards/${id}/transactions?page=${page}&limit=${limit}`),
};

// ─── Wallet Transactions ──────────────────────────────────
export interface WalletTransaction {
  id: string;
  type: "TOP_UP" | "DEDUCTION" | "REFUND";
  amount: number;
  balance_before: number;
  balance_after: number;
  source: "MOMO" | "CASH" | "ADMIN";
  description: string | null;
  created_at: string;
}

// ─── Fees ─────────────────────────────────────────────────
export interface FeePayment {
  id: string;
  amount: number;
  currency: string;
  payment_type: string;
  payment_method: string;
  status: string;
  term: string;
  academic_year: string;
  paid_at: string | null;
  created_at: string;
}

export const fees = {
  pay: (data: { student_id: string; school_id: string; amount: number; payment_type: string; payment_method: string; term: string; academic_year: string; phone?: string }) =>
    request<{ success: boolean; payment: FeePayment; message: string }>("/fees/pay", { method: "POST", body: JSON.stringify(data) }),
  studentFees: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: FeePayment[]; pagination: unknown }>(`/fees/student/${studentId}?page=${page}&limit=${limit}`),
  schoolReport: () =>
    request<{ success: boolean; data: { total_collected: number; pending: number; by_type: unknown[] } }>("/fees/report"),
};

// ─── Canteen ──────────────────────────────────────────────
export interface CanteenItem { name: string; price: number; quantity: number }
export interface CanteenTransaction {
  id: string;
  items_purchased: CanteenItem[];
  total_amount: number;
  wallet_balance_before: number;
  wallet_balance_after: number;
  transaction_time: string;
  student?: { user: { first_name: string; last_name: string } };
}

export const canteen = {
  purchase: (card_number: string, items: CanteenItem[]) =>
    request<{ success: boolean; transaction: CanteenTransaction; new_balance: number }>("/canteen/purchase", {
      method: "POST",
      body: JSON.stringify({ card_number, items }),
    }),
  studentTransactions: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: CanteenTransaction[]; pagination: unknown }>(`/canteen/transactions/${studentId}?page=${page}&limit=${limit}`),
  dailyReport: (date?: string) =>
    request<{ success: boolean; transactions: CanteenTransaction[]; total_revenue: number; transaction_count: number }>(`/canteen/report${date ? `?date=${date}` : ""}`),
};

// ─── Discipline ───────────────────────────────────────────
export interface DisciplineRecord {
  id: string;
  type: string;
  title: string;
  description: string | null;
  action_taken: string | null;
  severity: string;
  parent_notified: boolean;
  recorded_at: string;
  student?: { user: { first_name: string; last_name: string } };
  recorder?: { first_name: string; last_name: string; role: string };
}

export const discipline = {
  schoolList: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: DisciplineRecord[]; pagination: unknown }>(`/discipline/school${qs ? `?${qs}` : ""}`);
  },
  studentList: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: DisciplineRecord[]; pagination: unknown }>(`/discipline/student/${studentId}?page=${page}&limit=${limit}`),
  create: (data: { student_id: string; type: string; title: string; description?: string; action_taken?: string; severity: string }) =>
    request<{ success: boolean; data: DisciplineRecord }>("/discipline", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<DisciplineRecord>) =>
    request(`/discipline/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Health ───────────────────────────────────────────────
export interface HealthRecord {
  id: string;
  type: string;
  title: string;
  description: string | null;
  treatment_given: string | null;
  severity: string;
  follow_up_required: boolean;
  recorded_at: string;
}

export const health = {
  studentList: (studentId: string) =>
    request<{ success: boolean; data: HealthRecord[] }>(`/health/student/${studentId}`),
  create: (data: { student_id: string; type: string; title: string; description?: string; treatment_given?: string; severity: string; follow_up_required?: boolean }) =>
    request<{ success: boolean; data: HealthRecord }>("/health", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<HealthRecord>) =>
    request(`/health/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Achievements ─────────────────────────────────────────
export interface Achievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  awarded_at: string;
}

export const achievements = {
  studentList: (studentId: string) =>
    request<{ success: boolean; data: Achievement[] }>(`/achievements/student/${studentId}`),
  create: (data: { student_id: string; type: string; title: string; description?: string }) =>
    request<{ success: boolean; data: Achievement }>("/achievements", { method: "POST", body: JSON.stringify(data) }),
};

// ─── Reports ──────────────────────────────────────────────
export interface AcademicReport {
  id: string;
  term: string;
  academic_year: string;
  grades: Record<string, unknown>;
  total_marks: number | null;
  average: number | null;
  position_in_class: number | null;
  teacher_remarks: string | null;
  principal_remarks: string | null;
  conduct_grade: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  student_id: string;
  class_id: string;
}

export const reports = {
  studentList: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: AcademicReport[]; pagination: unknown }>(`/reports/student/${studentId}?page=${page}&limit=${limit}`),
  getOne: (id: string) => request<{ success: boolean; data: AcademicReport }>(`/reports/${id}`),
  create: (data: Record<string, unknown>) =>
    request<{ success: boolean; data: AcademicReport }>("/reports", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<AcademicReport>) =>
    request(`/reports/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  publish: (id: string) => request(`/reports/${id}/publish`, { method: "POST" }),
  downloadPDF: (id: string) => requestBlob(`/reports/${id}/pdf`),
};

// ─── Materials ────────────────────────────────────────────
export interface Material {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  created_at: string;
  uploader: { first_name: string; last_name: string };
  class: { name: string } | null;
  level: { name: string } | null;
}

export const materials = {
  list: (params?: { classId?: string; levelId?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: Material[]; pagination: unknown }>(`/materials${qs ? `?${qs}` : ""}`);
  },
  upload: (formData: FormData) =>
    fetch(`/api/v1/materials`, {
      method: "POST",
      headers: { ...(localStorage.getItem("knotty_token") ? { Authorization: `Bearer ${localStorage.getItem("knotty_token")}` } : {}) },
      body: formData,
    }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.message); return j as { success: boolean; data: Material }; }),
  remove: (id: string) => request(`/materials/${id}`, { method: "DELETE" }),
};

// ─── Student self-service ─────────────────────────────────
export const myAccount = {
  profile: () => request<{ success: boolean; data: StudentBase & { card: { card_number: string; wallet_balance: number; is_frozen: boolean; is_active: boolean; expires_at: string } | null } }>("/students/me/profile"),
  attendance: (page = 1, limit = 60) => request<{ success: boolean; data: AttendanceRecord[]; pagination: unknown }>(`/attendance/me?page=${page}&limit=${limit}`),
  reports: (page = 1, limit = 10) => request<{ success: boolean; data: AcademicReport[]; pagination: unknown }>(`/reports/student/me?page=${page}&limit=${limit}`),
  fees: (page = 1) => request<{ success: boolean; data: FeePayment[]; pagination: unknown }>(`/fees/student/me?page=${page}`),
};

// ─── Notifications ────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const notifications = {
  list: () => request<{ success: boolean; data: Notification[]; pagination: unknown }>("/notifications"),
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: "PUT" }),
};
