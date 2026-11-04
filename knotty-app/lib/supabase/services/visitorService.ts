import { getSafeBrowserClient } from "../client";

export type VisitorStatus = "pending" | "approved" | "inside" | "completed" | "cancelled" | "denied";

export interface VisitorVisitRow {
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
  status: VisitorStatus;
  arrived_at: string | null;
  departed_at: string | null;
  created_at: string;
  is_blocked: boolean;
}

export interface VisitorProfileRow {
  visitor_profile_id: string;
  full_name: string;
  phone: string | null;
  organization: string | null;
  id_type: string | null;
  id_reference: string | null;
  is_blocked: boolean;
  last_visit_date: string | null;
}

export const supabaseVisitorService = {
  async registerVisitorVisit(params: {
    schoolId: string;
    fullName: string;
    phone?: string | null;
    idType?: string | null;
    idReference?: string | null;
    organization?: string | null;
    hostName?: string | null;
    hostDepartment?: string | null;
    purpose?: string;
    notes?: string | null;
    visitorProfileId?: string | null;
  }): Promise<{ visitId: string; visitorProfileId: string; passReference: string; status: string }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { data, error } = await client.rpc("register_visitor_visit", {
      p_school_id:          params.schoolId,
      p_full_name:          params.fullName,
      p_phone:              params.phone ?? null,
      p_id_type:            params.idType ?? null,
      p_id_reference:       params.idReference ?? null,
      p_organization:       params.organization ?? null,
      p_host_name:          params.hostName ?? null,
      p_host_department:    params.hostDepartment ?? null,
      p_purpose:            params.purpose ?? "General Visit",
      p_notes:              params.notes ?? null,
      p_visitor_profile_id: params.visitorProfileId ?? null,
    });

    if (error) throw new Error(error.message);
    const r = data as any;
    return {
      visitId:          r.visit_id,
      visitorProfileId: r.visitor_profile_id,
      passReference:    r.pass_reference,
      status:           r.status,
    };
  },

  async admitVisitor(params: { schoolId: string; visitId: string }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("admit_visitor", {
      p_school_id: params.schoolId,
      p_visit_id:  params.visitId,
    });
    if (error) throw new Error(error.message);
  },

  async checkoutVisitor(params: { schoolId: string; visitId: string }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("checkout_visitor", {
      p_school_id: params.schoolId,
      p_visit_id:  params.visitId,
    });
    if (error) throw new Error(error.message);
  },

  async approveVisitor(params: { schoolId: string; visitId: string }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("approve_visitor", {
      p_school_id: params.schoolId,
      p_visit_id:  params.visitId,
    });
    if (error) throw new Error(error.message);
  },

  async denyVisitor(params: { schoolId: string; visitId: string; reason?: string | null }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    const { error } = await client.rpc("deny_visitor", {
      p_school_id: params.schoolId,
      p_visit_id:  params.visitId,
      p_reason:    params.reason ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async getGateOverview(params: { schoolId: string }): Promise<{
    students_inside: number;
    staff_inside: number;
    visitors_inside: number;
    today_entries: number;
    today_exits: number;
    pending_visitors: number;
  }> {
    const fallback = {
      students_inside: 0,
      staff_inside: 0,
      visitors_inside: 0,
      today_entries: 0,
      today_exits: 0,
      pending_visitors: 0,
    };

    const client = getSafeBrowserClient();
    if (!client) return fallback;

    try {
      const { data, error } = await client.rpc("get_gate_overview", {
        p_school_id: params.schoolId,
      });
      if (error) {
        console.warn("get_gate_overview notice:", error.message);
        return fallback;
      }
      return (data || fallback) as any;
    } catch (err: any) {
      console.warn("getGateOverview error:", err?.message);
      return fallback;
    }
  },

  async searchVisitorProfiles(params: {
    schoolId: string;
    query: string;
    limit?: number;
  }): Promise<VisitorProfileRow[]> {
    const client = getSafeBrowserClient();
    if (!client) return [];

    try {
      const { data, error } = await client.rpc("search_visitor_profiles", {
        p_school_id: params.schoolId,
        p_query:     params.query,
        p_limit:     params.limit ?? 10,
      });
      if (error) {
        console.warn("search_visitor_profiles notice:", error.message);
        return [];
      }
      return (data || []) as any;
    } catch {
      return [];
    }
  },

  async listVisitorVisits(params: {
    schoolId: string;
    date?: string;
    status?: VisitorStatus | null;
    limit?: number;
  }): Promise<VisitorVisitRow[]> {
    const client = getSafeBrowserClient();
    if (!client) return [];

    try {
      const { data, error } = await client.rpc("list_visitor_visits", {
        p_school_id: params.schoolId,
        p_date:      params.date ?? new Date().toISOString().split("T")[0],
        p_status:    params.status ?? null,
        p_limit:     params.limit ?? 50,
      });
      if (error) {
        console.warn("list_visitor_visits notice:", error.message);
        return [];
      }
      return (data || []) as any;
    } catch (err: any) {
      console.warn("listVisitorVisits error:", err?.message);
      return [];
    }
  },
};
