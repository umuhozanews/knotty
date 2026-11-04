"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Package, Plus, Search, RefreshCw, AlertTriangle, CheckCircle,
  Filter, ArrowDownRight, ArrowUpRight, Clock, Building2,
  Calendar, User, CreditCard, ChevronRight, X, Sparkles,
  Utensils, Coffee, Sprout, BookOpen, FlaskConical, Wrench,
  Trophy, Laptop, Home, ShoppingBag, ShieldCheck, Download,
  SlidersHorizontal,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useNFC } from "@/hooks/useNFC";
import {
  supabaseMaterialsService,
  type SchoolMaterialItem,
  type MaterialTransaction,
  type MaterialCategory,
  MATERIAL_CATEGORIES,
} from "@/lib/supabase/services/materialsService";
import { supabaseAttendanceService } from "@/lib/supabase/services/attendanceService";
import { supabaseCanteenService } from "@/lib/supabase/services/canteenService";

function playChime(type: "IN" | "OUT" | "ERROR") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "IN") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "OUT") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {}
}

const CATEGORY_ICONS: Record<MaterialCategory, any> = {
  kitchen: Utensils,
  catering: Coffee,
  garden: Sprout,
  academics: BookOpen,
  laboratory: FlaskConical,
  maintenance: Wrench,
  sports: Trophy,
  it_office: Laptop,
  dormitory: Home,
};

