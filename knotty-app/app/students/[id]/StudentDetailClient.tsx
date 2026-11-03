"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CreditCard, Calendar, Wallet, AlertTriangle,
  Heart, Plus, CheckCircle, XCircle, Clock,
  User, ShoppingBag, Snowflake, ThermometerSnowflake,
  X, Activity, Nfc
} from "lucide-react";
import { useNFC } from "@/hooks/useNFC";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import type { HealthRecord, DisciplineRecord } from "@/lib/api";
import {
  supabaseHealthService,
  supabaseDisciplineService,
  supabaseCardService,
  supabaseCanteenService,
  supabaseFeesService,
  supabaseAttendanceService,
} from "@/lib/supabase/services";
import type { CanteenTransactionRow } from "@/lib/supabase/services/canteenService";
import type { FeeInvoiceRow } from "@/lib/supabase/services/feesService";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { isManagementRole } from "@/lib/roles";

type Tab = "overview" | "attendance" | "wallet" | "health" | "discipline" | "fees" | "canteen" | "consent";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Overview",    icon: User },
  { key: "attendance",  label: "Attendance",  icon: Calendar },
  { key: "wallet",      label: "Wallet",      icon: Wallet },
  { key: "health",      label: "Health",      icon: Heart },
  { key: "discipline",  label: "Discipline",  icon: AlertTriangle },
  { key: "fees",        label: "Fees",        icon: CreditCard },
  { key: "canteen",     label: "Canteen",     icon: ShoppingBag },
  { key: "consent",     label: "Consent",     icon: CheckCircle },
];

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-400",
  ABSENT:  "text-red-500  bg-red-50  dark:bg-red-900/30  dark:text-red-400",
  LATE:    "text-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400",
  EXCUSED: "text-blue-500  bg-blue-50 dark:bg-blue-900/30  dark:text-blue-400",
};

const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100";

type LocalCard = {
  id: string;
  card_number: string;
  wallet_balance: number;
  is_frozen: boolean;
  is_active: boolean;
};

type LocalAttendance = {
  id: string;
  status: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  note: string | null;
};

type LocalProfile = {
  user: { first_name: string; last_name: string; email: string; phone: string | null; profile_photo: string | null };
  student_code: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  level: { name: string } | null;
  class: { name: string } | null;
  card: LocalCard | null;
  attendances: LocalAttendance[];
  health: HealthRecord[];
  discipline: DisciplineRecord[];
};

type LocalWalletTxn = {
  id: string;
  type: string;
  description: string | null;
  amount: number;
  created_at: string;
};

