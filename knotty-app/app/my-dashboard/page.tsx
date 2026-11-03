"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import {
  Wallet, BookOpen, UserCheck, AlertTriangle, Heart,
  LogOut, Loader2, TrendingUp, TrendingDown, RefreshCw,
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────
type Profile = {
  student_id: string;
  admission_number: string;
  legal_name: string;
  student_status: string;
  profile_photo_path: string | null;
  primary_email: string | null;
  class_section_name: string | null;
  education_level_name: string | null;
  card_number: string | null;
  card_status: string | null;
  wallet_balance: number;
};

type Txn = {
  txn_id: string;
  amount: number;
  txn_type: string;
  description: string | null;
  txn_at: string;
};

type AttendanceRow = {
  record_id: string;
  attendance_date: string;
  status: string;
  first_arrived_at: string | null;
  departed_at: string | null;
};

type DisciplineRow = {
  record_id: string;
  type: string;
  title: string;
  severity: string;
  status: string;
  recorded_at: string;
};

type HealthRow = {
  record_id: string;
  type: string;
  title: string;
  description: string | null;
  treatment_given: string | null;
  severity: string;
  follow_up_required: boolean;
  resolved_at: string | null;
  recorded_at: string;
};

type BorrowRow = {
  borrow_id: string;
  book_title: string;
  book_author: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
};

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 });
}

function isOverdue(due: string) {
  return !new Date(due) || new Date(due) < new Date();
}

const statusColor: Record<string, string> = {
  present: "text-green-600 bg-green-50",
  absent: "text-red-600 bg-red-50",
  late: "text-orange-600 bg-orange-50",
  excused: "text-blue-600 bg-blue-50",
  early_departure: "text-yellow-600 bg-yellow-50",
};

const severityColor: Record<string, string> = {
  low: "text-blue-600 bg-blue-50",
  medium: "text-orange-600 bg-orange-50",
  high: "text-red-600 bg-red-50",
  critical: "text-red-700 bg-red-100",
};