export default function MaterialsPage() {
  const { activeSchool, user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported: nfcSupported } = useNFC();

  const [activeTab, setActiveTab] = useState<"inventory" | "transactions" | "low_stock">("inventory");
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [materials, setMaterials] = useState<SchoolMaterialItem[]>([]);
  const [transactions, setTransactions] = useState<MaterialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<SchoolMaterialItem | null>(null);

  // Requisition Form State (with Card integration)
  const [reqRecipientInput, setReqRecipientInput] = useState("");
  const [reqRecipientName, setReqRecipientName] = useState("");
  const [reqCardNumber, setReqCardNumber] = useState<string | null>(null);
  const [reqDepartment, setReqDepartment] = useState("");
  const [reqPurpose, setReqPurpose] = useState("");
  const [reqQuantity, setReqQuantity] = useState<number>(1);
  const [reqNotes, setReqNotes] = useState("");
  const [reqCardVerifying, setReqCardVerifying] = useState(false);
  const [reqSubmitting, setReqSubmitting] = useState(false);

  // Restock Form State
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockUnitCost, setRestockUnitCost] = useState<number>(0);
  const [restockSupplier, setRestockSupplier] = useState("");
  const [restockInvoice, setRestockInvoice] = useState("");
  const [restockNotes, setRestockNotes] = useState("");
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // Add Item Form State
  const [newItem, setNewItem] = useState({
    item_code: "",
    name: "",
    category: "kitchen" as MaterialCategory,
    location: "Main Kitchen Store",
    unit_of_measure: "pieces",
    quantity_on_hand: 10,
    min_reorder_level: 5,
    unit_cost: 5000,
    supplier_name: "",
    description: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  const schoolId = activeSchool?.id || user?.school_id;

  // Cleanup NFC listener on unmount
  useEffect(() => {
    return () => {
      stopListen();
    };
  }, [stopListen]);

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [matList, txList] = await Promise.all([
        supabaseMaterialsService.listMaterials(schoolId),
        supabaseMaterialsService.listTransactions(schoolId),
      ]);
      setMaterials(matList);
      setTransactions(txList);
    } catch (err: any) {
      toast(err?.message || "Failed to load materials", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolId, toast]);

  useEffect(() => {
    if (!authLoading && schoolId) {
      loadData();
    }
  }, [authLoading, schoolId, loadData]);

  // Card Tap Handler for Material Requisition
  const handleCardTapForRequisition = useCallback(async (cardVal: string) => {
    if (!schoolId || !cardVal.trim()) return;
    setReqCardVerifying(true);
    setReqRecipientInput(cardVal);
    try {
      // 1. Try Staff lookup
      const staff = await supabaseAttendanceService.lookupStaffCardHolder({
        schoolId,
        cardNumber: cardVal.trim(),
      });
      if (staff) {
        setReqRecipientName(staff.legal_name);
        setReqCardNumber(staff.card_number || cardVal.trim());
        setReqDepartment(staff.department || staff.job_title || "School Staff");
        playChime("IN");
        toast(`Authorized: ${staff.legal_name} (${staff.job_title})`, "success");
        return;
      }

      // 2. Try Student lookup
      const student = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, cardVal.trim()).catch(() => null);
      if (student) {
        setReqRecipientName(student.legal_name);
        setReqCardNumber(student.card_number || cardVal.trim());
        setReqDepartment(`Student (${student.class_name})`);
        playChime("IN");
        toast(`Authorized: ${student.legal_name} (${student.class_name})`, "success");
        return;
      }

      // Manual fallback
      setReqRecipientName(cardVal.trim());
      setReqCardNumber(cardVal.trim());
      toast(`Card/Code captured: ${cardVal}`, "info");
    } catch {
      setReqRecipientName(cardVal.trim());
    } finally {
      setReqCardVerifying(false);
    }
  }, [schoolId, toast]);

  // Requisition Submit (Stock Out)
  async function submitRequisition(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selectedMaterial) return;
    if (reqQuantity <= 0) {
      toast("Quantity must be greater than zero", "error");
      return;
    }
    if (!reqRecipientName.trim()) {
      toast("Recipient name or card scan required", "error");
      return;
    }
    if (!reqPurpose.trim()) {
      toast("Purpose of requisition required", "error");
      return;
    }

    setReqSubmitting(true);
    try {
      const res = await supabaseMaterialsService.recordTransaction(schoolId, {
        materialId: selectedMaterial.id,
        transactionType: "stock_out",
        quantity: reqQuantity,
        recipientKind: "staff",
        recipientName: reqRecipientName.trim(),
        cardNumber: reqCardNumber,
        department: reqDepartment.trim() || "General",
        purpose: reqPurpose.trim(),
        notes: reqNotes.trim() || null,
      });

      playChime("OUT");
      toast(
        `Issued ${reqQuantity} ${selectedMaterial.unit_of_measure} of ${selectedMaterial.name} to ${reqRecipientName}`,
        "success"
      );
      setShowRequisitionModal(false);
      resetReqForm();
      loadData();
    } catch (err: any) {
      playChime("ERROR");
      toast(err?.message || "Failed to record requisition", "error");
    } finally {
      setReqSubmitting(false);
    }
  }

  // Restock Submit (Stock In)
  async function submitRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selectedMaterial) return;
    if (restockQty <= 0) {
      toast("Quantity must be greater than zero", "error");
      return;
    }

    setRestockSubmitting(true);
    try {
      await supabaseMaterialsService.recordTransaction(schoolId, {
        materialId: selectedMaterial.id,
        transactionType: "stock_in",
        quantity: restockQty,
        recipientKind: "department",
        recipientName: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Storekeeper",
        department: "Central Inventory",
        purpose: "Stock delivery & replenishment",
        batchOrInvoiceRef: restockInvoice.trim() || null,
        notes: restockNotes.trim() || null,
        unitCost: restockUnitCost > 0 ? restockUnitCost : selectedMaterial.unit_cost,
      });

      playChime("IN");
      toast(
        `Restocked ${restockQty} ${selectedMaterial.unit_of_measure} of ${selectedMaterial.name}`,
        "success"
      );
      setShowRestockModal(false);
      resetRestockForm();
      loadData();
    } catch (err: any) {
      playChime("ERROR");
      toast(err?.message || "Failed to record restock", "error");
    } finally {
      setRestockSubmitting(false);
    }
  }

  // Create New Material Submit
  async function submitNewItem(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId) return;
    if (!newItem.name.trim()) {
      toast("Item name is required", "error");
      return;
    }
    const code = newItem.item_code.trim() || `MAT-${newItem.category.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    setAddSaving(true);
    try {
      await supabaseMaterialsService.createMaterial(schoolId, {
        item_code: code,
        name: newItem.name.trim(),
        category: newItem.category,
        location: newItem.location.trim() || "Main Store",
        unit_of_measure: newItem.unit_of_measure.trim() || "pieces",
        quantity_on_hand: Number(newItem.quantity_on_hand) || 0,
        min_reorder_level: Number(newItem.min_reorder_level) || 5,
        unit_cost: Number(newItem.unit_cost) || 0,
        supplier_name: newItem.supplier_name.trim() || null,
        description: newItem.description.trim() || null,
      });

      playChime("IN");
      toast(`Added material: ${newItem.name}`, "success");
      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      toast(err?.message || "Failed to add material", "error");
    } finally {
      setAddSaving(false);
    }
  }

  function resetReqForm() {
    setReqRecipientInput("");
    setReqRecipientName("");
    setReqCardNumber(null);
    setReqDepartment("");
    setReqPurpose("");
    setReqQuantity(1);
    setReqNotes("");
  }

  function resetRestockForm() {
    setRestockQty(10);
    setRestockUnitCost(0);
    setRestockSupplier("");
    setRestockInvoice("");
    setRestockNotes("");
  }

  // Filtered lists
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchCat = selectedCategory === "ALL" || m.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.item_code.toLowerCase().includes(q) ||
        m.location.toLowerCase().includes(q) ||
        (m.supplier_name && m.supplier_name.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [materials, selectedCategory, searchQuery]);

  const lowStockItems = useMemo(() => {
    return materials.filter((m) => m.quantity_on_hand <= m.min_reorder_level);
  }, [materials]);

  // Inventory stats
  const totalItemsCount = materials.length;
  const totalValue = materials.reduce((acc, m) => acc + m.quantity_on_hand * m.unit_cost, 0);
  const lowStockCount = lowStockItems.length;
  const todayTxCount = transactions.filter((t) => {
    const d = new Date(t.created_at);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">School Materials & Inventory</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Enterprise ERP
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Kitchen, Garden, Catering, Academics, Lab, Maintenance & Sports stock control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
              title="Refresh inventory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Total Items</span>
              <Package className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalItemsCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{MATERIAL_CATEGORIES.length} school categories</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Inventory Value</span>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalValue.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">RWF Total Estimated Asset</p>
          </div>

          <div
            onClick={() => setActiveTab("low_stock")}
            className={`bg-white rounded-2xl p-4 border shadow-xs cursor-pointer transition ${
              lowStockCount > 0 ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50" : "border-gray-100"
            }`}
          >
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Low Stock Alerts</span>
              <AlertTriangle className={`w-4 h-4 ${lowStockCount > 0 ? "text-amber-600" : "text-gray-400"}`} />
            </div>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? "text-amber-700" : "text-gray-900"}`}>
              {lowStockCount}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Items needing reorder</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <span className="text-xs font-medium">Today's Moves</span>
              <Clock className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{todayTxCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Requisitions & deliveries</p>
          </div>
        </div>

        {/* Tab Selector & Category Filter */}
        <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            {/* Main Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl max-w-sm">
              <button
                onClick={() => setActiveTab("inventory")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                  activeTab === "inventory"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Stock Registry ({materials.length})
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition ${
                  activeTab === "transactions"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Movement Log ({transactions.length})
              </button>
              <button
                onClick={() => setActiveTab("low_stock")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 ${
                  activeTab === "low_stock"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>Alerts</span>
                {lowStockCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">
                    {lowStockCount}
                  </span>
                )}
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search material, code, store location, supplier..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Category Chips (Only on Inventory Tab) */}
          {activeTab === "inventory" && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-gray-100">
              <button
                onClick={() => setSelectedCategory("ALL")}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 ${
                  selectedCategory === "ALL"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All Categories ({materials.length})
              </button>

              {MATERIAL_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.key];
                const count = materials.filter((m) => m.category === cat.key).length;
                const isSelected = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                    <span className={`text-[10px] ml-0.5 ${isSelected ? "text-white/80" : "text-gray-400"}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── TAB 1: STOCK REGISTRY ─────────────────────────────────── */}
        {activeTab === "inventory" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {filteredMaterials.length === 0 ? (
              <div className="py-16 text-center text-gray-400 space-y-2">
                <Package className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">No material items match the selected category or filter</p>
                <button onClick={() => setShowAddModal(true)} className="text-xs text-emerald-600 underline">
                  Add new material item
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">Code / Item</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Store Location</th>
                      <th className="py-3 px-4 text-right">In Stock</th>
                      <th className="py-3 px-4 text-right">Reorder Level</th>
                      <th className="py-3 px-4 text-right">Unit Cost</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMaterials.map((item) => {
                      const CatIcon = CATEGORY_ICONS[item.category] || Package;
                      const isLow = item.quantity_on_hand <= item.min_reorder_level;
                      const isOut = item.quantity_on_hand <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                                <CatIcon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{item.name}</p>
                                <p className="font-mono text-[10px] text-gray-400">{item.item_code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-lg text-[11px]">
                              {item.category.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600">{item.location}</td>
                          <td className="py-3 px-4 text-right font-bold text-gray-900">
                            {item.quantity_on_hand}{" "}
                            <span className="font-normal text-gray-500 text-[11px]">{item.unit_of_measure}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-500">
                            {item.min_reorder_level} {item.unit_of_measure}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-900">
                            {item.unit_cost.toLocaleString()} RWF
                          </td>
                          <td className="py-3 px-4">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Requisition (Issue) Button with Card Authorization */}
                              <button
                                onClick={() => {
                                  setSelectedMaterial(item);
                                  resetReqForm();
                                  setShowRequisitionModal(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black text-white hover:bg-gray-800 font-semibold text-[11px] transition shadow-xs"
                                title="Issue material to staff or student with Card verification"
                              >
                                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                <span>Issue</span>
                              </button>

                              {/* Restock (Stock In) Button */}
                              <button
                                onClick={() => {
                                  setSelectedMaterial(item);
                                  resetRestockForm();
                                  setRestockUnitCost(item.unit_cost);
                                  setShowRestockModal(true);
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-[11px] transition"
                                title="Restock delivery from supplier"
                              >
                                <ArrowDownRight className="w-3 h-3 text-blue-600" />
                                <span>Restock</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: MOVEMENT AUDIT TRAIL ───────────────────────────── */}
        {activeTab === "transactions" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Inventory Movement & Requisition History</h2>
              <span className="text-xs text-gray-400">{transactions.length} audit records</span>
            </div>

            {transactions.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Clock className="w-8 h-8 mx-auto opacity-30 mb-2" />
                <p className="text-xs">No stock transactions recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const isStockIn = tx.transaction_type === "stock_in" || tx.transaction_type === "return";
                  return (
                    <div key={tx.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isStockIn ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {isStockIn ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-gray-900 text-xs">
                              {tx.material_name || "Material Item"} ({tx.item_code})
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isStockIn ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {tx.transaction_type.toUpperCase().replace("_", " ")}
                            </span>
                            {tx.card_number && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-50 text-purple-700 flex items-center gap-1 border border-purple-200">
                                <CreditCard className="w-3 h-3" />
                                <span>Card: {tx.card_number}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Recipient / Custodian: <strong>{tx.recipient_name}</strong> ({tx.department}) · Purpose:{" "}
                            {tx.purpose}
                          </p>
                          {tx.batch_or_invoice_ref && (
                            <p className="text-[11px] text-gray-400 mt-0.5">Ref/Invoice: {tx.batch_or_invoice_ref}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-12 sm:pl-0">
                        <p className={`font-bold text-sm ${isStockIn ? "text-blue-600" : "text-emerald-600"}`}>
                          {isStockIn ? "+" : "-"}
                          {tx.quantity} units
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: LOW STOCK ALERTS ───────────────────────────────── */}
        {activeTab === "low_stock" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">Critical & Low Stock Thresholds</h2>
                <p className="text-xs text-gray-500">Materials below minimum safety stock requiring urgent procurement</p>
              </div>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 opacity-60" />
                <p className="text-sm font-semibold text-gray-700">All Materials Healthy</p>
                <p className="text-xs text-gray-400">All materials are above minimum reorder levels.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-xs">{item.name}</span>
                        <span className="font-mono text-[10px] text-gray-500">({item.item_code})</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">Category: {item.category} · Store: {item.location}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <span className="font-bold text-red-600">
                          Current: {item.quantity_on_hand} {item.unit_of_measure}
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600">
                          Min Safety: {item.min_reorder_level} {item.unit_of_measure}
                        </span>
                      </div>
                      {item.supplier_name && (
                        <p className="text-[11px] text-gray-400 mt-1">Supplier: {item.supplier_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedMaterial(item);
                        resetRestockForm();
                        setRestockUnitCost(item.unit_cost);
                        setShowRestockModal(true);
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition"
                    >
                      Restock Now
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: REQUISITION / ISSUE (WITH CARD VERIFICATION) ───────── */}
      {showRequisitionModal && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Issue Material</h3>
                  <p className="text-[11px] text-gray-400">Card-authorized stock issuance</p>
                </div>
              </div>
              <button
                onClick={() => setShowRequisitionModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitRequisition} className="p-6 space-y-4">
              {/* Item Info Box */}
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-gray-900">{selectedMaterial.name}</p>
                  <p className="text-[11px] text-gray-400 font-mono">
                    Code: {selectedMaterial.item_code} · Location: {selectedMaterial.location}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-600">
                    {selectedMaterial.quantity_on_hand} {selectedMaterial.unit_of_measure}
                  </p>
                  <p className="text-[10px] text-gray-400">Available</p>
                </div>
              </div>

              {/* Card Verification Section */}
              <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span>Authorize with Card (Staff or Student)</span>
                  </div>
                  <VirtualCardTap
                    busy={reqCardVerifying}
                    onTap={(val) => handleCardTapForRequisition(val)}
                  />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reqRecipientInput}
                    onChange={(e) => {
                      setReqRecipientInput(e.target.value);
                      setReqRecipientName(e.target.value);
                    }}
                    placeholder="Tap NFC, enter Card #, or Staff ID (STF-...)"
                    className="flex-1 px-3 py-2 text-xs border border-blue-200 rounded-xl bg-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleCardTapForRequisition(reqRecipientInput)}
                    disabled={reqCardVerifying || !reqRecipientInput.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition shrink-0"
                  >
                    {reqCardVerifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verify"}
                  </button>
                </div>

                {reqRecipientName && (
                  <div className="flex items-center gap-2 pt-1 text-xs text-blue-900 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      Authorized by: <strong>{reqRecipientName}</strong>
                      {reqCardNumber ? ` · Card: ${reqCardNumber}` : ""}
                    </span>
                  </div>
                )}
              </div>

              {/* Requisition Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Quantity to Issue ({selectedMaterial.unit_of_measure}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedMaterial.quantity_on_hand}
                    value={reqQuantity}
                    onChange={(e) => setReqQuantity(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Department / Section *</label>
                  <input
                    type="text"
                    value={reqDepartment}
                    onChange={(e) => setReqDepartment(e.target.value)}
                    placeholder="e.g. Kitchen, Agriculture, S1A"
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Purpose of Requisition *</label>
                  <input
                    type="text"
                    value={reqPurpose}
                    onChange={(e) => setReqPurpose(e.target.value)}
                    placeholder="e.g. Student lunch preparation, vegetable plot preparation"
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes / Observations</label>
                  <input
                    type="text"
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    placeholder="Optional details or batch notes"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRequisitionModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reqSubmitting}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  {reqSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                  <span>Authorize & Issue</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RESTOCK / STOCK IN ──────────────────────────────── */}
      {showRestockModal && selectedMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Restock Material</h3>
                  <p className="text-[11px] text-gray-400">Receive delivery from supplier</p>
                </div>
              </div>
              <button
                onClick={() => setShowRestockModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitRestock} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <p className="font-bold text-xs text-gray-900">{selectedMaterial.name}</p>
                <p className="text-[11px] text-gray-500">
                  Current stock: {selectedMaterial.quantity_on_hand} {selectedMaterial.unit_of_measure}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Quantity Received ({selectedMaterial.unit_of_measure}) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={restockQty}
                    onChange={(e) => setRestockQty(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit Cost (RWF)</label>
                  <input
                    type="number"
                    min={0}
                    value={restockUnitCost}
                    onChange={(e) => setRestockUnitCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Supplier / Vendor</label>
                  <input
                    type="text"
                    value={restockSupplier}
                    onChange={(e) => setRestockSupplier(e.target.value)}
                    placeholder={selectedMaterial.supplier_name || "Supplier name"}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Invoice / Delivery Note #</label>
                  <input
                    type="text"
                    value={restockInvoice}
                    onChange={(e) => setRestockInvoice(e.target.value)}
                    placeholder="e.g. INV-2026-4402"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  {restockSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>Record Restock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD NEW MATERIAL ITEM ──────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add New School Material</h3>
                  <p className="text-[11px] text-gray-400">Register inventory item in catalogue</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-200 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitNewItem} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Material Name *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    required
                    placeholder="e.g. Sugar, Garden Rake, Sodium Hydroxide 1L"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Category *</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as MaterialCategory })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  >
                    {MATERIAL_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit of Measure *</label>
                  <input
                    type="text"
                    value={newItem.unit_of_measure}
                    onChange={(e) => setNewItem({ ...newItem, unit_of_measure: e.target.value })}
                    placeholder="kg, litres, pieces, bags, boxes"
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Initial Quantity *</label>
                  <input
                    type="number"
                    min={0}
                    value={newItem.quantity_on_hand}
                    onChange={(e) => setNewItem({ ...newItem, quantity_on_hand: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Min Reorder Level *</label>
                  <input
                    type="number"
                    min={1}
                    value={newItem.min_reorder_level}
                    onChange={(e) => setNewItem({ ...newItem, min_reorder_level: Number(e.target.value) })}
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Unit Cost (RWF)</label>
                  <input
                    type="number"
                    min={0}
                    value={newItem.unit_cost}
                    onChange={(e) => setNewItem({ ...newItem, unit_cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Store Location</label>
                  <input
                    type="text"
                    value={newItem.location}
                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                    placeholder="e.g. Main Kitchen Store"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Default Supplier</label>
                  <input
                    type="text"
                    value={newItem.supplier_name}
                    onChange={(e) => setNewItem({ ...newItem, supplier_name: e.target.value })}
                    placeholder="e.g. Kigali Wholesale Mart"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                  <textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    rows={2}
                    placeholder="Specifications, handling instructions, or notes"
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  {addSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Save Material</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
