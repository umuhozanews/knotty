"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, DoorOpen, DoorClosed, Wifi, Hand, Smartphone } from "lucide-react";

type ScanEvent = {
  id: string;
  scan_type: string;
  outcome: string;
  occurred_at: string;
};

const SCAN_ICON: Record<string, React.ElementType> = {
  nfc: Wifi,
  virtual_tap: Smartphone,
  manual: Hand,
};

export default function MyGatePage() {
  const { user, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<ScanEvent[]>([]);
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
          .from("attendance_scan_events")
          .select("id, scan_type, outcome, occurred_at")
          .eq("school_id", schoolId)
          .eq("student_id", profile.student_id)
          .order("occurred_at", { ascending: false })
          .limit(60);

        setEvents((rows || []) as ScanEvent[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  const accepted = events.filter((e) => e.outcome === "accepted").length;

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight">Gate History</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121212] rounded-lg p-4 text-[#fcf9f8] text-center">
            <p className="text-3xl font-extrabold text-[#d9ff8c]">{accepted}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-1">Successful Entries</p>
          </div>
          <div className="bg-white rounded-lg border border-[#dcd9d9] p-4 text-center">
            <p className="text-3xl font-extrabold text-[#121212]">{events.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Total Scans</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#dcd9d9] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Gate Scans</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : events.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">No gate scan records found</p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => {
                const Icon = SCAN_ICON[ev.scan_type] ?? DoorOpen;
                const accepted = ev.outcome === "accepted";
                const dt = new Date(ev.occurred_at);
                return (
                  <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#dcd9d9] bg-[#fcf9f8]">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accepted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-500"}`}>
                      {accepted ? <DoorOpen size={14} /> : <DoorClosed size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#121212]">
                        {dt.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Icon size={11} />
                        {dt.toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })} · {ev.scan_type.replace("_", " ")}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-md ${accepted ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                      {accepted ? "Entered" : ev.outcome}
                    </span>
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
