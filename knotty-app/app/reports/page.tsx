"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, ChevronLeft, Loader2, CheckCircle, XCircle, Clock,
  Shield, Heart, Users, AlertTriangle, ShoppingCart, Package,
  LogIn, LogOut, UserCheck, Printer, Library,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import {
  supabaseAttendanceService, supabaseDisciplineService,
  supabaseHealthService, supabaseLibraryService,
} from "@/lib/supabase/services";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { DisciplineRecord, HealthRecord } from "@/lib/api";

type View = "home" | "attendance" | "discipline" | "health" | "gate" | "canteen" | "material" | "staff_attendance" | "library";

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

type StaffAttRow = {
  staff_record_id: string;
  legal_name: string;
  job_title: string;
  status: string;
  first_arrived_at: string | null;
  departed_at: string | null;
  rank: number | null;
  punchStatus: "on_time" | "late" | "absent";
};

type LibraryRow = {
  id: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
  student_name: string;
  student_code: string;
  book_title: string;
  book_author: string;
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function fmtDateShort(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const TXN_TYPE_CFG: Record<string, { label: string; bg: string; color: string }> = {
  stock_in:   { label: "Stock In",   bg: "#DCFCE7", color: "#166534" },
  stock_out:  { label: "Stock Out",  bg: "#FEF9C3", color: "#854D0E" },
  assigned:   { label: "Assigned",   bg: "#EFF6FF", color: "#1D4ED8" },
  returned:   { label: "Returned",   bg: "#F5F3FF", color: "#6D28D9" },
  adjustment: { label: "Adjustment", bg: "#F3F4F6", color: "#374151" },
};

const today = new Date().toISOString().split("T")[0];
const sevenDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];

export default function ReportsPage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const schoolId = activeSchool?.id || user?.school_id || "";

  const [view, setView]           = useState<View>("home");
  const [dateFrom, setDateFrom]   = useState(sevenDaysAgo);
  const [dateTo, setDateTo]       = useState(today);
  const [loading, setLoading]     = useState(false);

  const [classAttendance, setClassAttendance]   = useState<ClassAttendanceData[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [healthRecords, setHealthRecords]       = useState<HealthRecord[]>([]);
  const [gateStudents, setGateStudents]         = useState<GateStudentRow[]>([]);
  const [gateVisitors, setGateVisitors]         = useState<VisitorRow[]>([]);
  const [canteenRows, setCanteenRows]           = useState<CanteenRow[]>([]);
  const [materialRows, setMaterialRows]         = useState<MaterialRow[]>([]);
  const [staffAttRows, setStaffAttRows]         = useState<StaffAttRow[]>([]);
  const [libraryRows, setLibraryRows]           = useState<LibraryRow[]>([]);

  // Attendance: single-day detailed view uses dateFrom; range shows aggregate
  const loadAttendance = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const rows = await supabaseAttendanceService.getClassAttendanceReport({ schoolId, date: dateFrom });
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
  }, [schoolId, dateFrom]);

  const loadDiscipline = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await supabaseDisciplineService.schoolList(schoolId, { limit: 500 });
      setDisciplineRecords(
        records.filter(r => {
          const d = r.recorded_at.split("T")[0];
          return d >= dateFrom && d <= dateTo;
        })
      );
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

  const loadHealth = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await supabaseHealthService.schoolRecords(schoolId, { limit: 500 });
      setHealthRecords(
        records.filter(r => {
          const d = r.recorded_at.split("T")[0];
          return d >= dateFrom && d <= dateTo;
        })
      );
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

  const loadGate = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;

      const [attRes, visRes] = await Promise.allSettled([
        supabaseAttendanceService.getClassAttendanceReport({ schoolId, date: dateFrom }),
        client
          .from("visitor_visits")
          .select("id, purpose, status, arrived_at, departed_at, created_at")
          .eq("school_id", schoolId)
          .gte("created_at", dateFrom + "T00:00:00")
          .lte("created_at", dateTo + "T23:59:59")
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (attRes.status === "fulfilled") {
        setGateStudents(
          attRes.value
            .filter(r => r.first_arrived_at)
            .sort((a, b) => (a.first_arrived_at ?? "").localeCompare(b.first_arrived_at ?? ""))
            .map(r => ({
              student_id: r.student_id,
              legal_name: r.legal_name,
              admission_number: r.admission_number,
              status: r.status,
              first_arrived_at: r.first_arrived_at,
              departed_at: r.departed_at,
            }))
        );
      }
      if (visRes.status === "fulfilled") {
        setGateVisitors((visRes.value.data || []) as VisitorRow[]);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

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
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);
      setCanteenRows((data || []) as CanteenRow[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

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
        .gte("created_at", dateFrom + "T00:00:00")
        .lte("created_at", dateTo + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);
      setMaterialRows((data || []) as MaterialRow[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

  const loadStaffAtt = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const startTime = (typeof window !== "undefined" && localStorage.getItem("staff_attendance_start_time")) || "07:30";

      const [staffRes, attRes] = await Promise.all([
        client.rpc("list_school_staff_members", { p_school_id: schoolId }),
        client
          .from("staff_attendance_records")
          .select("staff_record_id, status, first_arrived_at, departed_at")
          .eq("school_id", schoolId)
          .eq("attendance_date", dateFrom),
      ]);

      const staffList = ((staffRes.data || []) as any[]).filter((s: any) => s.employment_status === "active");
      const attMap = new Map<string, any>();
      for (const r of (attRes.data || []) as any[]) attMap.set(r.staff_record_id, r);

      const present: StaffAttRow[] = [];
      const absent: StaffAttRow[] = [];

      for (const s of staffList) {
        const att = attMap.get(s.staff_record_id) ?? null;
        if (att?.first_arrived_at) {
          const arrTime = new Date(att.first_arrived_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
          present.push({ staff_record_id: s.staff_record_id, legal_name: s.legal_name, job_title: s.job_title, status: att.status, first_arrived_at: att.first_arrived_at, departed_at: att.departed_at, rank: null, punchStatus: arrTime > startTime ? "late" : "on_time" });
        } else {
          absent.push({ staff_record_id: s.staff_record_id, legal_name: s.legal_name, job_title: s.job_title, status: "absent", first_arrived_at: null, departed_at: null, rank: null, punchStatus: "absent" });
        }
      }

      present.sort((a, b) => (a.first_arrived_at ?? "").localeCompare(b.first_arrived_at ?? ""));
      present.forEach((r, i) => { r.rank = i + 1; });
      setStaffAttRows([...present, ...absent]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom]);

  const loadLibrary = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await supabaseLibraryService.listSchoolBorrows(schoolId, "all", 500);
      const rows: LibraryRow[] = records
        .filter(r => {
          const d = r.borrowed_at.split("T")[0];
          return d >= dateFrom && d <= dateTo;
        })
        .map(r => ({
          id: r.id,
          borrowed_at: r.borrowed_at,
          due_at: r.due_at,
          returned_at: r.returned_at,
          fine_amount: r.fine_amount,
          student_name: `${r.student?.user?.first_name ?? ""} ${r.student?.user?.last_name ?? ""}`.trim() || r.student?.student_code || "Unknown",
          student_code: r.student?.student_code ?? "",
          book_title: (r as any).book_title ?? (r as any).title ?? "Unknown Book",
          book_author: (r as any).book_author ?? (r as any).author ?? "",
        }));
      setLibraryRows(rows);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [schoolId, dateFrom, dateTo]);

  useEffect(() => {
    if (authLoading) return;
    if (view === "attendance")           loadAttendance();
    else if (view === "discipline")      loadDiscipline();
    else if (view === "health")          loadHealth();
    else if (view === "gate")            loadGate();
    else if (view === "canteen")         loadCanteen();
    else if (view === "material")        loadMaterials();
    else if (view === "staff_attendance") loadStaffAtt();
    else if (view === "library")         loadLibrary();
  }, [view, authLoading, dateFrom, dateTo, loadAttendance, loadDiscipline, loadHealth, loadGate, loadCanteen, loadMaterials, loadStaffAtt, loadLibrary]);

  const viewTitle: Record<View, string> = {
    home:             "Reports",
    attendance:       "Attendance Report",
    discipline:       "Discipline Report",
    health:           "Health Report",
    gate:             "Gate Report",
    canteen:          "Canteen Report",
    material:         "Materials Report",
    staff_attendance: "Staff Attendance Report",
    library:          "Library Lending Report",
  };

  // ── Totals ──
  const canteenTotal  = canteenRows.reduce((s, r) => s + (r.total_amount || 0), 0);
  const canteenCount  = canteenRows.length;
  const matStockIn    = materialRows.filter(r => r.transaction_type === "stock_in").reduce((s, r) => s + r.quantity, 0);
  const matStockOut   = materialRows.filter(r => r.transaction_type === "stock_out").reduce((s, r) => s + r.quantity, 0);
  const matAssigned   = materialRows.filter(r => r.transaction_type === "assigned").reduce((s, r) => s + r.quantity, 0);
  const libBorrowed   = libraryRows.length;
  const libReturned   = libraryRows.filter(r => r.returned_at).length;
  const libFines      = libraryRows.reduce((s, r) => s + (r.fine_amount || 0), 0);

  const isRange = dateFrom !== dateTo;
  const rangeLabel = isRange
    ? `${fmtDateShort(dateFrom)} – ${fmtDateShort(dateTo)}`
    : fmtDate(dateFrom);

  function printReport() {
    const title = viewTitle[view];
    const lines: string[] = [];

    if (view === "attendance") {
      lines.push(`<tr><th>Class</th><th>Level</th><th>Total</th><th>Present</th><th>Absent</th><th>Late</th><th>Rate</th></tr>`);
      for (const cls of classAttendance) {
        const pct = cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0;
        lines.push(`<tr><td>${cls.className}</td><td>${cls.levelName}</td><td>${cls.total}</td><td>${cls.present}</td><td>${cls.absent}</td><td>${cls.late}</td><td>${pct}%</td></tr>`);
      }
    } else if (view === "canteen") {
      lines.push(`<tr><th>Time</th><th>Amount (RWF)</th><th>Status</th></tr>`);
      for (const r of canteenRows) {
        lines.push(`<tr><td>${fmtTime(r.created_at)}</td><td>${(r.total_amount||0).toLocaleString()}</td><td>${r.status}</td></tr>`);
      }
    } else if (view === "library") {
      lines.push(`<tr><th>Student</th><th>Book</th><th>Borrowed</th><th>Due</th><th>Returned</th><th>Fine (RWF)</th></tr>`);
      for (const r of libraryRows) {
        lines.push(`<tr><td>${r.student_name}<br><small>${r.student_code}</small></td><td>${r.book_title}<br><small>${r.book_author}</small></td><td>${new Date(r.borrowed_at).toLocaleDateString("en-GB")}</td><td>${new Date(r.due_at).toLocaleDateString("en-GB")}</td><td>${r.returned_at ? new Date(r.returned_at).toLocaleDateString("en-GB") : "—"}</td><td>${r.fine_amount > 0 ? r.fine_amount.toLocaleString() : "—"}</td></tr>`);
      }
    } else if (view === "material") {
      lines.push(`<tr><th>Material</th><th>Type</th><th>Qty</th><th>Notes</th><th>Time</th></tr>`);
      for (const r of materialRows) {
        const cfg = TXN_TYPE_CFG[r.transaction_type] ?? TXN_TYPE_CFG.adjustment;
        lines.push(`<tr><td>${r.school_materials?.name ?? "—"}</td><td>${cfg.label}</td><td>${r.quantity} ${r.school_materials?.unit ?? ""}</td><td>${r.notes ?? ""}</td><td>${fmtTime(r.created_at)}</td></tr>`);
      }
    } else if (view === "staff_attendance") {
      lines.push(`<tr><th>#</th><th>Name</th><th>Title</th><th>Status</th><th>Arrival</th><th>Departure</th></tr>`);
      for (const r of staffAttRows) {
        lines.push(`<tr><td>${r.rank ?? "—"}</td><td>${r.legal_name}</td><td>${r.job_title}</td><td>${r.punchStatus === "on_time" ? "On Time" : r.punchStatus === "late" ? "Late" : "Absent"}</td><td>${fmtTime(r.first_arrived_at)}</td><td>${fmtTime(r.departed_at)}</td></tr>`);
      }
    } else if (view === "discipline") {
      lines.push(`<tr><th>Severity</th><th>Incident</th><th>Student</th><th>Time</th></tr>`);
      for (const r of disciplineRecords) {
        const student = r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : "—";
        lines.push(`<tr><td>${r.severity}</td><td>${r.title}</td><td>${student}</td><td>${new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td></tr>`);
      }
    } else if (view === "health") {
      lines.push(`<tr><th>Severity</th><th>Incident</th><th>Student</th><th>Treatment</th><th>Time</th></tr>`);
      for (const r of healthRecords) {
        const student = r.student ? `${r.student.user.first_name} ${r.student.user.last_name}` : "—";
        lines.push(`<tr><td>${r.severity}</td><td>${r.title}</td><td>${student}</td><td>${r.treatment_given || "—"}</td><td>${new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td></tr>`);
      }
    }

    const html = `<!DOCTYPE html><html><head><title>${title} — ${rangeLabel}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
  h1 { font-size: 18px; color: #16A34A; margin-bottom: 4px; }
  p.sub { font-size: 12px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #DCFCE7; color: #166534; text-align: left; padding: 6px 10px; border-bottom: 2px solid #BBF7D0; }
  td { padding: 6px 10px; border-bottom: 1px solid #F3F4F6; }
  tr:nth-child(even) td { background: #F9FAFB; }
  small { color: #888; font-size: 10px; }
  @media print { body { padding: 10px; } }
</style>
</head><body>
<h1>${title}</h1>
<p class="sub">${rangeLabel} · Exported ${new Date().toLocaleString("en-GB")}</p>
<table><tbody>${lines.join("")}</tbody></table>
</body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    win?.document.write(html);
    win?.document.close();
    win?.print();
  }

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
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">{viewTitle[view]}</h1>
            {view === "home" && <p className="text-xs text-gray-400 mt-0.5">School reports by date range and category</p>}
          </div>
          {view !== "home" && (
            <button
              onClick={printReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 text-xs font-semibold transition cursor-pointer">
              <Printer size={14} /> Export PDF
            </button>
          )}
        </div>

        {/* Home: category tiles */}
        {view === "home" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { id: "attendance",       label: "Attendance",       desc: "Per-class attendance",        Icon: Users,       bg: "bg-green-50",  color: "text-green-600" },
              { id: "gate",             label: "Gate",             desc: "Entry/exit & visitors log",   Icon: Shield,      bg: "bg-blue-50",   color: "text-blue-600" },
              { id: "canteen",          label: "Canteen",          desc: "Sales & transactions",        Icon: ShoppingCart,bg: "bg-orange-50", color: "text-orange-500" },
              { id: "library",          label: "Library",          desc: "Book lending records",        Icon: Library,     bg: "bg-teal-50",   color: "text-teal-600" },
              { id: "material",         label: "Materials",        desc: "Stock movements",             Icon: Package,     bg: "bg-purple-50", color: "text-purple-600" },
              { id: "discipline",       label: "Discipline",       desc: "Offense records",             Icon: AlertTriangle,bg:"bg-red-50",    color: "text-red-600" },
              { id: "health",           label: "Health",           desc: "Health incidents",            Icon: Heart,       bg: "bg-pink-50",   color: "text-pink-600" },
              { id: "staff_attendance", label: "Staff Attendance", desc: "Staff arrival & departure",   Icon: UserCheck,   bg: "bg-indigo-50", color: "text-indigo-600" },
            ].map(({ id, label, desc, Icon, bg, color }) => (
              <button key={id} onClick={() => setView(id as View)}
                className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left cursor-pointer">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-sm font-semibold text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        )}

        {/* Date range picker */}
        {view !== "home" && (
          <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-gray-100 flex-wrap">
            <Calendar size={15} className="text-gray-400 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">From</p>
                <input type="date" value={dateFrom} max={dateTo}
                  onChange={e => setDateFrom(e.target.value)}
                  className="text-sm font-semibold text-gray-700 bg-transparent outline-none border border-gray-200 rounded-lg px-2 py-1" />
              </div>
              <span className="text-gray-300 font-bold text-sm">→</span>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">To</p>
                <input type="date" value={dateTo} min={dateFrom} max={today}
                  onChange={e => setDateTo(e.target.value)}
                  className="text-sm font-semibold text-gray-700 bg-transparent outline-none border border-gray-200 rounded-lg px-2 py-1" />
              </div>
            </div>
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs font-bold text-gray-700">{rangeLabel}</p>
              {view === "attendance" && isRange && (
                <p className="text-[10px] text-amber-500">Attendance shows from-date only</p>
              )}
              {view === "staff_attendance" && isRange && (
                <p className="text-[10px] text-amber-500">Staff attendance shows from-date only</p>
              )}
            </div>
          </div>
        )}

        {/* ── Attendance ── */}
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

        {/* ── Discipline ── */}
        {view === "discipline" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : disciplineRecords.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <CheckCircle size={32} className="mb-2 text-green-200" />
              <p className="text-sm text-green-500">No offenses recorded for this period</p>
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
                          {new Date(r.recorded_at).toLocaleDateString("en-GB")} {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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

        {/* ── Health ── */}
        {view === "health" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : healthRecords.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <CheckCircle size={32} className="mb-2 text-green-200" />
              <p className="text-sm text-green-500">No health incidents for this period</p>
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
                          {new Date(r.recorded_at).toLocaleDateString("en-GB")} {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
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
              <p className="text-sm">No gate activity for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
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
              <p className="text-sm">No canteen transactions for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                      <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-GB")} · {fmtTime(r.created_at)}</p>
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
              <p className="text-sm">No stock movements for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
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
                        <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString("en-GB")} {fmtTime(r.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Library ── */}
        {view === "library" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : libraryRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <Library size={32} className="mb-2" />
              <p className="text-sm">No book loans for this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-teal-600">{libBorrowed}</p>
                  <p className="text-[10px] text-gray-400">Borrowed</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-green-600">{libReturned}</p>
                  <p className="text-[10px] text-gray-400">Returned</p>
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <p className="text-lg font-bold text-red-500">{libFines > 0 ? libFines.toLocaleString() : "0"}</p>
                  <p className="text-[10px] text-gray-400">Fines (RWF)</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {libraryRows.map((r, idx) => {
                  const isOverdue = !r.returned_at && new Date(r.due_at) < new Date();
                  return (
                    <div key={r.id}
                      className={`flex items-center gap-3 px-4 py-3 ${idx < libraryRows.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${r.returned_at ? "bg-green-50" : isOverdue ? "bg-red-50" : "bg-teal-50"}`}>
                        <Library size={14} className={r.returned_at ? "text-green-600" : isOverdue ? "text-red-500" : "text-teal-600"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{r.book_title}</p>
                        <p className="text-[10px] text-gray-500 truncate">{r.student_name} · {r.student_code}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>Borrowed: {new Date(r.borrowed_at).toLocaleDateString("en-GB")}</span>
                          <span>·</span>
                          <span className={isOverdue && !r.returned_at ? "text-red-500 font-semibold" : ""}>
                            Due: {new Date(r.due_at).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {r.returned_at ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">Returned</span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Overdue</span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">Active</span>
                        )}
                        {r.fine_amount > 0 && (
                          <p className="text-[10px] text-red-500 mt-0.5">{r.fine_amount.toLocaleString()} RWF</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── Staff Attendance ── */}
        {view === "staff_attendance" && (
          loading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : staffAttRows.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <UserCheck size={32} className="mb-2" />
              <p className="text-sm">No staff data for this date</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-green-600">{staffAttRows.filter(r => r.punchStatus !== "absent").length}</p>
                  <p className="text-[10px] text-gray-400">Present</p>
                </div>
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-amber-500">{staffAttRows.filter(r => r.punchStatus === "late").length}</p>
                  <p className="text-[10px] text-gray-400">Late</p>
                </div>
                <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-lg font-bold text-red-500">{staffAttRows.filter(r => r.punchStatus === "absent").length}</p>
                  <p className="text-[10px] text-gray-400">Absent</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {staffAttRows.map((r, idx) => (
                  <div key={r.staff_record_id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < staffAttRows.length - 1 ? "border-b border-gray-50" : ""} ${r.punchStatus === "absent" ? "opacity-55" : ""}`}>
                    <div className="w-7 text-center shrink-0">
                      {r.rank ? (
                        <span className="text-xs font-bold text-gray-400">#{r.rank}</span>
                      ) : (
                        <XCircle size={14} className="text-red-300 mx-auto" />
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: `hsl(${(r.legal_name.charCodeAt(0) * 37) % 360}, 55%, 55%)` }}>
                      {r.legal_name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.legal_name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{r.job_title}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${r.punchStatus === "on_time" ? "bg-green-100 text-green-700" : r.punchStatus === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                        {r.punchStatus === "on_time" ? "On Time" : r.punchStatus === "late" ? "Late" : "Absent"}
                      </span>
                      {r.first_arrived_at && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-green-600">
                          <LogIn size={9} /> {fmtTime(r.first_arrived_at)}
                        </div>
                      )}
                      {r.departed_at && (
                        <div className="flex items-center justify-end gap-1 text-[10px] text-blue-500">
                          <LogOut size={9} /> {fmtTime(r.departed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </DashboardShell>
  );
}
