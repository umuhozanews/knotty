"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft, Plus, Loader2, X, Search, Pencil,
  ArrowDownCircle, History, Package, AlertTriangle,
  CheckCircle2, PackageOpen, ChefHat, Utensils, Leaf,
  BookOpen, FlaskConical, Wrench, Trophy, Monitor, Bed,
  LucideIcon, ArrowUpCircle, RotateCcw, Trash2,
  UserRound, Calendar,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  supabaseMaterialsService, STOCK_CATEGORIES,
  type MaterialCategory, type StockItemWithStatus,
  type StockTransaction, type StudentAssignment, type MoveType,
} from "@/lib/supabase/services/materialsService";

/* ── Category icon map ──────────────────────────────────────────────────────── */
const CAT_ICON: Record<MaterialCategory, LucideIcon> = {
  kitchen:     ChefHat,
  catering:    Utensils,
  garden:      Leaf,
  academics:   BookOpen,
  laboratory:  FlaskConical,
  maintenance: Wrench,
  sports:      Trophy,
  it_office:   Monitor,
  dormitory:   Bed,
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
const UNITS = ["pieces", "kg", "g", "bags", "litres", "ml", "boxes", "packs", "reams", "sets", "pairs", "meters", "rolls", "cans", "bottles"];

const TXN_LABEL: Record<string, { label: string; color: string; sign: string }> = {
  stock_in:        { label: "Stock In",          color: "#16A34A", sign: "+" },
  stock_out:       { label: "Issue Out",          color: "#2563EB", sign: "-" },
  damage_disposal: { label: "Damage/Disposal",   color: "#DC2626", sign: "-" },
  return:          { label: "Return",             color: "#7C3AED", sign: "+" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/* ── Status badge ───────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: StockItemWithStatus["status"] }) {
  const cfg = {
    in_stock:     { label: "In Stock",    bg: "#DCFCE7", color: "#166534", Icon: CheckCircle2 },
    low_stock:    { label: "Low Stock",   bg: "#FEF9C3", color: "#854D0E", Icon: AlertTriangle },
    out_of_stock: { label: "Out",         bg: "#FEE2E2", color: "#991B1B", Icon: PackageOpen },
  }[status];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0"
      style={{ background: cfg.bg, color: cfg.color }}>
      <cfg.Icon size={9} /> {cfg.label}
    </span>
  );
}

/* ── Add / Edit modal ───────────────────────────────────────────────────────── */
function AddEditModal({
  item, category, schoolId, onClose, onSaved,
}: {
  item?: StockItemWithStatus;
  category: MaterialCategory;
  schoolId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!item;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: item?.name ?? "",
    unit: item?.unit ?? "pieces",
    quantity: item ? "" : "0",
    min_quantity: String(item?.min_quantity ?? "5"),
    unit_cost: String(item?.unit_cost ?? "0"),
    supplier: item?.supplier ?? "",
    location: item?.location ?? "Central Store",
    description: item?.description ?? "",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await supabaseMaterialsService.updateItem(schoolId, item.id, {
          name: form.name.trim(),
          unit: form.unit.trim() || "pieces",
          min_quantity: parseFloat(form.min_quantity) || 0,
          unit_cost: parseFloat(form.unit_cost) || 0,
          supplier: form.supplier.trim() || null,
          location: form.location.trim() || "Central Store",
          description: form.description.trim() || null,
        });
        toast("Item updated", "success");
      } else {
        await supabaseMaterialsService.createItem(schoolId, {
          name: form.name.trim(),
          category,
          unit: form.unit.trim() || "pieces",
          quantity: parseFloat(form.quantity) || 0,
          min_quantity: parseFloat(form.min_quantity) || 0,
          unit_cost: parseFloat(form.unit_cost) || 0,
          supplier: form.supplier.trim() || undefined,
          location: form.location.trim() || undefined,
          description: form.description.trim() || undefined,
        });
        toast("Item added", "success");
      }
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
          <p className="font-bold text-gray-900">{isEdit ? "Edit Item" : "Add Item"}</p>
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
              <select value={form.unit} onChange={(e) => set("unit", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="custom">other…</option>
              </select>
            </div>
            {!isEdit && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">INITIAL QTY *</p>
                <input required type="number" min={0} step="0.01" value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                  placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">MIN REORDER QTY</p>
              <input type="number" min={0} step="0.01" value={form.min_quantity} onChange={(e) => set("min_quantity", e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">UNIT COST (RWF)</p>
              <input type="number" min={0} step="1" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)}
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
              <p className="text-xs font-semibold text-gray-500 mb-1">DESCRIPTION</p>
              <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Optional notes about this item"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm bg-gray-100 text-gray-600">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#16A34A" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : isEdit ? "Save Changes" : <><Plus size={14} /> Add Item</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Move Stock modal ───────────────────────────────────────────────────────── */
function MoveStockModal({
  item, schoolId, onClose, onSaved,
}: {
  item: StockItemWithStatus;
  schoolId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<MoveType>("stock_in");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [assignStudent, setAssignStudent] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [expectedReturn, setExpectedReturn] = useState("");

  const isAddition = type === "stock_in" || type === "return";

  const moveTypes: { id: MoveType; label: string; color: string; Icon: LucideIcon }[] = [
    { id: "stock_in",        label: "Stock In",       color: "#16A34A", Icon: ArrowDownCircle },
    { id: "stock_out",       label: "Issue Out",      color: "#2563EB", Icon: ArrowUpCircle },
    { id: "return",          label: "Return",         color: "#7C3AED", Icon: RotateCcw },
    { id: "damage_disposal", label: "Damage",         color: "#DC2626", Icon: Trash2 },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = parseFloat(qty);
    if (!q || q <= 0) { toast("Enter a valid quantity", "error"); return; }
    setLoading(true);
    try {
      await supabaseMaterialsService.recordMovement(schoolId, {
        materialId: item.id,
        type,
        quantity: q,
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        referenceNumber: ref.trim() || undefined,
        notes: notes.trim() || undefined,
        studentId: (type === "stock_out" && assignStudent) ? undefined : undefined,
        studentName: (type === "stock_out" && assignStudent && studentName.trim()) ? studentName.trim() : undefined,
        expectedReturnAt: (type === "stock_out" && assignStudent && expectedReturn) ? expectedReturn : undefined,
      });
      toast("Stock updated", "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
            <p className="text-xs text-gray-400">{item.quantity.toLocaleString()} {item.unit} in stock · {item.location}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">MOVEMENT TYPE</p>
            <div className="grid grid-cols-4 gap-1.5">
              {moveTypes.map((t) => (
                <button key={t.id} type="button" onClick={() => { setType(t.id); setAssignStudent(false); }}
                  className="py-2.5 rounded-xl text-xs font-semibold border transition flex flex-col items-center gap-1"
                  style={type === t.id
                    ? { background: t.color, color: "#fff", borderColor: t.color }
                    : { background: "#fff", color: "#666", borderColor: "#e5e5e5" }}>
                  <t.Icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">QUANTITY ({item.unit})</p>
              <input required type="number" min={0.01} step="0.01" value={qty} onChange={(e) => setQty(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            </div>
            {!isAddition ? null : (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">UNIT COST (RWF)</p>
                <input type="number" min={0} step="1" value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={String(item.unit_cost || 0)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">REFERENCE NO. <span className="font-normal">(invoice / batch)</span></p>
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. INV-2024-001"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">NOTES</p>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
          </div>

          {type === "stock_out" && (
            <div className="border border-gray-100 rounded-2xl p-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={assignStudent} onChange={(e) => setAssignStudent(e.target.checked)}
                  className="w-4 h-4 rounded accent-green-600" />
                <span className="text-sm font-medium text-gray-700">Assign to a student</span>
              </label>
              {assignStudent && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">STUDENT NAME</p>
                    <input value={studentName} onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Student full name"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-1">EXPECTED RETURN DATE</p>
                    <input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none" />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
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

/* ── Transaction History modal ──────────────────────────────────────────────── */
function HistoryModal({
  item, schoolId, onClose,
}: {
  item: StockItemWithStatus;
  schoolId: string;
  onClose: () => void;
}) {
  const [txns, setTxns] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseMaterialsService.listTransactions(schoolId, item.id)
      .then(setTxns)
      .finally(() => setLoading(false));
  }, [schoolId, item.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
            <p className="text-xs text-gray-400">Movement history · last 30 entries</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading && <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-gray-200" /></div>}
          {!loading && txns.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <History size={28} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No movements yet</p>
            </div>
          )}
          {txns.map((t) => {
            const cfg = TXN_LABEL[t.transaction_type] ?? { label: t.transaction_type, color: "#666", sign: "?" };
            return (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-2xl bg-gray-50">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: cfg.color + "18" }}>
                  <span className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.sign}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{fmtDate(t.created_at)} {fmtTime(t.created_at)}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">
                    {cfg.sign}{t.quantity.toLocaleString()} {item.unit}
                    {t.unit_cost > 0 && <span className="text-xs font-normal text-gray-400 ml-1">@ {t.unit_cost.toLocaleString()} RWF</span>}
                  </p>
                  {t.reference_number && <p className="text-xs text-gray-400 font-mono mt-0.5">Ref: {t.reference_number}</p>}
                  {t.notes && <p className="text-xs text-gray-500 mt-0.5">{t.notes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Item Row ───────────────────────────────────────────────────────────────── */
function ItemRow({ item, onEdit, onMove, onHistory, onDelete }: {
  item: StockItemWithStatus;
  onEdit: () => void;
  onMove: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-gray-200 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{item.item_code}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="font-bold text-gray-800 text-sm">{item.quantity.toLocaleString()}<span className="font-normal text-xs text-gray-400 ml-0.5">{item.unit}</span></span>
          {item.location && <span className="hidden sm:block truncate max-w-[120px]">{item.location}</span>}
          {item.supplier && <span className="hidden md:block truncate max-w-[100px]">{item.supplier}</span>}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onMove} title="Stock movement"
            className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center hover:bg-green-100 transition">
            <ArrowDownCircle size={15} className="text-green-600" />
          </button>
          <button onClick={onHistory} title="History"
            className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition">
            <History size={14} className="text-blue-500" />
          </button>
          <button onClick={onEdit} title="Edit"
            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition">
            <Pencil size={13} className="text-gray-500" />
          </button>
          <button onClick={onDelete} title="Remove"
            className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center hover:bg-red-100 transition">
            <Trash2 size={13} className="text-red-400" />
          </button>
        </div>
      </div>
      {item.unit_cost > 0 && (
        <p className="text-xs text-gray-400 mt-2">Unit cost: {item.unit_cost.toLocaleString()} RWF · Value: {(item.quantity * item.unit_cost).toLocaleString()} RWF</p>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */
export default function MaterialsPage() {
  const { user, activeSchool } = useAuth();
  const { toast } = useToast();
  const schoolId = activeSchool?.id ?? user?.school_id ?? "";

  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | null>(null);
  const [summary, setSummary] = useState<Record<string, { total: number; low: number; out: number }>>({});
  const [items, setItems] = useState<StockItemWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<StockItemWithStatus | null>(null);
  const [moveTarget, setMoveTarget] = useState<StockItemWithStatus | null>(null);
  const [historyTarget, setHistoryTarget] = useState<StockItemWithStatus | null>(null);

  const loadSummary = useCallback(async () => {
    if (!schoolId) return;
    setSummaryLoading(true);
    try { setSummary(await supabaseMaterialsService.getCategorySummary(schoolId)); }
    catch { /* silent */ }
    finally { setSummaryLoading(false); }
  }, [schoolId]);

  const loadItems = useCallback(async () => {
    if (!selectedCategory || !schoolId) return;
    setLoading(true);
    try { setItems(await supabaseMaterialsService.listByCategory(schoolId, selectedCategory)); }
    catch (e) { toast(e instanceof Error ? e.message : "Error", "error"); }
    finally { setLoading(false); }
  }, [selectedCategory, schoolId]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadItems(); }, [loadItems]);

  async function handleDelete(item: StockItemWithStatus) {
    if (!confirm(`Remove "${item.name}" from inventory?`)) return;
    try {
      await supabaseMaterialsService.deleteItem(schoolId, item.id);
      toast("Item removed", "success");
      loadItems();
      loadSummary();
    } catch (e) { toast(e instanceof Error ? e.message : "Error", "error"); }
  }

  function afterMutation() { loadItems(); loadSummary(); }

  const cat = STOCK_CATEGORIES.find((c) => c.key === selectedCategory);
  const CatIcon = selectedCategory ? CAT_ICON[selectedCategory] : null;

  const filteredItems = useMemo(() =>
    search.trim()
      ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.item_code.toLowerCase().includes(search.toLowerCase()))
      : items,
    [items, search]);

  const totalItems = Object.values(summary).reduce((s, v) => s + v.total, 0);
  const totalLow   = Object.values(summary).reduce((s, v) => s + v.low, 0);
  const totalOut   = Object.values(summary).reduce((s, v) => s + v.out, 0);

  return (
    <DashboardShell>
      {showAddModal && selectedCategory && (
        <AddEditModal category={selectedCategory} schoolId={schoolId}
          onClose={() => setShowAddModal(false)} onSaved={afterMutation} />
      )}
      {editTarget && (
        <AddEditModal item={editTarget} category={editTarget.category as MaterialCategory} schoolId={schoolId}
          onClose={() => setEditTarget(null)} onSaved={afterMutation} />
      )}
      {moveTarget && (
        <MoveStockModal item={moveTarget} schoolId={schoolId}
          onClose={() => setMoveTarget(null)} onSaved={afterMutation} />
      )}
      {historyTarget && (
        <HistoryModal item={historyTarget} schoolId={schoolId} onClose={() => setHistoryTarget(null)} />
      )}

      <div className="h-full flex flex-col gap-4 overflow-auto px-1 pb-6">

        {!selectedCategory ? (
          /* ── Category overview ─────────────────────────────────────────────── */
          <>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Stock & Materials</h1>
              <p className="text-sm text-gray-400">School inventory across all departments</p>
            </div>

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
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {STOCK_CATEGORIES.map((c) => {
                const s = summary[c.key] ?? { total: 0, low: 0, out: 0 };
                const Icon = CAT_ICON[c.key];
                const hasAlert = !summaryLoading && (s.low > 0 || s.out > 0);
                return (
                  <button key={c.key} onClick={() => { setSelectedCategory(c.key); setSearch(""); }}
                    className="flex flex-col gap-3 p-4 rounded-3xl text-left transition hover:scale-[1.02] active:scale-100 shadow-sm border border-transparent hover:border-gray-100"
                    style={{ background: c.bg }}>
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: c.color + "20" }}>
                        <Icon size={20} style={{ color: c.color }} />
                      </div>
                      {hasAlert && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          {s.out > 0 ? `${s.out} out` : `${s.low} low`}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 text-sm">{c.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{c.sub}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-auto">
                      {summaryLoading ? "—" : `${s.total} item${s.total !== 1 ? "s" : ""}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Category item list ────────────────────────────────────────────── */
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedCategory(null); setItems([]); setSearch(""); }}
                  className="w-9 h-9 rounded-2xl flex items-center justify-center transition"
                  style={{ background: cat?.bg, color: cat?.color }}>
                  <ChevronLeft size={18} />
                </button>
                {CatIcon && cat && (
                  <div>
                    <div className="flex items-center gap-2">
                      <CatIcon size={18} style={{ color: cat.color }} />
                      <h1 className="text-lg font-extrabold text-gray-900">{cat.label}</h1>
                    </div>
                    <p className="text-xs text-gray-400">{cat.sub}</p>
                  </div>
                )}
              </div>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-bold text-white flex-shrink-0"
                style={{ background: "#16A34A" }}>
                <Plus size={15} /> Add Item
              </button>
            </div>

            {/* Stats for category */}
            {!loading && items.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Items",       value: items.length,                                               color: "#2563EB", bg: "#EFF6FF" },
                  { label: "Low Stock",   value: items.filter((i) => i.status === "low_stock").length,       color: "#D97706", bg: "#FFFBEB" },
                  { label: "Out",         value: items.filter((i) => i.status === "out_of_stock").length,    color: "#DC2626", bg: "#FEF2F2" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl px-4 py-3" style={{ background: s.bg }}>
                    <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items or codes…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-2xl outline-none focus:border-gray-400 bg-white"
              />
            </div>

            {/* Item list */}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <PackageOpen size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm font-medium text-gray-500">{search ? "No items match your search" : "No items yet"}</p>
                {!search && <p className="text-xs text-gray-400 mt-1">Click "Add Item" to start adding stock</p>}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <ItemRow key={item.id} item={item}
                    onEdit={() => setEditTarget(item)}
                    onMove={() => setMoveTarget(item)}
                    onHistory={() => setHistoryTarget(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
