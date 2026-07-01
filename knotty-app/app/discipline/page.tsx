"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Wifi, WifiOff, Loader2, AlertTriangle, Shield, ShieldAlert,
  Plus, X, CheckCircle, Search, CreditCard, ChevronLeft, ChevronRight,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { cards, discipline, DisciplineRecord, CardScanResult } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

const TOTAL_MARKS = 40;

const SEV_STYLE: Record<string, { bg: string; text: string }> = {
  MINOR:    { bg: "#FFF9C4", text: "#856404" },
  MODERATE: { bg: "#FFF3E0", text: "#E65100" },
  SERIOUS:  { bg: "#FFEBEE", text: "#C62828" },
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

type ScannedStudent = CardScanResult["student"];

/* ── New Offense Modal ─────────────────────────────────────────── */
function OffenseModal({
  student,
  onClose,
  onSuccess,
}: {
  student: ScannedStudent;
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
      const res = await discipline.create({
        student_id: student.id,
        type: form.type,
        severity: form.severity,
        marks_deducted: Number(form.marks_deducted),
        title: form.title,
        description: form.description || undefined,
        action_taken: form.action_taken || undefined,
      });
      toast(`Offense recorded · -${form.marks_deducted} marks`, "success");
      onSuccess(res.data);
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
            <p className="font-bold text-sm" style={{ color: "#121212" }}>Record Offense</p>
            <p className="text-xs text-gray-400">{student.name} · {student.class}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Type */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "#666" }}>TYPE</p>
            <div className="grid grid-cols-3 gap-1.5">
              {["WARNING", "MISCONDUCT", "RULE_VIOLATION", "SUSPENSION", "OTHER"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className="py-1.5 px-2 rounded-xl text-xs font-medium border transition"
                  style={form.type === t
                    ? { background: "#121212", color: "#fff", borderColor: "#121212" }
                    : { background: "#fff", color: "#666", borderColor: "#e5e5e5" }}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "#666" }}>SEVERITY</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["MINOR", "MODERATE", "SERIOUS"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  className="py-1.5 rounded-xl text-xs font-semibold border transition"
                  style={form.severity === s
                    ? { background: SEV_STYLE[s].bg, color: SEV_STYLE[s].text, borderColor: SEV_STYLE[s].text }
                    : { background: "#fff", color: "#999", borderColor: "#e5e5e5" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Marks deducted */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: "#666" }}>MARKS TO DEDUCT</p>
              <span className="text-xs font-bold text-red-500">-{form.marks_deducted} / {TOTAL_MARKS}</span>
            </div>
            <div className="flex items-center gap-3">
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
          </div>

          {/* Title */}
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>OFFENSE TITLE *</p>
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
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>DESCRIPTION (optional)</p>
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
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>ACTION TAKEN (optional)</p>
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
              style={{ background: "#F5F5F5", color: "#666" }}
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
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  /* ── Scanner state ─────────────────────────────────────────── */
  const [cardInput, setCardInput] = useState("");
  const [scanning, setScanning] = useState(false);

  /* ── Student + records ─────────────────────────────────────── */
  const [student, setStudent]       = useState<ScannedStudent | null>(null);
  const [records, setRecords]       = useState<DisciplineRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [showOffenseModal, setShowOffenseModal] = useState(false);

  /* ── School-wide list (bottom) ─────────────────────────────── */
  const [schoolRecords, setSchoolRecords]     = useState<DisciplineRecord[]>([]);
  const [schoolTotal, setSchoolTotal]         = useState(0);
  const [schoolPage, setSchoolPage]           = useState(1);
  const [schoolSearch, setSchoolSearch]       = useState("");
  const [schoolQuery, setSchoolQuery]         = useState("");
  const [schoolLoading, setSchoolLoading]     = useState(true);
  const LIMIT = 20;

  /* ── Processing guard ──────────────────────────────────────── */
  const processingRef = useRef(false);

  /* ── Fetch records for scanned student ─────────────────────── */
  const loadStudentRecords = useCallback(async (studentId: string) => {
    setRecordsLoading(true);
    try {
      const res = await discipline.studentList(studentId);
      setRecords(res.data as DisciplineRecord[]);
    } catch { /* ignore */ }
    finally { setRecordsLoading(false); }
  }, []);

  /* ── Card scan handler ─────────────────────────────────────── */
  async function handleCardScan(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current) return;
    processingRef.current = true;
    setScanning(true);
    try {
      const res = isNFC
        ? await cards.scanNFC(cardNum)
        : await cards.scan(cardNum.trim());
      const scanned = res.data.student;
      setStudent(scanned);
      setCardInput("");
      await loadStudentRecords(scanned.id);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Card not found", "error");
    } finally {
      setScanning(false);
      processingRef.current = false;
    }
  }

  // Ref so the NFC callback always calls the latest handleCardScan (avoids stale closure)
  const scanHandlerRef = useRef(handleCardScan);
  scanHandlerRef.current = handleCardScan;

  /* ── Start NFC on mount ────────────────────────────────────── */
  useEffect(() => {
    if (!authLoading && isSupported) {
      startListen((result) => {
        scanHandlerRef.current(result.value, result.type === "uid");
      });
    }
    return () => { stopListen(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isSupported]);

  /* ── School-wide records ───────────────────────────────────── */
  const loadSchool = useCallback(async () => {
    if (authLoading) return;
    setSchoolLoading(true);
    try {
      const res = await discipline.schoolList({ page: schoolPage, limit: LIMIT, search: schoolQuery || undefined });
      setSchoolRecords(res.data as DisciplineRecord[]);
      setSchoolTotal((res.pagination as { total: number }).total);
    } catch { /* ignore */ }
    finally { setSchoolLoading(false); }
  }, [schoolPage, schoolQuery, authLoading]);

  useEffect(() => { loadSchool(); }, [loadSchool]);
  useEffect(() => {
    const t = setTimeout(() => { setSchoolQuery(schoolSearch); setSchoolPage(1); }, 400);
    return () => clearTimeout(t);
  }, [schoolSearch]);

  /* ── Computed marks ────────────────────────────────────────── */
  const totalDeducted = records.reduce((s, r) => s + (r.marks_deducted ?? 0), 0);
  const currentMarks  = Math.max(0, TOTAL_MARKS - totalDeducted);
  const marksPct      = (currentMarks / TOTAL_MARKS) * 100;
  const marksColor    = currentMarks >= 30 ? "#16a34a" : currentMarks >= 20 ? "#d97706" : "#dc2626";

  const schoolPages = Math.ceil(schoolTotal / LIMIT);

  return (
    <DashboardShell>
      {showOffenseModal && student && (
        <OffenseModal
          student={student}
          onClose={() => setShowOffenseModal(false)}
          onSuccess={(rec) => {
            setRecords((prev) => [rec, ...prev]);
            loadSchool();
          }}
        />
      )}

      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#121212" }}>Discipline</h1>
            <p className="text-xs" style={{ color: "#666" }}>Tap student card to view records</p>
          </div>
        </div>

        <div className="flex flex-1 gap-3 px-3 md:px-4 pb-3 md:pb-4 overflow-hidden min-h-0 flex-col lg:flex-row">

          {/* ── LEFT: Scanner ─────────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">

            {/* NFC panel */}
            <div className="bg-white rounded-3xl p-5 flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: listening ? "#FEE2E2" : "#F5F5F5" }}
              >
                {scanning
                  ? <Loader2 size={32} className="animate-spin" style={{ color: "#C62828" }} />
                  : listening
                  ? <Shield size={32} className="animate-pulse" style={{ color: "#C62828" }} />
                  : <WifiOff size={32} style={{ color: "#ccc" }} />}
              </div>
              <p className="text-sm font-bold text-center" style={{ color: "#121212" }}>
                {scanning ? "Reading card…" : listening ? "Waiting for card tap…" : "NFC not available"}
              </p>
              <p className="text-xs text-center text-gray-400">
                {listening
                  ? "Student holds NFC card or phone near device"
                  : "Use manual card entry below"}
              </p>

              {/* Manual entry */}
              <div className="w-full flex gap-2 pt-1">
                <input
                  value={cardInput}
                  onChange={(e) => setCardInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCardScan(cardInput)}
                  placeholder="Card number…"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono outline-none"
                />
                <button
                  onClick={() => handleCardScan(cardInput)}
                  disabled={scanning || !cardInput.trim()}
                  className="px-3 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                  style={{ background: "#121212" }}
                >
                  {scanning ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={13} />}
                </button>
              </div>

              <VirtualCardTap onTap={(cn) => handleCardScan(cn)} busy={scanning} />
            </div>

            {/* Student card (desktop side panel) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 hidden lg:block">
                <div className="flex items-center gap-3 mb-4">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
                    : (
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
                        style={{ background: "#F5F5F5", color: "#121212" }}>
                        {student.name.charAt(0)}
                      </div>
                    )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class}</p>
                    <p className="text-xs text-gray-400">{student.student_code}</p>
                  </div>
                </div>

                {/* Marks score */}
                <div className="rounded-2xl p-3 mb-3" style={{ background: "#F5F5F5" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: "#666" }}>DISCIPLINE MARKS</span>
                    <span className="text-lg font-bold" style={{ color: marksColor }}>{currentMarks}<span className="text-xs font-normal text-gray-400">/{TOTAL_MARKS}</span></span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${marksPct}%`, background: marksColor }} />
                  </div>
                  {totalDeducted > 0 && (
                    <p className="text-xs text-gray-400 mt-1.5">{totalDeducted} marks deducted across {records.length} offense{records.length !== 1 ? "s" : ""}</p>
                  )}
                </div>

                <button
                  onClick={() => setShowOffenseModal(true)}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: "#C62828" }}
                >
                  <Plus size={14} /> Record New Offense
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT: Student detail + records ───────────────── */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">

            {/* Student card (mobile, shows after scan) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 lg:hidden flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" />
                    : (
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 font-bold"
                        style={{ background: "#F5F5F5", color: "#121212" }}>
                        {student.name.charAt(0)}
                      </div>
                    )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class} · {student.student_code}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold" style={{ color: marksColor }}>{currentMarks}<span className="text-xs font-normal text-gray-400">/{TOTAL_MARKS}</span></p>
                    <p className="text-xs text-gray-400">marks left</p>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${marksPct}%`, background: marksColor }} />
                </div>
                <button
                  onClick={() => setShowOffenseModal(true)}
                  className="w-full py-2.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: "#C62828" }}
                >
                  <Plus size={14} /> Record New Offense
                </button>
              </div>
            )}

            {/* Student records or empty/no-scan state */}
            {student ? (
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#121212" }}>Offense History</p>
                  <p className="text-xs text-gray-400">{records.length} record{records.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {recordsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : records.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-gray-300">
                      <CheckCircle size={32} className="mb-2 text-green-300" />
                      <p className="text-sm font-medium text-green-500">No offenses on record</p>
                      <p className="text-xs mt-1">This student has a clean discipline record</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {records.map((r) => {
                        const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.MINOR;
                        return (
                          <div key={r.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>
                                    {r.severity}
                                  </span>
                                  <span className="text-xs text-gray-400">{TYPE_LABEL[r.type] ?? r.type}</span>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: "#121212" }}>{r.title}</p>
                                {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                                {r.action_taken && <p className="text-xs mt-0.5" style={{ color: "#666" }}>→ {r.action_taken}</p>}
                                <p className="text-xs text-gray-400 mt-1">
                                  {new Date(r.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  {r.recorder && ` · ${r.recorder.first_name} ${r.recorder.last_name}`}
                                </p>
                              </div>
                              {(r.marks_deducted ?? 0) > 0 && (
                                <div className="flex-shrink-0 text-right">
                                  <span className="text-sm font-bold text-red-500">-{r.marks_deducted}</span>
                                  <p className="text-xs text-gray-400">marks</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* No student scanned yet — show school-wide list */
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#121212" }}>All Records</p>
                    <p className="text-xs text-gray-400">{schoolTotal} total</p>
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2.5 py-1.5">
                    <Search size={12} style={{ color: "#999" }} />
                    <input
                      value={schoolSearch}
                      onChange={(e) => setSchoolSearch(e.target.value)}
                      placeholder="Search…"
                      className="text-xs bg-transparent outline-none w-28"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {schoolLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : schoolRecords.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-gray-300">
                      <AlertTriangle size={32} className="mb-2" />
                      <p className="text-sm">No discipline records</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {schoolRecords.map((r) => {
                        const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.MINOR;
                        return (
                          <div key={r.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>
                                    {r.severity}
                                  </span>
                                  {r.student && (
                                    <span className="text-xs font-semibold" style={{ color: "#121212" }}>
                                      {r.student.user.first_name} {r.student.user.last_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium" style={{ color: "#444" }}>{r.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(r.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  {r.recorder && ` · ${r.recorder.first_name} ${r.recorder.last_name}`}
                                </p>
                              </div>
                              {(r.marks_deducted ?? 0) > 0 && (
                                <span className="text-sm font-bold text-red-500 flex-shrink-0">-{r.marks_deducted}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {schoolPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                    <p className="text-xs text-gray-400">Page {schoolPage} of {schoolPages}</p>
                    <div className="flex gap-1">
                      <button disabled={schoolPage === 1} onClick={() => setSchoolPage((p) => p - 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40">
                        <ChevronLeft size={12} />
                      </button>
                      <button disabled={schoolPage === schoolPages} onClick={() => setSchoolPage((p) => p + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-40">
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
