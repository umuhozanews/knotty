"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Wifi, WifiOff, Loader2, CreditCard, CheckCircle, Clock, XCircle,
  Plus, X, Receipt, TrendingUp, Wallet, AlertCircle,
  ChevronLeft, ChevronRight, Trash2,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { cards, fees, CardScanResult, Invoice, FeeStructure, RefundRequest } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

type ScannedStudent = CardScanResult["student"];

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  PAID:    { bg: "#DCFCE7", text: "#166534", icon: <CheckCircle size={12} /> },
  PARTIAL: { bg: "#FEF9C3", text: "#854D0E", icon: <Clock size={12} /> },
  PENDING: { bg: "#FEE2E2", text: "#991B1B", icon: <XCircle size={12} /> },
  OVERDUE: { bg: "#FEE2E2", text: "#991B1B", icon: <AlertCircle size={12} /> },
};

/* ── Pay Invoice Modal ─────────────────────────────────────────── */
function PayModal({ invoice, onClose, onSuccess }: {
  invoice: Invoice; onClose: () => void; onSuccess: () => void;
}) {
  const remaining = invoice.total_amount - invoice.amount_paid;
  const [form, setForm] = useState({ amount: String(remaining), channel: "CASH", phone: "" });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fees.payInvoice({ invoice_id: invoice.id, amount: parseFloat(form.amount), channel: form.channel, phone: form.channel === "MOMO" ? form.phone : undefined });
      toast("Payment recorded successfully", "success");
      onSuccess();
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "Error", "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-sm" style={{ color: "#121212" }}>Record Payment</p>
            <p className="text-xs text-gray-400">Outstanding: {remaining.toLocaleString()} RWF</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>PAYMENT CHANNEL</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[["CASH", "Cash"], ["MOMO", "MTN MoMo"], ["BANK", "Bank Transfer"]].map(([val, label]) => (
                <button key={val} type="button" onClick={() => setForm((f) => ({ ...f, channel: val }))}
                  className="py-1.5 rounded-xl text-xs font-medium border transition"
                  style={form.channel === val
                    ? { background: "#121212", color: "#fff", borderColor: "#121212" }
                    : { background: "#fff", color: "#666", borderColor: "#e5e5e5" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>AMOUNT (RWF)</p>
            <input type="number" required min={1} max={remaining} value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
          </div>
          {form.channel === "MOMO" && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>MOMO PHONE</p>
              <input required placeholder="250780000000" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-medium" style={{ background: "#F5F5F5", color: "#666" }}>Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#1D4ED8" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Receipt size={14} /> Record</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function FeesPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported } = useNFC();
  const isBursarOrAdmin = ["ADMIN", "BURSAR"].includes(user?.role ?? "");

  /* ── Scanner ───────────────────────────────────────────────── */
  const [cardInput, setCardInput]   = useState("");
  const [scanning, setScanning]     = useState(false);
  const processingRef               = useRef(false);

  /* ── Scanned student ───────────────────────────────────────── */
  const [student, setStudent]           = useState<ScannedStudent | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([]);
  const [studentLoading, setStudentLoading]   = useState(false);
  const [payTarget, setPayTarget]             = useState<Invoice | null>(null);

  /* ── School-wide data ──────────────────────────────────────── */
  const [activeTab, setActiveTab]     = useState<"overview" | "invoices" | "structures" | "refunds">("overview");
  const [report, setReport]           = useState<{ total_collected: number; pending: number; by_type: { payment_type: string; _sum: { amount: number }; _count: number }[] } | null>(null);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [structures, setStructures]   = useState<FeeStructure[]>([]);
  const [refunds, setRefunds]         = useState<RefundRequest[]>([]);
  const [tabLoading, setTabLoading]   = useState(false);

  /* ── Structure / invoice-gen modals ───────────────────────── */
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showGenModal, setShowGenModal]             = useState(false);
  const [structForm, setStructForm] = useState({ name: "", applies_to: "", amount: "" });
  const [genForm, setGenForm]       = useState({ fee_structure_id: "", due_date: "" });

  /* ── Card scan ─────────────────────────────────────────────── */
  async function handleCardScan(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current) return;
    processingRef.current = true;
    setScanning(true);
    try {
      const res = isNFC ? await cards.scanNFC(cardNum) : await cards.scan(cardNum.trim());
      const scanned = res.data.student;
      setStudent(scanned);
      setCardInput("");
      setStudentLoading(true);
      const invRes = await fees.invoices({ studentId: scanned.id });
      setStudentInvoices(invRes.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Card not found", "error");
    } finally {
      setScanning(false);
      processingRef.current = false;
      setStudentLoading(false);
    }
  }

  const scanHandlerRef = useRef(handleCardScan);
  scanHandlerRef.current = handleCardScan;

  useEffect(() => {
    if (!authLoading && isSupported) {
      startListen((r) => scanHandlerRef.current(r.value, r.type === "uid"));
    }
    return () => { stopListen(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSupported]);

  /* ── Load school-wide tab data ─────────────────────────────── */
  const loadTab = useCallback(async () => {
    if (authLoading || !isBursarOrAdmin) return;
    setTabLoading(true);
    try {
      if (activeTab === "overview") {
        const r = await fees.schoolReport();
        setReport(r.data as typeof report);
      } else if (activeTab === "invoices") {
        const r = await fees.invoices();
        setAllInvoices(r.data);
      } else if (activeTab === "structures") {
        const r = await fees.structures();
        setStructures(r.data);
      } else if (activeTab === "refunds") {
        const r = await fees.refunds();
        setRefunds(r.data);
      }
    } catch { /* ignore */ }
    finally { setTabLoading(false); }
  }, [activeTab, authLoading, isBursarOrAdmin]);

  useEffect(() => { loadTab(); }, [loadTab]);

  /* ── Computed totals for scanned student ───────────────────── */
  const totalOwed   = studentInvoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPaid   = studentInvoices.reduce((s, i) => s + i.amount_paid, 0);
  const outstanding = totalOwed - totalPaid;
  const allPaid     = outstanding === 0 && studentInvoices.length > 0;

  return (
    <DashboardShell>
      {payTarget && (
        <PayModal invoice={payTarget} onClose={() => setPayTarget(null)}
          onSuccess={async () => {
            if (student) {
              const r = await fees.invoices({ studentId: student.id });
              setStudentInvoices(r.data);
            }
            if (activeTab === "invoices") loadTab();
          }} />
      )}

      {/* Structure modal */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold mb-4" style={{ color: "#121212" }}>New Fee Structure</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              await fees.createStructure({ name: structForm.name, amount: parseFloat(structForm.amount), applies_to: structForm.applies_to ? structForm.applies_to.split(",").map(s => s.trim()) : undefined });
              setShowStructureModal(false); setStructForm({ name: "", applies_to: "", amount: "" }); loadTab();
            }} className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#666" }}>TITLE</p>
                <input required value={structForm.name} onChange={(e) => setStructForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. S5 Term 1 Tuition" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#666" }}>APPLIES TO (comma separated, blank = all)</p>
                <input value={structForm.applies_to} onChange={(e) => setStructForm((f) => ({ ...f, applies_to: e.target.value }))}
                  placeholder="Senior 5, Senior 6" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#666" }}>AMOUNT (RWF)</p>
                <input required type="number" min={1} value={structForm.amount} onChange={(e) => setStructForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowStructureModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#1D4ED8" }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice gen modal */}
      {showGenModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold mb-4" style={{ color: "#121212" }}>Generate Bulk Invoices</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const r = await fees.generateInvoices(genForm);
              toast(`${r.count} invoices generated`, "success");
              setShowGenModal(false); loadTab();
            }} className="space-y-3">
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#666" }}>FEE STRUCTURE</p>
                <select required value={genForm.fee_structure_id} onChange={(e) => setGenForm((f) => ({ ...f, fee_structure_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {structures.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.amount.toLocaleString()} RWF</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "#666" }}>DUE DATE</p>
                <input required type="date" value={genForm.due_date} onChange={(e) => setGenForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowGenModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#1D4ED8" }}>Run Billing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#121212" }}>Fees & Finance</h1>
            <p className="text-xs" style={{ color: "#666" }}>Tap student card to check payment status</p>
          </div>
        </div>

        <div className="flex flex-1 gap-3 px-3 md:px-4 pb-3 md:pb-4 overflow-hidden min-h-0 flex-col lg:flex-row">

          {/* ── LEFT: Scanner ───────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-white rounded-3xl p-5 flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: listening ? "#EFF6FF" : "#F5F5F5" }}>
                {scanning
                  ? <Loader2 size={32} className="animate-spin" style={{ color: "#1D4ED8" }} />
                  : listening
                  ? <Wallet size={32} className="animate-pulse" style={{ color: "#1D4ED8" }} />
                  : <WifiOff size={32} style={{ color: "#ccc" }} />}
              </div>
              <p className="text-sm font-bold text-center" style={{ color: "#121212" }}>
                {scanning ? "Reading card…" : listening ? "Waiting for card tap…" : "NFC not available"}
              </p>
              <p className="text-xs text-center text-gray-400">
                {listening ? "Student holds card near device" : "Use manual entry below"}
              </p>
              <div className="w-full flex gap-2 pt-1">
                <input value={cardInput} onChange={(e) => setCardInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCardScan(cardInput)}
                  placeholder="Card number…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono outline-none" />
                <button onClick={() => handleCardScan(cardInput)} disabled={scanning || !cardInput.trim()}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                  style={{ background: "#121212" }}>
                  {scanning ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={13} />}
                </button>
              </div>
              <VirtualCardTap onTap={(cn) => handleCardScan(cn)} busy={scanning} />
            </div>

            {/* Student summary (desktop) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 hidden lg:block">
                <div className="flex items-center gap-3 mb-4">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold flex-shrink-0"
                        style={{ background: "#EFF6FF", color: "#1D4ED8" }}>{student.name.charAt(0)}</div>}
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class}</p>
                  </div>
                </div>

                {/* Payment status summary */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-2xl p-3 text-center" style={{ background: "#DCFCE7" }}>
                    <p className="text-xs text-green-600">Paid</p>
                    <p className="text-sm font-bold text-green-700">{totalPaid.toLocaleString()}</p>
                    <p className="text-[10px] text-green-600">RWF</p>
                  </div>
                  <div className="rounded-2xl p-3 text-center" style={{ background: outstanding > 0 ? "#FEE2E2" : "#F5F5F5" }}>
                    <p className="text-xs" style={{ color: outstanding > 0 ? "#991B1B" : "#999" }}>Outstanding</p>
                    <p className="text-sm font-bold" style={{ color: outstanding > 0 ? "#DC2626" : "#121212" }}>{outstanding.toLocaleString()}</p>
                    <p className="text-[10px]" style={{ color: outstanding > 0 ? "#991B1B" : "#999" }}>RWF</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-2xl" style={{ background: allPaid ? "#DCFCE7" : "#FEF9C3" }}>
                  {allPaid
                    ? <><CheckCircle size={16} className="text-green-600" /><p className="text-xs font-bold text-green-700">All fees cleared</p></>
                    : <><AlertCircle size={16} className="text-amber-600" /><p className="text-xs font-bold text-amber-700">{outstanding.toLocaleString()} RWF outstanding</p></>}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Student invoices or school-wide ───────── */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">

            {/* Student card (mobile) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 lg:hidden flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-10 h-10 rounded-2xl object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 text-sm"
                        style={{ background: "#EFF6FF", color: "#1D4ED8" }}>{student.name.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class}</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold"
                    style={{ background: allPaid ? "#DCFCE7" : "#FEE2E2", color: allPaid ? "#166534" : "#991B1B" }}>
                    {allPaid ? <><CheckCircle size={11} /> Cleared</> : <>{outstanding.toLocaleString()} RWF due</>}
                  </div>
                </div>
              </div>
            )}

            {student ? (
              /* Student invoice list */
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#121212" }}>Invoices</p>
                  <p className="text-xs text-gray-400">{studentInvoices.length} invoice{studentInvoices.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {studentLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : studentInvoices.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-gray-300">
                      <Receipt size={32} className="mb-2" />
                      <p className="text-sm">No invoices found for this student</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {studentInvoices.map((inv) => {
                        const rem = inv.total_amount - inv.amount_paid;
                        const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING;
                        return (
                          <div key={inv.id} className="rounded-2xl p-4" style={{ background: "#F9F9F9" }}>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: st.bg, color: st.text }}>
                                    {st.icon} {inv.status}
                                  </span>
                                  {inv.fee_structure && <span className="text-xs text-gray-500">{inv.fee_structure.name}</span>}
                                </div>
                                <p className="text-xs text-gray-400">Due: {new Date(inv.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold" style={{ color: "#121212" }}>{inv.total_amount.toLocaleString()} RWF</p>
                                <p className="text-xs text-green-600">Paid: {inv.amount_paid.toLocaleString()}</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden mb-3">
                              <div className="h-full rounded-full transition-all bg-green-500"
                                style={{ width: `${Math.min(100, (inv.amount_paid / inv.total_amount) * 100)}%` }} />
                            </div>

                            {rem > 0 && isBursarOrAdmin && (
                              <button onClick={() => setPayTarget(inv)}
                                className="w-full py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1"
                                style={{ background: "#1D4ED8" }}>
                                <Receipt size={11} /> Record Payment · {rem.toLocaleString()} RWF due
                              </button>
                            )}
                            {rem === 0 && (
                              <p className="text-center text-xs text-green-600 font-semibold flex items-center justify-center gap-1">
                                <CheckCircle size={11} /> Fully cleared
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* School-wide management panel */
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                {/* Tab bar */}
                {isBursarOrAdmin && (
                  <div className="flex gap-1 p-3 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
                    {(["overview", "invoices", "structures", "refunds"] as const).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap capitalize"
                        style={activeTab === tab
                          ? { background: "#EFF6FF", color: "#1D4ED8" }
                          : { background: "transparent", color: "#999" }}>
                        {tab}
                      </button>
                    ))}
                    <div className="ml-auto flex gap-1 flex-shrink-0">
                      {activeTab === "structures" && (
                        <button onClick={() => setShowStructureModal(true)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
                          style={{ background: "#1D4ED8" }}>
                          <Plus size={11} /> Structure
                        </button>
                      )}
                      {activeTab === "structures" && structures.length > 0 && (
                        <button onClick={() => { setGenForm({ fee_structure_id: structures[0].id, due_date: "" }); setShowGenModal(true); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1"
                          style={{ background: "#121212" }}>
                          <Receipt size={11} /> Bulk Bill
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {tabLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : activeTab === "overview" && report ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl p-4" style={{ background: "#DCFCE7" }}>
                          <div className="flex items-center gap-2 mb-1"><CheckCircle size={16} className="text-green-600" /><p className="text-xs text-green-600">Total Collected</p></div>
                          <p className="text-xl font-bold text-green-700">{report.total_collected.toLocaleString()} RWF</p>
                        </div>
                        <div className="rounded-2xl p-4" style={{ background: "#FEF9C3" }}>
                          <div className="flex items-center gap-2 mb-1"><Clock size={16} className="text-amber-600" /><p className="text-xs text-amber-600">Pending</p></div>
                          <p className="text-xl font-bold text-amber-700">{report.pending.toLocaleString()} RWF</p>
                        </div>
                      </div>
                      <div className="rounded-2xl p-4" style={{ background: "#EFF6FF" }}>
                        <div className="flex items-center gap-2 mb-1"><TrendingUp size={16} className="text-blue-600" /><p className="text-xs text-blue-600">Projected Total</p></div>
                        <p className="text-xl font-bold text-blue-700">{(report.total_collected + report.pending).toLocaleString()} RWF</p>
                      </div>
                      {report.by_type?.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold px-1" style={{ color: "#666" }}>BREAKDOWN BY TYPE</p>
                          {report.by_type.map((item) => (
                            <div key={item.payment_type} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "#F9F9F9" }}>
                              <span className="text-xs font-medium" style={{ color: "#444" }}>{item.payment_type}</span>
                              <span className="text-xs font-bold" style={{ color: "#121212" }}>{(item._sum.amount ?? 0).toLocaleString()} RWF <span className="font-normal text-gray-400">({item._count})</span></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : activeTab === "invoices" ? (
                    <div className="space-y-2">
                      {allInvoices.length === 0
                        ? <p className="text-center text-sm text-gray-400 py-8">No invoices found</p>
                        : allInvoices.map((inv) => {
                          const rem = inv.total_amount - inv.amount_paid;
                          const st = STATUS_STYLE[inv.status] ?? STATUS_STYLE.PENDING;
                          return (
                            <div key={inv.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "#F9F9F9" }}>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: st.bg, color: st.text }}>{st.icon} {inv.status}</span>
                                  <span className="text-xs font-semibold truncate" style={{ color: "#121212" }}>{inv.student?.user?.first_name} {inv.student?.user?.last_name}</span>
                                </div>
                                <p className="text-xs text-gray-400">{inv.student?.class?.name} · {inv.total_amount.toLocaleString()} RWF total</p>
                              </div>
                              {rem > 0 && (
                                <button onClick={() => setPayTarget(inv)}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex-shrink-0"
                                  style={{ background: "#1D4ED8" }}>
                                  Pay {rem.toLocaleString()}
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : activeTab === "structures" ? (
                    <div className="space-y-2">
                      {structures.length === 0
                        ? <p className="text-center text-sm text-gray-400 py-8">No fee structures yet</p>
                        : structures.map((s) => (
                          <div key={s.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "#F9F9F9" }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: "#121212" }}>{s.name}</p>
                              <p className="text-xs text-gray-400">{s.amount.toLocaleString()} RWF
                                {s.applies_to?.length ? ` · ${s.applies_to.join(", ")}` : " · All students"}
                              </p>
                            </div>
                            <button onClick={async () => { if (confirm("Delete?")) { await fees.deleteStructure(s.id); loadTab(); } }}
                              className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 flex-shrink-0"><Trash2 size={13} /></button>
                          </div>
                        ))}
                    </div>
                  ) : activeTab === "refunds" ? (
                    <div className="space-y-2">
                      {refunds.length === 0
                        ? <p className="text-center text-sm text-gray-400 py-8">No refund requests</p>
                        : refunds.map((r) => (
                          <div key={r.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-xs font-semibold" style={{ color: "#121212" }}>{r.wallet_transaction?.student?.user?.first_name} {r.wallet_transaction?.student?.user?.last_name}</p>
                                <p className="text-xs text-gray-500">{r.reason}</p>
                                <p className="text-xs font-bold mt-0.5" style={{ color: "#121212" }}>{r.wallet_transaction?.amount?.toLocaleString()} RWF</p>
                              </div>
                              {r.status === "PENDING" && (
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={async () => { await fees.resolveRefund(r.id, "APPROVED"); toast("Refund approved", "success"); loadTab(); }}
                                    className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#16A34A" }}>Approve</button>
                                  <button onClick={async () => { await fees.resolveRefund(r.id, "REJECTED"); toast("Refund rejected", "error"); loadTab(); }}
                                    className="px-2 py-1 rounded-lg text-xs font-bold text-white" style={{ background: "#DC2626" }}>Reject</button>
                                </div>
                              )}
                              {r.status !== "PENDING" && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={r.status === "APPROVED" ? { background: "#DCFCE7", color: "#166534" } : { background: "#FEE2E2", color: "#991B1B" }}>{r.status}</span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
