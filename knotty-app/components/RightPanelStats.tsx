"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type LocalStats = { total_students: number; present_today: number; low_balance_cards: number; fee_collected: number; canteen_revenue_today: number };

export default function RightPanelStats({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<LocalStats | null>(null);

  useEffect(() => {
    const client = getSafeBrowserClient();
    if (!client || !schoolId) return;

    const todayStr = new Date().toISOString().split("T")[0];

    Promise.all([
      client.from("student_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
      client.from("attendance_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("attendance_date", todayStr).eq("status", "present"),
      client.from("card_assignments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active").lt("wallet_balance", 500),
    ]).then(([students, present, lowBalance]) => {
      setData({
        total_students: students.count ?? 0,
        present_today: present.count ?? 0,
        low_balance_cards: lowBalance.count ?? 0,
        fee_collected: 0,
        canteen_revenue_today: 0,
      });
    }).catch(() => {});
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
