"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, GraduationCap, BarChart2, ArrowUpRight } from "lucide-react";
import { schools, DashboardStats } from "@/lib/api";
import { isDemoMode, DEMO_STATS } from "@/lib/demo";

function Skeleton() {
  return <div className="h-5 w-12 bg-gray-100 rounded animate-pulse" />;
}

export default function StatsCards({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<"student" | "teacher">("student");

  useEffect(() => {
    schools.stats(schoolId).then((r) => setData(r.data)).catch(() => {
      if (isDemoMode()) setData(DEMO_STATS);
    });
  }, [schoolId]);

  const studentCards = [
    {
      icon: <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><Users size={20} className="text-blue-600" /></div>,
      label: "Students Present",
      numerator: data?.present_today,
      denominator: data?.total_students,
      color: "text-blue-600",
      href: "/attendance",
    },
    {
      icon: <div className="w-10 h-10 bg-[#e0f7f4] rounded-full flex items-center justify-center"><GraduationCap size={20} className="text-teal-600" /></div>,
      label: "Enrolled Students",
      numerator: data?.total_students ?? 320,
      denominator: undefined,
      color: "text-teal-600",
      href: "/students",
    },
    {
      icon: <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center"><BarChart2 size={20} className="text-white" /></div>,
      label: "Low Balance Cards",
      numerator: data?.low_balance_cards,
      denominator: undefined,
      color: "text-gray-700",
      href: "/cards",
    },
  ];

  const teacherCards = [
    {
      icon: <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center"><GraduationCap size={20} className="text-teal-600" /></div>,
      label: "Teachers",
      numerator: data?.total_teachers ?? 24,
      denominator: undefined,
      color: "text-teal-600",
      href: "/workers",
    },
    {
      icon: <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center"><Users size={20} className="text-purple-600" /></div>,
      label: "All Workers",
      numerator: 38,
      denominator: undefined,
      color: "text-purple-600",
      href: "/workers",
    },
    {
      icon: <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center"><BarChart2 size={20} className="text-amber-600" /></div>,
      label: "Staff Attendance",
      numerator: "96%",
      denominator: undefined,
      color: "text-amber-600",
      href: "/workers",
    },
  ];

  const cards = activeTab === "student" ? studentCards : teacherCards;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("student")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "student"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Student
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("teacher")}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "teacher"
                ? "bg-white text-gray-800 shadow-xs"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Teacher
          </button>
        </div>
        <div className="flex gap-2">
          <Link
            href={activeTab === "student" ? "/students" : "/workers"}
            title="View Details"
            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
          >
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-gray-50 hover:bg-gray-100 rounded-2xl p-4 transition group block cursor-pointer"
          >
            <div className="flex items-center justify-between">
              {s.icon}
              <ArrowUpRight size={14} className="text-gray-300 group-hover:text-gray-600 transition" />
            </div>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
