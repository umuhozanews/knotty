"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, ChevronLeft, Loader2, CheckCircle, XCircle, Clock,
  Shield, Heart, Users, AlertTriangle, ShoppingCart, Package,
  LogIn, LogOut, UserCheck,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { supabaseAttendanceService, supabaseDisciplineService, supabaseHealthService } from "@/lib/supabase/services";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { DisciplineRecord, HealthRecord } from "@/lib/api";

type View = "home" | "attendance" | "discipline" | "health" | "gate" | "canteen" | "material";

type ClassAttendanceData = {
  classId: string;
  className: string;
  levelName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
};

type GateStudentRow = {
  student_id: string;
  legal_name: string;
  admission_number: string;
  status: string;
  first_arrived_at: string | null;
  departed_at: string | null;
};

type VisitorRow = {
  id: string;
  purpose: string;
  status: string;
  arrived_at: string | null;
  departed_at: string | null;
  created_at: string;
};

type CanteenRow = {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
  student_id: string | null;
};

type MaterialRow = {
  id: string;
  material_id: string;
  transaction_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  school_materials: { name: string; unit: string } | null;
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

const TXN_TYPE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  stock_in:   { label: "Stock In",   bg: "#DCFCE7", color: "#166534" },
  stock_out:  { label: "Stock Out",  bg: "#FEF9C3", color: "#854D0E" },
  assigned:   { label: "Assigned",   bg: "#EFF6FF", color: "#1D4ED8" },
  returned:   { label: "Returned",   bg: "#F5F3FF", color: "#6D28D9" },
  adjustment: { label: "Adjustment", bg: "#F3F4F6", color: "#374151" },
};

