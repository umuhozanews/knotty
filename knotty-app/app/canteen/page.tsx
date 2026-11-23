"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Minus, ShoppingCart, Trash2,
  Wifi, WifiOff, CheckCircle, Loader2, X, Search,
  PackagePlus, Utensils,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { supabaseCanteenService, CardHolderResult, CanteenSaleRow } from "@/lib/supabase/services";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import { isFinanceRole } from "@/lib/roles";

type ScannedCard = {
  card_assignment_id: string;
  wallet_balance: number;
  student: { id: string; name: string; class: string; student_code: string; photo: string | null };
};
function toScannedCard(r: CardHolderResult): ScannedCard {
  return {
    card_assignment_id: r.card_assignment_id,
    wallet_balance: r.wallet_balance,
    student: { id: r.student_id, name: r.legal_name, class: r.class_name, student_code: r.admission_number, photo: r.profile_photo_path ?? null },
  };
}

function playTone(type: "success" | "error") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.start(); osc.stop(ctx.currentTime + 0.24);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    }
  } catch (_) {}
}

const CATEGORIES = ["All", "Snacks", "Drinks", "Meals", "Fruits", "Bread", "Other"];

type MenuItem = { id: string; name: string; price: number; img: string; cat: string; stock_qty?: number | null; fromApi?: boolean };
type CartMap = Record<string, number>;
type PayResult = { name: string; total: number; balance: number };

const CANTEEN_PRESETS = [
  { name: "Samosa", url: "/canteen/sambusa.png" },
  { name: "Chapati", url: "/canteen/chapati.png" },
  { name: "Amandazi", url: "/canteen/amandazi.png" },
  { name: "Rice & Meat", url: "/canteen/rice_meat.png" },
  { name: "Rice & Beans", url: "/canteen/rice_beans.png" },
  { name: "Inyange Juice", url: "/canteen/inyange.png" },
  { name: "Mineral Water", url: "/canteen/water.png" },
  { name: "Fanta", url: "/canteen/fanta.png" },
  { name: "Milk", url: "/canteen/milk.png" },
  { name: "Porridge", url: "/canteen/porridge.png" },
  { name: "Boiled Egg", url: "/canteen/egg.png" },
  { name: "Banana", url: "/canteen/banana.png" },
  { name: "Mango", url: "/canteen/embe.png" },
  { name: "Avocado", url: "/canteen/avocado.png" },
  { name: "Biscuits", url: "/canteen/maria.png" },
];

const CAT_PHOTOS: Record<string, string> = {
  Snacks: "/canteen/sambusa.png", Drinks: "/canteen/water.png",
  Meals: "/canteen/rice_meat.png", Fruits: "/canteen/banana.png",
  Bread: "/canteen/chapati.png", Other: "/canteen/rice_meat.png",
};

function foodPhoto(name?: string, cat?: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("water") || n.includes("amazi")) return "/canteen/water.png";
  if (n.includes("samosa") || n.includes("sambusa")) return "/canteen/sambusa.png";
  if (n.includes("chapati")) return "/canteen/chapati.png";
  if (n.includes("juice") || n.includes("inyange")) return "/canteen/inyange.png";
  if (n.includes("fanta") || n.includes("soda") || n.includes("coke") || n.includes("sprite")) return "/canteen/fanta.png";
  if (n.includes("milk") || n.includes("amata")) return "/canteen/milk.png";
  if (n.includes("porridge") || n.includes("igikoma")) return "/canteen/porridge.png";
  if (n.includes("mango") || n.includes("embe")) return "/canteen/embe.png";
  if (n.includes("banana") || n.includes("igitoki") || n.includes("umuneke")) return "/canteen/banana.png";
  if (n.includes("avocado") || n.includes("avoka")) return "/canteen/avocado.png";
  if (n.includes("mandazi") || n.includes("amandazi")) return "/canteen/amandazi.png";
  if (n.includes("egg") || n.includes("amagi")) return "/canteen/egg.png";
  if (n.includes("biscuit") || n.includes("maria") || n.includes("cookie")) return "/canteen/maria.png";
  if (n.includes("beans") || n.includes("ibishyimbo")) return "/canteen/rice_beans.png";
  if (n.includes("meat") || n.includes("beef") || n.includes("chicken") || n.includes("rice") || n.includes("meal")) return "/canteen/rice_meat.png";
  if (cat && CAT_PHOTOS[cat]) return CAT_PHOTOS[cat];
  return "/canteen/rice_meat.png";
}

function resolveImg(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
    return base ? `${base}${url}` : url;
  }
  return url;
}

