"use client";
import { useEffect, useState } from "react";
import { Users, GraduationCap, BarChart2, Edit2, Grid } from "lucide-react";
import { schools, DashboardStats } from "@/lib/api";
import { isDemoMode, DEMO_STATS } from "@/lib/demo";

function Skeleton() {
  return <div className="h-5 w-12 bg-gray-100 rounded animate-pulse" />;
}

export default function StatsCards({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<DashboardStats | null>(null);

  useEffect(() => {
    schools.stats(schoolId).then((r) => setData(r.data)).catch(() => {
      if (isDemoMode()) setData(DEMO_STATS);
    });
  }, [schoolId]);

  const cards = [
    {
      icon: <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><Users size={20} className="text-blue-600" /></div>,
      label: "Students Present",
      numerator: data?.present_today,
      denominator: data?.total_students,
      color: "text-blue-600",
    },
    {
      icon: <div className="w-10 h-10 bg-[#e0f7f4] rounded-full flex items-center justify-center"><GraduationCap size={20} className="text-teal-600" /></div>,
      label: "Teachers",
      numerator: data?.total_teachers,
      denominator: undefined,
      color: "text-teal-600",
    },
    {
      icon: <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center"><BarChart2 size={20} className="text-white" /></div>,
      label: "Low Balance Cards",
      numerator: data?.low_balance_cards,
      denominator: undefined,
      color: "text-gray-700",
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-800">Student</span>
          <span className="text-gray-400">/</span>
          <span className="text-gray-400">Teacher</span>
        </div>
        <div className="flex gap-2">
          <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <Edit2 size={15} />
          </button>
          <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <Grid size={15} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="bg-gray-50 rounded-2xl p-4">
            {s.icon}
            <p className="text-xs text-gray-400 mt-3 mb-1">{s.label}</p>
            <div className="text-base font-bold text-gray-800">
              {s.numerator === undefined ? (
                <Skeleton />
              ) : (
                <>
                  <span className={s.color}>{s.numerator}</span>
                  {s.denominator !== undefined && (
                    <span className="text-gray-400">/{s.denominator}</span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
