import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type FeeStructureRow = Database["public"]["Tables"]["fee_structures"]["Row"];
export type FeeInvoiceRow = Database["public"]["Tables"]["fee_invoices"]["Row"];
export type FeePaymentRow = Database["public"]["Tables"]["fee_payments"]["Row"];

export type FeeType = "TUITION" | "TRANSPORT" | "POCKET_MONEY" | "OTHER";

export interface StudentFeeStatus {
  student_id: string;
  admission_number: string;
  legal_name: string;
  profile_photo_path: string | null;
  invoice_id: string | null;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
}

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
    name: string; amount: number; fee_type?: string; applies_to?: string[];
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
    feeType?: string; termLabel?: string;
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
    if (params?.status)    q = q.eq("status", params.status);
    if (params?.feeType)   q = q.eq("fee_type", params.feeType);
    if (params?.termLabel) q = q.eq("term_label", params.termLabel);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Load all students in a class with their latest invoice for a fee type + term */
  async getClassFeeStatus(
    schoolId: string,
    classSectionId: string,
    feeType: FeeType,
    termLabel: string
  ): Promise<StudentFeeStatus[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    // Get students in this class
    const { data: students, error: se } = await client.rpc("list_school_students", {
      p_school_id: schoolId,
      p_class_section_id: classSectionId,
    });
    if (se) throw new Error(se.message);
    if (!students || students.length === 0) return [];

    const studentIds = students.map((s: { student_id: string }) => s.student_id);

    // Load invoices for this fee type + term (also include invoices with no term set)
    const { data: invoices, error: ie } = await client
      .from("fee_invoices")
      .select("id, student_id, total_amount, amount_paid, status, term_label")
      .eq("school_id", schoolId)
      .eq("fee_type", feeType)
      .or(`term_label.eq.${termLabel},term_label.is.null`)
      .in("student_id", studentIds)
      .order("created_at", { ascending: false });
    if (ie) throw new Error(ie.message);

    // Latest invoice per student
    const invoiceMap = new Map<string, { id: string; total_amount: number; amount_paid: number; status: string }>();
    for (const inv of (invoices || [])) {
      if (!invoiceMap.has(inv.student_id)) invoiceMap.set(inv.student_id, inv);
    }

    return students.map((s: { student_id: string; admission_number: string; legal_name: string; profile_photo_path: string | null }) => {
      const inv = invoiceMap.get(s.student_id) ?? null;
      const total = inv?.total_amount ?? 0;
      const paid = inv?.amount_paid ?? 0;
      return {
        student_id: s.student_id,
        admission_number: s.admission_number,
        legal_name: s.legal_name,
        profile_photo_path: s.profile_photo_path,
        invoice_id: inv?.id ?? null,
        total_amount: total,
        amount_paid: paid,
        balance: Math.max(0, total - paid),
        status: inv ? inv.status : "no_invoice",
      };
    });
  },

  /** Create or update an invoice for a student fee, return invoice_id */
  async upsertInvoice(schoolId: string, params: {
    studentId: string; feeType: FeeType; termLabel: string;
    totalAmount: number; dueDate?: string | null;
  }): Promise<string> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");

    // Check existing invoice
    const { data: existing } = await client
      .from("fee_invoices")
      .select("id, total_amount")
      .eq("school_id", schoolId)
      .eq("student_id", params.studentId)
      .eq("fee_type", params.feeType)
      .eq("term_label", params.termLabel)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      // Update expected amount if changed
      if (existing.total_amount !== params.totalAmount) {
        await client.from("fee_invoices").update({ total_amount: params.totalAmount }).eq("id", existing.id);
      }
      return existing.id;
    }

    // Create new invoice
    const { data, error } = await client.from("fee_invoices").insert({
      school_id: schoolId,
      student_id: params.studentId,
      fee_type: params.feeType,
      term_label: params.termLabel,
      title: `${params.feeType.replace("_", " ")} - ${params.termLabel}`,
      total_amount: params.totalAmount,
      amount_paid: 0,
      due_date: params.dueDate ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return data.id;
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

  async generateInvoices(schoolId: string, params: {
    fee_structure_id: string; due_date: string;
  }): Promise<{ count: number }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const struct = await client.from("fee_structures").select("name, amount, fee_type").eq("id", params.fee_structure_id).eq("school_id", schoolId).single();
    if (struct.error) throw new Error(struct.error.message);
    const students = await client.from("student_records").select("id").eq("school_id", schoolId).eq("status", "active");
    if (students.error) throw new Error(students.error.message);
    const rows = (students.data || []).map((s) => ({
      school_id: schoolId, student_id: s.id,
      fee_structure_id: params.fee_structure_id,
      title: struct.data.name, total_amount: struct.data.amount,
      fee_type: struct.data.fee_type ?? "TUITION",
      due_date: params.due_date,
    }));
    if (rows.length === 0) return { count: 0 };
    const { error } = await client.from("fee_invoices").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  },

  async getSchoolReport(schoolId: string): Promise<{
    total_collected: number; pending: number;
    by_channel: { channel: string; total: number }[];
  }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data: payments } = await client.from("fee_payments").select("amount, channel").eq("school_id", schoolId);
    const all = payments || [];
    const total_collected = all.reduce((s, p) => s + p.amount, 0);
    const byChannel: Record<string, number> = {};
    all.forEach((p) => { byChannel[p.channel] = (byChannel[p.channel] ?? 0) + p.amount; });
    const { data: inv } = await client.from("fee_invoices").select("total_amount, amount_paid").eq("school_id", schoolId).not("status", "eq", "paid");
    const pending = (inv || []).reduce((s, i) => s + Math.max(0, i.total_amount - i.amount_paid), 0);
    return { total_collected, pending, by_channel: Object.entries(byChannel).map(([channel, total]) => ({ channel, total })) };
  },

  /** Get all fee invoices for a student across all categories (latest per fee_type) */
  async getStudentFeeSummary(schoolId: string, studentId: string): Promise<{
    fee_type: string; total_amount: number; amount_paid: number; balance: number;
    status: string; term_label: string | null;
  }[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("fee_invoices")
      .select("fee_type, total_amount, amount_paid, status, term_label")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // Latest invoice per fee_type
    const seen = new Set<string>();
    const result: { fee_type: string; total_amount: number; amount_paid: number; balance: number; status: string; term_label: string | null }[] = [];
    for (const inv of (data || [])) {
      if (!seen.has(inv.fee_type)) {
        seen.add(inv.fee_type);
        result.push({ ...inv, balance: Math.max(0, inv.total_amount - inv.amount_paid) });
      }
    }
    return result;
  },

  /** After recording a POCKET_MONEY payment, top up the student's card wallet */
  async topUpWalletForPocketMoney(schoolId: string, studentId: string, amount: number): Promise<number | null> {
    const client = getSafeBrowserClient();
    if (!client) return null;
    // Find student's active card assignment
    const { data: cards } = await client
      .from("card_assignments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .in("status", ["active", "issued"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (!cards || cards.length === 0) return null;
    const cardAssignmentId = cards[0].id;
    const { data, error } = await client.rpc("top_up_wallet", {
      p_school_id: schoolId,
      p_card_assignment_id: cardAssignmentId,
      p_amount: amount,
      p_description: "Pocket money fee payment",
    });
    if (error) throw new Error(error.message);
    return data as number;
  },
};
