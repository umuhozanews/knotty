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
          status: "active" | "revoked";
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
          status?: "active" | "revoked";
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
          status?: "active" | "revoked";
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
          job_title: string;
          department: string | null;
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
          job_title?: string;
          department?: string | null;
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
          is_active: boolean;
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
          wallet_balance: number;
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
      wallet_transactions: {
        Row: {
          id: string; school_id: string; card_assignment_id: string; student_id: string;
          amount: number; type: "topup" | "purchase" | "refund" | "adjustment";
          description: string | null; reference_id: string | null;
          created_by_person_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; school_id: string; card_assignment_id: string; student_id: string;
          amount: number; type: "topup" | "purchase" | "refund" | "adjustment";
          description?: string | null; reference_id?: string | null;
          created_by_person_id?: string | null; created_at?: string;
        };
        Update: { id?: string; amount?: number; description?: string | null; };
      };
      canteen_products: {
        Row: {
          id: string; school_id: string; name: string; price: number; category: string;
          photo_url: string | null; stock_qty: number | null; is_active: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; school_id: string; name: string; price: number; category?: string;
          photo_url?: string | null; stock_qty?: number | null; is_active?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: {
          name?: string; price?: number; category?: string; photo_url?: string | null;
          stock_qty?: number | null; is_active?: boolean; updated_at?: string;
        };
      };
      canteen_transactions: {
        Row: {
          id: string; school_id: string; student_id: string;
          card_assignment_id: string | null; items: unknown; total_amount: number;
          wallet_balance_before: number | null; wallet_balance_after: number | null;
          status: "completed" | "refunded" | "failed"; created_at: string;
        };
        Insert: {
          id?: string; school_id: string; student_id: string;
          card_assignment_id?: string | null; items?: unknown; total_amount: number;
          wallet_balance_before?: number | null; wallet_balance_after?: number | null;
          status?: "completed" | "refunded" | "failed"; created_at?: string;
        };
        Update: { status?: "completed" | "refunded" | "failed"; };
      };
      fee_structures: {
        Row: {
          id: string; school_id: string; name: string; amount: number;
          applies_to: string[]; is_active: boolean; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; school_id: string; name: string; amount: number;
          applies_to?: string[]; is_active?: boolean; created_at?: string; updated_at?: string;
        };
        Update: {
          name?: string; amount?: number; applies_to?: string[];
          is_active?: boolean; updated_at?: string;
        };
      };
      fee_invoices: {
        Row: {
          id: string; school_id: string; student_id: string; fee_structure_id: string | null;
          title: string; total_amount: number; amount_paid: number; due_date: string | null;
          status: "pending" | "partial" | "paid" | "overdue" | "cancelled";
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; school_id: string; student_id: string; fee_structure_id?: string | null;
          title: string; total_amount: number; amount_paid?: number; due_date?: string | null;
          status?: "pending" | "partial" | "paid" | "overdue" | "cancelled";
          created_at?: string; updated_at?: string;
        };
        Update: {
          title?: string; total_amount?: number; amount_paid?: number;
          due_date?: string | null;
          status?: "pending" | "partial" | "paid" | "overdue" | "cancelled"; updated_at?: string;
        };
      };
      fee_payments: {
        Row: {
          id: string; school_id: string; invoice_id: string; student_id: string;
          amount: number; channel: "CASH" | "MOMO" | "BANK" | "WALLET";
          phone: string | null; notes: string | null; created_by_person_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; school_id: string; invoice_id: string; student_id: string;
          amount: number; channel?: "CASH" | "MOMO" | "BANK" | "WALLET";
          phone?: string | null; notes?: string | null; created_by_person_id?: string | null; created_at?: string;
        };
        Update: { notes?: string | null; };
      };
      notifications: {
        Row: {
          id: string; school_id: string; recipient_person_id: string; title: string;
          body: string | null; type: "info" | "warning" | "success" | "payment" | "attendance" | "discipline";
          is_read: boolean; reference_type: string | null; reference_id: string | null; created_at: string;
        };
        Insert: {
          id?: string; school_id: string; recipient_person_id: string; title: string;
          body?: string | null; type?: "info" | "warning" | "success" | "payment" | "attendance" | "discipline";
          is_read?: boolean; reference_type?: string | null; reference_id?: string | null; created_at?: string;
        };
        Update: { is_read?: boolean; };
      };
      visitor_profiles: {
        Row: {
          id: string; school_id: string; full_name: string; phone: string | null;
          id_type: string | null; id_reference: string | null; organization: string | null;
          photo_path: string | null; is_blocked: boolean; blocked_reason: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; school_id: string; full_name: string; phone?: string | null;
          id_type?: string | null; id_reference?: string | null; organization?: string | null;
          photo_path?: string | null; is_blocked?: boolean; blocked_reason?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          full_name?: string; phone?: string | null; id_type?: string | null;
          id_reference?: string | null; organization?: string | null; photo_path?: string | null;
          is_blocked?: boolean; blocked_reason?: string | null; updated_at?: string;
        };
      };
      visitor_visits: {
        Row: {
          id: string; school_id: string; visitor_profile_id: string; visit_date: string;
          pass_reference: string; host_name: string | null; host_department: string | null;
          purpose: string; notes: string | null;
          status: "pending" | "approved" | "inside" | "completed" | "cancelled" | "denied";
          arrived_at: string | null; departed_at: string | null; denial_reason: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; school_id: string; visitor_profile_id: string; visit_date?: string;
          pass_reference: string; host_name?: string | null; host_department?: string | null;
          purpose: string; notes?: string | null;
          status?: "pending" | "approved" | "inside" | "completed" | "cancelled" | "denied";
          arrived_at?: string | null; departed_at?: string | null; denial_reason?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          status?: "pending" | "approved" | "inside" | "completed" | "cancelled" | "denied";
          arrived_at?: string | null; departed_at?: string | null;
          denial_reason?: string | null; notes?: string | null; updated_at?: string;
        };
      };
    };