// ── section card ──────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-orange-500">{icon}</span>
        <h2 className="font-semibold text-sm text-gray-800">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { user, logout, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [discipline, setDiscipline] = useState<DisciplineRow[]>([]);
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [borrows, setBorrows] = useState<BorrowRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!user?.school_id) return;
    setPageLoading(true);
    setError("");
    const client = getSafeBrowserClient();
    if (!client) { setError("Client not configured"); setPageLoading(false); return; }

    const sid = user.school_id;

    const [profileRes, txnRes, attRes, discRes, healthRes, borrowRes] = await Promise.allSettled([
      client.rpc("get_my_student_profile", { p_school_id: sid }),
      client.rpc("get_my_transactions", { p_school_id: sid, p_limit: 10 }),
      client.rpc("get_my_attendance", { p_school_id: sid, p_limit: 30 }),
      client.rpc("get_my_discipline", { p_school_id: sid, p_limit: 10 }),
      client.rpc("get_my_health", { p_school_id: sid, p_limit: 10 }),
      client.rpc("get_my_library_borrows", { p_school_id: sid, p_limit: 10 }),
    ]);

    if (profileRes.status === "fulfilled" && profileRes.value.data?.[0]) {
      const p = profileRes.value.data[0] as Profile;
      // Also fetch wallet from card_assignments for current balance
      const walletRes = await client.rpc("get_my_wallet", { p_school_id: sid });
      const walletData = walletRes.data?.[0];
      setProfile({
        ...p,
        card_number: walletData?.card_number ?? p.card_number ?? null,
        card_status: walletData?.card_status ?? p.card_status ?? null,
        wallet_balance: walletData?.wallet_balance ?? p.wallet_balance ?? 0,
      });
    } else if (profileRes.status === "rejected") {
      setError("Could not load your profile.");
    }

    if (txnRes.status === "fulfilled") setTxns((txnRes.value.data as Txn[]) ?? []);
    if (attRes.status === "fulfilled") setAttendance((attRes.value.data as AttendanceRow[]) ?? []);
    if (discRes.status === "fulfilled") setDiscipline((discRes.value.data as DisciplineRow[]) ?? []);
    if (healthRes.status === "fulfilled") setHealth((healthRes.value.data as HealthRow[]) ?? []);
    if (borrowRes.status === "fulfilled") setBorrows((borrowRes.value.data as BorrowRow[]) ?? []);

    setPageLoading(false);
  }, [user?.school_id]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/login"); return; }
    if (!authLoading && user && user.role !== "STUDENT") { router.replace("/"); return; }
    if (!authLoading && user) loadAll();
  }, [authLoading, user, router, loadAll]);

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="mx-auto text-red-400" size={36} />
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={loadAll} className="text-xs text-orange-500 underline">Try again</button>
        </div>
      </div>
    );
  }

  // Attendance stats (last 30 days)
  const attStats = attendance.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeOrOverdueBorrows = borrows.filter(b => !b.returned_at);

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DCFCE7" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#16A34A" />
              <path d="M2 17l10 5 10-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-gray-800 text-sm">IshuriHUB</span>
        </div>
        <button
          onClick={() => { logout(); router.replace("/login"); }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile banner */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-5 text-white">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {profile?.legal_name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">{profile?.legal_name ?? user?.first_name}</h1>
              <p className="text-orange-100 text-xs mt-0.5">{profile?.admission_number}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {profile?.education_level_name && (
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {profile.education_level_name}
                  </span>
                )}
                {profile?.class_section_name && (
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {profile.class_section_name}
                  </span>
                )}
              </div>
            </div>
            <button onClick={loadAll} className="text-white/70 hover:text-white transition shrink-0">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Wallet */}
        <Section title="My Wallet" icon={<Wallet size={16} />}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-gray-400">Balance</p>
              <p className="text-2xl font-bold text-gray-800">{fmtMoney(profile?.wallet_balance ?? 0)}</p>
            </div>
            {profile?.card_number && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Card</p>
                <p className="text-sm font-mono font-semibold text-gray-700">{profile.card_number}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  profile.card_status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {profile.card_status ?? "—"}
                </span>
              </div>
            )}
          </div>

          {txns.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No transactions yet</p>
          ) : (
            <div className="space-y-2">
              {txns.map(t => (
                <div key={t.txn_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    {t.txn_type === "topup" ? (
                      <TrendingUp size={14} className="text-green-500 shrink-0" />
                    ) : (
                      <TrendingDown size={14} className="text-red-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-700 capitalize">{t.txn_type}</p>
                      {t.description && <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{t.description}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${t.txn_type === "topup" || t.txn_type === "refund" ? "text-green-600" : "text-red-500"}`}>
                      {t.txn_type === "topup" || t.txn_type === "refund" ? "+" : "-"}{fmtMoney(Math.abs(t.amount))}
                    </p>
                    <p className="text-[10px] text-gray-400">{fmt(t.txn_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Attendance */}
        <Section title="Attendance (last 30 days)" icon={<UserCheck size={16} />}>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { key: "present", label: "Present", color: "text-green-600", bg: "bg-green-50" },
              { key: "absent", label: "Absent", color: "text-red-600", bg: "bg-red-50" },
              { key: "late", label: "Late", color: "text-orange-600", bg: "bg-orange-50" },
              { key: "excused", label: "Excused", color: "text-blue-600", bg: "bg-blue-50" },
            ].map(s => (
              <div key={s.key} className={`${s.bg} rounded-xl p-3 text-center`}>
                <p className={`text-lg font-bold ${s.color}`}>{attStats[s.key] ?? 0}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
          {attendance.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-1">No attendance records yet</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {attendance.slice(0, 10).map(r => {
                const tapInPts = r.first_arrived_at ? 2 : 0;
                const tapOutPts = r.departed_at ? 2 : 0;
                const totalPts = tapInPts + tapOutPts;
                const fmtT = (ts: string | null) => ts
                  ? new Date(ts).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })
                  : null;
                return (
                  <div key={r.record_id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-gray-400 shrink-0" />
                      <div>
                        <span className="text-xs text-gray-600">{fmt(r.attendance_date)}</span>
                        {(fmtT(r.first_arrived_at) || fmtT(r.departed_at)) && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {fmtT(r.first_arrived_at) && `In: ${fmtT(r.first_arrived_at)}`}
                            {fmtT(r.first_arrived_at) && fmtT(r.departed_at) && " · "}
                            {fmtT(r.departed_at) && `Out: ${fmtT(r.departed_at)}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-md">
                        {totalPts}/4 pts
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[r.status] ?? "text-gray-500 bg-gray-50"}`}>
                        {r.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Library */}
        <Section title="Library" icon={<BookOpen size={16} />}>
          {borrows.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No books borrowed yet</p>
          ) : (
            <div className="space-y-3">
              {borrows.map(b => {
                const overdue = !b.returned_at && isOverdue(b.due_at);
                return (
                  <div key={b.borrow_id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <BookOpen size={14} className={`shrink-0 mt-0.5 ${overdue ? "text-red-400" : b.returned_at ? "text-gray-300" : "text-orange-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{b.book_title}</p>
                      <p className="text-[10px] text-gray-400">{b.book_author}</p>
                      <p className={`text-[10px] mt-0.5 ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                        Due: {fmt(b.due_at)} {overdue ? "· OVERDUE" : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {b.returned_at ? (
                        <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Returned</span>
                      ) : overdue ? (
                        <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">Overdue</span>
                      ) : (
                        <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Borrowed</span>
                      )}
                      {b.fine_amount > 0 && (
                        <p className="text-[10px] text-red-500 mt-0.5">{fmtMoney(b.fine_amount)} fine</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {activeOrOverdueBorrows.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-xl px-3 py-2">
              <Clock size={12} className="shrink-0" />
              <span>{activeOrOverdueBorrows.length} book{activeOrOverdueBorrows.length > 1 ? "s" : ""} currently borrowed</span>
            </div>
          )}
        </Section>

        {/* Discipline */}
        <Section title="Discipline" icon={<AlertTriangle size={16} />}>
          {discipline.length === 0 ? (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-xl px-3 py-3">
              <CheckCircle2 size={16} className="shrink-0" />
              <span className="text-xs font-medium">No discipline records — keep it up!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {discipline.map(d => (
                <div key={d.record_id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${d.severity === "high" || d.severity === "critical" ? "text-red-400" : "text-orange-300"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{d.title}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{d.type}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${severityColor[d.severity] ?? "text-gray-500 bg-gray-50"}`}>
                      {d.severity}
                    </span>
                    <p className="text-[10px] text-gray-400">{fmt(d.recorded_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Health */}
        <Section title="Health Records" icon={<Heart size={16} />}>
          {health.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No health records on file</p>
          ) : (
            <div className="space-y-2">
              {health.map(h => (
                <div key={h.record_id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <Heart size={14} className={`shrink-0 mt-0.5 ${h.resolved_at ? "text-green-400" : "text-red-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{h.title}</p>
                    {h.treatment_given && (
                      <p className="text-[10px] text-gray-400 truncate">Treatment: {h.treatment_given}</p>
                    )}
                    <p className="text-[10px] text-gray-400">{fmt(h.recorded_at)}</p>
                  </div>
                  <div className="shrink-0 space-y-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${severityColor[h.severity] ?? "text-gray-500 bg-gray-50"}`}>
                      {h.severity}
                    </span>
                    {h.follow_up_required && !h.resolved_at && (
                      <p className="text-[10px] text-orange-500 text-right">Follow-up needed</p>
                    )}
                    {h.resolved_at && (
                      <p className="text-[10px] text-green-600 text-right">Resolved</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <p className="text-center text-[10px] text-gray-300 pb-4">IshuriHUB · Student Portal</p>
      </div>
    </div>
  );
}
