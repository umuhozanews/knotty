"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabaseFeesService } from "@/lib/supabase/services";
import { TrendingUp, Banknote, AlertCircle, ChevronRight, Users, BarChart2 } from "lucide-react";
import Link from "next/link";

export default function BursarDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<{
    total_collected: number;
    pending: number;
    by_channel: { channel: string; total: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) return;
    supabaseFeesService.getSchoolReport(user.school_id)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, user?.school_id]);

  const fmt = (n: number) => n.toLocaleString("en");

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Bursar Office</h1>
          <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
        </div>
        <Link href="/fees"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
          <Banknote size={15} />Record Payment
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Fee Collection Summary</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-2">
              <TrendingUp size={17} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? <span className="h-5 w-20 bg-gray-100 rounded animate-pulse inline-block" /> : fmt(summary?.total_collected ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Collected (RWF)</p>
          </div>
          <div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mb-2">
              <AlertCircle size={17} className="text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? <span className="h-5 w-20 bg-gray-100 rounded animate-pulse inline-block" /> : fmt(summary?.pending ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Pending (RWF)</p>
          </div>
          <div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
              <BarChart2 size={17} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? <span className="h-5 w-12 bg-gray-100 rounded animate-pulse inline-block" /> : (summary?.by_channel.length ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Channels</p>
          </div>
        </div>

        {!loading && summary && summary.total_collected + summary.pending > 0 && (() => {
          const pct = Math.round((summary.total_collected / (summary.total_collected + summary.pending)) * 100);
          return (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span>Collection rate</span>
                <span className="font-semibold text-gray-700">{pct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { href: "/fees",     label: "Fee Payments",  sub: "Record & verify",     icon: Banknote,   bg: "bg-blue-50",   ic: "text-blue-600" },
          { href: "/students", label: "Students",       sub: "Fee status lookup",   icon: Users,      bg: "bg-green-50",  ic: "text-green-600" },
          { href: "/cards",    label: "Card Wallets",   sub: "Top-up & manage",     icon: TrendingUp, bg: "bg-purple-50", ic: "text-purple-600" },
        ].map(({ href, label, sub, icon: Icon, bg, ic }) => (
          <Link key={href} href={href}
            className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2 hover:shadow-md transition group">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={17} className={ic} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400">{sub}</p>
            </div>
            <ChevronRight size={14} className="text-gray-200 group-hover:text-blue-500 transition self-end" />
          </Link>
        ))}
      </div>
    </div>
  );
}
