"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Home, Users, UserCheck, UserPlus, CreditCard, Shield,
  LogIn, LogOut, Search, RefreshCw, CheckCircle, XCircle,
  Clock, AlertTriangle, X, ChevronRight, Building2, Phone,
  IdCard, Briefcase, User, Hash,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  supabaseVisitorService,
  type VisitorVisitRow,
  type VisitorProfileRow,
} from "@/lib/supabase/services/visitorService";
import { supabaseAttendanceService } from "@/lib/supabase/services/attendanceService";

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
}

type TapResult = {
  action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "DUPLICATE";
  direction: "in" | "out";
  check_in_time: string | null;
  check_out_time: string | null;
  tap_in_points: number;
  tap_out_points: number;
};

const STATUS_CFG: Record<VisitorStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "Pending",   bg: "bg-amber-100",   text: "text-amber-800",  dot: "bg-amber-500" },
  approved:  { label: "Approved",  bg: "bg-blue-100",    text: "text-blue-800",   dot: "bg-blue-500" },
  inside:    { label: "Inside",    bg: "bg-green-100",   text: "text-green-800",  dot: "bg-green-500" },
  completed: { label: "Completed", bg: "bg-gray-100",    text: "text-gray-600",   dot: "bg-gray-400" },
  cancelled: { label: "Cancelled", bg: "bg-gray-100",    text: "text-gray-500",   dot: "bg-gray-300" },
  denied:    { label: "Denied",    bg: "bg-red-100",     text: "text-red-800",    dot: "bg-red-500" },
};

function Avatar({ name, photo, size = 10 }: { name: string; photo: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 37 % 360;
  if (photo) return <img src={photo} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} alt="" />;
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}
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

