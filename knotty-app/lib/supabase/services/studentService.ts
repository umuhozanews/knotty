import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";
import type { Student } from "@/lib/api";

export type StudentRecordRow = Database["public"]["Tables"]["student_records"]["Row"];
export type StudentRosterItem = Database["public"]["Functions"]["list_student_roster"]["Returns"][number];
export type StudentRosterAdminItem = Database["public"]["Functions"]["list_school_students"]["Returns"][number];

function splitLegalName(legal: string): { first_name: string; last_name: string } {
  const trimmed = legal.trim();
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { first_name: trimmed, last_name: "" };
  return { first_name: trimmed.slice(0, idx), last_name: trimmed.slice(idx + 1) };
}

function toStudentShape(row: StudentRosterAdminItem): Student {
  const { first_name, last_name } = splitLegalName(row.legal_name ?? "");
  return {
    id: row.student_id,
    student_code: row.admission_number,
    gender: row.gender ?? undefined,
    nationality: row.nationality ?? undefined,
    date_of_birth: row.date_of_birth ?? undefined,
    user: {
      first_name,
      last_name,
      email: row.primary_email ?? "",
      phone: row.primary_phone ?? null,
      profile_photo: row.profile_photo_path ?? null,
    },
    level: row.education_level_id
      ? { id: row.education_level_id, name: row.education_level_name ?? "" }
      : null,
    class: row.class_section_id
      ? { id: row.class_section_id, name: row.class_section_name ?? "" }
      : null,
    card: row.card_assignment_id
      ? {
          id: row.card_assignment_id,
          card_number: row.card_number ?? "",
          wallet_balance: 0,
          is_active: row.card_status === "active",
          is_frozen: row.card_status === "suspended",
          nfc_uid: null,
          qr_code: "",
          expires_at: "",
        }
      : null,
  };
}

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
   * Fetch full student roster with contact, class, level, and card data.
   * Requires students.read_sensitive (ADMIN, SCHOOL_MANAGER, TEACHER).
   */
  async listSchoolStudents(
    schoolId: string,
    classSectionId?: string | null,
    search?: string | null
  ): Promise<Student[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("list_school_students", {
      p_school_id: schoolId,
      p_class_section_id: classSectionId ?? null,
      p_search: search ?? null,
    });

    if (error) throw new Error(error.message);
    return (data ?? []).map(toStudentShape);
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