export default function ReportsPage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const schoolId = activeSchool?.id || user?.school_id || "";
  const today = new Date().toISOString().split("T")[0];

  const [view, setView]       = useState<View>("home");
  const [date, setDate]       = useState(today);
  const [loading, setLoading] = useState(false);

  // Existing state
  const [classAttendance, setClassAttendance]     = useState<ClassAttendanceData[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [healthRecords, setHealthRecords]         = useState<HealthRecord[]>([]);

  // New state
  const [gateStudents, setGateStudents]   = useState<GateStudentRow[]>([]);
  const [gateVisitors, setGateVisitors]   = useState<VisitorRow[]>([]);
  const [canteenRows, setCanteenRows]     = useState<CanteenRow[]>([]);
  const [materialRows, setMaterialRows]   = useState<MaterialRow[]>([]);

  const loadAttendance = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const rows = await supabaseAttendanceService.getClassAttendanceReport({ schoolId, date });
      const classMap = new Map<string, ClassAttendanceData>();
      for (const row of rows) {
        const classId   = row.class_section_id ?? "unknown";
        const className = row.class_name ?? "Unknown Class";
        const levelName = row.level_name ?? "";
        if (!classMap.has(classId)) {
          classMap.set(classId, { classId, className, levelName, present: 0, absent: 0, late: 0, total: 0 });
        }
        const cls = classMap.get(classId)!;
        cls.total++;
        if (row.status === "present") cls.present++;
        else if (row.status === "absent") cls.absent++;
        else cls.late++;
      }
      setClassAttendance(Array.from(classMap.values()).sort((a, b) => a.className.localeCompare(b.className)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  const loadDiscipline = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await supabaseDisciplineService.schoolList(schoolId, { limit: 200 });
      setDisciplineRecords(records.filter(r => r.recorded_at.startsWith(date)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  const loadHealth = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await supabaseHealthService.schoolRecords(schoolId, { limit: 200 });
      setHealthRecords(records.filter(r => r.recorded_at.startsWith(date)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  const loadGate = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;

      const [attRes, visRes] = await Promise.allSettled([
        supabaseAttendanceService.getClassAttendanceReport({ schoolId, date }),
        client
          .from("visitor_visits")
          .select("id, purpose, status, arrived_at, departed_at, created_at")
          .eq("school_id", schoolId)
          .gte("created_at", date + "T00:00:00")
          .lte("created_at", date + "T23:59:59")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (attRes.status === "fulfilled") {
        const rows: GateStudentRow[] = attRes.value
          .filter(r => r.first_arrived_at)
          .sort((a, b) => (a.first_arrived_at ?? "").localeCompare(b.first_arrived_at ?? ""))
          .map(r => ({
            student_id: r.student_id,
            legal_name: r.legal_name,
            admission_number: r.admission_number,
            status: r.status,
            first_arrived_at: r.first_arrived_at,
            departed_at: r.departed_at,
          }));
        setGateStudents(rows);
      }

      if (visRes.status === "fulfilled") {
        setGateVisitors((visRes.value.data || []) as VisitorRow[]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  const loadCanteen = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const { data } = await client
        .from("canteen_transactions")
        .select("id, total_amount, status, created_at, student_id")
        .eq("school_id", schoolId)
        .gte("created_at", date + "T00:00:00")
        .lte("created_at", date + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(100);
      setCanteenRows((data || []) as CanteenRow[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  const loadMaterials = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const { data } = await client
        .from("material_transactions")
        .select("id, material_id, transaction_type, quantity, notes, created_at, school_materials:material_id(name, unit)")
        .eq("school_id", schoolId)
        .gte("created_at", date + "T00:00:00")
        .lte("created_at", date + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(100);
      setMaterialRows((data || []) as MaterialRow[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, date]);

  useEffect(() => {
    if (authLoading) return;
    if (view === "attendance")  loadAttendance();
    else if (view === "discipline") loadDiscipline();
    else if (view === "health") loadHealth();
    else if (view === "gate")   loadGate();
    else if (view === "canteen") loadCanteen();
    else if (view === "material") loadMaterials();
  }, [view, authLoading, date, loadAttendance, loadDiscipline, loadHealth, loadGate, loadCanteen, loadMaterials]);

  const viewTitle: Record<View, string> = {
    home: "Reports",
    attendance: "Attendance Report",
    discipline: "Discipline Report",
    health: "Health Report",
    gate: "Gate Report",
    canteen: "Canteen Report",
    material: "Materials Report",
  };

  // Canteen totals
  const canteenTotal   = canteenRows.reduce((s, r) => s + (r.total_amount || 0), 0);
  const canteenCount   = canteenRows.length;

  // Materials totals
  const matStockIn   = materialRows.filter(r => r.transaction_type === "stock_in").reduce((s, r) => s + r.quantity, 0);
  const matStockOut  = materialRows.filter(r => r.transaction_type === "stock_out").reduce((s, r) => s + r.quantity, 0);
  const matAssigned  = materialRows.filter(r => r.transaction_type === "assigned").reduce((s, r) => s + r.quantity, 0);

  return (
    <DashboardShell>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          {view !== "home" && (
            <button onClick={() => setView("home")}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-gray-800">{viewTitle[view]}</h1>
            {view === "home" && <p className="text-xs text-gray-400 mt-0.5">School reports by date and category</p>}
          </div>
        </div>

        {/* Home: 6 category tiles */}
        {view === "home" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button onClick={() => setView("attendance")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-green-50">
                <Users size={20} className="text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Attendance</p>
              <p className="text-xs text-gray-400 mt-0.5">Per-class attendance by date</p>
            </button>

            <button onClick={() => setView("gate")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-50">
                <Shield size={20} className="text-blue-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Gate</p>
              <p className="text-xs text-gray-400 mt-0.5">Entry/exit & visitors log</p>
            </button>

            <button onClick={() => setView("canteen")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-orange-50">
                <ShoppingCart size={20} className="text-orange-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Canteen</p>
              <p className="text-xs text-gray-400 mt-0.5">Daily sales & transactions</p>
            </button>

            <button onClick={() => setView("material")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-teal-50">
                <Package size={20} className="text-teal-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Materials</p>
              <p className="text-xs text-gray-400 mt-0.5">Stock movements by date</p>
            </button>

            <button onClick={() => setView("discipline")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-red-50">
                <Shield size={20} className="text-red-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Discipline</p>
              <p className="text-xs text-gray-400 mt-0.5">Offense records by date</p>
            </button>

            <button onClick={() => setView("health")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-pink-50">
                <Heart size={20} className="text-pink-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Health</p>
              <p className="text-xs text-gray-400 mt-0.5">Health incidents by date</p>
            </button>
          </div>
        )}

        {/* Date picker (all report views) */}
        {view !== "home" && (
          <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1">
              <input
                type="date"
                value={date}
                max={today}
                onChange={e => setDate(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent outline-none w-full"
              />
              <p className="text-xs text-gray-400 mt-0.5">{fmtDate(date)}</p>
            </div>
          </div>
        )}

        {/* ── Attendance (unchanged) ── */}
        {view === "attendance" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : classAttendance.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <AlertTriangle size={32} className="mb-2" />
              <p className="text-sm">No attendance data for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {classAttendance.length} class{classAttendance.length !== 1 ? "es" : ""}
              </p>
              {classAttendance.map(cls => {
                const pct   = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
                const color = pct >= 85 ? "#16A34A" : pct >= 70 ? "#D97706" : "#DC2626";
                return (
                  <div key={cls.classId} className="bg-white rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{cls.className}</p>
                        {cls.levelName && <p className="text-xs text-gray-400">{cls.levelName}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold" style={{ color }}>{pct}%</p>
                        <p className="text-xs text-gray-400">{cls.present}/{cls.total} present</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={11} /> {cls.present} present</span>
                      <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={11} /> {cls.absent} absent</span>
                      {cls.late > 0 && <span className="flex items-center gap-1 text-xs text-amber-500"><Clock size={11} /> {cls.late} late</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Discipline (unchanged) ── */}
        {view === "discipline" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : disciplineRecords.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <CheckCircle size={32} className="mb-2 text-green-200" />
              <p className="text-sm text-green-500">No offenses recorded for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {disciplineRecords.length} offense{disciplineRecords.length !== 1 ? "s" : ""}
              </p>
              {disciplineRecords.map(r => {
                const sevColor = r.severity === "SERIOUS"
                  ? { bg: "#FEE2E2", text: "#991B1B" }
                  : r.severity === "MODERATE"
                  ? { bg: "#FEF9C3", text: "#854D0E" }
                  : { bg: "#F3F4F6", text: "#374151" };
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5"
                        style={{ background: sevColor.bg, color: sevColor.text }}>{r.severity}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                        {r.student && <p className="text-xs text-gray-500">{r.student.user.first_name} {r.student.user.last_name}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock size={9} className="inline mr-1" />
                          {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {r.student_code && ` · ${r.student_code}`}
                        </p>
                      </div>
                      {(r.marks_deducted ?? 0) > 0 && <span className="text-xs font-bold text-red-500 shrink-0">-{r.marks_deducted}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Health (unchanged) ── */}
        {view === "health" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : healthRecords.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <CheckCircle size={32} className="mb-2 text-green-200" />
              <p className="text-sm text-green-500">No health incidents for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {healthRecords.length} incident{healthRecords.length !== 1 ? "s" : ""}
              </p>
              {healthRecords.map(r => {
                const sevColor = r.severity === "HIGH"
                  ? { bg: "#FEE2E2", text: "#991B1B" }
                  : r.severity === "MEDIUM"
                  ? { bg: "#FEF9C3", text: "#854D0E" }
                  : { bg: "#DCFCE7", text: "#166534" };
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5"
                        style={{ background: sevColor.bg, color: sevColor.text }}>{r.severity}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                        {r.student && <p className="text-xs text-gray-500">{r.student.user.first_name} {r.student.user.last_name}</p>}
                        {r.treatment_given && <p className="text-xs text-green-600 mt-0.5 truncate">{r.treatment_given}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock size={9} className="inline mr-1" />
                          {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {r.student_code && ` · ${r.student_code}`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Gate ── */}
        {view === "gate" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : (gateStudents.length === 0 && gateVisitors.length === 0) ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <Shield size={32} className="mb-2" />
              <p className="text-sm">No gate activity for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-blue-600">{gateStudents.length}</p>
                  <p className="text-[10px] text-gray-400">Students</p>
                </div>
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-purple-600">{gateVisitors.filter(v => v.status === "inside" || v.status === "completed").length}</p>
                  <p className="text-[10px] text-gray-400">Visitors</p>
                </div>
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-gray-700">{gateStudents.length + gateVisitors.length}</p>
                  <p className="text-[10px] text-gray-400">Total</p>
                </div>
              </div>

              {/* Student gate activity */}
              {gateStudents.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Student Gate Activity</p>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {gateStudents.map((s, idx) => (
                      <div key={s.student_id}
                        className={`flex items-center gap-3 px-4 py-3 ${idx < gateStudents.length - 1 ? "border-b border-gray-50" : ""}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: `hsl(${(s.legal_name.charCodeAt(0) * 37) % 360}, 55%, 55%)` }}>
                          {s.legal_name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{s.legal_name}</p>
                          <p className="text-[10px] text-gray-400">{s.admission_number}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-[10px] text-green-600">
                            <LogIn size={10} /> {fmtTime(s.first_arrived_at)}
                          </div>
                          {s.departed_at && (
                            <div className="flex items-center gap-1 text-[10px] text-blue-500">
                              <LogOut size={10} /> {fmtTime(s.departed_at)}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                          style={s.status === "present" ? { background: "#DCFCE7", color: "#166534" } : { background: "#FEF9C3", color: "#854D0E" }}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Visitors */}
              {gateVisitors.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Visitors</p>
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    {gateVisitors.map((v, idx) => (
                      <div key={v.id}
                        className={`flex items-center gap-3 px-4 py-3 ${idx < gateVisitors.length - 1 ? "border-b border-gray-50" : ""}`}>
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <UserCheck size={14} className="text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{v.purpose}</p>
                          <div className="flex gap-2 text-[10px] text-gray-400 mt-0.5">
                            {v.arrived_at && <span><LogIn size={9} className="inline mr-0.5" />{fmtTime(v.arrived_at)}</span>}
                            {v.departed_at && <span><LogOut size={9} className="inline mr-0.5" />{fmtTime(v.departed_at)}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 bg-gray-100 text-gray-600">
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        )}

        {/* ── Canteen ── */}
        {view === "canteen" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : canteenRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <ShoppingCart size={32} className="mb-2" />
              <p className="text-sm">No canteen transactions for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-2xl p-3 shadow-sm">
                  <p className="text-lg font-bold text-orange-500">{canteenCount}</p>
                  <p className="text-xs text-gray-400">Transactions</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm">
                  <p className="text-lg font-bold text-green-600">{canteenTotal.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Total (RWF)</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {canteenRows.map((r, idx) => (
                  <div key={r.id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < canteenRows.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <ShoppingCart size={14} className="text-orange-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">{fmtTime(r.created_at)}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${
                      r.status === "completed" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>{r.status}</span>
                    <p className="text-sm font-bold text-green-700 shrink-0">
                      {(r.total_amount || 0).toLocaleString()} RWF
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── Materials ── */}
        {view === "material" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : materialRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <Package size={32} className="mb-2" />
              <p className="text-sm">No stock movements for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-green-600">{matStockIn}</p>
                  <p className="text-[10px] text-gray-400">Stock In</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-amber-600">{matStockOut}</p>
                  <p className="text-[10px] text-gray-400">Stock Out</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-blue-600">{matAssigned}</p>
                  <p className="text-[10px] text-gray-400">Assigned</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {materialRows.map((r, idx) => {
                  const cfg = TXN_TYPE_CFG[r.transaction_type] ?? TXN_TYPE_CFG.adjustment;
                  const matName = r.school_materials?.name ?? "Unknown";
                  const unit    = r.school_materials?.unit ?? "unit";
                  return (
                    <div key={r.id}
                      className={`flex items-center gap-3 px-4 py-3 ${idx < materialRows.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: cfg.bg }}>
                        <Package size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{matName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          {r.notes && <span className="text-[10px] text-gray-400 truncate">{r.notes}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-800">{r.quantity} <span className="text-xs font-normal text-gray-400">{unit}</span></p>
                        <p className="text-[10px] text-gray-400">{fmtTime(r.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

      </div>
    </DashboardShell>
  );
}
