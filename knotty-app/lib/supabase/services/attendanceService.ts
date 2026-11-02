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
