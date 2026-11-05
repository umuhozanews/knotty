"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";

type DisciplineRecord = {
  record_id: string;
  type: string;
  title: string;
  description: string | null;
  action_taken: string | null;
  severity: string;
  status: string;
  recorded_at: string;
  marks_deducted: number;
  parent_notified: boolean;
  recorder_name: string;
};

const SEVERITY_STYLE: Record<string, string> = {
  low:      "bg-yellow-50 text-yellow-700 border-yellow-200",
  medium:   "bg-orange-50 text-orange-700 border-orange-200",
  high:     "bg-red-50 text-red-600 border-red-200",
  critical: "bg-red-100 text-red-800 border-red-300",
};

export default function MyDisciplinePage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
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

        const { data, error } = await client!.rpc("list_student_discipline", {
          p_school_id: schoolId,
          p_student_id: profile.student_id,
          p_limit: 50,
        });
        if (!error && data) setRecords((data as unknown) as DisciplineRecord[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  const resolved = records.filter((r) => r.status === "closed" || r.status === "resolved").length;

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight">Discipline Records</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121212] rounded-lg p-4 text-[#fcf9f8] text-center">
            <p className="text-3xl font-extrabold text-[#d9ff8c]">{records.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-1">Total Incidents</p>
          </div>
          <div className="bg-white rounded-lg border border-[#dcd9d9] p-4 text-center">
            <p className="text-3xl font-extrabold text-green-600">{resolved}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Resolved</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#dcd9d9] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Incident History</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck size={32} className="mx-auto text-green-400 mb-2" />
              <p className="text-sm text-gray-400 font-medium">No discipline records — keep it up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => {
                const isOpen = rec.status !== "closed" && rec.status !== "resolved";
                return (
                  <div key={rec.record_id} className="p-4 rounded-lg border border-[#dcd9d9] bg-[#fcf9f8] space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isOpen ? <AlertTriangle size={14} className="text-orange-500 shrink-0 mt-0.5" /> : <ShieldCheck size={14} className="text-green-500 shrink-0 mt-0.5" />}
                        <p className="text-sm font-bold text-[#121212]">{rec.title}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${SEVERITY_STYLE[rec.severity] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {rec.severity}
                      </span>
                    </div>
                    {rec.description && <p className="text-xs text-gray-500 ml-5">{rec.description}</p>}
                    {rec.action_taken && (
                      <p className="text-xs text-blue-600 ml-5 font-medium">Action: {rec.action_taken}</p>
                    )}
                    <p className="text-[10px] text-gray-400 ml-5">
                      {new Date(rec.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {rec.type} · <span className="capitalize">{rec.status}</span>
                    </p>
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
