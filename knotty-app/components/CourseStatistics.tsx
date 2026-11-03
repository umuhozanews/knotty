"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, ArrowUpRight } from "lucide-react";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type LocalStats = { total_students: number; present_today: number; low_balance_cards: number };

export default function CourseStatistics({ schoolId }: { schoolId: string }) {
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
      });
    }).catch(() => {});
  }, [schoolId]);

  const attendancePct = data
    ? Math.round((data.present_today / Math.max(data.total_students, 1)) * 100)
    : 0;

  const stats = [
    { label: "Attendance", percent: attendancePct, color: "#121212", href: "/attendance" },
    { label: "Fees Collected", percent: 0, color: "#121212", href: "/fees" },
    {
      label: "Low Balance",
      percent: data
        ? Math.min(Math.round((data.low_balance_cards / Math.max(data.total_students, 1)) * 100), 100)
        : 0,
      color: "#121212",
      href: "/cards",
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#dcd9d9] p-5 shadow-none h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#121212]">Course Statistics</h3>
        <Link href="/reports" className="text-gray-400 hover:text-gray-600 p-1" title="View Reports">
          <MoreHorizontal size={18} />
        </Link>
      </div>
      <div className="space-y-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="block group">
            <div className="flex justify-between items-center text-sm mb-1.5">
              <span className="text-gray-600 group-hover:text-blue-600 transition flex items-center gap-1 font-medium">
                {s.label}
                <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
              </span>
              <span className="text-gray-500 font-medium">
                {data ? `${s.percent}%` : "—"}
              </span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: data ? `${s.percent}%` : "0%", backgroundColor: s.color }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
