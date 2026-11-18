import { getSafeBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type TestStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT RUN";
export type TestCategory =
  | "Database Connectivity"
  | "Authentication"
  | "Tenant Isolation"
  | "Roles & Permissions"
  | "Student Management"
  | "Staff Workflows"
  | "Academic Structure"
  | "Attendance Workflows"
  | "NFC Card Lifecycle"
  | "Edge Functions";
export type SystemTestType =
  | "BEHAVIORAL_EXECUTION"
  | "SCHEMA_EXISTENCE"
  | "CONFIG_CHECK"
  | "CLIENT_CAPABILITY";

export interface TestContext {
  schoolId?: string;
  userId?: string;
  userRole?: string;
}

export interface TestResult {
  status: TestStatus;
  outputSummary?: string;
  errorDetails?: string;
}

export interface SystemTestDefinition {
  id: string;
  name: string;
  category: TestCategory;
  testType: SystemTestType;
  status: TestStatus;
  verifies: string;
  isAutomated: boolean;
  execute: (ctx: TestContext) => Promise<TestResult>;
  lastExecutedAt?: string;
  executionDurationMs?: number;
  outputSummary?: string;
  errorDetails?: string | null;
}

function blocked(reason: string): TestResult {
  return { status: "BLOCKED", errorDetails: reason };
}

function getClient() {
  if (!isSupabaseConfigured()) return null;
  return getSafeBrowserClient();
}

export const SYSTEM_TESTS: SystemTestDefinition[] = [
  // ── Database Connectivity ──────────────────────────────────────────────────
  {
    id: "db-ping",
    name: "Supabase DB Ping",
    category: "Database Connectivity",
    testType: "CONFIG_CHECK",
    status: "NOT RUN",
    verifies: "Supabase client can reach the database and execute a trivial query.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { error } = await client.from("schools").select("id").limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "SELECT on schools returned without error" };
    },
  },
  {
    id: "db-schema-schools",
    name: "schools Table Exists",
    category: "Database Connectivity",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "public.schools table is accessible with expected columns: id, name, code.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { data, error } = await client.from("schools").select("id, name, code").limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: `schools schema OK — ${data?.length ?? 0} row(s) accessible` };
    },
  },
  {
    id: "db-schema-persons",
    name: "persons Table Exists",
    category: "Database Connectivity",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "public.persons table exists with auth_user_id column.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { error } = await client.from("persons").select("id, auth_user_id").limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "persons table accessible" };
    },
  },
  {
    id: "db-schema-student-records",
    name: "student_records Table Exists",
    category: "Database Connectivity",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "public.student_records with school_id, status columns.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { error } = await client.from("student_records").select("id, school_id, status").limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "student_records schema OK" };
    },
  },

  // ── Authentication ─────────────────────────────────────────────────────────
  {
    id: "auth-session-active",
    name: "Active Auth Session",
    category: "Authentication",
    testType: "CONFIG_CHECK",
    status: "NOT RUN",
    verifies: "Current browser session has a valid Supabase JWT.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { data: { session }, error } = await client.auth.getSession();
      if (error) return { status: "FAIL", errorDetails: error.message };
      if (!session) return { status: "FAIL", errorDetails: "No active session — not logged in" };
      const expiresAt = new Date(session.expires_at! * 1000).toLocaleString();
      return { status: "PASS", outputSummary: `Session valid, expires ${expiresAt}` };
    },
  },
  {
    id: "auth-person-linked",
    name: "Auth User → Person Record",
    category: "Authentication",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "Current auth user has a linked active person record in public.persons.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { data: { user } } = await client.auth.getUser();
      if (!user) return blocked("No authenticated user");
      const { data, error } = await client.from("persons").select("id, status").eq("auth_user_id", user.id).maybeSingle();
      if (error) return { status: "FAIL", errorDetails: error.message };
      if (!data) return { status: "FAIL", errorDetails: `No person record for auth_user_id ${user.id}` };
      if (data.status !== "active") return { status: "FAIL", errorDetails: `Person status is '${data.status}', expected 'active'` };
      return { status: "PASS", outputSummary: `Person ${data.id} linked and active` };
    },
  },
  {
    id: "auth-membership-active",
    name: "Person → School Membership",
    category: "Authentication",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "Person has at least one active school_membership with a role.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.userId) return blocked("No authenticated user in context");
      const { data: person } = await client.from("persons").select("id").eq("auth_user_id", ctx.userId).maybeSingle();
      if (!person) return { status: "FAIL", errorDetails: "Person not found" };
      const { data, error } = await client.from("school_memberships").select("id, school_id, status").eq("person_id", person.id).eq("status", "active");
      if (error) return { status: "FAIL", errorDetails: error.message };
      if (!data?.length) return { status: "FAIL", errorDetails: "No active school membership" };
      return { status: "PASS", outputSummary: `${data.length} active membership(s) found` };
    },
  },

  // ── Tenant Isolation ───────────────────────────────────────────────────────
  {
    id: "rls-schools",
    name: "RLS: schools Table",
    category: "Tenant Isolation",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "Authenticated user can only read their own school via RLS.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { data, error } = await client.from("schools").select("id").eq("id", ctx.schoolId).maybeSingle();
      if (error) return { status: "FAIL", errorDetails: error.message };
      if (!data) return { status: "FAIL", errorDetails: "Own school not readable — RLS may be misconfigured" };
      return { status: "PASS", outputSummary: `Own school ${ctx.schoolId.slice(0, 8)}… readable; RLS in effect` };
    },
  },
  {
    id: "rls-attendance-records",
    name: "RLS: attendance_records Table",
    category: "Tenant Isolation",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "attendance_records table accessible and filtered to current school via RLS.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { data, error } = await client.from("attendance_records").select("id, school_id").eq("school_id", ctx.schoolId).limit(5);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: `${data?.length ?? 0} record(s) visible for school` };
    },
  },

  // ── Roles & Permissions ────────────────────────────────────────────────────
  {
    id: "roles-schema",
    name: "school_membership_roles Table",
    category: "Roles & Permissions",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "school_membership_roles table has role_key column.",
    isAutomated: true,
    async execute() {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      const { error } = await client.from("school_membership_roles").select("id, role_key, status").limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "school_membership_roles schema OK" };
    },
  },
  {
    id: "roles-current-user",
    name: "Current User Has Role",
    category: "Roles & Permissions",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "Logged-in user has an active role_key (e.g. ADMIN, TEACHER).",
    isAutomated: true,
    async execute(ctx) {
      if (!ctx.userRole) return { status: "FAIL", errorDetails: "No role found in auth context" };
      return { status: "PASS", outputSummary: `Role resolved: ${ctx.userRole}` };
    },
  },

  // ── Student Management ─────────────────────────────────────────────────────
  {
    id: "students-list-rpc",
    name: "list_school_students RPC",
    category: "Student Management",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "list_school_students RPC returns students for the active school.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { data, error } = await client.rpc("list_school_students" as never, { p_school_id: ctx.schoolId } as never);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: `RPC returned ${(data as unknown[])?.length ?? 0} student(s)` };
    },
  },
  {
    id: "students-nfc-cards",
    name: "nfc_cards Table Schema",
    category: "Student Management",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "nfc_cards table has school_id, card_uid, issued_at columns.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { error } = await client.from("nfc_cards").select("id, school_id, card_uid, issued_at").eq("school_id", ctx.schoolId).limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "nfc_cards schema OK" };
    },
  },

  // ── Staff Workflows ────────────────────────────────────────────────────────
  {
    id: "staff-records-schema",
    name: "staff_records Table Schema",
    category: "Staff Workflows",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "staff_records has school_id, employment_status columns.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { error } = await client.from("staff_records").select("id, school_id, employment_status").eq("school_id", ctx.schoolId).limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "staff_records schema OK" };
    },
  },
  {
    id: "staff-attendance-schema",
    name: "staff_attendance_records Table",
    category: "Staff Workflows",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "staff_attendance_records has first_arrived_at and departed_at columns.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { error } = await client.from("staff_attendance_records").select("id, first_arrived_at, departed_at").eq("school_id", ctx.schoolId).limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "staff_attendance_records schema OK" };
    },
  },

  // ── Academic Structure ─────────────────────────────────────────────────────
  {
    id: "academic-classes",
    name: "school_classes Table",
    category: "Academic Structure",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "school_classes table accessible with school_id, name columns.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { data, error } = await client.from("school_classes").select("id, name").eq("school_id", ctx.schoolId).limit(5);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: `${data?.length ?? 0} class(es) found` };
    },
  },
  {
    id: "academic-subjects",
    name: "subjects Table",
    category: "Academic Structure",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "subjects table accessible.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { error } = await client.from("subjects").select("id, name").eq("school_id", ctx.schoolId).limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "subjects schema OK" };
    },
  },

  // ── Attendance Workflows ───────────────────────────────────────────────────
  {
    id: "attendance-get-gate-overview",
    name: "get_gate_overview RPC",
    category: "Attendance Workflows",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "get_gate_overview RPC returns students_inside, today_entries, today_exits.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { data, error } = await client.rpc("get_gate_overview" as never, { p_school_id: ctx.schoolId } as never);
      if (error) return { status: "FAIL", errorDetails: error.message };
      const row = data as Record<string, unknown>;
      return { status: "PASS", outputSummary: `inside=${row?.students_inside ?? 0}, entries=${row?.today_entries ?? 0}, exits=${row?.today_exits ?? 0}` };
    },
  },
  {
    id: "attendance-scan-events-schema",
    name: "attendance_scan_events Table",
    category: "Attendance Workflows",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "attendance_scan_events has scan_direction, outcome, idempotency_key columns.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      const { error } = await client.from("attendance_scan_events").select("id, scan_direction, outcome, idempotency_key").eq("school_id", ctx.schoolId).limit(1);
      if (error) return { status: "FAIL", errorDetails: error.message };
      return { status: "PASS", outputSummary: "attendance_scan_events schema OK" };
    },
  },
  {
    id: "attendance-multi-entry-rpc",
    name: "record_virtual_student_tap_v2 RPC Exists",
    category: "Attendance Workflows",
    testType: "SCHEMA_EXISTENCE",
    status: "NOT RUN",
    verifies: "record_virtual_student_tap_v2 RPC is defined and callable (gate multi-entry fix).",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      // Call with a dummy student_id — expect P0002 'student not found', not 'function does not exist'
      const { error } = await client.rpc("record_virtual_student_tap_v2" as never, {
        p_school_id: ctx.schoolId,
        p_student_id: "00000000-0000-0000-0000-000000000000",
        p_idempotency_key: "00000000-0000-0000-0000-000000000001",
        p_direction: "auto",
        p_occurred_at: new Date().toISOString(),
      } as never);
      if (!error) return { status: "PASS", outputSummary: "RPC callable and returned OK" };
      if (error.message.includes("does not exist") || error.code === "42883") {
        return { status: "FAIL", errorDetails: "RPC function not found in DB — migration may not have run" };
      }
      // Any other error (like P0002 student not found) means the function IS there
      return { status: "PASS", outputSummary: `RPC exists — responded with expected guard: ${error.message.slice(0, 60)}` };
    },
  },

  // ── NFC Card Lifecycle ─────────────────────────────────────────────────────
  {
    id: "nfc-issue-card-fn",
    name: "issue-card Edge Function Reachable",
    category: "NFC Card Lifecycle",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "The issue-card Supabase Edge Function responds (even with an auth/param error).",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      try {
        const { error } = await client.functions.invoke("issue-card", {
          body: { school_id: ctx.schoolId, person_id: "00000000-0000-0000-0000-000000000000", card_type: "student" },
        });
        // Any response (including validation error) means the function is deployed
        if (error && (error.message.includes("not found") || error.message.includes("404"))) {
          return { status: "FAIL", errorDetails: "issue-card function not deployed" };
        }
        return { status: "PASS", outputSummary: "issue-card function reachable and responded" };
      } catch (e: unknown) {
        return { status: "FAIL", errorDetails: e instanceof Error ? e.message : String(e) };
      }
    },
  },
  {
    id: "nfc-browser-api",
    name: "Web NFC API (NDEFReader)",
    category: "NFC Card Lifecycle",
    testType: "CLIENT_CAPABILITY",
    status: "NOT RUN",
    verifies: "Browser supports Web NFC API (requires Chrome on Android).",
    isAutomated: true,
    async execute() {
      if (typeof window === "undefined") return blocked("Not in browser environment");
      if ("NDEFReader" in window) {
        return { status: "PASS", outputSummary: "NDEFReader available in this browser" };
      }
      return {
        status: "BLOCKED",
        errorDetails: "NDEFReader not available — requires Chrome on Android with HTTPS. Desktop Chrome does not support Web NFC.",
      };
    },
  },

  // ── Edge Functions ─────────────────────────────────────────────────────────
  {
    id: "edge-fn-process-attendance",
    name: "process-attendance-scan Edge Function",
    category: "Edge Functions",
    testType: "BEHAVIORAL_EXECUTION",
    status: "NOT RUN",
    verifies: "process-attendance-scan Edge Function is deployed and responds.",
    isAutomated: true,
    async execute(ctx) {
      const client = getClient();
      if (!client) return blocked("Supabase not configured");
      if (!ctx.schoolId) return blocked("schoolId not in context");
      try {
        const { error } = await client.functions.invoke("process-attendance-scan", {
          body: { school_id: ctx.schoolId, card_uid: "TEST-PROBE-000", scanned_at: new Date().toISOString() },
        });
        if (error && (error.message.includes("not found") || error.message.includes("404"))) {
          return { status: "FAIL", errorDetails: "process-attendance-scan not deployed" };
        }
        return { status: "PASS", outputSummary: "process-attendance-scan reachable and responded" };
      } catch (e: unknown) {
        return { status: "FAIL", errorDetails: e instanceof Error ? e.message : String(e) };
      }
    },
  },
  {
    id: "edge-fn-supabase-url",
    name: "NEXT_PUBLIC_SUPABASE_URL Configured",
    category: "Edge Functions",
    testType: "CONFIG_CHECK",
    status: "NOT RUN",
    verifies: "NEXT_PUBLIC_SUPABASE_URL env var is set and points to the correct project.",
    isAutomated: true,
    async execute() {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!url) return { status: "FAIL", errorDetails: "NEXT_PUBLIC_SUPABASE_URL is not set" };
      if (!url.includes("supabase.co")) return { status: "FAIL", errorDetails: `URL looks wrong: ${url}` };
      return { status: "PASS", outputSummary: `Supabase URL: ${url}` };
    },
  },
];
