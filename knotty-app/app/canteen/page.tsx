"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, Minus, ShoppingCart, CreditCard, Trash2,
  Wifi, WifiOff, CheckCircle, Loader2, X, Search, ReceiptText, Upload,
  ShieldCheck, Zap, AlertTriangle, UserCheck, PackagePlus,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { canteen, cards, CardScanResult, CanteenItem, CanteenTransaction, CanteenProduct } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

function playAudioTone(type: "success" | "error") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "success") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.24);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (_) {}
}

const CATEGORIES = ["All", "Snacks", "Drinks", "Meals", "Fruits", "Bread", "Other"];

type MenuItem = {
  id: string;
  name: string;
  price: number;
  img: string;
  cat: string;
  stock_qty?: number | null;
  fromApi?: boolean;
};

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

const DEFAULT_CATEGORY_PHOTOS: Record<string, string> = {
  Snacks: "/canteen/sambusa.png",
  Drinks: "/canteen/water.png",
  Meals: "/canteen/rice_meat.png",
  Fruits: "/canteen/banana.png",
  Bread: "/canteen/chapati.png",
  Bakery: "/canteen/chapati.png",
  Other: "/canteen/rice_meat.png",
};

function getRealFoodPhoto(name?: string, category?: string): string {
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
  if (n.includes("egg") || n.includes("igi") || n.includes("amagi")) return "/canteen/egg.png";
  if (n.includes("biscuit") || n.includes("maria") || n.includes("cookie")) return "/canteen/maria.png";
  if (n.includes("beans") || n.includes("ibishyimbo")) return "/canteen/rice_beans.png";
  if (n.includes("meat") || n.includes("beef") || n.includes("chicken") || n.includes("rice") || n.includes("lunch") || n.includes("plate") || n.includes("meal")) return "/canteen/rice_meat.png";
  if (category && DEFAULT_CATEGORY_PHOTOS[category]) return DEFAULT_CATEGORY_PHOTOS[category];
  return "/canteen/rice_meat.png";
}

function resolveImgUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) {
    const backendOrigin = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "");
    return backendOrigin ? `${backendOrigin}${url}` : url;
  }
  return url;
}

const MENU_ITEMS: MenuItem[] = [
  { id: "amandazi",    name: "Amandazi",      price: 200,  img: "/canteen/amandazi.png",   cat: "Snacks", stock_qty: null },
  { id: "sambusa",     name: "Sambusa",        price: 300,  img: "/canteen/sambusa.png",    cat: "Snacks", stock_qty: null },
  { id: "egg",         name: "Boiled Egg",     price: 200,  img: "/canteen/egg.png",        cat: "Snacks", stock_qty: null },
  { id: "maria",       name: "Bolacha Maria",  price: 300,  img: "/canteen/maria.png",      cat: "Snacks", stock_qty: null },
  { id: "inyange",     name: "Inyange Juice",  price: 500,  img: "/canteen/inyange.png",    cat: "Drinks", stock_qty: null },
  { id: "fanta",       name: "Fanta",          price: 600,  img: "/canteen/fanta.png",      cat: "Drinks", stock_qty: null },
  { id: "milk",        name: "Milk",           price: 400,  img: "/canteen/milk.png",       cat: "Drinks", stock_qty: null },
  { id: "water",       name: "Water",          price: 200,  img: "/canteen/water.png",      cat: "Drinks", stock_qty: null },
  { id: "rice_beans",  name: "Rice & Beans",   price: 1500, img: "/canteen/rice_beans.png", cat: "Meals",  stock_qty: null },
  { id: "rice_meat",   name: "Rice & Meat",    price: 2000, img: "/canteen/rice_meat.png",  cat: "Meals",  stock_qty: null },
  { id: "porridge",    name: "Porridge",       price: 500,  img: "/canteen/porridge.png",   cat: "Meals",  stock_qty: null },
  { id: "embe",        name: "Embe (Mango)",   price: 300,  img: "/canteen/embe.png",       cat: "Fruits", stock_qty: null },
  { id: "banana",      name: "Banana",         price: 150,  img: "/canteen/banana.png",     cat: "Fruits", stock_qty: null },
  { id: "avocado",     name: "Avocado",        price: 300,  img: "/canteen/avocado.png",    cat: "Fruits", stock_qty: null },
  { id: "chapati",     name: "Chapati",        price: 300,  img: "/canteen/chapati.png",    cat: "Bread",  stock_qty: null },
  { id: "mandazi_big", name: "Mandazi (Big)",  price: 300,  img: "/canteen/amandazi.png",   cat: "Bread",  stock_qty: null },
];
type CartMap = Record<string, number>;
type PayResult = { student: CardScanResult["student"]; total: number; new_balance: number };

