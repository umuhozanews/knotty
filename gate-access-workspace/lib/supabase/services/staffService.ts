import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type StaffRecordRow = Database["public"]["Tables"]["staff_records"]["Row"];
export type TeacherAssignmentRow = Database["public"]["Tables"]["teacher_assignments"]["Row"];

export const supabaseStaffService = {
  /**
   * List staff records for a school.
   */
  async listStaff(schoolId: string): Promise<StaffRecordRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("staff_records")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Get single staff record.
   */
  async getStaff(schoolId: string, staffRecordId: string): Promise<StaffRecordRow | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("staff_records")
      .select("*")
      .eq("school_id", schoolId)
      .eq("id", staffRecordId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Update staff employment status ('active', 'on_leave', 'suspended', 'terminated').
   */
  async updateStaffStatus(
    schoolId: string,
    staffRecordId: string,
    newStatus: "active" | "on_leave" | "suspended" | "terminated",
    reason: string
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("update_staff_status", {
      p_school_id: schoolId,
      p_staff_record_id: staffRecordId,
      p_new_status: newStatus,
      p_reason: reason,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * List teacher assignments for a school, optionally by academic year or staff.
   */
  async listTeacherAssignments(params: {
    schoolId: string;
    academicYearId?: string;
    staffRecordId?: string;
  }): Promise<TeacherAssignmentRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    let query = client
      .from("teacher_assignments")
      .select("*")
      .eq("school_id", params.schoolId)
      .order("starts_on", { ascending: false });

    if (params.academicYearId) {
      query = query.eq("academic_year_id", params.academicYearId);
    }
    if (params.staffRecordId) {
      query = query.eq("staff_record_id", params.staffRecordId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Assign teacher to a class section and optional subject.
   */
  async assignTeacher(params: {
    schoolId: string;
    staffRecordId: string;
    academicYearId: string;
    classSectionId: string;
    assignmentKind: "class_teacher" | "subject_teacher" | "assistant";
    subjectId?: string;
    startsOn?: string;
  }): Promise<{ assignmentId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("assign_teacher", {
      p_school_id: params.schoolId,
      p_staff_record_id: params.staffRecordId,
      p_academic_year_id: params.academicYearId,
      p_class_section_id: params.classSectionId,
      p_assignment_kind: params.assignmentKind,
      p_subject_id: params.subjectId || null,
      p_starts_on: params.startsOn,
    });

    if (error) throw new Error(error.message);
    return { assignmentId: data };
  },

  /**
   * Terminate/end a teacher assignment.
   */
  async endTeacherAssignment(schoolId: string, assignmentId: string, reason: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("end_teacher_assignment", {
      p_school_id: schoolId,
      p_assignment_id: assignmentId,
      p_reason: reason,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * List all staff members with person info (name, email, phone, photo).
   */
  async listStaffMembers(schoolId: string) {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("list_school_staff_members", {
      p_school_id: schoolId,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },
};
