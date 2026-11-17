"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Home, Users, UserCheck, UserPlus, CreditCard, Shield,
  LogIn, LogOut, Search, RefreshCw, CheckCircle, XCircle,
  Clock, AlertTriangle, X, ChevronRight, Building2, Phone,
  IdCard, Briefcase, User, Hash, Wifi, StopCircle, Smartphone,
  Check, ArrowRightLeft,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useNFC } from "@/hooks/useNFC";
import {
  supabaseVisitorService,
  type VisitorVisitRow,
  type VisitorProfileRow,
} from "@/lib/supabase/services/visitorService";
import { supabaseAttendanceService } from "@/lib/supabase/services/attendanceService";
import { supabaseCanteenService } from "@/lib/supabase/services/canteenService";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type GateMode = "home" | "student" | "staff" | "visitor";
type VisitorStatus = "pending" | "approved" | "inside" | "completed" | "cancelled" | "denied";

interface Overview {
  students_inside: number;
  staff_inside: number;
  visitors_inside: number;
  today_entries: number;
  today_exits: number;
  pending_visitors: number;
}

interface StaffCard {
  card_assignment_id: string;
  card_number: string;
  staff_record_id: string;
  employee_number: string;
  job_title: string;
  department: string | null;
  employment_status: string;
  legal_name: string;
  profile_photo_path: string | null;
  card_status: string;
  is_frozen: boolean;
}

interface StudentCard {
  card_assignment_id: string;
  card_number: string;
  student_id: string;
  legal_name: string;
  class_name: string;
  education_level_name: string;
  admission_number: string;
  profile_photo_path: string | null;
  wallet_balance: number;
  card_status: string;
  is_frozen: boolean;
  issued_at?: string | null;
}

type TapResult = {
  action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "DUPLICATE" | "DENIED";
  direction: "in" | "out";
  check_in_time: string | null;
  check_out_time: string | null;
  tap_in_points: number;
  tap_out_points: number;
  denied_reason?: string;
};

interface GateActivityItem {
  id: string;
  name: string;
  category: "student" | "staff" | "visitor";
  role: string;
  action: "TAP_IN" | "TAP_OUT" | "ADMIT" | "CHECKOUT" | "ALREADY_OUT" | "DUPLICATE";
  direction: "in" | "out";
  timestamp: string;
  photo: string | null;
}

const STATUS_CFG: Record<VisitorStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "Pending",   bg: "bg-amber-100",   text: "text-amber-800",  dot: "bg-amber-500" },
  approved:  { label: "Approved",  bg: "bg-blue-100",    text: "text-blue-800",   dot: "bg-blue-500" },
  inside:    { label: "Inside",    bg: "bg-green-100",   text: "text-green-800",  dot: "bg-green-500" },
  completed: { label: "Completed", bg: "bg-gray-100",    text: "text-gray-600",   dot: "bg-gray-400" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100",    text: "text-gray-500",   dot: "bg-gray-300" },
  denied:    { label: "Denied",    bg: "bg-red-100",     text: "text-red-800",    dot: "bg-red-500" },
};

function playChime(type: "IN" | "OUT" | "ERROR") {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === "IN") {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "OUT") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {}
}

function Avatar({ name, photo, size = 10 }: { name: string; photo: string | null; size?: number }) {
  const initials = (name || "?").split(" ").map((p) => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
  const hue = (name || "?").charCodeAt(0) * 37 % 360;
  if (photo) return <img src={photo} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} alt="" />;
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
      style={{ background: `hsl(${hue}, 60%, 55%)` }}
    >
      {initials}
    </div>
  );
}

function fmtTime(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-RW", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function addYears(iso: string, n: number) {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString();
}