/* ── Add Product Modal ─────────────────────────────────────────── */
function AddProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: CanteenProduct) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState("Other");
  const [photo, setPhoto] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>("/canteen/sambusa.png");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function submit() {
    const p = parseFloat(price);
    if (!name.trim() || !p || p <= 0) { toast("Name and valid price required", "error"); return; }
    const parsedStock = stock.trim() ? parseInt(stock.trim(), 10) : null;
    setSaving(true);
    try {
      const chosenPhotoUrl = photo ? undefined : (selectedPreset || getRealFoodPhoto(name, category));
      const res = await canteen.createProduct({
        name,
        price: p,
        category,
        photo,
        photo_url: chosenPhotoUrl,
        stock_qty: parsedStock,
      });
      onCreated(res.data);
      toast(`${name} added to menu`, "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setSaving(false);
    }
  }

  const activePhoto = preview || selectedPreset || getRealFoodPhoto(name, category);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">Add Menu Item</h3>
            <p className="text-xs text-gray-400">All items use authentic food photography</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {/* Real Food Photo Selector & Upload */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-700 block">Food Photo</label>
          <div className="flex gap-3 items-center">
            {/* Live photo preview box */}
            <label className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-400 transition cursor-pointer overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activePhoto}
                alt="preview"
                className="w-full h-full object-cover rounded-2xl"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-[10px] font-semibold">
                Change
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-800 font-medium">Real Food Photo</p>
              <p className="text-[11px] text-gray-400 mb-1.5">Pick a preset below or upload custom image</p>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition cursor-pointer">
                <Upload size={12} />
                <span>Upload Custom</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>
            </div>
          </div>

          {/* Quick preset photo chooser */}
          <div>
            <span className="text-[11px] text-gray-500 font-medium block mb-1">Quick Photo Presets:</span>
            <div className="grid grid-cols-5 gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-gray-50 rounded-2xl border border-gray-100">
              {CANTEEN_PRESETS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(item.url);
                    setPreview(null);
                    setPhoto(null);
                  }}
                  title={item.name}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition relative ${(selectedPreset === item.url && !preview) ? "border-orange-500 ring-2 ring-orange-200" : "border-transparent hover:border-gray-300"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name (e.g. Samosa, Fanta, Rice)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400" />

        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Price (RWF)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400" />

        <input
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          type="number"
          placeholder="Initial stock (e.g. 50, or leave blank for unlimited)"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400"
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 bg-white">
          {["Snacks", "Drinks", "Meals", "Fruits", "Bread", "Other"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button onClick={submit} disabled={saving}
          className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-sm"
          style={{ background: "#FF7A22" }}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {saving ? "Saving…" : "Add to Menu"}
        </button>
      </div>
    </div>
  );
}

/* ── Restock Modal ─────────────────────────────────────────────── */
function RestockModal({
  product,
  onClose,
  onUpdated,
}: {
  product: MenuItem;
  onClose: () => void;
  onUpdated: (p: CanteenProduct) => void;
}) {
  const { toast } = useToast();
  const [qty, setQty] = useState("20");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const q = parseInt(qty, 10);
    if (!q || q <= 0) {
      toast("Please enter a valid positive quantity", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await canteen.restockProduct(product.id, q);
      onUpdated(res.data);
      toast(`Added +${q} to ${product.name} stock`, "success");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to restock", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xs p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">Restock {product.name}</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500">
          Current stock: <strong className="text-gray-800">{product.stock_qty !== null && product.stock_qty !== undefined ? `${product.stock_qty} units` : "Unlimited"}</strong>
        </p>
        <div className="flex gap-2">
          {[10, 25, 50, 100].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setQty(String(preset))}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                qty === String(preset)
                  ? "bg-orange-50 border-orange-400 text-orange-600"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              +{preset}
            </button>
          ))}
        </div>
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          type="number"
          placeholder="Quantity to add"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 text-center font-bold"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="w-full py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center gap-1.5 transition"
          style={{ background: "#FF7A22" }}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <PackagePlus size={14} />}
          {saving ? "Restocking…" : "Add to Stock"}
        </button>
      </div>
    </div>
  );
}

