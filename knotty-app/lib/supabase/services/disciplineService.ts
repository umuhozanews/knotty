import { getSafeBrowserClient } from "../client";
import type { DisciplineRecord } from "@/lib/api";

// ── Mappers ──────────────────────────────────────────────────────────────────

function toRecord(row: {
  record_id: string;
  type: string;
  title: string;
  description: string | null;
  action_taken: string | null;
  severity: string;
  status: string;
  marks_deducted: number;
  parent_notified: boolean;
  recorded_at: string;
  student_id?: string;
  student_name?: string;
  student_code?: string;
  recorder_name?: string;
}): DisciplineRecord {
  const nameParts = (row.student_name ?? "").trim().split(" ");
  return {
    id: row.record_id,
    type: row.type,
    title: row.title,
    description: row.description,
    action_taken: row.action_taken,
    severity: row.severity,
    status: row.status,
    marks_deducted: row.marks_deducted,
    parent_notified: row.parent_notified,
    recorded_at: row.recorded_at,
    created_at: row.recorded_at,
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

// ── Service ──────────────────────────────────────────────────────────────────

export const supabaseDisciplineService = {
  async schoolList(
    schoolId: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<DisciplineRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_school_discipline", {
      p_school_id: schoolId,
      p_search: params?.search ?? null,
      p_limit: params?.limit ?? 50,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toRecord);
  },

  async studentList(
    schoolId: string,
    studentId: string,
    limit = 100
  ): Promise<DisciplineRecord[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_student_discipline", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_limit: limit,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toRecord);
  },

  async create(
    schoolId: string,
    params: {
      student_id: string;
      type: string;
      title: string;
      description?: string;
      action_taken?: string;
      severity: string;
      marks_deducted?: number;
    }
  ): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_discipline_record", {
      p_school_id: schoolId,
      p_student_id: params.student_id,
      p_type: params.type,
      p_title: params.title,
      p_description: params.description ?? null,
      p_action_taken: params.action_taken ?? null,
      p_severity: params.severity,
      p_marks_deducted: params.marks_deducted ?? 0,
    });

    if (error) throw new Error(error.message);
    return data as string;
  },

  async update(
    schoolId: string,
    recordId: string,
    params: Partial<Pick<DisciplineRecord, "marks_deducted" | "action_taken" | "status" | "parent_notified">>
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("update_discipline_record", {
      p_school_id: schoolId,
      p_record_id: recordId,
      p_marks_deducted: params.marks_deducted ?? null,
      p_action_taken: params.action_taken ?? null,
      p_status: params.status ?? null,
      p_parent_notified: params.parent_notified ?? null,
    });

    if (error) throw new Error(error.message);
  },

  async getStats(schoolId: string): Promise<{
    total: number;
    open_count: number;
    resolved_count: number;
    serious_count: number;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("get_discipline_stats", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    const row = (data as { total: number; open_count: number; resolved_count: number; serious_count: number }[])?.[0];
    return {
      total: Number(row?.total ?? 0),
      open_count: Number(row?.open_count ?? 0),
      resolved_count: Number(row?.resolved_count ?? 0),
      serious_count: Number(row?.serious_count ?? 0),
    };
  },
};
