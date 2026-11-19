"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  GraduationCap, Bus, Wallet, MoreHorizontal,
  ChevronRight, ChevronLeft, Loader2, Users,
  CheckCircle, AlertCircle, Clock, X, Receipt, Smartphone,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { supabaseFeesService, type FeeType, type StudentFeeStatus } from "@/lib/supabase/services";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type ClassWithLevel = {
  id: string;
  name: string;
  stream_name: string | null;
  level_name: string;
  student_count: number;
};

/* ── Constants ─────────────────────────────────────────────────── */

const FEE_CATEGORIES: { type: FeeType; label: string; sub: string; icon: React.ElementType; color: string; bg: string }[] = [
  { type: "TUITION",      label: "Tuition Fees",   sub: "School & academic fees",  icon: GraduationCap, color: "#2563EB", bg: "#EFF6FF" },
  { type: "TRANSPORT",    label: "Transport Fees",  sub: "Bus & travel fees",        icon: Bus,           color: "#16A34A", bg: "#F0FDF4" },
  { type: "POCKET_MONEY", label: "Pocket Money",    sub: "Student daily allowance",  icon: Wallet,        color: "#7C3AED", bg: "#F5F3FF" },
  { type: "OTHER",        label: "Other Fees",      sub: "Uniforms, trips & more",   icon: MoreHorizontal,color: "#EA580C", bg: "#FFF7ED" },
];

const TERMS = ["Term 1", "Term 2", "Term 3"];
const CURRENT_YEAR = new Date().getFullYear().toString();

function termLabel(term: string, year: string) { return `${term} ${year}`; }

