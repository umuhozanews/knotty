"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Calendar, RefreshCw, LogIn, LogOut, Clock, Settings,
  CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Briefcase,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type StaffMember = {
  staff_record_id: string;
  legal_name: string;
  job_title: string;
  department: string | null;
  profile_photo_path: string | null;
  employment_status: string;
};

type AttendanceRecord = {
  id: string;
  staff_record_id: string;
  status: string;
  first_arrived_at: string | null;
  departed_at: string | null;
  source: string;
};

type MergedRow = StaffMember & {
  attendance: AttendanceRecord | null;
  rank: number | null;
  punchStatus: "on_time" | "late" | "absent";
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;
  if (photo) return <img src={photo} className="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="" />;
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: `hsl(${hue}, 55%, 55%)` }}>
      {initials}
    </div>
  );
}

const DEFAULT_START_TIME = "07:30";
const LS_KEY = "staff_attendance_start_time";

export default function StaffAttendancePage() {
  const { activeSchool, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const schoolId = activeSchool?.id;
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MergedRow[]>([]);
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingTime, setPendingTime] = useState(DEFAULT_START_TIME);

  // Load work start time from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) { setStartTime(saved); setPendingTime(saved); }
  }, []);

  function saveStartTime() {
    setStartTime(pendingTime);
    localStorage.setItem(LS_KEY, pendingTime);
    setShowSettings(false);
    toast("Work start time updated", "success");
    loadData();
  }

  function isLate(arrivedAt: string | null): boolean {
    if (!arrivedAt) return false;
    const arrivalTime = new Date(arrivedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
    return arrivalTime > startTime;
  }

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;

      const [staffRes, attRes] = await Promise.all([
        client.rpc("list_school_staff_members", { p_school_id: schoolId }),
        client
          .from("staff_attendance_records")
          .select("id, staff_record_id, status, first_arrived_at, departed_at, source")
          .eq("school_id", schoolId)
          .eq("attendance_date", date),
      ]);

      const staffList: StaffMember[] = (staffRes.data || []).filter(
        (s: any) => s.employment_status === "active"
      );
      const attMap = new Map<string, AttendanceRecord>();
      for (const r of (attRes.data || []) as AttendanceRecord[]) {
        attMap.set(r.staff_record_id, r);
      }

      // Build merged rows — sort arrived first by time, then absent
      const present: MergedRow[] = [];
      const absent: MergedRow[] = [];

      for (const s of staffList) {
        const att = attMap.get(s.staff_record_id) ?? null;
        if (att?.first_arrived_at) {
          present.push({
            ...s,
            attendance: att,
            rank: null,
            punchStatus: isLate(att.first_arrived_at) ? "late" : "on_time",
          });
        } else {
          absent.push({ ...s, attendance: att, rank: null, punchStatus: "absent" });
        }
      }

      present.sort((a, b) =>
        (a.attendance?.first_arrived_at ?? "").localeCompare(b.attendance?.first_arrived_at ?? "")
      );
      present.forEach((r, i) => { r.rank = i + 1; });

      setRows([...present, ...absent]);
    } catch (err: any) {
      toast(err?.message || "Failed to load attendance", "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, date, startTime]);

  useEffect(() => {
    if (!authLoading && schoolId) loadData();
  }, [authLoading, schoolId, loadData]);

  const present = rows.filter(r => r.punchStatus !== "absent").length;
  const late    = rows.filter(r => r.punchStatus === "late").length;
  const absent  = rows.filter(r => r.punchStatus === "absent").length;
  const total   = rows.length;

  return (
    <DashboardShell>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-gray-800">Staff Attendance</h1>
            <p className="text-xs text-gray-400 mt-0.5">Daily arrival &amp; departure log</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowSettings(s => !s); setPendingTime(startTime); }}
              className={`p-2 rounded-xl border transition ${showSettings ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:border-gray-300 text-gray-600"}`}
              title="Work start time settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:border-gray-300"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Work Start Time</p>
            <p className="text-xs text-gray-400">Staff arriving after this time are marked Late</p>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={pendingTime}
                onChange={e => setPendingTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 font-mono"
              />
              <button
                onClick={saveStartTime}
                className="px-4 py-2 text-sm font-medium bg-black text-white rounded-xl hover:bg-gray-900 transition"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Date picker */}
        <div className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
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
          <span className="text-xs text-gray-400 shrink-0">
            Start: <strong className="text-gray-700">{startTime}</strong>
          </span>
        </div>

        {/* Summary cards */}
        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
              <p className="text-xl font-bold text-green-600">{present}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Present</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
              <p className="text-xl font-bold text-amber-500">{late}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Late</p>
            </div>
            <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
              <p className="text-xl font-bold text-red-500">{absent}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Absent</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300" />
          </div>
        )}

        {/* Empty */}
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
            <Briefcase className="w-10 h-10 opacity-30" />
            <p className="text-sm">No active staff found</p>
          </div>
        )}

        {/* Staff list */}
        {!loading && rows.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {rows.map((row, idx) => {
              const isPresent = row.punchStatus !== "absent";
              const isLateRow = row.punchStatus === "late";

              return (
                <div
                  key={row.staff_record_id}
                  className={`flex items-center gap-3 px-4 py-3 ${idx < rows.length - 1 ? "border-b border-gray-50" : ""} ${!isPresent ? "opacity-60" : ""}`}
                >
                  {/* Rank / absent indicator */}
                  <div className="w-7 text-center shrink-0">
                    {isPresent ? (
                      <span className="text-xs font-bold text-gray-400">#{row.rank}</span>
                    ) : (
                      <XCircle className="w-4 h-4 text-red-300 mx-auto" />
                    )}
                  </div>

                  <Avatar name={row.legal_name} photo={row.profile_photo_path} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{row.legal_name}</p>
                    <p className="text-xs text-gray-400 truncate">{row.job_title}{row.department ? ` · ${row.department}` : ""}</p>
                  </div>

                  {/* Status + times */}
                  <div className="text-right shrink-0 space-y-0.5">
                    {isPresent ? (
                      <>
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isLateRow ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {isLateRow ? "Late" : "On Time"}
                          </span>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[11px] text-green-600">
                          <LogIn className="w-3 h-3" />
                          <span className="font-mono">{fmtTime(row.attendance?.first_arrived_at)}</span>
                        </div>
                        {row.attendance?.departed_at && (
                          <div className="flex items-center justify-end gap-1 text-[11px] text-blue-500">
                            <LogOut className="w-3 h-3" />
                            <span className="font-mono">{fmtTime(row.attendance.departed_at)}</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        Absent
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && total > 0 && (
          <p className="text-center text-xs text-gray-400">
            {total} staff · {present} arrived · {absent} not yet
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