export type Database = {
  public: {
    Tables: {
      [K in keyof (RawTables & RawLibraryTables)]: (RawTables & RawLibraryTables)[K] & { Relationships: [] };
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
      admin_activate_student: {
        Args: {
          p_school_id: string;
          p_student_id: string;
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
      record_virtual_student_tap_v2: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_idempotency_key: string;
          p_direction?: string;
          p_occurred_at?: string;
        };
        Returns: Json;
      };
      get_class_attendance_report: {
        Args: {
          p_school_id: string;
          p_date: string;
        };
        Returns: {
          attendance_record_id: string;
          student_id: string;
          admission_number: string;
          legal_name: string;
          class_section_id: string | null;
          class_name: string | null;
          level_name: string | null;
          status: string;
          first_arrived_at: string | null;
          departed_at: string | null;
          tap_in_points: number;
          tap_out_points: number;
        }[];
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
      list_school_students: {
        Args: {
          p_school_id: string;
          p_class_section_id?: string | null;
          p_search?: string | null;
        };
        Returns: {
          student_id: string;
          admission_number: string;
          legal_name: string;
          date_of_birth: string | null;
          gender: string | null;
          nationality: string | null;
          student_status: string;
          admission_date: string | null;
          profile_photo_path: string | null;
          primary_email: string | null;
          primary_phone: string | null;
          class_section_id: string | null;
          class_section_name: string | null;
          education_level_id: string | null;
          education_level_name: string | null;
          card_assignment_id: string | null;
          card_number: string | null;
          card_status: string | null;
        }[];
      };
      list_library_books: {
        Args: {
          p_school_id: string;
          p_search?: string | null;
          p_category?: string | null;
          p_limit?: number;
        };
        Returns: {
          book_id: string;
          title: string;
          author: string;
          isbn: string | null;
          category: string | null;
          location: string | null;
          total_copies: number;
          available_copies: number;
          created_at: string;
        }[];
      };
      get_library_stats: {
        Args: { p_school_id: string };
        Returns: {
          total_books: number;
          total_copies: number;
          active_borrows: number;
          overdue_borrows: number;
          pending_fees: number;
        }[];
      };
      list_school_borrows: {
        Args: { p_school_id: string; p_status?: string; p_limit?: number };
        Returns: LibraryBorrowRow[];
      };
      lookup_library_student: {
        Args: { p_school_id: string; p_identifier: string };
        Returns: {
          student_id: string;
          legal_name: string;
          class_name: string;
          card_number: string | null;
          admission_number: string;
          profile_photo_path: string | null;
          is_card_active: boolean;
          is_card_frozen: boolean;
        }[];
      };
      student_borrow_history: {
        Args: { p_school_id: string; p_student_id: string; p_limit?: number };
        Returns: LibraryBorrowRow[];
      };
      list_overdue_borrows: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: (LibraryBorrowRow & { days_overdue: number; accrued_fine: number })[];
      };
      create_library_book: {
        Args: {
          p_school_id: string;
          p_title: string;
          p_author?: string;
          p_isbn?: string | null;
          p_category?: string | null;
          p_location?: string | null;
          p_total_copies?: number;
        };
        Returns: string;
      };
      borrow_book: {
        Args: {
          p_school_id: string;
          p_book_id: string;
          p_student_id: string;
          p_due_days?: number;
        };
        Returns: string;
      };
      return_book: {
        Args: {
          p_school_id: string;
          p_borrow_id?: string | null;
          p_copy_tag?: string | null;
        };
        Returns: { borrow_id: string; fine_amount: number; fine_charged_to_wallet: boolean }[];
      };
      renew_borrow: {
        Args: { p_school_id: string; p_borrow_id: string; p_extra_days?: number };
        Returns: string;
      };
      waive_library_fine: {
        Args: { p_school_id: string; p_borrow_id: string };
        Returns: void;
      };
      list_school_discipline: {
        Args: { p_school_id: string; p_search?: string | null; p_limit?: number };
        Returns: {
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
          student_id: string;
          student_name: string;
          student_code: string;
          recorder_name: string;
        }[];
      };
      list_student_discipline: {
        Args: { p_school_id: string; p_student_id: string; p_limit?: number };
        Returns: {
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
          recorder_name: string;
        }[];
      };
      create_discipline_record: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_type: string;
          p_title: string;
          p_description?: string | null;
          p_action_taken?: string | null;
          p_severity?: string;
          p_marks_deducted?: number;
        };
        Returns: string;
      };
      update_discipline_record: {
        Args: {
          p_school_id: string;
          p_record_id: string;
          p_marks_deducted?: number | null;
          p_action_taken?: string | null;
          p_status?: string | null;
          p_parent_notified?: boolean | null;
        };
        Returns: void;
      };
      get_discipline_stats: {
        Args: { p_school_id: string };
        Returns: { total: number; open_count: number; resolved_count: number; serious_count: number }[];
      };
      list_school_health_records: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: {
          record_id: string;
          type: string;
          title: string;
          description: string | null;
          treatment_given: string | null;
          severity: string;
          follow_up_required: boolean;
          resolved_at: string | null;
          recorded_at: string;
          student_id: string;
          student_name: string;
          student_code: string;
          recorder_name: string;
        }[];
      };
      list_student_health_records: {
        Args: { p_school_id: string; p_student_id: string };
        Returns: {
          record_id: string;
          type: string;
          title: string;
          description: string | null;
          treatment_given: string | null;
          severity: string;
          follow_up_required: boolean;
          resolved_at: string | null;
          recorded_at: string;
          recorder_name: string;
        }[];
      };
      create_health_record: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_type: string;
          p_title: string;
          p_description?: string | null;
          p_treatment_given?: string | null;
          p_severity?: string;
          p_follow_up_required?: boolean;
        };
        Returns: string;
      };
      get_medical_profile: {
        Args: { p_school_id: string; p_student_id: string };
        Returns: {
          profile_id: string;
          blood_type: string | null;
          allergies: string[];
          chronic_conditions: string[];
          emergency_contact_phone: string;
          updated_at: string;
        }[];
      };
      upsert_medical_profile: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_blood_type?: string | null;
          p_allergies?: string[];
          p_chronic_conditions?: string[];
          p_emergency_contact_phone?: string;
        };
        Returns: string;
      };
      list_student_clinic_visits: {
        Args: { p_school_id: string; p_student_id: string; p_limit?: number };
        Returns: {
          visit_id: string;
          visit_datetime: string;
          presenting_complaint: string;
          treatment_notes: string | null;
          follow_up_required: boolean;
          recorder_name: string;
          medications: {
            id: string;
            medication_name: string;
            dosage: string;
            administered_at: string;
          }[];
        }[];
      };
      create_clinic_visit: {
        Args: {
          p_school_id: string;
          p_student_id: string;
          p_presenting_complaint: string;
          p_treatment_notes?: string | null;
          p_follow_up_required?: boolean;
          p_medications?: { medication_name: string; dosage: string }[];
        };
        Returns: string;
      };
      get_health_stats: {
        Args: { p_school_id: string };
        Returns: {
          total_records: number;
          follow_up_pending: number;
          visits_today: number;
          visits_this_week: number;
        }[];
      };
      lookup_card_holder: {
        Args: { p_school_id: string; p_card_number: string };
        Returns: {
          card_assignment_id: string;
          card_number: string;
          student_id: string;
          legal_name: string;
          class_name: string;
          education_level_name: string;
          admission_number: string;
          profile_photo_path: string | null;
          wallet_balance: number;
          card_status: string;
          is_frozen: boolean;
        }[];
      };
      top_up_wallet: {
        Args: { p_school_id: string; p_card_assignment_id: string; p_amount: number; p_description?: string };
        Returns: number;
      };
      canteen_purchase: {
        Args: { p_school_id: string; p_card_assignment_id: string; p_items: unknown; p_total: number };
        Returns: { transaction_id: string; new_balance: number };
      };
      pay_fee_invoice: {
        Args: { p_school_id: string; p_invoice_id: string; p_amount: number; p_channel?: string; p_phone?: string | null };
        Returns: void;
      };
      list_school_staff_members: {
        Args: { p_school_id: string };
        Returns: {
          staff_record_id: string;
          person_id: string;
          staff_number: string;
          employment_status: string;
          primary_role_category: string;
          job_title: string;
          department: string | null;
          hired_on: string;
          legal_name: string;
          profile_photo_path: string | null;
          primary_email: string | null;
          primary_phone: string | null;
        }[];
      };
      delete_education_level: {
        Args: { p_school_id: string; p_level_id: string };
        Returns: void;
      };
      delete_class_section: {
        Args: { p_school_id: string; p_class_section_id: string };
        Returns: void;
      };
      register_staff_from_edge: {
        Args: {
          p_actor_auth_user_id: string;
          p_staff_auth_user_id: string;
          p_school_id: string;
          p_legal_name: string;
          p_email: string;
          p_role_key: string;
          p_employee_number: string;
          p_job_title: string;
          p_hired_on?: string | null;
          p_department?: string | null;
          p_qualification?: string | null;
          p_specialization?: string | null;
        };
        Returns: string;
      };
      register_staff: {
        Args: {
          p_school_id: string;
          p_employee_number: string;
          p_legal_name: string;
          p_job_title?: string | null;
          p_department?: string | null;
          p_hired_on?: string | null;
          p_categories?: string[] | null;
          p_qualification?: string | null;
          p_specialization?: string | null;
        };
        Returns: string;
      };
      get_my_wallet: {
        Args: { p_school_id: string };
        Returns: { card_number: string; card_status: string; wallet_balance: number }[];
      };
      get_my_transactions: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: { txn_id: string; amount: number; txn_type: string; description: string | null; txn_at: string }[];
      };
      get_my_attendance: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: { record_id: string; attendance_date: string; status: string; first_arrived_at: string | null; departed_at: string | null; source: string; recorded_at: string }[];
      };
      get_my_discipline: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: { record_id: string; type: string; title: string; description: string | null; action_taken: string | null; severity: string; status: string; marks_deducted: number; recorded_at: string }[];
      };
      get_my_health: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: { record_id: string; type: string; title: string; description: string | null; treatment_given: string | null; severity: string; follow_up_required: boolean; resolved_at: string | null; recorded_at: string }[];
      };
      get_my_library_borrows: {
        Args: { p_school_id: string; p_limit?: number };
        Returns: { borrow_id: string; book_title: string; book_author: string; copy_tag: string; borrowed_at: string; due_at: string; returned_at: string | null; fine_amount: number; fine_waived: boolean }[];
      };
      register_student_from_edge: {
        Args: {
          p_actor_auth_user_id: string;
          p_student_auth_user_id: string;
          p_school_id: string;
          p_admission_number: string;
          p_legal_name: string;
          p_date_of_birth?: string | null;
          p_gender?: string | null;
          p_nationality?: string | null;
          p_contact_type?: string | null;
          p_contact_value?: string | null;
          p_contact_normalized?: string | null;
          p_academic_year_id?: string | null;
          p_class_section_id?: string | null;
        };
        Returns: string;
      };
      get_my_student_profile: {
        Args: { p_school_id: string };
        Returns: {
          student_id: string;
          admission_number: string;
          legal_name: string;
          date_of_birth: string | null;
          gender: string | null;
          nationality: string | null;
          student_status: string;
          profile_photo_path: string | null;
          primary_email: string | null;
          primary_phone: string | null;
          class_section_id: string | null;
          class_section_name: string | null;
          education_level_name: string | null;
          card_assignment_id: string | null;
          card_number: string | null;
          card_status: string | null;
          wallet_balance: number;
        }[];
      };
      lookup_staff_card_holder: {
        Args: { p_school_id: string; p_card_number: string };
        Returns: {
          card_assignment_id: string;
          card_number: string;
          staff_record_id: string;
          employee_number: string;
          job_title: string;
          department: string | null;
          employment_status: string;
          legal_name: string;
          profile_photo_path: string | null;
          card_status: string;
          is_frozen: boolean;
        }[];
      };
      record_virtual_staff_tap: {
        Args: {
          p_school_id: string;
          p_staff_record_id: string;
          p_idempotency_key: string;
          p_direction?: string;
          p_occurred_at?: string;
        };
        Returns: Json;
      };
      register_visitor_visit: {
        Args: {
          p_school_id: string;
          p_full_name: string;
          p_phone?: string | null;
          p_id_type?: string | null;
          p_id_reference?: string | null;
          p_organization?: string | null;
          p_host_name?: string | null;
          p_host_department?: string | null;
          p_purpose?: string;
          p_notes?: string | null;
          p_visitor_profile_id?: string | null;
        };
        Returns: Json;
      };
      admit_visitor: {
        Args: { p_school_id: string; p_visit_id: string };
        Returns: void;
      };
      checkout_visitor: {
        Args: { p_school_id: string; p_visit_id: string };
        Returns: void;
      };
      approve_visitor: {
        Args: { p_school_id: string; p_visit_id: string };
        Returns: void;
      };
      deny_visitor: {
        Args: { p_school_id: string; p_visit_id: string; p_reason?: string | null };
        Returns: void;
      };
      get_gate_overview: {
        Args: { p_school_id: string };
        Returns: Json;
      };
      search_visitor_profiles: {
        Args: { p_school_id: string; p_query: string; p_limit?: number };
        Returns: {
          visitor_profile_id: string;
          full_name: string;
          phone: string | null;
          organization: string | null;
          id_type: string | null;
          id_reference: string | null;
          is_blocked: boolean;
          last_visit_date: string | null;
        }[];
      };
      list_visitor_visits: {
        Args: { p_school_id: string; p_date?: string; p_status?: string | null; p_limit?: number };
        Returns: {
          visit_id: string;
          visitor_profile_id: string;
          full_name: string;
          phone: string | null;
          organization: string | null;
          pass_reference: string;
          host_name: string | null;
          host_department: string | null;
          purpose: string;
          notes: string | null;
          status: string;
          arrived_at: string | null;
          departed_at: string | null;
          created_at: string;
          is_blocked: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export interface LibraryBorrowRow {
  borrow_id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
  fine_waived: boolean;
  renewed_count: number;
  student_id: string;
  student_first: string;
  student_last: string;
  student_code: string;
  copy_id: string;
  copy_tag: string;
  book_id: string;
  book_title: string;
  book_author: string;
  book_location: string | null;
  book_isbn: string | null;
}

type RawLibraryTables = {
  library_books: {
    Row: {
      id: string;
      school_id: string;
      title: string;
      author: string;
      isbn: string | null;
      category: string | null;
      location: string | null;
      description: string | null;
      total_copies: number;
      created_at: string;
    };
    Insert: {
      id?: string;
      school_id: string;
      title: string;
      author?: string;
      isbn?: string | null;
      category?: string | null;
      location?: string | null;
      description?: string | null;
      total_copies?: number;
      created_at?: string;
    };
    Update: {
      title?: string;
      author?: string;
      isbn?: string | null;
      category?: string | null;
      location?: string | null;
      description?: string | null;
      total_copies?: number;
    };
  };
  library_book_copies: {
    Row: {
      id: string;
      book_id: string;
      school_id: string;
      copy_tag: string;
      status: "available" | "borrowed" | "lost" | "damaged" | "withdrawn";
      condition: string | null;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      book_id: string;
      school_id: string;
      copy_tag: string;
      status?: "available" | "borrowed" | "lost" | "damaged" | "withdrawn";
      condition?: string | null;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      status?: "available" | "borrowed" | "lost" | "damaged" | "withdrawn";
      condition?: string | null;
      notes?: string | null;
    };
  };
  library_borrow_records: {
    Row: {
      id: string;
      school_id: string;
      student_id: string;
      copy_id: string;
      borrowed_at: string;
      due_at: string;
      returned_at: string | null;
      fine_amount: number;
      fine_waived: boolean;
      renewed_count: number;
      notes: string | null;
      created_at: string;
    };
    Insert: {
      id?: string;
      school_id: string;
      student_id: string;
      copy_id: string;
      borrowed_at?: string;
      due_at: string;
      returned_at?: string | null;
      fine_amount?: number;
      fine_waived?: boolean;
      renewed_count?: number;
      notes?: string | null;
      created_at?: string;
    };
    Update: {
      returned_at?: string | null;
      fine_amount?: number;
      fine_waived?: boolean;
      renewed_count?: number;
      notes?: string | null;
    };
  };
};

export type { RawLibraryTables };