// ─── Add Health Modal ────────────────────────────────────────────────────────
function AddHealthModal({ studentId, schoolId, onClose, onSuccess }: { studentId: string; schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabaseHealthService.create(schoolId, {
        student_id: studentId,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        treatment_given: form.treatment_given || undefined,
        severity: form.severity as "LOW" | "MEDIUM" | "HIGH",
        follow_up_required: form.follow_up_required,
      });
      onSuccess();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">New Health Record</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inp}>
                {["ILLNESS", "INJURY", "MEDICATION", "CHECKUP", "ALLERGY"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inp}>
                {["LOW", "MEDIUM", "HIGH"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} placeholder="e.g. Asthma attack, Penicillin allergy" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Treatment Given</label>
            <input value={form.treatment_given} onChange={(e) => setForm({ ...form, treatment_given: e.target.value })} className={inp} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.follow_up_required} onChange={(e) => setForm({ ...form, follow_up_required: e.target.checked })} className="rounded" />
            Follow-up required
          </label>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium flex items-center justify-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Discipline Modal ────────────────────────────────────────────────────
function AddDisciplineModal({ studentId, schoolId, onClose, onSuccess }: { studentId: string; schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ type: "WARNING", title: "", description: "", action_taken: "", severity: "MINOR", marks_deducted: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function onSeverityChange(sev: string) {
    const defaultDeduction = sev === "SERIOUS" ? 5 : sev === "MODERATE" ? 3 : 1;
    setForm(f => ({ ...f, severity: sev, marks_deducted: defaultDeduction }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabaseDisciplineService.create(schoolId, {
        student_id: studentId,
        type: form.type,
        title: form.title,
        description: form.description || undefined,
        action_taken: form.action_taken || undefined,
        severity: form.severity as "MINOR" | "MODERATE" | "SERIOUS",
        marks_deducted: Number(form.marks_deducted) || 1,
      });
      onSuccess();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Record Discipline Infraction</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inp}>
                {["WARNING", "SUSPENSION", "MISCONDUCT", "RULE_VIOLATION", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Severity</label>
              <select value={form.severity} onChange={(e) => onSeverityChange(e.target.value)} className={inp}>
                {["MINOR", "MODERATE", "SERIOUS"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block flex justify-between">
              <span>Marks To Deduct (out of 40)</span>
              <span className="text-red-500 font-bold">-{form.marks_deducted} marks</span>
            </label>
            <input type="number" min="1" max="40" required value={form.marks_deducted}
              onChange={(e) => setForm({ ...form, marks_deducted: Math.min(40, Math.max(1, Number(e.target.value))) })}
              className={inp} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Offense Title *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} placeholder="e.g. Unexcused lateness / disruption" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Action Taken</label>
            <input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} className={inp} />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium flex items-center justify-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pay Invoice Modal ───────────────────────────────────────────────────────
function PayInvoiceModal({ studentId, schoolId, onClose, onSuccess }: { studentId: string; schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [invoices, setInvoices] = useState<FeeInvoiceRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    supabaseFeesService.listInvoices(schoolId, { studentId })
      .then(data => {
        const pending = data.filter(i => i.status !== "paid" && i.status !== "cancelled");
        setInvoices(pending);
        if (pending.length > 0) setSelectedId(pending[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, [schoolId, studentId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);
    try {
      const invoice = invoices.find(i => i.id === selectedId);
      if (!invoice) throw new Error("Invoice not found");
      const remaining = invoice.total_amount - invoice.amount_paid;
      await supabaseFeesService.payInvoice(schoolId, selectedId, {
        amount: remaining,
        channel: paymentMethod,
        phone: paymentMethod === "MOMO" ? phone : undefined,
      });
      onSuccess();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  const selectedInvoice = invoices.find(i => i.id === selectedId);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Pay Fee Invoice</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-3">
          {loadingInvoices ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No pending fee invoices for this student.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Invoice</label>
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inp}>
                  {invoices.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.title} — {(i.total_amount - i.amount_paid).toLocaleString()} RWF due
                    </option>
                  ))}
                </select>
              </div>
              {selectedInvoice && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-sm">
                  <p className="text-gray-600 dark:text-gray-300">Amount due: <strong>{(selectedInvoice.total_amount - selectedInvoice.amount_paid).toLocaleString()} RWF</strong></p>
                  {selectedInvoice.due_date && (
                    <p className="text-xs text-gray-400 mt-0.5">Due: {new Date(selectedInvoice.due_date).toLocaleDateString("en-GB")}</p>
                  )}
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inp}>
                  <option value="CASH">Cash</option>
                  <option value="MOMO">MTN MoMo</option>
                  <option value="BANK">Bank Transfer</option>
                </select>
              </div>
              {paymentMethod === "MOMO" && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">MoMo Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="250780000000" className={inp} />
                </div>
              )}
              {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium flex items-center justify-center gap-2">
                  {loading && <Loader2 size={13} className="animate-spin" />} Pay Now
                </button>
              </div>
            </form>
          )}
          {invoices.length === 0 && !loadingInvoices && (
            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600">Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const role = user?.role ?? "STUDENT";
  const { show } = useToast();

  const filteredTabs = TABS.filter((t) => {
    if (user?.role === "TEACHER") return !["wallet", "fees", "canteen"].includes(t.key);
    return true;
  });

  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [walletTxns, setWalletTxns] = useState<LocalWalletTxn[]>([]);
  const [feeList, setFeeList] = useState<FeeInvoiceRow[]>([]);
  const [canteenList, setCanteenList] = useState<CanteenTransactionRow[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [modal, setModal] = useState<null | "health" | "discipline" | "fee">(null);

  const [topupAmount, setTopupAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);
  const [scanResult, setScanResult] = useState<{ status: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const { scan: nfcScan, scanning: nfcScanning, isSupported: nfcSupported, error: nfcHookError } = useNFC();

  const studentId = params.id;

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const client = getSafeBrowserClient();
    if (!client) return;
    const schoolId = user.school_id;

    try {
      const { data: rpcData } = await client.rpc("list_school_students", {
        p_school_id: schoolId,
        p_class_section_id: null,
        p_search: null,
      });

      const row = (rpcData ?? []).find((r: { student_id: string }) => r.student_id === studentId);
      if (!row) { setLoading(false); return; }

      let walletBalance = 0;
      if (row.card_assignment_id) {
        const { data: cardRow } = await client
          .from("card_assignments")
          .select("wallet_balance")
          .eq("id", row.card_assignment_id)
          .eq("school_id", schoolId)
          .maybeSingle();
        walletBalance = cardRow?.wallet_balance ?? 0;
      }

      const { data: attData } = await client
        .from("attendance_records")
        .select("id, attendance_date, status, first_arrived_at, departed_at")
        .eq("school_id", schoolId)
        .eq("student_id", studentId)
        .order("attendance_date", { ascending: false })
        .limit(365);

      const [health, discipline] = await Promise.all([
        supabaseHealthService.studentList(schoolId, studentId).catch(() => [] as HealthRecord[]),
        supabaseDisciplineService.studentList(schoolId, studentId).catch(() => [] as DisciplineRecord[]),
      ]);

      const nameParts = (row.legal_name ?? "").trim().split(" ");
      const built: LocalProfile = {
        user: {
          first_name: nameParts[0] ?? "",
          last_name: nameParts.slice(1).join(" "),
          email: row.primary_email ?? "",
          phone: row.primary_phone ?? null,
          profile_photo: row.profile_photo_path ?? null,
        },
        student_code: row.admission_number,
        date_of_birth: row.date_of_birth ?? null,
        gender: row.gender ?? null,
        nationality: row.nationality ?? null,
        level: row.education_level_name ? { name: row.education_level_name } : null,
        class: row.class_section_name ? { name: row.class_section_name } : null,
        card: row.card_assignment_id ? {
          id: row.card_assignment_id,
          card_number: row.card_number ?? "",
          wallet_balance: walletBalance,
          is_frozen: row.card_status === "suspended",
          is_active: row.card_status === "active",
        } : null,
        attendances: (attData ?? []).map((a: { id: string; attendance_date: string; status: string; first_arrived_at: string | null; departed_at: string | null }) => ({
          id: a.id,
          status: a.status.toUpperCase(),
          date: a.attendance_date,
          check_in_time: a.first_arrived_at,
          check_out_time: a.departed_at,
          note: null,
        })),
        health,
        discipline,
      };
      setProfile(built);
    } catch (err) {
      console.error("Failed to load student profile:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    loadProfile();
  }, [authLoading, user, loadProfile]);

  useEffect(() => {
    if (authLoading || !user) return;
    const client = getSafeBrowserClient();
    if (!client) return;
    const schoolId = user.school_id;

    if (tab === "wallet" && profile?.card) {
      setTabLoading(true);
      Promise.resolve(
        client.from("wallet_transactions")
          .select("id, type, description, amount, created_at")
          .eq("school_id", schoolId)
          .eq("card_assignment_id", profile.card.id)
          .order("created_at", { ascending: false })
          .limit(50)
      ).then(({ data }) => setWalletTxns((data ?? []) as LocalWalletTxn[]))
       .catch(console.error)
       .finally(() => setTabLoading(false));
    }
    if (tab === "fees") {
      setTabLoading(true);
      supabaseFeesService.listInvoices(schoolId, { studentId })
        .then(data => setFeeList(data))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
    if (tab === "canteen") {
      setTabLoading(true);
      supabaseCanteenService.listStudentTransactions(schoolId, studentId, 50)
        .then(data => setCanteenList(data))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
  }, [tab, profile?.card?.id, studentId, authLoading, user]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.card || !user) return;
    const amt = parseInt(topupAmount, 10);
    if (isNaN(amt) || amt < 100) { show("Minimum top-up is 100 RWF", "error"); return; }
    setToppingUp(true);
    try {
      const newBalance = await supabaseCardService.topUpWallet(user.school_id, profile.card.id, amt);
      show(`${amt.toLocaleString()} RWF added to wallet`, "success");
      setTopupAmount("");
      setProfile(p => p && p.card ? { ...p, card: { ...p.card, wallet_balance: newBalance } } : p);
      const client = getSafeBrowserClient();
      if (client) {
        const { data } = await client.from("wallet_transactions")
          .select("id, type, description, amount, created_at")
          .eq("school_id", user.school_id)
          .eq("card_assignment_id", profile.card.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setWalletTxns((data ?? []) as LocalWalletTxn[]);
      }
    } catch (err) {
      show(err instanceof Error ? err.message : "Top-up failed", "error");
    } finally { setToppingUp(false); }
  }

  async function handleCardScan(_cardNumber: string) {
    if (scanning || !user) return;
    setScanning(true);
    setScanResult(null);
    try {
      await supabaseAttendanceService.recordStudentAttendance({
        schoolId: user.school_id,
        studentId,
        attendanceDate: new Date().toISOString().split("T")[0],
        status: "present",
      });
      const name = `${profile?.user?.first_name ?? ""} ${profile?.user?.last_name ?? ""}`.trim();
      setScanResult({ status: "PRESENT", name });
      show("Attendance marked: PRESENT", "success");
      await loadProfile();
    } catch (err) {
      show(err instanceof Error ? err.message : "Scan failed", "error");
    } finally { setScanning(false); }
  }

  async function freezeCard(doFreeze: boolean) {
    if (!profile?.card || !user) return;
    try {
      await supabaseCardService.changeCardStatus(
        user.school_id, profile.card.id,
        doFreeze ? "suspended" : "active",
        doFreeze ? "Frozen from student profile" : "Unfrozen from student profile"
      );
      show(doFreeze ? "Card frozen" : "Card unfrozen", "success");
      await loadProfile();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
  }

  async function issueCard() {
    if (!user) return;
    try {
      const qrToken = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      await supabaseCardService.issueCard({
        schoolId: user.school_id,
        holderKind: "student",
        studentId,
        identifierKind: "qr_token",
        identifier: qrToken,
      });
      show("IshuriHUB Card issued successfully", "success");
      await loadProfile();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
  }

  async function assignNFC() {
    setNfcError(null);
    if (!user) return;
    if (!nfcSupported) {
      setNfcError("Web NFC requires Chrome on Android. Use 'Issue with simulated NFC UID' on desktop.");
      return;
    }
    const result = await nfcScan();
    if (!result) return; // error already set by the hook
    const nfcUid = result.type === "uid" ? result.value : result.value.trim().toUpperCase().replace(/[^0-9A-F]/g, "");
    try {
      await supabaseCardService.issueCard({
        schoolId: user.school_id,
        holderKind: "student",
        studentId,
        identifierKind: "nfc_uid",
        identifier: nfcUid,
      });
      show("IshuriHUB Card issued and linked to NFC ✓", "success");
      setNfcError(null);
      await loadProfile();
    } catch (err) {
      setNfcError(err instanceof Error ? err.message : "Failed to issue card");
    }
  }

  async function simulateAssignNFC() {
    setNfcError(null);
    if (!user) return;
    try {
      await issueCard();
    } catch (err) {
      setNfcError(err instanceof Error ? err.message : "Failed to issue card");
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </DashboardShell>
    );
  }
  if (!profile || !profile.user) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-gray-400">
          <p className="font-semibold text-gray-600 dark:text-gray-300">Student not found</p>
          <p className="text-xs text-gray-400 mt-1">The requested student ID is not registered or unavailable.</p>
          <button onClick={() => router.push("/students")} className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold">
            Return to Students Directory
          </button>
        </div>
      </DashboardShell>
    );
  }

  const name = `${profile.user.first_name || ""} ${profile.user.last_name || ""}`.trim() || "Student";
  const initials = `${profile.user.first_name?.[0] || "S"}${profile.user.last_name?.[0] || ""}`;
  const attendances = profile.attendances || [];
  const attSummary = attendances.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>
  );
  const attRate = attendances.length > 0
    ? Math.round(((attSummary.PRESENT + attSummary.LATE) / attendances.length) * 100)
    : 0;
  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  return (
    <DashboardShell>
      {/* Modals */}
      {modal === "health" && (
        <AddHealthModal studentId={studentId} schoolId={user?.school_id ?? ""} onClose={() => setModal(null)} onSuccess={loadProfile} />
      )}
      {modal === "discipline" && (
        <AddDisciplineModal studentId={studentId} schoolId={user?.school_id ?? ""} onClose={() => setModal(null)} onSuccess={loadProfile} />
      )}
      {modal === "fee" && (
        <PayInvoiceModal studentId={studentId} schoolId={user?.school_id ?? ""} onClose={() => setModal(null)}
          onSuccess={() => supabaseFeesService.listInvoices(user?.school_id ?? "", { studentId }).then(setFeeList).catch(console.error)} />
      )}

      <div className="p-4 space-y-4 max-w-5xl">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
          <ArrowLeft size={15} /> Back to Students
        </button>

        {/* ── Profile Hero ────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-20 bg-[#121212] border-b border-[#dcd9d9]/20" />
          <div className="px-6 pb-5 -mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-4 border-white dark:border-gray-900 shadow-md">
                {profile.user.profile_photo ? (
                  <img src={profile.user.profile_photo} className="w-full h-full object-cover" alt={name} />
                ) : (
                  <div className="w-full h-full bg-[#121212] flex items-center justify-center text-white text-2xl font-bold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{name}</h1>
                <p className="text-sm text-gray-400">{profile.level?.name} · Class {profile.class?.name}</p>
                <p className="text-xs text-gray-400 font-mono">{profile.student_code}{age ? ` · ${age} years old` : ""}</p>
              </div>
            </div>
            <div className="pb-1 text-left sm:text-right">
              {profile.card ? (
                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <div className="flex items-center gap-1.5 justify-start sm:justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.card.is_frozen ? "bg-blue-50 text-blue-500" : "bg-green-50 text-green-600"}`}>
                      {profile.card.is_frozen ? "Frozen" : "Active"}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{profile.card.card_number}</span>
                  </div>
                  {user?.role !== "TEACHER" && (
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Wallet Balance</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                        {profile.card.wallet_balance.toLocaleString()} <span className="text-[10px] font-normal text-blue-500/80">RWF</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                user?.role !== "TEACHER" && (
                  <button onClick={issueCard} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-2 hover:bg-blue-50 transition">
                    <CreditCard size={14} /> Issue IshuriHUB Card
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 border-t border-gray-100 dark:border-gray-800">
            {[
              { label: "Attendance", value: `${attRate}%`, color: attRate >= 75 ? "text-green-600" : "text-red-500", icon: Activity },
              { label: "Days Present", value: attSummary.PRESENT, color: "text-green-600", icon: CheckCircle },
              { label: "Absences", value: attSummary.ABSENT, color: "text-red-500", icon: XCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center py-4 border-r border-gray-100 dark:border-gray-800 last:border-0">
                <Icon size={16} className={`${color} mb-1`} />
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
          {filteredTabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition whitespace-nowrap ${tab === key ? "bg-blue-50 text-blue-600 dark:bg-orange-900/30" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Personal Information</h3>
                <div className="space-y-0">
                  {[
                    ["Email", profile.user.email],
                    ["Phone", profile.user.phone ?? "—"],
                    ["Date of Birth", dob ? dob.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"],
                    ["Age", age ? `${age} years old` : "—"],
                    ["Gender", profile.gender === "M" ? "Male" : profile.gender === "F" ? "Female" : profile.gender ?? "—"],
                    ["Nationality", profile.nationality ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <span className="text-xs text-gray-400">{k}</span>
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-medium text-right max-w-xs truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                {/* IshuriHUB Card */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">IshuriHUB Card</h3>
                  {profile.card ? (
                    <div className="space-y-0">
                      {[
                        ["Card Number", profile.card.card_number],
                        user?.role !== "TEACHER" ? ["Balance", `${profile.card.wallet_balance.toLocaleString()} RWF`] : null,
                        ["Status", profile.card.is_frozen ? "Frozen" : profile.card.is_active ? "Active" : "Inactive"],
                      ].filter((item): item is [string, string] => item !== null).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                          <span className="text-xs text-gray-400">{k}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 font-medium font-mono">{v}</span>
                        </div>
                      ))}
                      {user?.role !== "TEACHER" && (
                        <div className="flex gap-2 pt-3">
                          <button onClick={() => setTab("wallet")} className="flex-1 py-2 rounded-xl bg-blue-600 text-xs text-white font-medium hover:bg-blue-700 transition">Top Up Wallet</button>
                          {profile.card.is_frozen
                            ? <button onClick={() => freezeCard(false)} className="flex-1 py-2 rounded-xl bg-green-500 text-xs text-white font-medium hover:bg-green-600 transition flex items-center justify-center gap-1">
                                <ThermometerSnowflake size={11} /> Unfreeze
                              </button>
                            : <button onClick={() => freezeCard(true)} className="flex-1 py-2 rounded-xl bg-blue-500 text-xs text-white font-medium hover:bg-blue-600 transition flex items-center justify-center gap-1">
                                <Snowflake size={11} /> Freeze
                              </button>
                          }
                        </div>
                      )}
                      {isManagementRole(user?.role) && (
                        <div className="pt-2">
                          <button onClick={assignNFC} disabled={nfcScanning}
                            className={`w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition disabled:opacity-70 ${nfcScanning ? "bg-[#121212] text-white animate-pulse" : "border border-[#dcd9d9] text-gray-600 hover:bg-gray-50"}`}>
                            {nfcScanning ? <Loader2 size={11} className="animate-spin" /> : <Nfc size={11} />}
                            {nfcScanning ? "Tap NFC card now…" : "Assign NFC Card"}
                          </button>
                          {(nfcError || nfcHookError) && (
                            <div className="mt-1.5 bg-amber-50 p-2 rounded-lg">
                              <p className="text-xs text-amber-700">{nfcError ?? nfcHookError}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CreditCard size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 mb-3">No card issued yet</p>
                      {isManagementRole(user?.role) && (
                        <div className="flex flex-col gap-2 items-center">
                          <button onClick={assignNFC} disabled={nfcScanning}
                            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-xl transition disabled:opacity-70 ${nfcScanning ? "bg-[#121212] text-white animate-pulse" : "bg-[#121212] text-white hover:bg-black"}`}>
                            {nfcScanning ? <Loader2 size={12} className="animate-spin" /> : <Nfc size={12} />}
                            {nfcScanning ? "Tap NFC card now…" : "Issue & Assign NFC Card"}
                          </button>
                          <button onClick={issueCard} className="text-xs text-gray-500 underline hover:text-gray-700 transition">Issue card without NFC</button>
                          <button onClick={simulateAssignNFC} className="text-xs text-blue-600 underline hover:text-blue-700 transition">Issue with random token (no NFC)</button>
                          {(nfcError || nfcHookError) && (
                            <div className="bg-amber-50 p-2.5 rounded-lg text-left max-w-xs">
                              <p className="text-xs text-amber-700">{nfcError ?? nfcHookError}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {user?.role !== "TEACHER" && user?.role !== "ADMIN" && (
                        <button onClick={issueCard} className="bg-blue-600 text-white text-xs px-4 py-2 rounded-xl hover:bg-blue-700 transition">Issue Card</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Medical highlights */}
                {profile.health.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Medical Alerts</h3>
                    <div className="space-y-2">
                      {profile.health.slice(0, 3).map((h) => (
                        <div key={h.id} className={`flex items-start gap-2 p-2.5 rounded-xl ${h.severity === "HIGH" ? "bg-red-50 dark:bg-red-900/20" : h.severity === "MEDIUM" ? "bg-orange-50 dark:bg-orange-900/20" : "bg-yellow-50 dark:bg-yellow-900/20"}`}>
                          <Heart size={13} className={h.severity === "HIGH" ? "text-red-500 mt-0.5" : h.severity === "MEDIUM" ? "text-orange-500 mt-0.5" : "text-yellow-500 mt-0.5"} />
                          <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{h.title}</p>
                            {h.description && <p className="text-xs text-gray-400 mt-0.5">{h.description}</p>}
                          </div>
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${h.severity === "HIGH" ? "bg-red-100 text-red-600" : h.severity === "MEDIUM" ? "bg-orange-100 text-orange-600" : "bg-yellow-100 text-yellow-700"}`}>{h.severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ATTENDANCE */}
          {tab === "attendance" && (
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="flex gap-3">
                  {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((s) => (
                    <div key={s} className={`px-3 py-2 rounded-xl text-center min-w-16 ${STATUS_COLOR[s]}`}>
                      <p className="text-lg font-bold">{attSummary[s] || 0}</p>
                      <p className="text-xs font-medium capitalize">{s.toLowerCase()}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Rate: <strong className={attRate >= 75 ? "text-green-600" : "text-red-500"}>{attRate}%</strong></p>
                  {profile.card && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Mark attendance:</span>
                      <VirtualCardTap onTap={handleCardScan} busy={scanning} />
                    </div>
                  )}
                </div>
              </div>

              {scanResult && (
                <div className={`mb-4 flex items-center gap-2 p-3 rounded-xl ${STATUS_COLOR[scanResult.status]}`}>
                  <CheckCircle size={16} />
                  <span className="text-sm font-medium">{scanResult.name} — {scanResult.status} marked today</span>
                </div>
              )}

              <div className="space-y-1.5">
                {profile.attendances.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">No attendance records yet</p>
                ) : profile.attendances.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5 px-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] || "text-gray-500 bg-gray-100"}`}>{r.status}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {r.check_in_time && (
                        <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-500" />
                          {new Date(r.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {r.check_out_time && (
                        <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400" />
                          {new Date(r.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WALLET */}
          {tab === "wallet" && (
            <div>
              {profile.card ? (
                <>
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5 text-white mb-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-white/70 mb-1">Current Balance</p>
                        <p className="text-4xl font-bold">{profile.card.wallet_balance.toLocaleString()}</p>
                        <p className="text-sm text-white/80">RWF</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-white/60">Card</p>
                        <p className="text-sm font-mono font-medium">{profile.card.card_number}</p>
                        <p className="text-xs text-white/60 mt-1">{profile.card.is_frozen ? "Frozen" : "Active"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Top Up Wallet (Cash)</h3>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {[1000, 2000, 5000, 10000].map((amt) => (
                        <button key={amt} onClick={() => setTopupAmount(String(amt))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${topupAmount === String(amt) ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-500"}`}>
                          {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleTopUp} className="flex gap-2">
                      <input type="number" min={100} value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)}
                        placeholder="Enter amount (RWF)" className={`${inp} flex-1`} />
                      <button type="submit" disabled={toppingUp || !topupAmount}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-2">
                        {toppingUp ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Top Up
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Wallet size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">No card issued — issue an IshuriHUB Card first</p>
                  <button onClick={issueCard} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">Issue Card</button>
                </div>
              )}

              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Transaction History</h3>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
              ) : walletTxns.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No transactions yet</p>
              ) : (
                <div className="space-y-0">
                  {walletTxns.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 capitalize">{t.description || t.type}</p>
                        <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.type === "purchase" ? "text-red-500" : "text-green-600"}`}>
                          {t.type === "purchase" ? "−" : "+"}{t.amount.toLocaleString()} RWF
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* HEALTH */}
          {tab === "health" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Health Records</h3>
                <button onClick={() => setModal("health")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> Add Record
                </button>
              </div>
              {profile.health.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No health records</p>
              ) : (
                <div className="space-y-2">
                  {profile.health.map((h) => (
                    <div key={h.id} className={`p-4 rounded-xl border ${h.severity === "HIGH" ? "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800" : h.severity === "MEDIUM" ? "border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800" : "border-gray-200 bg-gray-50 dark:bg-gray-800 dark:border-gray-700"}`}>
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{h.title}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${h.severity === "HIGH" ? "bg-red-100 text-red-600" : h.severity === "MEDIUM" ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-700"}`}>{h.severity}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">{h.type}</span>
                        </div>
                      </div>
                      {h.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{h.description}</p>}
                      {h.treatment_given && <p className="text-xs text-green-600 dark:text-green-400">Treatment: {h.treatment_given}</p>}
                      <div className="flex items-center gap-3 mt-2">
                        {h.follow_up_required && <span className="text-xs text-orange-500 flex items-center gap-1"><Clock size={10} /> Follow-up required</span>}
                        <span className="text-xs text-gray-400">{new Date(h.recorded_at).toLocaleDateString("en-GB")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DISCIPLINE */}
          {tab === "discipline" && (
            <div>
              {(() => {
                const discList = profile.discipline || [];
                const totalDeducted = discList.reduce((s, r) => s + (r.marks_deducted !== undefined ? Number(r.marks_deducted) : (r.severity === "SERIOUS" ? 5 : r.severity === "MODERATE" ? 3 : 1)), 0);
                const currentMarks = Math.max(0, 40 - totalDeducted);
                const marksColor = currentMarks >= 30 ? "text-green-600 dark:text-green-400" : currentMarks >= 20 ? "text-amber-500" : "text-red-600";
                const marksPct = (currentMarks / 40) * 100;
                return (
                  <div className="bg-gray-50 dark:bg-gray-800/80 rounded-2xl p-4 mb-4 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Conduct / Discipline Marks</span>
                        <p className="text-xs text-gray-400">Baseline 40 marks per academic term</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${marksColor}`}>{currentMarks}</span>
                        <span className="text-xs text-gray-400 font-medium"> / 40</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${marksPct}%`, background: currentMarks >= 30 ? "#16a34a" : currentMarks >= 20 ? "#d97706" : "#dc2626" }} />
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 font-medium">
                      <span>{discList.length} infraction{discList.length !== 1 ? "s" : ""} on record</span>
                      <span className="text-red-500 font-bold">-{totalDeducted} marks deducted</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Discipline Records</h3>
                <button onClick={() => setModal("discipline")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> Record Infraction
                </button>
              </div>
              {(profile.discipline || []).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No discipline records — full 40/40 conduct marks intact!</p>
              ) : (
                <div className="space-y-2">
                  {(profile.discipline || []).map((d) => {
                    const marks = d.marks_deducted !== undefined ? d.marks_deducted : (d.severity === "SERIOUS" ? 5 : d.severity === "MODERATE" ? 3 : 1);
                    return (
                      <div key={d.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.title}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                              -{marks} marks
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.severity === "SERIOUS" ? "bg-red-100 text-red-600" : d.severity === "MODERATE" ? "bg-orange-100 text-orange-600" : "bg-yellow-100 text-yellow-700"}`}>{d.severity}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">{d.type}</span>
                          </div>
                        </div>
                        {d.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{d.description}</p>}
                        {d.action_taken && <p className="text-xs text-blue-500">Action: {d.action_taken}</p>}
                        <p className="text-xs text-gray-400 mt-2">{new Date(d.recorded_at).toLocaleDateString("en-GB")}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FEES */}
          {tab === "fees" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Fee Invoices</h3>
                <button onClick={() => setModal("fee")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> Pay Invoice
                </button>
              </div>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
              ) : feeList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No fee invoices</p>
              ) : (
                feeList.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{f.title}</p>
                      <p className="text-xs text-gray-400">
                        {f.due_date ? `Due: ${new Date(f.due_date).toLocaleDateString("en-GB")} · ` : ""}
                        {new Date(f.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{f.total_amount.toLocaleString()} RWF</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "paid" ? "bg-green-50 text-green-600" : f.status === "pending" || f.status === "partial" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-500"}`}>
                        {f.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CANTEEN */}
          {tab === "canteen" && (
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-4">Canteen Purchase History</h3>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
              ) : canteenList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No canteen transactions yet</p>
              ) : (
                <div className="space-y-0">
                  {canteenList.map((t) => {
                    const items = (t.items as Array<{ name: string; price: number; quantity: number }>) ?? [];
                    return (
                      <div key={t.id} className="py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {items.length > 0
                                ? items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")
                                : "Canteen purchase"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">−{t.total_amount.toLocaleString()} RWF</p>
                            {t.wallet_balance_after !== null && (
                              <p className="text-xs text-gray-400">Balance: {t.wallet_balance_after.toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        {items.length > 1 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {items.map((i, idx) => (
                              <span key={idx} className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 px-2 py-0.5 rounded-lg">
                                {i.name} · {i.price.toLocaleString()} RWF
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CONSENT */}
          {tab === "consent" && (
            <div className="text-center py-10">
              <CheckCircle size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Consent records are managed by school administrators.</p>
              <p className="text-xs text-gray-400 mt-1">Guardian consent collection is available through the admin portal.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
