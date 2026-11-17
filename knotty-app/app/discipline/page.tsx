"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wifi, WifiOff, Loader2, AlertTriangle, Shield, ShieldAlert,
  Plus, X, CheckCircle, Search, CreditCard, ChevronLeft, ChevronRight,
  Clock, History,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import type { DisciplineRecord } from "@/lib/api";
import { supabaseDisciplineService, supabaseLibraryService, supabaseCanteenService } from "@/lib/supabase/services";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

const TOTAL_MARKS = 40;

const SEV_STYLE: Record<string, { bg: string; text: string }> = {
  MINOR:    { bg: "var(--severity-minor-bg)", text: "var(--severity-minor-text)" },
  MODERATE: { bg: "var(--severity-moderate-bg)", text: "var(--severity-moderate-text)" },
  SERIOUS:  { bg: "var(--severity-serious-bg)", text: "var(--severity-serious-text)" },
};
const TYPE_LABEL: Record<string, string> = {
  WARNING:       "Warning",
  SUSPENSION:    "Suspension",
  MISCONDUCT:    "Misconduct",
  RULE_VIOLATION:"Rule Violation",
  OTHER:         "Other",
};

const DEFAULT_MARKS: Record<string, number> = {
  MINOR: 1,
  MODERATE: 3,
  SERIOUS:  5,
};

type ScannedStudent = {
  id: string;
  name: string;
  class: string;
  card_number: string | null;
  student_code: string;
  photo: string | null;
};

