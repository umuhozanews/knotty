import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type AttendanceRecordRow = Database["public"]["Tables"]["attendance_records"]["Row"];
export type StaffAttendanceRecordRow = Database["public"]["Tables"]["staff_attendance_records"]["Row"];

export const supabaseAttendanceService = {
  /**
   * List attendance records for a school on a specific date.
   */
  async listAttendance(params: {
    schoolId: string;
    date: string;
    studentId?: string;
  }): Promise<AttendanceRecordRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    let query = client
      .from("attendance_records")
      .select("*")
      .eq("school_id", params.schoolId)
      .eq("attendance_date", params.date)
      .order("created_at", { ascending: false });

    if (params.studentId) {
      query = query.eq("student_id", params.studentId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Record manual student attendance.
   */
  async recordStudentAttendance(params: {
    schoolId: string;
    studentId: string;
    attendanceDate: string;
    status: "present" | "absent" | "late" | "excused" | "early_departure";
    arrivedAt?: string;
    departedAt?: string;
    reason?: string;
  }): Promise<{ recordId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("record_student_attendance", {
      p_school_id: params.schoolId,
      p_student_id: params.studentId,
      p_attendance_date: params.attendanceDate,
      p_status: params.status,
      p_arrived_at: params.arrivedAt || null,
      p_departed_at: params.departedAt || null,
      p_reason: params.reason || null,
    });

    if (error) throw new Error(error.message);
    return { recordId: data };
  },

  /**
   * Record a virtual student card tap (simulating physical NFC tap).
   */
  async recordVirtualStudentTap(params: {
    schoolId: string;
    studentId: string;
    idempotencyKey: string;
    occurredAt?: string;
  }): Promise<unknown> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("record_virtual_student_tap", {
      p_school_id: params.schoolId,
      p_student_id: params.studentId,
      p_idempotency_key: params.idempotencyKey,
      p_occurred_at: params.occurredAt,
    });

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Smart tap-in/tap-out: auto-detects direction or accepts forced direction.
   * Returns { action, check_in_time, check_out_time, tap_in_points, tap_out_points, ... }
   */
  async recordVirtualStudentTapV2(params: {
    schoolId: string;
    studentId: string;
    idempotencyKey: string;
    direction?: "auto" | "in" | "out";
    occurredAt?: string;
  }): Promise<{
    action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "DUPLICATE";
    direction: "in" | "out";
    check_in_time: string | null;
    check_out_time: string | null;
    attendance_record_id: string;
    scan_event_id: string | null;
    tap_in_points: number;
    tap_out_points: number;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("record_virtual_student_tap_v2", {
      p_school_id: params.schoolId,
      p_student_id: params.studentId,
      p_idempotency_key: params.idempotencyKey,
      p_direction: params.direction ?? "auto",
      p_occurred_at: params.occurredAt,
    });

    if (error) throw new Error(error.message);
    return data as any;
  },

  /**
   * Fetch per-class attendance report for PDF generation.
   */
  async getClassAttendanceReport(params: {
    schoolId: string;
    date: string;
  }): Promise<{
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
  }[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("get_class_attendance_report", {
      p_school_id: params.schoolId,
      p_date: params.date,
    });

    if (error) throw new Error(error.message);
    return (data || []) as any;
  },

  /**
   * Record staff attendance.
   */
  async recordStaffAttendance(params: {
    schoolId: string;
    staffRecordId: string;
    attendanceDate: string;
    status: string;
    arrivedAt?: string;
    departedAt?: string;
    reason?: string;
  }): Promise<{ recordId: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("record_staff_attendance", {
      p_school_id: params.schoolId,
      p_staff_record_id: params.staffRecordId,
      p_attendance_date: params.attendanceDate,
      p_status: params.status,
      p_arrived_at: params.arrivedAt || null,
      p_departed_at: params.departedAt || null,
      p_reason: params.reason || null,
    });

    if (error) throw new Error(error.message);
    return { recordId: data };
  },

  /**
   * Audit-trailed correction of an existing attendance record.
   */
  async correctStudentAttendance(params: {
    schoolId: string;
    attendanceId: string;
    status: "present" | "absent" | "late" | "excused" | "early_departure";
    arrivedAt?: string;
    departedAt?: string;
    reason: string;
  }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("correct_student_attendance", {
      p_school_id: params.schoolId,
      p_attendance_id: params.attendanceId,
      p_status: params.status,
      p_arrived_at: params.arrivedAt || null,
      p_departed_at: params.departedAt || null,
      p_reason: params.reason,
    });

    if (error) throw new Error(error.message);
  },

  /**
   * Look up a staff member by their card number, employee number (e.g. STF-GATE-01),
   * staff record ID, or legal name.
   */
  async lookupStaffCardHolder(params: {
    schoolId: string;
    cardNumber: string;
  }): Promise<{
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
  } | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const query = params.cardNumber?.trim();
    if (!query) return null;

    // 1. Try lookup_staff_card_holder RPC by card number
    try {
      const { data, error } = await client.rpc("lookup_staff_card_holder", {
        p_school_id:   params.schoolId,
        p_card_number: query,
      });
      if (!error && data && (data as any[]).length > 0) {
        return (data as any[])[0];
      }
    } catch {
      // ignore and try fallback
    }

    // 2. Fallback: match by employee_number, staff_record_id, or name from active staff list
    try {
      const { data: staffList, error: sErr } = await client.rpc("list_school_staff_members", {
        p_school_id: params.schoolId,
      });
      if (!sErr && Array.isArray(staffList)) {
        const qLower = query.toLowerCase();
        const matched = staffList.find((s: any) =>
          (s.staff_number && s.staff_number.toLowerCase() === qLower) ||
          s.staff_record_id?.toLowerCase() === qLower ||
          (s.legal_name && s.legal_name.toLowerCase().includes(qLower))
        );
        if (matched) {
          return {
            card_assignment_id: matched.staff_record_id,
            card_number: matched.staff_number || query,
            staff_record_id: matched.staff_record_id,
            employee_number: matched.staff_number || "",
            job_title: matched.job_title || "Staff",
            department: matched.department || null,
            employment_status: matched.employment_status || "active",
            legal_name: matched.legal_name,
            profile_photo_path: matched.profile_photo_path || null,
            card_status: "active",
            is_frozen: false,
          };
        }
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * Smart tap-in/tap-out for staff: auto-detects direction or accepts forced direction.
   * Returns { action, check_in_time, check_out_time, tap_in_points, tap_out_points, ... }
   */
  async recordVirtualStaffTap(params: {
    schoolId: string;
    staffRecordId: string;
    idempotencyKey: string;
    direction?: "auto" | "in" | "out";
    occurredAt?: string;
  }): Promise<{
    action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "DUPLICATE";
    direction: "in" | "out";
    check_in_time: string | null;
    check_out_time: string | null;
    staff_attendance_record_id: string;
    scan_event_id: string | null;
    tap_in_points: number;
    tap_out_points: number;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("record_virtual_staff_tap", {
      p_school_id:         params.schoolId,
      p_staff_record_id:   params.staffRecordId,
      p_idempotency_key:   params.idempotencyKey,
      p_direction:         params.direction ?? "auto",
      p_occurred_at:       params.occurredAt,
    });
    if (error) throw new Error(error.message);
    return data as any;
  },

  /**
   * Process attendance scan via the device scan Edge Function.
   */
  async processDeviceScan(params: {
    schoolId: string;
    deviceId: string;
    deviceCredential: string;
    cardIdentifier: string;
    idempotencyKey: string;
    direction: "in" | "out";
  }): Promise<{ scanEventId: string; outcome: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.functions.invoke("process-attendance-scan", {
      headers: {
        "x-device-credential": params.deviceCredential,
      },
      body: {
        school_id: params.schoolId,
        device_id: params.deviceId,
        card_identifier: params.cardIdentifier,
        idempotency_key: params.idempotencyKey,
        direction: params.direction,
      },
    });

    if (error) throw new Error(error.message || "Attendance scan failed");
    if (!data?.scan_event_id) throw new Error(data?.error || "Device scan rejected");

    return {
      scanEventId: data.scan_event_id,
      outcome: data.outcome ?? "processed",
    };
  },
};
