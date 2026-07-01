import type { DashboardStats, AttendanceTrendPoint, Student } from "./api";

export const DEMO_ACCOUNTS = [
  { email: "admin@knottyschool.rw",       password: "Admin@2024",   role: "ADMIN",      first_name: "School",   last_name: "Admin"  },
  { email: "teacher@knottyschool.rw",     password: "Staff@2024",   role: "TEACHER",    first_name: "Kagabo",   last_name: "Robert" },
  { email: "bursar@knottyschool.rw",      password: "Staff@2024",   role: "BURSAR",     first_name: "Nshimiye", last_name: "Paul"   },
  { email: "nurse@knottyschool.rw",       password: "Staff@2024",   role: "NURSE",      first_name: "Mutoni",   last_name: "Diane"  },
  { email: "discipline@knottyschool.rw",  password: "Staff@2024",   role: "DISCIPLINE", first_name: "Rugamba",  last_name: "Victor" },
  { email: "canteen@knottyschool.rw",     password: "Staff@2024",   role: "CANTEEN",    first_name: "Umutoni",  last_name: "Claire" },
  { email: "hirwa.jean@knotty.rw",        password: "Student@2024", role: "STUDENT",    first_name: "Hirwa",    last_name: "Jean"   },
];

export const DEMO_SCHOOL_ID = "demo-school-id";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("knotty_demo") === "true";
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
    user: { first_name: "Hirwa",      last_name: "Jean",      email: "hirwa.jean@knotty.rw",       phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card1", card_number: "KNT-KMS-2026-00001", wallet_balance: 6000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-2", student_code: "KMS260002", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Uwase",      last_name: "Marie",     email: "uwase.marie@knotty.rw",      phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card2", card_number: "KNT-KMS-2026-00002", wallet_balance: 7000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-3", student_code: "KMS260003", gender: "M", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Nkurunziza", last_name: "Eric",      email: "nkurunziza.eric@knotty.rw",  phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c2", name: "B" },
    card: { id: "card3", card_number: "KNT-KMS-2026-00003", wallet_balance: 8000,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-4", student_code: "KMS260004", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Mukamana",   last_name: "Alice",     email: "mukamana.alice@knotty.rw",   phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c2", name: "B" }, card: null },
  { id: "std-5", student_code: "KMS260005", gender: "M", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Habimana",   last_name: "Patrick",   email: "habimana.patrick@knotty.rw", phone: null, profile_photo: null },
    level: { id: "l1", name: "Senior 5" }, class: { id: "c1", name: "A" },
    card: { id: "card5", card_number: "KNT-KMS-2026-00005", wallet_balance: 10000, is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
  { id: "std-6", student_code: "KMS260006", gender: "F", nationality: "Rwandan", date_of_birth: undefined,
    user: { first_name: "Uwimana",    last_name: "Grace",     email: "uwimana.grace@knotty.rw",    phone: null, profile_photo: null },
    level: { id: "l2", name: "Senior 6" }, class: { id: "c3", name: "Science" },
    card: { id: "card6", card_number: "KNT-KMS-2026-00006", wallet_balance: 3500,  is_active: true, is_frozen: false, nfc_uid: null, qr_code: "", expires_at: "2028-01-01" } },
];
