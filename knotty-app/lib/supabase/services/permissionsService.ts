import { getSafeBrowserClient } from "../client";

export type PermissionType = "go_home" | "go_out" | "medical" | "other";
export type PermissionStatus = "active" | "revoked" | "expired";

export interface StudentPermission {
  id: string;
  permission_type: PermissionType;
  reason: string;
  granted_by_name: string;
  granted_at: string;
  valid_from: string;
  valid_until: string | null;
  status: PermissionStatus;
  revoked_by_name: string | null;
  revoked_at: string | null;
}

export interface TodayPermissionRow {
  id: string;
  student_record_id: string;
  student_name: string;
  class_name: string;
  profile_photo_path: string | null;
  permission_type: PermissionType;
  reason: string;
  granted_by_name: string;
  granted_at: string;
  valid_until: string | null;
  status: PermissionStatus;
}

export const PERMISSION_LABELS: Record<PermissionType, string> = {
  go_home: "Go Home",
  go_out:  "Go Out",
  medical: "Medical",
  other:   "Other",
};

export const permissionsService = {
  async grantPermission(params: {
    schoolId: string;
    studentRecordId: string;
    permissionType: PermissionType;
    reason: string;
    validUntil: string | null;
  }): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("grant_student_permission", {
      p_school_id:         params.schoolId,
      p_student_record_id: params.studentRecordId,
      p_permission_type:   params.permissionType,
      p_reason:            params.reason,
      p_valid_until:       params.validUntil ?? null,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  async getStudentPermissions(schoolId: string, studentRecordId: string): Promise<StudentPermission[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("get_student_permissions", {
      p_school_id:         schoolId,
      p_student_record_id: studentRecordId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as StudentPermission[];
  },

  async revokePermission(schoolId: string, permissionId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client.rpc("revoke_student_permission", {
      p_school_id:     schoolId,
      p_permission_id: permissionId,
    });
    if (error) throw new Error(error.message);
  },

  async listTodayPermissions(schoolId: string, limit = 100): Promise<TodayPermissionRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("list_today_permissions", {
      p_school_id: schoolId,
      p_limit:     limit,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as TodayPermissionRow[];
  },
};
