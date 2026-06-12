"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, materials, Material } from "@/lib/api";
import { Loader2, CreditCard, CalendarDays, GraduationCap, BookOpen, User, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [recentMaterials, setRecentMaterials] = useState<Material[]>([]);
  const [attSummary, setAttSummary] = useState<{ PRESENT: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    Promise.all([
      myAccount.profile(),
      materials.list({ page: 1 }),
      myAccount.attendance(1, 30),
    ]).then(([p, m, a]) => {
      setProfile(p.data as unknown as Record<string, unknown>);
      setRecentMaterials((m.data as Material[]).slice(0, 4));
      const records = a.data as Array<{ status: string }>;
      const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
      setAttSummary({ PRESENT: present, total: records.length });
    }).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  const card = (profile?.card as Record<string, unknown> | null);
  const attPct = attSummary && attSummary.total > 0 ? Math.round((attSummary.PRESENT / attSummary.total) * 100) : null;
  const student = profile as { user?: { first_name?: string; last_name?: string }; level?: { name?: string }; class?: { name?: string }; student_code?: string } | null;

  return (
    <div className="space-y-4 pr-1">
      <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-5 text-white">
        <p className="text-sm opacity-80">Good day,</p>
        <h1 className="text-2xl font-bold">{student?.user?.first_name} {student?.user?.last_name}</h1>
        <p className="text-sm opacity-80 mt-0.5">{student?.level?.name} · {student?.class?.name} · {student?.student_code}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <CreditCard size={20} className="mx-auto text-blue-500 mb-1" />
          <p className="text-xl font-bold text-gray-800">{card ? ((card.wallet_balance as number) ?? 0).toLocaleString() : "—"}</p>
          <p className="text-xs text-gray-400">Wallet (RWF)</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <CalendarDays size={20} className="mx-auto text-green-500 mb-1" />
          <p className="text-xl font-bold text-gray-800">{attPct !== null ? `${attPct}%` : "—"}</p>
          <p className="text-xs text-gray-400">Attendance</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
          <GraduationCap size={20} className="mx-auto text-purple-500 mb-1" />
          <Link href="/my-reports" className="text-xs text-blue-600 hover:underline font-medium">View Reports</Link>
          <p className="text-xs text-gray-400 mt-0.5">Academic</p>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { href: "/my-profile",    icon: User,          label: "My Profile",    sub: "Personal info & contacts",   color: "bg-blue-500" },
          { href: "/my-attendance", icon: CalendarDays,  label: "Attendance",    sub: "Daily check-in history",      color: "bg-green-500" },
          { href: "/my-reports",    icon: GraduationCap, label: "My Reports",    sub: "Term reports & PDF download", color: "bg-purple-500" },
          { href: "/my-card",       icon: CreditCard,    label: "My Card",       sub: "Wallet balance & transactions",color: "bg-teal-500" },
        ].map(({ href, icon: Icon, label, sub, color }) => (
          <Link key={href} href={href}
            className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition group"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400 truncate">{sub}</p>
            </div>
            <ExternalLink size={14} className="text-gray-300 group-hover:text-blue-500 transition flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Recent materials */}
      {recentMaterials.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Recent Class Materials</p>
            <Link href="/materials" className="text-xs text-blue-600 hover:underline">See all</Link>
          </div>
          <div className="space-y-2">
            {recentMaterials.map((m) => (
              <a key={m.id} href={m.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={14} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{m.title}</p>
                  <p className="text-xs text-gray-400">{m.subject ?? "General"} · {m.uploader.first_name} {m.uploader.last_name}</p>
                </div>
                <ExternalLink size={13} className="text-gray-300 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
