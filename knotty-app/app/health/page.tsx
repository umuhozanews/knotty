"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Wifi, WifiOff, Loader2, Heart, Plus, X, CreditCard,
  AlertCircle, CheckCircle, Clock, Activity, Pill, Calendar,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { cards, health, HealthRecord, ClinicVisit, MedicalProfile, CardScanResult } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

const SEV_STYLE: Record<string, { bg: string; text: string }> = {
  LOW:    { bg: "#DCFCE7", text: "#166534" },
  MEDIUM: { bg: "#FEF9C3", text: "#854D0E" },
  HIGH:   { bg: "#FEE2E2", text: "#991B1B" },
};
const TYPE_LABEL: Record<string, string> = {
  ILLNESS: "Illness", INJURY: "Injury", MEDICATION: "Medication",
  CHECKUP: "Check-up", ALLERGY: "Allergy",
};

type ScannedStudent = CardScanResult["student"];

/* ── Log Incident Modal ────────────────────────────────────────── */
function IncidentModal({ student, onClose, onSuccess }: {
  student: ScannedStudent; onClose: () => void; onSuccess: (r: HealthRecord) => void;
}) {
  const [form, setForm] = useState({ type: "ILLNESS", severity: "LOW", title: "", description: "", treatment_given: "", follow_up_required: false });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await health.create({ student_id: student.id, ...form });
      toast("Health incident logged", "success");
      onSuccess(res.data);
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "Error", "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-sm" style={{ color: "#121212" }}>Log Health Incident</p>
            <p className="text-xs text-gray-400">{student.name} · {student.class}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>TYPE</p>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                {["ILLNESS", "INJURY", "MEDICATION", "CHECKUP", "ALLERGY"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>SEVERITY</p>
              <div className="grid grid-cols-3 gap-1">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setForm((f) => ({ ...f, severity: s }))}
                    className="py-1.5 rounded-lg text-xs font-semibold border transition"
                    style={form.severity === s
                      ? { background: SEV_STYLE[s].bg, color: SEV_STYLE[s].text, borderColor: SEV_STYLE[s].text }
                      : { background: "#fff", color: "#999", borderColor: "#e5e5e5" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>TITLE *</p>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Fever 38.5°C"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>DESCRIPTION</p>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Brief description…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>TREATMENT GIVEN</p>
            <input value={form.treatment_given} onChange={(e) => setForm((f) => ({ ...f, treatment_given: e.target.value }))}
              placeholder="e.g. Paracetamol 500mg administered"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.follow_up_required} onChange={(e) => setForm((f) => ({ ...f, follow_up_required: e.target.checked }))}
              className="w-4 h-4 rounded accent-rose-500" />
            <span className="text-xs text-gray-600 font-semibold">Follow-up required</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-medium" style={{ background: "#F5F5F5", color: "#666" }}>Cancel</button>
            <button type="submit" disabled={loading || !form.title.trim()}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#E11D48" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Heart size={14} /> Save Incident</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Log Clinic Visit Modal ────────────────────────────────────── */
function VisitModal({ student, onClose, onSuccess }: {
  student: ScannedStudent; onClose: () => void; onSuccess: (v: ClinicVisit) => void;
}) {
  const [form, setForm] = useState({ presenting_complaint: "", treatment_notes: "", follow_up_required: false });
  const [meds, setMeds] = useState<Array<{ medication_name: string; dosage: string }>>([]);
  const [medName, setMedName] = useState(""); const [medDose, setMedDose] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function addMed() {
    if (!medName.trim() || !medDose.trim()) return;
    setMeds((m) => [...m, { medication_name: medName.trim(), dosage: medDose.trim() }]);
    setMedName(""); setMedDose("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await health.createVisit(student.id, { ...form, medications: meds });
      toast("Clinic visit logged", "success");
      onSuccess(res.data);
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "Error", "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="font-bold text-sm" style={{ color: "#121212" }}>Log Clinic Visit</p>
            <p className="text-xs text-gray-400">{student.name} · {student.class}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"><X size={14} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>COMPLAINT *</p>
            <input required value={form.presenting_complaint} onChange={(e) => setForm((f) => ({ ...f, presenting_complaint: e.target.value }))}
              placeholder="e.g. Persistent stomach ache"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-gray-400" />
          </div>
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "#666" }}>TREATMENT NOTES</p>
            <textarea value={form.treatment_notes} onChange={(e) => setForm((f) => ({ ...f, treatment_notes: e.target.value }))}
              rows={2} placeholder="What treatment was given…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:border-gray-400" />
          </div>
          {/* Medications */}
          <div className="rounded-2xl p-3 space-y-2" style={{ background: "#F9F9F9" }}>
            <p className="text-xs font-semibold" style={{ color: "#666" }}>MEDICATIONS DISPENSED ({meds.length})</p>
            {meds.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 text-xs">
                <span className="font-semibold">{m.medication_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{m.dosage}</span>
                  <button type="button" onClick={() => setMeds((ms) => ms.filter((_, j) => j !== i))}><X size={11} className="text-gray-400" /></button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="Med name"
                className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
              <input value={medDose} onChange={(e) => setMedDose(e.target.value)} placeholder="Dosage"
                className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
              <button type="button" onClick={addMed} className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#121212" }}>Add</button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.follow_up_required} onChange={(e) => setForm((f) => ({ ...f, follow_up_required: e.target.checked }))}
              className="w-4 h-4 rounded accent-rose-500" />
            <span className="text-xs text-gray-600 font-semibold">Follow-up required</span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-sm font-medium" style={{ background: "#F5F5F5", color: "#666" }}>Cancel</button>
            <button type="submit" disabled={loading || !form.presenting_complaint.trim()}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#E11D48" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <><Activity size={14} /> Log Visit</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */
export default function HealthPage() {
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  /* ── Scanner ───────────────────────────────────────────────── */
  const [cardInput, setCardInput]   = useState("");
  const [scanning, setScanning]     = useState(false);
  const processingRef               = useRef(false);

  /* ── Scanned student ───────────────────────────────────────── */
  const [student, setStudent]           = useState<ScannedStudent | null>(null);
  const [profile, setProfile]           = useState<MedicalProfile | null>(null);
  const [incidents, setIncidents]       = useState<HealthRecord[]>([]);
  const [visits, setVisits]             = useState<ClinicVisit[]>([]);
  const [studentTab, setStudentTab]     = useState<"incidents" | "visits">("incidents");
  const [studentLoading, setStudentLoading] = useState(false);

  /* ── Modals ────────────────────────────────────────────────── */
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [showVisitModal, setShowVisitModal]       = useState(false);

  /* ── School-wide list ──────────────────────────────────────── */
  const [schoolRecords, setSchoolRecords]   = useState<HealthRecord[]>([]);
  const [schoolPage, setSchoolPage]         = useState(1);
  const [schoolTotal, setSchoolTotal]       = useState(0);
  const [schoolLoading, setSchoolLoading]   = useState(true);
  const LIMIT = 20;

  /* ── Card scan handler ─────────────────────────────────────── */
  async function handleCardScan(cardNum: string, isNFC = false) {
    if (!cardNum.trim() || processingRef.current) return;
    processingRef.current = true;
    setScanning(true);
    try {
      const res = isNFC ? await cards.scanNFC(cardNum) : await cards.scan(cardNum.trim());
      const scanned = res.data.student;
      setStudent(scanned);
      setCardInput("");
      setStudentTab("incidents");
      setStudentLoading(true);
      const [incRes, visitRes, profRes] = await Promise.allSettled([
        health.studentList(scanned.id),
        health.studentVisits(scanned.id),
        health.getProfile(scanned.id),
      ]);
      if (incRes.status === "fulfilled")   setIncidents(incRes.value.data);
      if (visitRes.status === "fulfilled") setVisits(visitRes.value.data);
      if (profRes.status === "fulfilled")  setProfile(profRes.value.data);
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

  /* ── School-wide records ───────────────────────────────────── */
  const loadSchool = useCallback(async () => {
    if (authLoading) return;
    setSchoolLoading(true);
    try {
      const res = await health.schoolRecords({ page: schoolPage, limit: LIMIT });
      setSchoolRecords(res.data);
      setSchoolTotal((res.pagination as { total: number }).total ?? res.data.length);
    } catch { /* ignore */ }
    finally { setSchoolLoading(false); }
  }, [schoolPage, authLoading]);

  useEffect(() => { loadSchool(); }, [loadSchool]);

  const schoolPages = Math.ceil(schoolTotal / LIMIT);

  return (
    <DashboardShell>
      {showIncidentModal && student && (
        <IncidentModal student={student} onClose={() => setShowIncidentModal(false)}
          onSuccess={(r) => setIncidents((prev) => [r, ...prev])} />
      )}
      {showVisitModal && student && (
        <VisitModal student={student} onClose={() => setShowVisitModal(false)}
          onSuccess={(v) => setVisits((prev) => [v, ...prev])} />
      )}

      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#121212" }}>Health & Medical</h1>
            <p className="text-xs" style={{ color: "#666" }}>Tap student card to view medical records</p>
          </div>
        </div>

        <div className="flex flex-1 gap-3 px-3 md:px-4 pb-3 md:pb-4 overflow-hidden min-h-0 flex-col lg:flex-row">

          {/* ── LEFT: Scanner ───────────────────────────────── */}
          <div className="lg:w-72 flex-shrink-0 flex flex-col gap-3">
            <div className="bg-white rounded-3xl p-5 flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: listening ? "#FFF1F2" : "#F5F5F5" }}>
                {scanning
                  ? <Loader2 size={32} className="animate-spin" style={{ color: "#E11D48" }} />
                  : listening
                  ? <Heart size={32} className="animate-pulse fill-current" style={{ color: "#E11D48" }} />
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

            {/* Student card (desktop) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 hidden lg:block">
                <div className="flex items-center gap-3 mb-3">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold flex-shrink-0"
                        style={{ background: "#FFF1F2", color: "#E11D48" }}>{student.name.charAt(0)}</div>}
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class}</p>
                  </div>
                </div>

                {/* Medical alerts */}
                {profile && (
                  <div className="space-y-1.5 mb-3">
                    {profile.blood_type && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: "#FFF1F2", color: "#E11D48" }}>
                        <Activity size={12} /> Blood type: {profile.blood_type}
                      </div>
                    )}
                    {profile.allergies && profile.allergies.length > 0 && (
                      <div className="px-3 py-1.5 rounded-xl text-xs" style={{ background: "#FEF9C3", color: "#854D0E" }}>
                        <span className="font-semibold">Allergies:</span> {profile.allergies.join(", ")}
                      </div>
                    )}
                    {profile.chronic_conditions && profile.chronic_conditions.length > 0 && (
                      <div className="px-3 py-1.5 rounded-xl text-xs" style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                        <span className="font-semibold">Conditions:</span> {profile.chronic_conditions.join(", ")}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowIncidentModal(true)}
                    className="py-2.5 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-1"
                    style={{ background: "#E11D48" }}>
                    <Plus size={12} /> Incident
                  </button>
                  <button onClick={() => setShowVisitModal(true)}
                    className="py-2.5 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-1"
                    style={{ background: "#121212" }}>
                    <Pill size={12} /> Visit
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Detail or school-wide ─────────────────── */}
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">

            {/* Student card (mobile) */}
            {student && (
              <div className="bg-white rounded-3xl p-4 lg:hidden flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                  {student.photo
                    ? <img src={student.photo} alt={student.name} className="w-10 h-10 rounded-2xl object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold flex-shrink-0 text-sm"
                        style={{ background: "#FFF1F2", color: "#E11D48" }}>{student.name.charAt(0)}</div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate" style={{ color: "#121212" }}>{student.name}</p>
                    <p className="text-xs text-gray-400">{student.class} · {student.student_code}</p>
                  </div>
                </div>
                {profile?.blood_type && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold mb-2" style={{ background: "#FFF1F2", color: "#E11D48" }}>
                    <Activity size={12} /> Blood type: {profile.blood_type}
                    {profile.allergies?.length > 0 && <span className="ml-2 font-normal text-yellow-700">· Allergies: {profile.allergies.join(", ")}</span>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowIncidentModal(true)}
                    className="py-2.5 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-1"
                    style={{ background: "#E11D48" }}>
                    <Plus size={12} /> Log Incident
                  </button>
                  <button onClick={() => setShowVisitModal(true)}
                    className="py-2.5 rounded-2xl text-xs font-bold text-white flex items-center justify-center gap-1"
                    style={{ background: "#121212" }}>
                    <Pill size={12} /> Log Visit
                  </button>
                </div>
              </div>
            )}

            {student ? (
              /* Student records panel */
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                {/* Tabs */}
                <div className="flex gap-1 p-3 border-b border-gray-100 flex-shrink-0">
                  {(["incidents", "visits"] as const).map((tab) => (
                    <button key={tab} onClick={() => setStudentTab(tab)}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold transition"
                      style={studentTab === tab
                        ? { background: "#FFF1F2", color: "#E11D48" }
                        : { background: "transparent", color: "#999" }}>
                      {tab === "incidents" ? `Incidents (${incidents.length})` : `Clinic Visits (${visits.length})`}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {studentLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : studentTab === "incidents" ? (
                    incidents.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-gray-300">
                        <CheckCircle size={32} className="mb-2 text-green-300" />
                        <p className="text-sm font-medium text-green-500">No health incidents on record</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {incidents.map((r) => {
                          const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.LOW;
                          return (
                            <div key={r.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>{r.severity}</span>
                                    <span className="text-xs text-gray-400">{TYPE_LABEL[r.type] ?? r.type}</span>
                                  </div>
                                  <p className="text-sm font-semibold" style={{ color: "#121212" }}>{r.title}</p>
                                  {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                                  {r.treatment_given && <p className="text-xs mt-0.5 text-green-600">✓ {r.treatment_given}</p>}
                                  {r.follow_up_required && (
                                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5"><AlertCircle size={10} /> Follow-up needed</span>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1">
                                    {new Date(r.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    visits.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-gray-300">
                        <Activity size={32} className="mb-2" />
                        <p className="text-sm">No clinic visits recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {visits.map((v) => (
                          <div key={v.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                            <p className="text-sm font-semibold mb-1" style={{ color: "#121212" }}>{v.presenting_complaint}</p>
                            {v.treatment_notes && <p className="text-xs text-gray-500 mb-1">{v.treatment_notes}</p>}
                            {v.medications && v.medications.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {v.medications.map((m, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "#EDE9FE", color: "#5B21B6" }}>
                                    <Pill size={9} className="inline mr-1" />{m.medication_name} {m.dosage}
                                  </span>
                                ))}
                              </div>
                            )}
                            {v.follow_up_required && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle size={10} /> Follow-up required</span>}
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(v.visit_datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              {v.recorder && ` · ${v.recorder.first_name} ${v.recorder.last_name}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              /* School-wide incidents */
              <div className="bg-white rounded-3xl flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                  <p className="text-sm font-bold" style={{ color: "#121212" }}>Recent Incidents</p>
                  <p className="text-xs text-gray-400">{schoolTotal} total</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  {schoolLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
                  ) : schoolRecords.length === 0 ? (
                    <div className="flex flex-col items-center py-10 text-gray-300">
                      <Heart size={32} className="mb-2" />
                      <p className="text-sm">No health incidents logged</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {schoolRecords.map((r) => {
                        const sev = SEV_STYLE[r.severity] ?? SEV_STYLE.LOW;
                        return (
                          <div key={r.id} className="rounded-2xl p-3" style={{ background: "#F9F9F9" }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: sev.bg, color: sev.text }}>{r.severity}</span>
                                  {(r as HealthRecord & { student?: { user: { first_name: string; last_name: string } } }).student && (
                                    <span className="text-xs font-semibold" style={{ color: "#121212" }}>
                                      {(r as HealthRecord & { student?: { user: { first_name: string; last_name: string } } }).student?.user.first_name}{" "}
                                      {(r as HealthRecord & { student?: { user: { first_name: string; last_name: string } } }).student?.user.last_name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm font-medium" style={{ color: "#444" }}>{r.title}</p>
                                {r.treatment_given && <p className="text-xs text-green-600 mt-0.5">✓ {r.treatment_given}</p>}
                                <p className="text-xs text-gray-400 mt-1">
                                  <Clock size={10} className="inline mr-1" />
                                  {new Date(r.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </p>
                              </div>
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
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40"><ChevronLeft size={12} /></button>
                      <button disabled={schoolPage === schoolPages} onClick={() => setSchoolPage((p) => p + 1)}
                        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40"><ChevronRight size={12} /></button>
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
