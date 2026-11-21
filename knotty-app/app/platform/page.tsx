"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Building2, Users, UserCheck, CheckCircle, XCircle, Clock,
  RefreshCw, Shield, Eye, Ban, RotateCcw, LogIn, ChevronRight,
  Search, X, AlertTriangle, Briefcase, TrendingUp, Plus,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";

type SchoolStatus = "pending" | "active" | "suspended" | "inactive";

type PlatformSchool = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string | null;
  address: string | null;
  status: SchoolStatus;
  created_at: string;
  student_count?: number;
  staff_count?: number;
};

const STATUS_CFG: Record<SchoolStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending:   { label: "Pending Review", bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500" },
  active:    { label: "Active",         bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500" },
  suspended: { label: "Suspended",      bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500"   },
  inactive:  { label: "Inactive",       bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400"  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37) % 360;
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ background: `hsl(${hue}, 55%, 50%)` }}>
      {initials}
    </div>
  );
}

export default function PlatformAdminPage() {
  const { user, loading: authLoading, switchSchool } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<SchoolStatus | "all">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<PlatformSchool | null>(null);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;

      const { data, error } = await client
        .from("schools")
        .select("id, name, code, email, phone, address, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const list: PlatformSchool[] = (data || []).map((s: any) => ({
        ...s,
        status: (s.status || "active") as SchoolStatus,
      }));

      // Load counts in parallel (best-effort)
      const withCounts = await Promise.all(
        list.map(async (s) => {
          try {
            const [stuRes, staffRes] = await Promise.allSettled([
              client.from("students").select("id", { count: "exact", head: true }).eq("school_id", s.id),
              client.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", s.id).eq("employment_status", "active"),
            ]);
            return {
              ...s,
              student_count: stuRes.status === "fulfilled" ? (stuRes.value.count ?? 0) : 0,
              staff_count: staffRes.status === "fulfilled" ? (staffRes.value.count ?? 0) : 0,
            };
          } catch {
            return s;
          }
        })
      );

      setSchools(withCounts);
    } catch (err: any) {
      toast(err?.message || "Failed to load schools", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) loadSchools();
  }, [authLoading, loadSchools]);

  // Guard: only PLATFORM_ADMIN
  useEffect(() => {
    if (!authLoading && user && user.role !== "PLATFORM_ADMIN") {
      router.replace("/");
    }
  }, [authLoading, user, router]);

  async function updateStatus(schoolId: string, newStatus: SchoolStatus) {
    setActionLoading(schoolId + newStatus);
    try {
      const res = await fetch("/api/platform/schools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setSchools(prev => prev.map(s => s.id === schoolId ? { ...s, status: newStatus } : s));
      if (selectedSchool?.id === schoolId) setSelectedSchool(s => s ? { ...s, status: newStatus } : s);
      toast(`School ${newStatus === "active" ? "approved and activated" : newStatus}`, "success");
    } catch (err: any) {
      toast(err?.message || "Action failed", "error");
    } finally {
      setActionLoading(null);
    }
  }

  async function enterSchool(school: PlatformSchool) {
    await switchSchool(school.id);
  }

  const filtered = schools.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendingCount = schools.filter(s => s.status === "pending").length;
  const activeCount  = schools.filter(s => s.status === "active").length;
  const totalStudents = schools.reduce((s, r) => s + (r.student_count ?? 0), 0);
  const totalStaff    = schools.reduce((s, r) => s + (r.staff_count ?? 0), 0);

  if (authLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  );

  if (!user || user.role !== "PLATFORM_ADMIN") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-black text-white px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold">Ishuri Platform</p>
            <p className="text-[10px] text-gray-400">Platform Admin Console</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{user.first_name} {user.last_name}</span>
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
            {user.first_name?.[0]?.toUpperCase()}
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                ["ishuri_token","ishuri_refresh","ishuri_user","ishuri_active_school","ishuri_platform_entered_school"]
                  .forEach(k => { try { localStorage.removeItem(k); } catch {} });
              }
              import("@/lib/supabase/client").then(({ getSafeBrowserClient }) => {
                getSafeBrowserClient()?.auth.signOut().finally(() => {
                  window.location.href = "/login";
                });
              });
            }}
            className="text-xs text-gray-400 hover:text-red-400 transition px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Building2, label: "Total Schools",    value: schools.length, color: "bg-blue-500" },
            { icon: CheckCircle, label: "Active",         value: activeCount,    color: "bg-green-500" },
            { icon: Clock,       label: "Pending Review", value: pendingCount,   color: "bg-amber-500" },
            { icon: Users,       label: "Total Students", value: totalStudents,  color: "bg-purple-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pending alert */}
        {pendingCount > 0 && (
          <button
            onClick={() => setFilterStatus("pending")}
            className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 hover:bg-amber-100 transition"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span><strong>{pendingCount}</strong> school{pendingCount !== 1 ? "s" : ""} waiting for approval</span>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-600" />
          </button>
        )}

        {/* Search + filter */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search schools…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-xl">
            {(["all", "pending", "active", "suspended"] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition ${filterStatus === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={loadSchools}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Schools list */}
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw className="w-6 h-6 animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
            <Building2 className="w-10 h-10 opacity-30" />
            <p className="text-sm">{schools.length === 0 ? "No schools registered yet" : "No schools match your filter"}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => {
              const cfg = STATUS_CFG[s.status] ?? STATUS_CFG.active;
              const busy = actionLoading?.startsWith(s.id);
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <Avatar name={s.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{s.name}</p>
                        <span className="text-xs font-mono text-gray-400">{s.code}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{s.email}</p>
                      {s.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{s.address}</p>}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3 h-3" /> {s.student_count ?? "—"} students
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Briefcase className="w-3 h-3" /> {s.staff_count ?? "—"} staff
                        </span>
                        <span className="text-xs text-gray-400">{fmtDate(s.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-4 flex gap-2 flex-wrap border-t border-gray-50 pt-3">
                    {s.status === "pending" && (
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(s.id, "active")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition"
                      >
                        {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        disabled={!!busy}
                        onClick={() => enterSchool(s)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-black text-white rounded-xl hover:bg-gray-900 disabled:opacity-50 transition"
                      >
                        <LogIn className="w-3.5 h-3.5" /> Enter School
                      </button>
                    )}
                    {s.status === "pending" && (
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(s.id, "suspended")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded-xl hover:bg-red-200 disabled:opacity-50 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(s.id, "suspended")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition"
                      >
                        <Ban className="w-3.5 h-3.5" /> Suspend
                      </button>
                    )}
                    {s.status === "suspended" && (
                      <button
                        disabled={!!busy}
                        onClick={() => updateStatus(s.id, "active")}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 disabled:opacity-50 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSchool(s === selectedSchool ? null : s)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition ${selectedSchool?.id === s.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> Details
                    </button>
                  </div>

                  {/* Expanded details */}
                  {selectedSchool?.id === s.id && (
                    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">School Details</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Detail label="ID" value={s.id.slice(0, 8) + "…"} mono />
                        <Detail label="Created" value={fmtDate(s.created_at)} />
                        <Detail label="Email" value={s.email} />
                        <Detail label="Phone" value={s.phone || "—"} />
                        {s.address && <Detail label="Address" value={s.address} />}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-gray-400 block">{label}</span>
      <span className={`font-medium text-gray-700 ${mono ? "font-mono text-[10px]" : ""}`}>{value}</span>
    </div>
  );
}
