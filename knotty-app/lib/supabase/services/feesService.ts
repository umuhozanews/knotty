import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type FeeStructureRow = Database["public"]["Tables"]["fee_structures"]["Row"];
export type FeeInvoiceRow = Database["public"]["Tables"]["fee_invoices"]["Row"];
export type FeePaymentRow = Database["public"]["Tables"]["fee_payments"]["Row"];

export const supabaseFeesService = {
  async listStructures(schoolId: string): Promise<FeeStructureRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("fee_structures")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createStructure(schoolId: string, params: {
    name: string; amount: number; applies_to?: string[];
  }): Promise<FeeStructureRow> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("fee_structures")
      .insert({ school_id: schoolId, ...params })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async listInvoices(schoolId: string, params?: {
    studentId?: string; status?: FeeInvoiceRow["status"]; limit?: number;
  }): Promise<FeeInvoiceRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    let q = client
      .from("fee_invoices")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 200);
    if (params?.studentId) q = q.eq("student_id", params.studentId);
    if (params?.status) q = q.eq("status", params.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async generateInvoices(schoolId: string, params: {
    fee_structure_id: string; due_date: string;
  }): Promise<{ count: number }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const struct = await client
      .from("fee_structures")
      .select("name, amount")
      .eq("id", params.fee_structure_id)
      .eq("school_id", schoolId)
      .single();
    if (struct.error) throw new Error(struct.error.message);

    const students = await client
      .from("student_records")
      .select("id")
      .eq("school_id", schoolId)
      .eq("status", "active");
    if (students.error) throw new Error(students.error.message);

    const rows = (students.data || []).map((s) => ({
      school_id: schoolId,
      student_id: s.id,
      fee_structure_id: params.fee_structure_id,
      title: struct.data.name,
      total_amount: struct.data.amount,
      due_date: params.due_date,
    }));

    if (rows.length === 0) return { count: 0 };
    const { error } = await client.from("fee_invoices").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  },

  async payInvoice(schoolId: string, invoiceId: string, params: {
    amount: number; channel: string; phone?: string;
  }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client.rpc("pay_fee_invoice", {
      p_school_id: schoolId,
      p_invoice_id: invoiceId,
      p_amount: params.amount,
      p_channel: params.channel,
      p_phone: params.phone ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async getSchoolReport(schoolId: string): Promise<{
    total_collected: number; pending: number;
    by_channel: { channel: string; total: number }[];
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("fee_payments")
      .select("amount, channel")
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
    const payments = data || [];
    const total_collected = payments.reduce((s, p) => s + p.amount, 0);
    const byChannel: Record<string, number> = {};
    payments.forEach((p) => { byChannel[p.channel] = (byChannel[p.channel] ?? 0) + p.amount; });
    const { data: inv } = await client
      .from("fee_invoices")
      .select("total_amount, amount_paid")
      .eq("school_id", schoolId)
      .not("status", "eq", "paid");
    const pending = (inv || []).reduce((s, i) => s + Math.max(0, i.total_amount - i.amount_paid), 0);
    return {
      total_collected,
      pending,
      by_channel: Object.entries(byChannel).map(([channel, total]) => ({ channel, total })),
    };
  },
};
