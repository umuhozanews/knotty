"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { isManagementRole } from "@/lib/roles";
import PortalHeader from "@/components/mobile/PortalHeader";
import BottomTabs from "@/components/mobile/BottomTabs";
import BigActionButton from "@/components/mobile/BigActionButton";
import { Home, Building2, MoreHorizontal, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import type { MobileTab } from "@/components/mobile/BottomTabs";

const PORTAL_COLOR = "#14532D";

const TABS: MobileTab[] = [
  { label: "Today", href: "/mobile/admin", icon: <Home size={22} /> },
  { label: "School", href: "/mobile/admin/school", icon: <Building2 size={22} /> },
  { label: "More", href: "/mobile/admin/more", icon: <MoreHorizontal size={22} /> },
];

type Stats = {
  present: number;
  total: number;
  late: number;
  overdue: number;
};

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export default function AdminTodayPage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isManagementRole(user.role)) { router.replace("/mobile"); return; }
  }, [user, authLoading, router]);

  const loadStats = () => {
    const schoolId = user?.school_id;
    if (!schoolId) return;
    const client = getSafeBrowserClient();
    if (!client) return;

    const dateStr = todayISO();
    const nowIso = new Date().toISOString();

    setStatsLoading(true);
    setStatsError(false);

    Promise.all([
      client
        .from("student_records")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("status", "active"),
      client
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("attendance_date", dateStr)
        .eq("status", "present"),
      client
        .from("attendance_records")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .eq("attendance_date", dateStr)
        .eq("status", "late"),
      client
        .from("library_borrow_records")
        .select("*", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .is("returned_at", null)
        .lt("due_at", nowIso),
    ])
      .then(([total, present, late, overdue]) => {
        setStats({
          total: total.count ?? 0,
          present: present.count ?? 0,
          late: late.count ?? 0,
          overdue: overdue.count ?? 0,
        });
        setStatsLoading(false);
      })
      .catch(() => {
        setStatsError(true);
        setStatsLoading(false);
      });
  };

  useEffect(() => {
    if (user?.school_id) loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.school_id]);

  if (authLoading) return null;
  if (!user) return null;

  const schoolName = activeSchool?.name ?? "Your School";

  // --- Sentence ---
  let sentence: React.ReactNode;
  if (statsLoading) {
    sentence = (
      <span
        className="inline-block h-6 rounded-lg animate-pulse"
        style={{ width: "72%", background: "rgba(255,255,255,0.2)" }}
      />
    );
  } else if (statsError) {
    sentence = "We couldn't load today's information.";
  } else if (!stats || stats.total === 0) {
    sentence = "Add your first student to get started.";
  } else {
    sentence = `${stats.present} of ${stats.total} students are in today.`;
  }

  // --- Attention row (highest priority first) ---
  let attentionRow: React.ReactNode = null;
  if (!statsLoading && !statsError && stats) {
    if (stats.late > 0) {
      attentionRow = (
        <button
          onClick={() => router.push("/mobile/admin/attendance")}
          className="flex items-center gap-3 w-full text-left rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <Clock size={18} style={{ color: "rgba(255,255,255,0.9)", flexShrink: 0 }} />
          <span className="flex-1 text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
            {stats.late} {stats.late === 1 ? "student is" : "students are"} late today.
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            View →
          </span>
        </button>
      );
    } else if (stats.overdue > 0) {
      attentionRow = (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <AlertTriangle size={18} style={{ color: "rgba(255,255,255,0.9)", flexShrink: 0 }} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
            {stats.overdue} {stats.overdue === 1 ? "book is" : "books are"} overdue in the library.
          </span>
        </div>
      );
    }
  }

  // --- Action button ---
  const action = statsError ? (
    <BigActionButton
      label="Try again"
      onClick={loadStats}
      icon={<RefreshCw size={18} />}
      variant="white"
    />
  ) : (
    <BigActionButton
      label="See attendance"
      href="/mobile/admin/attendance"
      variant="white"
    />
  );

  return (
    <div className="flex flex-col h-full">
      <PortalHeader
        color={PORTAL_COLOR}
        title={schoolName}
        subtitle={todayLabel()}
        sentence={sentence}
        attentionRow={attentionRow}
        action={action}
        className="flex-1"
      />
      <BottomTabs tabs={TABS} activeColor={PORTAL_COLOR} />
    </div>
  );
}
