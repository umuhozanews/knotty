"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ClipboardCheck, CreditCard, ShoppingCart, Banknote, Shield,
  Package, Users, UserCheck, RefreshCw, Loader2, Filter,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, Heart, Library,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

type LogKind =
  | "attendance"
  | "wallet_topup"
  | "wallet_purchase"
  | "canteen"
  | "fee_payment"
  | "visitor"
  | "material"
  | "discipline"
  | "health";

interface LogEntry {
  id: string;
  kind: LogKind;
  title: string;
  detail: string;
  amount?: number;
  ts: string; // ISO
}

const KIND_META: Record<LogKind, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  attendance:    { label: "Attendance",     color: "#2563EB", bg: "#EFF6FF", icon: ClipboardCheck },
  wallet_topup:  { label: "Wallet Top-up",  color: "#16A34A", bg: "#DCFCE7", icon: ArrowDownCircle },
  wallet_purchase:{ label: "Wallet Deduction", color: "#7C3AED", bg: "#F5F3FF", icon: ArrowUpCircle },
  canteen:       { label: "Canteen",        color: "#EA580C", bg: "#FFF7ED", icon: ShoppingCart },
  fee_payment:   { label: "Fee Payment",    color: "#0369A1", bg: "#F0F9FF", icon: Banknote },
  visitor:       { label: "Gate / Visitor", color: "#475569", bg: "#F8FAFC", icon: Shield },
  material:      { label: "Materials",      color: "#15803D", bg: "#F0FDF4", icon: Package },
  discipline:    { label: "Discipline",     color: "#DC2626", bg: "#FFF1F2", icon: AlertTriangle },
  health:        { label: "Health",         color: "#BE185D", bg: "#FDF2F8", icon: Heart },
};

const ALL_KINDS = Object.keys(KIND_META) as LogKind[];

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadgeAttendance(status: string) {
  if (status === "present") return "text-green-700 bg-green-50";
  if (status === "absent") return "text-red-600 bg-red-50";
  if (status === "late") return "text-orange-600 bg-orange-50";
  return "text-gray-500 bg-gray-100";
}

