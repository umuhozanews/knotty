"use client";
// v2 — colorful block nav hub
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  TrafficCone, Briefcase, GraduationCap, Banknote,
  ShoppingCart, Package, BookOpen, Stethoscope, Scale,
  Users, UserCheck, Building2, TrendingUp,
} from "lucide-react";
import { getSafeBrowserClient } from "@/lib/supabase/client";

type View = "home" | "management" | "academic";

interface Stats {
  students: number;
  staff: number;
  present_today: number;
  balance_low: number;
}

const HOME_BLOCKS = [
  {
    id: "traffic",
    label: "Traffic",
    sub: "Gate & visitors",
    icon: TrafficCone,
    bg: "#2563EB",
  },
  {
    id: "management",
    label: "Management",
    sub: "Canteen & stock",
    icon: Briefcase,
    bg: "#EA580C",
  },
  {
    id: "fees",
    label: "Fees",
    sub: "Payments & top-ups",
    icon: Banknote,
    bg: "#16A34A",
  },
  {
    id: "academic",
    label: "Academic",
    sub: "Library, health & conduct",
    icon: GraduationCap,
    bg: "#7C3AED",
  },
  {
    id: "students",
    label: "Students",
    sub: "Enroll & manage",
    icon: Users,
    bg: "#0891B2",
  },
  {
    id: "workers",
    label: "Staff",
    sub: "Workers & roles",
    icon: UserCheck,
    bg: "#0F766E",
  },
  {
    id: "schools",
    label: "Schools",
    sub: "Network & settings",
    icon: Building2,
    bg: "#6D28D9",
  },
  {
    id: "reports",
    label: "Reports",
    sub: "Analytics & exports",
    icon: TrendingUp,
    bg: "#B45309",
  },
];

const MANAGEMENT_BLOCKS = [
  { id: "canteen",   label: "Canteen",   sub: "POS & card payments", icon: ShoppingCart, bg: "#EA580C", href: "/canteen" },
  { id: "stock",     label: "Stock",     sub: "Materials & equipment", icon: Package,    bg: "#D97706", href: "/materials" },
];

const ACADEMIC_BLOCKS = [
  { id: "library",  label: "Library",  sub: "Books & borrowing",    icon: BookOpen,   bg: "#7C3AED", href: "/library" },
  { id: "health",   label: "Health",   sub: "Medical records",      icon: Stethoscope, bg: "#DC2626", href: "/health" },
  { id: "conduct",  label: "Conduct",  sub: "Discipline & behaviour", icon: Scale,    bg: "#475569", href: "/discipline" },
];

export default function AdminDashboard() {
  const { user, activeSchool } = useAuth();
  const router = useRouter();
  const schoolId = activeSchool?.id || user?.school_id || "";
  const [view, setView] = useState<View>("home");
  const [stats, setStats] = useState<Stats>({ students: 0, staff: 0, present_today: 0, balance_low: 0 });

  useEffect(() => {
    if (!schoolId) return;
    const client = getSafeBrowserClient();
    if (!client) return;

    async function loadStats() {
      if (!client) return;
      try {
        const { data } = await client.rpc("get_school_stats", { p_school_id: schoolId });
        if (data) {
          setStats((s) => ({
            ...s,
            students: (data as any).students ?? 0,
            staff:    (data as any).staff ?? 0,
          }));
        }
      } catch { /* non-critical */ }
    }
    void loadStats();
  }, [schoolId]);

  function handleHomeBlock(id: string) {
    if (id === "traffic")    router.push("/gate");
    else if (id === "fees")  router.push("/fees");
    else if (id === "students") router.push("/students");
    else if (id === "workers")  router.push("/workers");
    else if (id === "schools")  router.push("/schools");
    else if (id === "reports")  router.push("/reports");
    else if (id === "management") setView("management");
    else if (id === "academic")   setView("academic");
  }

  function SubView({ title, blocks, onBack }: {
    title: string;
    blocks: typeof MANAGEMENT_BLOCKS;
    onBack: () => void;
  }) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition"
            style={{ background: "#F0FDF4", color: "#16A34A" }}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-xl font-extrabold text-gray-900">{title}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {blocks.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.id}
                onClick={() => router.push(b.href)}
                className="flex flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center transition hover:opacity-90 active:scale-95 cursor-pointer"
                style={{ background: b.bg }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}>
                  <Icon size={28} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{b.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{b.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full pb-6 px-1">

      {/* Stats bar */}
      {view === "home" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Students",    value: stats.students,      color: "#2563EB", bg: "#EFF6FF", href: "/students" },
            { label: "Staff",       value: stats.staff,         color: "#16A34A", bg: "#F0FDF4", href: "/workers" },
            { label: "Present",     value: stats.present_today, color: "#0891B2", bg: "#ECFEFF", href: "/attendance" },
            { label: "Low Balance", value: stats.balance_low,   color: "#DC2626", bg: "#FEF2F2", href: "/fees" },
          ].map((s) => (
            <button key={s.label} onClick={() => router.push(s.href)}
              className="rounded-2xl px-4 py-3 flex flex-col gap-0.5 text-left transition hover:opacity-80 active:scale-95"
              style={{ background: s.bg }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium text-gray-500">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* HOME VIEW */}
      {view === "home" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {HOME_BLOCKS.map((block) => {
            const Icon = block.icon;
            return (
              <button
                key={block.id}
                onClick={() => handleHomeBlock(block.id)}
                className="flex flex-col items-center justify-center gap-3 rounded-3xl p-5 text-center transition hover:opacity-90 active:scale-95 cursor-pointer"
                style={{ background: block.bg }}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.18)" }}>
                  <Icon size={28} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{block.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>{block.sub}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* MANAGEMENT SUB-VIEW */}
      {view === "management" && (
        <SubView title="Management" blocks={MANAGEMENT_BLOCKS} onBack={() => setView("home")} />
      )}

      {/* ACADEMIC SUB-VIEW */}
      {view === "academic" && (
        <SubView title="Academic" blocks={ACADEMIC_BLOCKS} onBack={() => setView("home")} />
      )}
    </div>
  );
}
