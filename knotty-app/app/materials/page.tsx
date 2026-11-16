"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Loader2, X,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, Trash2,
  PackageOpen, TrendingDown, CheckCircle,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  supabaseMaterialsService,
  STOCK_CATEGORIES,
  type MaterialCategory,
  type StockItemWithStatus,
} from "@/lib/supabase/services/materialsService";

/* ── Add Item Modal ──────────────────────────────────────────────── */
function AddItemModal({ category, schoolId, onClose, onSaved }: {
  category: MaterialCategory; schoolId: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", unit: "pieces", quantity: "", min_quantity: "0",
    unit_cost: "", supplier: "", location: "", notes: "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabaseMaterialsService.createItem(schoolId, {
        name: form.name.trim(),
        category,
        unit: form.unit.trim() || "pieces",
        quantity: parseInt(form.quantity) || 0,
        min_quantity: parseInt(form.min_quantity) || 0,
        unit_cost: parseFloat(form.unit_cost) || 0,
        supplier: form.supplier.trim() || undefined,
        location: form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast("Item added", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-bold text-gray-900">Add Item</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">ITEM NAME *</p>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. White Rice" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">UNIT</p>
              <input value={form.unit} onChange={(e) => set("unit", e.target.value)}
                placeholder="pieces / kg / bags" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">INITIAL QTY *</p>
              <input required type="number" min={0} value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">MIN REORDER QTY</p>
              <input type="number" min={0} value={form.min_quantity} onChange={(e) => set("min_quantity", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">UNIT COST (RWF)</p>
              <input type="number" min={0} value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)}
                placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">SUPPLIER</p>
              <input value={form.supplier} onChange={(e) => set("supplier", e.target.value)}
                placeholder="Supplier name" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">STORAGE LOCATION</p>
              <input value={form.location} onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Kitchen Store Room A" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">NOTES</p>
              <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm bg-gray-100 text-gray-600">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#16A34A" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Add Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Move Stock Modal ───────────────────────────────────────────── */
function MoveStockModal({ item, schoolId, onClose, onSaved }: {
  item: StockItemWithStatus; schoolId: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"stock_in" | "stock_out" | "damage" | "return">("stock_in");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = parseInt(qty);
    if (!q || q <= 0) { toast("Enter a valid quantity", "error"); return; }
    setLoading(true);
    try {
      await supabaseMaterialsService.recordMovement(schoolId, {
        materialId: item.id, type, quantity: q,
        note: note.trim() || undefined,
      });
      toast("Stock updated", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally { setLoading(false); }
  }

  const moveTypes: { id: typeof type; label: string; color: string }[] = [
    { id: "stock_in",  label: "Stock In",   color: "#16A34A" },
    { id: "stock_out", label: "Issue Out",  color: "#2563EB" },
    { id: "return",    label: "Return",     color: "#7C3AED" },
    { id: "damage",    label: "Damage",     color: "#DC2626" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
            <p className="text-xs text-gray-400">{item.quantity} {item.unit} in stock</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">MOVEMENT TYPE</p>
            <div className="grid grid-cols-4 gap-1.5">
              {moveTypes.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  className="py-2 rounded-xl text-xs font-semibold border transition"
                  style={type === t.id
                    ? { background: t.color, color: "#fff", borderColor: t.color }
                    : { background: "#fff", color: "#666", borderColor: "#e5e5e5" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">QUANTITY ({item.unit})</p>
            <input required type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">NOTE <span className="font-normal">(optional)</span></p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Received from supplier"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm bg-gray-100 text-gray-600">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#16A34A" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Item Row ───────────────────────────────────────────────────── */
function ItemRow({ item, onMove, onDelete }: {
  item: StockItemWithStatus;
  onMove: (item: StockItemWithStatus) => void;
  onDelete: (item: StockItemWithStatus) => void;
}) {
  const statusConfig = {
    in_stock:    { label: "In Stock",   bg: "#DCFCE7", color: "#166534", Icon: CheckCircle },
    low_stock:   { label: "Low Stock",  bg: "#FEF9C3", color: "#854D0E", Icon: AlertTriangle },
    out_of_stock:{ label: "Out",        bg: "#FEE2E2", color: "#991B1B", Icon: PackageOpen },
  }[item.status];

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
        <p className="text-xs text-gray-400">{item.location ?? "—"} · {item.supplier ?? "—"}</p>
      </div>
      <div className="text-right flex-shrink-0 mr-1">
        <p className="text-sm font-bold text-gray-800">{item.quantity.toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">{item.unit}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: statusConfig.bg, color: statusConfig.color }}>
        <statusConfig.Icon size={10} /> {statusConfig.label}
      </span>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => onMove(item)} title="Stock movement"
          className="w-7 h-7 rounded-xl bg-green-50 flex items-center justify-center hover:bg-green-100 transition">
          <ArrowDownCircle size={14} className="text-green-600" />
        </button>
        <button onClick={() => onDelete(item)} title="Delete item"
          className="w-7 h-7 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition">
          <Trash2 size={13} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────── */
export default function MaterialsPage() {
  const { user, activeSchool } = useAuth();
  const { toast } = useToast();
  const schoolId = activeSchool?.id ?? user?.school_id ?? "";

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);
  const [summary, setSummary] = useState<Record<string, { total: number; low: number; out: number }>>({});
  const [items, setItems] = useState<StockItemWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [moveTarget, setMoveTarget] = useState<StockItemWithStatus | null>(null);

  // Dashboard summary
  useEffect(() => {
    if (!schoolId) return;
    setSummaryLoading(true);
    supabaseMaterialsService.getCategorySummary(schoolId)
      .then(setSummary)
      .catch(() => {/* silent */})
      .finally(() => setSummaryLoading(false));
  }, [schoolId]);

  // Category items
  const loadItems = useCallback(async () => {
    if (!selectedCategory || !schoolId) return;
    setLoading(true);
    try {
      const data = await supabaseMaterialsService.listByCategory(schoolId, selectedCategory);
      setItems(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error loading items", "error");
    } finally { setLoading(false); }
  }, [selectedCategory, schoolId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleDelete(item: StockItemWithStatus) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await supabaseMaterialsService.deleteItem(schoolId, item.id);
      toast("Item deleted", "success");
      loadItems();
      supabaseMaterialsService.getCategorySummary(schoolId).then(setSummary).catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error", "error");
    }
  }

  const cat = STOCK_CATEGORIES.find((c) => c.key === selectedCategory);

  const totalItems = Object.values(summary).reduce((s, v) => s + v.total, 0);
  const totalLow   = Object.values(summary).reduce((s, v) => s + v.low, 0);
  const totalOut   = Object.values(summary).reduce((s, v) => s + v.out, 0);

  return (
    <DashboardShell>
      {showAddModal && selectedCategory && (
        <AddItemModal category={selectedCategory} schoolId={schoolId} onClose={() => setShowAddModal(false)}
          onSaved={() => { loadItems(); supabaseMaterialsService.getCategorySummary(schoolId).then(setSummary).catch(() => {}); }} />
      )}
      {moveTarget && (
        <MoveStockModal item={moveTarget} schoolId={schoolId} onClose={() => setMoveTarget(null)}
          onSaved={() => { setMoveTarget(null); loadItems(); supabaseMaterialsService.getCategorySummary(schoolId).then(setSummary).catch(() => {}); }} />
      )}

      <div className="h-full flex flex-col gap-4 overflow-auto px-1 pb-4">

        {!selectedCategory ? (
          /* ── Dashboard home ─── */
          <>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Stock & Materials</h1>
              <p className="text-sm text-gray-400">Manage school inventory by category</p>
            </div>

            {/* Overview stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Items",   value: totalItems, color: "#2563EB", bg: "#EFF6FF" },
                { label: "Low Stock",     value: totalLow,   color: "#D97706", bg: "#FFFBEB" },
                { label: "Out of Stock",  value: totalOut,   color: "#DC2626", bg: "#FEF2F2" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl px-4 py-3" style={{ background: s.bg }}>
                  <p className="text-2xl font-extrabold" style={{ color: s.color }}>
                    {summaryLoading ? "—" : s.value}
                  </p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Category blocks */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {STOCK_CATEGORIES.map((cat) => {
                const s = summary[cat.key] ?? { total: 0, low: 0, out: 0 };
                const hasAlerts = s.low > 0 || s.out > 0;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className="flex flex-col gap-3 p-5 rounded-3xl text-left transition hover:scale-[1.02] active:scale-100 shadow-sm"
                    style={{ background: cat.bg }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{cat.emoji}</span>
                      {hasAlerts && !summaryLoading && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          {s.out > 0 ? `${s.out} out` : `${s.low} low`}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900">{cat.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.sub}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-gray-500">
                        {summaryLoading ? "—" : `${s.total} items`}
                      </span>
                      <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: cat.color }}>
                        Manage <ChevronRight size={12} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Category detail ─── */
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedCategory(null); setItems([]); }}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center transition"
                  style={{ background: "#F0FDF4", color: "#16A34A" }}>
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat?.emoji}</span>
                    <h1 className="text-xl font-extrabold text-gray-900">{cat?.label}</h1>
                  </div>
                  <p className="text-sm text-gray-400">{cat?.sub}</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold text-white"
                style={{ background: "#16A34A" }}>
                <Plus size={15} /> Add Item
              </button>
            </div>

            {/* Stats for this category */}
            {!loading && items.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Items",  value: items.length,                                         color: "#2563EB", bg: "#EFF6FF" },
                  { label: "Low Stock",    value: items.filter((i) => i.status === "low_stock").length,  color: "#D97706", bg: "#FFFBEB" },
                  { label: "Out of Stock", value: items.filter((i) => i.status === "out_of_stock").length, color: "#DC2626", bg: "#FEF2F2" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl px-4 py-3" style={{ background: s.bg }}>
                    <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Item list */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-800">
                  {loading ? "Loading…" : `${items.length} item${items.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <PackageOpen size={32} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm font-medium text-gray-500">No items yet</p>
                  <p className="text-xs text-gray-400 mt-1">Click "Add Item" to add your first item</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {items.map((item) => (
                    <ItemRow key={item.id} item={item} onMove={setMoveTarget} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