export default function LogsPage() {
  const { user, activeSchool } = useAuth();
  const schoolId = activeSchool?.id || user?.school_id || "";

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LogKind | "all">("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadLogs = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }

    const collected: LogEntry[] = [];
    const LIMIT = 50;

    await Promise.allSettled([

      // ── Attendance ──────────────────────────────────────────────────────
      client
        .from("attendance_records")
        .select("id, student_id, attendance_date, status, source, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            collected.push({
              id: `att-${r.id}`,
              kind: "attendance",
              title: "Student attendance recorded",
              detail: `Status: ${r.status.toUpperCase()} · Via ${r.source} · ${new Date(r.attendance_date).toLocaleDateString("en-GB")}`,
              ts: r.created_at,
            });
          });
        }),

      // ── Wallet transactions ─────────────────────────────────────────────
      client
        .from("wallet_transactions")
        .select("id, student_id, amount, type, description, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            const isTopup = r.type === "topup";
            collected.push({
              id: `wal-${r.id}`,
              kind: isTopup ? "wallet_topup" : "wallet_purchase",
              title: isTopup ? "Wallet top-up" : "Wallet deduction",
              detail: r.description ?? (isTopup ? "Top-up credited" : "Purchase deducted"),
              amount: r.amount,
              ts: r.created_at,
            });
          });
        }),

      // ── Canteen transactions ────────────────────────────────────────────
      client
        .from("canteen_transactions")
        .select("id, student_id, total_amount, status, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            collected.push({
              id: `can-${r.id}`,
              kind: "canteen",
              title: "Canteen purchase",
              detail: `Status: ${r.status}`,
              amount: r.total_amount,
              ts: r.created_at,
            });
          });
        }),

      // ── Fee payments ────────────────────────────────────────────────────
      client
        .from("fee_payments")
        .select("id, student_id, amount, channel, notes, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            collected.push({
              id: `fee-${r.id}`,
              kind: "fee_payment",
              title: "Fee payment received",
              detail: `Channel: ${r.channel}${r.notes ? ` · ${r.notes}` : ""}`,
              amount: r.amount,
              ts: r.created_at,
            });
          });
        }),

      // ── Visitor visits ──────────────────────────────────────────────────
      client
        .from("visitor_visits")
        .select("id, purpose, status, arrived_at, departed_at, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            collected.push({
              id: `vis-${r.id}`,
              kind: "visitor",
              title: "Visitor gate event",
              detail: `Purpose: ${r.purpose} · Status: ${r.status}`,
              ts: r.created_at,
            });
          });
        }),

      // ── Material transactions ───────────────────────────────────────────
      client
        .from("material_transactions")
        .select("id, material_id, type, quantity, note, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(LIMIT)
        .then(({ data }) => {
          (data ?? []).forEach((r) => {
            collected.push({
              id: `mat-${r.id}`,
              kind: "material",
              title: `Material ${r.type.replace("_", " ")}`,
              detail: `Qty: ${r.quantity}${r.note ? ` · ${r.note}` : ""}`,
              ts: r.created_at,
            });
          });
        }),

    ]);

    // Sort newest first
    collected.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    setEntries(collected.slice(0, 300));
    setLastRefreshed(new Date());
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const filtered = filter === "all" ? entries : entries.filter(e => e.kind === filter);

  const counts: Record<string, number> = {};
  entries.forEach(e => { counts[e.kind] = (counts[e.kind] || 0) + 1; });

  return (
    <DashboardShell>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">System Logs</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              All activity across the school
              {lastRefreshed && <span> · refreshed {fmtTime(lastRefreshed.toISOString())}</span>}
            </p>
          </div>
          <button onClick={loadLogs} disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition disabled:opacity-40">
            <RefreshCw size={15} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Summary counts */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Total Events",  value: entries.length,                     color: "text-gray-800" },
            { label: "Today",         value: entries.filter(e => new Date(e.ts).toDateString() === new Date().toDateString()).length, color: "text-blue-600" },
            { label: "This Week",     value: entries.filter(e => Date.now() - new Date(e.ts).getTime() < 7 * 86400000).length, color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[11px] text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilter("all")}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${filter === "all" ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>
            <Filter size={12} /> All
          </button>
          {ALL_KINDS.map((k) => {
            const m = KIND_META[k];
            const Icon = m.icon;
            const active = filter === k;
            return (
              <button key={k} onClick={() => setFilter(active ? "all" : k)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${active ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
                style={active ? { background: m.color, borderColor: m.color } : {}}>
                <Icon size={12} style={active ? {} : { color: m.color }} />
                {m.label}
                {counts[k] ? <span className={`ml-1 px-1 rounded text-[10px] ${active ? "bg-white/20" : "bg-gray-100"}`}>{counts[k]}</span> : null}
              </button>
            );
          })}
        </div>

        {/* Log list */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center py-16 text-gray-300">
            <ClipboardCheck size={32} className="mb-2" />
            <p className="text-sm">No activity logs found</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {filtered.map((entry, idx) => {
              const m = KIND_META[entry.kind];
              const Icon = m.icon;
              return (
                <div key={entry.id} className={`flex items-start gap-3 px-4 py-3.5 ${idx < filtered.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: m.bg }}>
                    <Icon size={15} style={{ color: m.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-800 leading-tight">{entry.title}</p>
                      <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{fmtTime(entry.ts)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{entry.detail}</p>
                    {entry.amount !== undefined && (
                      <p className="text-xs font-bold mt-1" style={{ color: m.color }}>
                        {entry.kind === "wallet_topup" ? "+" : ""}{entry.amount.toLocaleString()} RWF
                      </p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-0.5">{fmtDateTime(entry.ts)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
