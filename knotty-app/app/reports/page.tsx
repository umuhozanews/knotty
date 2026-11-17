"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Calendar, ChevronLeft, Loader2, CheckCircle, XCircle, Clock,
  Shield, Heart, Users, AlertTriangle,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { supabaseAttendanceService, supabaseDisciplineService, supabaseHealthService } from "@/lib/supabase/services";
import { useAuth } from "@/context/AuthContext";
import type { DisciplineRecord, HealthRecord } from "@/lib/api";

type View = "home" | "attendance" | "discipline" | "health";

type ClassAttendanceData = {
  classId: string;
  className: string;
  levelName: string;
  present: number;
  absent: number;
  late: number;
  total: number;
};

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  const [view, setView]       = useState<View>("home");
  const [date, setDate]       = useState(today);
  const [loading, setLoading] = useState(false);

  const [classAttendance, setClassAttendance]     = useState<ClassAttendanceData[]>([]);
  const [disciplineRecords, setDisciplineRecords] = useState<DisciplineRecord[]>([]);
  const [healthRecords, setHealthRecords]         = useState<HealthRecord[]>([]);

  const loadAttendance = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const rows = await supabaseAttendanceService.getClassAttendanceReport({ schoolId: user.school_id, date });
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
  }, [user?.school_id, date]);

  const loadDiscipline = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const records = await supabaseDisciplineService.schoolList(user.school_id, { limit: 200 });
      setDisciplineRecords(records.filter(r => r.recorded_at.startsWith(date)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.school_id, date]);

  const loadHealth = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const records = await supabaseHealthService.schoolRecords(user.school_id, { limit: 200 });
      setHealthRecords(records.filter(r => r.recorded_at.startsWith(date)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.school_id, date]);

  useEffect(() => {
    if (authLoading) return;
    if (view === "attendance")      loadAttendance();
    else if (view === "discipline") loadDiscipline();
    else if (view === "health")     loadHealth();
  }, [view, authLoading, date, loadAttendance, loadDiscipline, loadHealth]);

  const formatDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });

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
            <h1 className="text-lg font-bold text-gray-800">
              {view === "home"          ? "Reports"
               : view === "attendance"  ? "Attendance Report"
               : view === "discipline"  ? "Discipline Report"
               : "Health Report"}
            </h1>
            {view === "home" && <p className="text-xs text-gray-400 mt-0.5">School reports by date and category</p>}
          </div>
        </div>

        {/* Home: 3 category blocks */}
        {view === "home" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => setView("attendance")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#F0FDF4" }}>
                <Users size={20} style={{ color: "#16A34A" }} />
              </div>
              <p className="text-sm font-semibold text-gray-700">Attendance</p>
              <p className="text-xs text-gray-400 mt-0.5">Per-class attendance by date</p>
            </button>

            <button onClick={() => setView("discipline")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FEF2F2" }}>
                <Shield size={20} style={{ color: "#C62828" }} />
              </div>
              <p className="text-sm font-semibold text-gray-700">Discipline</p>
              <p className="text-xs text-gray-400 mt-0.5">Offense records by date</p>
            </button>

            <button onClick={() => setView("health")}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FFF1F2" }}>
                <Heart size={20} style={{ color: "#E11D48" }} />
              </div>
              <p className="text-sm font-semibold text-gray-700">Health</p>
              <p className="text-xs text-gray-400 mt-0.5">Health incidents by date</p>
            </button>
          </div>
        )}

        {/* Date picker (all report views) */}
        {view !== "home" && (
          <div className="bg-white rounded-2xl p-3 flex items-center gap-3">
            <Calendar size={16} className="text-gray-400 shrink-0" />
            <div className="flex-1">
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent outline-none w-full"
              />
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(date)}</p>
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
              {classAttendance.map((cls) => {
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
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle size={11} /> {cls.present} present
                      </span>
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <XCircle size={11} /> {cls.absent} absent
                      </span>
                      {cls.late > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-500">
                          <Clock size={11} /> {cls.late} late
                        </span>
                      )}
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
              <p className="text-sm text-green-500">No offenses recorded for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {disciplineRecords.length} offense{disciplineRecords.length !== 1 ? "s" : ""}
              </p>
              {disciplineRecords.map((r) => {
                const sevColor = r.severity === "SERIOUS"
                  ? { bg: "#FEE2E2", text: "#991B1B" }
                  : r.severity === "MODERATE"
                  ? { bg: "#FEF9C3", text: "#854D0E" }
                  : { bg: "#F3F4F6", text: "#374151" };
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5"
                        style={{ background: sevColor.bg, color: sevColor.text }}>
                        {r.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                        {r.student && (
                          <p className="text-xs text-gray-500">{r.student.user.first_name} {r.student.user.last_name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          <Clock size={9} className="inline mr-1" />
                          {new Date(r.recorded_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          {r.student_code && ` · ${r.student_code}`}
                        </p>
                      </div>
                      {(r.marks_deducted ?? 0) > 0 && (
                        <span className="text-xs font-bold text-red-500 shrink-0">-{r.marks_deducted}</span>
                      )}
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
              <p className="text-sm text-green-500">No health incidents for this date</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                {healthRecords.length} incident{healthRecords.length !== 1 ? "s" : ""}
              </p>
              {healthRecords.map((r) => {
                const sevColor = r.severity === "HIGH"
                  ? { bg: "#FEE2E2", text: "#991B1B" }
                  : r.severity === "MEDIUM"
                  ? { bg: "#FEF9C3", text: "#854D0E" }
                  : { bg: "#DCFCE7", text: "#166534" };
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-3">
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5"
                        style={{ background: sevColor.bg, color: sevColor.text }}>
                        {r.severity}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{r.title}</p>
                        {r.student && (
                          <p className="text-xs text-gray-500">{r.student.user.first_name} {r.student.user.last_name}</p>
                        )}
                        {r.treatment_given && (
                          <p className="text-xs text-green-600 mt-0.5 truncate">{r.treatment_given}</p>
                        )}
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

      </div>
    </DashboardShell>
  );
}
