import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type CanteenProductRow = Database["public"]["Tables"]["canteen_products"]["Row"];
export type CanteenTransactionRow = Database["public"]["Tables"]["canteen_transactions"]["Row"];
export type CardHolderResult = Database["public"]["Functions"]["lookup_card_holder"]["Returns"][number];

export const supabaseCanteenService = {
  async listProducts(schoolId: string): Promise<CanteenProductRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("canteen_products")
      .select("*")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("category")
      .order("name");
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createProduct(schoolId: string, params: {
    name: string; price: number; category: string;
    photo_url?: string | null; stock_qty?: number | null;
  }): Promise<CanteenProductRow> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("canteen_products")
      .insert({ school_id: schoolId, ...params })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateProduct(schoolId: string, productId: string, params: {
    name?: string; price?: number; category?: string;
    photo_url?: string | null; stock_qty?: number | null;
  }): Promise<CanteenProductRow> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("canteen_products")
      .update({ ...params, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async restockProduct(schoolId: string, productId: string, qty: number): Promise<CanteenProductRow> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data: current } = await client
      .from("canteen_products")
      .select("stock_qty")
      .eq("id", productId)
      .eq("school_id", schoolId)
      .single();
    const newQty = (current?.stock_qty ?? 0) + qty;
    const { data, error } = await client
      .from("canteen_products")
      .update({ stock_qty: newQty, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteProduct(schoolId: string, productId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { error } = await client
      .from("canteen_products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
  },

  async lookupCardHolder(schoolId: string, cardNumber: string): Promise<CardHolderResult | null> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("lookup_card_holder", {
      p_school_id: schoolId,
      p_card_number: cardNumber,
    });
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  },

  async purchase(schoolId: string, cardAssignmentId: string, items: {
    product_id: string; name: string; price: number; qty: number;
  }[], total: number): Promise<{ transaction_id: string; new_balance: number }> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client.rpc("canteen_purchase", {
      p_school_id: schoolId,
      p_card_assignment_id: cardAssignmentId,
      p_items: items as unknown,
      p_total: total,
    });
    if (error) throw new Error(error.message);
    return data as { transaction_id: string; new_balance: number };
  },

  async listTransactions(schoolId: string, limit = 50): Promise<CanteenTransactionRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("canteen_transactions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async listStudentTransactions(schoolId: string, studentId: string, limit = 20): Promise<CanteenTransactionRow[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Supabase is not configured");
    const { data, error } = await client
      .from("canteen_transactions")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },
};
