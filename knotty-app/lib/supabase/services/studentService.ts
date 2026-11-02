import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type StudentRecordRow = Database["public"]["Tables"]["student_records"]["Row"];
export type StudentRosterItem = Database["public"]["Functions"]["list_student_roster"]["Returns"][number];

export const supabaseStudentService = {
  /**
   * Check if current user has permission to register students in the school.
   */
  async canRegisterStudents(schoolId: string): Promise<boolean> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("can_register_students", {
      p_school_id: schoolId,
    });

    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  /**
   * Provision a new student via the trusted Edge Function.
   * This keeps privileged user creation server-side.
   */
  async provisionStudent(params: {
    schoolId: string;
    contactType: "email" | "phone";
    contact: string;
    admissionNumber: string;
    legalName: string;
    dateOfBirth?: string;
    gender?: string;
    nationality?: string;
    academicYearId?: string;
    classSectionId?: string;
  }): Promise<{ studentId: string; activationDelivery: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.functions.invoke("provision-student", {
      body: {
        school_id: params.schoolId,
        contact_type: params.contactType,
        contact: params.contact,
        admission_number: params.admissionNumber,
        legal_name: params.legalName,
        date_of_birth: params.dateOfBirth || null,
        gender: params.gender || null,
        nationality: params.nationality || null,
        academic_year_id: params.academicYearId || null,
        class_section_id: params.classSectionId || null,
      },
    });

    if (error) throw new Error(error.message || "Failed to provision student via Edge Function");
    if (!data?.student_id) throw new Error(data?.error || "Student provisioning failed");

    return {
      studentId: data.student_id,
      activationDelivery: data.activation_delivery ?? "sent",
    };
  },

  /**
   * Fetch school student roster through the authorized RPC.
   */
  async listStudentRoster(schoolId: string, classSectionId?: string): Promise<StudentRosterItem[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_student_roster", {
      p_school_id: schoolId,
      p_class_section_id: classSectionId || null,
    });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Update student profile fields (legal_name, date_of_birth, gender, nationality).
   */
  async updateStudentProfile(
    schoolId: string,
    studentId: string,
    updates: {
      legalName?: string;
      dateOfBirth?: string;
      gender?: string;
      nationality?: string;
    }
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("update_student_profile", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_legal_name: updates.legalName || null,
      p_date_of_birth: updates.dateOfBirth || null,
      p_gender: updates.gender || null,
      p_nationality: updates.nationality || null,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Transition student lifecycle status ('withdrawn', 'graduated', 'inactive', 'transferred').
   * Note: Backend RPC change_student_status enforces valid terminal lifecycle statuses.
   */
  async changeStudentStatus(
    schoolId: string,
    studentId: string,
    newStatus: "withdrawn" | "graduated" | "inactive" | "transferred",
    reason: string
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    if (reason.trim().length < 3) {
      throw new Error("A valid audit reason of at least 3 characters is required.");
    }

    const { error } = await client.rpc("change_student_status", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_new_status: newStatus,
      p_reason: reason.trim(),
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Place a student in a class section for an academic year.
   */
  async placeStudent(params: {
    schoolId: string;
    studentId: string;
    academicYearId: string;
    classSectionId: string;
    effectiveDate?: string;
  }): Promise<{ placementId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("place_student", {
      p_school_id: params.schoolId,
      p_student_id: params.studentId,
      p_academic_year_id: params.academicYearId,
      p_class_section_id: params.classSectionId,
      p_effective_date: params.effectiveDate,
    });

    if (error) throw new Error(error.message);
    return { placementId: data };
  },

  /**
   * Get own single student record.
   * Note: Under Supabase RLS (student_records_select_self), direct table queries are
   * permitted only for the authenticated student themselves. Staff members should query
   * student information via `listStudentRoster` to enforce teacher/staff permission boundaries.
   */
  async getStudent(schoolId: string, studentId: string): Promise<StudentRecordRow | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("student_records")
      .select("*")
      .eq("school_id", schoolId)
      .eq("id", studentId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },
};
