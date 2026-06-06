"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { discipline, DisciplineRecord } from "@/lib/api";
import { Loader2, AlertTriangle, ShieldAlert, Clock, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

const TYPE_COLOR: Record<string, string> = {
  WARNING:    "bg-amber-50   text-amber-700",
  SUSPENSION: "bg-red-50     text-red-600",
  MISCONDUCT: "bg-orange-50  text-orange-600",
  EXPULSION:  "bg-red-100    text-red-700",
};
const SEV_COLOR: Record<string, string> = {
  LOW:      "text-green-600",
  MODERATE: "text-amber-600",
  HIGH:     "text-red-600",
};

export default function DisciplineDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords]   = useState<DisciplineRecord[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (authLoading) return;
    discipline.schoolList({ limit: 30 })
      .then((r) => setRecords(r.data as DisciplineRecord[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  const thisWeek = records.filter((r) => {
    const d = new Date(r.recorded_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;
  const highSev   = records.filter((r) => r.severity === "HIGH").length;
  const thisMonth = records.filter((r) => {
    const d = new Date(r.recorded_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Discipline Office</h1>
          <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
        </div>
        <Link href="/discipline"
          className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white rounded-2xl text-sm font-medium hover:bg-red-600 transition">
          <Plus size={15} />Log Incident
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <ShieldAlert size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : thisWeek}</p>
          <p className="text-xs text-gray-400 mt-0.5">This week</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <AlertTriangle size={17} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : highSev}</p>
          <p className="text-xs text-gray-400 mt-0.5">High severity</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <Clock size={17} className="text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : thisMonth}</p>
          <p className="text-xs text-gray-400 mt-0.5">This month</p>
        </div>
      </div>

      {/* Recent incidents */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Recent Incidents</p>
          <Link href="/discipline" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-400" size={22} /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-8">
            <ShieldAlert size={32} className="mx-auto text-gray-100 mb-2" />
            <p className="text-sm text-gray-400">No incidents recorded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 8).map((rec) => (
              <div key={rec.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {(rec.student as { user?: { first_name?: string; last_name?: string } })?.user?.first_name}{" "}
                      {(rec.student as { user?: { first_name?: string; last_name?: string } })?.user?.last_name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{rec.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLOR[rec.type] ?? "bg-gray-100 text-gray-500"}`}>
                    {rec.type}
                  </span>
                  <span className={`text-[10px] font-semibold ${SEV_COLOR[rec.severity] ?? "text-gray-400"}`}>
                    {rec.severity}
                  </span>
                </div>
                <p className="text-[10px] text-gray-300 flex-shrink-0 w-12 text-right">
                  {new Date(rec.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
