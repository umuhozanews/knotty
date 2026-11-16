import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type MaterialCategory = "kitchen" | "it_tools" | "garden" | "labs" | "dormitory";
export type StockItem = Database["public"]["Tables"]["school_materials"]["Row"];
export type StockTransaction = Database["public"]["Tables"]["material_transactions"]["Row"];

export type StockItemWithStatus = StockItem & {
  status: "in_stock" | "low_stock" | "out_of_stock";
};

export function getItemStatus(item: StockItem): "in_stock" | "low_stock" | "out_of_stock" {
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.min_quantity) return "low_stock";
  return "in_stock";
}

export const STOCK_CATEGORIES: {
  key: MaterialCategory;
  label: string;
  sub: string;
  color: string;
  bg: string;
  emoji: string;
}[] = [
  { key: "kitchen",   label: "Kitchen & Food",  sub: "Food, groceries & cooking items",    color: "#EA580C", bg: "#FFF7ED", emoji: "🍳" },
  { key: "it_tools",  label: "IT Tools",         sub: "Computers, cables & office tech",    color: "#2563EB", bg: "#EFF6FF", emoji: "💻" },
  { key: "garden",    label: "Garden & Farm",    sub: "Tools, seeds & farm inputs",         color: "#16A34A", bg: "#F0FDF4", emoji: "🌱" },
  { key: "labs",      label: "Labs",             sub: "Science equipment & reagents",       color: "#7C3AED", bg: "#F5F3FF", emoji: "🔬" },
  { key: "dormitory", label: "Dormitory",        sub: "Bedding, furniture & dorm supplies", color: "#0891B2", bg: "#ECFEFF", emoji: "🛏️" },
];

export const supabaseMaterialsService = {
  async listByCategory(schoolId: string, category: MaterialCategory): Promise<StockItemWithStatus[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("school_materials")
      .select("*")
      .eq("school_id", schoolId)
      .eq("category", category)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((item) => ({ ...item, status: getItemStatus(item) }));
  },

  async getCategorySummary(schoolId: string): Promise<Record<MaterialCategory, { total: number; low: number; out: number }>> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("school_materials")
      .select("category, quantity, min_quantity")
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);

    const result = {} as Record<MaterialCategory, { total: number; low: number; out: number }>;
    for (const cat of STOCK_CATEGORIES) {
      result[cat.key] = { total: 0, low: 0, out: 0 };
    }
    for (const item of (data ?? [])) {
      const cat = item.category as MaterialCategory;
      if (!result[cat]) result[cat] = { total: 0, low: 0, out: 0 };
      result[cat].total++;
      if (item.quantity <= 0) result[cat].out++;
      else if (item.quantity <= item.min_quantity) result[cat].low++;
    }
    return result;
  },

  async createItem(schoolId: string, params: {
    name: string; category: MaterialCategory; unit: string; quantity: number;
    min_quantity?: number; unit_cost?: number; supplier?: string; location?: string; notes?: string;
  }): Promise<StockItemWithStatus> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("school_materials")
      .insert({ school_id: schoolId, ...params })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...data, status: getItemStatus(data) };
  },

  async recordMovement(schoolId: string, params: {
    materialId: string;
    type: "stock_in" | "stock_out" | "damage" | "return";
    quantity: number;
    note?: string;
  }): Promise<StockItemWithStatus> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");

    // Get current quantity
    const { data: item, error: ie } = await client
      .from("school_materials")
      .select("quantity, min_quantity")
      .eq("id", params.materialId)
      .eq("school_id", schoolId)
      .single();
    if (ie || !item) throw new Error("Item not found");

    const delta = (params.type === "stock_in" || params.type === "return") ? params.quantity : -params.quantity;
    const newQty = Math.max(0, item.quantity + delta);

    if (delta < 0 && item.quantity < params.quantity) {
      throw new Error(`Only ${item.quantity} in stock — cannot remove ${params.quantity}`);
    }

    // Update quantity
    const { data: updated, error: ue } = await client
      .from("school_materials")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", params.materialId)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (ue || !updated) throw new Error(ue?.message ?? "Update failed");

    // Record transaction
    await client.from("material_transactions").insert({
      school_id: schoolId,
      material_id: params.materialId,
      type: params.type,
      quantity: params.quantity,
      note: params.note ?? null,
    });

    return { ...updated, status: getItemStatus(updated) };
  },

  async listTransactions(schoolId: string, materialId?: string): Promise<StockTransaction[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    let q = client
      .from("material_transactions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (materialId) q = q.eq("material_id", materialId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async deleteItem(schoolId: string, materialId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { error } = await client
      .from("school_materials")
      .delete()
      .eq("id", materialId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
  },
};

// Keep legacy export names for any existing imports
export type SchoolMaterialItem = StockItem;
export type MaterialTransaction = StockTransaction;
export const MATERIAL_CATEGORIES = STOCK_CATEGORIES.map((c) => ({
  key: c.key, label: c.label, description: c.sub, iconName: "", color: "",
}));
