"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, GraduationCap, BarChart2, ArrowUpRight, BookOpen, BookMarked, AlertTriangle } from "lucide-react";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type SchoolStats = {
  total_students: number;
  present_today: number;
  low_balance_cards: number;
  total_teachers: number;
  total_workers: number;
  total_library_books: number;
  active_borrows: number;
  overdue_books: number;
};

function Skeleton() {
  return <div className="h-5 w-12 bg-gray-100 rounded animate-pulse" />;
}

export default function StatsCards({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<SchoolStats | null>(null);
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "library">("student");

  useEffect(() => {
    if (!schoolId) return;
    const client = getSafeBrowserClient();
    if (!client) return;

    // Try the RPC first (bypasses RLS) then fall back to direct queries
    Promise.resolve((client as never as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: unknown }> })
      .rpc("get_school_dashboard_stats", { p_school_id: schoolId }))
      .then(({ data: rows, error }) => {
        if (!error && rows && (rows as any[]).length > 0) {
          const r = (rows as any[])[0];
          setData({
            total_students:      Number(r.total_students      ?? 0),
            present_today:       Number(r.present_today       ?? 0),
            low_balance_cards:   Number(r.low_balance_cards   ?? 0),
            total_teachers:      Number(r.total_teachers      ?? 0),
            total_workers:       Number(r.total_workers       ?? 0),
            total_library_books: Number(r.total_library_books ?? 0),
            active_borrows:      Number(r.active_borrows      ?? 0),
            overdue_books:       Number(r.overdue_books       ?? 0),
          });
          return;
        }

        // Fallback: direct table queries
        const todayStr = new Date().toISOString().split("T")[0];
        const nowIso   = new Date().toISOString();
        Promise.all([
          client.from("student_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active"),
          client.from("attendance_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("attendance_date", todayStr).eq("status", "present"),
          client.from("card_assignments").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "active").lt("wallet_balance", 500),
          client.from("staff_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("employment_status", "active").ilike("primary_role_category", "teacher"),
          client.from("staff_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("employment_status", "active"),
          client.from("library_books").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
          client.from("library_borrow_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("returned_at", null),
          client.from("library_borrow_records").select("*", { count: "exact", head: true }).eq("school_id", schoolId).is("returned_at", null).lt("due_at", nowIso),
        ]).then(([students, present, lowBalance, teachers, workers, libBooks, activeBorrows, overdueBooks]) => {
          setData({
            total_students:      students.count      ?? 0,
            present_today:       present.count       ?? 0,
            low_balance_cards:   lowBalance.count    ?? 0,
            total_teachers:      teachers.count      ?? 0,
            total_workers:       workers.count       ?? 0,
            total_library_books: libBooks.count      ?? 0,
            active_borrows:      activeBorrows.count ?? 0,
            overdue_books:       overdueBooks.count  ?? 0,
          });
        }).catch(() => {});
      })
      .catch(() => {});
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
      numerator: data?.total_students,
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
      numerator: data?.total_teachers,
      denominator: undefined,
      color: "text-teal-600",
      href: "/workers",
    },
    {
      icon: <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center"><Users size={20} className="text-purple-600" /></div>,
      label: "All Workers",
      numerator: data?.total_workers,
      denominator: undefined,
      color: "text-purple-600",
      href: "/workers",
    },
    {
      icon: <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center"><BarChart2 size={20} className="text-amber-600" /></div>,
      label: "Staff Attendance",
      numerator: data
        ? (data.total_workers > 0 ? `${Math.round((0 / data.total_workers) * 100)}%` : "0%")
        : undefined,
      denominator: undefined,
      color: "text-amber-600",
      href: "/workers",
    },
  ];

  const libraryCards = [
    {
      icon: <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center"><BookOpen size={20} className="text-orange-600" /></div>,
      label: "Total Books",
      numerator: data?.total_library_books,
      denominator: undefined,
      color: "text-orange-600",
      href: "/library",
    },
    {
      icon: <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center"><BookMarked size={20} className="text-blue-600" /></div>,
      label: "Active Borrows",
      numerator: data?.active_borrows,
      denominator: undefined,
      color: "text-blue-600",
      href: "/library",
    },
    {
      icon: <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center"><AlertTriangle size={20} className="text-red-500" /></div>,
      label: "Overdue Books",
      numerator: data?.overdue_books,
      denominator: undefined,
      color: "text-red-500",
      href: "/library",
    },
  ];

  const cards = activeTab === "student" ? studentCards : activeTab === "teacher" ? teacherCards : libraryCards;
  const linkHref = activeTab === "student" ? "/students" : activeTab === "teacher" ? "/workers" : "/library";

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          {(["student", "teacher", "library"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer capitalize ${
                activeTab === tab
                  ? "bg-white text-gray-800 shadow-xs"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "library" ? "Library" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <Link
          href={linkHref}
          title="View Details"
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
        >
          <ArrowUpRight size={16} />
        </Link>
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
