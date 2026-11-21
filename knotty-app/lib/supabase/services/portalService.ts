import { getSafeBrowserClient } from "../client";

const SESSION_KEY = "portal_session_token";

// The new portal RPCs aren't in database.types.ts yet — cast to bypass strict typing
function rpc(client: ReturnType<typeof getSafeBrowserClient>) {
  return (client as any).rpc.bind(client as any) as (name: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
}

export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(SESSION_KEY);
}

export type PortalSession = {
  student_id: string;
  school_id: string;
  legal_name: string;
  must_change_pin: boolean;
  profile_photo_path: string | null;
};

export type PortalRequest = {
  request_id: string;
  request_number: string;
  type: "appointment" | "challenge";
  category: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  appointment_requested_at: string | null;
  appointment_confirmed_at: string | null;
  unread_admin_messages?: number;
};

export type PortalRequestDetail = PortalRequest & {
  body: string;
  resolved_at: string | null;
  appointment_location: string | null;
  assigned_staff_name: string;
  messages: {
    id: string;
    sender_kind: "student" | "admin";
    sender_name: string;
    body: string;
    created_at: string;
  }[];
};

export type PortalNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  request_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type AdminPortalRequest = {
  request_id: string;
  request_number: string;
  type: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  student_name: string;
  student_admission: string;
  created_at: string;
  updated_at: string;
  appointment_requested_at: string | null;
  appointment_confirmed_at: string | null;
  unread_student_messages: number;
};

export type AdminPortalRequestDetail = AdminPortalRequest & {
  body: string;
  student_class: string;
  resolved_at: string | null;
  appointment_location: string | null;
  assigned_staff_name: string;
  assigned_to_staff_id: string | null;
  messages: {
    id: string;
    sender_kind: "student" | "admin";
    sender_name: string;
    body: string;
    created_at: string;
  }[];
};

export type PortalStats = {
  total: number;
  pending: number;
  reviewing: number;
  in_progress: number;
  resolved: number;
  rejected: number;
};

export const portalService = {
  async login(email: string, password: string): Promise<{
    token: string;
    session: PortalSession;
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("portal_login_email", {
      p_email: email.trim().toLowerCase(),
      p_password: password,
    });
    if (error) throw new Error(error.message);
    if (!data || !(data as any[]).length) throw new Error("Invalid email or password");
    const row = (data as any[])[0];
    return {
      token: row.session_token,
      session: {
        student_id: row.student_id,
        school_id: row.school_id,
        legal_name: row.legal_name,
        must_change_pin: row.must_change_pin,
        profile_photo_path: row.profile_photo_path,
      },
    };
  },

  async adminSetPortalEmail(schoolId: string, studentId: string, portalEmail: string, password: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("admin_set_portal_email", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_portal_email: portalEmail.trim().toLowerCase(),
      p_password: password,
    });
    if (error) throw new Error(error.message);
  },

  async validateSession(token: string): Promise<PortalSession | null> {
    const client = getSafeBrowserClient();
    if (!client) return null;
    const { data, error } = await rpc(client)("portal_validate_session", {
      p_token: token,
    });
    if (error || !data || !(data as any[]).length) return null;
    const row = (data as any[])[0];
    return {
      student_id: row.student_id,
      school_id: row.school_id,
      legal_name: row.legal_name,
      must_change_pin: row.must_change_pin,
      profile_photo_path: row.profile_photo_path,
    };
  },

  async changePin(token: string, newPin: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("portal_change_pin", {
      p_token: token,
      p_new_pin: newPin,
    });
    if (error) throw new Error(error.message);
  },

  async createRequest(params: {
    token: string;
    type: "appointment" | "challenge";
    category: string;
    subject: string;
    body: string;
    priority: string;
    appointmentRequestedAt?: string;
  }): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("portal_create_request", {
      p_token: params.token,
      p_type: params.type,
      p_category: params.category,
      p_subject: params.subject,
      p_body: params.body,
      p_priority: params.priority,
      p_appointment_requested_at: params.appointmentRequestedAt ?? null,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  async listMyRequests(token: string): Promise<PortalRequest[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("portal_list_my_requests", {
      p_token: token,
    });
    if (error) throw new Error(error.message);
    return (data || []) as PortalRequest[];
  },

  async getRequestDetail(token: string, requestId: string): Promise<PortalRequestDetail | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("portal_get_request_detail", {
      p_token: token,
      p_request_id: requestId,
    });
    if (error) throw new Error(error.message);
    if (!data || !(data as any[]).length) return null;
    const row = (data as any[])[0];
    return {
      ...row,
      messages: row.messages ?? [],
    } as PortalRequestDetail;
  },

  async addMessage(token: string, requestId: string, body: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("portal_add_message", {
      p_token: token,
      p_request_id: requestId,
      p_body: body,
    });
    if (error) throw new Error(error.message);
  },

  async getNotifications(token: string): Promise<PortalNotification[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("portal_get_notifications", {
      p_token: token,
    });
    if (error) throw new Error(error.message);
    return (data || []) as PortalNotification[];
  },

  async markNotificationsRead(token: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("portal_mark_notifications_read", {
      p_token: token,
    });
    if (error) throw new Error(error.message);
  },

  // ── Admin ──────────────────────────────────────────────────

  async adminListRequests(
    schoolId: string,
    status?: string,
    type?: string
  ): Promise<AdminPortalRequest[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("admin_list_portal_requests", {
      p_school_id: schoolId,
      p_status: status ?? null,
      p_type: type ?? null,
    });
    if (error) throw new Error(error.message);
    return (data || []) as AdminPortalRequest[];
  },

  async adminGetRequest(schoolId: string, requestId: string): Promise<AdminPortalRequestDetail | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("admin_get_portal_request", {
      p_school_id: schoolId,
      p_request_id: requestId,
    });
    if (error) throw new Error(error.message);
    if (!data || !(data as any[]).length) return null;
    const row = (data as any[])[0];
    return { ...row, messages: row.messages ?? [] } as AdminPortalRequestDetail;
  },

  async adminRespond(params: {
    schoolId: string;
    requestId: string;
    status: string;
    message?: string;
    assignedToStaffId?: string;
    appointmentConfirmedAt?: string;
    appointmentLocation?: string;
  }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("admin_respond_portal_request", {
      p_school_id: params.schoolId,
      p_request_id: params.requestId,
      p_status: params.status,
      p_message: params.message ?? null,
      p_assigned_to_staff_id: params.assignedToStaffId ?? null,
      p_appointment_confirmed_at: params.appointmentConfirmedAt ?? null,
      p_appointment_location: params.appointmentLocation ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async adminGetStats(schoolId: string): Promise<PortalStats> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { data, error } = await rpc(client)("admin_get_portal_stats", {
      p_school_id: schoolId,
    });
    if (error) throw new Error(error.message);
    const row = (data as any[])?.[0] ?? {};
    return {
      total: Number(row.total ?? 0),
      pending: Number(row.pending ?? 0),
      reviewing: Number(row.reviewing ?? 0),
      in_progress: Number(row.in_progress ?? 0),
      resolved: Number(row.resolved ?? 0),
      rejected: Number(row.rejected ?? 0),
    };
  },

  async adminSetPin(schoolId: string, studentId: string, pin: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase not configured");
    const { error } = await rpc(client)("admin_set_portal_pin", {
      p_school_id: schoolId,
      p_student_id: studentId,
      p_pin: pin,
    });
    if (error) throw new Error(error.message);
  },
};

