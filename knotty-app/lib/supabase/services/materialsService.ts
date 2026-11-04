import { getSafeBrowserClient } from "../client";

export type MaterialCategory =
  | "kitchen"
  | "catering"
  | "garden"
  | "academics"
  | "laboratory"
  | "maintenance"
  | "sports"
  | "it_office"
  | "dormitory";

export interface SchoolMaterialItem {
  id: string;
  school_id: string;
  item_code: string;
  name: string;
  category: MaterialCategory;
  location: string;
  unit_of_measure: string;
  quantity_on_hand: number;
  min_reorder_level: number;
  unit_cost: number;
  supplier_name: string | null;
  description: string | null;
  status: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
  created_at: string;
  updated_at: string;
}

export interface MaterialTransaction {
  id: string;
  school_id: string;
  material_id: string;
  material_name?: string;
  item_code?: string;
  transaction_type: "stock_in" | "stock_out" | "damage_disposal" | "return";
  quantity: number;
  unit_cost: number;
  total_cost: number;
  recipient_kind: "staff" | "student" | "department" | "other";
  recipient_id: string | null;
  recipient_name: string;
  card_number: string | null;
  department: string;
  purpose: string;
  batch_or_invoice_ref: string | null;
  notes: string | null;
  created_at: string;
}

export const MATERIAL_CATEGORIES: {
  key: MaterialCategory;
  label: string;
  description: string;
  iconName: string;
  color: string;
}[] = [
  { key: "kitchen",     label: "Kitchen & Food",      description: "Rice, beans, flour, cooking oil, spices, produce",     iconName: "Utensils",     color: "bg-amber-500" },
  { key: "catering",    label: "Catering Equipment",  description: "Cookware, plates, cutlery, warmers, serving pans",      iconName: "Coffee",       color: "bg-orange-500" },
  { key: "garden",      label: "Garden & Farm",       description: "Hoes, seeds, fertilizer, wheelbarrows, irrigation",     iconName: "Sprout",       color: "bg-emerald-500" },
  { key: "academics",   label: "Classroom Supplies",  description: "Chalk, markers, notebooks, rulers, stationery",         iconName: "BookOpen",     color: "bg-blue-500" },
  { key: "laboratory",  label: "Science Lab",         description: "Test tubes, beakers, chemical reagents, safety gear",   iconName: "FlaskConical", color: "bg-purple-500" },
  { key: "maintenance", label: "Cleaning & Repair",   description: "Brooms, disinfectants, detergents, bulbs, paint",       iconName: "Wrench",       color: "bg-slate-500" },
  { key: "sports",      label: "Sports & PE",         description: "Footballs, jerseys, cones, nets, whistles",             iconName: "Trophy",       color: "bg-red-500" },
  { key: "it_office",   label: "IT & Office",         description: "Projectors, printers, toner, cables, paper reams",      iconName: "Laptop",       color: "bg-indigo-500" },
  { key: "dormitory",   label: "Dormitory",           description: "Mattresses, bed frames, nets, first aid",               iconName: "Home",         color: "bg-teal-500" },
];

