import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type SchoolRow = Database["public"]["Tables"]["schools"]["Row"];
export type SchoolSettingsRow = Database["public"]["Tables"]["school_settings"]["Row"];
export type AcademicYearRow = Database["public"]["Tables"]["academic_years"]["Row"];
export type AcademicTermRow = Database["public"]["Tables"]["academic_terms"]["Row"];

export const supabaseSchoolService = {
  /**
   * Provision a new school through the authorized RPC.
   */
  async provisionSchool(params: {
    organizationId: string;
    name: string;
    code: string;
    email: string;
    phone?: string;
    address?: string;
  }): Promise<{ schoolId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("provision_school", {
      p_organization_id: params.organizationId,
      p_name: params.name,
      p_code: params.code,
      p_email: params.email,
      p_phone: params.phone || null,
      p_address: params.address || null,
    });

    if (error) throw new Error(error.message);
    return { schoolId: data };
  },

  /**
   * Update school profile (name, phone, address, branch_code).
   */
  async updateSchoolProfile(
    schoolId: string,
    updates: {
      name?: string;
      phone?: string;
      address?: string;
      branchCode?: string;
    }
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("update_school_profile", {
      p_school_id: schoolId,
      p_name: updates.name || null,
      p_phone: updates.phone || null,
      p_address: updates.address || null,
      p_branch_code: updates.branchCode || null,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Update school settings (timezone, locale, currency, framework, hours, week start).
   */
  async updateSchoolSettings(
    schoolId: string,
    settings: {
      timezone: string;
      locale: string;
      currency: string;
      curriculumFramework: string;
      schoolDayStart: string;
      weekStartsOn: number;
    }
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("update_school_settings", {
      p_school_id: schoolId,
      p_timezone: settings.timezone,
      p_locale: settings.locale,
      p_currency: settings.currency,
      p_curriculum_framework: settings.curriculumFramework,
      p_school_day_start: settings.schoolDayStart,
      p_week_starts_on: settings.weekStartsOn,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * List schools accessible to the current user.
   */
  async listSchools(): Promise<SchoolRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("schools")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Get a single school by ID.
   */
  async getSchool(schoolId: string): Promise<SchoolRow | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get settings for a school.
   */
  async getSchoolSettings(schoolId: string): Promise<SchoolSettingsRow | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("school_settings")
      .select("*")
      .eq("school_id", schoolId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * List academic years for a school.
   */
  async listAcademicYears(schoolId: string): Promise<AcademicYearRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client
      .from("academic_years")
      .select("*")
      .eq("school_id", schoolId)
      .order("start_date", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Create an academic year.
   */
  async createAcademicYear(params: {
    schoolId: string;
    name: string;
    startDate: string;
    endDate: string;
  }): Promise<{ academicYearId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_academic_year", {
      p_school_id: params.schoolId,
      p_name: params.name,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    });

    if (error) throw new Error(error.message);
    return { academicYearId: data };
  },

  /**
   * Activate an academic year (must be in draft status).
   */
  async activateAcademicYear(schoolId: string, academicYearId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("activate_academic_year", {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Close an academic year (active terms must be closed first).
   */
  async closeAcademicYear(schoolId: string, academicYearId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("close_academic_year", {
      p_school_id: schoolId,
      p_academic_year_id: academicYearId,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * List academic terms for a school (optionally filtered by year).
   */
  async listAcademicTerms(schoolId: string, academicYearId?: string): Promise<AcademicTermRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    let query = client
      .from("academic_terms")
      .select("*")
      .eq("school_id", schoolId)
      .order("sequence_number", { ascending: true });

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Create an academic term within an open academic year.
   */
  async createAcademicTerm(params: {
    schoolId: string;
    academicYearId: string;
    name: string;
    sequence: number;
    kind: "term" | "semester" | "trimester" | "quarter";
    startDate: string;
    endDate: string;
  }): Promise<{ academicTermId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("create_academic_term", {
      p_school_id: params.schoolId,
      p_academic_year_id: params.academicYearId,
      p_name: params.name,
      p_sequence: params.sequence,
      p_kind: params.kind,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    });

    if (error) throw new Error(error.message);
    return { academicTermId: data };
  },

  /**
   * Set academic term status ('active' | 'closed').
   */
  async setAcademicTermStatus(
    schoolId: string,
    academicTermId: string,
    status: "active" | "closed"
  ): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("set_academic_term_status", {
      p_school_id: schoolId,
      p_academic_term_id: academicTermId,
      p_status: status,
    });

    if (error) throw new Error(error.message);
  },
};
