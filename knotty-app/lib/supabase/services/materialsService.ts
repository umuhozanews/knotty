import { getSafeBrowserClient } from "../client";
import type { Database } from "../database.types";

export type MaterialCategory =
  | "kitchen" | "catering" | "garden" | "academics" | "laboratory"
  | "maintenance" | "sports" | "it_office" | "dormitory";

export type StockItem       = Database["public"]["Tables"]["school_materials"]["Row"];
export type StockTransaction = Database["public"]["Tables"]["material_transactions"]["Row"];
export type StudentAssignment = Database["public"]["Tables"]["student_assigned_items"]["Row"];

export type StockItemWithStatus = StockItem & {
  status: "in_stock" | "low_stock" | "out_of_stock";
};

export type MoveType = "stock_in" | "stock_out" | "damage_disposal" | "return";

export function getItemStatus(item: { quantity: number; min_quantity: number }): "in_stock" | "low_stock" | "out_of_stock" {
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.min_quantity) return "low_stock";
  return "in_stock";
}

function genItemCode(category: MaterialCategory): string {
  const prefix: Record<MaterialCategory, string> = {
    kitchen: "KIT", catering: "CAT", garden: "GRD", academics: "ACA",
    laboratory: "LAB", maintenance: "MNT", sports: "SPT", it_office: "ITO", dormitory: "DRM",
  };
  return `${prefix[category]}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export const STOCK_CATEGORIES: {
  key: MaterialCategory;
  label: string;
  sub: string;
  color: string;
  bg: string;
}[] = [
  { key: "kitchen",     label: "Kitchen",       sub: "Food, groceries & cooking",         color: "#EA580C", bg: "#FFF7ED" },
  { key: "catering",    label: "Catering",       sub: "Events, dining & serving items",    color: "#DB2777", bg: "#FDF2F8" },
  { key: "garden",      label: "Garden & Farm",  sub: "Tools, seeds & farm inputs",        color: "#16A34A", bg: "#F0FDF4" },
  { key: "academics",   label: "Academics",      sub: "Books, stationery & classroom",     color: "#2563EB", bg: "#EFF6FF" },
  { key: "laboratory",  label: "Laboratory",     sub: "Science equipment & reagents",      color: "#7C3AED", bg: "#F5F3FF" },
  { key: "maintenance", label: "Maintenance",    sub: "Tools, repairs & building",         color: "#78716C", bg: "#FAFAF9" },
  { key: "sports",      label: "Sports",         sub: "Equipment & athletic supplies",     color: "#0891B2", bg: "#ECFEFF" },
  { key: "it_office",   label: "IT & Office",    sub: "Computers, cables & stationery",   color: "#6366F1", bg: "#EEF2FF" },
  { key: "dormitory",   label: "Dormitory",      sub: "Bedding, furniture & dorm items",  color: "#0F766E", bg: "#F0FDFA" },
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
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((item) => ({ ...item, status: getItemStatus(item) }));
  },

  async getCategorySummary(schoolId: string): Promise<Record<string, { total: number; low: number; out: number }>> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("school_materials")
      .select("category, quantity, min_quantity")
      .eq("school_id", schoolId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const result: Record<string, { total: number; low: number; out: number }> = {};
    for (const cat of STOCK_CATEGORIES) result[cat.key] = { total: 0, low: 0, out: 0 };
    for (const item of (data ?? [])) {
      if (!result[item.category]) result[item.category] = { total: 0, low: 0, out: 0 };
      result[item.category].total++;
      const st = getItemStatus(item);
      if (st === "out_of_stock") result[item.category].out++;
      else if (st === "low_stock") result[item.category].low++;
    }
    return result;
  },

  async createItem(schoolId: string, params: {
    name: string;
    category: MaterialCategory;
    unit: string;
    quantity: number;
    min_quantity?: number;
    unit_cost?: number;
    supplier?: string;
    location?: string;
    description?: string;
  }): Promise<StockItemWithStatus> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const item_code = genItemCode(params.category);
    const { data, error } = await client
      .from("school_materials")
      .insert({ school_id: schoolId, item_code, ...params })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...data, status: getItemStatus(data) };
  },

  async updateItem(schoolId: string, itemId: string, params: {
    name?: string;
    unit?: string;
    min_quantity?: number;
    unit_cost?: number;
    supplier?: string | null;
    location?: string;
    description?: string | null;
  }): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { error } = await client
      .from("school_materials")
      .update({ ...params, updated_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
  },

  async recordMovement(schoolId: string, params: {
    materialId: string;
    type: MoveType;
    quantity: number;
    unitCost?: number;
    referenceNumber?: string;
    notes?: string;
    studentId?: string;
    studentName?: string;
    expectedReturnAt?: string;
  }): Promise<StockItemWithStatus> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");

    const { data: item, error: ie } = await client
      .from("school_materials")
      .select("quantity, min_quantity, unit_cost, name")
      .eq("id", params.materialId)
      .eq("school_id", schoolId)
      .single();
    if (ie || !item) throw new Error("Item not found");

    const isAddition = params.type === "stock_in" || params.type === "return";
    const newQty = item.quantity + (isAddition ? params.quantity : -params.quantity);
    if (newQty < 0) throw new Error(`Only ${item.quantity} in stock`);

    const uc = params.unitCost ?? (params.type === "stock_in" ? item.unit_cost : 0);

    const { data: updated, error: ue } = await client
      .from("school_materials")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", params.materialId)
      .eq("school_id", schoolId)
      .select()
      .single();
    if (ue || !updated) throw new Error(ue?.message ?? "Update failed");

    const { data: txn, error: te } = await client
      .from("material_transactions")
      .insert({
        school_id: schoolId,
        material_id: params.materialId,
        transaction_type: params.type,
        quantity: params.quantity,
        unit_cost: uc,
        total_cost: uc * params.quantity,
        reference_number: params.referenceNumber ?? null,
        notes: params.notes ?? null,
      })
      .select("id")
      .single();
    if (te) throw new Error(te.message);

    if (params.type === "stock_out" && params.studentId && params.studentName) {
      await client.from("student_assigned_items").insert({
        school_id: schoolId,
        material_id: params.materialId,
        student_id: params.studentId,
        item_name: item.name,
        quantity: params.quantity,
        expected_return_at: params.expectedReturnAt ?? null,
        notes: params.notes ?? null,
      });
    }

    return { ...updated, status: getItemStatus(updated) };
  },

  async listTransactions(schoolId: string, materialId: string): Promise<StockTransaction[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("material_transactions")
      .select("*")
      .eq("school_id", schoolId)
      .eq("material_id", materialId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async listStudentAssignments(schoolId: string, studentId: string): Promise<StudentAssignment[]> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { data, error } = await client
      .from("student_assigned_items")
      .select("*")
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .is("returned_at", null)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async returnStudentItem(schoolId: string, assignmentId: string, materialId: string | null, quantity: number, notes?: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");

    await client
      .from("student_assigned_items")
      .update({ returned_at: new Date().toISOString(), notes: notes ?? null })
      .eq("id", assignmentId)
      .eq("school_id", schoolId);

    if (materialId) {
      const { data: item } = await client
        .from("school_materials")
        .select("quantity, min_quantity")
        .eq("id", materialId)
        .eq("school_id", schoolId)
        .single();
      if (item) {
        await client
          .from("school_materials")
          .update({ quantity: item.quantity + quantity, updated_at: new Date().toISOString() })
          .eq("id", materialId)
          .eq("school_id", schoolId);
        await client.from("material_transactions").insert({
          school_id: schoolId,
          material_id: materialId,
          transaction_type: "return",
          quantity,
          unit_cost: 0,
          total_cost: 0,
          notes: notes ?? null,
        });
      }
    }
  },

  async deleteItem(schoolId: string, materialId: string): Promise<void> {
    const client = getSafeBrowserClient();
    if (!client) throw new Error("Not configured");
    const { error } = await client
      .from("school_materials")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", materialId)
      .eq("school_id", schoolId);
    if (error) throw new Error(error.message);
  },
};

// Legacy re-exports
export type SchoolMaterialItem = StockItem;
export type MaterialTransaction = StockTransaction;
export const MATERIAL_CATEGORIES = STOCK_CATEGORIES.map((c) => ({
  key: c.key, label: c.label, description: c.sub, iconName: "", color: "",
}));