/* ── Payment Modal ─────────────────────────────────────────────── */
function PaymentModal({
  student, feeType, termLabel: tLabel, onClose, onSuccess,
}: {
  student: StudentFeeStatus;
  feeType: FeeType;
  termLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<"MTN" | "AIRTEL" | "CASH" | "BANK">("MTN");
  const [amount, setAmount] = useState(String(student.balance > 0 ? student.balance : 0));
  const [expectedAmount, setExpectedAmount] = useState(String(student.total_amount > 0 ? student.total_amount : ""));
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [pollingState, setPollingState] = useState<"idle" | "waiting" | "confirmed" | "failed">("idle");
  const noInvoice = !student.invoice_id;
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  async function recordInDB(schoolId: string, flwRef?: string) {
    const amt = parseFloat(amount);
    const expected = parseFloat(expectedAmount);
    const invoiceId = student.invoice_id ?? await supabaseFeesService.upsertInvoice(schoolId, {
      studentId: student.student_id,
      feeType,
      termLabel: tLabel,
      totalAmount: expected,
    });
    const dbChannel = channel === "MTN" || channel === "AIRTEL" ? "MOMO" : channel === "BANK" ? "BANK" : "CASH";
    await supabaseFeesService.payInvoice(schoolId, invoiceId, {
      amount: amt,
      channel: dbChannel,
      phone: phone || undefined,
    });
    if (flwRef || reference) {
      const client = getSafeBrowserClient();
      if (client) {
        const notesParts = [];
        if (channel === "MTN" || channel === "AIRTEL") notesParts.push(`Provider: ${channel}`);
        if (flwRef) notesParts.push(`FLW: ${flwRef}`);
        if (reference) notesParts.push(`Ref: ${reference}`);
        await client.from("fee_payments")
          .update({ notes: notesParts.join(" | ") })
          .eq("invoice_id", invoiceId)
          .order("created_at", { ascending: false })
          .limit(1);
      }
    }
  }

  async function pollPayment(txId: string | null, txRef: string, flwRef: string, attempt = 0) {
    if (!mountedRef.current) return;
    if (attempt > 40) {
      setPollingState("failed");
      toast("Payment not confirmed within 2 min. Record manually if paid.", "error");
      return;
    }
    try {
      const query = txId ? `id=${txId}` : `tx_ref=${txRef}`;
      const res = await fetch(`/api/fees/verify-payment?${query}`);
      const data = await res.json();
      if (!mountedRef.current) return;
      if (data.status === "successful") {
        setPollingState("confirmed");
        await recordInDB(user!.school_id!, flwRef || data.flw_ref);
        toast("Payment confirmed!", "success");
        onSuccess();
        onClose();
      } else if (data.status === "failed" || data.status === "cancelled") {
        setPollingState("failed");
        toast("Payment failed or was cancelled", "error");
      } else {
        pollTimerRef.current = setTimeout(() => pollPayment(txId, txRef, flwRef, attempt + 1), 3000);
      }
    } catch {
      pollTimerRef.current = setTimeout(() => pollPayment(txId, txRef, flwRef, attempt + 1), 3000);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.school_id) return;
    const amt = parseFloat(amount);
    const expected = parseFloat(expectedAmount);
    if (isNaN(amt) || amt <= 0) { toast("Enter a valid amount", "error"); return; }
    if (noInvoice && (isNaN(expected) || expected <= 0)) { toast("Enter expected fee amount", "error"); return; }

    if (channel === "MTN" || channel === "AIRTEL") {
      if (!phone) { toast("Enter a phone number for mobile payment", "error"); return; }
      setLoading(true);
      const txRef = `FEE-${student.student_id}-${Date.now()}`;
      // Open window synchronously on user gesture — before any async work,
      // otherwise browsers block it as a popup
      const paymentWindow = window.open("about:blank", "_blank");
      try {
        const res = await fetch("/api/fees/initiate-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            amount: amt,
            name: student.legal_name,
            network: channel,
            tx_ref: txRef,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          paymentWindow?.close();
          throw new Error(data.error || "Failed to send payment request");
        }
        setLoading(false);
        setPollingState("waiting");
        if (data.mode === "redirect") {
          if (paymentWindow) paymentWindow.location.href = data.redirect_url;
          pollPayment(null, txRef, "", 0);
        } else {
          paymentWindow?.close();
          pollPayment(data.transaction_id, txRef, data.flw_ref, 0);
        }
      } catch (err) {
        paymentWindow?.close();
        setLoading(false);
        toast(err instanceof Error ? err.message : "Failed to initiate payment", "error");
      }
    } else {
      setLoading(true);
      try {
        await recordInDB(user.school_id);
        toast("Payment recorded", "success");
        onSuccess();
        onClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to record payment", "error");
      } finally {
        setLoading(false);
      }
    }
  }

  const channels: { id: "MTN" | "AIRTEL" | "CASH" | "BANK"; label: string; color: string }[] = [
    { id: "MTN",    label: "MTN MoMo",  color: "#FBBF24" },
    { id: "AIRTEL", label: "Airtel",    color: "#EF4444" },
    { id: "CASH",   label: "Cash",      color: "#16A34A" },
    { id: "BANK",   label: "Bank",      color: "#2563EB" },
  ];

  const isMoMo = channel === "MTN" || channel === "AIRTEL";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-sm text-gray-900">{student.legal_name}</p>
            <p className="text-xs text-gray-400">{student.admission_number} · {tLabel}</p>
          </div>
          <button onClick={onClose} disabled={pollingState === "waiting"}
            className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center disabled:opacity-30">
            <X size={14} />
          </button>
        </div>

        {/* Waiting for MoMo confirmation */}
        {pollingState === "waiting" ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#FEF9C3" }}>
              <Smartphone size={28} style={{ color: "#D97706" }} className="animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Waiting for confirmation</p>
              <p className="text-sm text-gray-500 mt-1">A payment page has opened. Ask the payer to complete the payment on their phone, then wait here.</p>
            </div>
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <p className="text-xs text-gray-400">This will confirm automatically…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Fee summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Expected", value: noInvoice ? "—" : student.total_amount.toLocaleString(), color: "text-gray-700" },
                { label: "Paid",     value: student.amount_paid.toLocaleString(),                     color: "text-green-700" },
                { label: "Balance",  value: student.balance.toLocaleString(),                          color: student.balance > 0 ? "text-red-600" : "text-green-700" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 rounded-2xl py-2 px-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] text-gray-300">RWF</p>
                </div>
              ))}
            </div>

            {/* Expected amount — only if creating new invoice */}
            {noInvoice && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">EXPECTED FEE AMOUNT (RWF)</p>
                <input
                  type="number" required min={1} value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
                  placeholder="e.g. 300000"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
            )}

            {/* Payment channel */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">PAYMENT METHOD</p>
              <div className="grid grid-cols-4 gap-1.5">
                {channels.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => setChannel(c.id)}
                    className="py-2 rounded-xl text-xs font-semibold border transition"
                    style={channel === c.id
                      ? { background: c.color, color: "#fff", borderColor: c.color }
                      : { background: "#fff", color: "#666", borderColor: "#e5e5e5" }}>
                    {c.label}
                  </button>
                ))}
              </div>
              {isMoMo && (
                <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                  <Smartphone size={11} /> Payment request will be sent to the payer&apos;s phone
                </p>
              )}
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">AMOUNT TO PAY (RWF)</p>
              <input
                type="number" required min={1}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </div>

            {/* Phone — for mobile money */}
            {isMoMo && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">PHONE NUMBER</p>
                <input
                  type="tel" required placeholder="e.g. 0780000000"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
            )}

            {/* Reference — only for Cash/Bank */}
            {!isMoMo && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1.5">REFERENCE NUMBER <span className="font-normal">(optional)</span></p>
                <input
                  placeholder="Transaction ref…"
                  value={reference} onChange={(e) => setReference(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-medium bg-gray-100 text-gray-600">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: isMoMo ? "#D97706" : "#16A34A" }}>
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : isMoMo
                    ? <><Smartphone size={14} /> Send Request</>
                    : <><Receipt size={14} /> Record Payment</>
                }
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ── Student Row ───────────────────────────────────────────────── */
function StudentFeeRow({ s, onPay }: { s: StudentFeeStatus; onPay: (s: StudentFeeStatus) => void }) {
  const paid = s.status === "paid";
  const noInv = s.status === "no_invoice";
  const partial = s.status === "partial";

  let badge = { label: "Unpaid", bg: "#FEE2E2", color: "#991B1B" };
  if (paid)    badge = { label: "Paid",    bg: "#DCFCE7", color: "#166534" };
  if (partial) badge = { label: "Partial", bg: "#FEF9C3", color: "#854D0E" };
  if (noInv)   badge = { label: "Not set", bg: "#F3F4F6", color: "#6B7280" };

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 transition">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ background: "linear-gradient(135deg,#16A34A,#2563EB)" }}>
        {s.legal_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{s.legal_name}</p>
        <p className="text-xs text-gray-400">{s.admission_number}</p>
      </div>
      <div className="text-right flex-shrink-0 mr-2">
        {!noInv && (
          <>
            <p className="text-xs font-bold text-gray-700">{s.amount_paid.toLocaleString()} / {s.total_amount.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">RWF</p>
          </>
        )}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: badge.bg, color: badge.color }}>
        {badge.label}
      </span>
      <button
        onClick={() => onPay(s)}
        className="ml-1 w-7 h-7 rounded-xl flex items-center justify-center transition flex-shrink-0"
        style={{ background: paid ? "#F0FDF4" : "#EFF6FF" }}
        title="Record payment">
        <Receipt size={13} style={{ color: paid ? "#16A34A" : "#2563EB" }} />
      </button>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function FeesPage() {
  const { user, loading: authLoading, activeSchool } = useAuth();
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<FeeType | null>(null);
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedClass, setSelectedClass] = useState<ClassWithLevel | null>(null);

  const [classes, setClasses] = useState<ClassWithLevel[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [students, setStudents] = useState<StudentFeeStatus[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<StudentFeeStatus | null>(null);

  const schoolId = activeSchool?.id ?? user?.school_id ?? "";

  // Load classes with education level names and student counts
  useEffect(() => {
    if (!selectedCategory || !schoolId) return;
    setClassesLoading(true);
    setSelectedClass(null);
    setStudents([]);
    const client = getSafeBrowserClient();
    if (!client) { setClassesLoading(false); return; }
    void (async () => {
      try {
        const { data, error } = await client
          .from("class_sections")
          .select(`id, name, stream_name, education_levels ( name ), student_class_placements ( id )`)
          .eq("school_id", schoolId)
          .eq("status", "active")
          .order("name");
        if (error) { toast(error.message, "error"); return; }
        const mapped: ClassWithLevel[] = (data ?? []).map((c: any) => ({
          id: c.id,
          name: c.name,
          stream_name: c.stream_name ?? null,
          level_name: c.education_levels?.name ?? "",
          student_count: Array.isArray(c.student_class_placements) ? c.student_class_placements.length : 0,
        }));
        setClasses(mapped.filter((c) => c.student_count > 0));
      } catch (e: any) {
        toast(e.message ?? "Failed to load classes", "error");
      } finally {
        setClassesLoading(false);
      }
    })();
  }, [selectedCategory, schoolId]);

  // Load students when class selected
  const loadStudents = useCallback(async () => {
    if (!selectedCategory || !selectedClass || !schoolId) return;
    setStudentsLoading(true);
    try {
      const tLabel = termLabel(selectedTerm, selectedYear);
      const data = await supabaseFeesService.getClassFeeStatus(schoolId, selectedClass.id, selectedCategory, tLabel);
      setStudents(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Error loading students", "error");
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedCategory, selectedClass, selectedTerm, selectedYear, schoolId]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Stats for the class list overview
  const classStats = {
    total: students.length,
    paid: students.filter((s) => s.status === "paid").length,
    partial: students.filter((s) => s.status === "partial").length,
    unpaid: students.filter((s) => s.status === "pending" || s.status === "no_invoice").length,
    collected: students.reduce((sum, s) => sum + s.amount_paid, 0),
    outstanding: students.reduce((sum, s) => sum + s.balance, 0),
  };

  const currentCategory = FEE_CATEGORIES.find((c) => c.type === selectedCategory);
  const tLabel = termLabel(selectedTerm, selectedYear);

  return (
    <DashboardShell>
      {payTarget && selectedCategory && (
        <PaymentModal
          student={payTarget}
          feeType={selectedCategory}
          termLabel={tLabel}
          onClose={() => setPayTarget(null)}
          onSuccess={() => { setPayTarget(null); loadStudents(); }}
        />
      )}

      <div className="h-full flex flex-col gap-4 overflow-auto px-1 pb-4">

        {/* ── Category Cards ─────────────────────────────────── */}
        {!selectedCategory ? (
          <>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Fees Management</h1>
              <p className="text-sm text-gray-400">Select a fee category to manage payments</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {FEE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.type}
                    onClick={() => setSelectedCategory(cat.type)}
                    className="flex flex-col gap-3 p-5 rounded-3xl text-left transition hover:scale-[1.02] active:scale-100 cursor-pointer shadow-sm"
                    style={{ background: cat.bg }}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: cat.color }}>
                      <Icon size={24} className="text-white" />
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 leading-tight">{cat.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{cat.sub}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold mt-auto" style={{ color: cat.color }}>
                      Manage <ChevronRight size={13} />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : !selectedClass ? (
          /* ── Class List ──────────────────────────────────── */
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedCategory(null); setClasses([]); }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center transition"
                style={{ background: "#F0FDF4", color: "#16A34A" }}>
                <ChevronLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">{currentCategory?.label}</h1>
                <p className="text-sm text-gray-400">Select class to manage payments</p>
              </div>
            </div>

            {/* Term selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-white rounded-2xl p-1 shadow-sm">
                {TERMS.map((t) => (
                  <button key={t} onClick={() => setSelectedTerm(t)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition"
                    style={selectedTerm === t
                      ? { background: currentCategory?.color, color: "#fff" }
                      : { color: "#666" }}>
                    {t}
                  </button>
                ))}
              </div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white rounded-2xl px-3 py-2 text-xs font-semibold text-gray-700 border-0 shadow-sm outline-none">
                {[0, 1, 2].map((offset) => {
                  const y = (parseInt(CURRENT_YEAR) - offset).toString();
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <span className="text-xs font-medium text-gray-500 px-2 py-2 bg-white rounded-2xl shadow-sm">
                {tLabel}
              </span>
            </div>

            {/* Classes grid */}
            {classesLoading ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : classes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users size={32} className="mx-auto mb-2" />
                <p>No active classes found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {classes.map((cls) => (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className="flex flex-col gap-2 p-4 bg-white rounded-3xl shadow-sm hover:shadow-md transition text-left hover:scale-[1.02] active:scale-100"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
                      style={{ background: currentCategory?.color ?? "#16A34A" }}>
                      {(cls.level_name || cls.name).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      {cls.level_name && <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{cls.level_name}</p>}
                      <p className="font-bold text-gray-800 text-sm leading-tight">{cls.name}</p>
                      {cls.stream_name && <p className="text-xs text-gray-400">{cls.stream_name}</p>}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Users size={11} />{cls.student_count} students</span>
                      <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: currentCategory?.color }}>
                        View <ChevronRight size={12} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── Student List ─────────────────────────────────── */
          <>
            {/* Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setSelectedClass(null); setStudents([]); }}
                className="w-9 h-9 rounded-2xl flex items-center justify-center transition"
                style={{ background: "#F0FDF4", color: "#16A34A" }}>
                <ChevronLeft size={18} />
              </button>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{selectedClass.level_name}</p>
                <h1 className="text-xl font-extrabold text-gray-900">{selectedClass.name}</h1>
                <p className="text-sm text-gray-400">{currentCategory?.label} · {tLabel}</p>
              </div>
            </div>

            {/* Stats */}
            {!studentsLoading && students.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Students", value: classStats.total,     color: "#2563EB", bg: "#EFF6FF", Icon: Users },
                  { label: "Fully Paid",     value: classStats.paid,      color: "#16A34A", bg: "#F0FDF4", Icon: CheckCircle },
                  { label: "Partial",        value: classStats.partial,   color: "#D97706", bg: "#FFFBEB", Icon: Clock },
                  { label: "Unpaid",         value: classStats.unpaid,    color: "#DC2626", bg: "#FEF2F2", Icon: AlertCircle },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: s.bg }}>
                    <s.Icon size={18} style={{ color: s.color }} className="flex-shrink-0" />
                    <div>
                      <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs text-gray-500">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!studentsLoading && students.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl px-4 py-3 bg-green-50">
                  <p className="text-xs text-green-600">Total Collected</p>
                  <p className="text-lg font-extrabold text-green-700">{classStats.collected.toLocaleString()} <span className="text-xs font-normal">RWF</span></p>
                </div>
                <div className="rounded-2xl px-4 py-3 bg-red-50">
                  <p className="text-xs text-red-500">Outstanding</p>
                  <p className="text-lg font-extrabold text-red-600">{classStats.outstanding.toLocaleString()} <span className="text-xs font-normal">RWF</span></p>
                </div>
              </div>
            )}

            {/* Student list */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">{studentsLoading ? "Loading…" : `${students.length} students`}</p>
              </div>
              {studentsLoading ? (
                <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
              ) : students.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Users size={28} className="mx-auto mb-2" />
                  <p className="text-sm">No students in this class</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {students.map((s) => (
                    <StudentFeeRow key={s.student_id} s={s} onPay={setPayTarget} />
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