function TapResultCard({
  result,
  name,
  photo,
  schoolName,
  category,
  field1Label, field1Value,
  field2Label, field2Value,
  field3Label, field3Value,
  field4Label, field4Value,
  materials,
}: {
  result: TapResult;
  name: string;
  photo: string | null;
  schoolName?: string;
  category?: "Student" | "Staff" | "Visitor";
  field1Label?: string; field1Value?: string;
  field2Label?: string; field2Value?: string;
  field3Label?: string; field3Value?: string;
  field4Label?: string; field4Value?: string;
  materials?: string[];
}) {
  const isIn     = result.action === "TAP_IN";
  const isOut    = result.action === "TAP_OUT";
  const isDenied = result.action === "DENIED";

  const bannerBg    = isDenied ? "#DC2626" : isIn ? "#16A34A" : isOut ? "#2563EB" : "#6B7280";
  const bannerText  = isDenied ? "✗  NOT ALLOWED TO ENTER"
                    : isIn     ? "✓  ENTRY CONFIRMED"
                    : isOut    ? "✓  EXIT CONFIRMED"
                    :            "ℹ  ALREADY PROCESSED";

  const initials = name.split(" ").map((p) => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;

  const fields = [
    field1Label ? { label: field1Label, value: field1Value ?? "—" } : null,
    field2Label ? { label: field2Label, value: field2Value ?? "—" } : null,
    field3Label ? { label: field3Label, value: field3Value ?? "—" } : null,
    field4Label ? { label: field4Label, value: field4Value ?? "—" } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: "2px solid #E5E7EB" }}>
      {/* Status banner */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: bannerBg }}>
        <span className="text-white font-extrabold text-sm tracking-widest">{bannerText}</span>
        {category && (
          <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">{category}</span>
        )}
      </div>

      {/* ID card body */}
      <div className="bg-white relative overflow-hidden">

        {/* Full-width red header band */}
        <div className="relative overflow-hidden px-4 py-3" style={{ background: "#DC2626" }}>
          {/* Curved decorations at top-right inside the header */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="absolute top-0 right-0 w-14 h-14 rounded-bl-full" style={{ background: "rgba(255,255,255,0.12)" }} />
          <p className="text-white font-black text-base uppercase tracking-wide leading-tight relative z-10" style={{ maxWidth: "70%" }}>
            {schoolName ?? "SCHOOL"}
          </p>
          {category && (
            <p className="text-white/70 text-[10px] font-semibold uppercase tracking-widest mt-0.5 relative z-10">{category}</p>
          )}
        </div>

        {/* Card content: photo left, info right */}
        <div className="flex gap-0 p-4">
          {/* Tall photo */}
          <div className="flex-shrink-0 mr-4">
            {photo ? (
              <img
                src={photo}
                alt={name}
                className="rounded-xl object-cover border border-gray-200"
                style={{ width: "84px", height: "112px" }}
              />
            ) : (
              <div
                className="rounded-xl flex items-center justify-center text-white text-2xl font-black"
                style={{ width: "84px", height: "112px", background: `hsl(${hue},55%,55%)` }}
              >
                {initials}
              </div>
            )}
          </div>

          {/* Right column: name + fields */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#DC2626" }}>Full Name</p>
              <p className="text-sm font-black text-gray-900 uppercase leading-tight mt-0.5 break-words">
                {name}
              </p>
            </div>

            {fields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-2">
                {fields.map((f) => (
                  <div key={f.label}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">{f.label}</p>
                    <p className="text-xs font-bold text-gray-800 mt-0.5 leading-tight">{f.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned materials */}
        {materials && materials.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Assigned Items</p>
            <div className="flex flex-wrap gap-1.5">
              {materials.map((m) => (
                <span key={m} className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Denied reason */}
        {isDenied && result.denied_reason && (
          <div className="px-4 pb-3">
            <p className="text-xs font-semibold text-red-600">{result.denied_reason}</p>
          </div>
        )}

        {/* Footer: times + branding */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            {result.check_in_time && (
              <span className="flex items-center gap-1">
                <LogIn size={10} className="text-green-600" />
                {fmtTime(result.check_in_time)}
              </span>
            )}
            {result.check_out_time && (
              <span className="flex items-center gap-1">
                <LogOut size={10} className="text-blue-600" />
                {fmtTime(result.check_out_time)}
              </span>
            )}
            {(result.tap_in_points + result.tap_out_points) > 0 && (
              <span className="font-semibold text-green-600">
                +{result.tap_in_points + result.tap_out_points} pts
              </span>
            )}
          </div>
          <span className="text-xs font-black tracking-tight" style={{ color: "#16A34A" }}>KNOTTY</span>
        </div>
      </div>
    </div>
  );
}

function RegisterVisitorModal({
  schoolId,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  onClose: () => void;
  onSuccess: (visit: { passReference: string; visitId: string }) => void;
}) {
  const [form, setForm] = useState({
    fullName: "", phone: "", idType: "", idReference: "", organization: "", hostName: "", items: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VisitorProfileRow[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<VisitorProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Host name autocomplete
  const [hostSuggestions, setHostSuggestions] = useState<{ name: string; subtitle: string }[]>([]);
  const [showHostSuggestions, setShowHostSuggestions] = useState(false);
  const hostSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSearchChange(v: string) {
    setSearchQuery(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (v.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await supabaseVisitorService.searchVisitorProfiles({ schoolId, query: v.trim() });
        setSearchResults(results);
      } catch {}
    }, 300);
  }

  function selectProfile(p: VisitorProfileRow) {
    setSelectedProfile(p);
    setForm((f) => ({
      ...f,
      fullName:     p.full_name,
      phone:        p.phone ?? "",
      idType:       p.id_type ?? "",
      idReference:  p.id_reference ?? "",
      organization: p.organization ?? "",
    }));
    setSearchResults([]);
    setSearchQuery("");
  }

  function handleHostInput(v: string) {
    set("hostName", v);
    if (hostSearchTimeout.current) clearTimeout(hostSearchTimeout.current);
    if (v.trim().length < 1) { setHostSuggestions([]); setShowHostSuggestions(false); return; }
    hostSearchTimeout.current = setTimeout(async () => {
      const client = getSafeBrowserClient();
      if (!client) return;
      const q = v.trim().toLowerCase();
      const [staffRes, studRes] = await Promise.all([
        client.rpc("list_school_staff_members", { p_school_id: schoolId }),
        client.rpc("list_school_students", { p_school_id: schoolId, p_search: q }),
      ]);
      const staffMatches = (staffRes.data ?? [])
        .filter((s: any) => s.legal_name?.toLowerCase().startsWith(q) && s.employment_status === "active")
        .slice(0, 6)
        .map((s: any) => ({ name: s.legal_name, subtitle: s.job_title ?? "Staff" }));
      const studentMatches = (studRes.data ?? [])
        .slice(0, 6)
        .map((s: any) => ({ name: s.legal_name, subtitle: `Student · ${s.admission_number}` }));
      const suggestions = [...staffMatches, ...studentMatches];
      setHostSuggestions(suggestions);
      setShowHostSuggestions(suggestions.length > 0);
    }, 100);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Full name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await supabaseVisitorService.registerVisitorVisit({
        schoolId,
        fullName:         form.fullName.trim(),
        phone:            form.phone.trim() || null,
        idType:           form.idType.trim() || null,
        idReference:      form.idReference.trim() || null,
        organization:     form.organization.trim() || null,
        hostName:         form.hostName.trim() || null,
        notes:            form.items.trim() || null,
        visitorProfileId: selectedProfile?.visitor_profile_id ?? null,
      });
      onSuccess({ passReference: result.passReference, visitId: result.visitId });
    } catch (err: any) {
      setError(err?.message || "Failed to register visitor");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Register Visitor</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Returning visitor search */}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Returning Visitor?</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text" value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or phone…"
                className={`${inputCls} pl-8`}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {searchResults.map((p) => (
                  <button
                    key={p.visitor_profile_id} type="button"
                    onClick={() => selectProfile(p)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <Avatar name={p.full_name} photo={null} size={8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-400">{p.phone || p.organization || "—"}</p>
                    </div>
                    {p.is_blocked && <span className="text-xs text-red-600 font-medium">Blocked</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedProfile && (
              <div className="mt-1 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Using existing profile for <strong>{selectedProfile.full_name}</strong></span>
                <button type="button" onClick={() => setSelectedProfile(null)} className="ml-auto">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Full Name *</label>
              <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required className={inputCls} placeholder="Visitor's full name" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+250 7xx xxx xxx" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Organization</label>
              <input value={form.organization} onChange={(e) => set("organization", e.target.value)} className={inputCls} placeholder="Company / School" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">ID Type</label>
              <select value={form.idType} onChange={(e) => set("idType", e.target.value)} className={inputCls}>
                <option value="">— None —</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVER_LICENSE">Driver's License</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">ID Reference</label>
              <input value={form.idReference} onChange={(e) => set("idReference", e.target.value)} className={inputCls} placeholder="ID number" />
            </div>
            <div className="col-span-2 relative">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Person to Visit</label>
              <input
                value={form.hostName}
                onChange={(e) => handleHostInput(e.target.value)}
                onFocus={() => hostSuggestions.length > 0 && setShowHostSuggestions(true)}
                onBlur={() => setTimeout(() => setShowHostSuggestions(false), 150)}
                className={inputCls}
                placeholder="Search staff or student…"
                autoComplete="off"
              />
              {showHostSuggestions && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {hostSuggestions.map((s, i) => (
                    <button
                      key={i} type="button"
                      onMouseDown={() => { set("hostName", s.name); setShowHostSuggestions(false); setHostSuggestions([]); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <Avatar name={s.name} photo={null} size={7} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Items Brought <span className="text-gray-300">(optional)</span></label>
              <input value={form.items} onChange={(e) => set("items", e.target.value)} className={inputCls} placeholder="e.g. Laptop, phone, bag" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{error}
            </div>
          )}
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="flex-1 py-2.5 text-sm font-medium text-white bg-black rounded-xl hover:bg-gray-900 disabled:opacity-50">
            {loading ? "Registering…" : "Register"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GatePage() {
  const { activeSchool, loading: authLoading } = useAuth();
  const { toast: showToast } = useToast();
  const { startListen, stopListen, listening, isSupported: nfcSupported } = useNFC();

  const [mode, setMode] = useState<GateMode>("home");

  // Home overview
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [directionChoice, setDirectionChoice] = useState<"auto" | "in" | "out">("auto");

  // Universal Quick Scan (on Overview)
  const [quickInput, setQuickInput] = useState("");
  const [quickProcessing, setQuickProcessing] = useState(false);
  const [quickResult, setQuickResult] = useState<{
    result: TapResult;
    name: string;
    photo: string | null;
    category: "Student" | "Staff" | "Visitor";
    f1l?: string; f1v?: string;
    f2l?: string; f2v?: string;
    f3l?: string; f3v?: string;
    f4l?: string; f4v?: string;
    materials?: string[];
  } | null>(null);
  const [quickError, setQuickError] = useState("");
  const [recentActivity, setRecentActivity] = useState<GateActivityItem[]>([]);

  // Student scan tab
  const [studentCardInput, setStudentCardInput] = useState("");
  const [studentCard, setStudentCard] = useState<StudentCard | null>(null);
  const [studentIssuedAt, setStudentIssuedAt] = useState<string | null>(null);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [studentTapResult, setStudentTapResult] = useState<TapResult | null>(null);
  const [studentTapLoading, setStudentTapLoading] = useState(false);
  const [studentError, setStudentError] = useState("");

  // Staff scan tab
  const [staffCardInput, setStaffCardInput] = useState("");
  const [staffCard, setStaffCard] = useState<StaffCard | null>(null);
  const [staffIssuedAt, setStaffIssuedAt] = useState<string | null>(null);
  const [staffLookupLoading, setStaffLookupLoading] = useState(false);
  const [staffTapResult, setStaffTapResult] = useState<TapResult | null>(null);
  const [staffTapLoading, setStaffTapLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [activeStaffList, setActiveStaffList] = useState<StaffCard[]>([]);
  const [loadingStaffList, setLoadingStaffList] = useState(false);

  // Visitor management tab
  const [visits, setVisits] = useState<VisitorVisitRow[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split("T")[0]);

  const schoolId = activeSchool?.id;

  // Cleanup NFC listener on unmount
  useEffect(() => {
    return () => {
      stopListen();
    };
  }, [stopListen]);

  const loadOverview = useCallback(async () => {
    if (!schoolId) return;
    setOverviewLoading(true);
    try {
      const data = await supabaseVisitorService.getGateOverview({ schoolId });
      setOverview(data);
    } catch (err: any) {
      console.warn("Gate overview load notice:", err?.message);
    } finally {
      setOverviewLoading(false);
    }
  }, [schoolId]);

  const loadVisits = useCallback(async () => {
    if (!schoolId) return;
    setVisitsLoading(true);
    try {
      const data = await supabaseVisitorService.listVisitorVisits({ schoolId, date: visitDate });
      setVisits(data);
    } catch (err: any) {
      console.warn("Gate visits load notice:", err?.message);
    } finally {
      setVisitsLoading(false);
    }
  }, [schoolId, visitDate]);

  const loadStaffList = useCallback(async () => {
    if (!schoolId) return;
    setLoadingStaffList(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const { data, error } = await client.rpc("list_school_staff_members", {
        p_school_id: schoolId,
      });
      if (!error && Array.isArray(data)) {
        const mapped: StaffCard[] = data
          .filter((s: any) => s.employment_status === "active")
          .map((s: any) => ({
            card_assignment_id: s.staff_record_id,
            card_number: s.staff_number || "",
            staff_record_id: s.staff_record_id,
            employee_number: s.staff_number || "",
            job_title: s.job_title || "Staff",
            department: s.department || null,
            employment_status: s.employment_status,
            legal_name: s.legal_name,
            profile_photo_path: s.profile_photo_path || null,
            card_status: "active",
            is_frozen: false,
          }));
        setActiveStaffList(mapped);
      }
    } catch {
      // ignore
    } finally {
      setLoadingStaffList(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (authLoading || !schoolId) return;
    if (mode === "home") {
      loadOverview();
      loadVisits();
    }
    if (mode === "staff") {
      loadStaffList();
    }
    if (mode === "visitor") {
      loadVisits();
    }
  }, [mode, authLoading, schoolId, loadOverview, loadVisits, loadStaffList]);

  // ── UNIVERSAL GATE SCAN / TAP ───────────────────────────────────────
  const processUniversalInput = useCallback(async (rawQuery: string, isNfcUid = false) => {
    const query = rawQuery.trim();
    if (!schoolId || !query || quickProcessing) return;

    setQuickProcessing(true);
    setQuickError("");
    setQuickResult(null);

    try {
      // 1. Check if it's a Visitor Pass (e.g. VIS-...)
      const isVisitorRef = query.toUpperCase().startsWith("VIS-") || query.length >= 8;
      const matchingVisit = visits.find((v) =>
        v.pass_reference?.toUpperCase() === query.toUpperCase() ||
        v.visit_id.toLowerCase() === query.toLowerCase()
      );

      if (isVisitorRef && matchingVisit) {
        let actionLabel: "TAP_IN" | "TAP_OUT" = "TAP_IN";
        let dir: "in" | "out" = "in";
        const doCheckout = directionChoice === "out"
          || (directionChoice === "auto" && matchingVisit.status === "inside");
        if (doCheckout) {
          if (matchingVisit.status !== "inside") {
            playChime("ERROR");
            showToast(`${matchingVisit.full_name} is not currently inside`, "error");
            setQuickProcessing(false);
            return;
          }
          await supabaseVisitorService.checkoutVisitor({ schoolId, visitId: matchingVisit.visit_id });
          actionLabel = "TAP_OUT";
          dir = "out";
          playChime("OUT");
          showToast(`Visitor Checked Out: ${matchingVisit.full_name}`, "success");
        } else {
          if (matchingVisit.status === "inside" || matchingVisit.status === "completed") {
            playChime("ERROR");
            showToast(`${matchingVisit.full_name} is already ${matchingVisit.status}`, "error");
            setQuickProcessing(false);
            return;
          }
          await supabaseVisitorService.admitVisitor({ schoolId, visitId: matchingVisit.visit_id });
          actionLabel = "TAP_IN";
          dir = "in";
          playChime("IN");
          showToast(`Visitor Admitted: ${matchingVisit.full_name}`, "success");
        }
        await loadOverview();
        await loadVisits();

        const tapRes: TapResult = {
          action: actionLabel,
          direction: dir,
          check_in_time: dir === "in" ? new Date().toISOString() : matchingVisit.arrived_at,
          check_out_time: dir === "out" ? new Date().toISOString() : null,
          tap_in_points: dir === "in" ? 2 : 0,
          tap_out_points: dir === "out" ? 2 : 0,
        };

        setQuickResult({
          result: tapRes,
          name: matchingVisit.full_name,
          photo: null,
          category: "Visitor",
          f1l: "Host",    f1v: matchingVisit.host_name || "School",
          f2l: "Purpose", f2v: matchingVisit.purpose,
          f3l: "Status",  f3v: dir === "in" ? "Admitted" : "Departed",
          f4l: "Pass Ref", f4v: matchingVisit.pass_reference || "—",
        });

        setRecentActivity((prev) => [
          {
            id: crypto.randomUUID(),
            name: matchingVisit.full_name,
            category: "visitor",
            role: matchingVisit.purpose,
            action: actionLabel,
            direction: dir,
            timestamp: new Date().toISOString(),
            photo: null,
          },
          ...prev.slice(0, 9),
        ]);
        return;
      }

      // 2. Try Student Card Lookup
      let studentData: StudentCard | null = null;
      try {
        if (isNfcUid) {
          const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, query);
          if (holder) {
            studentData = {
              card_assignment_id: holder.card_assignment_id,
              card_number: holder.card_number,
              student_id: holder.student_id,
              legal_name: holder.legal_name,
              class_name: holder.class_name,
              education_level_name: holder.education_level_name,
              admission_number: holder.admission_number,
              profile_photo_path: holder.profile_photo_path,
              wallet_balance: Number(holder.wallet_balance || 0),
              card_status: holder.card_status,
              is_frozen: holder.is_frozen,
              issued_at: (holder as any).issued_at ?? null,
            };
          }
        } else {
          // Check by card_number
          const client = getSafeBrowserClient();
          if (client) {
            const { data } = await client.rpc("lookup_card_holder", {
              p_school_id: schoolId,
              p_card_number: query,
            });
            if (data && (data as any[]).length > 0) {
              studentData = (data as any[])[0] as StudentCard;
            }
          }
          // If not found, check if query was actually an NFC UID
          if (!studentData) {
            try {
              const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, query);
              if (holder) {
                studentData = {
                  card_assignment_id: holder.card_assignment_id,
                  card_number: holder.card_number,
                  student_id: holder.student_id,
                  legal_name: holder.legal_name,
                  class_name: holder.class_name,
                  education_level_name: holder.education_level_name,
                  admission_number: holder.admission_number,
                  profile_photo_path: holder.profile_photo_path,
                  wallet_balance: Number(holder.wallet_balance || 0),
                  card_status: holder.card_status,
                  is_frozen: holder.is_frozen,
                  issued_at: (holder as any).issued_at ?? null,
                };
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }

      // If Student found, execute tap
      if (studentData) {
        const issuedAt: string | null = studentData.issued_at ?? null;

        const classDisplay = [studentData.education_level_name, studentData.class_name].filter(Boolean).join(" ") || "—";

        // Fetch assigned materials (non-critical)
        let materials: string[] = [];
        try {
          const cl2 = getSafeBrowserClient();
          if (cl2) {
            const { data: items } = await cl2.rpc("get_student_assigned_items", {
              p_school_id: schoolId,
              p_student_id: studentData.student_id,
            });
            materials = (items || []).map((i: any) => i.item_name as string);
          }
        } catch { /* non-critical */ }

        // Check gate ban (non-critical — ban overrides frozen check below)
        let gateBanned = false;
        let gateBanReason = "";
        try {
          const cl3 = getSafeBrowserClient();
          if (cl3) {
            const { data: banRows } = await cl3.rpc("check_gate_ban", {
              p_school_id: schoolId,
              p_student_id: studentData.student_id,
            });
            if (banRows && (banRows as any[]).length > 0) {
              gateBanned = true;
              gateBanReason = (banRows as any[])[0].reason || "Banned from entry";
            }
          }
        } catch { /* non-critical */ }

        if (studentData.is_frozen || gateBanned) {
          playChime("ERROR");
          setQuickResult({
            result: {
              action: "DENIED", direction: "in",
              check_in_time: null, check_out_time: null,
              tap_in_points: 0, tap_out_points: 0,
              denied_reason: gateBanned ? gateBanReason : "Card is frozen — contact the bursar",
            },
            name: studentData.legal_name,
            photo: studentData.profile_photo_path,
            category: "Student",
            f1l: "Class",       f1v: classDisplay,
            f2l: "Reg Number",  f2v: studentData.admission_number,
            f3l: "Issue Date",  f3v: fmtDate(issuedAt),
            f4l: "Expiry Date", f4v: issuedAt ? fmtDate(addYears(issuedAt, 3)) : "—",
            materials,
          });
          return;
        }

        const tapRes = await supabaseAttendanceService.recordVirtualStudentTapV2({
          schoolId,
          studentId: studentData.student_id,
          idempotencyKey: crypto.randomUUID(),
          direction: directionChoice,
        });

        if (tapRes.action === "TAP_IN") playChime("IN");
        else if (tapRes.action === "TAP_OUT") playChime("OUT");
        else playChime("ERROR");

        setQuickResult({
          result: tapRes,
          name: studentData.legal_name,
          photo: studentData.profile_photo_path,
          category: "Student",
          f1l: "Class",       f1v: classDisplay,
          f2l: "Reg Number",  f2v: studentData.admission_number,
          f3l: "Issue Date",  f3v: fmtDate(issuedAt),
          f4l: "Expiry Date", f4v: issuedAt ? fmtDate(addYears(issuedAt, 3)) : "—",
          materials,
        });

        setRecentActivity((prev) => [
          {
            id: crypto.randomUUID(),
            name: studentData!.legal_name,
            category: "student",
            role: studentData!.class_name,
            action: tapRes.action,
            direction: tapRes.direction,
            timestamp: new Date().toISOString(),
            photo: studentData!.profile_photo_path,
          },
          ...prev.slice(0, 9),
        ]);

        await loadOverview();
        showToast(
          `${studentData.legal_name} ${tapRes.action === "TAP_IN" ? "Entered" : tapRes.action === "TAP_OUT" ? "Exited" : "Already Out"}`,
          tapRes.action === "ALREADY_OUT" || tapRes.action === "DUPLICATE" ? "info" : "success"
        );
        return;
      }

      // 3. Try Staff Lookup
      let staffData: StaffCard | null = null;
      try {
        staffData = await supabaseAttendanceService.lookupStaffCardHolder({
          schoolId,
          cardNumber: query,
        });
      } catch {
        // ignore
      }

      // If not found yet, check active staff list directly
      if (!staffData && activeStaffList.length > 0) {
        const qLow = query.toLowerCase();
        staffData = activeStaffList.find(
          (s) =>
            s.employee_number.toLowerCase() === qLow ||
            s.staff_record_id.toLowerCase() === qLow ||
            s.legal_name.toLowerCase().includes(qLow)
        ) || null;
      }

      // If Staff found, execute staff tap
      if (staffData) {
        // Fetch card issued_at for ID card display
        let staffIssuedAt: string | null = null;
        try {
          const cl = getSafeBrowserClient();
          if (cl && staffData.card_assignment_id) {
            const { data: ca } = await cl.from("card_assignments").select("issued_at").eq("id", staffData.card_assignment_id).single();
            staffIssuedAt = ca?.issued_at ?? null;
          }
        } catch { /* non-critical */ }

        if (staffData.is_frozen) {
          playChime("ERROR");
          setQuickResult({
            result: { action: "DENIED", direction: "in", check_in_time: null, check_out_time: null, tap_in_points: 0, tap_out_points: 0, denied_reason: "Staff card is frozen — contact admin" },
            name: staffData.legal_name,
            photo: staffData.profile_photo_path,
            category: "Staff",
            f1l: "Job Title",   f1v: staffData.job_title,
            f2l: "Staff #",     f2v: staffData.employee_number,
            f3l: "Department",  f3v: staffData.department || "—",
            f4l: "Issue Date",  f4v: fmtDate(staffIssuedAt),
          });
          return;
        }

        const tapRes = await supabaseAttendanceService.recordVirtualStaffTap({
          schoolId,
          staffRecordId: staffData.staff_record_id,
          idempotencyKey: crypto.randomUUID(),
          direction: directionChoice,
        });

        if (tapRes.action === "TAP_IN") playChime("IN");
        else if (tapRes.action === "TAP_OUT") playChime("OUT");
        else playChime("ERROR");

        const convertedRes: TapResult = {
          action: tapRes.action,
          direction: tapRes.direction,
          check_in_time: tapRes.check_in_time,
          check_out_time: tapRes.check_out_time,
          tap_in_points: tapRes.tap_in_points,
          tap_out_points: tapRes.tap_out_points,
        };

        setQuickResult({
          result: convertedRes,
          name: staffData.legal_name,
          photo: staffData.profile_photo_path,
          category: "Staff",
          f1l: "Job Title",   f1v: staffData.job_title,
          f2l: "Staff #",     f2v: staffData.employee_number,
          f3l: "Department",  f3v: staffData.department || "—",
          f4l: "Issue Date",  f4v: fmtDate(staffIssuedAt),
        });

        setRecentActivity((prev) => [
          {
            id: crypto.randomUUID(),
            name: staffData!.legal_name,
            category: "staff",
            role: staffData!.job_title,
            action: tapRes.action,
            direction: tapRes.direction,
            timestamp: new Date().toISOString(),
            photo: staffData!.profile_photo_path,
          },
          ...prev.slice(0, 9),
        ]);

        await loadOverview();
        showToast(
          `${staffData.legal_name} ${tapRes.action === "TAP_IN" ? "Entered" : tapRes.action === "TAP_OUT" ? "Exited" : "Already Out"}`,
          tapRes.action === "ALREADY_OUT" || tapRes.action === "DUPLICATE" ? "info" : "success"
        );
        return;
      }

      // If nothing matched
      playChime("ERROR");
      throw new Error(`No student, staff, or visitor pass found matching "${query}"`);
    } catch (err: any) {
      setQuickError(err?.message || "Scan processing failed");
      playChime("ERROR");
    } finally {
      setQuickProcessing(false);
    }
  }, [schoolId, quickProcessing, visits, directionChoice, activeStaffList, loadOverview, loadVisits, showToast]);

  // Toggle NFC listener
  async function toggleNFC() {
    if (listening) {
      stopListen();
      showToast("NFC listener stopped", "info");
      return;
    }
    const ok = await startListen(async (result) => {
      setQuickInput(result.value);
      if (mode === "student") {
        setStudentCardInput(result.value);
        await lookupStudentCardWithVal(result.value, result.type === "uid");
      } else if (mode === "staff") {
        setStaffCardInput(result.value);
        await lookupStaffCardWithVal(result.value);
      } else {
        await processUniversalInput(result.value, result.type === "uid");
      }
    });
    if (ok) {
      showToast("NFC active — tap card on device", "info");
    }
  }

  // ── STUDENT SCAN HELPERS ──────────────────────────────────────────
  async function lookupStudentCardWithVal(val: string, isNfcUid = false) {
    if (!schoolId || !val.trim()) return;
    setStudentLookupLoading(true);
    setStudentError("");
    setStudentCard(null);
    setStudentIssuedAt(null);
    setStudentTapResult(null);

    try {
      let resolved: StudentCard | null = null;
      if (isNfcUid) {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, val.trim());
        if (holder) {
          resolved = {
            card_assignment_id: holder.card_assignment_id,
            card_number: holder.card_number,
            student_id: holder.student_id,
            legal_name: holder.legal_name,
            class_name: holder.class_name,
            education_level_name: holder.education_level_name,
            admission_number: holder.admission_number,
            profile_photo_path: holder.profile_photo_path,
            wallet_balance: Number(holder.wallet_balance || 0),
            card_status: holder.card_status,
            is_frozen: holder.is_frozen,
          };
        }
      } else {
        const client = getSafeBrowserClient();
        if (client) {
          const { data } = await client.rpc("lookup_card_holder", {
            p_school_id: schoolId,
            p_card_number: val.trim(),
          });
          if (data && (data as any[]).length > 0) {
            resolved = (data as any[])[0] as StudentCard;
          }
        }
        if (!resolved) {
          try {
            const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, val.trim());
            if (holder) {
              resolved = {
                card_assignment_id: holder.card_assignment_id,
                card_number: holder.card_number,
                student_id: holder.student_id,
                legal_name: holder.legal_name,
                class_name: holder.class_name,
                education_level_name: holder.education_level_name,
                admission_number: holder.admission_number,
                profile_photo_path: holder.profile_photo_path,
                wallet_balance: Number(holder.wallet_balance || 0),
                card_status: holder.card_status,
                is_frozen: holder.is_frozen,
              };
            }
          } catch {
            // ignore
          }
        }
      }

      if (!resolved) throw new Error("No student card found with that number or UID");
      setStudentCard(resolved);

      // Fetch issued_at for ID card display
      try {
        const cl = getSafeBrowserClient();
        if (cl && resolved.card_assignment_id) {
          const { data: ca } = await cl.from("card_assignments").select("issued_at").eq("id", resolved.card_assignment_id).single();
          setStudentIssuedAt(ca?.issued_at ?? null);
        }
      } catch { /* non-critical */ }
    } catch (err: any) {
      setStudentError(err?.message || "Card not found");
      playChime("ERROR");
    } finally {
      setStudentLookupLoading(false);
    }
  }

  async function lookupStudentCard() {
    await lookupStudentCardWithVal(studentCardInput, false);
  }

  async function tapStudent() {
    if (!schoolId || !studentCard) return;
    setStudentTapLoading(true);
    setStudentError("");
    try {
      const result = await supabaseAttendanceService.recordVirtualStudentTapV2({
        schoolId,
        studentId:       studentCard.student_id,
        idempotencyKey:  crypto.randomUUID(),
        direction:       directionChoice,
      });
      setStudentTapResult(result);
      if (result.action === "TAP_IN") playChime("IN");
      else if (result.action === "TAP_OUT") playChime("OUT");
      else playChime("ERROR");
      loadOverview();
      showToast(`${studentCard.legal_name} ${result.action}`, "success");
    } catch (err: any) {
      setStudentError(err?.message || "Tap failed");
      playChime("ERROR");
    } finally {
      setStudentTapLoading(false);
    }
  }

  // ── STAFF SCAN HELPERS ────────────────────────────────────────────
  async function lookupStaffCardWithVal(val: string) {
    if (!schoolId || !val.trim()) return;
    setStaffLookupLoading(true);
    setStaffError("");
    setStaffCard(null);
    setStaffIssuedAt(null);
    setStaffTapResult(null);
    try {
      const result = await supabaseAttendanceService.lookupStaffCardHolder({
        schoolId,
        cardNumber: val.trim(),
      });
      if (!result) throw new Error("No staff member found matching that input");
      setStaffCard(result as StaffCard);

      // Fetch issued_at for ID card display
      try {
        const cl = getSafeBrowserClient();
        if (cl && result.card_assignment_id) {
          const { data: ca } = await cl.from("card_assignments").select("issued_at").eq("id", result.card_assignment_id).single();
          setStaffIssuedAt(ca?.issued_at ?? null);
        }
      } catch { /* non-critical */ }
    } catch (err: any) {
      setStaffError(err?.message || "Staff not found");
      playChime("ERROR");
    } finally {
      setStaffLookupLoading(false);
    }
  }

  async function lookupStaffCard() {
    await lookupStaffCardWithVal(staffCardInput);
  }

  async function tapStaff() {
    if (!schoolId || !staffCard) return;
    setStaffTapLoading(true);
    setStaffError("");
    try {
      const result = await supabaseAttendanceService.recordVirtualStaffTap({
        schoolId,
        staffRecordId:   staffCard.staff_record_id,
        idempotencyKey:  crypto.randomUUID(),
        direction:       directionChoice,
      });
      setStaffTapResult({
        action:         result.action,
        direction:      result.direction,
        check_in_time:  result.check_in_time,
        check_out_time: result.check_out_time,
        tap_in_points:  result.tap_in_points,
        tap_out_points: result.tap_out_points,
      });
      if (result.action === "TAP_IN") playChime("IN");
      else if (result.action === "TAP_OUT") playChime("OUT");
      else playChime("ERROR");
      loadOverview();
      showToast(`${staffCard.legal_name} ${result.action}`, "success");
    } catch (err: any) {
      setStaffError(err?.message || "Tap failed");
      playChime("ERROR");
    } finally {
      setStaffTapLoading(false);
    }
  }

  // ── VISITOR ACTION ────────────────────────────────────────────────
  async function visitorAction(visitId: string, action: "admit" | "checkout" | "approve" | "deny", reason?: string) {
    if (!schoolId) return;
    setActionLoading(visitId + action);
    try {
      if (action === "admit") {
        await supabaseVisitorService.admitVisitor({ schoolId, visitId });
        playChime("IN");
      }
      if (action === "checkout") {
        await supabaseVisitorService.checkoutVisitor({ schoolId, visitId });
        playChime("OUT");
      }
      if (action === "approve") {
        await supabaseVisitorService.approveVisitor({ schoolId, visitId });
      }
      if (action === "deny") {
        await supabaseVisitorService.denyVisitor({ schoolId, visitId, reason });
      }
      await loadVisits();
      await loadOverview();
      showToast(`Visitor ${action}ed successfully`, "success");
    } catch (err: any) {
      playChime("ERROR");
      showToast(err?.message || `Failed to ${action} visitor`, "error");
    } finally {
      setActionLoading(null);
    }
  }

  const TABS: { key: GateMode; icon: any; label: string; color: string; active: string }[] = [
    { key: "home",    icon: Home,      label: "Overview", color: "bg-gray-100 text-gray-700",   active: "bg-gray-900 text-white" },
    { key: "student", icon: Users,     label: "Students", color: "bg-emerald-50 text-emerald-700", active: "bg-emerald-600 text-white" },
    { key: "staff",   icon: Briefcase, label: "Staff",    color: "bg-blue-50 text-blue-700",    active: "bg-blue-600 text-white" },
    { key: "visitor", icon: UserPlus,  label: "Visitors", color: "bg-violet-50 text-violet-700", active: "bg-violet-600 text-white" },
  ];

  // Visitor exits/entries derived locally so checkout immediately reflects in stats
  const todayStr = new Date().toISOString().split("T")[0];
  const visitorExitsToday = visits.filter(v => v.departed_at?.startsWith(todayStr)).length;
  const visitorEntriesToday = visits.filter(v => v.arrived_at?.startsWith(todayStr)).length;

  if (authLoading) {
    return (
      <DashboardShell hideHeader>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell hideHeader>
      {/* Big Tab Nav */}
      <div className="px-3 pt-3 pb-0">
        <div className="grid grid-cols-4 gap-2 mb-3">
          {TABS.map((t) => {
            const isActive = mode === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl font-semibold transition-all ${isActive ? t.active : t.color}`}
              >
                <t.icon className="w-6 h-6" />
                <span className="text-sm">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Direction + NFC controls */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="inline-flex bg-gray-100 p-0.5 rounded-xl text-xs">
            {(["auto", "in", "out"] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionChoice(dir)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                  directionChoice === dir ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {dir === "auto" ? "Smart" : dir}
              </button>
            ))}
          </div>
          {nfcSupported && (
            <button
              onClick={toggleNFC}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                listening ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
              }`}
            >
              {listening ? <><StopCircle className="w-3.5 h-3.5" /><span>NFC Active</span></> : <><Wifi className="w-3.5 h-3.5" /><span>NFC</span></>}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── HOME OVERVIEW ─────────────────────────────────────── */}
        {mode === "home" && (
          <>
            {/* Quick Gate Scan / Tap Zone */}
            <div className="bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold tracking-tight">Gate Scanner</h2>
                </div>
              </div>

              {/* Input Form — NFC card tap fills this automatically */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  processUniversalInput(quickInput);
                }}
              >
                <div className="relative">
                  <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={quickInput}
                    onChange={(e) => {
                      setQuickInput(e.target.value);
                      setQuickError("");
                    }}
                    placeholder="Tap NFC card to scan…"
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/15 rounded-2xl text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 font-mono"
                  />
                </div>
              </form>


              {quickError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-200">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{quickError}</span>
                </div>
              )}

              {quickResult && (
                <TapResultCard
                  result={quickResult.result}
                  name={quickResult.name}
                  photo={quickResult.photo}
                  schoolName={activeSchool?.name}
                  category={quickResult.category}
                  field1Label={quickResult.f1l} field1Value={quickResult.f1v}
                  field2Label={quickResult.f2l} field2Value={quickResult.f2v}
                  field3Label={quickResult.f3l} field3Value={quickResult.f3v}
                  field4Label={quickResult.f4l} field4Value={quickResult.f4v}
                  materials={quickResult.materials}
                />
              )}
            </div>

            {/* Today's Summary header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Today's Gate Overview</h2>
              <button
                onClick={loadOverview}
                disabled={overviewLoading}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                title="Refresh stats"
              >
                <RefreshCw className={`w-4 h-4 text-gray-500 ${overviewLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {overview ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard icon={Users}     label="Students Inside" value={overview.students_inside}  color="bg-emerald-500" />
                <StatCard icon={Briefcase} label="Staff Inside"     value={overview.staff_inside}     color="bg-blue-500" />
                <StatCard icon={UserCheck} label="Visitors Inside"  value={overview.visitors_inside}  color="bg-violet-500" />
                <StatCard icon={Clock}     label="Pending Visitors" value={overview.pending_visitors}                       color="bg-amber-500" />
                <StatCard icon={LogIn}     label="Entries Today"    value={overview.today_entries + visitorEntriesToday}   color="bg-gray-800" />
                <StatCard icon={LogOut}    label="Exits Today"      value={overview.today_exits + visitorExitsToday}       color="bg-gray-600" />
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 gap-3 text-gray-400">
                <Shield className="w-10 h-10 opacity-30" />
                <p className="text-sm">{overviewLoading ? "Loading overview…" : "No data yet"}</p>
                {!overviewLoading && (
                  <button onClick={loadOverview} className="text-xs text-black underline">Load overview</button>
                )}
              </div>
            )}

            {overview && overview.pending_visitors > 0 && (
              <button
                onClick={() => setMode("visitor")}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 hover:bg-amber-100 transition"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span><strong>{overview.pending_visitors}</strong> visitor{overview.pending_visitors !== 1 ? "s" : ""} waiting for gate approval</span>
                </div>
                <ChevronRight className="w-4 h-4 text-amber-600" />
              </button>
            )}

            {/* Recent Live Activity Stream */}
            {recentActivity.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Gate Scans</h3>
                <div className="divide-y divide-gray-100">
                  {recentActivity.map((act) => (
                    <div key={act.id} className="py-2.5 flex items-center gap-3">
                      <Avatar name={act.name} photo={act.photo} size={8} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-gray-900 truncate">{act.name}</p>
                          <span className="text-[10px] font-semibold text-gray-500 uppercase">{act.category}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{act.role}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1 ${
                            act.direction === "in"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {act.direction === "in" ? <LogIn className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                          {act.action === "TAP_IN" ? "Entered" : act.action === "TAP_OUT" ? "Exited" : act.action}
                        </span>
                        <span className="text-[10px] text-gray-400">{fmtTime(act.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STUDENT SCAN ──────────────────────────────────────── */}
        {mode === "student" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> Student Card Scan
                </h2>
                <div className="flex items-center gap-2">
                  {nfcSupported && (
                    <button
                      onClick={toggleNFC}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                        listening
                          ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Wifi className="w-3.5 h-3.5" />
                      <span>{listening ? "NFC Active" : "NFC"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={studentCardInput}
                  onChange={(e) => {
                    setStudentCardInput(e.target.value);
                    setStudentCard(null);
                    setStudentTapResult(null);
                    setStudentError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && lookupStudentCard()}
                  placeholder="Enter Card #, NFC UID (e.g. AC4C1107), or ADM-..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 font-mono"
                />
                <button
                  onClick={lookupStudentCard}
                  disabled={studentLookupLoading || !studentCardInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-black text-white rounded-xl disabled:opacity-40 hover:bg-gray-900 transition flex items-center gap-1.5"
                >
                  {studentLookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Look Up"}
                </button>
              </div>


              {studentError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{studentError}</span>
                </div>
              )}
            </div>

            {studentCard && !studentTapResult && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={studentCard.legal_name} photo={studentCard.profile_photo_path} size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{studentCard.legal_name}</p>
                    <p className="text-xs text-gray-500">{studentCard.class_name} · {studentCard.admission_number}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">Card: {studentCard.card_number}</p>
                  </div>
                  {studentCard.is_frozen && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Frozen</span>
                  )}
                </div>

                {studentCard.is_frozen ? (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5" />Card is frozen — cannot tap
                  </div>
                ) : (
                  <button
                    onClick={tapStudent}
                    disabled={studentTapLoading}
                    className="w-full py-3 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {studentTapLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span>Record Tap ({directionChoice === "auto" ? "Smart Direction" : directionChoice.toUpperCase()})</span>
                  </button>
                )}
              </div>
            )}

            {studentTapResult && studentCard && (
              <>
                <TapResultCard
                  result={studentTapResult}
                  name={studentCard.legal_name}
                  photo={studentCard.profile_photo_path}
                  schoolName={activeSchool?.name}
                  category="Student"
                  field1Label="Class"       field1Value={[studentCard.education_level_name, studentCard.class_name].filter(Boolean).join(" ") || "—"}
                  field2Label="Reg Number"  field2Value={studentCard.admission_number}
                  field3Label="Issue Date"  field3Value={fmtDate(studentIssuedAt)}
                  field4Label="Expiry Date" field4Value={studentIssuedAt ? fmtDate(addYears(studentIssuedAt, 3)) : "—"}
                />
                <button
                  onClick={() => {
                    setStudentCard(null);
                    setStudentTapResult(null);
                    setStudentCardInput("");
                  }}
                  className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Scan Next Student
                </button>
              </>
            )}
          </>
        )}

        {/* ── STAFF SCAN ────────────────────────────────────────── */}
        {mode === "staff" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" /> Staff Card Scan
                </h2>
                {nfcSupported && (
                  <button
                    onClick={toggleNFC}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                      listening
                        ? "bg-red-50 text-red-600 border-red-200 animate-pulse"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>{listening ? "NFC Active" : "NFC"}</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={staffCardInput}
                  onChange={(e) => {
                    setStaffCardInput(e.target.value);
                    setStaffCard(null);
                    setStaffTapResult(null);
                    setStaffError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && lookupStaffCard()}
                  placeholder="Enter Staff # (e.g. STF-GATE-01), Card #, or Name…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 font-mono"
                />
                <button
                  onClick={lookupStaffCard}
                  disabled={staffLookupLoading || !staffCardInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-black text-white rounded-xl disabled:opacity-40 hover:bg-gray-900 transition flex items-center gap-1.5"
                >
                  {staffLookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Look Up"}
                </button>
              </div>


              {staffError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{staffError}</span>
                </div>
              )}
            </div>

            {staffCard && !staffTapResult && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={staffCard.legal_name} photo={staffCard.profile_photo_path} size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{staffCard.legal_name}</p>
                    <p className="text-xs text-gray-500">{staffCard.job_title}{staffCard.department ? ` · ${staffCard.department}` : ""}</p>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">#{staffCard.employee_number} · Card: {staffCard.card_number}</p>
                  </div>
                  {staffCard.is_frozen && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Frozen</span>
                  )}
                </div>

                {staffCard.is_frozen ? (
                  <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5" />Card is frozen — cannot tap
                  </div>
                ) : (
                  <button
                    onClick={tapStaff}
                    disabled={staffTapLoading}
                    className="w-full py-3 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    {staffTapLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    <span>Record Tap ({directionChoice === "auto" ? "Smart Direction" : directionChoice.toUpperCase()})</span>
                  </button>
                )}
              </div>
            )}

            {staffTapResult && staffCard && (
              <>
                <TapResultCard
                  result={staffTapResult}
                  name={staffCard.legal_name}
                  photo={staffCard.profile_photo_path}
                  schoolName={activeSchool?.name}
                  category="Staff"
                  field1Label="Job Title"   field1Value={staffCard.job_title}
                  field2Label="Staff #"     field2Value={staffCard.employee_number}
                  field3Label="Department"  field3Value={staffCard.department || "—"}
                  field4Label="Issue Date"  field4Value={fmtDate(staffIssuedAt)}
                />
                <button
                  onClick={() => {
                    setStaffCard(null);
                    setStaffTapResult(null);
                    setStaffCardInput("");
                  }}
                  className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                >
                  Scan Next Staff Member
                </button>
              </>
            )}
          </>
        )}

        {/* ── VISITOR MANAGEMENT ────────────────────────────────── */}
        {mode === "visitor" && (
          <>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-700">Visitors</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
                />
                <button
                  onClick={loadVisits}
                  disabled={visitsLoading}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                  title="Refresh visitor list"
                >
                  <RefreshCw className={`w-4 h-4 text-gray-500 ${visitsLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-black text-white rounded-full hover:bg-gray-900 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register Visitor
                </button>
              </div>
            </div>

            {visitsLoading && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            )}

            {!visitsLoading && visits.length === 0 && (
              <div className="flex flex-col items-center py-12 gap-3 text-gray-400">
                <User className="w-10 h-10 opacity-30" />
                <p className="text-sm">No visitors registered today</p>
                <button onClick={() => setShowRegisterModal(true)} className="text-xs text-black underline">
                  Register a visitor
                </button>
              </div>
            )}

            {!visitsLoading && visits.map((v) => {
              const cfg = STATUS_CFG[v.status as VisitorStatus] ?? STATUS_CFG.pending;
              const busy = actionLoading?.startsWith(v.visit_id);
              return (
                <div key={v.visit_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar name={v.full_name} photo={null} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{v.full_name}</p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cfg.bg} ${cfg.text}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {v.is_blocked && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v.host_name ? `Visiting: ${v.host_name}` : "General Visit"}
                        {v.notes ? ` · Items: ${v.notes}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {v.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />{v.phone}
                          </span>
                        )}
                        {v.organization && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Building2 className="w-3 h-3" />{v.organization}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-mono">
                          <Hash className="w-3 h-3" />{v.pass_reference}
                        </span>
                      </div>
                      {(v.arrived_at || v.departed_at) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {v.arrived_at ? `In: ${fmtTime(v.arrived_at)}` : ""}
                          {v.arrived_at && v.departed_at ? " · " : ""}
                          {v.departed_at ? `Out: ${fmtTime(v.departed_at)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!v.is_blocked && (
                    <div className="flex gap-2 flex-wrap pt-1 border-t border-gray-50">
                      {(v.status === "pending" || v.status === "approved") && (
                        <button
                          disabled={busy}
                          onClick={() => visitorAction(v.visit_id, "admit")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Admit Entry
                        </button>
                      )}
                      {v.status === "pending" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => visitorAction(v.visit_id, "approve")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => visitorAction(v.visit_id, "deny")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-xl hover:bg-red-200 disabled:opacity-50 transition"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Deny
                          </button>
                        </>
                      )}
                      {v.status === "inside" && (
                        <button
                          disabled={busy}
                          onClick={() => visitorAction(v.visit_id, "checkout")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-xl hover:bg-black disabled:opacity-50 transition"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Check Out
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {showRegisterModal && schoolId && (
        <RegisterVisitorModal
          schoolId={schoolId}
          onClose={() => setShowRegisterModal(false)}
          onSuccess={({ passReference }) => {
            setShowRegisterModal(false);
            showToast(`Visitor registered — Pass: ${passReference}`, "success");
            loadVisits();
            loadOverview();
          }}
        />
      )}
    </DashboardShell>
  );
}