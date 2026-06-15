"use client";
import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { schools, DashboardStats } from "@/lib/api";
import { isDemoMode, DEMO_STATS } from "@/lib/demo";

export default function CourseStatistics({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    schools.stats(schoolId).then((r) => setData(r.data)).catch(() => {
      if (isDemoMode()) setData(DEMO_STATS);
    });
  }, [schoolId]);

  const attendancePct = data
    ? Math.round((data.present_today / Math.max(data.total_students, 1)) * 100)
    : 0;

  const stats = [
    { label: "Attendance", percent: attendancePct, color: "#121212" },
    {
      label: "Fees Collected",
      percent: data ? Math.min(Math.round((data.fee_collected / 10_000_000) * 100), 100) : 0,
      color: "#121212",
    },
    {
      label: "Low Balance",
      percent: data
        ? Math.min(Math.round((data.low_balance_cards / Math.max(data.total_students, 1)) * 100), 100)
        : 0,
      color: "#121212",
    },
  ];

  return (
    <div className="bg-white rounded-lg border border-[#dcd9d9] p-5 shadow-none h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#121212]">Course Statistics</h3>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreHorizontal size={18} />
        </button>
      </div>
      <div className="space-y-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600">{s.label}</span>
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
          </div>
        ))}
      </div>
    </div>
  );
}
