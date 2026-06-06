"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fees } from "@/lib/api";
import { Loader2, Banknote, Users, CreditCard, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function BursarDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<{ total_collected: number; pending: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    fees.schoolReport().then((r) => setSummary(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Bursar Office</h1>
        <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-500" />
            <p className="text-xs font-medium text-gray-400">Total Collected</p>
          </div>
          {loading ? <Loader2 size={16} className="animate-spin text-blue-500" /> :
            <p className="text-2xl font-bold text-gray-800">{(summary?.total_collected ?? 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">RWF</span></p>}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={16} className="text-orange-500" />
            <p className="text-xs font-medium text-gray-400">Pending</p>
          </div>
          {loading ? <Loader2 size={16} className="animate-spin text-blue-500" /> :
            <p className="text-2xl font-bold text-gray-800">{(summary?.pending ?? 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">RWF</span></p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/fees" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 text-center transition">
          <Banknote size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Record Payment</p>
          <p className="text-xs opacity-80 mt-0.5">MoMo, Cash, Bank</p>
        </Link>
        <Link href="/students" className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-4 text-center transition">
          <Users size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Students</p>
          <p className="text-xs opacity-80 mt-0.5">Look up fee status</p>
        </Link>
        <Link href="/cards" className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl p-4 text-center transition">
          <CreditCard size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Card Wallets</p>
          <p className="text-xs opacity-80 mt-0.5">Top-up & manage</p>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Your Access</p>
        <div className="space-y-2">
          {[
            { label: "Record and verify fee payments (MoMo, Cash, Bank)", ok: true },
            { label: "View school-wide fee collection reports", ok: true },
            { label: "View student fee history", ok: true },
            { label: "Manage card wallets (top-up, view transactions)", ok: true },
            { label: "View student directory (read-only)", ok: true },
            { label: "Create academic reports or mark attendance", ok: false },
            { label: "Log health or discipline incidents", ok: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {item.ok
                ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                : <AlertCircle size={15} className="text-gray-300 flex-shrink-0" />}
              <p className={`text-sm ${item.ok ? "text-gray-700" : "text-gray-300"}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
