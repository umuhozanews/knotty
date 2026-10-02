import type { DashboardStats, AttendanceTrendPoint, Student } from "./api";

export interface DemoAccount {
  email: string;
  password: string;
  role: string;
  first_name: string;
  last_name: string;
  school_id: string;
  school_code: string;
  school_name: string;
  job_title?: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  // ── 1. IshuriHUB Model School (KMS) ──
  { email: "admin@ishurihub.rw",        password: "Admin@2024",   role: "ADMIN",      first_name: "School",   last_name: "Admin", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Head Administrator" },
  { email: "teacher@ishurihub.rw",      password: "Staff@2024",   role: "TEACHER",    first_name: "Robert",   last_name: "Kagabo", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Senior Physics & Math Teacher" },
  { email: "canteen@ishurihub.rw",      password: "Staff@2024",   role: "CANTEEN",    first_name: "Claire",  last_name: "Umutoni", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Head Cantinier / POS Manager" },
  { email: "bursar@ishurihub.rw",       password: "Staff@2024",   role: "BURSAR",     first_name: "Paul",    last_name: "Nshimiye", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Chief Bursar & Accountant" },
  { email: "nurse@ishurihub.rw",        password: "Staff@2024",   role: "NURSE",      first_name: "Diane",   last_name: "Mukamana", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Resident Medical Nurse" },
  { email: "discipline@ishurihub.rw",   password: "Staff@2024",   role: "DISCIPLINE", first_name: "Victor",  last_name: "Rugamba", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Chief Discipline Master" },
  { email: "librarian@ishurihub.rw",    password: "Staff@2024",   role: "LIBRARIAN",  first_name: "Jeanne",  last_name: "Uwase", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Head Librarian" },
  { email: "hirwa.jean@ishurihub.rw",   password: "Student@2024", role: "STUDENT",    first_name: "Hirwa",    last_name: "Jean", school_id: "demo-school-id", school_code: "KMS", school_name: "IshuriHUB Model School", job_title: "Student" },

  // ── 2. Green Hills International Academy (GHIA) ──
  { email: "admin@greenhills.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Director", last_name: "GHIA", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "School Principal" },
  { email: "teacher.ghia@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Sciences Teacher" },
  { email: "canteen.ghia@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Catering Supervisor" },
  { email: "bursar.ghia@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Finance Manager" },
  { email: "nurse.ghia@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Campus Nurse" },
  { email: "discipline.ghia@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Dean of Students" },
  { email: "librarian.ghia@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-ghia", school_code: "GHIA", school_name: "Green Hills International Academy", job_title: "Head Librarian" },

  // ── 3. Riviera High School (RHS) ──
  { email: "admin@riviera.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Director", last_name: "RHS", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Headmaster" },
  { email: "teacher.rhs@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Senior Physics Instructor" },
  { email: "canteen.rhs@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Canteen Manager" },
  { email: "bursar.rhs@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Bursar & Accounts" },
  { email: "nurse.rhs@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "School Nurse" },
  { email: "discipline.rhs@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Discipline Officer" },
  { email: "librarian.rhs@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-rhs", school_code: "RHS", school_name: "Riviera High School", job_title: "Library Manager" },

  // ── 4. Kagarama Secondary School (KSS) ──
  { email: "admin@kagarama.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Director", last_name: "KSS", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Principal" },
  { email: "teacher.kss@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Math Teacher" },
  { email: "canteen.kss@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Cafeteria Staff" },
  { email: "bursar.kss@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Bursar" },
  { email: "nurse.kss@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Nurse" },
  { email: "discipline.kss@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Discipline Master" },
  { email: "librarian.kss@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-kss", school_code: "KSS", school_name: "Kagarama Secondary School", job_title: "Librarian" },

  // ── 5. Lycée de Kigali (LDK) ──
  { email: "admin@ldk.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Proviseur", last_name: "LDK", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Proviseur / Principal" },
  { email: "teacher.ldk@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Professeur de Physique" },
  { email: "canteen.ldk@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Responsable Cantine" },
  { email: "bursar.ldk@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Économe / Bursar" },
  { email: "nurse.ldk@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Infirmière Scolaire" },
  { email: "discipline.ldk@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Préfet de Discipline" },
  { email: "librarian.ldk@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-ldk", school_code: "LDK", school_name: "Lycée de Kigali", job_title: "Bibliothécaire" },

  // ── 6. GS Sainte Famille (GSSF) ──
  { email: "admin@saintefamille.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Director", last_name: "GSSF", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Directeur" },
  { email: "teacher.gssf@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Teacher" },
  { email: "canteen.gssf@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Cantinier" },
  { email: "bursar.gssf@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Bursar" },
  { email: "nurse.gssf@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Nurse" },
  { email: "discipline.gssf@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Discipline Master" },
  { email: "librarian.gssf@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-gssf", school_code: "GSSF", school_name: "GS Sainte Famille", job_title: "Librarian" },

  // ── 7. SOS Hermann Gmeiner Technical School (SOST) ──
  { email: "admin@sos.ishurihub.rw", password: "Admin@2024", role: "ADMIN", first_name: "Principal", last_name: "SOST", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Technical Principal" },
  { email: "teacher.sost@ishurihub.rw", password: "Staff@2024", role: "TEACHER", first_name: "Robert", last_name: "Kagabo", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Technical Instructor" },
  { email: "canteen.sost@ishurihub.rw", password: "Staff@2024", role: "CANTEEN", first_name: "Claire", last_name: "Umutoni", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Catering Head" },
  { email: "bursar.sost@ishurihub.rw", password: "Staff@2024", role: "BURSAR", first_name: "Paul", last_name: "Nshimiye", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Accounts Officer" },
  { email: "nurse.sost@ishurihub.rw", password: "Staff@2024", role: "NURSE", first_name: "Diane", last_name: "Mukamana", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Infirmary Officer" },
  { email: "discipline.sost@ishurihub.rw", password: "Staff@2024", role: "DISCIPLINE", first_name: "Victor", last_name: "Rugamba", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Welfare & Discipline" },
  { email: "librarian.sost@ishurihub.rw", password: "Staff@2024", role: "LIBRARIAN", first_name: "Jeanne", last_name: "Uwase", school_id: "sch-sost", school_code: "SOST", school_name: "SOS Hermann Gmeiner Technical School", job_title: "Technical Librarian" },
];

export function getAllDemoAccounts(): DemoAccount[] {
  if (typeof window === "undefined") return DEMO_ACCOUNTS;
  try {
    const customWorkersVal = localStorage.getItem("ishuri_demo_workers");
    if (customWorkersVal) {
      const customWorkers = JSON.parse(customWorkersVal);
      if (Array.isArray(customWorkers)) {
        const customAccounts: DemoAccount[] = customWorkers.map((w: any) => ({
          email: w.email,
          password: "Staff@2024",
          role: w.role,
          first_name: w.first_name,
          last_name: w.last_name,
          school_id: w.school_id || "demo-school-id",
          school_code: "CUSTOM",
          school_name: "IshuriHUB School",
          job_title: w.job_title || w.role,
        }));
        return [...DEMO_ACCOUNTS, ...customAccounts];
      }
    }
  } catch {}
  return DEMO_ACCOUNTS;
}

export const DEMO_SCHOOL_ID = "demo-school-id";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("ishuri_demo") === "true" || localStorage.getItem("knotty_demo") === "true";
}

export const DEMO_STATS: DashboardStats = {
  total_students: 12,
  total_teachers: 5,
  present_today: 9,
  fee_collected: 5_600_000,
  canteen_revenue_today: 45_000,
  canteen_transactions_today: 23,
  low_balance_cards: 2,
};

export const DEMO_TREND: AttendanceTrendPoint[] = [
  { date: "29 May", present: 8,  absence: 4 },
  { date: "30 May", present: 10, absence: 2 },
  { date: "31 May", present: 7,  absence: 5 },
  { date: "01 Jun", present: 9,  absence: 3 },
  { date: "02 Jun", present: 11, absence: 1 },
  { date: "03 Jun", present: 8,  absence: 4 },
  { date: "04 Jun", present: 12, absence: 0 },
  { date: "05 Jun", present: 10, absence: 2 },
  { date: "06 Jun", present: 9,  absence: 3 },
];

export const DEMO_STUDENTS: Student[] = [
  { id: "std-1", student_code: "KMS260001", gender: "M", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Hirwa",      last_name: "Jean",      email: "hirwa.jean@ishurihub.rw",       phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card1", card_number: "ISH-KMS-2026-00001", wallet_balance: 6000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-2", student_code: "KMS260002", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Uwase",      last_name: "Marie",     email: "uwase.marie@ishurihub.rw",      phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card2", card_number: "ISH-KMS-2026-00002", wallet_balance: 7000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-3", student_code: "KMS260003", gender: "M", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Nkurunziza", last_name: "Eric",      email: "nkurunziza.eric@ishurihub.rw",  phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c2", name: "B" },
    card: { id: "card3", card_number: "ISH-KMS-2026-00003", wallet_balance: 8000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-4", student_code: "KMS260004", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Mukamana",   last_name: "Alice",     email: "mukamana.alice@ishurihub.rw",   phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c2", name: "B" }, card: null },
  { id: "std-5", student_code: "KMS260005", gender: "M", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Habimana",   last_name: "Patrick",   email: "habimana.patrick@ishurihub.rw", phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card5", card_number: "ISH-KMS-2026-00005", wallet_balance: 10000, is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-6", student_code: "KMS260006", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Uwimana",    last_name: "Grace",     email: "uwimana.grace@ishurihub.rw",    phone: null, profile_photo: null },
    level: { id: "l2", name: "Senior 6" }, class: { id: "c3", name: "Science" },
    card: { id: "card6", card_number: "ISH-KMS-2026-00006", wallet_balance: 3500,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
];