function TapResultCard({ result, name, photo, role }: { result: TapResult; name: string; photo: string | null; role?: string }) {
  const isIn  = result.action === "TAP_IN";
  const isOut = result.action === "TAP_OUT";
  const isDup = result.action === "ALREADY_OUT" || result.action === "DUPLICATE";
  const bg    = isIn ? "bg-green-50 border-green-200" : isOut ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200";
  const icon  = isIn ? <LogIn  className="w-5 h-5 text-green-600" /> : isOut ? <LogOut className="w-5 h-5 text-blue-600" /> : <Clock className="w-5 h-5 text-gray-400" />;
  const label = isIn ? "Tapped In" : isOut ? "Tapped Out" : isDup ? "Already Out" : "Duplicate";

  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 ${bg}`}>
      <Avatar name={name} photo={photo} size={12} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        {role && <p className="text-xs text-gray-500 truncate">{role}</p>}
        <div className="flex items-center gap-2 mt-1">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-gray-400 ml-auto">
            {result.tap_in_points + result.tap_out_points}/{4} pts
          </span>
        </div>
        {(result.check_in_time || result.check_out_time) && (
          <p className="text-xs text-gray-400 mt-0.5">
            In: {fmtTime(result.check_in_time)}  Out: {fmtTime(result.check_out_time)}
          </p>
        )}
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
    fullName: "", phone: "", idType: "", idReference: "",
    organization: "", hostName: "", hostDepartment: "", purpose: "", notes: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VisitorProfileRow[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<VisitorProfileRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      fullName:      p.full_name,
      phone:         p.phone ?? "",
      idType:        p.id_type ?? "",
      idReference:   p.id_reference ?? "",
      organization:  p.organization ?? "",
    }));
    setSearchResults([]);
    setSearchQuery("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Full name is required"); return; }
    if (!form.purpose.trim()) { setError("Purpose is required"); return; }
    setLoading(true);
    setError("");
    try {
      const result = await supabaseVisitorService.registerVisitorVisit({
        schoolId,
        fullName:          form.fullName.trim(),
        phone:             form.phone.trim() || null,
        idType:            form.idType.trim() || null,
        idReference:       form.idReference.trim() || null,
        organization:      form.organization.trim() || null,
        hostName:          form.hostName.trim() || null,
        hostDepartment:    form.hostDepartment.trim() || null,
        purpose:           form.purpose.trim(),
        notes:             form.notes.trim() || null,
        visitorProfileId:  selectedProfile?.visitor_profile_id ?? null,
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
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Host Name</label>
              <input value={form.hostName} onChange={(e) => set("hostName", e.target.value)} className={inputCls} placeholder="Person to visit" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Host Department</label>
              <input value={form.hostDepartment} onChange={(e) => set("hostDepartment", e.target.value)} className={inputCls} placeholder="e.g. Admin, S1A" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Purpose *</label>
              <input value={form.purpose} onChange={(e) => set("purpose", e.target.value)} required className={inputCls} placeholder="Reason for visit" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="Optional notes" />
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
  const [mode, setMode] = useState<GateMode>("home");

  // Home overview
  const [overview, setOverview] = useState<Overview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Student scan
  const [studentCardInput, setStudentCardInput] = useState("");
  const [studentCard, setStudentCard] = useState<StudentCard | null>(null);
  const [studentLookupLoading, setStudentLookupLoading] = useState(false);
  const [studentTapResult, setStudentTapResult] = useState<TapResult | null>(null);
  const [studentTapLoading, setStudentTapLoading] = useState(false);
  const [studentError, setStudentError] = useState("");

  // Staff scan
  const [staffCardInput, setStaffCardInput] = useState("");
  const [staffCard, setStaffCard] = useState<StaffCard | null>(null);
  const [staffLookupLoading, setStaffLookupLoading] = useState(false);
  const [staffTapResult, setStaffTapResult] = useState<TapResult | null>(null);
  const [staffTapLoading, setStaffTapLoading] = useState(false);
  const [staffError, setStaffError] = useState("");

  // Visitor management
  const [visits, setVisits] = useState<VisitorVisitRow[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const schoolId = activeSchool?.id;

  const loadOverview = useCallback(async () => {
    if (!schoolId) return;
    setOverviewLoading(true);
    try {
      const data = await supabaseVisitorService.getGateOverview({ schoolId });
      setOverview(data);
    } catch (err: any) {
      showToast(err?.message || "Failed to load gate overview", "error");
    } finally {
      setOverviewLoading(false);
    }
  }, [schoolId]);

  const loadVisits = useCallback(async () => {
    if (!schoolId) return;
    setVisitsLoading(true);
    try {
      const data = await supabaseVisitorService.listVisitorVisits({ schoolId });
      setVisits(data);
    } catch (err: any) {
      showToast(err?.message || "Failed to load visitor list", "error");
    } finally {
      setVisitsLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (authLoading || !schoolId) return;
    if (mode === "home")    loadOverview();
    if (mode === "visitor") loadVisits();
  }, [mode, authLoading, schoolId]);

  async function lookupStudentCard() {
    if (!schoolId || !studentCardInput.trim()) return;
    setStudentLookupLoading(true);
    setStudentError("");
    setStudentCard(null);
    setStudentTapResult(null);
    try {
      const client = (await import("@/lib/supabase/client")).getSafeBrowserClient();
      if (!client) throw new Error("Supabase is not configured");
      const { data, error } = await client.rpc("lookup_card_holder", {
        p_school_id:   schoolId,
        p_card_number: studentCardInput.trim(),
      });
      if (error) throw error;
      if (!data || (data as any[]).length === 0) throw new Error("No student card found with that number");
      setStudentCard((data as any[])[0] as StudentCard);
    } catch (err: any) {
      setStudentError(err?.message || "Card not found");
    } finally {
      setStudentLookupLoading(false);
    }
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
        direction:       "auto",
      });
      setStudentTapResult(result);
      loadOverview();
    } catch (err: any) {
      setStudentError(err?.message || "Tap failed");
    } finally {
      setStudentTapLoading(false);
    }
  }

  async function lookupStaffCard() {
    if (!schoolId || !staffCardInput.trim()) return;
    setStaffLookupLoading(true);
    setStaffError("");
    setStaffCard(null);
    setStaffTapResult(null);
    try {
      const result = await supabaseAttendanceService.lookupStaffCardHolder({
        schoolId,
        cardNumber: staffCardInput.trim(),
      });
      if (!result) throw new Error("No staff card found with that number");
      setStaffCard(result as StaffCard);
    } catch (err: any) {
      setStaffError(err?.message || "Card not found");
    } finally {
      setStaffLookupLoading(false);
    }
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
        direction:       "auto",
      });
      setStaffTapResult({
        action:         result.action,
        direction:      result.direction,
        check_in_time:  result.check_in_time,
        check_out_time: result.check_out_time,
        tap_in_points:  result.tap_in_points,
        tap_out_points: result.tap_out_points,
      });
      loadOverview();
    } catch (err: any) {
      setStaffError(err?.message || "Tap failed");
    } finally {
      setStaffTapLoading(false);
    }
  }

  async function visitorAction(visitId: string, action: "admit" | "checkout" | "approve" | "deny", reason?: string) {
    if (!schoolId) return;
    setActionLoading(visitId + action);
    try {
      if (action === "admit")    await supabaseVisitorService.admitVisitor({ schoolId, visitId });
      if (action === "checkout") await supabaseVisitorService.checkoutVisitor({ schoolId, visitId });
      if (action === "approve")  await supabaseVisitorService.approveVisitor({ schoolId, visitId });
      if (action === "deny")     await supabaseVisitorService.denyVisitor({ schoolId, visitId, reason });
      await loadVisits();
      await loadOverview();
      showToast(`Visitor ${action}ed successfully`, "success");
    } catch (err: any) {
      showToast(err?.message || `Failed to ${action} visitor`, "error");
    } finally {
      setActionLoading(null);
    }
  }

  const TABS: { key: GateMode; icon: any; label: string }[] = [
    { key: "home",    icon: Home,      label: "Overview" },
    { key: "student", icon: Users,     label: "Student" },
    { key: "staff",   icon: Briefcase, label: "Staff" },
    { key: "visitor", icon: UserPlus,  label: "Visitors" },
  ];

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {/* Tab Nav */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all ${
                mode === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── HOME OVERVIEW ─────────────────────────────────────── */}
        {mode === "home" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Today's Summary</h2>
              <button onClick={loadOverview} disabled={overviewLoading} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                <RefreshCw className={`w-4 h-4 text-gray-500 ${overviewLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {overview ? (
              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Users}     label="Students Inside" value={overview.students_inside}  color="bg-emerald-500" />
                <StatCard icon={Briefcase} label="Staff Inside"     value={overview.staff_inside}     color="bg-blue-500" />
                <StatCard icon={UserCheck} label="Visitors Inside"  value={overview.visitors_inside}  color="bg-violet-500" />
                <StatCard icon={Clock}     label="Pending Visitors" value={overview.pending_visitors} color="bg-amber-500" />
                <StatCard icon={LogIn}     label="Entries Today"    value={overview.today_entries}    color="bg-gray-700" />
                <StatCard icon={LogOut}    label="Exits Today"      value={overview.today_exits}      color="bg-gray-500" />
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
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 hover:bg-amber-100"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong>{overview.pending_visitors}</strong> visitor{overview.pending_visitors !== 1 ? "s" : ""} waiting for approval</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* ── STUDENT SCAN ──────────────────────────────────────── */}
        {mode === "student" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Student Card Scan
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={studentCardInput}
                  onChange={(e) => { setStudentCardInput(e.target.value); setStudentCard(null); setStudentTapResult(null); setStudentError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && lookupStudentCard()}
                  placeholder="Enter card number…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10"
                />
                <button
                  onClick={lookupStudentCard}
                  disabled={studentLookupLoading || !studentCardInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-black text-white rounded-xl disabled:opacity-40 hover:bg-gray-900"
                >
                  {studentLookupLoading ? "…" : "Look Up"}
                </button>
              </div>
              {studentError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{studentError}
                </div>
              )}
            </div>

            {studentCard && !studentTapResult && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={studentCard.legal_name} photo={studentCard.profile_photo_path} size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{studentCard.legal_name}</p>
                    <p className="text-xs text-gray-500">{studentCard.class_name} · {studentCard.admission_number}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Card: {studentCard.card_number}</p>
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
                    className="w-full py-3 text-sm font-semibold bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50"
                  >
                    {studentTapLoading ? "Processing…" : "Record Tap"}
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
                  role={studentCard.class_name}
                />
                <button
                  onClick={() => { setStudentCard(null); setStudentTapResult(null); setStudentCardInput(""); }}
                  className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Scan Next
                </button>
              </>
            )}
          </>
        )}

        {/* ── STAFF SCAN ────────────────────────────────────────── */}
        {mode === "staff" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Staff Card Scan
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={staffCardInput}
                  onChange={(e) => { setStaffCardInput(e.target.value); setStaffCard(null); setStaffTapResult(null); setStaffError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && lookupStaffCard()}
                  placeholder="Enter card number…"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10"
                />
                <button
                  onClick={lookupStaffCard}
                  disabled={staffLookupLoading || !staffCardInput.trim()}
                  className="px-4 py-2 text-sm font-medium bg-black text-white rounded-xl disabled:opacity-40 hover:bg-gray-900"
                >
                  {staffLookupLoading ? "…" : "Look Up"}
                </button>
              </div>
              {staffError && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{staffError}
                </div>
              )}
            </div>

            {staffCard && !staffTapResult && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={staffCard.legal_name} photo={staffCard.profile_photo_path} size={14} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{staffCard.legal_name}</p>
                    <p className="text-xs text-gray-500">{staffCard.job_title}{staffCard.department ? ` · ${staffCard.department}` : ""}</p>
                    <p className="text-xs text-gray-400 mt-0.5">#{staffCard.employee_number} · Card: {staffCard.card_number}</p>
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
                    className="w-full py-3 text-sm font-semibold bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50"
                  >
                    {staffTapLoading ? "Processing…" : "Record Tap"}
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
                  role={`${staffCard.job_title}${staffCard.department ? ` · ${staffCard.department}` : ""}`}
                />
                <button
                  onClick={() => { setStaffCard(null); setStaffTapResult(null); setStaffCardInput(""); }}
                  className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Scan Next
                </button>
              </>
            )}
          </>
        )}

        {/* ── VISITOR MANAGEMENT ────────────────────────────────── */}
        {mode === "visitor" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Today's Visitors</h2>
              <div className="flex items-center gap-2">
                <button onClick={loadVisits} disabled={visitsLoading} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <RefreshCw className={`w-4 h-4 text-gray-500 ${visitsLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-gray-900"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Register
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
                <p className="text-sm">No visitors today</p>
                <button onClick={() => setShowRegisterModal(true)} className="text-xs text-black underline">Register a visitor</button>
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
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">Blocked</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {v.purpose}{v.host_name ? ` · Visiting: ${v.host_name}` : ""}
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
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Hash className="w-3 h-3" />{v.pass_reference}
                        </span>
                      </div>
                      {(v.arrived_at || v.departed_at) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {v.arrived_at ? `In: ${fmtTime(v.arrived_at)}` : ""}
                          {v.arrived_at && v.departed_at ? "  " : ""}
                          {v.departed_at ? `Out: ${fmtTime(v.departed_at)}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!v.is_blocked && (
                    <div className="flex gap-2 flex-wrap">
                      {(v.status === "pending" || v.status === "approved") && (
                        <button
                          disabled={busy}
                          onClick={() => visitorAction(v.visit_id, "admit")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                        >
                          <LogIn className="w-3.5 h-3.5" /> Admit
                        </button>
                      )}
                      {v.status === "pending" && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() => visitorAction(v.visit_id, "approve")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => visitorAction(v.visit_id, "deny")}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 rounded-xl hover:bg-red-200 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Deny
                          </button>
                        </>
                      )}
                      {v.status === "inside" && (
                        <button
                          disabled={busy}
                          onClick={() => visitorAction(v.visit_id, "checkout")}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-xl hover:bg-black disabled:opacity-50"
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
          onSuccess={({ passReference, visitId }) => {
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