/* ── Add Product Modal ─────────────────────────────────────────── */
function AddProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: import("@/lib/supabase/services").CanteenProductRow) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [name, setName] = useState(""); const [price, setPrice] = useState("");
  const [stock, setStock] = useState(""); const [category, setCategory] = useState("Other");
  const [selectedPreset, setSelectedPreset] = useState("/canteen/sambusa.png");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activePhoto = preview || selectedPreset || foodPhoto(name, category);

  async function submit() {
    const p = parseFloat(price);
    if (!name.trim() || !p || p <= 0) { toast("Name and valid price required", "error"); return; }
    if (!user?.school_id) { toast("No school selected", "error"); return; }
    setSaving(true);
    try {
      const res = await supabaseCanteenService.createProduct(user.school_id, {
        name, price: p, category, photo_url: selectedPreset || foodPhoto(name, category),
        stock_qty: stock.trim() ? parseInt(stock, 10) : null,
      });
      onCreated(res); toast(`${name} added`, "success"); onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-5 space-y-3 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">Add Menu Item</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="flex gap-3 items-center">
          <label className="relative w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 cursor-pointer overflow-hidden flex-shrink-0 bg-gray-50 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activePhoto} alt="preview" className="w-full h-full object-cover" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} />
          </label>
          <div className="grid grid-cols-5 gap-1 flex-1">
            {CANTEEN_PRESETS.map((item) => (
              <button key={item.name} type="button" onClick={() => { setSelectedPreset(item.url); setPreview(null); }} title={item.name}
                className={`aspect-square rounded-lg overflow-hidden border-2 ${selectedPreset === item.url && !preview ? "border-orange-500" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Samosa)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Price (RWF)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
        <input value={stock} onChange={(e) => setStock(e.target.value)} type="number" placeholder="Stock (blank = unlimited)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white">
          {["Snacks","Drinks","Meals","Fruits","Bread","Other"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: "#16A34A" }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? "Saving…" : "Add to Menu"}
        </button>
      </div>
    </div>
  );
}

export default function CanteenPage() {
  const { toast } = useToast();
  const { loading: authLoading, user } = useAuth();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  /* ── Products ──────────────────────────────────────────────── */
  const [apiProducts, setApiProducts] = useState<MenuItem[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    if (!user?.school_id) return;
    supabaseCanteenService.listProducts(user.school_id).then((rows) => {
      setApiProducts(rows.map((p) => ({
        id: p.id, name: p.name, price: p.price,
        img: resolveImg(p.photo_url) || foodPhoto(p.name, p.category),
        cat: p.category, stock_qty: p.stock_qty, fromApi: true,
      })));
      setProductsLoaded(true);
    }).catch(() => setProductsLoaded(true));
  }, [user?.school_id]);

  async function handleDeleteProduct(id: string) {
    if (!user?.school_id) return;
    setDeletingId(id);
    try {
      await supabaseCanteenService.deleteProduct(user.school_id, id);
      setApiProducts((prev) => prev.filter((p) => p.id !== id));
      setCart((c) => { const n = { ...c }; delete n[id]; return n; });
      toast("Removed", "success");
    } catch (err) { toast(err instanceof Error ? err.message : "Delete failed", "error"); }
    finally { setDeletingId(null); }
  }

  /* ── Category + search ─────────────────────────────────────── */
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [failedImgs, setFailedImgs] = useState<Record<string, boolean>>({});

  const visible = apiProducts.filter((m) => {
    const matchCat = activeCategory === "All" || m.cat === activeCategory;
    return matchCat && (!search || m.name.toLowerCase().includes(search.toLowerCase()));
  });

  /* ── Cart ──────────────────────────────────────────────────── */
  const [cart, setCart] = useState<CartMap>({});
  const cartItems = apiProducts.filter((m) => (cart[m.id] ?? 0) > 0).map((m) => ({ ...m, quantity: cart[m.id] }));
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  function inc(id: string) { setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })); }
  function dec(id: string) { setCart((c) => { const n = { ...c }; if ((n[id] ?? 0) <= 1) delete n[id]; else n[id]--; return n; }); }
  function clearCart() { setCart({}); setCardInput(""); setPayResult(null); setShowCart(false); stopListen(); }

  const [showCart, setShowCart] = useState(false);

  /* ── Payment ───────────────────────────────────────────────── */
  const [cardInput, setCardInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [payResult, setPayResult] = useState<PayResult | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const processingRef = useRef(false);

  async function executePurchase(card: ScannedCard) {
    setSubmittingPayment(true);
    if (!user?.school_id) { toast("No school selected", "error"); setSubmittingPayment(false); return; }
    try {
      const items = cartItems.map(({ id, name, price, quantity }) => ({ product_id: id, name, price, qty: quantity }));
      const res = await supabaseCanteenService.purchase(user.school_id, card.card_assignment_id, items, total);
      playTone("success");
      setPayResult({ name: card.student.name, total, balance: res.new_balance });
      setCart({});
      stopListen();
      loadReport();
      toast(`${total.toLocaleString()} RWF · Balance: ${res.new_balance.toLocaleString()} RWF`, "success");
    } catch (err) {
      playTone("error");
      toast(err instanceof Error ? err.message : "Payment failed", "error");
    } finally { setSubmittingPayment(false); processingRef.current = false; }
  }

  async function handlePayment(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current || total === 0) return;
    if (!user?.school_id) { toast("No school selected", "error"); return; }
    processingRef.current = true;
    setScanLoading(true);
    try {
      let holder = isNFC
        ? await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cardNum.trim())
        : await supabaseCanteenService.lookupCardHolder(user.school_id, cardNum.trim());
      if (!holder && !isNFC) holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cardNum.trim()).catch(() => null);
      if (!holder) throw new Error("Card not found");
      if (holder.is_frozen) throw new Error("Card is frozen");
      if (holder.wallet_balance < total) {
        playTone("error");
        toast(`Insufficient — ${(holder.wallet_balance ?? 0).toLocaleString()} RWF available`, "error");
        processingRef.current = false;
        return;
      }
      await executePurchase(toScannedCard(holder));
    } catch (err) {
      playTone("error");
      toast(err instanceof Error ? err.message : "Card scan failed", "error");
      processingRef.current = false;
    } finally { setScanLoading(false); }
  }

  const payHandlerRef = useRef(handlePayment);
  useEffect(() => { payHandlerRef.current = handlePayment; }); // always latest

  // Auto-start NFC when cart has items
  useEffect(() => {
    if (cartCount > 0 && !payResult && isSupported && !listening && !processingRef.current) {
      startListen((r) => {
        if (r.type === "uid") payHandlerRef.current(r.value, true);
        else payHandlerRef.current(r.value, false);
      });
    }
  }, [cartCount, payResult, listening, isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopListen(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Today's sales ─────────────────────────────────────────── */
  const [sales, setSales] = useState<CanteenSaleRow[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState(0);

  const loadReport = useCallback(() => {
    if (!user?.school_id) return;
    setSalesLoading(true);
    supabaseCanteenService.listSales(user.school_id, 50)
      .then((rows) => {
        const today = new Date().toLocaleDateString("en-CA");
        const todayRows = rows.filter((r) => r.created_at.startsWith(today));
        setSales(todayRows);
        setTodayRevenue(todayRows.reduce((s, r) => s + r.total_amount, 0));
      })
      .catch(console.error)
      .finally(() => setSalesLoading(false));
  }, [user?.school_id]);

  useEffect(() => {
    if (!authLoading) { loadReport(); loadProducts(); }
  }, [authLoading, loadReport, loadProducts]);

  const isAdmin = isFinanceRole(user?.role) || user?.role === "CANTEEN";

  /* ── UI ────────────────────────────────────────────────────── */
  return (
    <DashboardShell>
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onCreated={(p) => {
            const img = resolveImg(p.photo_url) || foodPhoto(p.name, p.category);
            setApiProducts((prev) => [...prev, { id: p.id, name: p.name, price: p.price, img, cat: p.category, stock_qty: p.stock_qty, fromApi: true }]);
          }}
        />
      )}

      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Top bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 md:px-4 pt-1 pb-2 flex-shrink-0">
          <h1 className="text-base font-bold flex-1" style={{ color: "#121212" }}>Canteen</h1>
          {isAdmin && (
            <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white" style={{ background: "#16A34A" }}>
              <Plus size={12} /> Add
            </button>
          )}
          <button onClick={() => setShowCart((v) => !v)} className="relative lg:hidden w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: cartCount > 0 ? "#16A34A" : "#e5e5e5" }}>
            <ShoppingCart size={16} style={{ color: cartCount > 0 ? "white" : "#999" }} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{cartCount}</span>
            )}
          </button>
        </div>

        <div className="flex flex-1 gap-2 px-3 md:px-4 pb-3 overflow-hidden min-h-0">

          {/* ── LEFT: Menu ──────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Search */}
            <div className="flex items-center gap-1.5 bg-white rounded-xl px-2.5 py-1.5 mb-2 flex-shrink-0">
              <Search size={13} style={{ color: "#aaa" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="flex-1 text-xs bg-transparent outline-none" style={{ color: "#121212" }} />
              {search && <button onClick={() => setSearch("")}><X size={11} style={{ color: "#aaa" }} /></button>}
            </div>

            {/* Category chips */}
            <div className="flex gap-1.5 mb-2 overflow-x-auto flex-shrink-0 pb-0.5">
              {CATEGORIES.map((cat) => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition"
                  style={activeCategory === cat ? { background: "#16A34A", color: "#fff" } : { background: "#fff", color: "#666" }}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto">
              {productsLoaded && apiProducts.length === 0 && !search && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Utensils size={28} className="text-orange-300" />
                  <div className="text-center">
                    <p className="font-bold text-gray-500 text-sm">No items yet</p>
                    <p className="text-xs text-gray-400 mt-0.5">Add products to start selling</p>
                  </div>
                  {isAdmin && <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-xl text-xs font-semibold"><PackagePlus size={13} /> Add Product</button>}
                </div>
              )}
              {visible.length === 0 && search && (
                <p className="text-center text-gray-400 text-sm py-12">No results for &quot;{search}&quot;</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                {visible.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  return (
                    <div key={item.id} onClick={() => inc(item.id)}
                      className="bg-white rounded-xl p-2.5 flex flex-col gap-1.5 relative cursor-pointer"
                      style={{ border: qty > 0 ? "2px solid #16A34A" : "2px solid transparent" }}>
                      {item.fromApi && isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(item.id); }} disabled={deletingId === item.id}
                          className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center z-10">
                          {deletingId === item.id ? <Loader2 size={8} className="animate-spin text-red-400" /> : <Trash2 size={8} className="text-red-400" />}
                        </button>
                      )}
                      {qty > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center z-10" style={{ background: "#16A34A" }}>{qty}</span>
                      )}
                      <div className="w-full aspect-square rounded-lg overflow-hidden" style={{ background: qty > 0 ? "#DCFCE7" : "#F5F5F5" }}>
                        {failedImgs[item.id] ? (
                          <div className="w-full h-full flex items-center justify-center"><Utensils size={20} style={{ color: "#16A34A" }} /></div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.img || foodPhoto(item.name, item.cat)} alt={item.name}
                            className="w-full h-full object-cover" draggable={false}
                            onError={(e) => {
                              const fb = foodPhoto(item.name, item.cat);
                              if (!e.currentTarget.src.endsWith(fb)) e.currentTarget.src = fb;
                              else setFailedImgs((p) => ({ ...p, [item.id]: true }));
                            }} />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight truncate" style={{ color: "#121212" }}>{item.name}</p>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs font-bold" style={{ color: "#16A34A" }}>{item.price.toLocaleString()}<span className="text-[9px] font-normal text-gray-400 ml-0.5">RWF</span></span>
                          {qty > 0 ? (
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <button onClick={(e) => { e.stopPropagation(); dec(item.id); }} className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ background: "#121212" }}><Minus size={9} /></button>
                              <span className="text-xs font-bold w-4 text-center">{qty}</span>
                              <button onClick={(e) => { e.stopPropagation(); inc(item.id); }} className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ background: "#16A34A" }}><Plus size={9} /></button>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded flex items-center justify-center text-white" style={{ background: "#16A34A" }}><Plus size={10} /></div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isAdmin && (
                  <button onClick={() => setShowAddProduct(true)}
                    className="bg-white rounded-xl p-2.5 flex flex-col items-center justify-center gap-1.5 border-2 border-dashed min-h-[100px]" style={{ borderColor: "#e5e5e5" }}>
                    <Plus size={18} style={{ color: "#ccc" }} />
                    <span className="text-[10px] text-gray-300">Add</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Cart + Pay ─────────────────────────── */}
          <div className={`lg:w-64 lg:flex-shrink-0 flex flex-col bg-white rounded-2xl overflow-hidden ${showCart ? "fixed inset-2 z-50 lg:relative lg:inset-auto" : "hidden lg:flex"}`}>

            {/* Cart header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs font-bold" style={{ color: "#121212" }}>Order · {cartCount}</span>
              <div className="flex items-center gap-2">
                {cartCount > 0 && <button onClick={clearCart} className="text-[11px] text-gray-400 hover:text-red-500">Clear</button>}
                <button onClick={() => setShowCart(false)} className="lg:hidden"><X size={14} className="text-gray-400" /></button>
              </div>
            </div>

            {/* Success state */}
            {payResult && (
              <div className="flex-1 flex flex-col items-center justify-center p-5 text-center gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#f0fdf4" }}>
                  <CheckCircle size={28} className="text-green-500" />
                </div>
                <div>
                  <p className="font-bold text-green-700">Done!</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{payResult.name}</p>
                  <p className="text-xs text-gray-400">{payResult.total.toLocaleString()} RWF charged</p>
                  <p className="text-xs text-green-600 font-semibold mt-0.5">{payResult.balance.toLocaleString()} RWF left</p>
                </div>
                <button onClick={() => { setPayResult(null); setShowCart(false); }}
                  className="w-full py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: "#16A34A" }}>
                  New Order
                </button>
              </div>
            )}

            {/* Cart + pay panel */}
            {!payResult && (
              <>
                {/* Cart items */}
                <div className="flex-1 overflow-y-auto px-2.5 py-2 min-h-0">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-gray-200">
                      <ShoppingCart size={28} className="mb-1.5" />
                      <p className="text-xs">Empty</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: "#F5F5F5" }}>
                          <div className="w-7 h-7 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.img || foodPhoto(item.name, item.cat)} alt={item.name} className="w-full h-full object-cover"
                              onError={(e) => { const fb = foodPhoto(item.name, item.cat); if (e.currentTarget.src !== fb) e.currentTarget.src = fb; }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold truncate" style={{ color: "#121212" }}>{item.name}</p>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => dec(item.id)} className="w-4 h-4 rounded flex items-center justify-center bg-white border border-gray-200"><Minus size={8} /></button>
                            <span className="text-[10px] font-bold w-3.5 text-center">{item.quantity}</span>
                            <button onClick={() => inc(item.id)} className="w-4 h-4 rounded flex items-center justify-center text-white" style={{ background: "#16A34A" }}><Plus size={8} /></button>
                          </div>
                          <span className="text-[11px] font-bold w-12 text-right" style={{ color: "#121212" }}>{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total + pay */}
                <div className="px-3 py-2.5 border-t border-gray-100 flex-shrink-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Total</span>
                    <span className="text-lg font-bold" style={{ color: "#121212" }}>{total.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">RWF</span></span>
                  </div>

                  {cartItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {/* NFC indicator */}
                      <div className="rounded-xl p-2.5 flex flex-col items-center gap-1 border border-dashed" style={{ borderColor: "#16A34A", background: "#f0fdf4" }}>
                        {listening ? (
                          <>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center animate-pulse" style={{ background: "#16A34A" }}>
                              <Wifi size={16} className="text-white" />
                            </div>
                            <p className="text-[11px] font-bold" style={{ color: "#16A34A" }}>Tap card</p>
                            {scanLoading && <Loader2 size={12} className="animate-spin" style={{ color: "#16A34A" } as React.CSSProperties} />}
                          </>
                        ) : (
                          <>
                            <WifiOff size={16} style={{ color: "#aaa" }} />
                            <p className="text-[10px] text-gray-400">Enter card below</p>
                          </>
                        )}
                      </div>

                      {/* Manual entry */}
                      <div className="flex gap-1">
                        <input value={cardInput} onChange={(e) => setCardInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handlePayment(cardInput)}
                          placeholder="Card number…" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-[11px] font-mono" />
                        <button onClick={() => handlePayment(cardInput)} disabled={scanLoading || !cardInput.trim()}
                          className="px-2.5 py-1.5 rounded-lg text-white text-[11px] font-bold disabled:opacity-50" style={{ background: "#121212" }}>
                          {scanLoading ? <Loader2 size={11} className="animate-spin" /> : "Pay"}
                        </button>
                      </div>

                      <div className="flex gap-1">
                        <VirtualCardTap onTap={(cn) => handlePayment(cn)} busy={scanLoading} />
                        <button onClick={clearCart} className="flex-1 py-1.5 rounded-lg text-[11px] text-gray-500 bg-gray-100">Clear</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-2 text-[11px] text-gray-300 gap-1.5" style={{ background: "#F9F9F9", borderRadius: 10 }}>
                      <ShoppingCart size={13} /> Add items
                    </div>
                  )}
                </div>

                {/* Today's sales */}
                <div className="px-3 pb-3 border-t border-gray-100 pt-2.5 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-gray-500">Today</span>
                    {salesLoading
                      ? <Loader2 size={11} className="animate-spin text-gray-300" />
                      : <span className="text-[11px] font-bold" style={{ color: "#16A34A" }}>{todayRevenue.toLocaleString()} RWF</span>
                    }
                  </div>

                  {!salesLoading && sales.length === 0 && (
                    <p className="text-[10px] text-center text-gray-300 py-1">No sales yet</p>
                  )}

                  {!salesLoading && sales.length > 0 && (
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {sales.slice(0, 8).map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold truncate" style={{ color: "#121212" }}>{t.student_name}</p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-red-500 ml-2 flex-shrink-0">-{t.total_amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
