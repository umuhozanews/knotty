"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { Loader2, CreditCard, CalendarDays, GraduationCap, User, ExternalLink, DoorOpen, BookOpen, ShieldAlert, Heart } from "lucide-react";
import Link from "next/link";

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [wallet, setWallet] = useState<{ card_number: string; card_status: string; wallet_balance: number } | null>(null);
  const [attPct, setAttPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) return;
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }

    Promise.all([
      client.rpc("get_my_wallet", { p_school_id: user.school_id }),
      client.rpc("get_my_attendance", { p_school_id: user.school_id, p_limit: 90 }),
    ]).then(([walletRes, attRes]) => {
      const walletRow = (walletRes.data as { card_number: string; card_status: string; wallet_balance: number }[] | null)?.[0] ?? null;
      setWallet(walletRow);
      const records = (attRes.data as { status: string }[] | null) ?? [];
      if (records.length > 0) {
        const present = records.filter((r) => r.status === "present" || r.status === "late").length;
        setAttPct(Math.round((present / records.length) * 100));
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, [authLoading, user?.school_id]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 bg-[#fcf9f8] text-[#121212] min-h-screen" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <div className="bg-[#121212] rounded-lg p-6 text-[#fcf9f8] border border-[#dcd9d9]/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-32 h-32 bg-[#d9ff8c]/5 rounded-full blur-2xl pointer-events-none" />
        <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Good day,</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1.5">
          {user?.first_name} <span className="text-[#d9ff8c]">{user?.last_name}</span>
        </h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="bg-[#ffffff]/10 px-2.5 py-1 rounded-md border border-[#dcd9d9]/10 font-semibold">Student</span>
          {wallet?.card_number && (
            <span className="bg-[#d9ff8c]/10 text-[#d9ff8c] px-2.5 py-1 rounded-md border border-[#d9ff8c]/20 font-mono font-bold tracking-wider">
              {wallet.card_number}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 flex flex-col justify-between hover:border-[#d9ff8c] hover:scale-[1.01] transition-all duration-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Wallet</p>
            <CreditCard size={16} className="text-[#121212]" />
          </div>
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-[#121212]">
              {wallet ? (wallet.wallet_balance ?? 0).toLocaleString() : "—"}
            </p>
            <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider font-bold">RWF Balance</p>
          </div>
        </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: "/my-profile",    icon: User,          label: "My Profile",    sub: "Personal info & contacts" },
          { href: "/my-attendance", icon: CalendarDays,  label: "Attendance",    sub: "Daily check-in history" },
          { href: "/my-gate",       icon: DoorOpen,      label: "Gate History",  sub: "School entry & exit times" },
          { href: "/my-reports",    icon: GraduationCap, label: "My Reports",    sub: "Term reports & PDF download" },
          { href: "/my-card",       icon: CreditCard,    label: "My Card",       sub: "Wallet balance & transactions" },
          { href: "/my-library",    icon: BookOpen,      label: "Library",       sub: "Borrowed books & history" },
          { href: "/my-discipline", icon: ShieldAlert,   label: "Discipline",    sub: "Incidents & resolutions" },
          { href: "/my-health",     icon: Heart,         label: "Health",        sub: "Nurse visits & medical notes" },
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
    </div>
  );
}
