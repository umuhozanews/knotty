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

async function safeJson(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Server returned non-JSON response (HTTP ${res.status}). Is the backend running?`);
  }
  return res.json();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await safeJson(res) as Record<string, string>;
    if (!res.ok) return null;
    localStorage.setItem("knotty_token", json.accessToken);
    localStorage.setItem("knotty_refresh", json.refreshToken);
    return json.accessToken;
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
    const retryJson = await safeJson(retry) as Record<string, unknown>;
    if (!retry.ok) {
      const details = Array.isArray(retryJson.details) ? `: ${retryJson.details.join(", ")}` : "";
      throw new Error(((retryJson.message as string) || `Request failed: ${retry.status}`) + details);
    }
    return retryJson as T;
  }

  const json = await safeJson(res) as Record<string, unknown>;
  if (!res.ok) {
    const details = Array.isArray(json.details) ? `: ${json.details.join(", ")}` : "";
    throw new Error(((json.message as string) || `Request failed: ${res.status}`) + details);
  }
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
export interface Class { id: string; name: string; level: Level; academic_year?: string; class_teacher_id?: string; _count?: { students: number } }

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
  parent_id?: string | null;
}

export type Student = StudentBase;

export interface StudentListResponse {
  success: boolean;
  data: Student[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface ConsentRecord {
  id: string;
  student_id: string;
  guardian_id: string;
  consent_type: string;
  version: string;
  granted_at: string;
  document_url: string | null;
  guardian?: { first_name: string; last_name: string; email: string };
}

export interface FullProfile extends StudentBase {
  parent: { id: string; first_name: string; last_name: string; phone: string; email: string } | null;
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
  consent: (studentId: string) =>
    request<{ success: boolean; data: ConsentRecord[] }>(`/students/${studentId}/consent`),
  recordConsent: (studentId: string, data: { consent_type: string; version: string; guardian_id: string; document_url?: string }) =>
    request<{ success: boolean; data: ConsentRecord }>(`/students/${studentId}/consent`, { method: "POST", body: JSON.stringify(data) }),
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
  scan: (card_number: string, options?: Record<string, unknown>) =>
    request<{ success: boolean; data: AttendanceRecord }>("/attendance/scan", { method: "POST", body: JSON.stringify({ card_number, ...options }) }),
  scanNFC: (nfc_uid: string, options?: Record<string, unknown>) =>
    request<{ success: boolean; data: AttendanceRecord }>("/attendance/scan-nfc", { method: "POST", body: JSON.stringify({ nfc_uid, ...options }) }),
  getSettings: () =>
    request<{ success: boolean; data: AttendanceSettings }>("/schools/settings/attendance"),
  updateSettings: (data: Partial<AttendanceSettings>) =>
    request<{ success: boolean; data: AttendanceSettings }>("/schools/settings/attendance", { method: "PUT", body: JSON.stringify(data) }),
  bulk: (class_id: string, records: { student_id: string; status: string; note?: string }[]) =>
    request<{ success: boolean; data: AttendanceRecord[]; count: number }>("/attendance/bulk", { method: "POST", body: JSON.stringify({ class_id, records }) }),
  todaySummary: (classId?: string) =>
    request<{ success: boolean } & AttendanceTodaySummary>(`/attendance/today-summary${classId ? `?classId=${classId}` : ""}`),
  byStudent: (studentId: string, page = 1, limit = 30) =>
    request<{ success: boolean; data: AttendanceRecord[]; pagination: unknown }>(`/attendance/student/${studentId}?page=${page}&limit=${limit}`),
  byClass: (classId: string, date?: string) =>
    request<{ success: boolean; data: unknown[] }>(`/attendance/class/${classId}${date ? `?date=${date}` : ""}`),
  report: (studentId: string, from?: string, to?: string) => {
    const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
    return request<{ success: boolean; records: AttendanceRecord[]; summary: Record<string, number>; total: number }>(`/attendance/report/${studentId}${qs ? `?${qs}` : ""}`);
  },
  scanSecure: (token: string, options?: Record<string, unknown>) =>
    request<{ success: boolean; data: AttendanceRecord }>("/attendance/scan-secure", { method: "POST", body: JSON.stringify({ token, ...options }) }),
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
  getSecureQR: () =>
    request<{ success: boolean; token: string; qr_code: string; expires_at: string }>(`/cards/me/secure-qr?_t=${Date.now()}`),
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

// ─── Fees & Structured Invoicing ─────────────────────────
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

export interface FeeStructure {
  id: string;
  name: string;
  academic_term_id: string | null;
  applies_to: string[] | null;
  amount: number;
  currency: string;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  fee_structure_id: string;
  description: string;
  amount: number;
  fee_structure: FeeStructure;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string | null;
  wallet_transaction_id: string | null;
  amount: number;
  channel: string;
  status: string;
  payer_user_id: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  student_id: string;
  academic_term_id: string | null;
  total_amount: number;
  amount_paid: number;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED";
  due_date: string;
  created_at: string;
  student: {
    student_code: string;
    user: { first_name: string; last_name: string };
    class: { name: string } | null;
  };
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

export interface RefundRequest {
  id: string;
  wallet_transaction_id: string;
  requested_by: string;
  approved_by: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  created_at: string;
  resolved_at: string | null;
  wallet_transaction: {
    id: string;
    type: string;
    amount: number;
    created_at: string;
    student: {
      user: { first_name: string; last_name: string };
    };
  };
  requester: { first_name: string; last_name: string };
  approver: { first_name: string; last_name: string } | null;
}

export const fees = {
  pay: (data: { student_id: string; school_id: string; amount: number; payment_type: string; payment_method: string; term: string; academic_year: string; phone?: string }) =>
    request<{ success: boolean; payment: FeePayment; message: string }>("/fees/pay", { method: "POST", body: JSON.stringify(data) }),
  studentFees: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: FeePayment[]; pagination: unknown }>(`/fees/student/${studentId}?page=${page}&limit=${limit}`),
  schoolReport: () =>
    request<{ success: boolean; data: { total_collected: number; pending: number; by_type: unknown[] } }>("/fees/report"),

  // Fee Structures
  structures: () =>
    request<{ success: boolean; data: FeeStructure[] }>("/fees/structures"),
  createStructure: (data: { name: string; academic_term_id?: string; applies_to?: string[]; amount: number }) =>
    request<{ success: boolean; data: FeeStructure }>("/fees/structures", { method: "POST", body: JSON.stringify(data) }),
  deleteStructure: (id: string) =>
    request(`/fees/structures/${id}`, { method: "DELETE" }),

  // Invoices
  invoices: (params?: { studentId?: string; classSectionId?: string; termId?: string; status?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return request<{ success: boolean; data: Invoice[] }>(`/fees/invoices${qs ? `?${qs}` : ""}`);
  },
  generateInvoices: (data: { fee_structure_id: string; due_date: string }) =>
    request<{ success: boolean; count: number; invoices: Invoice[] }>("/fees/invoices/generate", { method: "POST", body: JSON.stringify(data) }),
  payInvoice: (data: { invoice_id: string; amount: number; channel: string; phone?: string }) =>
    request<{ success: boolean; payment: InvoicePayment; new_balance?: number; message: string }>("/fees/invoices/pay", { method: "POST", body: JSON.stringify(data) }),

  // Refunds
  refunds: () =>
    request<{ success: boolean; data: RefundRequest[] }>("/fees/refunds"),
  requestRefund: (data: { wallet_transaction_id: string; reason: string }) =>
    request<{ success: boolean; data: RefundRequest }>("/fees/refunds", { method: "POST", body: JSON.stringify(data) }),
  resolveRefund: (id: string, status: "APPROVED" | "REJECTED") =>
    request<{ success: boolean; refund: RefundRequest; balance?: number }>((`/fees/refunds/${id}/resolve`), { method: "POST", body: JSON.stringify({ status }) }),
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
  status: string;
  parent_notified: boolean;
  recorded_at: string;
  created_at: string;
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
  resolved_at: string | null;
  recorded_at: string;
  student?: { user: { first_name: string; last_name: string } };
  recorder?: { first_name: string; last_name: string; role: string };
}

export interface MedicalProfile {
  id: string;
  student_id: string;
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_phone: string;
}

export interface ImmunizationRecord {
  id: string;
  student_id: string;
  vaccine_name: string;
  date_administered: string;
}

export interface ClinicVisit {
  id: string;
  student_id: string;
  visit_datetime: string;
  presenting_complaint: string;
  treatment_notes: string | null;
  recorded_by_staff_id: string;
  follow_up_required: boolean;
  recorder?: { first_name: string; last_name: string };
  student?: { user: { first_name: string; last_name: string } };
  medications?: MedicationAdministration[];
}

export interface MedicationAdministration {
  id: string;
  student_id: string;
  clinic_visit_id: string | null;
  medication_name: string;
  dosage: string;
  administered_at: string;
}

export const health = {
  schoolRecords: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page)  qs.set("page",  String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<{ success: boolean; data: HealthRecord[]; pagination: unknown }>(`/health?${qs}`);
  },
  studentList: (studentId: string) =>
    request<{ success: boolean; data: HealthRecord[] }>(`/health/student/${studentId}`),
  create: (data: { student_id: string; type: string; title: string; description?: string; treatment_given?: string; severity: string; follow_up_required?: boolean }) =>
    request<{ success: boolean; data: HealthRecord }>("/health", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<HealthRecord>) =>
    request(`/health/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  
  // Advanced Profiles & Immunizations
  getProfile: (studentId: string) =>
    request<{ success: boolean; data: MedicalProfile }>(`/health/profile/${studentId}`),
  updateProfile: (studentId: string, data: Partial<MedicalProfile>) =>
    request<{ success: boolean; data: MedicalProfile }>(`/health/profile/${studentId}`, { method: "PUT", body: JSON.stringify(data) }),
  
  immunizations: (studentId: string) =>
    request<{ success: boolean; data: ImmunizationRecord[] }>(`/health/immunization/${studentId}`),
  addImmunization: (studentId: string, data: { vaccine_name: string; date_administered: string }) =>
    request<{ success: boolean; data: ImmunizationRecord }>(`/health/immunization/${studentId}`, { method: "POST", body: JSON.stringify(data) }),
  deleteImmunization: (id: string) =>
    request(`/health/immunization/${id}`, { method: "DELETE" }),

  // Clinic Visits & Medications
  visits: (params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: ClinicVisit[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/health/visits${qs ? `?${qs}` : ""}`);
  },
  studentVisits: (studentId: string, params?: { page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: ClinicVisit[]; pagination: unknown }>(`/health/visits/student/${studentId}${qs ? `?${qs}` : ""}`);
  },
  createVisit: (studentId: string, data: { presenting_complaint: string; treatment_notes?: string; follow_up_required?: boolean; medications?: Array<{ medication_name: string; dosage: string }> }) =>
    request<{ success: boolean; data: ClinicVisit }>(`/health/visits/student/${studentId}`, { method: "POST", body: JSON.stringify(data) }),
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
    }).then(async (r) => { const j = await safeJson(r) as { success: boolean; data: Material; message?: string }; if (!r.ok) throw new Error(j.message); return j; }),
  remove: (id: string) => request(`/materials/${id}`, { method: "DELETE" }),
};

// ─── Student self-service ─────────────────────────────────
export const myAccount = {
  profile: () => request<{ success: boolean; data: StudentBase & { card: { card_number: string; wallet_balance: number; is_frozen: boolean; is_active: boolean; expires_at: string } | null } }>("/students/me/profile"),
  attendance: (page = 1, limit = 60) => request<{ success: boolean; data: AttendanceRecord[]; pagination: unknown }>(`/attendance/me?page=${page}&limit=${limit}`),
  reports: (page = 1, limit = 10) => request<{ success: boolean; data: AcademicReport[]; pagination: unknown }>(`/reports/student/me?page=${page}&limit=${limit}`),
  fees: (page = 1) => request<{ success: boolean; data: FeePayment[]; pagination: unknown }>(`/fees/student/me?page=${page}`),
  parentChildren: () => request<{ success: boolean; data: any[] }>("/students/parent/me"),
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

export interface Teacher {
  id: string;
  user_id: string;
  employee_code: string;
  qualification: string | null;
  specialization: string | null;
  subjects_taught: Array<{ class_id: string; class_name: string; subject: string }> | null;
  user: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
}

export const teachers = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<{ success: boolean; data: Teacher[]; pagination: unknown }>(`/teachers${qs ? `?${qs}` : ""}`);
  },
  getOne: (id: string) => request<{ success: boolean; data: Teacher }>(`/teachers/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    request<{ success: boolean; data: Teacher }>(`/teachers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ─── Library ──────────────────────────────────────────────
export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string | null;
  total_copies: number;
  created_at: string;
  _count?: { copies: number };
}

export interface LibraryBookCopy {
  id: string;
  copy_tag: string;
  status: "AVAILABLE" | "BORROWED" | "LOST" | "DAMAGED" | "WITHDRAWN";
  created_at: string;
  book?: LibraryBook;
}

export interface LibraryBorrowRecord {
  id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
  student?: { user: { first_name: string; last_name: string } };
  copy?: LibraryBookCopy;
}

export const library = {
  books: (params?: { page?: number; limit?: number; search?: string; category?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: LibraryBook[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/library/books${qs ? `?${qs}` : ""}`);
  },
  book: (id: string) => request<{ success: boolean; data: LibraryBook & { copies: Array<LibraryBookCopy & { borrows: LibraryBorrowRecord[] }> } }>(`/library/books/${id}`),
  createBook: (data: { title: string; author: string; isbn?: string; category?: string; total_copies?: number; copy_tags?: string[] }) =>
    request<{ success: boolean; data: LibraryBook }>("/library/books", { method: "POST", body: JSON.stringify(data) }),
  updateBook: (id: string, data: Partial<LibraryBook>) =>
    request<{ success: boolean; data: LibraryBook }>(`/library/books/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBook: (id: string) => request(`/library/books/${id}`, { method: "DELETE" }),
  
  createCopy: (bookId: string, data: { copy_tag: string }) =>
    request<{ success: boolean; data: LibraryBookCopy }>(`/library/books/${bookId}/copies`, { method: "POST", body: JSON.stringify(data) }),
  updateCopy: (id: string, data: Partial<LibraryBookCopy>) =>
    request<{ success: boolean; data: LibraryBookCopy }>(`/library/copies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCopy: (id: string) => request(`/library/copies/${id}`, { method: "DELETE" }),

  borrowBook: (data: { copy_tag: string; student_code: string; due_days?: number }) =>
    request<{ success: boolean; data: LibraryBorrowRecord; message: string }>("/library/borrow", { method: "POST", body: JSON.stringify(data) }),
  returnBook: (data: { copy_tag: string; fine_rate_per_day?: number }) =>
    request<{ success: boolean; data: { record: LibraryBorrowRecord; fine_amount: number; fine_charged_to_wallet: boolean }; message: string }>("/library/return", { method: "POST", body: JSON.stringify(data) }),
  studentHistory: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: LibraryBorrowRecord[]; pagination: unknown }>(`/library/borrow/student/${studentId}?page=${page}&limit=${limit}`),
  schoolBorrows: (status?: "active" | "returned" | "overdue", page = 1, limit = 30) => {
    const qs = new URLSearchParams({ ...(status ? { status } : {}), page: String(page), limit: String(limit) }).toString();
    return request<{ success: boolean; data: LibraryBorrowRecord[]; pagination: unknown }>(`/library/borrow?${qs}`);
  },
  stats: () => request<{ success: boolean; data: {
    borrowedBooks: number;
    returnedBooks: number;
    overdueBooks: number;
    missingBooks: number;
    totalBooks: number;
    visitors: number;
    newMembers: number;
    pendingFees: number;
    borrowedTrend: string;
    returnedTrend: string;
    overdueTrend: string;
    missingTrend: string;
    totalTrend: string;
    visitorsTrend: string;
    newMembersTrend: string;
    pendingFeesTrend: string;
  } }>("/library/stats"),
};

// ─── Gate Access ──────────────────────────────────────────
export interface Campus {
  id: string;
  name: string;
  address: string | null;
  timezone_override: string | null;
}

export interface GateDevice {
  id: string;
  campus_id: string;
  name: string;
  location_type: string;
  zone_id: string | null;
  campus?: { name: string };
  restricted_zone?: { name: string };
}

export interface RestrictedZone {
  id: string;
  campus_id: string;
  name: string;
  description: string | null;
  campus?: { name: string };
  access_grants?: ZoneAccessGrant[];
}

export interface ZoneAccessGrant {
  id: string;
  zone_id: string;
  grantee_type: "ROLE" | "USER";
  grantee_id: string;
  valid_from: string;
  valid_to: string | null;
}

export interface AccessLog {
  id: string;
  device_id: string;
  card_id: string | null;
  direction: "ENTRY" | "EXIT";
  decision: "GRANTED" | "DENIED";
  denial_reason: string | null;
  overridden_by_user_id: string | null;
  occurred_at: string;
  device?: { name: string; location_type: string };
  card?: {
    student?: {
      user: { first_name: string; last_name: string; profile_photo: string | null };
    };
  };
  overrider?: { first_name: string; last_name: string };
}

export interface VisitorLog {
  id: string;
  visitor_name: string;
  id_document_ref: string | null;
  purpose: string;
  checked_in_at: string;
  checked_out_at: string | null;
  host?: { first_name: string; last_name: string };
  campus?: { name: string };
}

export const gateAccess = {
  campuses: () => request<{ success: boolean; data: Campus[] }>("/gate-access/campuses"),
  createCampus: (data: { name: string; address?: string }) =>
    request<{ success: boolean; data: Campus }>("/gate-access/campuses", { method: "POST", body: JSON.stringify(data) }),

  devices: (campusId?: string) => {
    const qs = campusId ? `?campusId=${campusId}` : "";
    return request<{ success: boolean; data: GateDevice[] }>(`/gate-access/devices${qs}`);
  },
  createDevice: (data: { campus_id: string; name: string; location_type: string; zone_id?: string }) =>
    request<{ success: boolean; data: GateDevice }>("/gate-access/devices", { method: "POST", body: JSON.stringify(data) }),
  updateDevice: (id: string, data: Partial<GateDevice>) =>
    request<{ success: boolean; data: GateDevice }>(`/gate-access/devices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDevice: (id: string) => request(`/gate-access/devices/${id}`, { method: "DELETE" }),

  zones: () => request<{ success: boolean; data: RestrictedZone[] }>("/gate-access/zones"),
  createZone: (data: { campus_id: string; name: string; description?: string }) =>
    request<{ success: boolean; data: RestrictedZone }>("/gate-access/zones", { method: "POST", body: JSON.stringify(data) }),
  updateZone: (id: string, data: Partial<RestrictedZone>) =>
    request<{ success: boolean; data: RestrictedZone }>(`/gate-access/zones/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteZone: (id: string) => request(`/gate-access/zones/${id}`, { method: "DELETE" }),

  createGrant: (zoneId: string, data: { grantee_type: "ROLE" | "USER"; grantee_id: string; valid_from: string; valid_to?: string }) =>
    request<{ success: boolean; data: ZoneAccessGrant }>(`/gate-access/zones/${zoneId}/grants`, { method: "POST", body: JSON.stringify(data) }),
  deleteGrant: (id: string) => request(`/gate-access/grants/${id}`, { method: "DELETE" }),

  evaluate: (data: { deviceId: string; cardNumber?: string; secureToken?: string; nfcUid?: string; direction?: "ENTRY" | "EXIT" }) =>
    request<{ success: boolean; data: { decision: "GRANTED" | "DENIED"; reason?: string; ownerName?: string; studentCode?: string; photoUrl?: string } }>("/gate-access/evaluate", { method: "POST", body: JSON.stringify(data) }),
  override: (logId: string) =>
    request<{ success: boolean; data: AccessLog }>((`/gate-access/override/${logId}`), { method: "POST" }),

  visitors: (params?: { campusId?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: VisitorLog[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/gate-access/visitors${qs ? `?${qs}` : ""}`);
  },
  createVisitor: (data: { campusId: string; visitor_name: string; id_document_ref?: string; purpose: string; host_user_id: string; expected_checkout_at?: string }) =>
    request<{ success: boolean; data: VisitorLog }>("/gate-access/visitors", { method: "POST", body: JSON.stringify(data) }),
  checkoutVisitor: (id: string) =>
    request(`/gate-access/visitors/${id}/checkout`, { method: "POST" }),

  logs: (params?: { page?: number; limit?: number; decision?: "GRANTED" | "DENIED"; direction?: "ENTRY" | "EXIT"; deviceId?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: AccessLog[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/gate-access/logs${qs ? `?${qs}` : ""}`);
  },
};

// ─── Academics ────────────────────────────────────────────
export interface AcademicTerm {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  created_at: string;
}

export interface ClassSection {
  id: string;
  name: string;
  campus_id: string | null;
  program_id: string;
  academic_term_id: string;
  homeroom_staff_id: string | null;
  capacity: number | null;
  program?: Program;
  term?: AcademicTerm;
  homeroom_teacher?: { id: string; first_name: string; last_name: string; email: string } | null;
  enrollments?: Array<{
    id: string;
    student: {
      id: string;
      student_code: string;
      user: { first_name: string; last_name: string; email: string; phone: string | null };
    };
  }>;
  timetable_entries?: TimetableEntry[];
  _count?: { enrollments: number };
}

export interface Enrollment {
  id: string;
  student_id: string;
  class_section_id: string;
  academic_term_id: string;
  status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  created_at: string;
  student?: {
    id: string;
    student_code: string;
    user: { first_name: string; last_name: string; email: string; phone: string | null };
  };
  class_section?: ClassSection;
}

export interface TimetableEntry {
  id: string;
  class_section_id: string;
  subject_id: string;
  staff_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  class_section?: ClassSection;
  subject?: { id: string; name: string; code: string };
  teacher?: { id: string; first_name: string; last_name: string };
}

export interface Exam {
  id: string;
  name: string;
  subject_id: string;
  academic_term_id: string;
  exam_date: string;
  max_score: number;
  subject?: { id: string; name: string; code: string };
  term?: AcademicTerm;
  _count?: { results: number };
}

export interface ExamResult {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  grade_letter: string | null;
  entered_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  student?: {
    id: string;
    user: { first_name: string; last_name: string };
  };
  recorder?: { first_name: string; last_name: string };
  approver?: { first_name: string; last_name: string } | null;
}

export interface GradingScale {
  id: string;
  name: string;
  bands: Array<{ min: number; max: number; letter: string; gpa: number }>;
}

export const academics = {
  // Terms
  terms: () => request<{ success: boolean; data: AcademicTerm[] }>("/academics/terms"),
  createTerm: (data: { name: string; start_date: string; end_date: string }) =>
    request<{ success: boolean; data: AcademicTerm }>("/academics/terms", { method: "POST", body: JSON.stringify(data) }),
  updateTerm: (id: string, data: Partial<AcademicTerm>) =>
    request<{ success: boolean; data: AcademicTerm }>(`/academics/terms/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTerm: (id: string) => request(`/academics/terms/${id}`, { method: "DELETE" }),

  // Programs
  programs: () => request<{ success: boolean; data: Program[] }>("/academics/programs"),
  createProgram: (data: { name: string }) =>
    request<{ success: boolean; data: Program }>("/academics/programs", { method: "POST", body: JSON.stringify(data) }),
  deleteProgram: (id: string) => request(`/academics/programs/${id}`, { method: "DELETE" }),

  // Class Sections
  sections: (params?: { campusId?: string; programId?: string; academicTermId?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: ClassSection[] }>(`/academics/sections${qs ? `?${qs}` : ""}`);
  },
  createSection: (data: { name: string; program_id: string; academic_term_id: string; campus_id?: string; homeroom_staff_id?: string; capacity?: number }) =>
    request<{ success: boolean; data: ClassSection }>("/academics/sections", { method: "POST", body: JSON.stringify(data) }),
  sectionDetails: (id: string) =>
    request<{ success: boolean; data: ClassSection }>(`/academics/sections/${id}`),

  // Enrollments
  enroll: (data: { student_id: string; class_section_id: string; academic_term_id: string }) =>
    request<{ success: boolean; data: Enrollment }>("/academics/enroll", { method: "POST", body: JSON.stringify(data) }),
  unenroll: (enrollmentId: string) =>
    request(`/academics/enrollments/${enrollmentId}`, { method: "DELETE" }),

  // Timetable
  timetable: (params?: { classSectionId?: string; teacherId?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: TimetableEntry[] }>(`/academics/timetable${qs ? `?${qs}` : ""}`);
  },
  createTimetableEntry: (data: { class_section_id: string; subject_id: string; staff_id: string; day_of_week: number; start_time: string; end_time: string; room?: string }) =>
    request<{ success: boolean; data: TimetableEntry }>("/academics/timetable", { method: "POST", body: JSON.stringify(data) }),
  deleteTimetableEntry: (id: string) =>
    request(`/academics/timetable/${id}`, { method: "DELETE" }),

  // Exams
  exams: (params?: { academicTermId?: string; subjectId?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: Exam[] }>(`/academics/exams${qs ? `?${qs}` : ""}`);
  },
  createExam: (data: { name: string; subject_id: string; academic_term_id: string; exam_date: string; max_score?: number }) =>
    request<{ success: boolean; data: Exam }>("/academics/exams", { method: "POST", body: JSON.stringify(data) }),
  deleteExam: (id: string) => request(`/academics/exams/${id}`, { method: "DELETE" }),

  // Grading Scale
  gradingScale: () => request<{ success: boolean; data: GradingScale }>("/academics/grading-scale"),
  saveGradingScale: (data: { name: string; bands: Array<{ min: number; max: number; letter: string; gpa: number }> }) =>
    request<{ success: boolean; data: GradingScale }>("/academics/grading-scale", { method: "POST", body: JSON.stringify(data) }),

  // Results
  examResults: (examId: string) =>
    request<{ success: boolean; data: ExamResult[] }>(`/academics/exams/${examId}/results`),
  recordResults: (examId: string, results: Array<{ student_id: string; score: number }>) =>
    request<{ success: boolean; data: ExamResult[]; message: string }>(`/academics/exams/${examId}/results`, { method: "POST", body: JSON.stringify({ results }) }),
  approveResult: (resultId: string) =>
    request<{ success: boolean; data: ExamResult; message: string }>(`/academics/exams/results/${resultId}/approve`, { method: "POST" }),
};