/* ── New Offense Modal ─────────────────────────────────────────── */
function OffenseModal({
  student,
  schoolId,
  onClose,
  onSuccess,
}: {
  student: ScannedStudent;
  schoolId: string;
  onClose: () => void;
  onSuccess: (record: DisciplineRecord) => void;
}) {
  const [form, setForm] = useState({
    type: "WARNING",
    severity: "MINOR",
    marks_deducted: 1,
    title: "",
    description: "",
    action_taken: "",
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function setSeverity(sev: string) {
    setForm((f) => ({ ...f, severity: sev, marks_deducted: DEFAULT_MARKS[sev] ?? 1 }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(true);
    try {
      const id = await supabaseDisciplineService.create(schoolId, {
        student_id: student.id,
        type: form.type,
        severity: form.severity as "MINOR" | "MODERATE" | "SERIOUS",
        marks_deducted: Number(form.marks_deducted),
        title: form.title,
        description: form.description || undefined,
        action_taken: form.action_taken || undefined,
      });
      const now = new Date().toISOString();
      const rec: DisciplineRecord = {
        id,
        type: form.type,
        severity: form.severity,
        marks_deducted: Number(form.marks_deducted),
        title: form.title,
        description: form.description || null,
        action_taken: form.action_taken || null,
        recorded_at: now,
        created_at: now,
        status: "OPEN",
        parent_notified: false,
      };
      toast(`Offense recorded · -${form.marks_deducted} marks`, "success");
      onSuccess(rec);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Record Offense</p>
            <p className="text-xs text-gray-400">{student.name} · {student.class}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>TYPE</p>
            <div className="grid grid-cols-3 gap-1.5">
              {["WARNING", "MISCONDUCT", "RULE_VIOLATION", "SUSPENSION", "OTHER"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className="py-1.5 px-2 rounded-xl text-xs font-medium border transition"
                  style={form.type === t
                    ? { background: "#121212", color: "#fff", borderColor: "#121212" }
                    : { background: "var(--card)", color: "var(--text-secondary)", borderColor: "var(--border)" }}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>SEVERITY</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["MINOR", "MODERATE", "SERIOUS"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className="py-1.5 rounded-xl text-xs font-semibold border transition"
                  style={form.severity === s
                    ? { background: SEV_STYLE[s].bg, color: SEV_STYLE[s].text, borderColor: SEV_STYLE[s].text }
                    : { background: "var(--card)", color: "var(--text-secondary)", borderColor: "var(--border)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Marks deducted */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>MARKS TO DEDUCT</p>
              <span className="text-xs font-bold text-red-500">-{form.marks_deducted} / {TOTAL_MARKS}</span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <input
                type="range"
                min={1}
                max={TOTAL_MARKS}
                value={form.marks_deducted}
                onChange={(e) => setForm((f) => ({ ...f, marks_deducted: Number(e.target.value) }))}
                className="flex-1 accent-red-500"
              />
              <input
                type="number"
                min={1}
                max={TOTAL_MARKS}
                value={form.marks_deducted}
                onChange={(e) => setForm((f) => ({ ...f, marks_deducted: Math.min(TOTAL_MARKS, Math.max(1, Number(e.target.value))) }))}
                className="w-14 text-center border border-gray-200 rounded-xl py-1.5 text-sm font-bold"
                style={{ color: "#C62828" }}
              />
            </div>
            {/* Quick preset buttons */}
            <div className="flex gap-1.5">
              {[1, 2, 3, 5, 10].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, marks_deducted: pts }))}
                  className={`flex-1 py-1 rounded-xl text-xs font-bold border transition ${form.marks_deducted === pts ? "bg-red-600 text-white border-red-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"}`}
                >
                  -{pts}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>OFFENSE TITLE *</p>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Fighting in the corridor"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>DESCRIPTION (optional)</p>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Brief details of the incident…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-gray-400"
            />
          </div>

          {/* Action taken */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>ACTION TAKEN (optional)</p>
            <input
              value={form.action_taken}
              onChange={(e) => setForm((f) => ({ ...f, action_taken: e.target.value }))}
              placeholder="e.g. Written warning issued, parent called"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-medium"
              style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title.trim()}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#C62828" }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><ShieldAlert size={14} /> Punish & Deduct</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function DisciplinePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  const [view, setView] = useState<"home" | "scan" | "records">("home");

  const [cardInput, setCardInput] = useState("");
  const [scanning, setScanning] = useState(false);

  const [student, setStudent]       = useState<ScannedStudent | null>(null);
  const [records, setRecords]       = useState<DisciplineRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showOffenseModal, setShowOffenseModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleAdjustMarks(recordId: string, delta: number) {
    if (!user?.school_id) return;
    const rec = records.find(r => r.id === recordId);
    if (!rec) return;
    const currentDeducted = rec.marks_deducted !== undefined ? Number(rec.marks_deducted) : (rec.severity === "SERIOUS" ? 5 : rec.severity === "MODERATE" ? 3 : 1);
    const newMarks = Math.min(TOTAL_MARKS, Math.max(0, currentDeducted + delta));
    setUpdatingId(recordId);
    setRecords(prev => prev.map(r => r.id === recordId ? { ...r, marks_deducted: newMarks } : r));
    try {
      await supabaseDisciplineService.update(user.school_id, recordId, { marks_deducted: newMarks });
      toast(`Marks updated: -${newMarks}`, "success");
      loadSchool();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update marks", "error");
      setRecords(prev => prev.map(r => r.id === recordId ? { ...r, marks_deducted: currentDeducted } : r));
    } finally {
      setUpdatingId(null);
    }
  }

  const [schoolRecords, setSchoolRecords]     = useState<DisciplineRecord[]>([]);
  const [schoolTotal, setSchoolTotal]         = useState(0);
  const [schoolPage, setSchoolPage]           = useState(1);
  const [schoolSearch, setSchoolSearch]       = useState("");
  const [schoolQuery, setSchoolQuery]         = useState("");
  const [schoolLoading, setSchoolLoading]     = useState(true);
  const LIMIT = 20;

  const processingRef = useRef(false);

  const loadStudentRecords = useCallback(async (studentId: string) => {
    if (!user?.school_id) return;
    setRecordsLoading(true);
    try {
      const res = await supabaseDisciplineService.studentList(user.school_id, studentId);
      setRecords(res);
    } catch { /* ignore */ }
    finally { setRecordsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.school_id]);

  async function handleCardScan(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current || !user?.school_id) return;
    processingRef.current = true;
    setScanning(true);
    try {
      let studentData: ScannedStudent;
      if (isNFC) {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cardNum.trim());
        if (!holder) throw new Error("Card not found or not active");
        studentData = {
          id: holder.student_id,
          name: holder.legal_name,
          class: [holder.education_level_name, holder.class_name].filter(Boolean).join(" "),
          card_number: holder.card_number,
          student_code: holder.admission_number,
          photo: holder.profile_photo_path ?? null,
        };
      } else {
        let scanned: ScannedStudent;
        try {
          scanned = await supabaseLibraryService.lookupStudent(user.school_id, cardNum.trim());
        } catch (origErr) {
          const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cardNum.trim()).catch(() => null);
          if (holder) {
            scanned = {
              id: holder.student_id,
              name: holder.legal_name,
              class: [holder.education_level_name, holder.class_name].filter(Boolean).join(" "),
              card_number: holder.card_number,
              student_code: holder.admission_number,
              photo: holder.profile_photo_path ?? null,
            };
          } else {
            throw origErr;
          }
        }
        studentData = scanned;
      }
      setStudent(studentData);
      setCardInput("");
      await loadStudentRecords(studentData.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Student not found", "error");
    } finally {
      setScanning(false);
      processingRef.current = false;
    }
  }

  const scanHandlerRef = useRef(handleCardScan);
  scanHandlerRef.current = handleCardScan;

  useEffect(() => {
    if (view !== "scan") { stopListen(); return; }
    if (!authLoading && isSupported) {
      startListen((result) => {
        scanHandlerRef.current(result.value, result.type === "uid");
      });
    }
    return () => { stopListen(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSupported, view]);

  const loadSchool = useCallback(async () => {
    if (!user?.school_id) return;
    setSchoolLoading(true);
    try {
      const res = await supabaseDisciplineService.schoolList(user.school_id, { page: schoolPage, limit: LIMIT, search: schoolQuery || undefined });
      setSchoolRecords(res);
      setSchoolTotal(res.length === LIMIT ? schoolPage * LIMIT + 1 : (schoolPage - 1) * LIMIT + res.length);
    } catch { /* ignore */ }
    finally { setSchoolLoading(false); }
  }, [schoolPage, schoolQuery, user?.school_id]);

  useEffect(() => { if (!authLoading) loadSchool(); }, [loadSchool, authLoading]);
  useEffect(() => {
    const t = setTimeout(() => { setSchoolQuery(schoolSearch); setSchoolPage(1); }, 400);
    return () => clearTimeout(t);
  }, [schoolSearch]);

  const totalDeducted = records.reduce((s, r) => s + (r.marks_deducted !== undefined ? Number(r.marks_deducted) : (r.severity === "SERIOUS" ? 5 : r.severity === "MODERATE" ? 3 : 1)), 0);
  const currentMarks  = Math.max(0, TOTAL_MARKS - totalDeducted);
  const marksPct      = (currentMarks / TOTAL_MARKS) * 100;
  const marksColor    = currentMarks >= 30 ? "#16a34a" : currentMarks >= 20 ? "#d97706" : "#dc2626";
  const schoolPages   = Math.ceil(schoolTotal / LIMIT);

  function goHome() {
    setView("home");
    setStudent(null);
    setRecords([]);
  }

  return (
    <DashboardShell>
      {showOffenseModal && student && (
        <OffenseModal
          student={student}
          schoolId={user?.school_id ?? ""}
          onClose={() => setShowOffenseModal(false)}
          onSuccess={(rec) => { setRecords((prev) => [rec, ...prev]); loadSchool(); }}
        />
      )}

      <div className="space-y-3">

        {/* Header */}
        <div className="flex items-center gap-3">
          {view !== "home" && (
            <button onClick={goHome}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-800">
              {view === "home" ? "Discipline" : view === "scan" ? "Scan Student" : "All Records"}
            </h1>
            {view === "home" && <p className="text-xs text-gray-400 mt-0.5">Student discipline management</p>}
          </div>
        </div>

        {/* Home: 2 blocks */}
        {view === "home" && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setView("scan")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FEF2F2" }}>
                <Shield size={20} style={{ color: "#C62828" }} />
              </div>
              <p className="text-sm font-semibold text-gray-700">Scan Student</p>
              <p className="text-xs text-gray-400 mt-0.5">View & record offenses</p>
            </button>

            <button onClick={() => setView("records")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#F9FAFB" }}>
                <ShieldAlert size={20} style={{ color: "#374151" }} />
              </div>
              {schoolLoading
                ? <div className="h-7 w-10 bg-gray-100 rounded-lg animate-pulse mb-0.5" />
                : <p className="text-2xl font-bold text-gray-800">{schoolTotal}</p>}
              <p className="text-sm font-semibold text-gray-700">All Records</p>
              <p className="text-xs text-gray-400 mt-0.5">School-wide discipline log</p>
            </button>
          </div>
        )}

        {/* Scan view */}
        {view === "scan" && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: listening ? "var(--severity-serious-bg)" : "#F5F5F5" }}>
                {scanning
                  ? <Loader2 size={32} className="animate-spin" style={{ color: "#C62828" }} />
                  : listening
                  ? <Shield size={32} className="animate-pulse" style={{ color: "#C62828" }} />
                  : <WifiOff size={32} style={{ color: "#ccc" }} />}
              </div>
              <p className="text-sm font-bold text-center text-gray-800">
                {scanning ? "Reading card…" : listening ? "Waiting for card tap…" : "NFC not available"}
              </p>
              <p className="text-xs text-center text-gray-400">
                {listening ? "Student holds NFC card or phone near device" : "Use manual entry below"}
              </p>
              <div className="w-full flex gap-2 pt-1">
                <input value={cardInput} onChange={(e) => setCardInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCardScan(cardInput)}
                  placeholder="Card number…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono outline-none" />
                <button onClick={() => handleCardScan(cardInput)} disabled={scanning || !cardInput.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--bg)" }}>
                  {scanning ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={13} />}
                </button>
              </div>
              <VirtualCardTap onTap={(cn) => handleCardScan(cn)} busy={scanning} />
            </div>

            {student && (
              <>
                <div className="bg-white rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {student.photo
                      ? <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                      : <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-lg font-bold"
                          style={{ background: "var(--surface-muted)", color: "var(--text-primary)" }}>
                          {student.name.charAt(0)}
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{student.name}</p>
                      <p className="text-xs text-gray-400">{student.class} · {student.student_code}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold" style={{ color: marksColor }}>{currentMarks}<span className="text-xs font-normal text-gray-400">/{TOTAL_MARKS}</span></p>
                      <p className="text-xs text-gray-400">marks left</p>
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden mb-4">
                    <div className="h-full rounded-full transition-all" style={{ width: `${marksPct}%`, background: marksColor }} />
                  </div>
                  <button onClick={() => setShowOffenseModal(true)}
                    className="w-full py-2.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                    style={{ background: "#C62828" }}>
                    <Plus size={14} /> Record New Offense
                  </button>
                </div>

                <div className="bg-white rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Offense History</p>
                    <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="p-4">
                    {recordsLoading ? (
                      <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                    ) : records.length === 0 ? (
                      <div className="flex flex-col items-center py-10">
                        <CheckCircle size={32} className="mb-2 text-green-300" />
                        <p className="text-sm font-medium text-green-500">No offenses on record</p>
                        <p className="text-xs mt-1 text-gray-400">Clean discipline record</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {records.map((r) => {
                          const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.MINOR;
                          return (
                            <div key={r.id} className="rounded-2xl p-3" style={{ background: "var(--surface-muted)" }}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>{r.severity}</span>
                                    <span className="text-xs text-gray-400">{TYPE_LABEL[r.type] ?? r.type}</span>
                                  </div>
                                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.title}</p>
                                  {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                                  {r.action_taken && <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>→ {r.action_taken}</p>}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(r.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    {r.recorder && ` · ${r.recorder.first_name} ${r.recorder.last_name}`}
                                  </p>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                  <div className="text-right">
                                    <span className="text-sm font-bold text-red-500">
                                      -{r.marks_deducted !== undefined ? r.marks_deducted : (r.severity === "SERIOUS" ? 5 : r.severity === "MODERATE" ? 3 : 1)}
                                    </span>
                                    <p className="text-[10px] text-gray-400">marks</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9px] font-bold text-gray-400">Deduct:</span>
                                    {[1, 2, 5].map((pts) => (
                                      <button key={pts} type="button" disabled={updatingId === r.id} onClick={() => handleAdjustMarks(r.id, pts)}
                                        className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold border transition hover:bg-red-50 disabled:opacity-40"
                                        style={{ borderColor: "#FECACA", color: "#C62828", background: "#FEF2F2" }}>
                                        -{pts}
                                      </button>
                                    ))}
                                    <button type="button" disabled={updatingId === r.id || (r.marks_deducted ?? 0) <= 0} onClick={() => handleAdjustMarks(r.id, -1)}
                                      className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold border transition hover:bg-green-50 disabled:opacity-30"
                                      style={{ borderColor: "#BBF7D0", color: "#166534", background: "#F0FDF4" }}>
                                      +1
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Records view */}
        {view === "records" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <Search size={12} className="text-gray-400 shrink-0" />
              <input value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)}
                placeholder="Search by student, offense…"
                className="flex-1 text-xs bg-transparent outline-none" />
              {schoolSearch && <button onClick={() => setSchoolSearch("")}><X size={11} className="text-gray-400" /></button>}
            </div>

            {schoolLoading ? (
              <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
            ) : schoolRecords.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-300">
                <AlertTriangle size={32} className="mb-2" />
                <p className="text-sm">{schoolSearch ? "No records match" : "No discipline records"}</p>
              </div>
            ) : (() => {
              const today = new Date().toDateString();
              const yesterday = new Date(Date.now() - 86400000).toDateString();
              const grouped: Record<string, typeof schoolRecords> = {};
              schoolRecords.forEach((r) => {
                const d = new Date(r.recorded_at);
                const key = d.toDateString() === today ? "Today"
                  : d.toDateString() === yesterday ? "Yesterday"
                  : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                (grouped[key] ??= []).push(r);
              });
              return (
                <div className="space-y-4">
                  {Object.entries(grouped).map(([dateLabel, recs]) => (
                    <div key={dateLabel}>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{dateLabel}</p>
                      <div className="space-y-2">
                        {recs.map((r) => {
                          const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.MINOR;
                          const studentName = r.student ? `${r.student.user.first_name} ${r.student.user.last_name}`.trim() : null;
                          const visitCount = r.student_visit_count ?? 0;
                          return (
                            <div key={r.id} className="bg-white rounded-2xl p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>{r.severity}</span>
                                    <span className="text-xs text-gray-400">{TYPE_LABEL[r.type] ?? r.type}</span>
                                    {studentName && <span className="text-xs font-semibold text-gray-700">{studentName}</span>}
                                    {visitCount > 1 && (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-orange-50 text-orange-600">
                                        <History size={9} /> #{visitCount}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium truncate text-gray-700">{r.title}</p>
                                  {r.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.description}</p>}
                                  {r.action_taken && <p className="text-xs mt-0.5 truncate text-gray-500">→ {r.action_taken}</p>}
                                  <p className="text-xs text-gray-400 mt-1">
                                    <Clock size={10} className="inline mr-1" />
                                    {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                                    {r.student_code && ` · ${r.student_code}`}
                                  </p>
                                </div>
                                {(r.marks_deducted ?? 0) > 0 && (
                                  <span className="text-sm font-bold text-red-500 shrink-0">-{r.marks_deducted}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {schoolPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-gray-400">Page {schoolPage} of {schoolPages}</p>
                      <div className="flex gap-1">
                        <button disabled={schoolPage === 1} onClick={() => setSchoolPage((p) => p - 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40">
                          <ChevronLeft size={12} />
                        </button>
                        <button disabled={schoolPage === schoolPages} onClick={() => setSchoolPage((p) => p + 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40">
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
