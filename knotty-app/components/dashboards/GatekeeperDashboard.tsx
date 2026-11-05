"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { Loader2, Shield, Users, UserCheck, Eye, LogIn, LogOut, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

interface Overview {
  students_inside: number;
  staff_inside: number;
  visitors_inside: number;
  today_entries: number;
  today_exits: number;
  pending_visitors: number;
}

export default function GatekeeperDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) { setLoading(false); return; }
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }

    client.rpc("get_gate_overview", { p_school_id: user.school_id })
      .then(({ data, error }) => {
        if (!error && data) setOverview((data as any)[0] ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, user?.school_id]);

  const stats = [
    { icon: Users,     label: "Students Inside", value: overview?.students_inside ?? 0, color: "bg-blue-50 text-blue-600" },
    { icon: UserCheck, label: "Staff Inside",     value: overview?.staff_inside ?? 0,    color: "bg-green-50 text-green-600" },
    { icon: Eye,       label: "Visitors Inside",  value: overview?.visitors_inside ?? 0, color: "bg-purple-50 text-purple-600" },
    { icon: Clock,     label: "Pending Visitors", value: overview?.pending_visitors ?? 0, color: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Gate Control</h1>
          <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
        </div>
        <Link href="/gate"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
          <Shield size={15} />Open Gate Terminal
        </Link>
      </div>

      {/* Today stats */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50">
            <LogIn size={18} className="text-green-600" />
            <div>
              <p className="text-xl font-bold text-gray-800">{loading ? "—" : (overview?.today_entries ?? 0)}</p>
              <p className="text-xs text-gray-500">Entries</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50">
            <LogOut size={18} className="text-red-500" />
            <div>
              <p className="text-xl font-bold text-gray-800">{loading ? "—" : (overview?.today_exits ?? 0)}</p>
              <p className="text-xs text-gray-500">Exits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Who's inside */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Currently Inside</p>
          <Link href="/gate" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Full view <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-400" size={22} /></div>
        ) : (
          <div className="space-y-2">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={16} />
                </div>
                <p className="text-sm text-gray-600 flex-1">{label}</p>
                <p className="text-lg font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/gate" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition text-center">
            <Shield size={20} className="text-blue-600" />
            <span className="text-xs font-medium text-gray-700">Scan Card</span>
          </Link>
          <Link href="/gate" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:bg-green-50 hover:border-green-200 transition text-center">
            <Eye size={20} className="text-green-600" />
            <span className="text-xs font-medium text-gray-700">Visitor Check-in</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
