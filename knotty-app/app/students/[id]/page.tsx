"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CreditCard, Calendar, Wallet, AlertTriangle,
  Heart, FileText, Plus, Download, CheckCircle, XCircle, Clock,
  User, BookOpen, ShoppingBag, Snowflake, ThermometerSnowflake,
  X, Activity, Trash2
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import {
  students, cards, attendance, discipline, health, reports, fees, canteen,
  FullProfile, WalletTransaction, FeePayment, CanteenTransaction, AcademicReport, ConsentRecord
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type Tab = "overview" | "attendance" | "wallet" | "reports" | "health" | "discipline" | "fees" | "canteen" | "consent";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview",    label: "Overview",    icon: User },
  { key: "attendance",  label: "Attendance",  icon: Calendar },
  { key: "wallet",      label: "Wallet",      icon: Wallet },
  { key: "reports",     label: "Reports",     icon: BookOpen },
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

// ─── Add Health Modal ─────────────────────────────────────────────────────────
function AddHealthModal({ studentId, onClose, onSuccess }: { studentId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await health.create({ ...form, student_id: studentId }); onSuccess(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
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

// ─── Add Discipline Modal ─────────────────────────────────────────────────────
function AddDisciplineModal({ studentId, onClose, onSuccess }: { studentId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ type: "WARNING", title: "", description: "", action_taken: "", severity: "MINOR" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try { await discipline.create({ ...form, student_id: studentId }); onSuccess(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">New Discipline Record</h3>
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
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inp}>
                {["MINOR", "MODERATE", "SERIOUS"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} />
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

function RecordConsentModal({ studentId, guardianId, onClose, onSuccess }: { studentId: string; guardianId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ consent_type: "Medical Care", version: "1.0", document_url: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await students.recordConsent(studentId, {
        ...form,
        guardian_id: guardianId,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Record Guardian Consent</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Consent Type</label>
            <select value={form.consent_type} onChange={(e) => setForm({ ...form, consent_type: e.target.value })} className={inp}>
              {["Medical Care", "Media Release", "Field Trip", "Data Processing", "Other"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Version</label>
            <input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className={inp} placeholder="e.g. 1.0" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Signed Document URL (Optional)</label>
            <input value={form.document_url} onChange={(e) => setForm({ ...form, document_url: e.target.value })} className={inp} placeholder="e.g. https://example.com/consent.pdf" />
          </div>
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium flex items-center justify-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin" />} Save Consent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Collect Fee Modal ────────────────────────────────────────────────────────
function CollectFeeModal({ studentId, schoolId, onClose, onSuccess }: { studentId: string; schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ amount: "", payment_type: "TUITION", payment_method: "CASH", term: "TERM1", academic_year: "2025-2026", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fees.pay({ ...form, amount: parseInt(form.amount), student_id: studentId, school_id: schoolId });
      onSuccess(); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">Collect Fee Payment</h3>
          <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} className={inp}>
                {["TUITION", "ACTIVITY", "UNIFORM", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inp}>
                <option value="CASH">Cash</option>
                <option value="MOMO">MTN MoMo</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (RWF) *</label>
            <input type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inp} placeholder="e.g. 50000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Term</label>
              <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className={inp}>
                {["TERM1", "TERM2", "TERM3"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Academic Year</label>
              <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className={inp} />
            </div>
          </div>
          {form.payment_method === "MOMO" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">MoMo Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="250780000000" className={inp} />
            </div>
          )}
          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium flex items-center justify-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin" />} Collect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Report Modal ──────────────────────────────────────────────────────
const DEFAULT_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "English", "French", "Kinyarwanda", "History", "Geography",
  "Computer Science", "Entrepreneurship",
];

interface SubjectRow {
  id: number; name: string;
  cat: string; maxCat: string;
  exam: string; maxExam: string;
  remarks: string;
}

function gradeLabel(pct: number) {
  if (pct >= 80) return { letter: "A", color: "text-green-600 bg-green-50 dark:bg-green-900/30" };
  if (pct >= 70) return { letter: "B", color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" };
  if (pct >= 60) return { letter: "C", color: "text-orange-500 bg-orange-50 dark:bg-orange-900/30" };
  if (pct >= 50) return { letter: "D", color: "text-amber-500 bg-amber-50 dark:bg-amber-900/30" };
  if (pct >= 40) return { letter: "E", color: "text-purple-500 bg-purple-50 dark:bg-purple-900/30" };
  return { letter: "F", color: "text-red-500 bg-red-50 dark:bg-red-900/30" };
}

const DECISION_OPTIONS = [
  { value: "PROMOTED",      label: "Promoted",      color: "bg-green-50 text-green-700 border-green-200" },
  { value: "SECOND_SITTING", label: "Second Sitting", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { value: "REPEAT",        label: "Repeat Year",   color: "bg-red-50 text-red-700 border-red-200" },
];

function numCell(
  val: string, onChange: (v: string) => void,
  placeholder: string, cls?: string
) {
  return (
    <input
      type="text" inputMode="numeric" pattern="[0-9]*"
      value={val}
      onChange={(e) => {
        const v = e.target.value.replace(/[^0-9]/g, "");
        onChange(v);
      }}
      placeholder={placeholder}
      className={`border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1.5 text-xs text-center outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 w-full ${cls ?? ""}`}
    />
  );
}

function CreateReportModal({ studentId, classId, schoolId, onClose, onSuccess }: {
  studentId: string; classId: string; schoolId: string; onClose: () => void; onSuccess: () => void;
}) {
  const [term, setTerm] = useState("TERM1");
  const [year, setYear] = useState("2025-2026");
  const [conduct, setConduct] = useState("B");
  const [position, setPosition] = useState("");
  const [decision, setDecision] = useState("PROMOTED");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [principalRemarks, setPrincipalRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Global CAT/Exam max (applies to all rows unless overridden per-row)
  const [globalMaxCat, setGlobalMaxCat] = useState("30");
  const [globalMaxExam, setGlobalMaxExam] = useState("70");
  const [rows, setRows] = useState<SubjectRow[]>(() =>
    DEFAULT_SUBJECTS.map((name, i) => ({ id: i, name, cat: "", maxCat: "30", exam: "", maxExam: "70", remarks: "" }))
  );
  const [customSubject, setCustomSubject] = useState("");

  // Sync global max to all rows when changed
  function applyGlobalMaxCat(v: string) {
    setGlobalMaxCat(v);
    setRows((prev) => prev.map((r) => ({ ...r, maxCat: v })));
  }
  function applyGlobalMaxExam(v: string) {
    setGlobalMaxExam(v);
    setRows((prev) => prev.map((r) => ({ ...r, maxExam: v })));
  }

  // A row is "complete" only when BOTH cat AND exam are entered
  const filledRows = rows.filter((r) => r.name.trim() && r.cat !== "" && r.exam !== "");
  // Overall % = sum of all marks / sum of all max marks (same formula as per-subject)
  const totalScore = filledRows.reduce((a, r) => a + Number(r.cat) + Number(r.exam), 0);
  const totalMax   = filledRows.reduce((a, r) => a + (Number(r.maxCat) || 30) + (Number(r.maxExam) || 70), 0);
  const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : 0;
  const avgGrade = filledRows.length > 0 ? gradeLabel(avgPct) : null;

  function updateRow(id: number, field: keyof SubjectRow, value: string) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function addCustom() {
    const name = customSubject.trim();
    if (!name) return;
    setRows((prev) => [...prev, { id: Date.now(), name, cat: "", maxCat: globalMaxCat, exam: "", maxExam: globalMaxExam, remarks: "" }]);
    setCustomSubject("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (filledRows.length === 0) { setError("Enter marks for at least one subject."); return; }
    setLoading(true);
    setError("");

    const grades: Record<string, unknown> = Object.fromEntries(
      filledRows.map((r) => {
        const cat = Number(r.cat) || 0;
        const exam = Number(r.exam) || 0;
        const maxCat = Number(r.maxCat) || 30;
        const maxExam = Number(r.maxExam) || 70;
        const total = cat + exam;
        const maxTotal = maxCat + maxExam;
        const pct = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
        const grade = gradeLabel(pct).letter;
        return [r.name, { cat, exam, total, max_cat: maxCat, max_exam: maxExam, max_total: maxTotal, percentage: pct, grade, remarks: r.remarks || "" }];
      })
    );
    grades._meta = { decision };

    try {
      await reports.create({
        student_id: studentId,
        class_id: classId,
        school_id: schoolId,
        term,
        academic_year: year,
        grades,
        total_marks: totalScore,
        average: avgPct,
        position_in_class: position ? Number(position) : null,
        teacher_remarks: teacherRemarks || null,
        principal_remarks: principalRemarks || null,
        conduct_grade: conduct,
      });
      onSuccess();
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save report"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl mb-8">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-base">Term Report Card</h3>
            <p className="text-xs text-gray-400 mt-0.5">Enter CAT and Exam marks — totals and grades calculate automatically</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={submit}>
          {/* Meta row */}
          <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-gray-50 dark:border-gray-800">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Term</label>
              <select value={term} onChange={(e) => setTerm(e.target.value)} className={inp}>
                <option value="TERM1">Term 1</option>
                <option value="TERM2">Term 2</option>
                <option value="TERM3">Term 3</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Conduct</label>
              <select value={conduct} onChange={(e) => setConduct(e.target.value)} className={inp}>
                {["A","B","C","D"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Class Rank</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={position}
                onChange={(e) => setPosition(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 3" className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Decision</label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className={`${inp} font-semibold ${decision === "PROMOTED" ? "text-green-700" : decision === "SECOND_SITTING" ? "text-amber-700" : "text-red-700"}`}
              >
                {DECISION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Max marks config */}
          <div className="flex items-center gap-4 px-6 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 font-medium mr-auto">Mark Allocation (global — applies to all subjects)</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Max CAT:</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={globalMaxCat}
                onChange={(e) => applyGlobalMaxCat(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-14 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-500 dark:bg-gray-800" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Max Exam:</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={globalMaxExam}
                onChange={(e) => applyGlobalMaxExam(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-14 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-500 dark:bg-gray-800" />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              Total = {(Number(globalMaxCat) || 0) + (Number(globalMaxExam) || 0)}
            </span>
          </div>

          {/* Live average banner */}
          {filledRows.length > 0 && (
            <div className={`mx-6 mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl ${avgGrade?.color ?? ""}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{avgGrade?.letter}</span>
                <div>
                  <p className="text-sm font-semibold">{avgPct}% overall average</p>
                  <p className="text-xs opacity-70">{totalScore} / {totalMax} total marks · {filledRows.length} subject{filledRows.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-lg border text-xs font-semibold ${
                  decision === "PROMOTED" ? "bg-green-100 text-green-700 border-green-200" :
                  decision === "SECOND_SITTING" ? "bg-amber-100 text-amber-700 border-amber-200" :
                  "bg-red-100 text-red-700 border-red-200"
                }`}>
                  {DECISION_OPTIONS.find((d) => d.value === decision)?.label}
                </div>
                <div className="w-20 h-2 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-current opacity-60 transition-all" style={{ width: `${Math.min(avgPct, 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Subject rows */}
          <div className="px-6 py-3 space-y-1.5 max-h-72 overflow-y-auto">
            {/* Column headers */}
            <div className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr_0.6fr_1.2fr_28px] gap-1.5 px-1 mb-1">
              <span className="text-xs text-gray-400 font-medium">Subject</span>
              <span className="text-xs text-gray-400 font-medium text-center">CAT<span className="opacity-60 ml-0.5 text-[10px]">/{globalMaxCat}</span></span>
              <span className="text-xs text-gray-400 font-medium text-center">Exam<span className="opacity-60 ml-0.5 text-[10px]">/{globalMaxExam}</span></span>
              <span className="text-xs text-gray-400 font-medium text-center">Total</span>
              <span className="text-xs text-gray-400 font-medium text-center">%</span>
              <span className="text-xs text-gray-400 font-medium text-center">Grade</span>
              <span className="text-xs text-gray-400 font-medium">Remarks</span>
              <span />
            </div>

            {rows.map((row) => {
              const cat    = row.cat  !== "" ? Number(row.cat)  : null;
              const exam   = row.exam !== "" ? Number(row.exam) : null;
              const maxCat  = Number(row.maxCat)  || 30;
              const maxExam = Number(row.maxExam) || 70;
              const maxTotal = maxCat + maxExam;
              const total = (cat ?? 0) + (exam ?? 0);
              // % and Grade only when BOTH fields are filled
              const bothFilled = cat !== null && exam !== null;
              const pct = bothFilled ? Math.round((total / maxTotal) * 100) : null;
              const grd = pct !== null ? gradeLabel(pct) : null;
              // Show total once at least one field is filled
              const anyFilled = cat !== null || exam !== null;

              return (
                <div key={row.id} className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr_0.9fr_0.6fr_1.2fr_28px] gap-1.5 items-center group">
                  <input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, "name", e.target.value)}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 w-full"
                    placeholder="Subject name"
                  />
                  {/* CAT */}
                  {numCell(row.cat, (v) => updateRow(row.id, "cat", v), "—")}
                  {/* Exam */}
                  {numCell(row.exam, (v) => updateRow(row.id, "exam", v), "—")}
                  {/* Total — visible as soon as any mark is entered */}
                  <div className={`rounded-lg px-1.5 py-1.5 text-xs text-center font-semibold border ${anyFilled ? "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300" : "border-gray-100 text-gray-300 dark:border-gray-800"}`}>
                    {anyFilled ? total : "—"}
                  </div>
                  {/* % — only when BOTH filled */}
                  <div className={`rounded-lg px-1.5 py-1.5 text-xs text-center font-semibold border ${bothFilled ? (grd?.color ?? "border-gray-200 text-gray-600") : "border-gray-100 text-gray-300 dark:border-gray-800"}`}>
                    {pct !== null ? `${pct}%` : "—"}
                  </div>
                  {/* Grade — only when BOTH filled */}
                  <div className={`rounded-lg px-1.5 py-1.5 text-xs text-center font-bold border ${grd ? grd.color : "border-gray-100 text-gray-300 dark:border-gray-800"}`}>
                    {grd ? grd.letter : "—"}
                  </div>
                  {/* Remarks */}
                  <input
                    value={row.remarks}
                    onChange={(e) => updateRow(row.id, "remarks", e.target.value)}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100 w-full"
                    placeholder="Note…"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add custom subject */}
          <div className="px-6 pb-3">
            <div className="flex items-center gap-2">
              <input
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder="Add subject… (press Enter)"
                className="flex-1 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-400"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customSubject.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-500 text-blue-600 text-sm font-medium hover:bg-blue-50 disabled:opacity-40 transition"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* Remarks */}
          <div className="grid grid-cols-2 gap-3 px-6 pb-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Class Teacher's Remarks</label>
              <textarea
                value={teacherRemarks}
                onChange={(e) => setTeacherRemarks(e.target.value)}
                rows={2}
                className={`${inp} resize-none`}
                placeholder="e.g. Excellent student — performs consistently above average."
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Principal's Remarks</label>
              <textarea
                value={principalRemarks}
                onChange={(e) => setPrincipalRemarks(e.target.value)}
                rows={2}
                className={`${inp} resize-none`}
                placeholder="e.g. Keep up the good work."
              />
            </div>
          </div>

          {error && (
            <div className="mx-6 mb-4 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
              <X size={13} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 px-6 pb-6">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || filledRows.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              Save Report{filledRows.length > 0 ? ` (${filledRows.length} subjects)` : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Report Detail Card ───────────────────────────────────────────────────────
type GradeEntry = {
  cat?: number; exam?: number; total?: number;
  max_cat?: number; max_exam?: number; max_total?: number;
  percentage?: number; grade?: string; remarks?: string;
  // legacy flat format
  score?: number; max?: number;
};

function ReportCard({ report, onPublish, onDownload }: { report: AcademicReport; onPublish: () => void; onDownload: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const gradesRaw = report.grades as Record<string, GradeEntry>;
  const meta = (gradesRaw._meta ?? {}) as { decision?: string };
  const decision = meta.decision ?? null;
  const gradeEntries = Object.entries(gradesRaw).filter(([k]) => !k.startsWith("_"));
  const avg = report.average ?? 0;
  const { letter, color } = gradeLabel(avg);

  const decisionStyle =
    decision === "PROMOTED" ? "bg-green-50 text-green-700 border border-green-200" :
    decision === "SECOND_SITTING" ? "bg-amber-50 text-amber-700 border border-amber-200" :
    decision === "REPEAT" ? "bg-red-50 text-red-700 border border-red-200" : "";
  const decisionLabel =
    decision === "PROMOTED" ? "Promoted" :
    decision === "SECOND_SITTING" ? "2nd Sitting" :
    decision === "REPEAT" ? "Repeat Year" : null;

  // Detect new CAT/Exam format
  const isNewFormat = gradeEntries.length > 0 && gradeEntries[0][1].cat !== undefined;

  return (
    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-3">
      {/* Summary row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Grade badge */}
        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-bold ${color}`}>
          <span className="text-xl leading-none">{letter}</span>
          <span className="text-xs opacity-70">{avg.toFixed(1)}%</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
            {report.term.replace("TERM", "Term ")} · {report.academic_year}
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex-1 max-w-32 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color.includes("green") ? "bg-green-500" : color.includes("blue") ? "bg-blue-500" : color.includes("orange") ? "bg-orange-500" : color.includes("amber") ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(avg, 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400">{report.total_marks} marks</span>
            {report.position_in_class && <span className="text-xs text-purple-500 font-medium">#{report.position_in_class} in class</span>}
            {report.conduct_grade && <span className="text-xs text-gray-400">Conduct: <strong>{report.conduct_grade}</strong></span>}
            <span className="text-xs text-gray-400">{gradeEntries.length} subj.</span>
            {decisionLabel && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${decisionStyle}`}>{decisionLabel}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className={`text-xs px-2 py-0.5 rounded-full ${report.is_published ? "bg-green-50 text-green-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
            {report.is_published ? "Published" : "Draft"}
          </span>
          {!report.is_published && (
            <button onClick={onPublish} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
              Publish
            </button>
          )}
          <button onClick={onDownload} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
            <Download size={11} /> PDF
          </button>
        </div>
      </div>

      {/* Expanded grade table */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {gradeEntries.length > 0 ? (
            <>
              {/* Column header */}
              <div className={`grid gap-2 px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-400 font-medium ${isNewFormat ? "grid-cols-[1fr_52px_52px_52px_44px_36px_1fr]" : "grid-cols-[1fr_80px_44px_44px_1fr]"}`}>
                <span>Subject</span>
                {isNewFormat ? <>
                  <span className="text-center">CAT</span>
                  <span className="text-center">Exam</span>
                  <span className="text-center">Total</span>
                  <span className="text-center">%</span>
                  <span className="text-center">Grade</span>
                </> : <>
                  <span className="text-center">Score</span>
                  <span className="text-center">%</span>
                  <span className="text-center">Grade</span>
                </>}
                <span>Remarks</span>
              </div>

              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {gradeEntries.map(([subject, g]) => {
                  const pct = isNewFormat
                    ? (g.percentage ?? (g.max_total && g.max_total > 0 ? Math.round(((g.total ?? 0) / g.max_total) * 100) : 0))
                    : (g.max && g.max > 0 ? Math.round(((g.score ?? 0) / g.max) * 100) : 0);
                  const gradeLetter = isNewFormat ? (g.grade ?? gradeLabel(pct).letter) : gradeLabel(pct).letter;
                  const { color: c } = gradeLabel(pct);
                  return (
                    <div key={subject} className={`grid gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 items-center ${isNewFormat ? "grid-cols-[1fr_52px_52px_52px_44px_36px_1fr]" : "grid-cols-[1fr_80px_44px_44px_1fr]"}`}>
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{subject}</span>
                      {isNewFormat ? <>
                        <span className="text-xs text-center text-gray-600 dark:text-gray-400">{g.cat ?? "—"}<span className="opacity-40">/{g.max_cat}</span></span>
                        <span className="text-xs text-center text-gray-600 dark:text-gray-400">{g.exam ?? "—"}<span className="opacity-40">/{g.max_exam}</span></span>
                        <span className={`text-xs text-center font-semibold ${c.split(" ")[0]}`}>{g.total ?? "—"}</span>
                        <span className={`text-xs text-center font-semibold ${c.split(" ")[0]}`}>{pct}%</span>
                        <span className={`text-xs text-center font-bold rounded-lg py-0.5 ${c}`}>{gradeLetter}</span>
                      </> : <>
                        <span className={`text-sm font-bold text-center ${c.split(" ")[0]}`}>{g.score} <span className="text-xs text-gray-400 font-normal">/ {g.max}</span></span>
                        <span className={`text-xs text-center font-semibold ${c.split(" ")[0]}`}>{pct}%</span>
                        <span className={`text-xs text-center font-bold rounded-lg py-0.5 ${c}`}>{gradeLetter}</span>
                      </>}
                      <span className="text-xs text-gray-400 italic truncate">{g.remarks || ""}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No subject grades recorded</p>
          )}

          {/* Remarks footer */}
          {(report.teacher_remarks || report.principal_remarks) && (
            <div className="grid grid-cols-2 gap-0 border-t border-gray-100 dark:border-gray-800">
              {report.teacher_remarks && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-xs text-gray-400 mb-0.5">Class Teacher</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 italic">"{report.teacher_remarks}"</p>
                </div>
              )}
              {report.principal_remarks && (
                <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border-l border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-400 mb-0.5">Principal</p>
                  <p className="text-xs text-green-700 dark:text-green-300 italic">"{report.principal_remarks}"</p>
                </div>
              )}
            </div>
          )}

          {/* Decision banner */}
          {decision && (
            <div className={`px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 ${
              decision === "PROMOTED" ? "bg-green-50 dark:bg-green-900/20" :
              decision === "SECOND_SITTING" ? "bg-amber-50 dark:bg-amber-900/20" :
              "bg-red-50 dark:bg-red-900/20"
            }`}>
              <span className="text-xs text-gray-500">Decision:</span>
              <span className={`text-sm font-bold ${
                decision === "PROMOTED" ? "text-green-700" :
                decision === "SECOND_SITTING" ? "text-amber-700" :
                "text-red-700"
              }`}>
                {decision === "PROMOTED" ? "PROMOTED" : decision === "SECOND_SITTING" ? "SECOND SITTING" : "REPEAT YEAR"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const role = user?.role ?? "STUDENT";
  const { show } = useToast();

  const filteredTabs = TABS.filter((t) => {
    if (user?.role === "TEACHER") {
      return !["wallet", "fees", "canteen"].includes(t.key);
    }
    return true;
  });
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [walletTxns, setWalletTxns] = useState<WalletTransaction[]>([]);
  const [feeList, setFeeList] = useState<FeePayment[]>([]);
  const [canteenList, setCanteenList] = useState<CanteenTransaction[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [modal, setModal] = useState<null | "health" | "discipline" | "fee" | "report">(null);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [showRecordConsentModal, setShowRecordConsentModal] = useState(false);

  // Wallet top-up state (inline)
  const [topupAmount, setTopupAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);

  // Attendance scan state
  const [scanResult, setScanResult] = useState<{ status: string; name: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  const studentId = params.id;

  const reloadProfile = useCallback(() =>
    students.fullProfile(studentId).then((r) => setProfile(r.data)).catch(console.error),
    [studentId]
  );

  useEffect(() => {
    if (authLoading || !user) return;
    students.fullProfile(studentId)
      .then((r) => setProfile(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [studentId, authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (tab === "wallet" && profile?.card) {
      setTabLoading(true);
      cards.transactions(profile.card.id)
        .then((r) => setWalletTxns(r.data as WalletTransaction[]))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
    if (tab === "fees") {
      setTabLoading(true);
      fees.studentFees(studentId)
        .then((r) => setFeeList(r.data as FeePayment[]))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
    if (tab === "canteen") {
      setTabLoading(true);
      canteen.studentTransactions(studentId)
        .then((r) => setCanteenList(r.data as CanteenTransaction[]))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
    if (tab === "consent") {
      setTabLoading(true);
      students.consent(studentId)
        .then((r) => setConsentRecords(r.data))
        .catch(console.error)
        .finally(() => setTabLoading(false));
    }
  }, [tab, profile?.card?.id, studentId, authLoading, user]);

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.card) return;
    const amt = parseInt(topupAmount, 10);
    if (isNaN(amt) || amt < 100) { show("Minimum top-up is 100 RWF", "error"); return; }
    setToppingUp(true);
    try {
      await cards.topUpCash(profile.card.id, amt);
      show(`${amt.toLocaleString()} RWF added to wallet`, "success");
      setTopupAmount("");
      await reloadProfile();
      // Reload wallet transactions
      cards.transactions(profile.card.id).then((r) => setWalletTxns(r.data as WalletTransaction[])).catch(console.error);
    } catch (err) {
      show(err instanceof Error ? err.message : "Top-up failed", "error");
    } finally { setToppingUp(false); }
  }

  async function handleCardScan(cardNumber: string) {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await attendance.scan(cardNumber);
      const name = `${profile?.user.first_name ?? ""} ${profile?.user.last_name ?? ""}`.trim();
      setScanResult({ status: (res.data as { status: string }).status, name });
      show(`Attendance marked: ${(res.data as { status: string }).status}`, "success");
      await reloadProfile();
    } catch (err) {
      show(err instanceof Error ? err.message : "Scan failed", "error");
    } finally { setScanning(false); }
  }

  async function freezeCard(doFreeze: boolean) {
    if (!profile?.card) return;
    try {
      if (doFreeze) await cards.freeze(profile.card.id);
      else await cards.unfreeze(profile.card.id);
      show(doFreeze ? "Card frozen" : "Card unfrozen", "success");
      await reloadProfile();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
  }

  async function issueCard() {
    try {
      await cards.issue(studentId);
      show("KNOTTY Card issued successfully", "success");
      await reloadProfile();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
  }

  async function publishReport(id: string) {
    try {
      await reports.publish(id);
      show("Report published", "success");
      await reloadProfile();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
  }

  async function downloadReport(id: string) {
    try {
      const blob = await reports.downloadPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { show(err instanceof Error ? err.message : "PDF failed", "error"); }
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
  if (!profile) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-gray-400">Student not found.</div>
      </DashboardShell>
    );
  }

  const name = `${profile.user.first_name} ${profile.user.last_name}`;
  const initials = `${profile.user.first_name[0]}${profile.user.last_name[0]}`;
  const attSummary = profile.attendances.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>
  );
  const attRate = profile.attendances.length > 0
    ? Math.round(((attSummary.PRESENT + attSummary.LATE) / profile.attendances.length) * 100)
    : 0;
  const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  return (
    <DashboardShell>
      {/* Modals */}
      {modal === "health" && (
        <AddHealthModal studentId={studentId} onClose={() => setModal(null)} onSuccess={reloadProfile} />
      )}
      {modal === "discipline" && (
        <AddDisciplineModal studentId={studentId} onClose={() => setModal(null)} onSuccess={reloadProfile} />
      )}
      {modal === "fee" && (
        <CollectFeeModal studentId={studentId} schoolId={user?.school_id ?? ""} onClose={() => setModal(null)}
          onSuccess={() => fees.studentFees(studentId).then((r) => setFeeList(r.data as FeePayment[])).catch(console.error)} />
      )}
      {modal === "report" && (
        <CreateReportModal
          studentId={studentId}
          classId={profile.class?.id ?? ""}
          schoolId={user?.school_id ?? ""}
          onClose={() => setModal(null)}
          onSuccess={reloadProfile}
        />
      )}
      {showRecordConsentModal && profile?.parent && (
        <RecordConsentModal
          studentId={studentId}
          guardianId={profile.parent.id || profile.parent_id || ""}
          onClose={() => setShowRecordConsentModal(false)}
          onSuccess={() => {
            setTabLoading(true);
            students.consent(studentId)
              .then((r) => setConsentRecords(r.data))
              .catch(console.error)
              .finally(() => setTabLoading(false));
          }}
        />
      )}

      <div className="p-4 space-y-4 max-w-5xl">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
          <ArrowLeft size={15} /> Back to Students
        </button>

        {/* ── Profile Hero ────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
          {/* Black banner */}
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
                        {profile.card.wallet_balance.toLocaleString()} <span className="text-[10px] font-normal text-blue-500/80 dark:text-blue-400/80">RWF</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                user?.role !== "TEACHER" && (
                  <button onClick={issueCard} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-2 hover:bg-blue-50 transition">
                    <CreditCard size={14} /> Issue KNOTTY Card
                  </button>
                )
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 border-t border-gray-100 dark:border-gray-800">
            {[
              { label: "Attendance", value: `${attRate}%`, color: attRate >= 75 ? "text-green-600" : "text-red-500", icon: Activity },
              { label: "Days Present", value: attSummary.PRESENT, color: "text-green-600", icon: CheckCircle },
              { label: "Canteen Spends", value: profile.attendances.length > 0 ? `${profile.attendances.length}d` : "—", color: "text-blue-600", icon: ShoppingBag },
              { label: "Reports", value: profile.reports.length, color: "text-blue-500", icon: FileText },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center py-4 border-r border-gray-100 dark:border-gray-800 last:border-0">
                <Icon size={16} className={`${color} mb-1`} />
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
          {filteredTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition whitespace-nowrap ${tab === key ? "bg-blue-50 text-blue-600 dark:bg-orange-900/30" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal info */}
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

                {/* Parent info */}
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 mt-5">Parent / Guardian</h3>
                {profile.parent ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 space-y-1.5">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{profile.parent.first_name} {profile.parent.last_name}</p>
                    <p className="text-xs text-gray-500">{profile.parent.phone}</p>
                    <p className="text-xs text-gray-500">{profile.parent.email}</p>
                  </div>
                ) : <p className="text-sm text-gray-400">No parent linked</p>}
              </div>

              {/* Card & Medical */}
              <div className="space-y-5">
                {/* KNOTTY Card */}
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">KNOTTY Card</h3>
                  {profile.card ? (
                    <div className="space-y-0">
                      {[
                        ["Card Number", profile.card.card_number],
                        user?.role !== "TEACHER" ? ["Balance", `${profile.card.wallet_balance.toLocaleString()} RWF`] : null,
                        ["NFC UID", profile.card.nfc_uid ?? "Not linked"],
                        ["Status", profile.card.is_frozen ? "Frozen" : profile.card.is_active ? "Active" : "Inactive"],
                        ["Expires", new Date(profile.card.expires_at).toLocaleDateString("en-GB")],
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
                      {profile.card.qr_code && (
                        <div className="mt-3 flex justify-center">
                          <img src={profile.card.qr_code} alt="QR" className="w-28 h-28 object-contain rounded-xl border border-gray-100 dark:border-gray-800 p-2" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <CreditCard size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 mb-3">No card issued yet</p>
                      {user?.role !== "TEACHER" && (
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
              {/* Summary + VirtualTap */}
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">Attendance Rate: <strong className={attRate >= 75 ? "text-green-600" : "text-red-500"}>{attRate}%</strong></p>
                  {profile.card && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Mark attendance:</span>
                      <VirtualCardTap onTap={handleCardScan} busy={scanning} />
                    </div>
                  )}
                </div>
              </div>

              {/* Scan result flash */}
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status]}`}>{r.status}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        {new Date(r.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {r.check_in_time && (
                        <span className="flex items-center gap-1">
                          <CheckCircle size={10} className="text-green-500" />
                          {new Date(r.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {r.check_out_time && (
                        <span className="flex items-center gap-1">
                          <XCircle size={10} className="text-red-400" />
                          {new Date(r.check_out_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      {r.note && <span className="italic max-w-32 truncate">{r.note}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WALLET */}
          {tab === "wallet" && (
            <div>
              {/* Balance card */}
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
                        <p className="text-xs text-white/60 mt-1">{profile.card.is_frozen ? "🔒 Frozen" : "✓ Active"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inline top-up */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Top Up Wallet (Cash)</h3>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {[1000, 2000, 5000, 10000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setTopupAmount(String(amt))}
                          className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${topupAmount === String(amt) ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-500"}`}
                        >
                          {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleTopUp} className="flex gap-2">
                      <input
                        type="number" min={100} value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        placeholder="Enter amount (RWF)"
                        className={`${inp} flex-1`}
                      />
                      <button
                        type="submit" disabled={toppingUp || !topupAmount}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60 flex items-center gap-2"
                      >
                        {toppingUp ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Top Up
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Wallet size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">No card issued — issue a KNOTTY card first</p>
                  <button onClick={issueCard} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">Issue Card</button>
                </div>
              )}

              {/* Transaction history */}
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
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.description || t.type}</p>
                        <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString()} · {t.source}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${t.type === "DEDUCTION" ? "text-red-500" : "text-green-600"}`}>
                          {t.type === "DEDUCTION" ? "−" : "+"}{t.amount.toLocaleString()} RWF
                        </p>
                        <p className="text-xs text-gray-400">Balance: {t.balance_after.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REPORTS */}
          {tab === "reports" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-700 dark:text-gray-200">Academic Reports</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Click a report to expand subject grades</p>
                </div>
                <button onClick={() => setModal("report")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> New Report
                </button>
              </div>
              {profile.reports.length === 0 ? (
                <div className="text-center py-10">
                  <BookOpen size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">No academic reports yet</p>
                  <button onClick={() => setModal("report")} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition">Create First Report</button>
                </div>
              ) : (
                profile.reports.map((r) => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    onPublish={() => publishReport(r.id)}
                    onDownload={() => downloadReport(r.id)}
                  />
                ))
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Discipline Records</h3>
                <button onClick={() => setModal("discipline")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> Add Record
                </button>
              </div>
              {profile.discipline.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No discipline records — great student!</p>
              ) : (
                <div className="space-y-2">
                  {profile.discipline.map((d) => (
                    <div key={d.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{d.title}</p>
                        <div className="flex gap-1.5 flex-shrink-0 ml-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.severity === "SERIOUS" ? "bg-red-100 text-red-600" : d.severity === "MODERATE" ? "bg-orange-100 text-orange-600" : "bg-yellow-100 text-yellow-700"}`}>{d.severity}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500">{d.type}</span>
                        </div>
                      </div>
                      {d.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{d.description}</p>}
                      {d.action_taken && <p className="text-xs text-blue-500">Action: {d.action_taken}</p>}
                      <p className="text-xs text-gray-400 mt-2">{new Date(d.recorded_at).toLocaleDateString("en-GB")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FEES */}
          {tab === "fees" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Fee Payments</h3>
                <button onClick={() => setModal("fee")} className="flex items-center gap-1.5 text-sm text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition">
                  <Plus size={14} /> Collect Fee
                </button>
              </div>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
              ) : feeList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No fee records</p>
              ) : (
                feeList.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{f.payment_type} · {f.term} {f.academic_year}</p>
                      <p className="text-xs text-gray-400">{f.payment_method} · {new Date(f.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{f.amount.toLocaleString()} RWF</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${f.status === "COMPLETED" ? "bg-green-50 text-green-600" : f.status === "PENDING" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-500"}`}>{f.status}</span>
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
                    const items = t.items_purchased as Array<{ name: string; price: number; quantity: number }>;
                    return (
                      <div key={t.id} className="py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                              {items.map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`).join(", ")}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(t.transaction_time).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">−{t.total_amount.toLocaleString()} RWF</p>
                            <p className="text-xs text-gray-400">Balance: {t.wallet_balance_after.toLocaleString()}</p>
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
          {/* CONSENT RECORDS */}
          {tab === "consent" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Guardian Consent Registry</h3>
                {(role === "ADMIN" || role === "PARENT") && (
                  <button onClick={() => setShowRecordConsentModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-xl font-medium transition flex items-center gap-1">
                    <Plus size={12} /> Record Consent
                  </button>
                )}
              </div>
              {tabLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={20} /></div>
              ) : consentRecords.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No consent records logged for this student.</p>
              ) : (
                <div className="space-y-3">
                  {consentRecords.map((r) => (
                    <div key={r.id} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">{r.consent_type}</span>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1.5">Version: {r.version}</p>
                        <p className="text-xs text-gray-400">Granted by guardian: {r.guardian?.first_name} {r.guardian?.last_name} ({r.guardian?.email})</p>
                        <p className="text-xs text-gray-400">Granted at: {new Date(r.granted_at).toLocaleString()}</p>
                      </div>
                      {r.document_url && (
                        <a href={r.document_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 font-semibold hover:underline">
                          View Signed Doc
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
