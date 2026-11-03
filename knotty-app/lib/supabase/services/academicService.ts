import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type EducationLevelRow = Database["public"]["Tables"]["education_levels"]["Row"];
export type ClassSectionRow = Database["public"]["Tables"]["class_sections"]["Row"];
export type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];

export const supabaseAcademicService = {
  /**
   * List education levels for a school.
   */
  async listEducationLevels(schoolId: string): Promise<EducationLevelRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("education_levels")
      .select("*")
      .eq("school_id", schoolId)
      .order("display_order", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Create an education level.
   */
  async createEducationLevel(params: {
    schoolId: string;
    levelCode: string;
    name: string;
    stage: "nursery" | "primary" | "lower_secondary" | "upper_secondary" | "tvet";
    displayOrder: number;
    framework?: string;
  }): Promise<{ levelId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_education_level", {
      p_school_id: params.schoolId,
      p_level_code: params.levelCode,
      p_name: params.name,
      p_stage: params.stage,
      p_display_order: params.displayOrder,
      p_framework: params.framework || null,
    });

    if (error) throw new Error(error.message);
    return { levelId: data };
  },

  async listActiveAcademicYearIds(schoolId: string): Promise<string[]> {
    const client = getSafeBrowserClient();
    if (!client) return [];
    const { data } = await client
      .from("academic_years")
      .select("id")
      .eq("school_id", schoolId)
      .eq("status", "active");
    return (data || []).map((r) => r.id);
  },

  /**
   * List class sections for a school, optionally by academic year.
   */
  async listClassSections(schoolId: string, academicYearId?: string): Promise<ClassSectionRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    let query = client
      .from("class_sections")
      .select("*")
      .eq("school_id", schoolId)
      .order("section_code", { ascending: true });

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Create a class section inside an open academic year.
   */
  async createClassSection(params: {
    schoolId: string;
    academicYearId: string;
    educationLevelId: string;
    sectionCode: string;
    name: string;
    streamName?: string;
    capacity?: number;
  }): Promise<{ classSectionId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_class_section", {
      p_school_id: params.schoolId,
      p_academic_year_id: params.academicYearId,
      p_education_level_id: params.educationLevelId,
      p_section_code: params.sectionCode,
      p_name: params.name,
      p_stream_name: params.streamName || null,
      p_capacity: params.capacity || null,
    });

    if (error) throw new Error(error.message);
    return { classSectionId: data };
  },

  /**
   * List subjects in a school.
   */
  async listSubjects(schoolId: string): Promise<SubjectRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("subjects")
      .select("*")
      .eq("school_id", schoolId)
      .order("subject_code", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Create a new academic subject.
   */
  async createSubject(params: {
    schoolId: string;
    subjectCode: string;
    name: string;
    category?: string;
  }): Promise<{ subjectId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_subject", {
      p_school_id: params.schoolId,
      p_subject_code: params.subjectCode,
      p_name: params.name,
      p_category: params.category || "general",
    });

    if (error) throw new Error(error.message);
    return { subjectId: data };
  },

  /**
   * Assign a subject to a class section for an academic year.
   */
  async assignSubjectToClass(params: {
    schoolId: string;
    academicYearId: string;
    classSectionId: string;
    subjectId: string;
  }): Promise<{ classSubjectId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("assign_subject_to_class", {
      p_school_id: params.schoolId,
      p_academic_year_id: params.academicYearId,
      p_class_section_id: params.classSectionId,
      p_subject_id: params.subjectId,
    });

    if (error) throw new Error(error.message);
    return { classSubjectId: data };
  },

  /**
   * Promote a student to a new academic year and target class.
   */
  async promoteStudent(params: {
    schoolId: string;
    studentId: string;
    fromYearId: string;
    toYearId: string;
    targetClassId: string;
  }): Promise<{ placementId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("promote_student", {
      p_school_id: params.schoolId,
      p_student_id: params.studentId,
      p_from_year_id: params.fromYearId,
      p_to_year_id: params.toYearId,
      p_target_class_id: params.targetClassId,
    });

    if (error) throw new Error(error.message);
    return { placementId: data };
  },
};
