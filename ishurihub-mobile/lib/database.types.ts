export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_terms: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          end_date: string
          id: string
          name: string
          school_id: string
          sequence_number: number
          start_date: string
          status: string
          term_kind: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          end_date: string
          id?: string
          name: string
          school_id: string
          sequence_number: number
          start_date: string
          status?: string
          term_kind?: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          end_date?: string
          id?: string
          name?: string
          school_id?: string
          sequence_number?: number
          start_date?: string
          status?: string
          term_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "academic_terms_year_scope_fkey"
            columns: ["academic_year_id", "school_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      academic_years: {
        Row: {
          activated_at: string | null
          activated_by_membership_id: string | null
          activated_by_person_id: string | null
          closed_at: string | null
          closed_by_membership_id: string | null
          closed_by_person_id: string | null
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          end_date: string
          id: string
          name: string
          school_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by_membership_id?: string | null
          activated_by_person_id?: string | null
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closed_by_person_id?: string | null
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          end_date: string
          id?: string
          name: string
          school_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by_membership_id?: string | null
          activated_by_person_id?: string | null
          closed_at?: string | null
          closed_by_membership_id?: string | null
          closed_by_person_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          end_date?: string
          id?: string
          name?: string
          school_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_years_activated_by_school_member_fkey"
            columns: [
              "school_id",
              "activated_by_membership_id",
              "activated_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "academic_years_closed_by_school_member_fkey"
            columns: [
              "school_id",
              "closed_by_membership_id",
              "closed_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "academic_years_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "academic_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      AcademicReport: {
        Row: {
          academic_year: string
          attendance_summary: Json | null
          average: number | null
          class_id: string
          conduct_grade: string | null
          created_at: string
          grades: Json
          id: string
          is_published: boolean
          position_in_class: number | null
          principal_remarks: string | null
          published_at: string | null
          school_id: string
          student_id: string
          teacher_remarks: string | null
          term: Database["public"]["Enums"]["Term"]
          total_marks: number | null
        }
        Insert: {
          academic_year: string
          attendance_summary?: Json | null
          average?: number | null
          class_id: string
          conduct_grade?: string | null
          created_at?: string
          grades: Json
          id: string
          is_published?: boolean
          position_in_class?: number | null
          principal_remarks?: string | null
          published_at?: string | null
          school_id: string
          student_id: string
          teacher_remarks?: string | null
          term: Database["public"]["Enums"]["Term"]
          total_marks?: number | null
        }
        Update: {
          academic_year?: string
          attendance_summary?: Json | null
          average?: number | null
          class_id?: string
          conduct_grade?: string | null
          created_at?: string
          grades?: Json
          id?: string
          is_published?: boolean
          position_in_class?: number | null
          principal_remarks?: string | null
          published_at?: string | null
          school_id?: string
          student_id?: string
          teacher_remarks?: string | null
          term?: Database["public"]["Enums"]["Term"]
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "AcademicReport_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "Class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AcademicReport_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AcademicReport_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      AcademicTerm: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          school_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id: string
          name: string
          school_id: string
          start_date: string
          updated_at: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          school_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "AcademicTerm_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      AccessLog: {
        Row: {
          card_id: string | null
          created_at: string
          decision: string
          denial_reason: string | null
          device_id: string
          direction: string
          id: string
          idempotency_key: string | null
          occurred_at: string
          overridden_by_user_id: string | null
          school_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          decision: string
          denial_reason?: string | null
          device_id: string
          direction: string
          id: string
          idempotency_key?: string | null
          occurred_at?: string
          overridden_by_user_id?: string | null
          school_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          decision?: string
          denial_reason?: string | null
          device_id?: string
          direction?: string
          id?: string
          idempotency_key?: string | null
          occurred_at?: string
          overridden_by_user_id?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "AccessLog_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "KnottyCard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AccessLog_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "GateDevice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AccessLog_overridden_by_user_id_fkey"
            columns: ["overridden_by_user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AccessLog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      Achievement: {
        Row: {
          awarded_at: string
          created_at: string
          description: string | null
          id: string
          recorded_by: string
          school_id: string
          student_id: string
          title: string
          type: Database["public"]["Enums"]["AchievementType"]
        }
        Insert: {
          awarded_at?: string
          created_at?: string
          description?: string | null
          id: string
          recorded_by: string
          school_id: string
          student_id: string
          title: string
          type: Database["public"]["Enums"]["AchievementType"]
        }
        Update: {
          awarded_at?: string
          created_at?: string
          description?: string | null
          id?: string
          recorded_by?: string
          school_id?: string
          student_id?: string
          title?: string
          type?: Database["public"]["Enums"]["AchievementType"]
        }
        Relationships: [
          {
            foreignKeyName: "Achievement_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Achievement_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Achievement_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Attendance: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          class_id: string
          created_at: string
          date: string
          id: string
          note: string | null
          recorded_by: string
          school_id: string
          status: Database["public"]["Enums"]["AttendanceStatus"]
          student_id: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_id: string
          created_at?: string
          date: string
          id: string
          note?: string | null
          recorded_by: string
          school_id: string
          status: Database["public"]["Enums"]["AttendanceStatus"]
          student_id: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          recorded_by?: string
          school_id?: string
          status?: Database["public"]["Enums"]["AttendanceStatus"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "Class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Attendance_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_audit: {
        Row: {
          actor_membership_id: string
          actor_person_id: string
          attendance_record_id: string
          corrected_state: Json
          created_at: string
          id: string
          prior_state: Json
          reason: string
          school_id: string
        }
        Insert: {
          actor_membership_id: string
          actor_person_id: string
          attendance_record_id: string
          corrected_state: Json
          created_at?: string
          id?: string
          prior_state: Json
          reason: string
          school_id: string
        }
        Update: {
          actor_membership_id?: string
          actor_person_id?: string
          attendance_record_id?: string
          corrected_state?: Json
          created_at?: string
          id?: string
          prior_state?: Json
          reason?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_audit_attendance_record_id_school_id_fkey"
            columns: ["attendance_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "attendance_correction_audit_school_id_actor_membership_id__fkey"
            columns: ["school_id", "actor_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      attendance_devices: {
        Row: {
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          credential_digest: string | null
          device_code: string
          device_kind: string
          id: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          credential_digest?: string | null
          device_code: string
          device_kind: string
          id?: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          credential_digest?: string | null
          device_code?: string
          device_kind?: string
          id?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_devices_school_id_created_by_membership_id_crea_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "attendance_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          created_by_membership_id: string | null
          created_by_person_id: string | null
          departed_at: string | null
          first_arrived_at: string | null
          id: string
          school_id: string
          source: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          created_by_membership_id?: string | null
          created_by_person_id?: string | null
          departed_at?: string | null
          first_arrived_at?: string | null
          id?: string
          school_id: string
          source: string
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          created_by_membership_id?: string | null
          created_by_person_id?: string | null
          departed_at?: string | null
          first_arrived_at?: string | null
          id?: string
          school_id?: string
          source?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_school_id_created_by_membership_id_crea_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      attendance_scan_events: {
        Row: {
          actor_membership_id: string | null
          actor_person_id: string | null
          attendance_record_id: string | null
          card_assignment_id: string | null
          created_at: string
          device_id: string | null
          id: string
          idempotency_key: string
          occurred_at: string
          outcome: string
          processed_at: string
          rejection_code: string | null
          scan_direction: string
          scan_type: string
          school_id: string
          staff_attendance_record_id: string | null
          staff_record_id: string | null
          student_id: string | null
        }
        Insert: {
          actor_membership_id?: string | null
          actor_person_id?: string | null
          attendance_record_id?: string | null
          card_assignment_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          idempotency_key: string
          occurred_at: string
          outcome: string
          processed_at?: string
          rejection_code?: string | null
          scan_direction?: string
          scan_type: string
          school_id: string
          staff_attendance_record_id?: string | null
          staff_record_id?: string | null
          student_id?: string | null
        }
        Update: {
          actor_membership_id?: string | null
          actor_person_id?: string | null
          attendance_record_id?: string | null
          card_assignment_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          idempotency_key?: string
          occurred_at?: string
          outcome?: string
          processed_at?: string
          rejection_code?: string | null
          scan_direction?: string
          scan_type?: string
          school_id?: string
          staff_attendance_record_id?: string | null
          staff_record_id?: string | null
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_scan_events_attendance_record_id_school_id_fkey"
            columns: ["attendance_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "attendance_scan_events_card_scope_fkey"
            columns: ["card_assignment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "attendance_scan_events_device_id_school_id_fkey"
            columns: ["device_id", "school_id"]
            isOneToOne: false
            referencedRelation: "attendance_devices"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "attendance_scan_events_school_id_actor_membership_id_actor_fkey"
            columns: ["school_id", "actor_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "attendance_scan_events_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "attendance_scan_events_staff_attendance_record_id_school_i_fkey"
            columns: ["staff_attendance_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_attendance_records"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "attendance_scan_events_staff_record_id_school_id_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      AuditLog: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          checksum: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          prev_checksum: string | null
          school_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          checksum?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id: string
          prev_checksum?: string | null
          school_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          checksum?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          prev_checksum?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "AuditLog_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "AuditLog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      Book: {
        Row: {
          author: string
          category: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          isbn: string | null
          language: string | null
          location: string | null
          published_year: number | null
          publisher: string | null
          school_id: string
          subject: string | null
          title: string
          total_copies: number
          updated_at: string
        }
        Insert: {
          author: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id: string
          isbn?: string | null
          language?: string | null
          location?: string | null
          published_year?: number | null
          publisher?: string | null
          school_id: string
          subject?: string | null
          title: string
          total_copies?: number
          updated_at: string
        }
        Update: {
          author?: string
          category?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          language?: string | null
          location?: string | null
          published_year?: number | null
          publisher?: string | null
          school_id?: string
          subject?: string | null
          title?: string
          total_copies?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Book_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      BookCopy: {
        Row: {
          book_id: string
          condition: string | null
          copy_tag: string
          created_at: string
          id: string
          notes: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          book_id: string
          condition?: string | null
          copy_tag: string
          created_at?: string
          id: string
          notes?: string | null
          school_id: string
          status?: string
          updated_at: string
        }
        Update: {
          book_id?: string
          condition?: string | null
          copy_tag?: string
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "BookCopy_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BookCopy_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      BorrowRecord: {
        Row: {
          book_copy_id: string
          borrowed_at: string
          due_at: string
          fine_amount: number
          fine_waived: boolean
          id: string
          notes: string | null
          renewed_count: number
          returned_at: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          book_copy_id: string
          borrowed_at?: string
          due_at: string
          fine_amount?: number
          fine_waived?: boolean
          id: string
          notes?: string | null
          renewed_count?: number
          returned_at?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          book_copy_id?: string
          borrowed_at?: string
          due_at?: string
          fine_amount?: number
          fine_waived?: boolean
          id?: string
          notes?: string | null
          renewed_count?: number
          returned_at?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "BorrowRecord_book_copy_id_fkey"
            columns: ["book_copy_id"]
            isOneToOne: false
            referencedRelation: "BookCopy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BorrowRecord_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "BorrowRecord_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Campus: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          timezone_override: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id: string
          name: string
          school_id: string
          timezone_override?: string | null
          updated_at: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          timezone_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Campus_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_products: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          price: number
          school_id: string
          stock_qty: number | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          price: number
          school_id: string
          stock_qty?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          price?: number
          school_id?: string
          stock_qty?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canteen_products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      canteen_transactions: {
        Row: {
          card_assignment_id: string | null
          created_at: string
          id: string
          items: Json
          school_id: string
          status: string
          student_id: string
          total_amount: number
          wallet_balance_after: number | null
          wallet_balance_before: number | null
        }
        Insert: {
          card_assignment_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          school_id: string
          status?: string
          student_id: string
          total_amount: number
          wallet_balance_after?: number | null
          wallet_balance_before?: number | null
        }
        Update: {
          card_assignment_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          school_id?: string
          status?: string
          student_id?: string
          total_amount?: number
          wallet_balance_after?: number | null
          wallet_balance_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canteen_transactions_card_assignment_id_fkey"
            columns: ["card_assignment_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canteen_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      CanteenProduct: {
        Row: {
          category: string
          created_at: string
          emoji: string
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          price: number
          school_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          emoji?: string
          id: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          price: number
          school_id: string
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          price?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CanteenProduct_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      CanteenTransaction: {
        Row: {
          card_id: string
          created_at: string
          id: string
          items_purchased: Json
          school_id: string
          served_by: string
          student_id: string
          total_amount: number
          transaction_time: string
          wallet_balance_after: number
          wallet_balance_before: number
        }
        Insert: {
          card_id: string
          created_at?: string
          id: string
          items_purchased: Json
          school_id: string
          served_by: string
          student_id: string
          total_amount: number
          transaction_time?: string
          wallet_balance_after: number
          wallet_balance_before: number
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          items_purchased?: Json
          school_id?: string
          served_by?: string
          student_id?: string
          total_amount?: number
          transaction_time?: string
          wallet_balance_after?: number
          wallet_balance_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "CanteenTransaction_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "KnottyCard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CanteenTransaction_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CanteenTransaction_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      card_assignments: {
        Row: {
          activated_at: string | null
          card_number: string
          created_at: string
          holder_kind: string
          id: string
          issued_at: string
          issued_by_membership_id: string
          issued_by_person_id: string
          replacement_card_id: string | null
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          school_id: string
          staff_record_id: string | null
          status: string
          student_id: string | null
          suspended_at: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          activated_at?: string | null
          card_number: string
          created_at?: string
          holder_kind: string
          id?: string
          issued_at?: string
          issued_by_membership_id: string
          issued_by_person_id: string
          replacement_card_id?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id: string
          staff_record_id?: string | null
          status?: string
          student_id?: string | null
          suspended_at?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          activated_at?: string | null
          card_number?: string
          created_at?: string
          holder_kind?: string
          id?: string
          issued_at?: string
          issued_by_membership_id?: string
          issued_by_person_id?: string
          replacement_card_id?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id?: string
          staff_record_id?: string | null
          status?: string
          student_id?: string | null
          suspended_at?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_assignments_replacement_card_id_school_id_fkey"
            columns: ["replacement_card_id", "school_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "card_assignments_school_id_issued_by_membership_id_issued__fkey"
            columns: [
              "school_id",
              "issued_by_membership_id",
              "issued_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "card_assignments_school_id_revoked_by_membership_id_revoke_fkey"
            columns: [
              "school_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "card_assignments_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "card_assignments_staff_record_id_school_id_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      card_identifiers: {
        Row: {
          card_assignment_id: string
          created_at: string
          digest_key_version: number
          ended_at: string | null
          id: string
          identifier_kind: string
          keyed_digest: string
          school_id: string
          status: string
        }
        Insert: {
          card_assignment_id: string
          created_at?: string
          digest_key_version: number
          ended_at?: string | null
          id?: string
          identifier_kind: string
          keyed_digest: string
          school_id: string
          status?: string
        }
        Update: {
          card_assignment_id?: string
          created_at?: string
          digest_key_version?: number
          ended_at?: string | null
          id?: string
          identifier_kind?: string
          keyed_digest?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_identifiers_card_assignment_id_school_id_fkey"
            columns: ["card_assignment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      card_lifecycle_events: {
        Row: {
          actor_membership_id: string
          actor_person_id: string
          card_assignment_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          new_status: string
          prior_status: string | null
          reason: string | null
          school_id: string
        }
        Insert: {
          actor_membership_id: string
          actor_person_id: string
          card_assignment_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          new_status: string
          prior_status?: string | null
          reason?: string | null
          school_id: string
        }
        Update: {
          actor_membership_id?: string
          actor_person_id?: string
          card_assignment_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          new_status?: string
          prior_status?: string | null
          reason?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_lifecycle_events_card_assignment_id_school_id_fkey"
            columns: ["card_assignment_id", "school_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "card_lifecycle_events_school_id_actor_membership_id_actor__fkey"
            columns: ["school_id", "actor_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      Class: {
        Row: {
          academic_year: string
          class_teacher_id: string | null
          created_at: string
          id: string
          level_id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          class_teacher_id?: string | null
          created_at?: string
          id: string
          level_id: string
          name: string
          school_id: string
          updated_at: string
        }
        Update: {
          academic_year?: string
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level_id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Class_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "Level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Class_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sections: {
        Row: {
          academic_year_id: string
          capacity: number | null
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          education_level_id: string
          id: string
          name: string
          school_id: string
          section_code: string
          status: string
          stream_name: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          capacity?: number | null
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          education_level_id: string
          id?: string
          name: string
          school_id: string
          section_code: string
          status?: string
          stream_name?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          capacity?: number | null
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          education_level_id?: string
          id?: string
          name?: string
          school_id?: string
          section_code?: string
          status?: string
          stream_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sections_academic_year_id_school_id_fkey"
            columns: ["academic_year_id", "school_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "class_sections_education_level_id_school_id_fkey"
            columns: ["education_level_id", "school_id"]
            isOneToOne: false
            referencedRelation: "education_levels"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "class_sections_school_id_created_by_membership_id_created__fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          academic_year_id: string
          class_section_id: string
          created_at: string
          id: string
          school_id: string
          subject_id: string
        }
        Insert: {
          academic_year_id: string
          class_section_id: string
          created_at?: string
          id?: string
          school_id: string
          subject_id: string
        }
        Update: {
          academic_year_id?: string
          class_section_id?: string
          created_at?: string
          id?: string
          school_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_section_id_school_id_academic_year_id_fkey"
            columns: ["class_section_id", "school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id", "school_id", "academic_year_id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_school_id_fkey"
            columns: ["subject_id", "school_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      ClassSection: {
        Row: {
          academic_term_id: string
          campus_id: string | null
          capacity: number | null
          created_at: string
          homeroom_staff_id: string | null
          id: string
          name: string
          program_id: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_term_id: string
          campus_id?: string | null
          capacity?: number | null
          created_at?: string
          homeroom_staff_id?: string | null
          id: string
          name: string
          program_id: string
          school_id: string
          updated_at: string
        }
        Update: {
          academic_term_id?: string
          campus_id?: string | null
          capacity?: number | null
          created_at?: string
          homeroom_staff_id?: string | null
          id?: string
          name?: string
          program_id?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ClassSection_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "AcademicTerm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClassSection_homeroom_staff_id_fkey"
            columns: ["homeroom_staff_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClassSection_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "Program"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClassSection_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_visits: {
        Row: {
          created_at: string
          follow_up_required: boolean
          id: string
          presenting_complaint: string
          recorded_by: string | null
          school_id: string
          student_id: string
          treatment_notes: string | null
          visit_datetime: string
        }
        Insert: {
          created_at?: string
          follow_up_required?: boolean
          id?: string
          presenting_complaint: string
          recorded_by?: string | null
          school_id: string
          student_id: string
          treatment_notes?: string | null
          visit_datetime?: string
        }
        Update: {
          created_at?: string
          follow_up_required?: boolean
          id?: string
          presenting_complaint?: string
          recorded_by?: string | null
          school_id?: string
          student_id?: string
          treatment_notes?: string | null
          visit_datetime?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_visits_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      ClinicVisit: {
        Row: {
          created_at: string
          follow_up_required: boolean
          id: string
          presenting_complaint: string
          recorded_by_staff_id: string
          school_id: string
          student_id: string
          treatment_notes: string | null
          visit_datetime: string
        }
        Insert: {
          created_at?: string
          follow_up_required?: boolean
          id: string
          presenting_complaint: string
          recorded_by_staff_id: string
          school_id: string
          student_id: string
          treatment_notes?: string | null
          visit_datetime?: string
        }
        Update: {
          created_at?: string
          follow_up_required?: boolean
          id?: string
          presenting_complaint?: string
          recorded_by_staff_id?: string
          school_id?: string
          student_id?: string
          treatment_notes?: string | null
          visit_datetime?: string
        }
        Relationships: [
          {
            foreignKeyName: "ClinicVisit_recorded_by_staff_id_fkey"
            columns: ["recorded_by_staff_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClinicVisit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClinicVisit_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      ConsentRecord: {
        Row: {
          consent_type: string
          document_url: string | null
          granted_at: string
          guardian_id: string
          id: string
          school_id: string
          student_id: string
          version: string
        }
        Insert: {
          consent_type: string
          document_url?: string | null
          granted_at?: string
          guardian_id: string
          id: string
          school_id: string
          student_id: string
          version: string
        }
        Update: {
          consent_type?: string
          document_url?: string | null
          granted_at?: string
          guardian_id?: string
          id?: string
          school_id?: string
          student_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ConsentRecord_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConsentRecord_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ConsentRecord_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      discipline_records: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          id: string
          marks_deducted: number
          parent_notified: boolean
          recorded_at: string
          recorded_by: string | null
          school_id: string
          severity: string
          status: string
          student_id: string
          title: string
          type: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          marks_deducted?: number
          parent_notified?: boolean
          recorded_at?: string
          recorded_by?: string | null
          school_id: string
          severity?: string
          status?: string
          student_id: string
          title: string
          type: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          marks_deducted?: number
          parent_notified?: boolean
          recorded_at?: string
          recorded_by?: string | null
          school_id?: string
          severity?: string
          status?: string
          student_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_records_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      DisciplineRecord: {
        Row: {
          action_taken: string | null
          created_at: string
          description: string | null
          id: string
          marks_deducted: number
          parent_notified: boolean
          recorded_at: string
          recorded_by: string
          school_id: string
          severity: Database["public"]["Enums"]["DisciplineSeverity"]
          student_id: string
          title: string
          type: Database["public"]["Enums"]["DisciplineType"]
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id: string
          marks_deducted?: number
          parent_notified?: boolean
          recorded_at?: string
          recorded_by: string
          school_id: string
          severity?: Database["public"]["Enums"]["DisciplineSeverity"]
          student_id: string
          title: string
          type: Database["public"]["Enums"]["DisciplineType"]
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          description?: string | null
          id?: string
          marks_deducted?: number
          parent_notified?: boolean
          recorded_at?: string
          recorded_by?: string
          school_id?: string
          severity?: Database["public"]["Enums"]["DisciplineSeverity"]
          student_id?: string
          title?: string
          type?: Database["public"]["Enums"]["DisciplineType"]
        }
        Relationships: [
          {
            foreignKeyName: "DisciplineRecord_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DisciplineRecord_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "DisciplineRecord_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      education_levels: {
        Row: {
          created_at: string
          curriculum_framework: string | null
          display_order: number
          id: string
          is_active: boolean
          level_code: string
          name: string
          school_id: string
          stage: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          curriculum_framework?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          level_code: string
          name: string
          school_id: string
          stage?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          curriculum_framework?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          level_code?: string
          name?: string
          school_id?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      Enrollment: {
        Row: {
          academic_term_id: string
          class_section_id: string
          created_at: string
          id: string
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_term_id: string
          class_section_id: string
          created_at?: string
          id: string
          school_id: string
          status?: string
          student_id: string
          updated_at: string
        }
        Update: {
          academic_term_id?: string
          class_section_id?: string
          created_at?: string
          id?: string
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Enrollment_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "ClassSection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Enrollment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Enrollment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Exam: {
        Row: {
          academic_term_id: string
          category: string
          created_at: string
          exam_date: string
          id: string
          max_score: number
          name: string
          school_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          academic_term_id: string
          category?: string
          created_at?: string
          exam_date: string
          id: string
          max_score?: number
          name: string
          school_id: string
          subject_id: string
          updated_at: string
        }
        Update: {
          academic_term_id?: string
          category?: string
          created_at?: string
          exam_date?: string
          id?: string
          max_score?: number
          name?: string
          school_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Exam_academic_term_id_fkey"
            columns: ["academic_term_id"]
            isOneToOne: false
            referencedRelation: "AcademicTerm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Exam_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Exam_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "Subject"
            referencedColumns: ["id"]
          },
        ]
      }
      ExamResult: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          entered_by: string
          exam_id: string
          grade_letter: string | null
          id: string
          school_id: string
          score: number
          student_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entered_by: string
          exam_id: string
          grade_letter?: string | null
          id: string
          school_id: string
          score: number
          student_id: string
          updated_at: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          entered_by?: string
          exam_id?: string
          grade_letter?: string | null
          id?: string
          school_id?: string
          score?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ExamResult_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExamResult_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExamResult_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "Exam"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExamResult_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ExamResult_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_invoices: {
        Row: {
          amount_paid: number
          created_at: string
          due_date: string | null
          fee_structure_id: string | null
          id: string
          school_id: string
          status: string
          student_id: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          school_id: string
          status?: string
          student_id: string
          title: string
          total_amount: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          fee_structure_id?: string | null
          id?: string
          school_id?: string
          status?: string
          student_id?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_invoices_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          channel: string
          created_at: string
          created_by_person_id: string | null
          id: string
          invoice_id: string
          notes: string | null
          phone: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          amount: number
          channel?: string
          created_at?: string
          created_by_person_id?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          phone?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          created_by_person_id?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          phone?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fee_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          amount: number
          applies_to: string[]
          created_at: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          applies_to?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          applies_to?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      FeePayment: {
        Row: {
          academic_year: string
          amount: number
          created_at: string
          currency: string
          id: string
          momo_transaction_id: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["PaymentMethod"]
          payment_type: Database["public"]["Enums"]["PaymentType"]
          school_id: string
          status: Database["public"]["Enums"]["PaymentStatus"]
          student_id: string
          term: Database["public"]["Enums"]["Term"]
        }
        Insert: {
          academic_year: string
          amount: number
          created_at?: string
          currency?: string
          id: string
          momo_transaction_id?: string | null
          paid_at?: string | null
          payment_method: Database["public"]["Enums"]["PaymentMethod"]
          payment_type: Database["public"]["Enums"]["PaymentType"]
          school_id: string
          status?: Database["public"]["Enums"]["PaymentStatus"]
          student_id: string
          term: Database["public"]["Enums"]["Term"]
        }
        Update: {
          academic_year?: string
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          momo_transaction_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["PaymentMethod"]
          payment_type?: Database["public"]["Enums"]["PaymentType"]
          school_id?: string
          status?: Database["public"]["Enums"]["PaymentStatus"]
          student_id?: string
          term?: Database["public"]["Enums"]["Term"]
        }
        Relationships: [
          {
            foreignKeyName: "FeePayment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FeePayment_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      FeeStructure: {
        Row: {
          academic_term_id: string | null
          amount: number
          applies_to: Json | null
          created_at: string
          currency: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          amount: number
          applies_to?: Json | null
          created_at?: string
          currency?: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Update: {
          academic_term_id?: string | null
          amount?: number
          applies_to?: Json | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "FeeStructure_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      GateDevice: {
        Row: {
          campus_id: string
          created_at: string
          id: string
          location_type: string
          name: string
          school_id: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          campus_id: string
          created_at?: string
          id: string
          location_type: string
          name: string
          school_id: string
          updated_at: string
          zone_id?: string | null
        }
        Update: {
          campus_id?: string
          created_at?: string
          id?: string
          location_type?: string
          name?: string
          school_id?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "GateDevice_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "Campus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GateDevice_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "GateDevice_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "RestrictedZone"
            referencedColumns: ["id"]
          },
        ]
      }
      GradingScale: {
        Row: {
          bands: Json
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          bands: Json
          created_at?: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Update: {
          bands?: Json
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "GradingScale_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_link_audit: {
        Row: {
          actor_membership_id: string
          actor_person_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          relationship_id: string | null
          request_id: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          actor_membership_id: string
          actor_person_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          relationship_id?: string | null
          request_id?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          actor_membership_id?: string
          actor_person_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          relationship_id?: string | null
          request_id?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_link_audit_actor_fkey"
            columns: ["school_id", "actor_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_link_audit_relationship_fkey"
            columns: ["school_id", "relationship_id", "student_id"]
            isOneToOne: false
            referencedRelation: "guardian_relationships"
            referencedColumns: ["school_id", "id", "student_id"]
          },
          {
            foreignKeyName: "guardian_link_audit_request_fkey"
            columns: ["school_id", "request_id", "student_id"]
            isOneToOne: false
            referencedRelation: "guardian_link_requests"
            referencedColumns: ["school_id", "id", "student_id"]
          },
        ]
      }
      guardian_link_requests: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          approved_by_membership_id: string | null
          approved_by_person_id: string | null
          created_at: string
          expired_at: string | null
          expires_at: string
          guardian_auth_user_id: string | null
          guardian_person_id: string | null
          guardian_school_membership_id: string | null
          id: string
          identity_verified_at: string | null
          invited_by_membership_id: string
          invited_by_person_id: string
          invited_contact_hash: string
          rejected_at: string | null
          rejected_by_membership_id: string | null
          rejected_by_person_id: string | null
          relationship_id: string | null
          relationship_type: string
          relationship_verified_at: string | null
          relationship_verified_by_membership_id: string | null
          relationship_verified_by_person_id: string | null
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          school_id: string
          status: string
          student_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by_membership_id?: string | null
          approved_by_person_id?: string | null
          created_at?: string
          expired_at?: string | null
          expires_at: string
          guardian_auth_user_id?: string | null
          guardian_person_id?: string | null
          guardian_school_membership_id?: string | null
          id?: string
          identity_verified_at?: string | null
          invited_by_membership_id: string
          invited_by_person_id: string
          invited_contact_hash: string
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejected_by_person_id?: string | null
          relationship_id?: string | null
          relationship_type: string
          relationship_verified_at?: string | null
          relationship_verified_by_membership_id?: string | null
          relationship_verified_by_person_id?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id: string
          status?: string
          student_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by_membership_id?: string | null
          approved_by_person_id?: string | null
          created_at?: string
          expired_at?: string | null
          expires_at?: string
          guardian_auth_user_id?: string | null
          guardian_person_id?: string | null
          guardian_school_membership_id?: string | null
          id?: string
          identity_verified_at?: string | null
          invited_by_membership_id?: string
          invited_by_person_id?: string
          invited_contact_hash?: string
          rejected_at?: string | null
          rejected_by_membership_id?: string | null
          rejected_by_person_id?: string | null
          relationship_id?: string | null
          relationship_type?: string
          relationship_verified_at?: string | null
          relationship_verified_by_membership_id?: string | null
          relationship_verified_by_person_id?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id?: string
          status?: string
          student_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_link_requests_approver_fkey"
            columns: [
              "school_id",
              "approved_by_membership_id",
              "approved_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_link_requests_guardian_auth_fkey"
            columns: ["guardian_person_id", "guardian_auth_user_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "auth_user_id"]
          },
          {
            foreignKeyName: "guardian_link_requests_inviter_fkey"
            columns: [
              "school_id",
              "invited_by_membership_id",
              "invited_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_link_requests_rejector_fkey"
            columns: [
              "school_id",
              "rejected_by_membership_id",
              "rejected_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_link_requests_relationship_fkey"
            columns: [
              "school_id",
              "relationship_id",
              "student_id",
              "guardian_person_id",
              "guardian_auth_user_id",
            ]
            isOneToOne: false
            referencedRelation: "guardian_relationships"
            referencedColumns: [
              "school_id",
              "id",
              "student_id",
              "guardian_person_id",
              "guardian_auth_user_id",
            ]
          },
          {
            foreignKeyName: "guardian_link_requests_revoker_fkey"
            columns: [
              "school_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_link_requests_student_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "guardian_link_requests_verifier_fkey"
            columns: [
              "school_id",
              "relationship_verified_by_membership_id",
              "relationship_verified_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_request_guardian_school_member_fkey"
            columns: [
              "school_id",
              "guardian_school_membership_id",
              "guardian_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      guardian_relationship_permissions: {
        Row: {
          created_at: string
          expired_at: string | null
          expires_at: string | null
          granted_at: string
          granted_by_membership_id: string
          granted_by_person_id: string
          guardian_auth_user_id: string
          guardian_person_id: string
          guardian_relationship_id: string
          id: string
          permission_key: string
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          school_id: string
          scope: string
          status: string
          student_id: string
        }
        Insert: {
          created_at?: string
          expired_at?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by_membership_id: string
          granted_by_person_id: string
          guardian_auth_user_id: string
          guardian_person_id: string
          guardian_relationship_id: string
          id?: string
          permission_key: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id: string
          scope?: string
          status: string
          student_id: string
        }
        Update: {
          created_at?: string
          expired_at?: string | null
          expires_at?: string | null
          granted_at?: string
          granted_by_membership_id?: string
          granted_by_person_id?: string
          guardian_auth_user_id?: string
          guardian_person_id?: string
          guardian_relationship_id?: string
          id?: string
          permission_key?: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id?: string
          scope?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_relationship_permissions_grant_actor_fkey"
            columns: [
              "school_id",
              "granted_by_membership_id",
              "granted_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationship_permissions_relationship_fkey"
            columns: [
              "school_id",
              "guardian_relationship_id",
              "student_id",
              "guardian_person_id",
              "guardian_auth_user_id",
            ]
            isOneToOne: false
            referencedRelation: "guardian_relationships"
            referencedColumns: [
              "school_id",
              "id",
              "student_id",
              "guardian_person_id",
              "guardian_auth_user_id",
            ]
          },
          {
            foreignKeyName: "guardian_relationship_permissions_revoke_actor_fkey"
            columns: [
              "school_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      guardian_relationships: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          approved_by_membership_id: string | null
          approved_by_person_id: string | null
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          expired_at: string | null
          expired_by_membership_id: string | null
          expired_by_person_id: string | null
          guardian_auth_user_id: string | null
          guardian_person_id: string
          guardian_school_membership_id: string | null
          id: string
          identity_verified_at: string | null
          relationship_type: string
          relationship_verified_at: string | null
          relationship_verified_by_membership_id: string | null
          relationship_verified_by_person_id: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          school_id: string
          status: string
          student_id: string
          suspended_at: string | null
          suspended_by_membership_id: string | null
          suspended_by_person_id: string | null
          suspension_reason: string | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by_membership_id?: string | null
          approved_by_person_id?: string | null
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          expired_at?: string | null
          expired_by_membership_id?: string | null
          expired_by_person_id?: string | null
          guardian_auth_user_id?: string | null
          guardian_person_id: string
          guardian_school_membership_id?: string | null
          id?: string
          identity_verified_at?: string | null
          relationship_type: string
          relationship_verified_at?: string | null
          relationship_verified_by_membership_id?: string | null
          relationship_verified_by_person_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id: string
          status: string
          student_id: string
          suspended_at?: string | null
          suspended_by_membership_id?: string | null
          suspended_by_person_id?: string | null
          suspension_reason?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by_membership_id?: string | null
          approved_by_person_id?: string | null
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          expired_at?: string | null
          expired_by_membership_id?: string | null
          expired_by_person_id?: string | null
          guardian_auth_user_id?: string | null
          guardian_person_id?: string
          guardian_school_membership_id?: string | null
          id?: string
          identity_verified_at?: string | null
          relationship_type?: string
          relationship_verified_at?: string | null
          relationship_verified_by_membership_id?: string | null
          relationship_verified_by_person_id?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          school_id?: string
          status?: string
          student_id?: string
          suspended_at?: string | null
          suspended_by_membership_id?: string | null
          suspended_by_person_id?: string | null
          suspension_reason?: string | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guardian_relationship_guardian_school_member_fkey"
            columns: [
              "school_id",
              "guardian_school_membership_id",
              "guardian_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_approved_by_school_member_fkey"
            columns: [
              "school_id",
              "approved_by_membership_id",
              "approved_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_expired_by_school_member_fkey"
            columns: [
              "school_id",
              "expired_by_membership_id",
              "expired_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_person_auth_fkey"
            columns: ["guardian_person_id", "guardian_auth_user_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "auth_user_id"]
          },
          {
            foreignKeyName: "guardian_relationships_revoked_by_school_member_fkey"
            columns: [
              "school_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_student_scope_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "guardian_relationships_suspended_by_school_member_fkey"
            columns: [
              "school_id",
              "suspended_by_membership_id",
              "suspended_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "guardian_relationships_verified_by_school_member_fkey"
            columns: [
              "school_id",
              "relationship_verified_by_membership_id",
              "relationship_verified_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      health_records: {
        Row: {
          created_at: string
          description: string | null
          follow_up_required: boolean
          id: string
          recorded_at: string
          recorded_by: string | null
          resolved_at: string | null
          school_id: string
          severity: string
          student_id: string
          title: string
          treatment_given: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          follow_up_required?: boolean
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          resolved_at?: string | null
          school_id: string
          severity?: string
          student_id: string
          title: string
          treatment_given?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          follow_up_required?: boolean
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          resolved_at?: string | null
          school_id?: string
          severity?: string
          student_id?: string
          title?: string
          treatment_given?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_records_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      HealthRecord: {
        Row: {
          created_at: string
          description: string | null
          follow_up_required: boolean
          id: string
          recorded_at: string
          recorded_by: string
          school_id: string
          severity: Database["public"]["Enums"]["Severity"]
          student_id: string
          title: string
          treatment_given: string | null
          type: Database["public"]["Enums"]["HealthRecordType"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          follow_up_required?: boolean
          id: string
          recorded_at?: string
          recorded_by: string
          school_id: string
          severity?: Database["public"]["Enums"]["Severity"]
          student_id: string
          title: string
          treatment_given?: string | null
          type: Database["public"]["Enums"]["HealthRecordType"]
        }
        Update: {
          created_at?: string
          description?: string | null
          follow_up_required?: boolean
          id?: string
          recorded_at?: string
          recorded_by?: string
          school_id?: string
          severity?: Database["public"]["Enums"]["Severity"]
          student_id?: string
          title?: string
          treatment_given?: string | null
          type?: Database["public"]["Enums"]["HealthRecordType"]
        }
        Relationships: [
          {
            foreignKeyName: "HealthRecord_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "HealthRecord_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "HealthRecord_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      ImmunizationRecord: {
        Row: {
          created_at: string
          date_administered: string
          id: string
          student_id: string
          vaccine_name: string
        }
        Insert: {
          created_at?: string
          date_administered: string
          id: string
          student_id: string
          vaccine_name: string
        }
        Update: {
          created_at?: string
          date_administered?: string
          id?: string
          student_id?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ImmunizationRecord_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Invoice: {
        Row: {
          academic_term_id: string | null
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          school_id: string
          status: string
          student_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          amount_paid?: number
          created_at?: string
          due_date: string
          id: string
          school_id: string
          status?: string
          student_id: string
          total_amount: number
          updated_at: string
        }
        Update: {
          academic_term_id?: string | null
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          school_id?: string
          status?: string
          student_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Invoice_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Invoice_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      InvoiceLine: {
        Row: {
          amount: number
          created_at: string
          description: string
          fee_structure_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          fee_structure_id: string
          id: string
          invoice_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          fee_structure_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "InvoiceLine_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "FeeStructure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InvoiceLine_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      KnottyCard: {
        Row: {
          card_number: string
          created_at: string
          expires_at: string
          id: string
          is_active: boolean
          is_frozen: boolean
          issued_at: string
          nfc_uid: string | null
          qr_code: string
          school_id: string
          student_id: string
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          card_number: string
          created_at?: string
          expires_at: string
          id: string
          is_active?: boolean
          is_frozen?: boolean
          issued_at?: string
          nfc_uid?: string | null
          qr_code: string
          school_id: string
          student_id: string
          updated_at: string
          wallet_balance?: number
        }
        Update: {
          card_number?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          issued_at?: string
          nfc_uid?: string | null
          qr_code?: string
          school_id?: string
          student_id?: string
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "KnottyCard_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "KnottyCard_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Level: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          name: string
          order_index?: number
          school_id: string
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Level_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      library_book_copies: {
        Row: {
          book_id: string
          condition: string | null
          copy_tag: string
          created_at: string
          id: string
          notes: string | null
          school_id: string
          status: string
        }
        Insert: {
          book_id: string
          condition?: string | null
          copy_tag: string
          created_at?: string
          id?: string
          notes?: string | null
          school_id: string
          status?: string
        }
        Update: {
          book_id?: string
          condition?: string | null
          copy_tag?: string
          created_at?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_copies_book_id_school_id_fkey"
            columns: ["book_id", "school_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          isbn: string | null
          location: string | null
          school_id: string
          title: string
          total_copies: number
        }
        Insert: {
          author?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          location?: string | null
          school_id: string
          title: string
          total_copies?: number
        }
        Update: {
          author?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          isbn?: string | null
          location?: string | null
          school_id?: string
          title?: string
          total_copies?: number
        }
        Relationships: [
          {
            foreignKeyName: "library_books_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      library_borrow_records: {
        Row: {
          borrowed_at: string
          copy_id: string
          created_at: string
          due_at: string
          fine_amount: number
          fine_waived: boolean
          id: string
          notes: string | null
          renewed_count: number
          returned_at: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          borrowed_at?: string
          copy_id: string
          created_at?: string
          due_at: string
          fine_amount?: number
          fine_waived?: boolean
          id?: string
          notes?: string | null
          renewed_count?: number
          returned_at?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          borrowed_at?: string
          copy_id?: string
          created_at?: string
          due_at?: string
          fine_amount?: number
          fine_waived?: boolean
          id?: string
          notes?: string | null
          renewed_count?: number
          returned_at?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_borrow_records_copy_id_school_id_fkey"
            columns: ["copy_id", "school_id"]
            isOneToOne: false
            referencedRelation: "library_book_copies"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "library_borrow_records_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      Material: {
        Row: {
          class_id: string | null
          created_at: string
          description: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          level_id: string | null
          school_id: string
          subject: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          file_name: string
          file_type?: string
          file_url: string
          id: string
          level_id?: string | null
          school_id: string
          subject?: string | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          description?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          level_id?: string | null
          school_id?: string
          subject?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "Material_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "Class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Material_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "Level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Material_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Material_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_profiles: {
        Row: {
          allergies: string[]
          blood_type: string | null
          chronic_conditions: string[]
          emergency_contact_phone: string
          id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          allergies?: string[]
          blood_type?: string | null
          chronic_conditions?: string[]
          emergency_contact_phone?: string
          id?: string
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          allergies?: string[]
          blood_type?: string | null
          chronic_conditions?: string[]
          emergency_contact_phone?: string
          id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_profiles_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      MedicalProfile: {
        Row: {
          allergies: Json | null
          blood_type: string | null
          chronic_conditions: Json | null
          created_at: string
          emergency_contact_phone: string
          id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          allergies?: Json | null
          blood_type?: string | null
          chronic_conditions?: Json | null
          created_at?: string
          emergency_contact_phone: string
          id: string
          school_id: string
          student_id: string
          updated_at: string
        }
        Update: {
          allergies?: Json | null
          blood_type?: string | null
          chronic_conditions?: Json | null
          created_at?: string
          emergency_contact_phone?: string
          id?: string
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "MedicalProfile_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MedicalProfile_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_administrations: {
        Row: {
          administered_at: string
          clinic_visit_id: string | null
          dosage: string
          id: string
          medication_name: string
          school_id: string
          student_id: string
        }
        Insert: {
          administered_at?: string
          clinic_visit_id?: string | null
          dosage?: string
          id?: string
          medication_name: string
          school_id: string
          student_id: string
        }
        Update: {
          administered_at?: string
          clinic_visit_id?: string | null
          dosage?: string
          id?: string
          medication_name?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_administrations_clinic_visit_id_school_id_fkey"
            columns: ["clinic_visit_id", "school_id"]
            isOneToOne: false
            referencedRelation: "clinic_visits"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "medication_administrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_administrations_student_id_school_id_fkey"
            columns: ["student_id", "school_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      MedicationAdministration: {
        Row: {
          administered_at: string
          administered_by_staff_id: string
          clinic_visit_id: string | null
          created_at: string
          dosage: string
          id: string
          medication_name: string
          school_id: string
          student_id: string
        }
        Insert: {
          administered_at?: string
          administered_by_staff_id: string
          clinic_visit_id?: string | null
          created_at?: string
          dosage: string
          id: string
          medication_name: string
          school_id: string
          student_id: string
        }
        Update: {
          administered_at?: string
          administered_by_staff_id?: string
          clinic_visit_id?: string | null
          created_at?: string
          dosage?: string
          id?: string
          medication_name?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "MedicationAdministration_administered_by_staff_id_fkey"
            columns: ["administered_by_staff_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MedicationAdministration_clinic_visit_id_fkey"
            columns: ["clinic_visit_id"]
            isOneToOne: false
            referencedRelation: "ClinicVisit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MedicationAdministration_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "MedicationAdministration_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      Notification: {
        Row: {
          channel: Database["public"]["Enums"]["NotificationChannel"]
          created_at: string
          id: string
          is_read: boolean
          message: string
          school_id: string
          sent_at: string | null
          title: string
          type: Database["public"]["Enums"]["NotificationType"]
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["NotificationChannel"]
          created_at?: string
          id: string
          is_read?: boolean
          message: string
          school_id: string
          sent_at?: string | null
          title: string
          type: Database["public"]["Enums"]["NotificationType"]
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["NotificationChannel"]
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          school_id?: string
          sent_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["NotificationType"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Notification_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Notification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      NotificationLog: {
        Row: {
          channel: string
          created_at: string
          id: string
          provider_ref: string | null
          recipient_user_id: string
          school_id: string
          status: string
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          id: string
          provider_ref?: string | null
          recipient_user_id: string
          school_id: string
          status: string
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          provider_ref?: string | null
          recipient_user_id?: string
          school_id?: string
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "NotificationLog_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "NotificationLog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      NotificationRule: {
        Row: {
          channels: string[] | null
          conditions: Json | null
          created_at: string
          event_type: string
          id: string
          recipient_roles: string[] | null
          school_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          channels?: string[] | null
          conditions?: Json | null
          created_at?: string
          event_type: string
          id: string
          recipient_roles?: string[] | null
          school_id: string
          template_id?: string | null
          updated_at: string
        }
        Update: {
          channels?: string[] | null
          conditions?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          recipient_roles?: string[] | null
          school_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "NotificationRule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          recipient_person_id: string
          reference_id: string | null
          reference_type: string | null
          school_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_person_id: string
          reference_id?: string | null
          reference_type?: string | null
          school_id: string
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_person_id?: string
          reference_id?: string | null
          reference_type?: string | null
          school_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_person_id_fkey"
            columns: ["recipient_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      NotificationTemplate: {
        Row: {
          body: string
          channel: string
          created_at: string
          event_type: string
          id: string
          language: string
          school_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          event_type: string
          id: string
          language?: string
          school_id: string
          subject?: string | null
          updated_at: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          language?: string
          school_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "NotificationTemplate_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_membership_roles: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason: string
          id: string
          membership_id: string
          organization_id: string
          person_id: string
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          revoked_reason: string | null
          role_key: string
          scope: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason?: string
          id?: string
          membership_id: string
          organization_id: string
          person_id: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key: string
          scope?: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          assigned_reason?: string
          id?: string
          membership_id?: string
          organization_id?: string
          person_id?: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_membership_roles_assigner_fkey"
            columns: [
              "organization_id",
              "assigned_by_membership_id",
              "assigned_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "id", "person_id"]
          },
          {
            foreignKeyName: "organization_membership_roles_membership_person_fkey"
            columns: ["organization_id", "membership_id", "person_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "id", "person_id"]
          },
          {
            foreignKeyName: "organization_membership_roles_revoker_fkey"
            columns: [
              "organization_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "id", "person_id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          organization_id: string
          person_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id: string
          person_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          organization_id?: string
          person_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          legal_name: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          legal_name?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          legal_name?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      Payment: {
        Row: {
          amount: number
          channel: string
          created_at: string
          id: string
          invoice_id: string | null
          payer_user_id: string | null
          school_id: string
          status: string
          updated_at: string
          wallet_transaction_id: string | null
        }
        Insert: {
          amount: number
          channel: string
          created_at?: string
          id: string
          invoice_id?: string | null
          payer_user_id?: string | null
          school_id: string
          status?: string
          updated_at: string
          wallet_transaction_id?: string | null
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          id?: string
          invoice_id?: string | null
          payer_user_id?: string | null
          school_id?: string
          status?: string
          updated_at?: string
          wallet_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Payment_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "Invoice"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payment_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payment_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Payment_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "WalletTransaction"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          merged_into_person_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          merged_into_person_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          merged_into_person_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_membership_roles: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason: string
          id: string
          membership_id: string
          person_id: string
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          revoked_reason: string | null
          role_key: string
          scope: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason?: string
          id?: string
          membership_id: string
          person_id: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key: string
          scope?: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          assigned_reason?: string
          id?: string
          membership_id?: string
          person_id?: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_membership_roles_assigner_fkey"
            columns: ["assigned_by_membership_id", "assigned_by_person_id"]
            isOneToOne: false
            referencedRelation: "platform_memberships"
            referencedColumns: ["id", "person_id"]
          },
          {
            foreignKeyName: "platform_membership_roles_membership_person_fkey"
            columns: ["membership_id", "person_id"]
            isOneToOne: false
            referencedRelation: "platform_memberships"
            referencedColumns: ["id", "person_id"]
          },
          {
            foreignKeyName: "platform_membership_roles_revoker_fkey"
            columns: ["revoked_by_membership_id", "revoked_by_person_id"]
            isOneToOne: false
            referencedRelation: "platform_memberships"
            referencedColumns: ["id", "person_id"]
          },
        ]
      }
      platform_memberships: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          person_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          person_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          person_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      Program: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "Program_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      RefundRequest: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          reason: string
          requested_by: string
          resolved_at: string | null
          school_id: string
          status: string
          wallet_transaction_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id: string
          reason: string
          requested_by: string
          resolved_at?: string | null
          school_id: string
          status?: string
          wallet_transaction_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string
          requested_by?: string
          resolved_at?: string | null
          school_id?: string
          status?: string
          wallet_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "RefundRequest_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RefundRequest_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RefundRequest_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RefundRequest_wallet_transaction_id_fkey"
            columns: ["wallet_transaction_id"]
            isOneToOne: false
            referencedRelation: "WalletTransaction"
            referencedColumns: ["id"]
          },
        ]
      }
      Reservation: {
        Row: {
          book_id: string
          expires_at: string
          id: string
          notes: string | null
          reserved_at: string
          school_id: string
          status: string
          student_id: string
        }
        Insert: {
          book_id: string
          expires_at: string
          id: string
          notes?: string | null
          reserved_at?: string
          school_id: string
          status?: string
          student_id: string
        }
        Update: {
          book_id?: string
          expires_at?: string
          id?: string
          notes?: string | null
          reserved_at?: string
          school_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Reservation_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "Book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reservation_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Reservation_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      RestrictedZone: {
        Row: {
          campus_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          description?: string | null
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "RestrictedZone_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "Campus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RestrictedZone_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      School: {
        Row: {
          address: string | null
          code: string
          created_at: string
          email: string
          id: string
          logo: string | null
          name: string
          phone: string | null
          school_start_time: string
          subscription_plan: Database["public"]["Enums"]["SubscriptionPlan"]
          tap_out_after_minutes: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          email: string
          id: string
          logo?: string | null
          name: string
          phone?: string | null
          school_start_time?: string
          subscription_plan?: Database["public"]["Enums"]["SubscriptionPlan"]
          tap_out_after_minutes?: number
          updated_at: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          email?: string
          id?: string
          logo?: string | null
          name?: string
          phone?: string | null
          school_start_time?: string
          subscription_plan?: Database["public"]["Enums"]["SubscriptionPlan"]
          tap_out_after_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      school_calendar_events: {
        Row: {
          academic_term_id: string | null
          academic_year_id: string | null
          audience: string
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          description: string | null
          ends_at: string
          event_type: string
          id: string
          is_all_day: boolean
          school_id: string
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          academic_term_id?: string | null
          academic_year_id?: string | null
          audience?: string
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          description?: string | null
          ends_at: string
          event_type: string
          id?: string
          is_all_day?: boolean
          school_id: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          academic_term_id?: string | null
          academic_year_id?: string | null
          audience?: string
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          description?: string | null
          ends_at?: string
          event_type?: string
          id?: string
          is_all_day?: boolean
          school_id?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_calendar_events_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "school_calendar_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_calendar_events_term_scope_fkey"
            columns: ["academic_term_id", "school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["id", "school_id", "academic_year_id"]
          },
          {
            foreignKeyName: "school_calendar_events_year_scope_fkey"
            columns: ["academic_year_id", "school_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      school_membership_roles: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason: string
          id: string
          membership_id: string
          person_id: string
          revoked_at: string | null
          revoked_by_membership_id: string | null
          revoked_by_person_id: string | null
          revoked_reason: string | null
          role_key: string
          school_id: string
          scope: string
          status: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assigned_reason?: string
          id?: string
          membership_id: string
          person_id: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key: string
          school_id: string
          scope?: string
          status?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          assigned_reason?: string
          id?: string
          membership_id?: string
          person_id?: string
          revoked_at?: string | null
          revoked_by_membership_id?: string | null
          revoked_by_person_id?: string | null
          revoked_reason?: string | null
          role_key?: string
          school_id?: string
          scope?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_membership_roles_assigner_fkey"
            columns: [
              "school_id",
              "assigned_by_membership_id",
              "assigned_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "school_membership_roles_membership_person_fkey"
            columns: ["school_id", "membership_id", "person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "school_membership_roles_revoker_fkey"
            columns: [
              "school_id",
              "revoked_by_membership_id",
              "revoked_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      school_memberships: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          person_id: string
          school_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          person_id: string
          school_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          person_id?: string
          school_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_memberships_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_operation_audit: {
        Row: {
          actor_organization_id: string | null
          actor_person_id: string
          actor_scope: string
          created_at: string
          entity_id: string
          entity_type: string
          event_data: Json
          event_type: string
          id: string
          organization_membership_id: string | null
          platform_membership_id: string | null
          school_id: string
          school_membership_id: string | null
        }
        Insert: {
          actor_organization_id?: string | null
          actor_person_id: string
          actor_scope: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_data?: Json
          event_type: string
          id?: string
          organization_membership_id?: string | null
          platform_membership_id?: string | null
          school_id: string
          school_membership_id?: string | null
        }
        Update: {
          actor_organization_id?: string | null
          actor_person_id?: string
          actor_scope?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_data?: Json
          event_type?: string
          id?: string
          organization_membership_id?: string | null
          platform_membership_id?: string | null
          school_id?: string
          school_membership_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_operation_audit_actor_organization_id_organization__fkey"
            columns: [
              "actor_organization_id",
              "organization_membership_id",
              "actor_person_id",
            ]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "id", "person_id"]
          },
          {
            foreignKeyName: "school_operation_audit_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_operation_audit_platform_membership_id_actor_person_fkey"
            columns: ["platform_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "platform_memberships"
            referencedColumns: ["id", "person_id"]
          },
          {
            foreignKeyName: "school_operation_audit_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_operation_audit_school_id_school_membership_id_acto_fkey"
            columns: ["school_id", "school_membership_id", "actor_person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      school_settings: {
        Row: {
          created_at: string
          curriculum_framework: string
          default_currency: string
          locale: string
          school_day_start: string
          school_id: string
          settings: Json
          timezone: string
          updated_at: string
          updated_by_membership_id: string | null
          updated_by_person_id: string | null
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          curriculum_framework?: string
          default_currency?: string
          locale?: string
          school_day_start?: string
          school_id: string
          settings?: Json
          timezone?: string
          updated_at?: string
          updated_by_membership_id?: string | null
          updated_by_person_id?: string | null
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          curriculum_framework?: string
          default_currency?: string
          locale?: string
          school_day_start?: string
          school_id?: string
          settings?: Json
          timezone?: string
          updated_at?: string
          updated_by_membership_id?: string | null
          updated_by_person_id?: string | null
          week_starts_on?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_settings_updated_by_school_member_fkey"
            columns: [
              "school_id",
              "updated_by_membership_id",
              "updated_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          branch_code: string | null
          code: string
          created_at: string
          email: string
          id: string
          logo: string | null
          name: string
          organization_id: string | null
          phone: string | null
          school_start_time: string
          subscription_plan: string
          tap_out_after_minutes: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          branch_code?: string | null
          code: string
          created_at?: string
          email: string
          id?: string
          logo?: string | null
          name: string
          organization_id?: string | null
          phone?: string | null
          school_start_time?: string
          subscription_plan?: string
          tap_out_after_minutes?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_code?: string | null
          code?: string
          created_at?: string
          email?: string
          id?: string
          logo?: string | null
          name?: string
          organization_id?: string | null
          phone?: string | null
          school_start_time?: string
          subscription_plan?: string
          tap_out_after_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      Staff: {
        Row: {
          campus_id: string
          created_at: string
          department: string | null
          id: string
          job_title: string
          school_id: string
          staff_number: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          department?: string | null
          id: string
          job_title: string
          school_id: string
          staff_number: string
          status?: string
          updated_at: string
          user_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          department?: string | null
          id?: string
          job_title?: string
          school_id?: string
          staff_number?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Staff_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "Campus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_records: {
        Row: {
          attendance_date: string
          created_at: string
          created_by_membership_id: string | null
          created_by_person_id: string | null
          departed_at: string | null
          first_arrived_at: string | null
          id: string
          school_id: string
          source: string
          staff_record_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          created_by_membership_id?: string | null
          created_by_person_id?: string | null
          departed_at?: string | null
          first_arrived_at?: string | null
          id?: string
          school_id: string
          source: string
          staff_record_id: string
          status: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          created_by_membership_id?: string | null
          created_by_person_id?: string | null
          departed_at?: string | null
          first_arrived_at?: string | null
          id?: string
          school_id?: string
          source?: string
          staff_record_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_records_school_id_created_by_membership_i_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "staff_attendance_records_staff_record_id_school_id_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      staff_record_categories: {
        Row: {
          assigned_at: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          category_key: string
          school_id: string
          staff_record_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          category_key: string
          school_id: string
          staff_record_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          category_key?: string
          school_id?: string
          staff_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_record_categories_actor_fkey"
            columns: [
              "school_id",
              "assigned_by_membership_id",
              "assigned_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "staff_record_categories_staff_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      staff_records: {
        Row: {
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          department: string | null
          employee_number: string
          employment_status: string
          ended_on: string | null
          hint_password: string | null
          hired_on: string
          id: string
          job_title: string
          person_id: string
          profile_photo_path: string | null
          school_id: string
          school_membership_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          department?: string | null
          employee_number: string
          employment_status?: string
          ended_on?: string | null
          hint_password?: string | null
          hired_on?: string
          id?: string
          job_title: string
          person_id: string
          profile_photo_path?: string | null
          school_id: string
          school_membership_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          department?: string | null
          employee_number?: string
          employment_status?: string
          ended_on?: string | null
          hint_password?: string | null
          hired_on?: string
          id?: string
          job_title?: string
          person_id?: string
          profile_photo_path?: string | null
          school_id?: string
          school_membership_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_records_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "staff_records_membership_person_fkey"
            columns: ["school_id", "school_membership_id", "person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      staff_session_logs: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          event_type: string
          id: string
          school_id: string | null
          staff_record_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          school_id?: string | null
          staff_record_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          school_id?: string | null
          staff_record_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_session_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_session_logs_staff_record_id_fkey"
            columns: ["staff_record_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id"]
          },
        ]
      }
      Student: {
        Row: {
          campus_id: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string | null
          enrollment_date: string
          gender: string | null
          id: string
          is_active: boolean
          level_id: string | null
          nationality: string | null
          parent_id: string | null
          school_id: string
          student_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrollment_date?: string
          gender?: string | null
          id: string
          is_active?: boolean
          level_id?: string | null
          nationality?: string | null
          parent_id?: string | null
          school_id: string
          student_code: string
          updated_at: string
          user_id: string
        }
        Update: {
          campus_id?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          enrollment_date?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          level_id?: string | null
          nationality?: string | null
          parent_id?: string | null
          school_id?: string
          student_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Student_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "Campus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Student_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "Class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Student_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "Level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Student_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Student_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Student_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_placements: {
        Row: {
          academic_year_id: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          class_section_id: string
          created_at: string
          ends_on: string | null
          enrollment_id: string
          id: string
          school_id: string
          starts_on: string
          status: string
        }
        Insert: {
          academic_year_id: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          class_section_id: string
          created_at?: string
          ends_on?: string | null
          enrollment_id: string
          id?: string
          school_id: string
          starts_on?: string
          status?: string
        }
        Update: {
          academic_year_id?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          class_section_id?: string
          created_at?: string
          ends_on?: string | null
          enrollment_id?: string
          id?: string
          school_id?: string
          starts_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_class_placements_class_section_id_school_id_academ_fkey"
            columns: ["class_section_id", "school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id", "school_id", "academic_year_id"]
          },
          {
            foreignKeyName: "student_class_placements_enrollment_id_school_id_academic__fkey"
            columns: ["enrollment_id", "school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "student_enrollments"
            referencedColumns: ["id", "school_id", "academic_year_id"]
          },
          {
            foreignKeyName: "student_class_placements_school_id_assigned_by_membership__fkey"
            columns: [
              "school_id",
              "assigned_by_membership_id",
              "assigned_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      student_documents: {
        Row: {
          byte_size: number
          content_type: string
          created_at: string
          document_kind: string
          id: string
          original_filename: string
          school_id: string
          storage_object_path: string
          student_id: string
          uploaded_by_membership_id: string
          uploaded_by_person_id: string
        }
        Insert: {
          byte_size: number
          content_type: string
          created_at?: string
          document_kind: string
          id?: string
          original_filename: string
          school_id: string
          storage_object_path: string
          student_id: string
          uploaded_by_membership_id: string
          uploaded_by_person_id: string
        }
        Update: {
          byte_size?: number
          content_type?: string
          created_at?: string
          document_kind?: string
          id?: string
          original_filename?: string
          school_id?: string
          storage_object_path?: string
          student_id?: string
          uploaded_by_membership_id?: string
          uploaded_by_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_student_scope_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
          {
            foreignKeyName: "student_documents_uploader_school_member_fkey"
            columns: [
              "school_id",
              "uploaded_by_membership_id",
              "uploaded_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      student_enrollments: {
        Row: {
          academic_year_id: string
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          ended_at: string | null
          enrolled_at: string
          id: string
          school_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          ended_at?: string | null
          enrolled_at?: string
          id?: string
          school_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          ended_at?: string | null
          enrolled_at?: string
          id?: string
          school_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_academic_year_id_school_id_fkey"
            columns: ["academic_year_id", "school_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "student_enrollments_school_id_created_by_membership_id_cre_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "student_enrollments_school_id_student_id_fkey"
            columns: ["school_id", "student_id"]
            isOneToOne: false
            referencedRelation: "student_records"
            referencedColumns: ["school_id", "id"]
          },
        ]
      }
      student_records: {
        Row: {
          admission_date: string
          admission_number: string
          auth_user_id: string
          created_at: string
          created_by_membership_id: string
          created_by_person_id: string
          date_of_birth: string | null
          gender: string | null
          id: string
          nationality: string | null
          person_id: string
          profile_photo_path: string | null
          school_id: string
          school_membership_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admission_date?: string
          admission_number: string
          auth_user_id: string
          created_at?: string
          created_by_membership_id: string
          created_by_person_id: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          nationality?: string | null
          person_id: string
          profile_photo_path?: string | null
          school_id: string
          school_membership_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admission_date?: string
          admission_number?: string
          auth_user_id?: string
          created_at?: string
          created_by_membership_id?: string
          created_by_person_id?: string
          date_of_birth?: string | null
          gender?: string | null
          id?: string
          nationality?: string | null
          person_id?: string
          profile_photo_path?: string | null
          school_id?: string
          school_membership_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_records_created_by_school_member_fkey"
            columns: [
              "school_id",
              "created_by_membership_id",
              "created_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "student_records_person_auth_fkey"
            columns: ["person_id", "auth_user_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id", "auth_user_id"]
          },
          {
            foreignKeyName: "student_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_records_school_membership_person_fkey"
            columns: ["school_id", "school_membership_id", "person_id"]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
        ]
      }
      Subject: {
        Row: {
          code: string
          created_at: string
          id: string
          level_id: string
          name: string
          school_id: string
          teacher_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id: string
          level_id: string
          name: string
          school_id: string
          teacher_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          level_id?: string
          name?: string
          school_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Subject_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "Level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Subject_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          school_id: string
          subject_category: string
          subject_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          subject_category?: string
          subject_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          subject_category?: string
          subject_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      Teacher: {
        Row: {
          created_at: string
          employee_code: string
          id: string
          is_active: boolean
          join_date: string
          qualification: string | null
          school_id: string
          specialization: string | null
          subjects_taught: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          employee_code: string
          id: string
          is_active?: boolean
          join_date?: string
          qualification?: string | null
          school_id: string
          specialization?: string | null
          subjects_taught?: Json | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          employee_code?: string
          id?: string
          is_active?: boolean
          join_date?: string
          qualification?: string | null
          school_id?: string
          specialization?: string | null
          subjects_taught?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Teacher_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Teacher_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_assignments: {
        Row: {
          academic_year_id: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assignment_kind: string
          class_section_id: string
          created_at: string
          ends_on: string | null
          id: string
          school_id: string
          staff_record_id: string
          starts_on: string
          status: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          assigned_by_membership_id: string
          assigned_by_person_id: string
          assignment_kind: string
          class_section_id: string
          created_at?: string
          ends_on?: string | null
          id?: string
          school_id: string
          staff_record_id: string
          starts_on?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          assigned_by_membership_id?: string
          assigned_by_person_id?: string
          assignment_kind?: string
          class_section_id?: string
          created_at?: string
          ends_on?: string | null
          id?: string
          school_id?: string
          staff_record_id?: string
          starts_on?: string
          status?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_class_section_id_school_id_academic_ye_fkey"
            columns: ["class_section_id", "school_id", "academic_year_id"]
            isOneToOne: false
            referencedRelation: "class_sections"
            referencedColumns: ["id", "school_id", "academic_year_id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_id_assigned_by_membership_id_as_fkey"
            columns: [
              "school_id",
              "assigned_by_membership_id",
              "assigned_by_person_id",
            ]
            isOneToOne: false
            referencedRelation: "school_memberships"
            referencedColumns: ["school_id", "id", "person_id"]
          },
          {
            foreignKeyName: "teacher_assignments_school_id_class_section_id_subject_id_fkey"
            columns: ["school_id", "class_section_id", "subject_id"]
            isOneToOne: false
            referencedRelation: "class_subjects"
            referencedColumns: ["school_id", "class_section_id", "subject_id"]
          },
          {
            foreignKeyName: "teacher_assignments_staff_record_id_school_id_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "teacher_details"
            referencedColumns: ["staff_record_id", "school_id"]
          },
        ]
      }
      teacher_details: {
        Row: {
          category_key: string
          created_at: string
          hired_to_teach_on: string | null
          qualification: string | null
          school_id: string
          specialization: string | null
          staff_record_id: string
          updated_at: string
        }
        Insert: {
          category_key?: string
          created_at?: string
          hired_to_teach_on?: string | null
          qualification?: string | null
          school_id: string
          specialization?: string | null
          staff_record_id: string
          updated_at?: string
        }
        Update: {
          category_key?: string
          created_at?: string
          hired_to_teach_on?: string | null
          qualification?: string | null
          school_id?: string
          specialization?: string | null
          staff_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_details_staff_fkey"
            columns: ["staff_record_id", "school_id"]
            isOneToOne: false
            referencedRelation: "staff_records"
            referencedColumns: ["id", "school_id"]
          },
          {
            foreignKeyName: "teacher_details_teaching_category_fkey"
            columns: ["school_id", "staff_record_id", "category_key"]
            isOneToOne: false
            referencedRelation: "staff_record_categories"
            referencedColumns: ["school_id", "staff_record_id", "category_key"]
          },
        ]
      }
      TimetableEntry: {
        Row: {
          class_section_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          school_id: string
          staff_id: string
          start_time: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          class_section_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id: string
          room?: string | null
          school_id: string
          staff_id: string
          start_time: string
          subject_id: string
          updated_at: string
        }
        Update: {
          class_section_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          school_id?: string
          staff_id?: string
          start_time?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "TimetableEntry_class_section_id_fkey"
            columns: ["class_section_id"]
            isOneToOne: false
            referencedRelation: "ClassSection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TimetableEntry_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TimetableEntry_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "TimetableEntry_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "Subject"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_login: string | null
          last_name: string
          password_hash: string
          phone: string | null
          profile_photo: string | null
          role: Database["public"]["Enums"]["Role"]
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id: string
          is_active?: boolean
          last_login?: string | null
          last_name: string
          password_hash: string
          phone?: string | null
          profile_photo?: string | null
          role: Database["public"]["Enums"]["Role"]
          school_id: string
          updated_at: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_login?: string | null
          last_name?: string
          password_hash?: string
          phone?: string | null
          profile_photo?: string | null
          role?: Database["public"]["Enums"]["Role"]
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "User_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_profiles: {
        Row: {
          blocked_by_membership_id: string | null
          blocked_reason: string | null
          created_at: string
          full_name: string
          id: string
          id_reference: string | null
          id_type: string | null
          is_blocked: boolean
          organization: string | null
          phone: string | null
          photo_path: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          blocked_by_membership_id?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name: string
          id?: string
          id_reference?: string | null
          id_type?: string | null
          is_blocked?: boolean
          organization?: string | null
          phone?: string | null
          photo_path?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          blocked_by_membership_id?: string | null
          blocked_reason?: string | null
          created_at?: string
          full_name?: string
          id?: string
          id_reference?: string | null
          id_type?: string | null
          is_blocked?: boolean
          organization?: string | null
          phone?: string | null
          photo_path?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_visits: {
        Row: {
          approved_by_membership_id: string | null
          arrived_at: string | null
          checked_out_by_membership_id: string | null
          created_at: string
          denial_reason: string | null
          departed_at: string | null
          host_department: string | null
          host_name: string | null
          host_person_id: string | null
          id: string
          notes: string | null
          pass_reference: string
          purpose: string
          registered_by_membership_id: string | null
          school_id: string
          status: string
          updated_at: string
          visit_date: string
          visitor_profile_id: string
        }
        Insert: {
          approved_by_membership_id?: string | null
          arrived_at?: string | null
          checked_out_by_membership_id?: string | null
          created_at?: string
          denial_reason?: string | null
          departed_at?: string | null
          host_department?: string | null
          host_name?: string | null
          host_person_id?: string | null
          id?: string
          notes?: string | null
          pass_reference: string
          purpose: string
          registered_by_membership_id?: string | null
          school_id: string
          status?: string
          updated_at?: string
          visit_date?: string
          visitor_profile_id: string
        }
        Update: {
          approved_by_membership_id?: string | null
          arrived_at?: string | null
          checked_out_by_membership_id?: string | null
          created_at?: string
          denial_reason?: string | null
          departed_at?: string | null
          host_department?: string | null
          host_name?: string | null
          host_person_id?: string | null
          id?: string
          notes?: string | null
          pass_reference?: string
          purpose?: string
          registered_by_membership_id?: string | null
          school_id?: string
          status?: string
          updated_at?: string
          visit_date?: string
          visitor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_visits_host_person_id_fkey"
            columns: ["host_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_visits_visitor_profile_id_school_id_fkey"
            columns: ["visitor_profile_id", "school_id"]
            isOneToOne: false
            referencedRelation: "visitor_profiles"
            referencedColumns: ["id", "school_id"]
          },
        ]
      }
      VisitorLog: {
        Row: {
          badge_qr_token: string | null
          campus_id: string
          checked_in_at: string
          checked_out_at: string | null
          created_at: string
          expected_checkout_at: string | null
          host_user_id: string
          id: string
          id_document_ref: string | null
          photo_url: string | null
          purpose: string
          school_id: string
          updated_at: string
          visitor_name: string
        }
        Insert: {
          badge_qr_token?: string | null
          campus_id: string
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          expected_checkout_at?: string | null
          host_user_id: string
          id: string
          id_document_ref?: string | null
          photo_url?: string | null
          purpose: string
          school_id: string
          updated_at: string
          visitor_name: string
        }
        Update: {
          badge_qr_token?: string | null
          campus_id?: string
          checked_in_at?: string
          checked_out_at?: string | null
          created_at?: string
          expected_checkout_at?: string | null
          host_user_id?: string
          id?: string
          id_document_ref?: string | null
          photo_url?: string | null
          purpose?: string
          school_id?: string
          updated_at?: string
          visitor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "VisitorLog_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "Campus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitorLog_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "VisitorLog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          card_assignment_id: string
          created_at: string
          created_by_person_id: string | null
          description: string | null
          id: string
          reference_id: string | null
          school_id: string
          student_id: string
          type: string
        }
        Insert: {
          amount: number
          card_assignment_id: string
          created_at?: string
          created_by_person_id?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          school_id: string
          student_id: string
          type: string
        }
        Update: {
          amount?: number
          card_assignment_id?: string
          created_at?: string
          created_by_person_id?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          school_id?: string
          student_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_card_assignment_id_fkey"
            columns: ["card_assignment_id"]
            isOneToOne: false
            referencedRelation: "card_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      WalletTransaction: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          card_id: string
          created_at: string
          description: string | null
          id: string
          momo_reference: string | null
          school_id: string
          source: Database["public"]["Enums"]["WalletSource"]
          student_id: string
          type: Database["public"]["Enums"]["WalletTransactionType"]
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          card_id: string
          created_at?: string
          description?: string | null
          id: string
          momo_reference?: string | null
          school_id: string
          source: Database["public"]["Enums"]["WalletSource"]
          student_id: string
          type: Database["public"]["Enums"]["WalletTransactionType"]
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          card_id?: string
          created_at?: string
          description?: string | null
          id?: string
          momo_reference?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["WalletSource"]
          student_id?: string
          type?: Database["public"]["Enums"]["WalletTransactionType"]
        }
        Relationships: [
          {
            foreignKeyName: "WalletTransaction_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "KnottyCard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WalletTransaction_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "School"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "WalletTransaction_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "Student"
            referencedColumns: ["id"]
          },
        ]
      }
      ZoneAccessGrant: {
        Row: {
          created_at: string
          grantee_id: string
          grantee_type: string
          id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
          zone_id: string
        }
        Insert: {
          created_at?: string
          grantee_id: string
          grantee_type: string
          id: string
          updated_at: string
          valid_from: string
          valid_to?: string | null
          zone_id: string
        }
        Update: {
          created_at?: string
          grantee_id?: string
          grantee_type?: string
          id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ZoneAccessGrant_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "RestrictedZone"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_guardian_link_request: {
        Args: { p_request_id: string; p_token_hash: string }
        Returns: undefined
      }
      activate_academic_year: {
        Args: { p_academic_year_id: string; p_school_id: string }
        Returns: undefined
      }
      activate_card: {
        Args: { p_card_assignment_id: string; p_school_id: string }
        Returns: undefined
      }
      activate_student_account: { Args: never; Returns: string }
      admin_activate_student: {
        Args: { p_school_id: string; p_student_id: string }
        Returns: undefined
      }
      admit_visitor: {
        Args: { p_school_id: string; p_visit_id: string }
        Returns: undefined
      }
      approve_guardian_link_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: string
      }
      approve_visitor: {
        Args: { p_school_id: string; p_visit_id: string }
        Returns: undefined
      }
      assign_scoped_role: {
        Args: {
          p_reason: string
          p_role_key: string
          p_scope: string
          p_scope_id: string
          p_target_membership_id: string
        }
        Returns: string
      }
      assign_subject_to_class: {
        Args: {
          p_academic_year_id: string
          p_class_section_id: string
          p_school_id: string
          p_subject_id: string
        }
        Returns: string
      }
      assign_teacher: {
        Args: {
          p_academic_year_id: string
          p_assignment_kind: string
          p_class_section_id: string
          p_school_id: string
          p_staff_record_id: string
          p_starts_on?: string
          p_subject_id?: string
        }
        Returns: string
      }
      borrow_book: {
        Args: {
          p_book_id: string
          p_due_days?: number
          p_school_id: string
          p_student_id: string
        }
        Returns: string
      }
      can_issue_card: { Args: { p_school_id: string }; Returns: boolean }
      can_manage_cards: { Args: { p_school_id: string }; Returns: boolean }
      can_register_students: { Args: { p_school_id: string }; Returns: boolean }
      canteen_purchase: {
        Args: {
          p_card_assignment_id: string
          p_items: Json
          p_school_id: string
          p_total: number
        }
        Returns: Json
      }
      change_card_status: {
        Args: {
          p_card_assignment_id: string
          p_new_status: string
          p_reason: string
          p_school_id: string
        }
        Returns: undefined
      }
      change_student_status: {
        Args: {
          p_new_status: string
          p_reason: string
          p_school_id: string
          p_student_id: string
        }
        Returns: undefined
      }
      checkout_visitor: {
        Args: { p_school_id: string; p_visit_id: string }
        Returns: undefined
      }
      cleanup_stale_card_identifier: {
        Args: {
          p_identifier_kind: string
          p_keyed_digest: string
          p_school_id: string
        }
        Returns: undefined
      }
      close_academic_year: {
        Args: { p_academic_year_id: string; p_school_id: string }
        Returns: undefined
      }
      correct_student_attendance: {
        Args: {
          p_arrived_at: string
          p_attendance_id: string
          p_departed_at: string
          p_reason: string
          p_school_id: string
          p_status: string
        }
        Returns: undefined
      }
      create_academic_term: {
        Args: {
          p_academic_year_id: string
          p_end_date: string
          p_kind: string
          p_name: string
          p_school_id: string
          p_sequence: number
          p_start_date: string
        }
        Returns: string
      }
      create_academic_year: {
        Args: {
          p_end_date: string
          p_name: string
          p_school_id: string
          p_start_date: string
        }
        Returns: string
      }
      create_class_section: {
        Args: {
          p_academic_year_id: string
          p_capacity?: number
          p_education_level_id: string
          p_name: string
          p_school_id: string
          p_section_code: string
          p_stream_name?: string
        }
        Returns: string
      }
      create_clinic_visit: {
        Args: {
          p_follow_up_required?: boolean
          p_medications?: Json
          p_presenting_complaint: string
          p_school_id: string
          p_student_id: string
          p_treatment_notes?: string
        }
        Returns: string
      }
      create_discipline_record: {
        Args: {
          p_action_taken?: string
          p_description?: string
          p_marks_deducted?: number
          p_school_id: string
          p_severity?: string
          p_student_id: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      create_education_level: {
        Args: {
          p_display_order: number
          p_framework?: string
          p_level_code: string
          p_name: string
          p_school_id: string
          p_stage: string
        }
        Returns: string
      }
      create_guardian_link_request: {
        Args: {
          p_contact_hash: string
          p_expires_at: string
          p_relationship_type: string
          p_school_id: string
          p_student_id: string
          p_token_hash: string
        }
        Returns: string
      }
      create_health_record: {
        Args: {
          p_description?: string
          p_follow_up_required?: boolean
          p_school_id: string
          p_severity?: string
          p_student_id: string
          p_title: string
          p_treatment_given?: string
          p_type: string
        }
        Returns: string
      }
      create_library_book: {
        Args: {
          p_author?: string
          p_category?: string
          p_isbn?: string
          p_location?: string
          p_school_id: string
          p_title: string
          p_total_copies?: number
        }
        Returns: string
      }
      create_student_document: {
        Args: {
          p_byte_size: number
          p_content_type: string
          p_filename: string
          p_kind: string
          p_path: string
          p_school_id: string
          p_student_id: string
        }
        Returns: string
      }
      create_subject: {
        Args: {
          p_category?: string
          p_name: string
          p_school_id: string
          p_subject_code: string
        }
        Returns: string
      }
      delete_class_section: {
        Args: { p_class_section_id: string; p_school_id: string }
        Returns: undefined
      }
      delete_education_level: {
        Args: { p_level_id: string; p_school_id: string }
        Returns: undefined
      }
      deny_visitor: {
        Args: { p_reason?: string; p_school_id: string; p_visit_id: string }
        Returns: undefined
      }
      end_teacher_assignment: {
        Args: { p_assignment_id: string; p_reason: string; p_school_id: string }
        Returns: undefined
      }
      get_attendance_scan_outcome: {
        Args: { p_scan_event_id: string }
        Returns: {
          outcome: string
          rejection_code: string
          scan_event_id: string
        }[]
      }
      get_class_attendance_report: {
        Args: { p_date: string; p_school_id: string }
        Returns: {
          admission_number: string
          attendance_record_id: string
          class_name: string
          class_section_id: string
          departed_at: string
          first_arrived_at: string
          legal_name: string
          level_name: string
          status: string
          student_id: string
          tap_in_points: number
          tap_out_points: number
        }[]
      }
      get_discipline_stats: {
        Args: { p_school_id: string }
        Returns: {
          open_count: number
          resolved_count: number
          serious_count: number
          total: number
        }[]
      }
      get_gate_overview: { Args: { p_school_id: string }; Returns: Json }
      get_guardian_student_profile: {
        Args: { p_relationship_id: string }
        Returns: {
          admission_date: string
          admission_number: string
          class_section_id: string
          legal_name: string
          school_id: string
          status: string
          student_id: string
        }[]
      }
      get_health_stats: {
        Args: { p_school_id: string }
        Returns: {
          follow_up_pending: number
          total_records: number
          visits_this_week: number
          visits_today: number
        }[]
      }
      get_library_stats: {
        Args: { p_school_id: string }
        Returns: {
          active_borrows: number
          overdue_borrows: number
          pending_fees: number
          total_books: number
          total_copies: number
        }[]
      }
      get_medical_profile: {
        Args: { p_school_id: string; p_student_id: string }
        Returns: {
          allergies: string[]
          blood_type: string
          chronic_conditions: string[]
          emergency_contact_phone: string
          profile_id: string
          updated_at: string
        }[]
      }
      get_my_attendance: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          attendance_date: string
          departed_at: string
          first_arrived_at: string
          record_id: string
          recorded_at: string
          source: string
          status: string
        }[]
      }
      get_my_discipline: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          action_taken: string
          description: string
          marks_deducted: number
          record_id: string
          recorded_at: string
          severity: string
          status: string
          title: string
          type: string
        }[]
      }
      get_my_health: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          description: string
          follow_up_required: boolean
          record_id: string
          recorded_at: string
          resolved_at: string
          severity: string
          title: string
          treatment_given: string
          type: string
        }[]
      }
      get_my_library_borrows: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          book_author: string
          book_title: string
          borrow_id: string
          borrowed_at: string
          copy_tag: string
          due_at: string
          fine_amount: number
          fine_waived: boolean
          returned_at: string
        }[]
      }
      get_my_student_profile: {
        Args: { p_school_id: string }
        Returns: {
          admission_number: string
          card_assignment_id: string
          card_number: string
          card_status: string
          class_section_id: string
          class_section_name: string
          date_of_birth: string
          education_level_name: string
          gender: string
          legal_name: string
          nationality: string
          primary_email: string
          primary_phone: string
          profile_photo_path: string
          student_id: string
          student_status: string
          wallet_balance: number
        }[]
      }
      get_my_transactions: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          amount: number
          description: string
          txn_at: string
          txn_id: string
          txn_type: string
        }[]
      }
      get_my_wallet: {
        Args: { p_school_id: string }
        Returns: {
          card_number: string
          card_status: string
          wallet_balance: number
        }[]
      }
      get_school_dashboard_stats: {
        Args: { p_school_id: string }
        Returns: {
          active_borrows: number
          low_balance_cards: number
          overdue_books: number
          present_today: number
          total_library_books: number
          total_students: number
          total_teachers: number
          total_workers: number
        }[]
      }
      get_school_session_logs: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          created_at: string
          event_type: string
          id: string
          role_key: string
          staff_name: string
          staff_record_id: string
        }[]
      }
      issue_card_from_edge: {
        Args: {
          p_actor_auth_user_id: string
          p_digest_key_version: number
          p_holder_kind: string
          p_identifier_digest: string
          p_identifier_kind: string
          p_school_id: string
          p_staff_record_id: string
          p_student_id: string
        }
        Returns: string
      }
      list_library_books: {
        Args: {
          p_category?: string
          p_limit?: number
          p_school_id: string
          p_search?: string
        }
        Returns: {
          author: string
          available_copies: number
          book_id: string
          category: string
          created_at: string
          isbn: string
          location: string
          title: string
          total_copies: number
        }[]
      }
      list_overdue_borrows: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          accrued_fine: number
          book_author: string
          book_id: string
          book_isbn: string
          book_location: string
          book_title: string
          borrow_id: string
          borrowed_at: string
          copy_id: string
          copy_tag: string
          days_overdue: number
          due_at: string
          fine_amount: number
          fine_waived: boolean
          renewed_count: number
          returned_at: string
          student_code: string
          student_first: string
          student_id: string
          student_last: string
        }[]
      }
      list_school_borrows: {
        Args: { p_limit?: number; p_school_id: string; p_status?: string }
        Returns: Database["public"]["CompositeTypes"]["library_borrow_row"][]
        SetofOptions: {
          from: "*"
          to: "library_borrow_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_school_cards: {
        Args: { p_school_id: string }
        Returns: {
          activated_at: string
          card_assignment_id: string
          holder_kind: string
          issued_at: string
          staff_record_id: string
          status: string
          student_id: string
        }[]
      }
      list_school_discipline: {
        Args: { p_limit?: number; p_school_id: string; p_search?: string }
        Returns: {
          action_taken: string
          description: string
          marks_deducted: number
          parent_notified: boolean
          record_id: string
          recorded_at: string
          recorder_name: string
          severity: string
          status: string
          student_code: string
          student_id: string
          student_name: string
          title: string
          type: string
        }[]
      }
      list_school_health_records: {
        Args: { p_limit?: number; p_school_id: string }
        Returns: {
          description: string
          follow_up_required: boolean
          record_id: string
          recorded_at: string
          recorder_name: string
          resolved_at: string
          severity: string
          student_code: string
          student_id: string
          student_name: string
          title: string
          treatment_given: string
          type: string
        }[]
      }
      list_school_staff_members: {
        Args: { p_school_id: string }
        Returns: {
          department: string
          employment_status: string
          hired_on: string
          job_title: string
          legal_name: string
          person_id: string
          primary_email: string
          primary_phone: string
          primary_role_category: string
          profile_photo_path: string
          staff_number: string
          staff_record_id: string
        }[]
      }
      list_school_students: {
        Args: {
          p_class_section_id?: string
          p_school_id: string
          p_search?: string
        }
        Returns: {
          admission_date: string
          admission_number: string
          card_assignment_id: string
          card_number: string
          card_status: string
          class_section_id: string
          class_section_name: string
          date_of_birth: string
          education_level_id: string
          education_level_name: string
          gender: string
          legal_name: string
          nationality: string
          primary_email: string
          primary_phone: string
          profile_photo_path: string
          student_id: string
          student_status: string
        }[]
      }
      list_scoped_role_assignments: {
        Args: { p_scope: string; p_scope_id: string }
        Returns: {
          assigned_at: string
          assigned_by_person_id: string
          assigned_reason: string
          assignment_id: string
          membership_id: string
          person_id: string
          revoked_at: string
          revoked_by_person_id: string
          revoked_reason: string
          role_key: string
          scope: string
          scope_id: string
          status: string
        }[]
      }
      list_student_clinic_visits: {
        Args: { p_limit?: number; p_school_id: string; p_student_id: string }
        Returns: {
          follow_up_required: boolean
          medications: Json
          presenting_complaint: string
          recorder_name: string
          treatment_notes: string
          visit_datetime: string
          visit_id: string
        }[]
      }
      list_student_discipline: {
        Args: { p_limit?: number; p_school_id: string; p_student_id: string }
        Returns: {
          action_taken: string
          description: string
          marks_deducted: number
          parent_notified: boolean
          record_id: string
          recorded_at: string
          recorder_name: string
          severity: string
          status: string
          title: string
          type: string
        }[]
      }
      list_student_health_records: {
        Args: { p_school_id: string; p_student_id: string }
        Returns: {
          description: string
          follow_up_required: boolean
          record_id: string
          recorded_at: string
          recorder_name: string
          resolved_at: string
          severity: string
          title: string
          treatment_given: string
          type: string
        }[]
      }
      list_student_roster: {
        Args: { p_class_section_id?: string; p_school_id: string }
        Returns: {
          admission_date: string
          admission_number: string
          class_section_id: string
          legal_name: string
          status: string
          student_id: string
        }[]
      }
      list_visitor_visits: {
        Args: {
          p_date?: string
          p_limit?: number
          p_school_id: string
          p_status?: string
        }
        Returns: {
          arrived_at: string
          created_at: string
          departed_at: string
          full_name: string
          host_department: string
          host_name: string
          is_blocked: boolean
          notes: string
          organization: string
          pass_reference: string
          phone: string
          purpose: string
          status: string
          visit_id: string
          visitor_profile_id: string
        }[]
      }
      log_staff_session: {
        Args: {
          p_auth_user_id: string
          p_event_type: string
          p_school_id: string
        }
        Returns: undefined
      }
      lookup_card_holder: {
        Args: { p_card_number: string; p_school_id: string }
        Returns: {
          admission_number: string
          card_assignment_id: string
          card_number: string
          card_status: string
          class_name: string
          education_level_name: string
          is_frozen: boolean
          legal_name: string
          profile_photo_path: string
          student_id: string
          wallet_balance: number
        }[]
      }
      lookup_card_holder_by_digest: {
        Args: {
          p_identifier_kind?: string
          p_keyed_digest: string
          p_school_id: string
        }
        Returns: {
          admission_number: string
          card_assignment_id: string
          card_number: string
          card_status: string
          class_name: string
          education_level_name: string
          is_frozen: boolean
          legal_name: string
          profile_photo_path: string
          student_id: string
          wallet_balance: number
        }[]
      }
      lookup_library_student: {
        Args: { p_identifier: string; p_school_id: string }
        Returns: {
          admission_number: string
          card_number: string
          class_name: string
          is_card_active: boolean
          is_card_frozen: boolean
          legal_name: string
          profile_photo_path: string
          student_id: string
        }[]
      }
      lookup_staff_card_holder: {
        Args: { p_card_number: string; p_school_id: string }
        Returns: {
          card_assignment_id: string
          card_number: string
          card_status: string
          department: string
          employee_number: string
          employment_status: string
          is_frozen: boolean
          job_title: string
          legal_name: string
          profile_photo_path: string
          staff_record_id: string
        }[]
      }
      pay_fee_invoice: {
        Args: {
          p_amount: number
          p_channel?: string
          p_invoice_id: string
          p_phone?: string
          p_school_id: string
        }
        Returns: undefined
      }
      place_student: {
        Args: {
          p_academic_year_id: string
          p_class_section_id: string
          p_effective_date?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: string
      }
      process_attendance_scan: {
        Args: {
          p_device_credential_digest: string
          p_device_id: string
          p_idempotency_key: string
          p_identifier_digest: string
          p_scan_direction: string
          p_school_id: string
        }
        Returns: string
      }
      promote_student: {
        Args: {
          p_from_year_id: string
          p_school_id: string
          p_student_id: string
          p_target_class_id: string
          p_to_year_id: string
        }
        Returns: string
      }
      provision_school: {
        Args: {
          p_address?: string
          p_code: string
          p_email: string
          p_name: string
          p_organization_id: string
          p_phone?: string
        }
        Returns: string
      }
      record_staff_attendance: {
        Args: {
          p_arrived_at?: string
          p_attendance_date: string
          p_departed_at?: string
          p_reason?: string
          p_school_id: string
          p_staff_record_id: string
          p_status: string
        }
        Returns: string
      }
      record_student_attendance: {
        Args: {
          p_arrived_at?: string
          p_attendance_date: string
          p_departed_at?: string
          p_reason?: string
          p_school_id: string
          p_status: string
          p_student_id: string
        }
        Returns: string
      }
      record_virtual_staff_tap: {
        Args: {
          p_direction?: string
          p_idempotency_key: string
          p_occurred_at?: string
          p_school_id: string
          p_staff_record_id: string
        }
        Returns: Json
      }
      record_virtual_student_tap: {
        Args: {
          p_idempotency_key: string
          p_occurred_at?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: string
      }
      record_virtual_student_tap_v2: {
        Args: {
          p_direction?: string
          p_idempotency_key: string
          p_occurred_at?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: Json
      }
      register_attendance_device: {
        Args: {
          p_credential_digest: string
          p_device_code: string
          p_device_kind: string
          p_school_id: string
        }
        Returns: string
      }
      register_staff: {
        Args: {
          p_categories: string[]
          p_department: string
          p_employee_number: string
          p_hired_on: string
          p_job_title: string
          p_legal_name: string
          p_qualification?: string
          p_school_id: string
          p_specialization?: string
        }
        Returns: string
      }
      register_staff_from_edge: {
        Args: {
          p_actor_auth_user_id: string
          p_department?: string
          p_email: string
          p_employee_number: string
          p_hired_on?: string
          p_job_title: string
          p_legal_name: string
          p_qualification?: string
          p_role_key: string
          p_school_id: string
          p_specialization?: string
          p_staff_auth_user_id: string
        }
        Returns: string
      }
      register_student_from_edge: {
        Args: {
          p_academic_year_id: string
          p_actor_auth_user_id: string
          p_admission_number: string
          p_class_section_id: string
          p_contact_normalized: string
          p_contact_type: string
          p_contact_value: string
          p_date_of_birth: string
          p_gender: string
          p_legal_name: string
          p_nationality: string
          p_school_id: string
          p_student_auth_user_id: string
        }
        Returns: string
      }
      register_visitor_visit: {
        Args: {
          p_full_name: string
          p_host_department?: string
          p_host_name?: string
          p_id_reference?: string
          p_id_type?: string
          p_notes?: string
          p_organization?: string
          p_phone?: string
          p_purpose?: string
          p_school_id: string
          p_visitor_profile_id?: string
        }
        Returns: Json
      }
      renew_borrow: {
        Args: {
          p_borrow_id: string
          p_extra_days?: number
          p_school_id: string
        }
        Returns: string
      }
      replace_card_from_edge: {
        Args: {
          p_actor_auth_user_id: string
          p_digest_key_version: number
          p_identifier_digest: string
          p_identifier_kind: string
          p_old_card_id: string
          p_reason: string
          p_school_id: string
        }
        Returns: string
      }
      return_book: {
        Args: { p_borrow_id?: string; p_copy_tag?: string; p_school_id: string }
        Returns: {
          borrow_id: string
          fine_amount: number
          fine_charged_to_wallet: boolean
        }[]
      }
      revoke_guardian_relationship: {
        Args: {
          p_reason: string
          p_relationship_id: string
          p_school_id: string
        }
        Returns: undefined
      }
      revoke_scoped_role: {
        Args: {
          p_assignment_id: string
          p_reason: string
          p_scope: string
          p_scope_id: string
        }
        Returns: undefined
      }
      search_visitor_profiles: {
        Args: { p_limit?: number; p_query: string; p_school_id: string }
        Returns: {
          full_name: string
          id_reference: string
          id_type: string
          is_blocked: boolean
          last_visit_date: string
          organization: string
          phone: string
          visitor_profile_id: string
        }[]
      }
      set_academic_term_status: {
        Args: {
          p_academic_term_id: string
          p_school_id: string
          p_status: string
        }
        Returns: undefined
      }
      set_attendance_device_status: {
        Args: {
          p_device_id: string
          p_new_status: string
          p_reason: string
          p_school_id: string
        }
        Returns: undefined
      }
      set_guardian_relationship_permission: {
        Args: {
          p_expires_at?: string
          p_grant: boolean
          p_permission_key: string
          p_reason?: string
          p_relationship_id: string
          p_school_id: string
        }
        Returns: string
      }
      student_borrow_history: {
        Args: { p_limit?: number; p_school_id: string; p_student_id: string }
        Returns: Database["public"]["CompositeTypes"]["library_borrow_row"][]
        SetofOptions: {
          from: "*"
          to: "library_borrow_row"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      top_up_wallet: {
        Args: {
          p_amount: number
          p_card_assignment_id: string
          p_description?: string
          p_school_id: string
        }
        Returns: number
      }
      update_discipline_record: {
        Args: {
          p_action_taken?: string
          p_marks_deducted?: number
          p_parent_notified?: boolean
          p_record_id: string
          p_school_id: string
          p_status?: string
        }
        Returns: undefined
      }
      update_school_profile: {
        Args: {
          p_address?: string
          p_branch_code?: string
          p_name?: string
          p_phone?: string
          p_school_id: string
        }
        Returns: undefined
      }
      update_school_settings: {
        Args: {
          p_currency: string
          p_curriculum_framework: string
          p_locale: string
          p_school_day_start: string
          p_school_id: string
          p_timezone: string
          p_week_starts_on: number
        }
        Returns: undefined
      }
      update_staff_status: {
        Args: {
          p_new_status: string
          p_reason: string
          p_school_id: string
          p_staff_record_id: string
        }
        Returns: undefined
      }
      update_student_profile: {
        Args: {
          p_date_of_birth?: string
          p_gender?: string
          p_legal_name?: string
          p_nationality?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: undefined
      }
      upsert_medical_profile: {
        Args: {
          p_allergies?: string[]
          p_blood_type?: string
          p_chronic_conditions?: string[]
          p_emergency_contact_phone?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: string
      }
      waive_library_fine: {
        Args: { p_borrow_id: string; p_school_id: string }
        Returns: undefined
      }
    }
    Enums: {
      AchievementType: "ACADEMIC" | "SPORTS" | "ARTS" | "LEADERSHIP" | "OTHER"
      AttendanceStatus: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"
      DisciplineSeverity: "MINOR" | "MODERATE" | "SERIOUS"
      DisciplineType:
        | "WARNING"
        | "SUSPENSION"
        | "MISCONDUCT"
        | "RULE_VIOLATION"
        | "OTHER"
      HealthRecordType:
        | "ILLNESS"
        | "INJURY"
        | "MEDICATION"
        | "CHECKUP"
        | "ALLERGY"
      NotificationChannel: "SMS" | "IN_APP" | "EMAIL"
      NotificationType:
        | "ATTENDANCE"
        | "PAYMENT"
        | "HEALTH"
        | "DISCIPLINE"
        | "REPORT"
        | "GENERAL"
      PaymentMethod: "MOMO" | "CASH" | "BANK_TRANSFER"
      PaymentStatus: "PENDING" | "COMPLETED" | "FAILED"
      PaymentType: "TUITION" | "ACTIVITY" | "UNIFORM" | "OTHER"
      Role:
        | "ADMIN"
        | "TEACHER"
        | "STUDENT"
        | "PARENT"
        | "CANTEEN"
        | "NURSE"
        | "BURSAR"
        | "DISCIPLINE"
        | "LIBRARIAN"
      Severity: "LOW" | "MEDIUM" | "HIGH"
      SubscriptionPlan: "BASIC" | "PREMIUM"
      Term: "TERM1" | "TERM2" | "TERM3"
      WalletSource: "MOMO" | "CASH" | "ADMIN"
      WalletTransactionType: "TOP_UP" | "DEDUCTION" | "REFUND"
    }
    CompositeTypes: {
      library_borrow_row: {
        borrow_id: string | null
        borrowed_at: string | null
        due_at: string | null
        returned_at: string | null
        fine_amount: number | null
        fine_waived: boolean | null
        renewed_count: number | null
        student_id: string | null
        student_first: string | null
        student_last: string | null
        student_code: string | null
        copy_id: string | null
        copy_tag: string | null
        book_id: string | null
        book_title: string | null
        book_author: string | null
        book_location: string | null
        book_isbn: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      AchievementType: ["ACADEMIC", "SPORTS", "ARTS", "LEADERSHIP", "OTHER"],
      AttendanceStatus: ["PRESENT", "ABSENT", "LATE", "EXCUSED"],
      DisciplineSeverity: ["MINOR", "MODERATE", "SERIOUS"],
      DisciplineType: [
        "WARNING",
        "SUSPENSION",
        "MISCONDUCT",
        "RULE_VIOLATION",
        "OTHER",
      ],
      HealthRecordType: [
        "ILLNESS",
        "INJURY",
        "MEDICATION",
        "CHECKUP",
        "ALLERGY",
      ],
      NotificationChannel: ["SMS", "IN_APP", "EMAIL"],
      NotificationType: [
        "ATTENDANCE",
        "PAYMENT",
        "HEALTH",
        "DISCIPLINE",
        "REPORT",
        "GENERAL",
      ],
      PaymentMethod: ["MOMO", "CASH", "BANK_TRANSFER"],
      PaymentStatus: ["PENDING", "COMPLETED", "FAILED"],
      PaymentType: ["TUITION", "ACTIVITY", "UNIFORM", "OTHER"],
      Role: [
        "ADMIN",
        "TEACHER",
        "STUDENT",
        "PARENT",
        "CANTEEN",
        "NURSE",
        "BURSAR",
        "DISCIPLINE",
        "LIBRARIAN",
      ],
      Severity: ["LOW", "MEDIUM", "HIGH"],
      SubscriptionPlan: ["BASIC", "PREMIUM"],
      Term: ["TERM1", "TERM2", "TERM3"],
      WalletSource: ["MOMO", "CASH", "ADMIN"],
      WalletTransactionType: ["TOP_UP", "DEDUCTION", "REFUND"],
    },
  },
} as const
