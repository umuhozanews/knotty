"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";

type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
};
import { Loader2, CheckCircle, XCircle, Clock, MinusCircle } from "lucide-react";

const STATUS: Record<string, { label: string; color: string; icon: React.ElementType; dot: string }> = {
  PRESENT: { label: "Present",  color: "bg-green-100 text-green-700",  icon: CheckCircle,  dot: "bg-green-500" },
  ABSENT:  { label: "Absent",   color: "bg-red-100 text-red-700",      icon: XCircle,      dot: "bg-red-500" },
  LATE:    { label: "Late",     color: "bg-yellow-100 text-yellow-700",icon: Clock,        dot: "bg-yellow-500" },
  EXCUSED: { label: "Excused",  color: "bg-blue-100 text-blue-700",    icon: MinusCircle,  dot: "bg-blue-500" },
};

export default function MyAttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }
    const schoolId = user.school_id;
    if (!schoolId) { setLoading(false); return; }

    async function load() {
      try {
        const { data: profileRows } = await client!.rpc("get_my_student_profile", { p_school_id: schoolId });
        const profile = (profileRows as any)?.[0];
        if (!profile?.student_id) return;
        const { data: rows } = await client!
          .from("attendance_records")
          .select("id, student_id, attendance_date, status, check_in_time, check_out_time")
          .eq("school_id", schoolId)
          .eq("student_id", profile.student_id)
          .order("attendance_date", { ascending: false })
          .limit(60);
        setRecords((rows || []).map((r: any) => ({
          id: r.id,
          student_id: r.student_id,
          date: r.attendance_date,
          status: (r.status || "").toUpperCase(),
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
        })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  records.forEach((r) => { if (r.status in summary) summary[r.status as keyof typeof summary]++; });
  const pct = records.length > 0 ? Math.round(((summary.PRESENT + summary.LATE) / records.length) * 100) : 0;

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Attendance</h1>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="col-span-2 md:col-span-1 bg-[#121212] border border-[#dcd9d9]/20 rounded-lg p-4 text-[#fcf9f8] text-center flex flex-col justify-center">
            <p className="text-3xl font-extrabold tracking-tight text-[#d9ff8c]">{pct}%</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-1">Attendance Rate</p>
          </div>
          {(["PRESENT","ABSENT","LATE","EXCUSED"] as const).map((st) => {
            const cfg = STATUS[st];
            const Icon = cfg.icon;
            return (
              <div key={st} className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-3 text-center hover:border-[#dcd9d9] transition duration-200">
                <Icon size={16} className={`mx-auto mb-1 text-[#121212]`} />
                <p className="text-2xl font-extrabold tracking-tight text-[#121212]">{summary[st]}</p>
                <p className="text-xs text-gray-500 font-semibold">{cfg.label}</p>
              </div>
            );
          })}
        </div>

        {/* Records list */}
        <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Records</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : records.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">No attendance records found</p>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => {
                const cfg = STATUS[rec.status] ?? STATUS.ABSENT;
                const Icon = cfg.icon;
                return (
                  <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#dcd9d9] bg-[#fcf9f8] hover:border-[#dcd9d9] transition duration-200">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#121212]/5 text-[#121212]">
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold tracking-tight text-[#121212]">
                        {new Date(rec.date).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {rec.check_in_time && (
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          In: {new Date(rec.check_in_time).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })}
                          {rec.check_out_time && ` · Out: ${new Date(rec.check_out_time).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs font-bold px-3 py-1 rounded-md border border-[#dcd9d9] bg-[#ffffff] text-[#121212]">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