export default function CanteenPage() {
  const { toast } = useToast();
  const { loading: authLoading, user } = useAuth();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  /* ── Products from API ─────────────────────────────────────── */
  const [apiProducts, setApiProducts] = useState<MenuItem[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadProducts = useCallback(() => {
    canteen.listProducts().then((r) => {
      setApiProducts(r.data.map((p) => {
        const photo = resolveImgUrl(p.photo_url) || getRealFoodPhoto(p.name, p.category);
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          img: photo,
          cat: p.category,
          stock_qty: p.stock_qty,
          fromApi: true,
        };
      }));
    }).catch(() => {});
  }, []);

  async function handleDeleteProduct(id: string) {
    setDeletingId(id);
    try {
      await canteen.deleteProduct(id);
      setApiProducts((prev) => prev.filter((p) => p.id !== id));
      setCart((c) => { const next = { ...c }; delete next[id]; return next; });
      toast("Product removed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Category + search ─────────────────────────────────────── */
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const allMenu: MenuItem[] = [...MENU_ITEMS, ...apiProducts];

  const visible = allMenu.filter((m) => {
    const matchCat = activeCategory === "All" || m.cat === activeCategory;
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  /* ── Cart ──────────────────────────────────────────────────── */
  const [cart, setCart] = useState<CartMap>({});
  const cartItems = allMenu
    .filter((m) => (cart[m.id] ?? 0) > 0)
    .map((m) => ({ ...m, quantity: cart[m.id] }));
  const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  function inc(id: string) { setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })); }
  function dec(id: string) {
    setCart((c) => {
      const next = { ...c };
      if ((next[id] ?? 0) <= 1) delete next[id]; else next[id]--;
      return next;
    });
  }
  function clearCart() {
    setCart({}); setCardInput(""); setPayResult(null); setShowCart(false);
    if (listening) stopListen();
  }

  /* ── Cart panel toggle (mobile) ────────────────────────────── */
  const [showCart, setShowCart] = useState(false);

  /* ── Payment ───────────────────────────────────────────────── */
  const [paying, setPaying]       = useState(false);
  const [cardInput, setCardInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [payResult, setPayResult] = useState<PayResult | null>(null);
  const [scannedCard, setScannedCard] = useState<CardScanResult | null>(null);
  const [fastMode, setFastMode] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [studentPhotoError, setStudentPhotoError] = useState(false);
  const [payPhotoError, setPayPhotoError] = useState(false);
  const processingRef = useRef(false);

  async function executePurchase(cardNumber: string, studentInfo: CardScanResult["student"]) {
    setSubmittingPayment(true);
    try {
      const items: CanteenItem[] = cartItems.map(({ name, price, quantity }) => ({ name, price, quantity }));
      const res = await canteen.purchase(cardNumber, items);
      playAudioTone("success");
      setPayPhotoError(false);
      setPayResult({ student: studentInfo, total, new_balance: res.new_balance });
      setScannedCard(null);
      setCart({});
      setPaying(false);
      loadReport();
      toast(`Paid ${total.toLocaleString()} RWF · Balance: ${res.new_balance.toLocaleString()} RWF`, "success");
    } catch (err) {
      playAudioTone("error");
      toast(err instanceof Error ? err.message : "Payment failed", "error");
    } finally {
      setSubmittingPayment(false);
      processingRef.current = false;
    }
  }

  async function handlePayment(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current || total === 0) return;
    processingRef.current = true;
    setScanLoading(true);
    try {
      const scanRes = isNFC
        ? await cards.scanNFC(cardNum)
        : await cards.scan(cardNum.trim());
      const balance = scanRes.data.wallet_balance;
      if (balance < total) {
        playAudioTone("error");
        toast(`Insufficient — ${balance.toLocaleString()} RWF available, need ${total.toLocaleString()} RWF`, "error");
        processingRef.current = false;
        return;
      }
      if (scanRes.data.daily_limit && total > scanRes.data.daily_limit) {
        playAudioTone("error");
        toast(`Order exceeds daily limit of ${scanRes.data.daily_limit.toLocaleString()} RWF`, "error");
        processingRef.current = false;
        return;
      }
      stopListen();
      if (fastMode) {
        await executePurchase(scanRes.data.card_number, scanRes.data.student);
      } else {
        setStudentPhotoError(false);
        setScannedCard(scanRes.data);
      }
    } catch (err) {
      playAudioTone("error");
      toast(err instanceof Error ? err.message : "Card scan failed", "error");
      processingRef.current = false;
    } finally {
      setScanLoading(false);
    }
  }

  // Keep a ref to the latest handlePayment so the NFC callback is never stale
  const payHandlerRef = useRef(handlePayment);
  payHandlerRef.current = handlePayment;

  function startPaying() {
    if (total === 0) return;
    setPaying(true); setPayResult(null); setScannedCard(null);
    if (isSupported) {
      // Use payHandlerRef so the NFC callback always sees the up-to-date cart/total
      startListen((result) => {
        if (result.type === "uid") payHandlerRef.current(result.value, true);
        else payHandlerRef.current(result.value, false);
      });
    }
  }

  function cancelPay() {
    setPaying(false);
    setCardInput("");
    setScannedCard(null);
    processingRef.current = false;
    if (listening) stopListen();
  }

  /* ── Daily report ──────────────────────────────────────────── */
  const [report, setReport] = useState<{
    transactions: CanteenTransaction[];
    total_revenue: number;
    transaction_count: number;
    items_summary?: { name: string; quantity: number; revenue: number }[];
  } | null>(null);
  const [reportLoading, setReportLoading] = useState(true);

  const loadReport = useCallback(() => {
    setReportLoading(true);
    canteen.dailyReport()
      .then((r) => setReport(r as typeof report))
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadReport();
      loadProducts();
    }
  }, [authLoading, loadReport, loadProducts]);

  /* ── UI ────────────────────────────────────────────────────── */
  return (
    <DashboardShell>
      {showAddProduct && (
        <AddProductModal
          onClose={() => setShowAddProduct(false)}
          onCreated={(p) => {
            const photo = resolveImgUrl(p.photo_url) || getRealFoodPhoto(p.name, p.category);
            setApiProducts((prev) => [...prev, {
              id: p.id,
              name: p.name,
              price: p.price,
              img: photo,
              cat: p.category,
              stock_qty: p.stock_qty,
              fromApi: true,
            }]);
          }}
        />
      )}

      {/* ── Student Verification Modal ── */}
      {scannedCard && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <ShieldCheck size={16} />
                <span>Verify Student Identity</span>
              </div>
              <button
                onClick={() => { setScannedCard(null); processingRef.current = false; }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col items-center text-center pt-1">
              <div className="relative mb-3">
                {scannedCard.student.photo && !studentPhotoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImgUrl(scannedCard.student.photo)!}
                    alt={scannedCard.student.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-orange-100 shadow-md"
                    onError={() => setStudentPhotoError(true)}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-2xl font-bold border-4 border-orange-50 shadow-md">
                    {scannedCard.student.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px]">
                  ✓
                </span>
              </div>

              <h4 className="font-bold text-gray-900 text-base">{scannedCard.student.name}</h4>
              <p className="text-xs text-gray-500 font-medium">{scannedCard.student.class} · {scannedCard.student.student_code}</p>
            </div>

            <div className="rounded-2xl p-3.5 space-y-2 bg-gray-50 text-xs">
              <div className="flex justify-between items-center text-gray-500">
                <span>Current Balance</span>
                <span className="font-semibold text-gray-700">{scannedCard.wallet_balance.toLocaleString()} RWF</span>
              </div>
              <div className="flex justify-between items-center text-orange-600 font-bold">
                <span>Charge Amount</span>
                <span>-{total.toLocaleString()} RWF</span>
              </div>
              <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center">
                <span className="font-medium text-gray-600">Balance After</span>
                <span className="font-bold text-green-700">{(scannedCard.wallet_balance - total).toLocaleString()} RWF</span>
              </div>
              {scannedCard.daily_limit && (
                <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center text-[11px] text-amber-700">
                  <span>Daily Limit</span>
                  <span>{scannedCard.daily_limit.toLocaleString()} RWF</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setScannedCard(null); processingRef.current = false; }}
                disabled={submittingPayment}
                className="flex-1 py-3 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => executePurchase(scannedCard.card_number, scannedCard.student)}
                disabled={submittingPayment}
                className="flex-2 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition shadow-sm"
                style={{ background: "#FF7A22" }}
              >
                {submittingPayment ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                {submittingPayment ? "Processing..." : `Charge ${total.toLocaleString()} RWF`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Top bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "#121212" }}>Canteen POS</h1>
            <p className="text-xs" style={{ color: "#666666" }}>Select items → student taps to pay</p>
          </div>

          {/* Fast Tap vs Verify Photo toggle */}
          <button
            onClick={() => setFastMode((v) => !v)}
            title={fastMode ? "Fast Mode: Instant charge on tap" : "Verify Mode: Cashier verifies student photo before charge"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition border ${
              fastMode
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-emerald-50 border-emerald-300 text-emerald-700"
            }`}
          >
            {fastMode ? <Zap size={13} className="text-amber-600" /> : <ShieldCheck size={13} className="text-emerald-600" />}
            <span>{fastMode ? "Fast Tap" : "Verify Photo"}</span>
          </button>

          {(user?.role === "ADMIN" || user?.role === "CANTEEN") && (
            <button
              onClick={() => setShowAddProduct(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: "#FF7A22" }}
            >
              <Plus size={13} /> Add Product
            </button>
          )}
          {/* Cart badge (mobile) */}
          <button
            onClick={() => setShowCart((v) => !v)}
            className="relative lg:hidden w-10 h-10 rounded-2xl flex items-center justify-center text-white"
            style={{ background: cartCount > 0 ? "#FF7A22" : "#e5e5e5" }}
          >
            <ShoppingCart size={18} style={{ color: cartCount > 0 ? "white" : "#999" }} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-1 gap-3 px-3 md:px-4 pb-3 md:pb-4 overflow-hidden min-h-0">

          {/* ── LEFT: Menu ──────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Search bar */}
            <div className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 mb-3 flex-shrink-0">
              <Search size={15} style={{ color: "#999" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items…"
                className="flex-1 text-sm bg-transparent outline-none"
                style={{ color: "#121212" }}
              />
              {search && <button onClick={() => setSearch("")}><X size={13} style={{ color: "#999" }} /></button>}
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 mb-3 overflow-x-auto flex-shrink-0 pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex-shrink-0"
                  style={activeCategory === cat
                    ? { background: "#FF7A22", color: "#fff" }
                    : { background: "#fff", color: "#666666" }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu grid */}
            <div className="flex-1 overflow-y-auto">
              {visible.length === 0 && search && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="font-semibold text-gray-400 text-sm">No items match &quot;{search}&quot;</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {visible.map((item) => {
                  const qty = cart[item.id] ?? 0;
                  const isAdmin = user?.role === "ADMIN" || user?.role === "CANTEEN";
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl p-3 flex flex-col gap-2 relative cursor-pointer transition"
                      style={{ border: qty > 0 ? "2px solid #FF7A22" : "2px solid transparent" }}
                      onClick={() => inc(item.id)}
                    >
                      {/* Delete button (API products only, admin/canteen) */}
                      {item.fromApi && isAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProduct(item.id); }}
                          disabled={deletingId === item.id}
                          className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-50 border border-red-100 flex items-center justify-center z-10 hover:bg-red-100 transition"
                        >
                          {deletingId === item.id ? <Loader2 size={10} className="animate-spin text-red-400" /> : <Trash2 size={9} className="text-red-400" />}
                        </button>
                      )}
                      {/* Qty badge */}
                      {qty > 0 && (
                        <span
                          className="absolute top-2 right-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center z-10"
                          style={{ background: "#FF7A22" }}
                        >
                          {qty}
                        </span>
                      )}
                      {/* Item image hero */}
                      <div
                        className="w-full aspect-square rounded-xl flex items-center justify-center overflow-hidden relative bg-gray-100 group"
                        style={{ background: qty > 0 ? "#FFF3EC" : "#F5F5F5" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.img || getRealFoodPhoto(item.name, item.cat)}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-xl transition duration-200 group-hover:scale-105"
                          draggable={false}
                          onError={(e) => {
                            const fallback = getRealFoodPhoto(item.name, item.cat);
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight" style={{ color: "#121212" }}>{item.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold" style={{ color: "#FF7A22" }}>
                            {item.price.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">RWF</span>
                          </span>
                          {qty > 0 ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); dec(item.id); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                style={{ background: "#121212" }}
                              >
                                <Minus size={10} />
                              </button>
                              <span className="text-xs font-bold w-4 text-center">{qty}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); inc(item.id); }}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                                style={{ background: "#FF7A22" }}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          ) : (
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
                              style={{ background: "#FF7A22" }}
                            >
                              <Plus size={12} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add product card (admin/canteen only) */}
                {(user?.role === "ADMIN" || user?.role === "CANTEEN") && (
                  <button
                    onClick={() => setShowAddProduct(true)}
                    className="bg-white rounded-2xl p-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed hover:border-orange-300 transition min-h-[120px]"
                    style={{ borderColor: "#e5e5e5" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FFF3EC" }}>
                      <Plus size={20} style={{ color: "#FF7A22" }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-400">Add Product</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Cart + Pay ──────────────────────────────────
              Desktop: always visible. Mobile: slide-over panel.    */}
          <div className={`
            lg:w-80 lg:flex-shrink-0 flex flex-col bg-white rounded-3xl overflow-hidden
            ${showCart
              ? "fixed inset-3 z-50 lg:relative lg:inset-auto"
              : "hidden lg:flex"
            }
          `}>
            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={16} style={{ color: "#FF7A22" }} />
                <h3 className="font-bold text-sm" style={{ color: "#121212" }}>
                  Order ({cartCount} item{cartCount !== 1 ? "s" : ""})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {cartCount > 0 && (
                  <button onClick={clearCart} className="text-xs text-gray-400 hover:text-red-500 transition">Clear</button>
                )}
                <button onClick={() => setShowCart(false)} className="lg:hidden p-1 text-gray-400">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Success state */}
            {payResult && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-3">
                  {payResult.student.photo && !payPhotoError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImgUrl(payResult.student.photo)!}
                      alt={payResult.student.name}
                      className="w-20 h-20 rounded-full object-cover border-4 border-green-200 shadow-md"
                      onError={() => setPayPhotoError(true)}
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#f0fdf4" }}>
                      <CheckCircle size={32} className="text-green-500" />
                    </div>
                  )}
                  {payResult.student.photo && !payPhotoError && (
                    <span className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="font-bold text-green-700 text-lg mb-1">Payment Done!</p>
                <p className="text-sm font-medium" style={{ color: "#121212" }}>{payResult.student.name}</p>
                <p className="text-xs text-gray-400 mb-4">{payResult.student.class}</p>
                <div className="w-full grid grid-cols-2 gap-2 mb-4">
                  <div className="rounded-2xl p-3 text-center" style={{ background: "#F5F5F5" }}>
                    <p className="text-xs text-gray-400">Charged</p>
                    <p className="font-bold text-sm" style={{ color: "#121212" }}>{payResult.total.toLocaleString()} RWF</p>
                  </div>
                  <div className="rounded-2xl p-3 text-center" style={{ background: "#FFF3EC" }}>
                    <p className="text-xs text-gray-400">Remaining</p>
                    <p className="font-bold text-sm" style={{ color: "#FF7A22" }}>{payResult.new_balance.toLocaleString()} RWF</p>
                  </div>
                </div>
                <button
                  onClick={() => { setPayResult(null); setShowCart(false); }}
                  className="w-full py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: "#FF7A22" }}
                >
                  New Order
                </button>
              </div>
            )}

            {/* Cart items */}
            {!payResult && (
              <>
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {cartItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-gray-300">
                      <ShoppingCart size={36} className="mb-2" />
                      <p className="text-sm">No items yet</p>
                      <p className="text-xs mt-1">Tap items on the left to add</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl" style={{ background: "#F5F5F5" }}>
                          <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.img || getRealFoodPhoto(item.name, item.cat)}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const fallback = getRealFoodPhoto(item.name, item.cat);
                                if (e.currentTarget.src !== fallback) {
                                  e.currentTarget.src = fallback;
                                }
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: "#121212" }}>{item.name}</p>
                            <p className="text-xs" style={{ color: "#FF7A22" }}>{item.price.toLocaleString()} RWF</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => dec(item.id)}
                              className="w-5 h-5 rounded-lg flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50">
                              <Minus size={9} />
                            </button>
                            <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                            <button onClick={() => inc(item.id)}
                              className="w-5 h-5 rounded-lg flex items-center justify-center text-white"
                              style={{ background: "#FF7A22" }}>
                              <Plus size={9} />
                            </button>
                          </div>
                          <span className="text-xs font-bold w-16 text-right flex-shrink-0" style={{ color: "#121212" }}>
                            {(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total + pay */}
                <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "#666666" }}>Total Amount</span>
                    <span className="text-xl font-bold" style={{ color: "#121212" }}>
                      {total.toLocaleString()} <span className="text-xs font-normal text-gray-400">RWF</span>
                    </span>
                  </div>

                  {/* Payment UI */}
                  {!paying ? (
                    <button
                      onClick={startPaying}
                      disabled={cartItems.length === 0}
                      className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition"
                      style={{ background: "#FF7A22" }}
                    >
                      <CreditCard size={16} />
                      Student Tap to Pay
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* NFC waiting indicator */}
                      <div
                        className="rounded-2xl p-3 flex flex-col items-center gap-2 border-2 border-dashed"
                        style={{ borderColor: "#FF7A22", background: "#FFF3EC" }}
                      >
                        {listening ? (
                          <>
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center animate-pulse"
                              style={{ background: "#FF7A22" }}
                            >
                              <Wifi size={20} className="text-white" />
                            </div>
                            <p className="text-xs font-bold text-center" style={{ color: "#FF7A22" }}>
                              Waiting for card tap…
                            </p>
                            <p className="text-[11px] text-center text-gray-400">
                              Student bring phone or NFC card close to this device
                            </p>
                            {scanLoading && <Loader2 size={16} className="animate-spin" style={{ color: "#FF7A22" } as React.CSSProperties} />}
                          </>
                        ) : (
                          <>
                            <WifiOff size={20} style={{ color: "#999" }} />
                            <p className="text-xs text-gray-400 text-center">NFC not available — use card number</p>
                          </>
                        )}
                      </div>

                      {/* Manual entry + virtual tap */}
                      <div className="flex gap-1.5">
                        <input
                          value={cardInput}
                          onChange={(e) => setCardInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handlePayment(cardInput)}
                          placeholder="Card number…"
                          className="flex-1 border border-gray-200 rounded-xl px-2.5 py-2 text-xs font-mono"
                        />
                        <button
                          onClick={() => handlePayment(cardInput)}
                          disabled={scanLoading || !cardInput.trim()}
                          className="px-3 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-60"
                          style={{ background: "#121212" }}
                        >
                          {scanLoading ? <Loader2 size={12} className="animate-spin" /> : "Pay"}
                        </button>
                      </div>

                      <div className="flex gap-1.5">
                        <VirtualCardTap onTap={(cn) => handlePayment(cn)} busy={scanLoading} />
                        <button
                          onClick={cancelPay}
                          className="flex-1 py-2 rounded-xl text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Today's sales summary (compact) */}
                <div className="px-4 pb-3 border-t border-gray-100 pt-3 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <ReceiptText size={12} style={{ color: "#FF7A22" }} />
                      <span className="text-xs font-semibold" style={{ color: "#121212" }}>Today&apos;s Sales</span>
                    </div>
                    {reportLoading
                      ? <Loader2 size={12} className="animate-spin text-gray-300" />
                      : report && (
                        <span className="text-xs font-bold" style={{ color: "#FF7A22" }}>
                          {report.total_revenue.toLocaleString()} RWF
                        </span>
                      )}
                  </div>

                  {!reportLoading && report && report.transaction_count === 0 && (
                    <p className="text-xs text-center text-gray-300 py-2">No sales yet today</p>
                  )}

                  {/* Items sold breakdown */}
                  {!reportLoading && report && report.items_summary && report.items_summary.length > 0 && (
                    <div className="mb-2 rounded-xl overflow-hidden" style={{ background: "#F5F5F5" }}>
                      <p className="text-[10px] font-semibold px-2 pt-1.5 pb-1" style={{ color: "#666" }}>ITEMS SOLD TODAY</p>
                      <div className="max-h-24 overflow-y-auto px-2 pb-1.5 space-y-1">
                        {report.items_summary.map((item) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <span className="text-xs truncate" style={{ color: "#121212" }}>
                              {item.name} <span className="text-gray-400">×{item.quantity}</span>
                            </span>
                            <span className="text-xs font-semibold ml-2 flex-shrink-0" style={{ color: "#FF7A22" }}>
                              {item.revenue.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-student transactions */}
                  {!reportLoading && report && report.transactions.length > 0 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {report.transactions.slice(0, 6).map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-0.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate" style={{ color: "#121212" }}>
                              {t.student?.user?.first_name} {t.student?.user?.last_name}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {new Date(t.transaction_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-red-500 ml-2">
                            -{t.total_amount.toLocaleString()}
                          </span>
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
