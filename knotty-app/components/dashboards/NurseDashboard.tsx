"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { health, HealthRecord } from "@/lib/api";
import { Loader2, Heart, AlertTriangle, Clock, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";

const SEV: Record<string, string> = {
  LOW:    "bg-green-50 text-green-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH:   "bg-red-50   text-red-600",
};
const TYPE: Record<string, string> = {
  ILLNESS:    "bg-blue-50   text-blue-600",
  INJURY:     "bg-orange-50 text-orange-600",
  MEDICATION: "bg-purple-50 text-purple-600",
  CHECKUP:    "bg-green-50  text-green-600",
  ALLERGY:    "bg-red-50    text-red-600",
};

export default function NurseDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    health.schoolRecords({ limit: 30 })
      .then((r) => setRecords(r.data as HealthRecord[]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  const followUps = records.filter((r) => r.follow_up_required && !r.resolved_at).length;
  const highSev   = records.filter((r) => r.severity === "HIGH").length;
  const today     = records.filter((r) => {
    const d = new Date(r.recorded_at);
    return d.toDateString() === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Health Office</h1>
          <p className="text-sm text-gray-400">Welcome, Nurse {user?.first_name}</p>
        </div>
        <Link href="/health"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
          <Plus size={15} />Log Incident
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <Heart size={17} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : today}</p>
          <p className="text-xs text-gray-400 mt-0.5">Today's incidents</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
            <Clock size={17} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : followUps}</p>
          <p className="text-xs text-gray-400 mt-0.5">Pending follow-ups</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : highSev}</p>
          <p className="text-xs text-gray-400 mt-0.5">High severity</p>
        </div>
      </div>

      {/* Recent records */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Recent Records</p>
          <Link href="/health" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-400" size={22} /></div>
        ) : records.length === 0 ? (
          <div className="text-center py-8">
            <Heart size={32} className="mx-auto text-gray-100 mb-2" />
            <p className="text-sm text-gray-400">No health records yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.slice(0, 8).map((rec) => {
              const stu = rec.student as { user?: { first_name?: string; last_name?: string } } | undefined;
              return (
                <div key={rec.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {stu?.user?.first_name} {stu?.user?.last_name}
                      </p>
                      {rec.follow_up_required && !rec.resolved_at && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium flex-shrink-0">
                          Follow-up
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{rec.title}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE[rec.type] ?? "bg-gray-100 text-gray-500"}`}>
                      {rec.type}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${SEV[rec.severity] ?? "bg-gray-100 text-gray-500"}`}>
                      {rec.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-300 flex-shrink-0 w-12 text-right">
                    {new Date(rec.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