const INITIAL_MATERIALS_SEED: Omit<SchoolMaterialItem, "school_id">[] = [
  // Kitchen & Food
  {
    id: "mat-kit-001",
    item_code: "MAT-KIT-001",
    name: "Kigali Long Grain White Rice",
    category: "kitchen",
    location: "Main Kitchen Dry Store",
    unit_of_measure: "bags (50kg)",
    quantity_on_hand: 24,
    min_reorder_level: 5,
    unit_cost: 45000,
    supplier_name: "Rwanda Grain & Cereals Ltd",
    description: "Grade 1 white rice for student lunches and dinners",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-kit-002",
    item_code: "MAT-KIT-002",
    name: "Red Kidney Dry Beans",
    category: "kitchen",
    location: "Main Kitchen Dry Store",
    unit_of_measure: "bags (100kg)",
    quantity_on_hand: 12,
    min_reorder_level: 4,
    unit_cost: 95000,
    supplier_name: "Eastern Agro Producers",
    description: "High-protein beans for student meal rationing",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-kit-003",
    item_code: "MAT-KIT-003",
    name: "Fortified Refined Cooking Oil",
    category: "kitchen",
    location: "Main Kitchen Oil Depot",
    unit_of_measure: "jerrycans (20L)",
    quantity_on_hand: 3,
    min_reorder_level: 4,
    unit_cost: 38000,
    supplier_name: "Mount Meru Millers",
    description: "Pure vegetable cooking oil fortified with Vitamin A",
    status: "low_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-kit-004",
    item_code: "MAT-KIT-004",
    name: "Whole Maize Flour (Kawunga)",
    category: "kitchen",
    location: "Main Kitchen Dry Store",
    unit_of_measure: "bags (50kg)",
    quantity_on_hand: 18,
    min_reorder_level: 6,
    unit_cost: 32000,
    supplier_name: "Minimex Rwanda",
    description: "Finely ground maize flour for student posho/ugali",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Catering Equipment
  {
    id: "mat-cat-001",
    item_code: "MAT-CAT-001",
    name: "Stainless Steel 5-Compartment Meal Trays",
    category: "catering",
    location: "Dining Hall Serving Station",
    unit_of_measure: "pieces",
    quantity_on_hand: 420,
    min_reorder_level: 50,
    unit_cost: 4500,
    supplier_name: "Kigali Commercial Kitchen Supplies",
    description: "Durable stainless steel dining trays for student meal service",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-cat-002",
    item_code: "MAT-CAT-002",
    name: "Heavy Duty Commercial Cooking Pots (150L)",
    category: "catering",
    location: "Kitchen Cooking Bay",
    unit_of_measure: "pieces",
    quantity_on_hand: 4,
    min_reorder_level: 2,
    unit_cost: 180000,
    supplier_name: "Rwanda Aluminium Fabricators",
    description: "Industrial aluminium steam cooking cauldrons",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Garden & Agriculture
  {
    id: "mat-gar-001",
    item_code: "MAT-GAR-001",
    name: "All-Steel Farming Hoes (Isuka)",
    category: "garden",
    location: "School Garden Tool Shed",
    unit_of_measure: "pieces",
    quantity_on_hand: 35,
    min_reorder_level: 10,
    unit_cost: 5500,
    supplier_name: "Chillington Rwanda",
    description: "Crocodile brand steel hoes for school farm and student agriculture",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-gar-002",
    item_code: "MAT-GAR-002",
    name: "Organic NPK Fertilizer 17-17-17",
    category: "garden",
    location: "Garden Chemical Store",
    unit_of_measure: "bags (50kg)",
    quantity_on_hand: 2,
    min_reorder_level: 3,
    unit_cost: 48000,
    supplier_name: "One Acre Fund Rwanda",
    description: "Balanced soil fertilizer for vegetable plots and school orchards",
    status: "low_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-gar-003",
    item_code: "MAT-GAR-003",
    name: "Zinc-Plated Heavy Wheelbarrows",
    category: "garden",
    location: "School Garden Tool Shed",
    unit_of_measure: "pieces",
    quantity_on_hand: 6,
    min_reorder_level: 2,
    unit_cost: 42000,
    supplier_name: "Matériaux Modernes Kigali",
    description: "Deep tray pneumatic wheelbarrows for harvest & compost transport",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Classroom & Academics
  {
    id: "mat-aca-001",
    item_code: "MAT-ACA-001",
    name: "Whiteboard Dry Erase Markers (Pack of 12)",
    category: "academics",
    location: "Staff Central Academic Store",
    unit_of_measure: "boxes",
    quantity_on_hand: 48,
    min_reorder_level: 15,
    unit_cost: 8500,
    supplier_name: "Librairie Ikirezi",
    description: "Low-odor refillable whiteboard markers (Blue, Black, Red)",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "mat-aca-002",
    item_code: "MAT-ACA-002",
    name: "A4 Ruled Examination Booklets",
    category: "academics",
    location: "Examination Office Safe",
    unit_of_measure: "packs (100)",
    quantity_on_hand: 14,
    min_reorder_level: 10,
    unit_cost: 12000,
    supplier_name: "Rwanda Print Pack",
    description: "Official serialized school examination answer booklets",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  // Maintenance & Sanitation
  {
    id: "mat-mai-001",
    item_code: "MAT-MAI-001",
    name: "Industrial Floor Disinfectant & Detergent",
    category: "maintenance",
    location: "Sanitation Store Room",
    unit_of_measure: "jerrycans (20L)",
    quantity_on_hand: 5,
    min_reorder_level: 3,
    unit_cost: 22000,
    supplier_name: "Sulfo Rwanda Industries",
    description: "Pine-scented concentrated disinfectant for dorms and classrooms",
    status: "in_stock",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const STORAGE_KEY_PREFIX = "ishuri_materials_";
const TX_KEY_PREFIX = "ishuri_mat_tx_";

function getLocalStore(schoolId: string): SchoolMaterialItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + schoolId);
    if (!raw) {
      const seeded = INITIAL_MATERIALS_SEED.map((m) => ({ ...m, school_id: schoolId }));
      localStorage.setItem(STORAGE_KEY_PREFIX + schoolId, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MATERIALS_SEED.map((m) => ({ ...m, school_id: schoolId }));
  }
}

function saveLocalStore(schoolId: string, items: SchoolMaterialItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + schoolId, JSON.stringify(items));
  } catch {}
}

function getLocalTxStore(schoolId: string): MaterialTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TX_KEY_PREFIX + schoolId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTxStore(schoolId: string, txs: MaterialTransaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TX_KEY_PREFIX + schoolId, JSON.stringify(txs));
  } catch {}
}

export const supabaseMaterialsService = {
  /**
   * List all materials for the school with live database fallback.
   */
  async listMaterials(schoolId: string): Promise<SchoolMaterialItem[]> {
    const client = getSafeBrowserClient();
    if (client) {
      try {
        const { data, error } = await (client.from("school_materials" as any) as any)
          .select("*")
          .eq("school_id", schoolId)
          .order("category")
          .order("name");
        if (!error && data && data.length > 0) {
          saveLocalStore(schoolId, data as SchoolMaterialItem[]);
          return data as SchoolMaterialItem[];
        }
      } catch {
        // fall back to local store
      }
    }
    return getLocalStore(schoolId);
  },

  /**
   * Add a new material item.
   */
  async createMaterial(
    schoolId: string,
    params: Omit<SchoolMaterialItem, "id" | "school_id" | "created_at" | "updated_at" | "status">
  ): Promise<SchoolMaterialItem> {
    const status =
      params.quantity_on_hand <= 0
        ? "out_of_stock"
        : params.quantity_on_hand <= params.min_reorder_level
        ? "low_stock"
        : "in_stock";

    const newItem: SchoolMaterialItem = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      ...params,
      status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const client = getSafeBrowserClient();
    if (client) {
      try {
        const { data, error } = await (client.from("school_materials" as any) as any)
          .insert(newItem)
          .select()
          .single();
        if (!error && data) {
          const current = getLocalStore(schoolId);
          saveLocalStore(schoolId, [data as SchoolMaterialItem, ...current]);
          return data as SchoolMaterialItem;
        }
      } catch {
        // fall through
      }
    }

    const current = getLocalStore(schoolId);
    const updated = [newItem, ...current];
    saveLocalStore(schoolId, updated);
    return newItem;
  },

  /**
   * Update an existing material item.
   */
  async updateMaterial(
    schoolId: string,
    materialId: string,
    updates: Partial<SchoolMaterialItem>
  ): Promise<SchoolMaterialItem> {
    const client = getSafeBrowserClient();
    const now = new Date().toISOString();

    if (client) {
      try {
        const { data, error } = await (client.from("school_materials" as any) as any)
          .update({ ...updates, updated_at: now })
          .eq("id", materialId)
          .eq("school_id", schoolId)
          .select()
          .single();
        if (!error && data) {
          const current = getLocalStore(schoolId).map((m) =>
            m.id === materialId ? (data as SchoolMaterialItem) : m
          );
          saveLocalStore(schoolId, current);
          return data as SchoolMaterialItem;
        }
      } catch {
        // fall through
      }
    }

    const current = getLocalStore(schoolId);
    let updatedItem: SchoolMaterialItem | null = null;
    const updated = current.map((m) => {
      if (m.id === materialId) {
        const newQty = updates.quantity_on_hand !== undefined ? updates.quantity_on_hand : m.quantity_on_hand;
        const minLvl = updates.min_reorder_level !== undefined ? updates.min_reorder_level : m.min_reorder_level;
        const newStatus =
          newQty <= 0
            ? "out_of_stock"
            : newQty <= minLvl
            ? "low_stock"
            : "in_stock";
        updatedItem = { ...m, ...updates, quantity_on_hand: newQty, status: newStatus, updated_at: now };
        return updatedItem;
      }
      return m;
    });

    saveLocalStore(schoolId, updated);
    if (!updatedItem) throw new Error("Material item not found");
    return updatedItem;
  },

  /**
   * Record Stock Movement (Stock IN, Stock OUT / Requisition with Card, Damage / Return).
   */
  async recordTransaction(
    schoolId: string,
    params: {
      materialId: string;
      transactionType: "stock_in" | "stock_out" | "damage_disposal" | "return";
      quantity: number;
      recipientKind?: "staff" | "student" | "department" | "other";
      recipientId?: string | null;
      recipientName: string;
      cardNumber?: string | null;
      department: string;
      purpose: string;
      batchOrInvoiceRef?: string | null;
      notes?: string | null;
      unitCost?: number;
    }
  ): Promise<{ transaction: MaterialTransaction; updatedMaterial: SchoolMaterialItem }> {
    const materials = getLocalStore(schoolId);
    const item = materials.find((m) => m.id === params.materialId);
    if (!item) throw new Error("Material item not found");

    if (params.quantity <= 0) {
      throw new Error("Quantity must be greater than zero");
    }

    let newQty = item.quantity_on_hand;
    if (params.transactionType === "stock_in" || params.transactionType === "return") {
      newQty += params.quantity;
    } else {
      if (newQty < params.quantity) {
        throw new Error(
          `Insufficient stock! Requested ${params.quantity} ${item.unit_of_measure}, but only ${newQty} ${item.unit_of_measure} available.`
        );
      }
      newQty -= params.quantity;
    }

    const unitCost = params.unitCost ?? item.unit_cost;
    const totalCost = unitCost * params.quantity;

    const tx: MaterialTransaction = {
      id: crypto.randomUUID(),
      school_id: schoolId,
      material_id: item.id,
      material_name: item.name,
      item_code: item.item_code,
      transaction_type: params.transactionType,
      quantity: params.quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      recipient_kind: params.recipientKind || "department",
      recipient_id: params.recipientId || null,
      recipient_name: params.recipientName,
      card_number: params.cardNumber || null,
      department: params.department,
      purpose: params.purpose,
      batch_or_invoice_ref: params.batchOrInvoiceRef || null,
      notes: params.notes || null,
      created_at: new Date().toISOString(),
    };

    // Update material quantity & status
    const updatedMaterial = await this.updateMaterial(schoolId, item.id, {
      quantity_on_hand: newQty,
    });

    // Save transaction
    const client = getSafeBrowserClient();
    if (client) {
      try {
        await (client.from("material_transactions" as any) as any).insert(tx);
      } catch {
        // fall through
      }
    }

    const txs = getLocalTxStore(schoolId);
    saveLocalTxStore(schoolId, [tx, ...txs]);

    return { transaction: tx, updatedMaterial };
  },

  /**
   * List recent transactions / audit trail.
   */
  async listTransactions(schoolId: string): Promise<MaterialTransaction[]> {
    const client = getSafeBrowserClient();
    if (client) {
      try {
        const { data, error } = await (client.from("material_transactions" as any) as any)
          .select("*")
          .eq("school_id", schoolId)
          .order("created_at", { ascending: false })
          .limit(100);
        if (!error && data && data.length > 0) {
          saveLocalTxStore(schoolId, data as MaterialTransaction[]);
          return data as MaterialTransaction[];
        }
      } catch {
        // fall back
      }
    }
    return getLocalTxStore(schoolId);
  },
};
