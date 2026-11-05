import { getSafeBrowserClient } from "../client";
import type { HealthRecord, MedicalProfile, ClinicVisit } from "@/lib/api";

// ── Mappers ──────────────────────────────────────────────────────────────────

function toHealthRecord(row: {
  record_id: string;
  type: string;
  title: string;
  description: string | null;
  treatment_given: string | null;
  severity: string;
  follow_up_required: boolean;
  resolved_at: string | null;
  recorded_at: string;
  student_id?: string;
  student_name?: string;
  student_code?: string;
  recorder_name?: string;
  student_visit_count?: number;
}): HealthRecord {
  const nameParts = (row.student_name ?? "").trim().split(" ");
  return {
    id: row.record_id,
    type: row.type,
    title: row.title,
    description: row.description,
    treatment_given: row.treatment_given,
    severity: row.severity,
    follow_up_required: row.follow_up_required,
    resolved_at: row.resolved_at,
    recorded_at: row.recorded_at,
    student_code: row.student_code,
    student_visit_count: row.student_visit_count,
    student: row.student_id ? {
      user: {
        first_name: nameParts[0] ?? "",
        last_name: nameParts.slice(1).join(" "),
      },
    } : undefined,
    recorder: row.recorder_name ? {
      first_name: row.recorder_name.split(" ")[0] ?? "",
      last_name: row.recorder_name.split(" ").slice(1).join(" "),
      role: "",
    } : undefined,
  };
}

function toMedicalProfile(row: {
  profile_id: string;
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_phone: string;
  updated_at: string;
}, studentId: string): MedicalProfile {
  return {
    id: row.profile_id,
    student_id: studentId,
    blood_type: row.blood_type,
    allergies: row.allergies ?? [],
    chronic_conditions: row.chronic_conditions ?? [],
    emergency_contact_phone: row.emergency_contact_phone ?? "",
  };
}

function toClinicVisit(row: {
  visit_id: string;
  visit_datetime: string;
  presenting_complaint: string;
  treatment_notes: string | null;
  follow_up_required: boolean;
  recorder_name: string;
  medications: { id: string; medication_name: string; dosage: string; administered_at: string }[];
}, studentId: string): ClinicVisit {
  return {
    id: row.visit_id,
    student_id: studentId,
    visit_datetime: row.visit_datetime,
    presenting_complaint: row.presenting_complaint,
    treatment_notes: row.treatment_notes,
    recorded_by_staff_id: "",
    follow_up_required: row.follow_up_required,
    recorder: {
      first_name: row.recorder_name.split(" ")[0] ?? "",
      last_name: row.recorder_name.split(" ").slice(1).join(" "),
    },
    medications: (row.medications ?? []).map(m => ({
      id: m.id,
      student_id: studentId,
      clinic_visit_id: row.visit_id,
      medication_name: m.medication_name,
      dosage: m.dosage,
      administered_at: m.administered_at,
    })),
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

export const supabaseHealthService = {
  async schoolRecords(
    schoolId: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<HealthRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_school_health_records", {
      p_school_id: schoolId,
      p_search: params?.search ?? null,
      p_limit: params?.limit ?? 100,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toHealthRecord);
  },

  async studentList(
    schoolId: string,
    studentId: string
  ): Promise<HealthRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_student_health_records", {
      p_school_id: schoolId,
      p_student_id: studentId,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toHealthRecord);
  },

  async create(
    schoolId: string,
    params: {
      student_id: string;
      type: string;
      title: string;
      description?: string;
      treatment_given?: string;
      severity: string;
      follow_up_required?: boolean;
    }
  ): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_health_record", {
      p_school_id: schoolId,
      p_student_id: params.student_id,
      p_type: params.type,
      p_title: params.title,
      p_description: params.description ?? null,
      p_treatment_given: params.treatment_given ?? null,
      p_severity: params.severity,
      p_follow_up_required: params.follow_up_required ?? false,
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async getProfile(
    schoolId: string,
    studentId: string
  ): Promise<MedicalProfile | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("get_medical_profile", {
      p_school_id: schoolId,
      p_student_id: studentId,
    });

    if (error) throw new Error(error.message);
    const row = (data as Parameters<typeof toMedicalProfile>[0][])?.[0];
    if (!row) return null;
    return toMedicalProfile(row, studentId);
  },

  async upsertProfile(
    schoolId: string,
    studentId: string,
    params: Partial<Omit<MedicalProfile, "id" | "student_id">>
  ): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("upsert_medical_profile", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_blood_type: params.blood_type ?? null,
      p_allergies: params.allergies ?? [],
      p_chronic_conditions: params.chronic_conditions ?? [],
      p_emergency_contact_phone: params.emergency_contact_phone ?? "",
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async studentVisits(
    schoolId: string,
    studentId: string,
    params?: { page?: number; limit?: number }
  ): Promise<ClinicVisit[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_student_clinic_visits", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_limit: params?.limit ?? 30,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map((row: Parameters<typeof toClinicVisit>[0]) =>
      toClinicVisit(row, studentId)
    );
  },

  async createVisit(
    schoolId: string,
    studentId: string,
    params: {
      presenting_complaint: string;
      treatment_notes?: string;
      follow_up_required?: boolean;
      medications?: Array<{ medication_name: string; dosage: string }>;
    }
  ): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_clinic_visit", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_presenting_complaint: params.presenting_complaint,
      p_treatment_notes: params.treatment_notes ?? null,
      p_follow_up_required: params.follow_up_required ?? false,
      p_medications: params.medications ?? [],
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async getStats(schoolId: string): Promise<{
    total_records: number;
    follow_up_pending: number;
    visits_today: number;
    visits_this_week: number;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("get_health_stats", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    const row = (data as { total_records: number; follow_up_pending: number; visits_today: number; visits_this_week: number }[])?.[0];
    return {
      total_records: Number(row?.total_records ?? 0),
      follow_up_pending: Number(row?.follow_up_pending ?? 0),
      visits_today: Number(row?.visits_today ?? 0),
      visits_this_week: Number(row?.visits_this_week ?? 0),
    };
  },
};
