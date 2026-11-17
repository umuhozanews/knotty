"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Loader2, CheckCircle2, XCircle, Clock,
  Users, Calendar, RefreshCw, ClipboardList,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { supabaseAttendanceService } from "@/lib/supabase/services/attendanceService";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

type AttendanceStatus = "present" | "late" | "absent";

type ClassSection = { id: string; name: string; education_level_id: string | null };

type StudentRow = {
  student_id: string;
  legal_name: string;
  admission_number: string;
  status: AttendanceStatus | null;
  record_id: string | null;
  saving: boolean;
};

function nameInitials(name: string) {
  return (name || "?").split(" ").map(p => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
}
function nameHue(name: string) { return (name.charCodeAt(0) * 37) % 360; }
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_CFG: Record<AttendanceStatus, { label: string; activeBg: string; activeText: string; border: string }> = {
  present: { label: "Present", activeBg: "#16A34A", activeText: "#fff",    border: "#16A34A" },
  late:    { label: "Late",    activeBg: "#D97706", activeText: "#fff",    border: "#D97706" },
  absent:  { label: "Absent",  activeBg: "#DC2626", activeText: "#fff",    border: "#DC2626" },
};

export default function ClassAttendancePage() {
  const { user, activeSchool } = useAuth();
  const { show } = useToast();
  const schoolId = activeSchool?.id || user?.school_id || "";
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate]           = useState(today);
  const [classes, setClasses]     = useState<ClassSection[]>([]);
  const [classSummary, setClassSummary] = useState<Record<string, { present: number; absent: number; late: number; total: number }>>({});
  const [selectedClass, setSelectedClass] = useState<ClassSection | null>(null);
  const [students, setStudents]   = useState<StudentRow[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Load class list
  const loadClasses = useCallback(async () => {
    if (!schoolId) return;
    setLoadingClasses(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const { data } = await client
        .from("class_sections")
        .select("id, name, education_level_id")
        .eq("school_id", schoolId)
        .eq("status", "active")
        .order("name");
      setClasses((data || []) as ClassSection[]);
    } catch { /* ignore */ }
    finally { setLoadingClasses(false); }
  }, [schoolId]);

  // Load attendance summary per class for selected date
  const loadClassSummary = useCallback(async () => {
    if (!schoolId || classes.length === 0) return;
    try {
      const rows = await supabaseAttendanceService.getClassAttendanceReport({ schoolId, date });
      const summary: Record<string, { present: number; absent: number; late: number; total: number }> = {};
      for (const r of rows) {
        const cid = r.class_section_id ?? "";
        if (!cid) continue;
        if (!summary[cid]) summary[cid] = { present: 0, absent: 0, late: 0, total: 0 };
        summary[cid].total++;
        if (r.status === "present") summary[cid].present++;
        else if (r.status === "absent") summary[cid].absent++;
        else summary[cid].late++;
      }
      setClassSummary(summary);
    } catch { /* ignore */ }
  }, [schoolId, date, classes.length]);

  useEffect(() => { loadClasses(); }, [loadClasses]);
  useEffect(() => { loadClassSummary(); }, [loadClassSummary]);

  // Load students for selected class + existing attendance
  const loadStudents = useCallback(async () => {
    if (!schoolId || !selectedClass) return;
    setLoadingStudents(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;

      // Get all students for school, filter by class
      const { data: allStudents } = await client.rpc("list_school_students" as never, { p_school_id: schoolId } as never);
      const classStudents = ((allStudents || []) as any[]).filter(
        (s: any) => s.class_section_id === selectedClass.id && s.status === "active"
      );

      // Get today's attendance records for this school
      const records = await supabaseAttendanceService.listAttendance({ schoolId, date });
      const attendanceMap: Record<string, { status: AttendanceStatus; id: string }> = {};
      for (const r of records) {
        attendanceMap[r.student_id] = {
          status: r.status as AttendanceStatus,
          id: r.id,
        };
      }

      setStudents(
        classStudents.map((s: any) => ({
          student_id: s.student_id,
          legal_name: s.legal_name || "Unknown",
          admission_number: s.admission_number || "",
          status: attendanceMap[s.student_id]?.status ?? null,
          record_id: attendanceMap[s.student_id]?.id ?? null,
          saving: false,
        }))
      );
    } catch { /* ignore */ }
    finally { setLoadingStudents(false); }
  }, [schoolId, selectedClass, date]);

  useEffect(() => {
    if (selectedClass) loadStudents();
  }, [loadStudents, selectedClass]);

  async function markAttendance(studentId: string, status: AttendanceStatus) {
    // Optimistic update
    setStudents(prev =>
      prev.map(s => s.student_id === studentId ? { ...s, status, saving: true } : s)
    );
    try {
      await supabaseAttendanceService.recordStudentAttendance({
        schoolId,
        studentId,
        attendanceDate: date,
        status,
      });
      setStudents(prev =>
        prev.map(s => s.student_id === studentId ? { ...s, saving: false } : s)
      );
    } catch (err: any) {
      show(err?.message || "Failed to save attendance", "error");
      setStudents(prev =>
        prev.map(s => s.student_id === studentId ? { ...s, saving: false } : s)
      );
    }
  }

  const presentCount = students.filter(s => s.status === "present").length;
  const absentCount  = students.filter(s => s.status === "absent").length;
  const lateCount    = students.filter(s => s.status === "late").length;
  const unmarked     = students.filter(s => s.status === null).length;

  return (
    <DashboardShell>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          {selectedClass && (
            <button
              onClick={() => { setSelectedClass(null); setStudents([]); }}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">
              {selectedClass ? selectedClass.name : "Class Register"}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedClass ? `${students.length} students · ${fmtDate(date)}` : "Mark daily attendance per class"}
            </p>
          </div>
          {selectedClass && (
            <button onClick={loadStudents} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Date picker */}
        <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
          <Calendar size={16} className="text-gray-400 shrink-0" />
          <div className="flex-1">
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => { setDate(e.target.value); setStudents([]); }}
              className="text-sm font-semibold text-gray-700 bg-transparent outline-none w-full"
            />
            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(date)}</p>
          </div>
        </div>

        {/* Class list */}
        {!selectedClass && (
          loadingClasses ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          ) : classes.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <ClipboardList size={32} className="mb-2" />
              <p className="text-sm">No active classes found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {classes.map(cls => {
                const s = classSummary[cls.id];
                const pct = s && s.total > 0 ? Math.round((s.present / s.total) * 100) : null;
                const color = pct === null ? "#6B7280" : pct >= 85 ? "#16A34A" : pct >= 70 ? "#D97706" : "#DC2626";
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls)}
                    className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-blue-50">
                      <Users size={18} className="text-blue-600" />
                    </div>
                    <p className="text-sm font-bold text-gray-800 truncate">{cls.name}</p>
                    {s ? (
                      <>
                        <p className="text-xl font-bold mt-1" style={{ color }}>{pct}%</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">{s.present} P</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">{s.absent} A</span>
                          {s.late > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">{s.late} L</span>}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Not marked</p>
                    )}
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* Class roster */}
        {selectedClass && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Present", value: presentCount, color: "text-green-600", bg: "bg-green-50" },
                { label: "Absent",  value: absentCount,  color: "text-red-600",   bg: "bg-red-50"   },
                { label: "Late",    value: lateCount,     color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Pending", value: unmarked,      color: "text-gray-500",  bg: "bg-gray-50"  },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-2xl p-3 text-center`}>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {loadingStudents ? (
              <div className="flex justify-center py-16">
                <Loader2 size={22} className="animate-spin text-gray-300" />
              </div>
            ) : students.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-300">
                <Users size={32} className="mb-2" />
                <p className="text-sm">No enrolled students found</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {students.map((student, idx) => (
                  <div
                    key={student.student_id}
                    className={`flex items-center gap-3 px-4 py-3 ${idx < students.length - 1 ? "border-b border-gray-50" : ""}`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ background: `hsl(${nameHue(student.legal_name)}, 55%, 55%)` }}
                    >
                      {nameInitials(student.legal_name)}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{student.legal_name}</p>
                      <p className="text-xs text-gray-400">{student.admission_number}</p>
                    </div>

                    {/* Status buttons */}
                    {student.saving ? (
                      <Loader2 size={16} className="animate-spin text-gray-300 shrink-0" />
                    ) : (
                      <div className="flex gap-1 shrink-0">
                        {(["present", "late", "absent"] as AttendanceStatus[]).map(s => {
                          const cfg = STATUS_CFG[s];
                          const active = student.status === s;
                          return (
                            <button
                              key={s}
                              onClick={() => markAttendance(student.student_id, s)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold border transition"
                              style={active
                                ? { background: cfg.activeBg, color: cfg.activeText, borderColor: cfg.border }
                                : { background: "#F9FAFB", color: "#6B7280", borderColor: "#E5E7EB" }
                              }
                            >
                              {s === "present" ? "P" : s === "late" ? "L" : "A"}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
