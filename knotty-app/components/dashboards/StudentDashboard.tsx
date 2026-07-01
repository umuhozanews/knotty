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
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 bg-[#fcf9f8] text-[#121212] min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* Hero Welcome banner */}
      <div className="bg-[#121212] rounded-lg p-6 text-[#fcf9f8] border border-[#dcd9d9]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-[#d9ff8c]/5 rounded-full blur-2xl pointer-events-none" />
        <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Good day,</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1.5">
          {student?.user?.first_name} <span className="text-[#d9ff8c]">{student?.user?.last_name}</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="bg-[#ffffff]/10 px-2.5 py-1 rounded-md border border-[#dcd9d9]/10 font-semibold">{student?.level?.name}</span>
          <span className="bg-[#ffffff]/10 px-2.5 py-1 rounded-md border border-[#dcd9d9]/10 font-semibold">Class {student?.class?.name}</span>
          <span className="bg-[#d9ff8c]/10 text-[#d9ff8c] px-2.5 py-1 rounded-md border border-[#d9ff8c]/20 font-mono font-bold tracking-wider">{student?.student_code}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Wallet Balance */}
        <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 flex flex-col justify-between hover:border-[#d9ff8c] hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Wallet</p>
            <CreditCard size={16} className="text-[#121212]" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-[#121212]">
              {card ? ((card.wallet_balance as number) ?? 0).toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider font-bold">RWF Balance</p>
          </div>
        </div>

        {/* Attendance */}
        <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 flex flex-col justify-between hover:border-[#d9ff8c] hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Attendance</p>
            <CalendarDays size={16} className="text-[#121212]" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-[#121212]">
              {attPct !== null ? `${attPct}%` : "—"}
            </p>
            {attPct !== null ? (
              <div className="w-full h-1.5 bg-[#dcd9d9] rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-[#121212] rounded-full" style={{ width: `${attPct}%` }} />
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider font-bold">No records</p>
            )}
          </div>
        </div>

        {/* Reports */}
        <Link href="/my-reports" className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 flex flex-col justify-between hover:border-[#d9ff8c] hover:scale-[1.01] transition-all duration-200 text-left">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Academic</p>
            <GraduationCap size={16} className="text-[#121212]" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-[#121212] flex items-center gap-1.5">
              <span>Reports</span>
              <ExternalLink size={14} className="text-gray-400" />
            </p>
            <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider font-bold">View Term Cards</p>
          </div>
        </Link>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: "/my-profile",    icon: User,          label: "My Profile",    sub: "Personal info & contacts" },
          { href: "/my-attendance", icon: CalendarDays,  label: "Attendance",    sub: "Daily check-in history" },
          { href: "/my-reports",    icon: GraduationCap, label: "My Reports",    sub: "Term reports & PDF download" },
          { href: "/my-card",       icon: CreditCard,    label: "My Card",       sub: "Wallet balance & transactions" },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link key={href} href={href}
            className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 flex items-center gap-4 hover:border-[#d9ff8c] hover:scale-[1.01] transition-all duration-200 group"
          >
            <div className="w-10 h-10 rounded-lg bg-[#121212] text-white flex items-center justify-center flex-shrink-0 group-hover:bg-[#d9ff8c] group-hover:text-[#121212] transition-colors duration-200">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold tracking-tight text-[#121212]">{label}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{sub}</p>
            </div>
            <ExternalLink size={14} className="text-gray-300 group-hover:text-[#121212] transition flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Recent materials */}
      {recentMaterials.length > 0 && (
        <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Class Materials</p>
            <Link href="/materials" className="text-xs font-bold text-gray-500 hover:text-black border-b border-gray-400">See all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentMaterials.map((m) => (
              <a key={m.id} href={m.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-[#dcd9d9] hover:bg-[#fcf9f8] transition group">
                <div className="w-8 h-8 rounded-lg bg-[#121212]/5 group-hover:bg-[#d9ff8c] group-hover:text-[#121212] flex items-center justify-center flex-shrink-0 transition-colors">
                  <BookOpen size={14} className="text-[#121212]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#121212] truncate">{m.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.subject ?? "General"} · {m.uploader.first_name} {m.uploader.last_name}</p>
                </div>
                <ExternalLink size={13} className="text-gray-300 group-hover:text-[#121212] transition flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
