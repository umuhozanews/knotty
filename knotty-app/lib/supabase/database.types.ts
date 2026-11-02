/**
 * Supabase Database Schema Definitions for IshuriHUB.
 * Modeled from migrations 20261031111719 through 20261031141659.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type RawTables = {
      persons: {
        Row: {
          id: string;
          auth_user_id: string | null;
          status: "active" | "inactive" | "suspended" | "deceased";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          status?: "active" | "inactive" | "suspended" | "deceased";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          status?: "active" | "inactive" | "suspended" | "deceased";
          created_at?: string;
          updated_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          code: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      schools: {
        Row: {
          id: string;
          organization_id: string | null;
          name: string;
          code: string;
          email: string;
          phone: string | null;
          address: string | null;
          branch_code: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          name: string;
          code: string;
          email: string;
          phone?: string | null;
          address?: string | null;
          branch_code?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          name?: string;
          code?: string;
          email?: string;
          phone?: string | null;
          address?: string | null;
          branch_code?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      school_memberships: {
        Row: {
          id: string;
          school_id: string;
          person_id: string;
          status: "invited" | "active" | "suspended" | "resigned" | "transferred" | "revoked";
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          person_id: string;
          status?: "invited" | "active" | "suspended" | "resigned" | "transferred" | "revoked";
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          person_id?: string;
          status?: "invited" | "active" | "suspended" | "resigned" | "transferred" | "revoked";
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      school_membership_roles: {
        Row: {
          id: string;
          school_id: string;
          membership_id: string;
          person_id: string;
          role_key: string;
          assigned_by_membership_id: string;
          assigned_by_person_id: string;
          assigned_reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          membership_id: string;
          person_id: string;
          role_key: string;
          assigned_by_membership_id: string;
          assigned_by_person_id: string;
          assigned_reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          membership_id?: string;
          person_id?: string;
          role_key?: string;
          assigned_by_membership_id?: string;
          assigned_by_person_id?: string;
          assigned_reason?: string;
          created_at?: string;
        };
      };
      school_settings: {
        Row: {
          school_id: string;
          timezone: string;
          locale: string;
          default_currency: string;
          curriculum_framework: string;
          school_day_start: string;
          week_starts_on: number;
          updated_by_membership_id: string | null;
          updated_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          school_id: string;
          timezone?: string;
          locale?: string;
          default_currency?: string;
          curriculum_framework?: string;
          school_day_start?: string;
          week_starts_on?: number;
          updated_by_membership_id?: string | null;
          updated_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_id?: string;
          timezone?: string;
          locale?: string;
          default_currency?: string;
          curriculum_framework?: string;
          school_day_start?: string;
          week_starts_on?: number;
          updated_by_membership_id?: string | null;
          updated_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      academic_years: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: "draft" | "active" | "closed";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          activated_at: string | null;
          activated_by_membership_id: string | null;
          activated_by_person_id: string | null;
          closed_at: string | null;
          closed_by_membership_id: string | null;
          closed_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status?: "draft" | "active" | "closed";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          activated_at?: string | null;
          activated_by_membership_id?: string | null;
          activated_by_person_id?: string | null;
          closed_at?: string | null;
          closed_by_membership_id?: string | null;
          closed_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          start_date?: string;
          end_date?: string;
          status?: "draft" | "active" | "closed";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          activated_at?: string | null;
          activated_by_membership_id?: string | null;
          activated_by_person_id?: string | null;
          closed_at?: string | null;
          closed_by_membership_id?: string | null;
          closed_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      academic_terms: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          name: string;
          sequence_number: number;
          term_kind: "term" | "semester" | "trimester" | "quarter";
          start_date: string;
          end_date: string;
          status: "scheduled" | "active" | "closed";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          name: string;
          sequence_number: number;
          term_kind?: "term" | "semester" | "trimester" | "quarter";
          start_date: string;
          end_date: string;
          status?: "scheduled" | "active" | "closed";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          name?: string;
          sequence_number?: number;
          term_kind?: "term" | "semester" | "trimester" | "quarter";
          start_date?: string;
          end_date?: string;
          status?: "scheduled" | "active" | "closed";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_records: {
        Row: {
          id: string;
          school_id: string;
          person_id: string;
          auth_user_id: string;
          school_membership_id: string;
          staff_number: string;
          employment_status: "active" | "on_leave" | "suspended" | "terminated";
          primary_role_category: string;
          started_on: string;
          ended_on: string | null;
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          person_id: string;
          auth_user_id: string;
          school_membership_id: string;
          staff_number: string;
          employment_status?: "active" | "on_leave" | "suspended" | "terminated";
          primary_role_category?: string;
          started_on?: string;
          ended_on?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          person_id?: string;
          auth_user_id?: string;
          school_membership_id?: string;
          staff_number?: string;
          employment_status?: "active" | "on_leave" | "suspended" | "terminated";
          primary_role_category?: string;
          started_on?: string;
          ended_on?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      teacher_details: {
        Row: {
          staff_record_id: string;
          teacher_registration_number: string | null;
          specialization: string | null;
          reb_license_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          staff_record_id: string;
          teacher_registration_number?: string | null;
          specialization?: string | null;
          reb_license_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          staff_record_id?: string;
          teacher_registration_number?: string | null;
          specialization?: string | null;
          reb_license_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      student_records: {
        Row: {
          id: string;
          school_id: string;
          person_id: string;
          auth_user_id: string;
          school_membership_id: string;
          admission_number: string;
          date_of_birth: string | null;
          gender: string | null;
          nationality: string | null;
          status: "pending" | "active" | "suspended" | "withdrawn" | "graduated" | "transferred";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          person_id: string;
          auth_user_id: string;
          school_membership_id: string;
          admission_number: string;
          date_of_birth?: string | null;
          gender?: string | null;
          nationality?: string | null;
          status?: "pending" | "active" | "suspended" | "withdrawn" | "graduated" | "transferred";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          person_id?: string;
          auth_user_id?: string;
          school_membership_id?: string;
          admission_number?: string;
          date_of_birth?: string | null;
          gender?: string | null;
          nationality?: string | null;
          status?: "pending" | "active" | "suspended" | "withdrawn" | "graduated" | "transferred";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      education_levels: {
        Row: {
          id: string;
          school_id: string;
          level_code: string;
          name: string;
          stage: "nursery" | "primary" | "lower_secondary" | "upper_secondary" | "tvet";
          display_order: number;
          curriculum_framework: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          level_code: string;
          name: string;
          stage: "nursery" | "primary" | "lower_secondary" | "upper_secondary" | "tvet";
          display_order?: number;
          curriculum_framework?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          level_code?: string;
          name?: string;
          stage?: "nursery" | "primary" | "lower_secondary" | "upper_secondary" | "tvet";
          display_order?: number;
          curriculum_framework?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      class_sections: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          education_level_id: string;
          section_code: string;
          name: string;
          stream_name: string | null;
          capacity: number | null;
          status: "active" | "inactive";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          education_level_id: string;
          section_code: string;
          name: string;
          stream_name?: string | null;
          capacity?: number | null;
          status?: "active" | "inactive";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          education_level_id?: string;
          section_code?: string;
          name?: string;
          stream_name?: string | null;
          capacity?: number | null;
          status?: "active" | "inactive";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          school_id: string;
          subject_code: string;
          name: string;
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          subject_code: string;
          name: string;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          subject_code?: string;
          name?: string;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      teacher_assignments: {
        Row: {
          id: string;
          school_id: string;
          staff_record_id: string;
          academic_year_id: string;
          class_section_id: string;
          subject_id: string | null;
          assignment_kind: "class_teacher" | "subject_teacher" | "assistant";
          starts_on: string;
          ends_on: string | null;
          status: "active" | "ended";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          staff_record_id: string;
          academic_year_id: string;
          class_section_id: string;
          subject_id?: string | null;
          assignment_kind: "class_teacher" | "subject_teacher" | "assistant";
          starts_on?: string;
          ends_on?: string | null;
          status?: "active" | "ended";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          staff_record_id?: string;
          academic_year_id?: string;
          class_section_id?: string;
          subject_id?: string | null;
          assignment_kind?: "class_teacher" | "subject_teacher" | "assistant";
          starts_on?: string;
          ends_on?: string | null;
          status?: "active" | "ended";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      student_enrollments: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          academic_year_id: string;
          status: "enrolled" | "completed" | "transferred" | "withdrawn";
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          academic_year_id: string;
          status?: "enrolled" | "completed" | "transferred" | "withdrawn";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          academic_year_id?: string;
          status?: "enrolled" | "completed" | "transferred" | "withdrawn";
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      student_class_placements: {
        Row: {
          id: string;
          school_id: string;
          academic_year_id: string;
          enrollment_id: string;
          class_section_id: string;
          effective_date: string;
          status: "active" | "transferred" | "completed";
          assigned_by_membership_id: string | null;
          assigned_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          academic_year_id: string;
          enrollment_id: string;
          class_section_id: string;
          effective_date?: string;
          status?: "active" | "transferred" | "completed";
          assigned_by_membership_id?: string | null;
          assigned_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          academic_year_id?: string;
          enrollment_id?: string;
          class_section_id?: string;
          effective_date?: string;
          status?: "active" | "transferred" | "completed";
          assigned_by_membership_id?: string | null;
          assigned_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance_records: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          attendance_date: string;
          status: "present" | "absent" | "late" | "excused" | "early_departure";
          first_arrived_at: string | null;
          departed_at: string | null;
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          source: "manual" | "nfc" | "virtual_tap";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          attendance_date?: string;
          status: "present" | "absent" | "late" | "excused" | "early_departure";
          first_arrived_at?: string | null;
          departed_at?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          source?: "manual" | "nfc" | "virtual_tap";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          attendance_date?: string;
          status?: "present" | "absent" | "late" | "excused" | "early_departure";
          first_arrived_at?: string | null;
          departed_at?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          source?: "manual" | "nfc" | "virtual_tap";
          created_at?: string;
          updated_at?: string;
        };
      };
      staff_attendance_records: {
        Row: {
          id: string;
          school_id: string;
          staff_record_id: string;
          attendance_date: string;
          status: string;
          first_arrived_at: string | null;
          departed_at: string | null;
          created_by_membership_id: string | null;
          created_by_person_id: string | null;
          source: "manual" | "nfc" | "virtual_tap";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          staff_record_id: string;
          attendance_date?: string;
          status: string;
          first_arrived_at?: string | null;
          departed_at?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          source?: "manual" | "nfc" | "virtual_tap";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          staff_record_id?: string;
          attendance_date?: string;
          status?: string;
          first_arrived_at?: string | null;
          departed_at?: string | null;
          created_by_membership_id?: string | null;
          created_by_person_id?: string | null;
          source?: "manual" | "nfc" | "virtual_tap";
          created_at?: string;
          updated_at?: string;
        };
      };
      card_assignments: {
        Row: {
          id: string;
          school_id: string;
          card_number: string;
          holder_kind: "student" | "staff";
          student_id: string | null;
          staff_record_id: string | null;
          status: "issued" | "active" | "suspended" | "lost" | "damaged" | "replaced" | "revoked";
          issued_at: string;
          activated_at: string | null;
          suspended_at: string | null;
          revoked_at: string | null;
          issued_by_membership_id: string | null;
          issued_by_person_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          card_number: string;
          holder_kind: "student" | "staff";
          student_id?: string | null;
          staff_record_id?: string | null;
          status?: "issued" | "active" | "suspended" | "lost" | "damaged" | "replaced" | "revoked";
          issued_at?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          revoked_at?: string | null;
          issued_by_membership_id?: string | null;
          issued_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          card_number?: string;
          holder_kind?: "student" | "staff";
          student_id?: string | null;
          staff_record_id?: string | null;
          status?: "issued" | "active" | "suspended" | "lost" | "damaged" | "replaced" | "revoked";
          issued_at?: string;
          activated_at?: string | null;
          suspended_at?: string | null;
          revoked_at?: string | null;
          issued_by_membership_id?: string | null;
          issued_by_person_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

export type Database = {
  public: {
    Tables: {
      [K in keyof RawTables]: RawTables[K] & { Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      provision_school: {
        Args: {
          p_organization_id: string;
          p_name: string;
          p_code: string;
          p_email: string;
          p_phone?: string | null;
          p_address?: string | null;
        };
        Returns: string;
      };
      update_school_profile: {
        Args: {
          p_school_id: string;
          p_name?: string | null;
          p_phone?: string | null;
          p_address?: string | null;
          p_branch_code?: string | null;
        };
        Returns: void;
      };
      update_school_settings: {
        Args: {
          p_school_id: string;
          p_timezone: string;
          p_locale: string;
          p_currency: string;
          p_curriculum_framework: string;
          p_school_day_start: string;
          p_week_starts_on: number;
        };
        Returns: void;
      };
      create_academic_year: {
        Args: {
          p_school_id: string;
          p_name: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: string;
      };
      activate_academic_year: {
        Args: {
          p_school_id: string;
          p_academic_year_id: string;
        };
        Returns: void;
      };
      close_academic_year: {
        Args: {
          p_school_id: string;
          p_academic_year_id: string;
        };
        Returns: void;
      };
      create_academic_term: {
        Args: {
          p_school_id: string;
          p_academic_year_id: string;
          p_name: string;
          p_sequence: number;
          p_kind: string;
          p_start_date: string;
          p_end_date: string;
        };
        Returns: string;
      };
      set_academic_term_status: {
        Args: {
          p_school_id: string;
          p_academic_term_id: string;
          p_status: string;
        };
        Returns: void;
      };
      can_register_students: {
        Args: {
          p_school_id: string;
        };
        Returns: boolean;
      };
      update_student_profile: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_legal_name?: string | null;
          p_date_of_birth?: string | null;
          p_gender?: string | null;
          p_nationality?: string | null;
        };
        Returns: void;
      };
      change_student_status: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_new_status: string;
          p_reason: string;
        };
        Returns: void;
      };
      place_student: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_academic_year_id: string;
          p_class_section_id: string;
          p_effective_date?: string;
        };
        Returns: string;
      };
      list_student_roster: {
        Args: {
          p_school_id: string;
          p_class_section_id?: string | null;
        };
        Returns: {
          student_id: string;
          admission_number: string;
          legal_name: string;
          date_of_birth: string | null;
          gender: string | null;
          nationality: string | null;
          student_status: string;
          class_section_id: string | null;
          section_code: string | null;
          class_name: string | null;
        }[];
      };
      update_staff_status: {
        Args: {
          p_school_id: string;
          p_staff_record_id: string;
          p_new_status: string;
          p_reason: string;
        };
        Returns: void;
      };
      create_education_level: {
        Args: {
          p_school_id: string;
          p_level_code: string;
          p_name: string;
          p_stage: string;
          p_display_order: number;
          p_framework?: string | null;
        };
        Returns: string;
      };
      create_class_section: {
        Args: {
          p_school_id: string;
          p_academic_year_id: string;
          p_education_level_id: string;
          p_section_code: string;
          p_name: string;
          p_stream_name?: string | null;
          p_capacity?: number | null;
        };
        Returns: string;
      };
      create_subject: {
        Args: {
          p_school_id: string;
          p_subject_code: string;
          p_name: string;
          p_category?: string;
        };
        Returns: string;
      };
      assign_subject_to_class: {
        Args: {
          p_school_id: string;
          p_academic_year_id: string;
          p_class_section_id: string;
          p_subject_id: string;
        };
        Returns: string;
      };
      assign_teacher: {
        Args: {
          p_school_id: string;
          p_staff_record_id: string;
          p_academic_year_id: string;
          p_class_section_id: string;
          p_assignment_kind: string;
          p_subject_id?: string | null;
          p_starts_on?: string;
        };
        Returns: string;
      };
      end_teacher_assignment: {
        Args: {
          p_school_id: string;
          p_assignment_id: string;
          p_reason: string;
        };
        Returns: void;
      };
      promote_student: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_from_year_id: string;
          p_to_year_id: string;
          p_target_class_id: string;
        };
        Returns: string;
      };
      record_student_attendance: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_attendance_date: string;
          p_status: string;
          p_arrived_at?: string | null;
          p_departed_at?: string | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      record_virtual_student_tap: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_idempotency_key: string;
          p_occurred_at?: string;
        };
        Returns: Json;
      };
      record_staff_attendance: {
        Args: {
          p_school_id: string;
          p_staff_record_id: string;
          p_attendance_date: string;
          p_status: string;
          p_arrived_at?: string | null;
          p_departed_at?: string | null;
          p_reason?: string | null;
        };
        Returns: string;
      };
      correct_student_attendance: {
        Args: {
          p_school_id: string;
          p_attendance_id: string;
          p_status: string;
          p_arrived_at?: string | null;
          p_departed_at?: string | null;
          p_reason: string;
        };
        Returns: void;
      };
      can_issue_card: {
        Args: {
          p_school_id: string;
        };
        Returns: boolean;
      };
      can_manage_cards: {
        Args: {
          p_school_id: string;
        };
        Returns: boolean;
      };
      activate_card: {
        Args: {
          p_school_id: string;
          p_card_assignment_id: string;
        };
        Returns: void;
      };
      change_card_status: {
        Args: {
          p_school_id: string;
          p_card_assignment_id: string;
          p_new_status: string;
          p_reason: string;
        };
        Returns: void;
      };
      list_school_cards: {
        Args: {
          p_school_id: string;
        };
        Returns: {
          card_assignment_id: string;
          holder_kind: "student" | "staff";
          student_id: string | null;
          staff_record_id: string | null;
          status: string;
          issued_at: string;
          activated_at: string | null;
        }[];
      };
      assign_scoped_role: {
        Args: {
          p_scope: string;
          p_scope_id: string;
          p_target_membership_id: string;
          p_role_key: string;
          p_reason: string;
        };
        Returns: string;
      };
      revoke_scoped_role: {
        Args: {
          p_scope: string;
          p_scope_id: string;
          p_assignment_id: string;
          p_reason: string;
        };
        Returns: void;
      };
      list_scoped_role_assignments: {
        Args: {
          p_scope: string;
          p_scope_id: string;
        };
        Returns: {
          assignment_id: string;
          membership_id: string;
          person_id: string;
          role_key: string;
          assigned_by_membership_id: string;
          assigned_by_person_id: string;
          assigned_reason: string;
          assigned_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
