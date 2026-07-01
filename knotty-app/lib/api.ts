import { DEMO_STUDENTS } from "./demo";

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
  localStorage.removeItem("knotty_demo");
  localStorage.removeItem("knotty_demo_user");
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const extraObj = extra ? { ...extra } as Record<string, string> : {};
  if (extraObj["Content-Type"] === "none") {
    delete base["Content-Type"];
    delete extraObj["Content-Type"];
  }
  return {
    ...base,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraObj,
  };
}

const SKIP_REFRESH = ["/auth/login", "/auth/refresh-token"];

function handleDemoRequest<T>(path: string, options: RequestInit = {}): T {
  const method = options.method || "GET";
  let body: any = null;
  if (options.body && typeof options.body === "string") {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = null;
    }
  }

  const cleanPath = path.split("?")[0];
  const cleanParts = cleanPath.split("/");

  const getLevels = (): any[] => {
    const val = localStorage.getItem("knotty_demo_levels");
    if (!val) {
      const initial = [
        { id: "l1", name: "Senior 5", description: "Senior 5 level", order_index: 0 },
        { id: "l2", name: "Senior 6", description: "Senior 6 level", order_index: 1 },
      ];
      localStorage.setItem("knotty_demo_levels", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getClasses = (): any[] => {
    const val = localStorage.getItem("knotty_demo_classes");
    if (!val) {
      const initial = [
        { id: "c1", name: "A", level: { id: "l1", name: "Senior 5" }, class_teacher_id: "demo-teacher", academic_year: "2025-2026" },
        { id: "c2", name: "B", level: { id: "l1", name: "Senior 5" }, class_teacher_id: "demo-teacher", academic_year: "2025-2026" },
        { id: "c3", name: "Science", level: { id: "l2", name: "Senior 6" }, class_teacher_id: "demo-teacher", academic_year: "2025-2026" },
      ];
      localStorage.setItem("knotty_demo_classes", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getStudents = (): any[] => {
    const val = localStorage.getItem("knotty_demo_students");
    if (!val) {
      const initial = DEMO_STUDENTS;
      localStorage.setItem("knotty_demo_students", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getDemoHealthProfiles = (): any[] => {
    const val = localStorage.getItem("knotty_demo_health_profiles");
    if (!val) {
      const initial = [
        {
          id: "prof-1",
          student_id: "std-1",
          blood_type: "O+",
          allergies: ["Penicillin", "Peanuts"],
          chronic_conditions: ["Asthma"],
          emergency_contact_phone: "+250788000021"
        },
        {
          id: "prof-2",
          student_id: "std-2",
          blood_type: "A-",
          allergies: ["Dust"],
          chronic_conditions: [],
          emergency_contact_phone: "+250788000022"
        }
      ];
      localStorage.setItem("knotty_demo_health_profiles", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getDemoImmunizations = (): any[] => {
    const val = localStorage.getItem("knotty_demo_health_immunizations");
    if (!val) {
      const initial = [
        { id: "imm-1", student_id: "std-1", vaccine_name: "BCG", date_administered: "2015-05-12", created_at: new Date().toISOString() },
        { id: "imm-2", student_id: "std-1", vaccine_name: "MMR", date_administered: "2018-08-20", created_at: new Date().toISOString() },
        { id: "imm-3", student_id: "std-2", vaccine_name: "BCG", date_administered: "2016-02-14", created_at: new Date().toISOString() }
      ];
      localStorage.setItem("knotty_demo_health_immunizations", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getDemoClinicVisits = (): any[] => {
    const val = localStorage.getItem("knotty_demo_health_visits");
    if (!val) {
      const initial = [
        {
          id: "visit-1",
          student_id: "std-1",
          presenting_complaint: "Headache and fatigue",
          treatment_notes: "Given rest and Paracetamol. Encouraged hydration.",
          follow_up_required: false,
          medications: [{ medication_name: "Paracetamol", dosage: "500mg" }],
          visited_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
          student: { id: "std-1", user: { first_name: "Hirwa", last_name: "Jean" } },
          recorder: { first_name: "Mutoni", last_name: "Diane" }
        }
      ];
      localStorage.setItem("knotty_demo_health_visits", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const saveLevels = (data: any[]) => localStorage.setItem("knotty_demo_levels", JSON.stringify(data));
  const saveClasses = (data: any[]) => localStorage.setItem("knotty_demo_classes", JSON.stringify(data));
  const saveStudents = (data: any[]) => localStorage.setItem("knotty_demo_students", JSON.stringify(data));
  const saveDemoHealthProfiles = (data: any[]) => localStorage.setItem("knotty_demo_health_profiles", JSON.stringify(data));
  const saveDemoImmunizations = (data: any[]) => localStorage.setItem("knotty_demo_health_immunizations", JSON.stringify(data));
  const saveDemoClinicVisits = (data: any[]) => localStorage.setItem("knotty_demo_health_visits", JSON.stringify(data));

  const getStaffList = (): any[] => {
    const val = localStorage.getItem("knotty_demo_staff");
    if (!val) {
      const initial = [
        { id: "staff-bursar", first_name: "Nshimiye", last_name: "Paul", email: "bursar@knottyschool.rw", role: "BURSAR", is_active: true, last_login: null, created_at: new Date().toISOString() },
        { id: "staff-nurse", first_name: "Mutoni", last_name: "Diane", email: "nurse@knottyschool.rw", role: "NURSE", is_active: true, last_login: null, created_at: new Date().toISOString() },
        { id: "staff-discipline", first_name: "Rugamba", last_name: "Victor", email: "discipline@knottyschool.rw", role: "DISCIPLINE", is_active: true, last_login: null, created_at: new Date().toISOString() },
        { id: "staff-canteen", first_name: "Umutoni", last_name: "Claire", email: "canteen@knottyschool.rw", role: "CANTEEN", is_active: true, last_login: null, created_at: new Date().toISOString() },
        { id: "staff-teacher", first_name: "Kagabo", last_name: "Robert", email: "teacher@knottyschool.rw", role: "TEACHER", is_active: true, last_login: null, created_at: new Date().toISOString() },
      ];
      localStorage.setItem("knotty_demo_staff", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const getTeachersList = (): any[] => {
    const val = localStorage.getItem("knotty_demo_teachers");
    if (!val) {
      const initial = [
        {
          id: "tch-1",
          user_id: "staff-teacher",
          employee_code: "TCH-DEMO-0001",
          subjects_taught: [
            { class_id: "c1", class_name: "Senior 5 A", subject: "Mathematics" },
            { class_id: "c3", class_name: "Senior 6 Science", subject: "Physics" },
          ],
          user: {
            first_name: "Kagabo",
            last_name: "Robert",
            email: "teacher@knottyschool.rw",
            phone: "+250788100001"
          }
        }
      ];
      localStorage.setItem("knotty_demo_teachers", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const saveStaffList = (data: any[]) => localStorage.setItem("knotty_demo_staff", JSON.stringify(data));
  const saveTeachersList = (data: any[]) => localStorage.setItem("knotty_demo_teachers", JSON.stringify(data));

  const getMaterials = (): any[] => {
    const val = localStorage.getItem("knotty_demo_materials");
    if (!val) {
      const initial = [
        {
          id: "mat-1",
          title: "S5 Math - Integration by Parts",
          description: "Full reference guide and lecture notes for integration methods.",
          subject: "Mathematics",
          file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          file_name: "integration_notes.pdf",
          file_type: "application/pdf",
          created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          uploader: { first_name: "Kagabo", last_name: "Robert" },
          class: { name: "A" },
          level: { name: "Senior 5" }
        },
        {
          id: "mat-2",
          title: "S6 Physics - Electromagnetism Slides",
          description: "Weekly slides covering electromagnetic fields and induction.",
          subject: "Physics",
          file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
          file_name: "electromagnetism.pdf",
          file_type: "application/pdf",
          created_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
          uploader: { first_name: "Kagabo", last_name: "Robert" },
          class: { name: "Science" },
          level: { name: "Senior 6" }
        }
      ];
      localStorage.setItem("knotty_demo_materials", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const saveMaterials = (data: any[]) => localStorage.setItem("knotty_demo_materials", JSON.stringify(data));

  const getReports = (): any[] => {
    const val = localStorage.getItem("knotty_demo_reports");
    if (!val) {
      const initial = [
        {
          id: "rep-1",
          student_id: "std-1",
          school_id: "demo-school",
          class_id: "c1",
          term: "Term 1",
          academic_year: "2025-2026",
          grades: [
            { subject: "Mathematics", term1: 85, term2: 0, term3: 0, annual: 85, credit: 5 },
            { subject: "Physics", term1: 78, term2: 0, term3: 0, annual: 78, credit: 4 }
          ],
          total_marks: 163,
          average: 81.5,
          position_in_class: 1,
          teacher_remarks: "Excellent work!",
          principal_remarks: "Keep it up!",
          conduct_grade: "40",
          is_published: false,
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem("knotty_demo_reports", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };

  const saveReports = (data: any[]) => localStorage.setItem("knotty_demo_reports", JSON.stringify(data));

  const getDemoBooks = (): any[] => {
    const val = localStorage.getItem("knotty_demo_library_books");
    if (!val) {
      const initial = [
        { id: "book-1", title: "Advanced Physics for A-Level", author: "Dr. Musoni", isbn: "9781234567890", category: "PHYSICS", total_copies: 5, created_at: "2026-01-10T10:00:00.000Z" },
        { id: "book-2", title: "Pure Mathematics Vol 1", author: "Prof. Kagabo", isbn: "9780987654321", category: "MATH", total_copies: 3, created_at: "2026-01-12T11:30:00.000Z" }
      ];
      localStorage.setItem("knotty_demo_library_books", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoBooks = (data: any[]) => localStorage.setItem("knotty_demo_library_books", JSON.stringify(data));

  const getDemoBorrows = (): any[] => {
    const val = localStorage.getItem("knotty_demo_library_borrows");
    if (!val) {
      const initial = [
        {
          id: "bor-1",
          borrowed_at: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
          due_at: new Date(Date.now() + 3600 * 1000 * 24 * 5).toISOString(),
          returned_at: null,
          fine_amount: 0,
          student: { user: { first_name: "Kamanzi", last_name: "Eric" } },
          student_id: "std-1",
          copy: { id: "copy-1-1", copy_tag: "PHYS-001", status: "BORROWED", created_at: "2026-01-10T10:00:00.000Z", book: { id: "book-1", title: "Advanced Physics for A-Level", author: "Dr. Musoni" } }
        }
      ];
      localStorage.setItem("knotty_demo_library_borrows", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoBorrows = (data: any[]) => localStorage.setItem("knotty_demo_library_borrows", JSON.stringify(data));

  const getDemoDiscipline = (): any[] => {
    const val = localStorage.getItem("knotty_demo_discipline");
    if (!val) {
      const initial = [
        {
          id: "disp-1",
          type: "LATE_ARRIVAL",
          title: "Late for Morning Assembly",
          description: "Student arrived 20 minutes late without a valid reason.",
          action_taken: "Verbal warning and detention after school.",
          severity: "LOW",
          status: "RESOLVED",
          parent_notified: true,
          recorded_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          created_at: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          student: { id: "std-1", user: { first_name: "Kamanzi", last_name: "Eric" } },
          student_id: "std-1",
          recorder: { first_name: "Rugamba", last_name: "Victor", role: "DISCIPLINE" }
        }
      ];
      localStorage.setItem("knotty_demo_discipline", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoDiscipline = (data: any[]) => localStorage.setItem("knotty_demo_discipline", JSON.stringify(data));

  const getDemoHealth = (): any[] => {
    const val = localStorage.getItem("knotty_demo_health");
    if (!val) {
      const initial = [
        {
          id: "health-1",
          type: "MALARIA_TEST",
          title: "Mild Fever & Headache",
          description: "Student presented with headache. Malaria RDT test performed: Negative.",
          treatment_given: "Given Paracetamol 500mg and rested for 1 hour.",
          severity: "LOW",
          follow_up_required: false,
          resolved_at: new Date().toISOString(),
          recorded_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
          student: { id: "std-2", user: { first_name: "Uwineza", last_name: "Divine" } },
          student_id: "std-2",
          recorder: { first_name: "Mutoni", last_name: "Diane", role: "NURSE" }
        }
      ];
      localStorage.setItem("knotty_demo_health", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoHealth = (data: any[]) => localStorage.setItem("knotty_demo_health", JSON.stringify(data));

  const getDemoCampuses = (): any[] => {
    const val = localStorage.getItem("knotty_demo_campuses");
    if (!val) {
      const initial = [{ id: "camp-main", name: "Main Campus", address: "KG 12 Ave, Kigali" }];
      localStorage.setItem("knotty_demo_campuses", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoCampuses = (data: any[]) => localStorage.setItem("knotty_demo_campuses", JSON.stringify(data));

  const getDemoDevices = (): any[] => {
    const val = localStorage.getItem("knotty_demo_devices");
    if (!val) {
      const initial = [
        { id: "dev-main-in", campus_id: "camp-main", name: "Main Gate Entry", location_type: "CAMPUS_GATE", zone_id: null, campus: { name: "Main Campus" } },
        { id: "dev-main-out", campus_id: "camp-main", name: "Main Gate Exit", location_type: "CAMPUS_GATE", zone_id: null, campus: { name: "Main Campus" } }
      ];
      localStorage.setItem("knotty_demo_devices", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoDevices = (data: any[]) => localStorage.setItem("knotty_demo_devices", JSON.stringify(data));

  const getDemoZones = (): any[] => {
    const val = localStorage.getItem("knotty_demo_zones");
    if (!val) {
      const initial = [{ id: "zone-lab", campus_id: "camp-main", name: "Computer Science Lab", description: "Access restricted to S5/S6 science students.", campus: { name: "Main Campus" } }];
      localStorage.setItem("knotty_demo_zones", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoZones = (data: any[]) => localStorage.setItem("knotty_demo_zones", JSON.stringify(data));

  const getDemoAccessLogs = (): any[] => {
    const val = localStorage.getItem("knotty_demo_access_logs");
    if (!val) {
      const initial = [
        {
          id: "log-1",
          device_id: "dev-main-in",
          card_id: "card-1",
          direction: "ENTRY",
          decision: "GRANTED",
          denial_reason: null,
          overridden_by_user_id: null,
          occurred_at: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
          device: { name: "Main Gate Entry", location_type: "CAMPUS_GATE" },
          card: { student: { user: { first_name: "Kamanzi", last_name: "Eric", profile_photo: null } } }
        }
      ];
      localStorage.setItem("knotty_demo_access_logs", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoAccessLogs = (data: any[]) => localStorage.setItem("knotty_demo_access_logs", JSON.stringify(data));

  const getDemoVisitors = (): any[] => {
    const val = localStorage.getItem("knotty_demo_visitors");
    if (!val) {
      const initial = [
        {
          id: "vis-1",
          visitor_name: "Nsabimana Jean",
          id_document_ref: "1199580012345678",
          purpose: "IT Support",
          checked_in_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
          checked_out_at: null,
          host: { first_name: "School", last_name: "Admin" },
          campus: { name: "Main Campus" }
        }
      ];
      localStorage.setItem("knotty_demo_visitors", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoVisitors = (data: any[]) => localStorage.setItem("knotty_demo_visitors", JSON.stringify(data));

  const getDemoCanteenTransactions = (): any[] => {
    const val = localStorage.getItem("knotty_demo_canteen_transactions");
    if (!val) {
      const initial = [
        {
          id: "tx-cant-1",
          items_purchased: [
            { name: "Samosa", price: 500, quantity: 2 },
            { name: "Juice", price: 1000, quantity: 1 }
          ],
          total_amount: 2000,
          wallet_balance_before: 5000,
          wallet_balance_after: 3000,
          transaction_time: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
          student: { user: { first_name: "Kamanzi", last_name: "Eric" } }
        }
      ];
      localStorage.setItem("knotty_demo_canteen_transactions", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoCanteenTransactions = (data: any[]) => localStorage.setItem("knotty_demo_canteen_transactions", JSON.stringify(data));

  const getDemoFeeStructures = (): any[] => {
    const val = localStorage.getItem("knotty_demo_fee_structures");
    if (!val) {
      const initial = [
        { id: "struct-1", name: "S5 PCM Tuition Fee", academic_term_id: "term-1", applies_to: ["Senior 5"], amount: 120000, created_at: "2026-01-05T09:00:00.000Z" }
      ];
      localStorage.setItem("knotty_demo_fee_structures", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoFeeStructures = (data: any[]) => localStorage.setItem("knotty_demo_fee_structures", JSON.stringify(data));

  const getDemoInvoices = (): any[] => {
    const val = localStorage.getItem("knotty_demo_invoices");
    if (!val) {
      const initial = [
        {
          id: "inv-1",
          student_id: "std-1",
          fee_structure_id: "struct-1",
          amount: 120000,
          paid_amount: 120000,
          status: "PAID",
          due_date: "2026-02-28T23:59:59.000Z",
          created_at: "2026-01-05T09:00:00.000Z",
          student: { id: "std-1", user: { first_name: "Kamanzi", last_name: "Eric" } },
          fee_structure: { name: "S5 PCM Tuition Fee" }
        },
        {
          id: "inv-2",
          student_id: "std-2",
          fee_structure_id: "struct-1",
          amount: 120000,
          paid_amount: 40000,
          status: "PARTIALLY_PAID",
          due_date: "2026-02-28T23:59:59.000Z",
          created_at: "2026-01-05T09:00:00.000Z",
          student: { id: "std-2", user: { first_name: "Uwineza", last_name: "Divine" } },
          fee_structure: { name: "S5 PCM Tuition Fee" }
        }
      ];
      localStorage.setItem("knotty_demo_invoices", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoInvoices = (data: any[]) => localStorage.setItem("knotty_demo_invoices", JSON.stringify(data));

  const getDemoRefunds = (): any[] => {
    const val = localStorage.getItem("knotty_demo_refunds");
    if (!val) {
      const initial = [] as any[];
      localStorage.setItem("knotty_demo_refunds", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoRefunds = (data: any[]) => localStorage.setItem("knotty_demo_refunds", JSON.stringify(data));

  const getDemoFeePayments = (): any[] => {
    const val = localStorage.getItem("knotty_demo_fee_payments");
    if (!val) {
      const initial = [
        {
          id: "pay-1",
          student_id: "std-1",
          school_id: "demo-school",
          amount: 120000,
          payment_type: "TUITION",
          payment_method: "MOMO",
          status: "SUCCESS",
          term: "Term 1",
          academic_year: "2025-2026",
          created_at: "2026-01-10T14:30:00.000Z",
          student: { id: "std-1", user: { first_name: "Kamanzi", last_name: "Eric" } }
        }
      ];
      localStorage.setItem("knotty_demo_fee_payments", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoFeePayments = (data: any[]) => localStorage.setItem("knotty_demo_fee_payments", JSON.stringify(data));

  const getDemoTerms = (): any[] => {
    const val = localStorage.getItem("knotty_demo_terms");
    if (!val) {
      const initial = [
        { id: "term-1", name: "Term 1 2026", start_date: "2026-01-05", end_date: "2026-04-10" },
        { id: "term-2", name: "Term 2 2026", start_date: "2026-04-20", end_date: "2026-07-15" }
      ];
      localStorage.setItem("knotty_demo_terms", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoTerms = (data: any[]) => localStorage.setItem("knotty_demo_terms", JSON.stringify(data));

  const getDemoPrograms = (): any[] => {
    const val = localStorage.getItem("knotty_demo_programs");
    if (!val) {
      const initial = [
        { id: "prog-pcm", name: "PCM (Physics-Chemistry-Math)" },
        { id: "prog-mcg", name: "MCG (Math-Chem-Geography)" }
      ];
      localStorage.setItem("knotty_demo_programs", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoPrograms = (data: any[]) => localStorage.setItem("knotty_demo_programs", JSON.stringify(data));

  const getDemoSections = (): any[] => {
    const val = localStorage.getItem("knotty_demo_sections");
    if (!val) {
      const initial = [
        {
          id: "sect-s5pcm",
          name: "Senior 5 PCM",
          program_id: "prog-pcm",
          academic_term_id: "term-1",
          capacity: 40,
          homeroom_staff_id: "staff-teacher",
          program: { id: "prog-pcm", name: "PCM (Physics-Chemistry-Math)" },
          term: { id: "term-1", name: "Term 1 2026" },
          homeroom_teacher: { id: "staff-teacher", first_name: "Kagabo", last_name: "Robert", email: "teacher@knottyschool.rw" },
          _count: { enrollments: 2 }
        }
      ];
      localStorage.setItem("knotty_demo_sections", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoSections = (data: any[]) => localStorage.setItem("knotty_demo_sections", JSON.stringify(data));

  const getDemoEnrollments = (): any[] => {
    const val = localStorage.getItem("knotty_demo_enrollments");
    if (!val) {
      const initial = [
        {
          id: "en-1",
          student_id: "std-1",
          class_section_id: "sect-s5pcm",
          academic_term_id: "term-1",
          student: {
            id: "std-1",
            student_code: "KMS260001",
            user: { first_name: "Kamanzi", last_name: "Eric", email: "eric@knottyschool.rw", phone: "+250788000011" }
          }
        },
        {
          id: "en-2",
          student_id: "std-2",
          class_section_id: "sect-s5pcm",
          academic_term_id: "term-1",
          student: {
            id: "std-2",
            student_code: "KMS260002",
            user: { first_name: "Uwineza", last_name: "Divine", email: "divine@knottyschool.rw", phone: "+250788000012" }
          }
        }
      ];
      localStorage.setItem("knotty_demo_enrollments", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoEnrollments = (data: any[]) => localStorage.setItem("knotty_demo_enrollments", JSON.stringify(data));

  const getDemoTimetable = (): any[] => {
    const val = localStorage.getItem("knotty_demo_timetable");
    if (!val) {
      const initial = [
        {
          id: "tt-1",
          class_section_id: "sect-s5pcm",
          subject_id: "sub-math",
          staff_id: "staff-teacher",
          day_of_week: 1,
          start_time: "08:30",
          end_time: "10:00",
          room: "Room 101",
          subject: { id: "sub-math", name: "Mathematics", code: "MATH" },
          teacher: { id: "staff-teacher", first_name: "Kagabo", last_name: "Robert" }
        },
        {
          id: "tt-2",
          class_section_id: "sect-s5pcm",
          subject_id: "sub-phy",
          staff_id: "staff-teacher",
          day_of_week: 2,
          start_time: "10:30",
          end_time: "12:00",
          room: "Physics Lab",
          subject: { id: "sub-phy", name: "Physics", code: "PHYS" },
          teacher: { id: "staff-teacher", first_name: "Kagabo", last_name: "Robert" }
        }
      ];
      localStorage.setItem("knotty_demo_timetable", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoTimetable = (data: any[]) => localStorage.setItem("knotty_demo_timetable", JSON.stringify(data));

  const getDemoExams = (): any[] => {
    const val = localStorage.getItem("knotty_demo_exams");
    if (!val) {
      const initial = [
        {
          id: "exam-1",
          name: "Midterm Algebra Test",
          subject_id: "sub-math",
          academic_term_id: "term-1",
          exam_date: "2026-02-15",
          max_score: 100,
          category: "EU",
          subject: { id: "sub-math", name: "Mathematics", code: "MATH" },
          term: { id: "term-1", name: "Term 1 2026" }
        }
      ];
      localStorage.setItem("knotty_demo_exams", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoExams = (data: any[]) => localStorage.setItem("knotty_demo_exams", JSON.stringify(data));

  const getDemoExamResults = (): any[] => {
    const val = localStorage.getItem("knotty_demo_exam_results");
    if (!val) {
      const initial = [
        {
          id: "res-1",
          exam_id: "exam-1",
          student_id: "std-1",
          score: 88,
          grade_letter: "B",
          entered_by: "staff-teacher",
          approved_by: null,
          approved_at: null,
          student: { id: "std-1", student_code: "KMS260001", user: { first_name: "Kamanzi", last_name: "Eric" } },
          recorder: { first_name: "Kagabo", last_name: "Robert" },
          approver: null
        },
        {
          id: "res-2",
          exam_id: "exam-1",
          student_id: "std-2",
          score: 95,
          grade_letter: "A",
          entered_by: "staff-teacher",
          approved_by: "staff-teacher",
          approved_at: new Date().toISOString(),
          student: { id: "std-2", student_code: "KMS260002", user: { first_name: "Uwineza", last_name: "Divine" } },
          recorder: { first_name: "Kagabo", last_name: "Robert" },
          approver: { first_name: "Kagabo", last_name: "Robert" }
        }
      ];
      localStorage.setItem("knotty_demo_exam_results", JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(val);
  };
  const saveDemoExamResults = (data: any[]) => localStorage.setItem("knotty_demo_exam_results", JSON.stringify(data));

  // 1. Levels
  if (path.startsWith("/structure/levels")) {
    const levels = getLevels();
    if (method === "GET") {
      return { success: true, data: levels } as unknown as T;
    }
    if (method === "POST") {
      const newLvl = {
        id: "lvl-" + Date.now(),
        name: body.name,
        description: body.description || null,
        order_index: body.order_index || 0,
        _count: { classes: 0, students: 0 }
      };
      levels.push(newLvl);
      saveLevels(levels);
      return { success: true, data: newLvl } as unknown as T;
    }
    if (method === "DELETE") {
      const id = path.split("/").pop();
      const filtered = levels.filter((l: any) => l.id !== id);
      saveLevels(filtered);
      return { success: true } as unknown as T;
    }
  }

  // 2. Classes
  if (path.startsWith("/structure/classes")) {
    const classes = getClasses();
    const levels = getLevels();
    if (method === "GET") {
      return { success: true, data: classes } as unknown as T;
    }
    if (method === "POST") {
      const levelObj = levels.find((l: any) => l.id === body.level_id) || { id: body.level_id, name: "Unknown" };
      const newCls = {
        id: "cls-" + Date.now(),
        name: body.name,
        level: levelObj,
        academic_year: body.academic_year || "2025-2026",
        class_teacher_id: null,
        _count: { students: 0 }
      };
      classes.push(newCls);
      saveClasses(classes);
      return { success: true, data: newCls } as unknown as T;
    }
    if (method === "DELETE") {
      const id = path.split("/").pop();
      const filtered = classes.filter((c: any) => c.id !== id);
      saveClasses(filtered);
      return { success: true } as unknown as T;
    }
  }

  // 3. Students
  if (path.startsWith("/students")) {
    const studentsList = getStudents();
    const levels = getLevels();
    const classes = getClasses();

    // Check specific resource ID
    const pathParts = path.split("?")[0].split("/");
    const studentId = pathParts[2];

    if (studentId && studentId !== "me") {
      if (path.includes("/consent")) {
        return { success: true, data: [] } as unknown as T;
      }
      if (path.includes("/full-profile")) {
        const student = studentsList.find((s: any) => s.id === studentId);
        return { success: true, data: { ...student, parent: null, attendances: [], reports: [], health: [], discipline: [], achievements: [] } } as unknown as T;
      }

      const studentIndex = studentsList.findIndex((s: any) => s.id === studentId);
      if (method === "GET") {
        return { success: true, data: studentsList[studentIndex] } as unknown as T;
      }
      if (method === "PUT") {
        if (studentIndex > -1) {
          const levelObj = levels.find((l: any) => l.id === body.level_id) || studentsList[studentIndex].level;
          const classObj = classes.find((c: any) => c.id === body.class_id) || studentsList[studentIndex].class;
          
          studentsList[studentIndex] = {
            ...studentsList[studentIndex],
            gender: body.gender || studentsList[studentIndex].gender,
            nationality: body.nationality || studentsList[studentIndex].nationality,
            date_of_birth: body.date_of_birth || studentsList[studentIndex].date_of_birth,
            user: {
              ...studentsList[studentIndex].user,
              first_name: body.first_name || studentsList[studentIndex].user.first_name,
              last_name: body.last_name || studentsList[studentIndex].user.last_name,
              phone: body.phone !== undefined ? body.phone : studentsList[studentIndex].user.phone,
              profile_photo: body.profile_photo !== undefined ? body.profile_photo : studentsList[studentIndex].user.profile_photo,
            },
            level: levelObj,
            class: classObj,
          };
          saveStudents(studentsList);
          return { success: true, data: studentsList[studentIndex] } as unknown as T;
        }
      }
      if (method === "DELETE") {
        const filtered = studentsList.filter((s: any) => s.id !== studentId);
        saveStudents(filtered);
        return { success: true } as unknown as T;
      }
    }

    if (method === "GET") {
      const urlObj = new URL(path, "http://localhost");
      const classId = urlObj.searchParams.get("classId");
      const levelId = urlObj.searchParams.get("levelId");
      const searchVal = urlObj.searchParams.get("search");

      let filtered = studentsList;
      if (classId) filtered = filtered.filter((s: any) => s.class?.id === classId);
      if (levelId) filtered = filtered.filter((s: any) => s.level?.id === levelId);
      if (searchVal) {
        const q = searchVal.toLowerCase();
        filtered = filtered.filter((s: any) => 
          `${s.user.first_name} ${s.user.last_name}`.toLowerCase().includes(q) ||
          s.student_code.toLowerCase().includes(q) ||
          s.user.email.toLowerCase().includes(q)
        );
      }

      return {
        success: true,
        data: filtered,
        pagination: { total: filtered.length, page: 1, limit: 100, pages: 1 }
      } as unknown as T;
    }

    if (method === "POST") {
      const levelObj = levels.find((l: any) => l.id === body.level_id) || null;
      const classObj = classes.find((c: any) => c.id === body.class_id) || null;
      const newStudent = {
        id: "std-" + Date.now(),
        student_code: "KMS26" + String(studentsList.length + 1).padStart(4, "0"),
        gender: body.gender || "M",
        nationality: body.nationality || "Rwandan",
        date_of_birth: body.date_of_birth || null,
        user: {
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone || null,
          profile_photo: body.profile_photo || null
        },
        level: levelObj,
        class: classObj,
        card: null,
        parent_id: null
      };
      studentsList.push(newStudent);
      saveStudents(studentsList);
      return { success: true, data: newStudent } as unknown as T;
    }
  }

  // 4. Cards Issue
  if (path.startsWith("/cards/issue/")) {
    const studentId = path.split("/").pop();
    const studentsList = getStudents();
    const studentIndex = studentsList.findIndex((s: any) => s.id === studentId);
    if (studentIndex > -1) {
      const card = {
        id: "card-" + Date.now(),
        card_number: "KNT-DEMO-" + Math.floor(100000 + Math.random() * 900000),
        wallet_balance: 0,
        is_active: true,
        is_frozen: false,
        nfc_uid: null,
        qr_code: "mock-qr-code",
        expires_at: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      studentsList[studentIndex].card = card;
      saveStudents(studentsList);
      return { success: true, data: card } as unknown as T;
    }
  }

  // 5. Cards Top up
  if (path.includes("/top-up-cash")) {
    const parts = path.split("/");
    const cardId = parts[2];
    const studentsList = getStudents();
    const studentIndex = studentsList.findIndex((s: any) => s.card?.id === cardId);
    if (studentIndex > -1) {
      studentsList[studentIndex].card.wallet_balance += body.amount;
      saveStudents(studentsList);
      return { success: true } as unknown as T;
    }
  }

  // 6. Health Records
  if (path.startsWith("/health")) {
    if (method === "POST") {
      return { success: true } as unknown as T;
    }
  }

  // 6b. Library Stats
  if (path.startsWith("/library/stats")) {
    return {
      success: true,
      data: {
        borrowedBooks: 145,
        returnedBooks: 320,
        overdueBooks: 12,
        missingBooks: 3,
        totalBooks: 1240,
        visitors: 450,
        newMembers: 24,
        pendingFees: 15000,
        borrowedTrend: "+12%",
        returnedTrend: "+8%",
        overdueTrend: "-5%",
        missingTrend: "0%",
        totalTrend: "+2%",
        visitorsTrend: "+15%",
        newMembersTrend: "+4%",
        pendingFeesTrend: "-10%"
      }
    } as unknown as T;
  }

  // Canteen dynamic handlers
  if (path.startsWith("/canteen/report")) {
    const txs = getDemoCanteenTransactions();
    const total = txs.reduce((sum: number, t: any) => sum + t.total_amount, 0);
    return {
      success: true,
      transactions: txs,
      total_revenue: total,
      transaction_count: txs.length
    } as unknown as T;
  }

  if (path.startsWith("/canteen/transactions/")) {
    const studentId = path.split("/")[3];
    const txs = getDemoCanteenTransactions().filter((t: any) => t.student_id === studentId);
    return { success: true, data: txs, pagination: { total: txs.length, page: 1, limit: 10, pages: 1 } } as unknown as T;
  }

  if (path.startsWith("/canteen/purchase")) {
    const students = getStudents();
    const std = students.find((s: any) => s.card?.card_number === body.card_number) || students[0];
    const txs = getDemoCanteenTransactions();
    const totalAmount = (body.items || []).reduce((sum: number, it: any) => sum + (it.price * it.quantity), 0);
    
    let balanceBefore = std.card?.wallet_balance ?? 5000;
    let balanceAfter = Math.max(0, balanceBefore - totalAmount);

    const stdIdx = students.findIndex((s: any) => s.id === std.id);
    if (stdIdx > -1 && students[stdIdx].card) {
      students[stdIdx].card.wallet_balance = balanceAfter;
      saveStudents(students);
    }

    const newTx = {
      id: "tx-cant-" + Date.now(),
      items_purchased: body.items || [],
      total_amount: totalAmount,
      wallet_balance_before: balanceBefore,
      wallet_balance_after: balanceAfter,
      transaction_time: new Date().toISOString(),
      student: { user: { first_name: std.user.first_name, last_name: std.user.last_name } },
      student_id: std.id
    };
    txs.unshift(newTx);
    saveDemoCanteenTransactions(txs);
    return { success: true, transaction: newTx, new_balance: balanceAfter } as unknown as T;
  }

  // Fees dynamic handlers
  if (path.startsWith("/fees/report")) {
    const payments = getDemoFeePayments();
    const invoices = getDemoInvoices();
    const total = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const pending = invoices.filter((i: any) => i.status !== "PAID").reduce((sum: number, i: any) => sum + (i.amount - i.paid_amount), 0);
    return {
      success: true,
      data: {
        total_collected: total,
        pending: pending,
        by_type: [
          { payment_type: "TUITION", _sum: { amount: total }, _count: payments.length }
        ]
      }
    } as unknown as T;
  }

  if (path.startsWith("/fees/student/")) {
    const studentId = path.split("?")[0].split("/")[3];
    const payments = getDemoFeePayments().filter((p: any) => p.student_id === studentId);
    return { success: true, data: payments, pagination: { total: payments.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
  }

  if (path.startsWith("/fees/pay")) {
    const students = getStudents();
    const std = students.find((s: any) => s.id === body.student_id) || students[0];
    const payments = getDemoFeePayments();
    const newPay = {
      id: "pay-" + Date.now(),
      student_id: body.student_id,
      school_id: body.school_id,
      amount: Number(body.amount),
      payment_type: body.payment_type || "TUITION",
      payment_method: body.payment_method || "CASH",
      status: "SUCCESS",
      term: body.term || "Term 1",
      academic_year: body.academic_year || "2025-2026",
      created_at: new Date().toISOString(),
      student: { user: { first_name: std.user.first_name, last_name: std.user.last_name } }
    };
    payments.unshift(newPay);
    saveDemoFeePayments(payments);
    return { success: true, payment: newPay, message: "Payment recorded successfully" } as unknown as T;
  }

  if (path.startsWith("/fees/structures")) {
    const structuresList = getDemoFeeStructures();
    const parts = path.split("/");
    const structId = parts[3];
    if (method === "GET") {
      return { success: true, data: structuresList } as unknown as T;
    }
    if (method === "POST") {
      const newStruct = {
        id: "struct-" + Date.now(),
        name: body.name,
        academic_term_id: body.academic_term_id || null,
        applies_to: body.applies_to || [],
        amount: Number(body.amount),
        created_at: new Date().toISOString()
      };
      structuresList.push(newStruct);
      saveDemoFeeStructures(structuresList);
      return { success: true, data: newStruct } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = structuresList.filter((s: any) => s.id !== structId);
      saveDemoFeeStructures(filtered);
      return { success: true } as unknown as T;
    }
  }

  if (path.startsWith("/fees/invoices")) {
    if (path.includes("/generate")) {
      const students = getStudents();
      const structures = getDemoFeeStructures();
      const targetStruct = structures.find((s: any) => s.id === body.fee_structure_id) || structures[0];
      const invoicesList = getDemoInvoices();

      const generated = students.map((std: any) => {
        const newInv = {
          id: "inv-" + Math.random().toString(36).substr(2, 9),
          student_id: std.id,
          fee_structure_id: body.fee_structure_id,
          amount: targetStruct.amount,
          paid_amount: 0,
          status: "UNPAID",
          due_date: body.due_date || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          student: { id: std.id, user: { first_name: std.user.first_name, last_name: std.user.last_name } },
          fee_structure: { name: targetStruct.name }
        };
        invoicesList.unshift(newInv);
        return newInv;
      });
      saveDemoInvoices(invoicesList);
      return { success: true, count: generated.length, invoices: generated } as unknown as T;
    }

    if (path.includes("/pay")) {
      const invoicesList = getDemoInvoices();
      const idx = invoicesList.findIndex((i: any) => i.id === body.invoice_id);
      if (idx > -1) {
        const inv = invoicesList[idx];
        const amt = Number(body.amount);
        const paid = inv.paid_amount + amt;
        inv.paid_amount = paid;
        inv.status = paid >= inv.amount ? "PAID" : "PARTIALLY_PAID";
        saveDemoInvoices(invoicesList);

        const payments = getDemoFeePayments();
        const newPay = {
          id: "pay-" + Date.now(),
          student_id: inv.student_id,
          school_id: "demo-school",
          amount: amt,
          payment_type: "TUITION",
          payment_method: body.channel || "CASH",
          status: "SUCCESS",
          term: "Term 1",
          academic_year: "2025-2026",
          created_at: new Date().toISOString(),
          student: inv.student
        };
        payments.unshift(newPay);
        saveDemoFeePayments(payments);

        return { success: true, payment: newPay, message: "Invoice paid successfully" } as unknown as T;
      }
    }

    const invoicesList = getDemoInvoices();
    return { success: true, data: invoicesList } as unknown as T;
  }

  if (path.startsWith("/fees/refunds")) {
    const refundsList = getDemoRefunds();
    const parts = path.split("/");
    const refId = parts[3];

    if (method === "GET") {
      return { success: true, data: refundsList } as unknown as T;
    }
    if (method === "POST") {
      if (refId && path.includes("/resolve")) {
        const idx = refundsList.findIndex((r: any) => r.id === refId);
        if (idx > -1) {
          refundsList[idx].status = body.status;
          refundsList[idx].resolved_at = new Date().toISOString();
          saveDemoRefunds(refundsList);
          return { success: true, refund: refundsList[idx] } as unknown as T;
        }
      }
      
      const newRef = {
        id: "ref-" + Date.now(),
        wallet_transaction_id: body.wallet_transaction_id,
        reason: body.reason,
        status: "PENDING",
        created_at: new Date().toISOString(),
        resolved_at: null,
        student: { user: { first_name: "Kamanzi", last_name: "Eric" } },
        requester: { first_name: "Kamanzi", last_name: "Eric" },
        approver: null
      };
      refundsList.push(newRef);
      saveDemoRefunds(refundsList);
      return { success: true, data: newRef } as unknown as T;
    }
  }

  // Library dynamic handlers
  if (path.startsWith("/library/stats")) {
    const books = getDemoBooks();
    const borrows = getDemoBorrows();
    const totalBooks = books.reduce((sum: number, b: any) => sum + b.total_copies, 0);
    const activeBorrows = borrows.filter((b: any) => b.returned_at === null);
    const returnedBorrows = borrows.filter((b: any) => b.returned_at !== null);
    return {
      success: true,
      data: {
        borrowedBooks: activeBorrows.length,
        returnedBooks: returnedBorrows.length,
        overdueBooks: activeBorrows.filter((b: any) => new Date(b.due_at) < new Date()).length,
        missingBooks: 0,
        totalBooks: totalBooks,
        visitors: 145,
        newMembers: 12,
        pendingFees: 2000,
        borrowedTrend: "+5%",
        returnedTrend: "+8%",
        overdueTrend: "0%",
        missingTrend: "0%",
        totalTrend: "+2%",
        visitorsTrend: "+10%",
        newMembersTrend: "+4%",
        pendingFeesTrend: "-15%"
      }
    } as unknown as T;
  }

  if (path.startsWith("/library/books")) {
    const booksList = getDemoBooks();
    const parts = path.split("/");
    const bookId = parts[3];

    if (method === "GET") {
      if (bookId) {
        const book = booksList.find((b: any) => b.id === bookId);
        const copies = [
          { id: `copy-${bookId}-1`, copy_tag: `${book?.category || "GEN"}-001`, status: "AVAILABLE", created_at: book?.created_at, book: book, borrows: [] }
        ];
        return { success: true, data: { ...book, copies } } as unknown as T;
      }
      return { success: true, data: booksList, pagination: { total: booksList.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
    }
    if (method === "POST") {
      const newBook = {
        id: "book-" + Date.now(),
        title: body.title,
        author: body.author,
        isbn: body.isbn || null,
        category: body.category || "GENERAL",
        total_copies: Number(body.total_copies || 1),
        created_at: new Date().toISOString()
      };
      booksList.push(newBook);
      saveDemoBooks(booksList);
      return { success: true, data: newBook } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = booksList.filter((b: any) => b.id !== bookId);
      saveDemoBooks(filtered);
      return { success: true } as unknown as T;
    }
  }

  if (path.startsWith("/library/borrow")) {
    const borrowsList = getDemoBorrows();
    const parts = path.split("/");

    if (method === "GET") {
      if (path.includes("/student/")) {
        const studentId = parts[4];
        const studentBors = borrowsList.filter((b: any) => b.student_id === studentId);
        return { success: true, data: studentBors, pagination: { total: studentBors.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
      }
      return { success: true, data: borrowsList, pagination: { total: borrowsList.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
    }
    
    if (method === "POST") {
      const students = getStudents();
      const std = students.find((s: any) => s.student_code === body.student_code) || students[0];
      const books = getDemoBooks();
      const bookObj = books[0];
      
      const newBorrow = {
        id: "bor-" + Date.now(),
        borrowed_at: new Date().toISOString(),
        due_at: new Date(Date.now() + (body.due_days || 7) * 24 * 3600 * 1000).toISOString(),
        returned_at: null,
        fine_amount: 0,
        student: { user: { first_name: std.user.first_name, last_name: std.user.last_name } },
        student_id: std.id,
        copy: { id: "copy-demo", copy_tag: body.copy_tag, status: "BORROWED", created_at: new Date().toISOString(), book: bookObj }
      };
      borrowsList.unshift(newBorrow);
      saveDemoBorrows(borrowsList);
      return { success: true, data: newBorrow, message: "Book borrowed successfully" } as unknown as T;
    }
  }

  if (path.startsWith("/library/return")) {
    const borrowsList = getDemoBorrows();
    const idx = borrowsList.findIndex((b: any) => b.copy?.copy_tag === body.copy_tag && b.returned_at === null);
    if (idx > -1) {
      borrowsList[idx].returned_at = new Date().toISOString();
      saveDemoBorrows(borrowsList);
      return {
        success: true,
        data: {
          record: borrowsList[idx],
          fine_amount: 0,
          fine_charged_to_wallet: false
        },
        message: "Book returned successfully"
      } as unknown as T;
    }
  }

  // Discipline dynamic handlers
  if (path.startsWith("/discipline/school")) {
    const list = getDemoDiscipline();
    return { success: true, data: list, pagination: { total: list.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
  }

  if (path.startsWith("/discipline/student/")) {
    const studentId = path.split("/")[3].split("?")[0];
    const list = getDemoDiscipline().filter((d: any) => d.student_id === studentId);
    return { success: true, data: list, pagination: { total: list.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
  }

  if (path.startsWith("/discipline")) {
    const list = getDemoDiscipline();
    const parts = path.split("/");
    const recId = parts[2];

    if (method === "POST") {
      const students = getStudents();
      const std = students.find((s: any) => s.id === body.student_id) || students[0];
      const newRec = {
        id: "disp-" + Date.now(),
        type: body.type,
        title: body.title,
        description: body.description || null,
        action_taken: body.action_taken || null,
        severity: body.severity || "LOW",
        status: "PENDING",
        parent_notified: false,
        recorded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        student: { user: { first_name: std.user.first_name, last_name: std.user.last_name } },
        student_id: std.id,
        recorder: { first_name: "Rugamba", last_name: "Victor", role: "DISCIPLINE" }
      };
      list.unshift(newRec);
      saveDemoDiscipline(list);
      return { success: true, data: newRec } as unknown as T;
    }

    if (method === "PUT" && recId) {
      const idx = list.findIndex((r: any) => r.id === recId);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...body };
        saveDemoDiscipline(list);
        return { success: true, data: list[idx] } as unknown as T;
      }
    }
  }

  // Health dynamic handlers
  if (path.startsWith("/health")) {
    const list = getDemoHealth();
    const parts = path.split("/");
    const recId = parts[2];

    if (method === "GET") {
      if (path.includes("/student/")) {
        const studentId = parts[3];
        const studentRecs = list.filter((h: any) => h.student_id === studentId);
        return { success: true, data: studentRecs } as unknown as T;
      }
      return { success: true, data: list, pagination: { total: list.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
    }

    if (method === "POST") {
      const students = getStudents();
      const std = students.find((s: any) => s.id === body.student_id) || students[0];
      const newRec = {
        id: "health-" + Date.now(),
        type: body.type,
        title: body.title,
        description: body.description || null,
        treatment_given: body.treatment_given || null,
        severity: body.severity || "LOW",
        follow_up_required: body.follow_up_required || false,
        resolved_at: null,
        recorded_at: new Date().toISOString(),
        student: { user: { first_name: std.user.first_name, last_name: std.user.last_name } },
        student_id: std.id,
        recorder: { first_name: "Mutoni", last_name: "Diane", role: "NURSE" }
      };
      list.unshift(newRec);
      saveDemoHealth(list);
      return { success: true, data: newRec } as unknown as T;
    }

    if (method === "PUT" && recId) {
      const idx = list.findIndex((r: any) => r.id === recId);
      if (idx > -1) {
        list[idx] = { ...list[idx], ...body };
        saveDemoHealth(list);
        return { success: true, data: list[idx] } as unknown as T;
      }
    }
  }

  // Gate Access dynamic handlers
  if (path.startsWith("/gate-access/campuses")) {
    const list = getDemoCampuses();
    if (method === "GET") {
      return { success: true, data: list } as unknown as T;
    }
    if (method === "POST") {
      const newCamp = {
        id: "camp-" + Date.now(),
        name: body.name,
        address: body.address || null,
        timezone_override: null
      };
      list.push(newCamp);
      saveDemoCampuses(list);
      return { success: true, data: newCamp } as unknown as T;
    }
  }

  if (path.startsWith("/gate-access/devices")) {
    const list = getDemoDevices();
    const parts = path.split("/");
    const devId = parts[3];

    if (method === "GET") {
      return { success: true, data: list } as unknown as T;
    }
    if (method === "POST") {
      const camps = getDemoCampuses();
      const campObj = camps.find((c: any) => c.id === body.campus_id) || { name: "Main Campus" };
      const newDev = {
        id: "dev-" + Date.now(),
        campus_id: body.campus_id,
        name: body.name,
        location_type: body.location_type || "CAMPUS_GATE",
        zone_id: body.zone_id || null,
        campus: campObj
      };
      list.push(newDev);
      saveDemoDevices(list);
      return { success: true, data: newDev } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = list.filter((d: any) => d.id !== devId);
      saveDemoDevices(filtered);
      return { success: true } as unknown as T;
    }
  }

  if (path.startsWith("/gate-access/zones")) {
    const list = getDemoZones();
    const parts = path.split("/");
    const zoneId = parts[3];

    if (method === "GET") {
      return { success: true, data: list } as unknown as T;
    }
    if (method === "POST") {
      const camps = getDemoCampuses();
      const campObj = camps.find((c: any) => c.id === body.campus_id) || { name: "Main Campus" };
      const newZone = {
        id: "zone-" + Date.now(),
        campus_id: body.campus_id,
        name: body.name,
        description: body.description || null,
        campus: campObj
      };
      list.push(newZone);
      saveDemoZones(list);
      return { success: true, data: newZone } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = list.filter((z: any) => z.id !== zoneId);
      saveDemoZones(filtered);
      return { success: true } as unknown as T;
    }
  }

  if (path.startsWith("/gate-access/visitors")) {
    const list = getDemoVisitors();
    const parts = path.split("/");
    const visId = parts[3];

    if (method === "GET") {
      return { success: true, data: list, pagination: { total: list.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
    }
    if (method === "POST") {
      if (visId && path.includes("/checkout")) {
        const idx = list.findIndex((v: any) => v.id === visId);
        if (idx > -1) {
          list[idx].checked_out_at = new Date().toISOString();
          saveDemoVisitors(list);
        }
        return { success: true } as unknown as T;
      }

      const newVis = {
        id: "vis-" + Date.now(),
        visitor_name: body.visitor_name,
        id_document_ref: body.id_document_ref || null,
        purpose: body.purpose,
        checked_in_at: new Date().toISOString(),
        checked_out_at: null,
        host: { first_name: "School", last_name: "Admin" },
        campus: { name: "Main Campus" }
      };
      list.unshift(newVis);
      saveDemoVisitors(list);
      return { success: true, data: newVis } as unknown as T;
    }
  }

  if (path.startsWith("/gate-access/logs")) {
    const list = getDemoAccessLogs();
    return { success: true, data: list, pagination: { total: list.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
  }

  if (path.startsWith("/gate-access/evaluate")) {
    const students = getStudents();
    const std = students.find((s: any) => s.card?.card_number === body.cardNumber) || students[0];
    const logs = getDemoAccessLogs();

    const newLog = {
      id: "log-" + Date.now(),
      device_id: body.deviceId || "dev-main-in",
      card_id: std.card?.id || "card-demo",
      direction: body.direction || "ENTRY",
      decision: "GRANTED",
      denial_reason: null,
      overridden_by_user_id: null,
      occurred_at: new Date().toISOString(),
      device: { name: "Gate Device", location_type: "CAMPUS_GATE" },
      card: { student: { user: { first_name: std.user.first_name, last_name: std.user.last_name, profile_photo: std.user.profile_photo } } }
    };
    logs.unshift(newLog);
    saveDemoAccessLogs(logs);

    return {
      success: true,
      data: {
        decision: "GRANTED",
        ownerName: `${std.user.first_name} ${std.user.last_name}`,
        studentCode: std.student_code,
        photoUrl: std.user.profile_photo || undefined
      }
    } as unknown as T;
  }

  // 7. Grading Scale
  if (path.startsWith("/academics/grading-scale")) {
    if (method === "POST") {
      localStorage.setItem("knotty_demo_grading_scale", JSON.stringify(body));
      return { success: true, data: body } as unknown as T;
    }
    const val = localStorage.getItem("knotty_demo_grading_scale");
    if (val) {
      return { success: true, data: JSON.parse(val) } as unknown as T;
    }
    return {
      success: true,
      data: {
        id: "demo-scale",
        name: "Default Rwandan Grading Scale",
        bands: [
          { min: 90, max: 100, letter: "A", gpa: 4.0 },
          { min: 80, max: 89, letter: "B", gpa: 3.0 },
          { min: 70, max: 79, letter: "C", gpa: 2.0 },
          { min: 60, max: 69, letter: "D", gpa: 1.0 },
          { min: 50, max: 59, letter: "E", gpa: 0.5 },
          { min: 0, max: 49, letter: "F", gpa: 0.0 }
        ]
      }
    } as unknown as T;
  }

  // Academics - terms
  if (path.startsWith("/academics/terms")) {
    const termList = getDemoTerms();
    const parts = path.split("/");
    const termId = parts[3];

    if (method === "GET") {
      return { success: true, data: termList } as unknown as T;
    }
    if (method === "POST") {
      const newTerm = {
        id: "term-" + Date.now(),
        name: body.name,
        start_date: body.start_date,
        end_date: body.end_date
      };
      termList.push(newTerm);
      saveDemoTerms(termList);
      return { success: true, data: newTerm } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = termList.filter((t: any) => t.id !== termId);
      saveDemoTerms(filtered);
      return { success: true } as unknown as T;
    }
  }

  // Academics - programs
  if (path.startsWith("/academics/programs")) {
    const progList = getDemoPrograms();
    const parts = path.split("/");
    const progId = parts[3];

    if (method === "GET") {
      return { success: true, data: progList } as unknown as T;
    }
    if (method === "POST") {
      const newProg = {
        id: "prog-" + Date.now(),
        name: body.name
      };
      progList.push(newProg);
      saveDemoPrograms(progList);
      return { success: true, data: newProg } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = progList.filter((p: any) => p.id !== progId);
      saveDemoPrograms(filtered);
      return { success: true } as unknown as T;
    }
  }

  // Academics - sections
  if (path.startsWith("/academics/sections")) {
    const sectList = getDemoSections();
    const parts = path.split("/");
    const sectId = parts[3];

    if (method === "GET") {
      if (sectId) {
        const sect = sectList.find((s: any) => s.id === sectId);
        const enrollList = getDemoEnrollments().filter((e: any) => e.class_section_id === sectId);
        const ttList = getDemoTimetable().filter((t: any) => t.class_section_id === sectId);
        return {
          success: true,
          data: {
            ...sect,
            enrollments: enrollList,
            timetable_entries: ttList
          }
        } as unknown as T;
      }
      return { success: true, data: sectList } as unknown as T;
    }
    if (method === "POST") {
      const progs = getDemoPrograms();
      const terms = getDemoTerms();
      const progObj = progs.find((p: any) => p.id === body.program_id) || { id: body.program_id, name: "General" };
      const termObj = terms.find((t: any) => t.id === body.academic_term_id) || { id: body.academic_term_id, name: "Term 1" };
      
      const newSect = {
        id: "sect-" + Date.now(),
        name: body.name,
        program_id: body.program_id,
        academic_term_id: body.academic_term_id,
        capacity: Number(body.capacity || 40),
        homeroom_staff_id: body.homeroom_staff_id || null,
        program: progObj,
        term: termObj,
        homeroom_teacher: { id: "staff-teacher", first_name: "Kagabo", last_name: "Robert", email: "teacher@knottyschool.rw" },
        _count: { enrollments: 0 }
      };
      sectList.push(newSect);
      saveDemoSections(sectList);
      return { success: true, data: newSect } as unknown as T;
    }
  }

  // Academics - enroll
  if (path.startsWith("/academics/enroll")) {
    const enrollList = getDemoEnrollments();
    if (method === "POST") {
      const studentsList = getStudents();
      const std = studentsList.find((s: any) => s.id === body.student_id) || studentsList[0];
      const newEnroll = {
        id: "en-" + Date.now(),
        student_id: body.student_id,
        class_section_id: body.class_section_id,
        academic_term_id: body.academic_term_id,
        student: {
          id: std.id,
          student_code: std.student_code,
          user: { first_name: std.user.first_name, last_name: std.user.last_name, email: std.user.email, phone: std.user.phone }
        }
      };
      enrollList.push(newEnroll);
      saveDemoEnrollments(enrollList);

      // Increment enrollment count in section
      const sectList = getDemoSections();
      const idx = sectList.findIndex((s: any) => s.id === body.class_section_id);
      if (idx > -1) {
        sectList[idx]._count.enrollments += 1;
        saveDemoSections(sectList);
      }

      return { success: true, data: newEnroll } as unknown as T;
    }
  }

  // Academics - enrollments delete
  if (path.startsWith("/academics/enrollments/")) {
    const enrollList = getDemoEnrollments();
    const parts = path.split("/");
    const enrollId = parts[3];
    if (method === "DELETE") {
      const target = enrollList.find((e: any) => e.id === enrollId);
      const filtered = enrollList.filter((e: any) => e.id !== enrollId);
      saveDemoEnrollments(filtered);

      if (target) {
        // Decrement enrollment count in section
        const sectList = getDemoSections();
        const idx = sectList.findIndex((s: any) => s.id === target.class_section_id);
        if (idx > -1) {
          sectList[idx]._count.enrollments = Math.max(0, sectList[idx]._count.enrollments - 1);
          saveDemoSections(sectList);
        }
      }
      return { success: true } as unknown as T;
    }
  }

  // Academics - timetable
  if (path.startsWith("/academics/timetable")) {
    const ttList = getDemoTimetable();
    const parts = path.split("/");
    const ttId = parts[3];

    if (method === "GET") {
      return { success: true, data: ttList } as unknown as T;
    }
    if (method === "POST") {
      const subs = [
        { id: "sub-math", name: "Mathematics", code: "MATH" },
        { id: "sub-phy", name: "Physics", code: "PHYS" },
        { id: "sub-chem", name: "Chemistry", code: "CHEM" },
        { id: "sub-bio", name: "Biology", code: "BIOL" },
        { id: "sub-eng", name: "English", code: "ENGL" },
      ];
      const subObj = subs.find((s: any) => s.id === body.subject_id) || subs[0];
      const newEntry = {
        id: "tt-" + Date.now(),
        class_section_id: body.class_section_id,
        subject_id: body.subject_id,
        staff_id: body.staff_id,
        day_of_week: Number(body.day_of_week || 1),
        start_time: body.start_time,
        end_time: body.end_time,
        room: body.room || "Room 101",
        subject: subObj,
        teacher: { id: body.staff_id, first_name: "Kagabo", last_name: "Robert" }
      };
      ttList.push(newEntry);
      saveDemoTimetable(ttList);
      return { success: true, data: newEntry } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = ttList.filter((t: any) => t.id !== ttId);
      saveDemoTimetable(filtered);
      return { success: true } as unknown as T;
    }
  }

  // Academics - exams and results
  if (path.startsWith("/academics/exams")) {
    const examList = getDemoExams();
    const parts = path.split("/");
    const examId = parts[3];

    if (method === "GET") {
      if (examId && path.includes("/results")) {
        const resList = getDemoExamResults().filter((r: any) => r.exam_id === examId);
        return { success: true, data: resList } as unknown as T;
      }
      return { success: true, data: examList } as unknown as T;
    }
    if (method === "POST") {
      if (examId && path.includes("/results")) {
        const currentResList = getDemoExamResults();
        const recorded = (body.results || []).map((r: any) => {
          const id = "res-" + Math.random().toString(36).substr(2, 9);
          const students = getStudents();
          const std = students.find((s: any) => s.id === r.student_id) || students[0];
          
          let grade = "F";
          const pct = (r.score / 100) * 100;
          if (pct >= 90) grade = "A";
          else if (pct >= 80) grade = "B";
          else if (pct >= 70) grade = "C";
          else if (pct >= 50) grade = "D";

          const newRes = {
            id,
            exam_id: examId,
            student_id: r.student_id,
            score: Number(r.score),
            grade_letter: grade,
            entered_by: "staff-teacher",
            approved_by: null,
            approved_at: null,
            student: { id: r.student_id, student_code: std?.student_code || "KMS269999", user: { first_name: std?.user.first_name || "Student", last_name: std?.user.last_name || "User" } },
            recorder: { first_name: "Kagabo", last_name: "Robert" },
            approver: null
          };
          currentResList.push(newRes);
          return newRes;
        });
        saveDemoExamResults(currentResList);
        return { success: true, data: recorded, message: "Exam results recorded successfully" } as unknown as T;
      }

      const subs = [
        { id: "sub-math", name: "Mathematics", code: "MATH" },
        { id: "sub-phy", name: "Physics", code: "PHYS" },
        { id: "sub-chem", name: "Chemistry", code: "CHEM" },
        { id: "sub-bio", name: "Biology", code: "BIOL" },
        { id: "sub-eng", name: "English", code: "ENGL" },
      ];
      const subObj = subs.find((s: any) => s.id === body.subject_id) || subs[0];
      const terms = getDemoTerms();
      const termObj = terms.find((t: any) => t.id === body.academic_term_id) || { id: body.academic_term_id, name: "Term 1" };
      const newExam = {
        id: "exam-" + Date.now(),
        name: body.name,
        subject_id: body.subject_id,
        academic_term_id: body.academic_term_id,
        exam_date: body.exam_date,
        max_score: Number(body.max_score || 100),
        category: body.category || "EU",
        subject: subObj,
        term: termObj
      };
      examList.push(newExam);
      saveDemoExams(examList);
      return { success: true, data: newExam } as unknown as T;
    }
    if (method === "DELETE") {
      const filtered = examList.filter((e: any) => e.id !== examId);
      saveDemoExams(filtered);
      return { success: true } as unknown as T;
    }
  }

  // Academics - results approval
  if (path.startsWith("/academics/exams/results/")) {
    const parts = path.split("/");
    const resId = parts[4];
    if (method === "POST" && path.endsWith("/approve")) {
      const currentResList = getDemoExamResults();
      const idx = currentResList.findIndex((r: any) => r.id === resId);
      if (idx > -1) {
        currentResList[idx].approved_by = "staff-teacher";
        currentResList[idx].approved_at = new Date().toISOString();
        currentResList[idx].approver = { first_name: "Kagabo", last_name: "Robert" };
        saveDemoExamResults(currentResList);
        return { success: true, data: currentResList[idx], message: "Exam result approved successfully" } as unknown as T;
      }
    }
  }

  // 8. Secure QR
  if (path.includes("/secure-qr")) {
    return {
      success: true,
      token: "demo-token",
      qr_code: "demo-qr",
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
    } as unknown as T;
  }

  // 9. Structure Staff
  if (path.startsWith("/structure/staff")) {
    const staffList = getStaffList();
    if (method === "GET") {
      return { success: true, data: staffList } as unknown as T;
    }
    if (method === "POST") {
      const newStaff = {
        id: "staff-" + Date.now(),
        first_name: body.first_name,
        last_name: body.last_name,
        email: body.email,
        role: body.role,
        is_active: true,
        last_login: null,
        created_at: new Date().toISOString()
      };
      staffList.push(newStaff);
      saveStaffList(staffList);

      if (body.role === "TEACHER") {
        const teachers = getTeachersList();
        const newTch = {
          id: "tch-" + Date.now(),
          user_id: newStaff.id,
          employee_code: "TCH-DEMO-" + String(teachers.length + 1).padStart(4, "0"),
          subjects_taught: [],
          user: {
            first_name: body.first_name,
            last_name: body.last_name,
            email: body.email,
            phone: body.phone || null
          }
        };
        teachers.push(newTch);
        saveTeachersList(teachers);
      }

      return { success: true, data: newStaff } as unknown as T;
    }
    if (path.includes("/toggle")) {
      const id = path.split("/")[3];
      const idx = staffList.findIndex((s: any) => s.id === id);
      if (idx > -1) {
        staffList[idx].is_active = !staffList[idx].is_active;
        saveStaffList(staffList);
        return { success: true, data: { id, is_active: staffList[idx].is_active } } as unknown as T;
      }
    }
  }

  // 10. Teachers List and Update
  if (path.startsWith("/teachers")) {
    const teachersList = getTeachersList();
    const parts = path.split("/");
    const teacherId = parts[2];

    if (method === "GET") {
      if (teacherId) {
        const teacher = teachersList.find((t: any) => t.id === teacherId);
        return { success: true, data: teacher } as unknown as T;
      }
      return { success: true, data: teachersList } as unknown as T;
    }
    if (method === "PUT" && teacherId) {
      const idx = teachersList.findIndex((t: any) => t.id === teacherId);
      if (idx > -1) {
        teachersList[idx] = {
          ...teachersList[idx],
          subjects_taught: body.subjects_taught || teachersList[idx].subjects_taught
        };
        saveTeachersList(teachersList);
        return { success: true, data: teachersList[idx] } as unknown as T;
      }
    }
  }

  // Materials mock handler for upload, list and delete
  if (path.startsWith("/materials")) {
    const materialsList = getMaterials();
    const parts = path.split("?")[0].split("/");
    const matId = parts[2];

    if (method === "GET") {
      if (matId) {
        const mat = materialsList.find((m: any) => m.id === matId);
        return { success: true, data: mat } as unknown as T;
      }
      
      const urlObj = new URL(path, "http://localhost");
      const classId = urlObj.searchParams.get("classId");
      const searchVal = urlObj.searchParams.get("search");

      let filtered = materialsList;
      if (classId) {
        const classes = getClasses();
        const targetCls = classes.find((c: any) => c.id === classId);
        if (targetCls) {
          filtered = filtered.filter((m: any) => m.class?.name === targetCls.name);
        }
      }
      if (searchVal) {
        const q = searchVal.toLowerCase();
        filtered = filtered.filter((m: any) =>
          m.title.toLowerCase().includes(q) ||
          (m.subject && m.subject.toLowerCase().includes(q))
        );
      }

      return {
        success: true,
        data: filtered,
        pagination: { total: filtered.length, page: 1, limit: 100, pages: 1 }
      } as unknown as T;
    }

    if (method === "POST") {
      let fdTitle = "Mock Material Note";
      let fdDesc = "";
      let fdSubject = "General";
      let fdClassId = "";
      let fileUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
      let fileName = "mock_note.pdf";
      let fileType = "application/pdf";

      if (options.body && options.body instanceof FormData) {
        const fileObj = options.body.get("file");
        if (fileObj && fileObj instanceof File) {
          fileName = fileObj.name;
          fileType = fileObj.type;
          if (typeof window !== "undefined") {
            try {
              fileUrl = URL.createObjectURL(fileObj);
            } catch (e) {
              fileUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
            }
          }
        }
        fdTitle = options.body.get("title") as string || fdTitle;
        fdDesc = options.body.get("description") as string || fdDesc;
        fdSubject = options.body.get("subject") as string || fdSubject;
        fdClassId = options.body.get("classId") as string || fdClassId;
      }

      let creatorUser = { first_name: "Teacher", last_name: "User" };
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("knotty_demo_user");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.first_name) creatorUser.first_name = parsed.first_name;
            if (parsed.last_name) creatorUser.last_name = parsed.last_name;
          } catch {}
        }
      }

      let classObj = null;
      let levelObj = null;
      if (fdClassId) {
        const classes = getClasses();
        const targetCls = classes.find((c: any) => c.id === fdClassId);
        if (targetCls) {
          classObj = { name: targetCls.name };
          levelObj = { name: targetCls.level?.name || "Senior 5" };
        }
      }

      const newMat = {
        id: "mat-" + Date.now(),
        title: fdTitle,
        description: fdDesc || null,
        subject: fdSubject || null,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        created_at: new Date().toISOString(),
        uploader: creatorUser,
        class: classObj,
        level: levelObj
      };

      materialsList.unshift(newMat);
      saveMaterials(materialsList);

      return {
        success: true,
        data: newMat
      } as unknown as T;
    }

    if (method === "DELETE") {
      const parts = path.split("/");
      const id = parts[parts.length - 1];
      const filtered = materialsList.filter((m: any) => m.id !== id);
      saveMaterials(filtered);
      return { success: true } as unknown as T;
    }
  }

  // Reports mock handler for create, list, update and publish
  if (path.startsWith("/reports")) {
    const reportsList = getReports();
    const parts = path.split("?")[0].split("/");
    const repId = parts[2];

    if (method === "GET") {
      if (path.includes("/student/me")) {
        const myReps = reportsList.filter((r: any) => r.student_id === "std-1" && r.is_published);
        return { success: true, data: myReps, pagination: { total: myReps.length, page: 1, limit: 10, pages: 1 } } as unknown as T;
      }
      if (path.includes("/student/")) {
        const studentId = parts[3];
        const studentReps = reportsList.filter((r: any) => r.student_id === studentId);
        return { success: true, data: studentReps, pagination: { total: studentReps.length, page: 1, limit: 10, pages: 1 } } as unknown as T;
      }
      if (repId) {
        const rep = reportsList.find((r: any) => r.id === repId);
        return { success: true, data: rep } as unknown as T;
      }
      return { success: true, data: reportsList, pagination: { total: reportsList.length, page: 1, limit: 100, pages: 1 } } as unknown as T;
    }

    if (method === "POST") {
      if (path.endsWith("/publish")) {
        const targetId = parts[2];
        const idx = reportsList.findIndex((r: any) => r.id === targetId);
        if (idx > -1) {
          reportsList[idx].is_published = true;
          saveReports(reportsList);
        }
        return { success: true } as unknown as T;
      }

      // Create report
      const newRep = {
        id: "rep-" + Date.now(),
        student_id: body.student_id,
        school_id: body.school_id,
        class_id: body.class_id,
        term: body.term,
        academic_year: body.academic_year,
        grades: body.grades || [],
        total_marks: body.total_marks || 0,
        average: body.average || 0,
        position_in_class: body.position_in_class || null,
        teacher_remarks: body.teacher_remarks || null,
        principal_remarks: body.principal_remarks || null,
        conduct_grade: body.conduct_grade || "40",
        is_published: false,
        created_at: new Date().toISOString()
      };
      reportsList.unshift(newRep);
      saveReports(reportsList);
      return { success: true, data: newRep } as unknown as T;
    }

    if (method === "PUT" && repId) {
      const idx = reportsList.findIndex((r: any) => r.id === repId);
      if (idx > -1) {
        reportsList[idx] = {
          ...reportsList[idx],
          ...body
        };
        saveReports(reportsList);
        return { success: true, data: reportsList[idx] } as unknown as T;
      }
    }
  }

  // Attendance mock handlers
  if (path.startsWith("/attendance")) {
    if (method === "GET") {
      if (path.includes("/today-summary")) {
        return {
          success: true,
          summary: { PRESENT: 15, ABSENT: 3, LATE: 2, EXCUSED: 1 },
          total: 21,
          recent: [
            {
              id: "rec-1",
              check_in_time: new Date().toISOString(),
              check_out_time: null,
              student: {
                user: { first_name: "Ntwari", last_name: "Albert", profile_photo: null },
                class: { name: "A" }
              }
            }
          ]
        } as unknown as T;
      }
    }

    if (method === "POST") {
      if (path.includes("/scan") || path.includes("/scan-nfc") || path.includes("/scan-secure")) {
        let cardNumber = "KNT-DEMO-999999";
        if (body && body.card_number) {
          cardNumber = body.card_number;
        } else if (body && body.nfc_uid) {
          const students = getStudents();
          const found = students.find((s: any) => s.card?.nfc_uid === body.nfc_uid);
          cardNumber = found?.card?.card_number || "KNT-DEMO-888888";
        }
        return {
          success: true,
          data: {
            id: "att-" + Date.now(),
            action: "TAP_IN",
            check_in_time: new Date().toISOString(),
            check_out_time: null,
            card_number: cardNumber
          }
        } as unknown as T;
      }

      if (path.includes("/bulk")) {
        return {
          success: true,
          data: [],
          count: body.records?.length || 0
        } as unknown as T;
      }
    }
  }

  // Cards scanning & settings mock handlers
  if (path.startsWith("/cards") && !path.startsWith("/cards/issue/")) {
    const students = getStudents();
    const id = path.split("?")[0].split("/")[2];

    if (method === "PUT" && path.includes("/nfc")) {
      const idx = students.findIndex((s: any) => s.card?.id === id);
      if (idx > -1) {
        students[idx].card.nfc_uid = body.nfc_uid;
        saveStudents(students);
        return { success: true, data: students[idx].card } as unknown as T;
      }
      return { success: true } as unknown as T;
    }

    if (method === "PUT" && path.includes("/freeze")) {
      const idx = students.findIndex((s: any) => s.card?.id === id);
      if (idx > -1) { students[idx].card.is_frozen = true; saveStudents(students); }
      return { success: true } as unknown as T;
    }

    if (method === "PUT" && path.includes("/unfreeze")) {
      const idx = students.findIndex((s: any) => s.card?.id === id);
      if (idx > -1) { students[idx].card.is_frozen = false; saveStudents(students); }
      return { success: true } as unknown as T;
    }

    if (method === "GET" && path.includes("/scan")) {
      const student = students.find((s: any) => s.card?.card_number === id || s.student_code === id) || students[0];
      return {
        success: true,
        data: {
          id: student.card?.id || "card-demo",
          card_number: student.card?.card_number || "KNT-DEMO-999999",
          wallet_balance: student.card?.wallet_balance ?? 1500,
          is_active: student.card?.is_active ?? true,
          is_frozen: student.card?.is_frozen ?? false,
          student: {
            id: student.id,
            name: `${student.user.first_name} ${student.user.last_name}`,
            class: student.class?.name || "Senior 5 A",
            student_code: student.student_code,
            photo: student.user.profile_photo,
            parent_name: "Parent Name",
            parent_phone: "+250788000000"
          }
        }
      } as unknown as T;
    }

    // GET /cards/nfc/{uid} — look up student by NFC UID
    if (method === "GET" && path.includes("/nfc/")) {
      const nfcUid = path.split("/nfc/")[1]?.split("?")[0];
      const student = students.find((s: any) => s.card?.nfc_uid === nfcUid) || students[0];
      if (!student?.card) {
        throw new Error("Card not found for this NFC tag");
      }
      return {
        success: true,
        data: {
          card_number: student.card.card_number,
          wallet_balance: student.card.wallet_balance ?? 1500,
          student: {
            id: student.id,
            name: `${student.user.first_name} ${student.user.last_name}`,
            photo: student.user.profile_photo,
            class: student.class?.name || "Senior 5 A",
            student_code: student.student_code,
          },
          today_attendance: null,
        }
      } as unknown as T;
    }
  }

  if (path.startsWith("/schools/settings/attendance")) {
    const val = localStorage.getItem("knotty_demo_att_settings");
    let currentSettings = { tap_out_after_minutes: 180, school_start_time: "08:30" };
    if (val) {
      try { currentSettings = JSON.parse(val); } catch {}
    }

    if (method === "GET") {
      return {
        success: true,
        data: currentSettings
      } as unknown as T;
    }

    if (method === "PUT") {
      const updated = { ...currentSettings, ...body };
      localStorage.setItem("knotty_demo_att_settings", JSON.stringify(updated));
      return {
        success: true,
        data: updated
      } as unknown as T;
    }
  }

  // Graceful catch-all fallback for demo mode to prevent hard crashes
  if (method === "GET") {
    return { 
      success: true, 
      data: [], 
      pagination: { total: 0, page: 1, limit: 10, pages: 1 } 
    } as unknown as T;
  }
  return { success: true } as unknown as T;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof window !== "undefined" && localStorage.getItem("knotty_demo") === "true") {
    return handleDemoRequest<T>(path, options);
  }
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
  if (typeof window !== "undefined" && localStorage.getItem("knotty_demo") === "true") {
    return new Blob(["%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 43 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Mock Student Report Card) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000212 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n306\n%%EOF"], { type: "application/pdf" });
  }
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
  myTransactions: (page = 1, limit = 20) =>
    request<{ success: boolean; data: CanteenTransaction[]; pagination: unknown }>(`/canteen/my-transactions?page=${page}&limit=${limit}`),
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
  marks_deducted: number;
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
  studentList: (studentId: string, page = 1, limit = 200) =>
    request<{ success: boolean; data: DisciplineRecord[]; pagination: unknown }>(`/discipline/student/${studentId}?page=${page}&limit=${limit}`),
  create: (data: { student_id: string; type: string; title: string; description?: string; action_taken?: string; severity: string; marks_deducted?: number }) =>
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
    request<{ success: boolean; data: Material }>("/materials", {
      method: "POST",
      headers: { "Content-Type": "none" },
      body: formData,
    }),
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
  description?: string | null;
  publisher?: string | null;
  published_year?: number | null;
  language?: string | null;
  cover_url?: string | null;
  subject?: string | null;
  location?: string | null;
  available_copies?: number;
  borrowed_copies?: number;
  created_at: string;
  _count?: { copies: number };
}

export interface LibraryBookCopy {
  id: string;
  copy_tag: string;
  status: "AVAILABLE" | "BORROWED" | "LOST" | "DAMAGED" | "WITHDRAWN";
  condition?: string | null;
  notes?: string | null;
  created_at: string;
  book?: LibraryBook;
}

export interface LibraryBorrowRecord {
  id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
  fine_waived?: boolean;
  renewed_count?: number;
  notes?: string | null;
  student?: { id: string; student_code?: string; user: { first_name: string; last_name: string } };
  copy?: LibraryBookCopy;
}

export interface LibraryReservation {
  id: string;
  book_id: string;
  student_id: string;
  status: string;
  reserved_at: string;
  expires_at: string;
  notes?: string | null;
  book?: { id: string; title: string; author: string; category?: string };
  student?: { id: string; user: { first_name: string; last_name: string } };
}

export interface LibraryMember {
  id: string;
  student_code?: string;
  user: { first_name: string; last_name: string; email: string };
  class?: { name: string };
  active_borrows: number;
  overdue_borrows: number;
  _count?: { borrow_records: number };
}

export const library = {
  books: (params?: { page?: number; limit?: number; search?: string; category?: string }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: LibraryBook[]; pagination: { total: number; page: number; limit: number; pages: number } }>(`/library/books${qs ? `?${qs}` : ""}`);
  },
  book: (id: string) => request<{ success: boolean; data: LibraryBook & { copies: Array<LibraryBookCopy & { borrows: LibraryBorrowRecord[] }> } }>(`/library/books/${id}`),
  createBook: (data: { title: string; author: string; isbn?: string; category?: string; total_copies?: number; copy_tags?: string[]; location?: string }) =>
    request<{ success: boolean; data: LibraryBook }>("/library/books", { method: "POST", body: JSON.stringify(data) }),
  updateBook: (id: string, data: Partial<LibraryBook>) =>
    request<{ success: boolean; data: LibraryBook }>(`/library/books/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBook: (id: string) => request(`/library/books/${id}`, { method: "DELETE" }),
  
  createCopy: (bookId: string, data: { copy_tag: string }) =>
    request<{ success: boolean; data: LibraryBookCopy }>(`/library/books/${bookId}/copies`, { method: "POST", body: JSON.stringify(data) }),
  updateCopy: (id: string, data: Partial<LibraryBookCopy>) =>
    request<{ success: boolean; data: LibraryBookCopy }>(`/library/copies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteCopy: (id: string) => request(`/library/copies/${id}`, { method: "DELETE" }),

  borrowBook: (data: { copy_tag?: string; book_id?: string; student_code?: string; student_id?: string; due_days?: number; notes?: string }) =>
    request<{ success: boolean; data: LibraryBorrowRecord; message: string }>("/library/borrow", { method: "POST", body: JSON.stringify(data) }),
  returnBook: (data: { copy_tag?: string; borrow_id?: string; fine_rate_per_day?: number }) =>
    request<{ success: boolean; data: { record: LibraryBorrowRecord; fine_amount: number; fine_charged_to_wallet: boolean }; message: string }>("/library/return", { method: "POST", body: JSON.stringify(data) }),
  renewBorrow: (borrowId: string, extraDays?: number) =>
    request<{ success: boolean; data: LibraryBorrowRecord; message: string }>(`/library/borrow/${borrowId}/renew`, { method: "POST", body: JSON.stringify({ extra_days: extraDays ?? 14 }) }),
  waiveFine: (borrowId: string) =>
    request<{ success: boolean; data: LibraryBorrowRecord; message: string }>(`/library/borrow/${borrowId}/waive-fine`, { method: "POST", body: JSON.stringify({}) }),
  studentHistory: (studentId: string, page = 1, limit = 20) =>
    request<{ success: boolean; data: LibraryBorrowRecord[]; pagination: unknown }>(`/library/borrow/student/${studentId}?page=${page}&limit=${limit}`),
  schoolBorrows: (params?: { status?: "active" | "returned" | "overdue"; search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: LibraryBorrowRecord[]; pagination: { total: number; page: number; pages: number } }>(`/library/borrow${qs ? `?${qs}` : ""}`);
  },

  createReservation: (data: { book_id: string; student_id?: string; student_code?: string; expires_days?: number; notes?: string }) =>
    request<{ success: boolean; data: LibraryReservation; message: string }>("/library/reservations", { method: "POST", body: JSON.stringify(data) }),
  reservations: (params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: LibraryReservation[]; pagination: { total: number; pages: number } }>(`/library/reservations${qs ? `?${qs}` : ""}`);
  },
  cancelReservation: (id: string) =>
    request<{ success: boolean; data: LibraryReservation; message: string }>(`/library/reservations/${id}/cancel`, { method: "POST", body: JSON.stringify({}) }),
  fulfillReservation: (id: string) =>
    request<{ success: boolean; data: LibraryReservation; message: string }>(`/library/reservations/${id}/fulfill`, { method: "POST", body: JSON.stringify({}) }),

  members: (params?: { search?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))).toString();
    return request<{ success: boolean; data: LibraryMember[]; pagination: { total: number; pages: number } }>(`/library/members${qs ? `?${qs}` : ""}`);
  },
  memberDetail: (studentId: string) =>
    request<{ success: boolean; data: { student: LibraryMember; borrows: LibraryBorrowRecord[]; reservations: LibraryReservation[]; summary: { total_borrowed: number; active_borrows: number; overdue_borrows: number; total_fines: number } } }>(`/library/members/${studentId}`),

  weeklyStats: () =>
    request<{ success: boolean; data: Array<{ day: string; date: string; checkouts: number; returns: number }> }>("/library/stats/weekly"),
  overdueReport: (page = 1, limit = 50) =>
    request<{ success: boolean; data: Array<LibraryBorrowRecord & { days_overdue: number; accrued_fine: number }>; pagination: unknown }>(`/library/reports/overdue?page=${page}&limit=${limit}`),
  mostBorrowed: (limit = 10) =>
    request<{ success: boolean; data: Array<{ book: LibraryBook; borrow_count: number }> }>(`/library/reports/most-borrowed?limit=${limit}`),

  stats: () => request<{ success: boolean; data: {
    borrowedBooks: number;
    returnedBooks: number;
    overdueBooks: number;
    missingBooks: number;
    totalBooks: number;
    totalCopies: number;
    activeMembers: number;
    pendingReservations: number;
    pendingFees: number;
  } }>("/library/stats"),

  lookupStudent: (q: string) =>
    request<{ success: boolean; data: {
      id: string; name: string; photo: string | null; class: string;
      student_code: string; card_number: string | null; has_card: boolean;
    } }>(`/library/student-lookup?q=${encodeURIComponent(q)}`),
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
  category?: string;
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
  // Subjects
  subjects: () => request<{ success: boolean; data: Array<{ id: string; name: string; code: string; level_id: string }> }>("/academics/subjects"),
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



