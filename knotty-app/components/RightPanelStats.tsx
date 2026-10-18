"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { schools, DashboardStats } from "@/lib/api";

export default function RightPanelStats({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    schools.stats(schoolId).then((r) => setData(r.data)).catch(console.error);
  }, [schoolId]);

  const attendancePct = data
    ? Math.round((data.present_today / Math.max(data.total_students, 1)) * 100)
    : 0;

  const feesPct = data
    ? Math.min(Math.round((data.fee_collected / 10_000_000) * 100), 100)
    : 0;

  const canteenRevFormatted = data
    ? data.canteen_revenue_today.toLocaleString()
    : "—";

  const modules = [
    { label: "Attendance Today", value: `${attendancePct}%`, pct: attendancePct, color: "bg-blue-600", href: "/attendance" },
    { label: "Fees Collected", value: `${feesPct}%`, pct: feesPct, color: "bg-teal-500", href: "/fees" },
    { label: "Canteen Revenue", value: `${canteenRevFormatted} RWF`, pct: Math.min(feesPct + 10, 100), color: "bg-gray-800", href: "/canteen" },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">School Stats</h3>
        <Link href="/reports" className="text-gray-400 hover:text-gray-600 p-1" title="View Reports">
          <MoreHorizontal size={18} />
        </Link>
      </div>
      <div className="space-y-4">
        {modules.map((m) => (
          <Link key={m.label} href={m.href} className="block group">
            <div className="flex justify-between items-center text-sm mb-1.5">
              <span className="text-gray-600 group-hover:text-blue-600 transition flex items-center gap-1">
                {m.label}
                <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-gray-500 font-medium text-xs">{data ? m.value : "—"}</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${m.color}`}
                style={{ width: data ? `${m.pct}%` : "0%" }}
              />
            </div>
          </Link>
        ))}
      </div>

      {data && (
        <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 gap-2">
          <Link href="/students" className="bg-gray-50 hover:bg-gray-100 transition rounded-xl p-2.5 text-center block cursor-pointer group">
            <p className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition">{data.total_students}</p>
            <p className="text-xs text-gray-400">Students</p>
          </Link>
          <Link href="/cards" className="bg-gray-50 hover:bg-gray-100 transition rounded-xl p-2.5 text-center block cursor-pointer group">
            <p className="text-lg font-bold text-blue-600 group-hover:text-blue-700 transition">{data.low_balance_cards}</p>
            <p className="text-xs text-gray-400">Low Balance</p>
          </Link>
        </div>
      )}
    </div>
  );
}
