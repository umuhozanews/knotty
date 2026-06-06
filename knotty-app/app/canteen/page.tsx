"use client";
import { useEffect, useState, useRef } from "react";
import { Loader2, Plus, Minus, ShoppingCart, CreditCard, Trash2, Wifi, WifiOff, Radio, StopCircle, CheckCircle } from "lucide-react";
import VirtualCardTap from "@/components/VirtualCardTap";
import DashboardShell from "@/components/DashboardShell";
import { canteen, cards, CardScanResult, CanteenItem, CanteenTransaction } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

interface CartItem extends CanteenItem { id: string }

export default function CanteenPage() {
  const { toast } = useToast();
  const { loading: authLoading } = useAuth();
  const { scan, startListen, stopListen, listening, scanning, isSupported } = useNFC();

  const [cardInput, setCardInput] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanned, setScanned] = useState<CardScanResult | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [lastPurchase, setLastPurchase] = useState<{ new_balance: number; total: number } | null>(null);
  const [report, setReport] = useState<{ transactions: CanteenTransaction[]; total_revenue: number; transaction_count: number } | null>(null);
  const [reportLoading, setReportLoading] = useState(true);

  // NFC continuous mode
  const [nfcMode, setNfcMode] = useState(false);
  const processingRef = useRef(false);

  function loadReport() {
    setReportLoading(true);
    canteen.dailyReport()
      .then((r) => setReport(r as { transactions: CanteenTransaction[]; total_revenue: number; transaction_count: number }))
      .catch(console.error)
      .finally(() => setReportLoading(false));
  }

  useEffect(() => { if (!authLoading) loadReport(); }, [authLoading]);

  async function processCardNumber(cardNum: string) {
    if (!cardNum.trim() || processingRef.current) return;
    processingRef.current = true;
    setScanLoading(true);
    setLastPurchase(null);
    try {
      const res = await cards.scan(cardNum.trim());
      setScanned(res.data);
      setCart([]);
      setCardInput("");
      toast(`${res.data.student.name} — ${res.data.wallet_balance.toLocaleString()} RWF balance`, "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Card not found", "error");
    } finally {
      setScanLoading(false);
      processingRef.current = false;
    }
  }

  async function processNFCCard(nfcUid: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    setScanLoading(true);
    setLastPurchase(null);
    try {
      const res = await cards.scanNFC(nfcUid);
      setScanned(res.data);
      setCart([]);
      toast(`${res.data.student.name} — ${res.data.wallet_balance.toLocaleString()} RWF balance`, "info");
    } catch (err) {
      toast(err instanceof Error ? err.message : "NFC tag not linked to any card", "error");
    } finally {
      setScanLoading(false);
      processingRef.current = false;
    }
  }

  async function toggleNFCListen() {
    if (listening) {
      stopListen();
      setNfcMode(false);
      toast("NFC scanner stopped", "info");
      return;
    }
    const ok = await startListen((result) => {
      const val = result.value;
      if (result.type === "uid") processNFCCard(val);
      else processCardNumber(val);
    });
    if (ok) { setNfcMode(true); toast("NFC active — tap a student card", "info"); }
  }

  async function handleNFCOneTap() {
    const result = await scan();
    if (!result) return;
    if (result.type === "uid") await processNFCCard(result.value);
    else await processCardNumber(result.value);
  }

  function addItem() {
    if (!itemName.trim() || !itemPrice || parseFloat(itemPrice) <= 0) return;
    setCart((c) => [...c, { id: Date.now().toString(), name: itemName.trim(), price: parseFloat(itemPrice), quantity: 1 }]);
    setItemName(""); setItemPrice("");
  }

  function updateQty(id: string, delta: number) {
    setCart((c) => c.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter((i) => i.quantity > 0));
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  async function processPurchase() {
    if (!scanned || cart.length === 0) return;
    setPurchasing(true);
    try {
      const res = await canteen.purchase(scanned.card_number, cart.map(({ name, price, quantity }) => ({ name, price, quantity })));
      setLastPurchase({ new_balance: res.new_balance, total });
      setScanned({ ...scanned, wallet_balance: res.new_balance });
      setCart([]);
      loadReport();
      toast(`Charged ${total.toLocaleString()} RWF · New balance: ${res.new_balance.toLocaleString()} RWF`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Purchase failed", "error");
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <DashboardShell>
      <div className="p-4 grid grid-cols-2 gap-4 h-[calc(100vh-120px)]">
        {/* LEFT: POS */}
        <div className="space-y-3 overflow-y-auto">
          <h1 className="text-xl font-bold text-gray-800">Canteen POS</h1>

          {/* Scan card */}
          <div className={`bg-white rounded-2xl p-4 shadow-sm space-y-3 ${nfcMode ? "border-2 border-blue-500" : ""}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Scan Student Card</h3>
              <div className="flex items-center gap-2">
                {nfcMode && (
                  <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />NFC Active
                  </span>
                )}
                <VirtualCardTap onTap={processCardNumber} busy={scanLoading} />
              </div>
            </div>

            {isSupported && (
              <button
                onClick={toggleNFCListen}
                className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 transition text-sm font-medium ${nfcMode ? "bg-red-50 text-red-500 border border-red-200 hover:bg-red-100" : listening ? "bg-blue-50 text-blue-600 border-2 border-dashed border-blue-500" : "bg-blue-600 text-white hover:bg-blue-700"}`}
              >
                {listening ? <><Loader2 className="animate-spin" size={16} />Hold NFC card to phone…</> :
                 nfcMode ? <><StopCircle size={16} />Stop NFC Scanner</> :
                 <><Radio size={16} />Start NFC Continuous Scan</>}
              </button>
            )}

            {!isSupported && (
              <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl text-xs text-gray-400">
                <WifiOff size={14} />NFC not available — use manual entry below
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={cardInput}
                onChange={(e) => setCardInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && processCardNumber(cardInput)}
                placeholder="Card number or scan barcode…"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
              />
              <button
                onClick={() => processCardNumber(cardInput)}
                disabled={scanLoading || !cardInput.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {scanLoading ? <Loader2 size={14} className="animate-spin" /> : "Scan"}
              </button>
            </div>
          </div>

          {/* Student info */}
          {scanned && (
            <div className={`bg-white rounded-2xl p-4 shadow-sm transition-all ${lastPurchase ? "border-2 border-green-300" : ""}`}>
              <div className="flex items-center gap-3 mb-3">
                {scanned.student.photo
                  ? <img src={scanned.student.photo} className="w-12 h-12 rounded-full object-cover" alt="" />
                  : <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">{scanned.student.name.slice(0, 2).toUpperCase()}</div>
                }
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{scanned.student.name}</p>
                  <p className="text-xs text-gray-400">{scanned.student.class} · {scanned.student.student_code}</p>
                  {scanned.today_attendance && (
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block ${scanned.today_attendance === "PRESENT" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"}`}>
                      {scanned.today_attendance}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Balance</p>
                  <p className={`text-xl font-bold ${scanned.wallet_balance < 1000 ? "text-red-500" : "text-blue-600"}`}>
                    {scanned.wallet_balance.toLocaleString()}
                    <span className="text-xs font-normal ml-1">RWF</span>
                  </p>
                  {scanned.wallet_balance < 1000 && <p className="text-xs text-red-400">Low balance</p>}
                </div>
              </div>

              {lastPurchase && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm text-green-700 mb-2">
                  <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  <span>Charged <strong>{lastPurchase.total.toLocaleString()} RWF</strong> · New balance: <strong>{lastPurchase.new_balance.toLocaleString()} RWF</strong></span>
                </div>
              )}
            </div>
          )}

          {/* Cart */}
          {scanned && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><ShoppingCart size={15} />Cart</h3>

              <div className="flex gap-2 mb-3">
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="Item name (e.g. Rice)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addItem()}
                  placeholder="Price"
                  className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button onClick={addItem} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                  <Plus size={16} />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Add items to charge</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                      <span className="flex-1 text-sm text-gray-700">{item.name}</span>
                      <span className="text-xs text-gray-400">{item.price.toLocaleString()} RWF</span>
                      <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Minus size={11} /></button>
                      <span className="text-sm font-medium w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center hover:bg-gray-300"><Plus size={11} /></button>
                      <button onClick={() => setCart((c) => c.filter((i) => i.id !== item.id))} className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100">
                        <Trash2 size={11} className="text-red-400" />
                      </button>
                      <span className="text-sm font-semibold text-gray-700 w-16 text-right">{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-800">{total.toLocaleString()} <span className="text-sm font-normal text-gray-400">RWF</span></p>
                  {total > 0 && scanned.wallet_balance < total && (
                    <p className="text-xs text-red-500 font-medium">Insufficient balance — {(total - scanned.wallet_balance).toLocaleString()} RWF short</p>
                  )}
                </div>
                <button
                  onClick={processPurchase}
                  disabled={purchasing || cart.length === 0 || scanned.wallet_balance < total}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-60 transition"
                >
                  {purchasing ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={16} />}
                  {purchasing ? "Processing…" : "Charge"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Daily report */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h3 className="font-semibold text-gray-700">Today&apos;s Report</h3>
            {!reportLoading && report && (
              <div className="text-right">
                <p className="text-xs text-gray-400">{report.transaction_count} transactions</p>
                <p className="text-xl font-bold text-blue-600">{report.total_revenue.toLocaleString()} <span className="text-xs font-normal text-gray-400">RWF</span></p>
              </div>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {reportLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
            ) : !report || report.transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <ShoppingCart size={32} className="mb-2" />
                <p className="text-sm">No transactions today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {report.transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700">{t.student?.user?.first_name} {t.student?.user?.last_name}</p>
                      <p className="text-xs text-gray-400 truncate">{(t.items_purchased as CanteenItem[]).map((i: CanteenItem) => `${i.name}×${i.quantity}`).join(", ")}</p>
                      <p className="text-xs text-gray-300">{new Date(t.transaction_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <p className="text-sm font-bold text-red-500 ml-2">-{t.total_amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
