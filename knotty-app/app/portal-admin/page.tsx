"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare, Calendar, AlertCircle, Filter, RefreshCw,
  CheckCircle, XCircle, Clock, User, Send, Loader2, ChevronRight,
  X, ArrowLeft, MapPin,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  portalService,
  type AdminPortalRequest,
  type AdminPortalRequestDetail,
  type PortalStats,
} from "@/lib/supabase/services/portalService";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:     { label: "Pending",     bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500" },
  reviewing:   { label: "Reviewing",   bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500" },
  in_progress: { label: "In Progress", bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  resolved:    { label: "Resolved",    bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500" },
  rejected:    { label: "Rejected",    bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500" },
};

const PRIORITY_COLOR: Record<string, string> = {
  low: "text-gray-500", medium: "text-blue-600", high: "text-orange-600", urgent: "text-red-600",
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PortalAdminPage() {
  const { user, activeSchool } = useAuth();
  const { toast: showToast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<PortalStats | null>(null);
  const [requests, setRequests] = useState<AdminPortalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Detail drawer
  const [selected, setSelected] = useState<AdminPortalRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [confirmDate, setConfirmDate] = useState("");
  const [confirmLocation, setConfirmLocation] = useState("");
  const [responding, setResponding] = useState(false);

  const schoolId = activeSchool?.id ?? (user as any)?.school_id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [s, reqs] = await Promise.all([
        portalService.adminGetStats(schoolId),
        portalService.adminListRequests(
          schoolId,
          filterStatus === "all" ? undefined : filterStatus,
          filterType === "all" ? undefined : filterType
        ),
      ]);
      setStats(s);
      setRequests(reqs);
    } catch (err: any) {
      showToast(err?.message || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolId, filterStatus, filterType, showToast]);

  useEffect(() => { load(); }, [load]);

  async function openRequest(req: AdminPortalRequest) {
    if (!schoolId) return;
    setDetailLoading(true);
    try {
      const d = await portalService.adminGetRequest(schoolId, req.request_id);
      if (d) {
        setSelected(d);
        setNewStatus(d.status);
        setConfirmDate(d.appointment_confirmed_at ? d.appointment_confirmed_at.slice(0, 16) : "");
        setConfirmLocation(d.appointment_location ?? "");
        setReplyText("");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to open request", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRespond(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selected) return;
    if (!replyText.trim() && newStatus === selected.status) {
      showToast("Add a message or change the status", "info");
      return;
    }
    setResponding(true);
    try {
      await portalService.adminRespond({
        schoolId,
        requestId: selected.request_id,
        status: newStatus || selected.status,
        message: replyText.trim() || undefined,
        appointmentConfirmedAt:
          selected.type === "appointment" && confirmDate
            ? new Date(confirmDate).toISOString()
            : undefined,
        appointmentLocation: confirmLocation.trim() || undefined,
      });
      showToast("Response sent", "success");
      setSelected(null);
      await load();
    } catch (err: any) {
      showToast(err?.message || "Failed to respond", "error");
    } finally {
      setResponding(false);
    }
  }

  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portal Inbox</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage student appointments & challenges</p>
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: "total",       label: "Total",       color: "text-gray-800",   bg: "bg-gray-50"   },
              { key: "pending",     label: "Pending",     color: "text-amber-800",  bg: "bg-amber-50"  },
              { key: "reviewing",   label: "Reviewing",   color: "text-blue-800",   bg: "bg-blue-50"   },
              { key: "in_progress", label: "In Progress", color: "text-purple-800", bg: "bg-purple-50" },
              { key: "resolved",    label: "Resolved",    color: "text-green-800",  bg: "bg-green-50"  },
              { key: "rejected",    label: "Rejected",    color: "text-red-800",    bg: "bg-red-50"    },
            ].map(({ key, label, color, bg }) => (
              <button key={key} onClick={() => setFilterStatus(key === "total" ? "all" : key)}
                className={`${bg} rounded-2xl p-3 text-center transition hover:opacity-80 ${
                  (key === "total" ? filterStatus === "all" : filterStatus === key) ? "ring-2 ring-blue-400" : ""
                }`}>
                <p className={`text-2xl font-bold ${color}`}>{(stats as any)[key]}</p>
                <p className={`text-xs font-medium mt-0.5 ${color} opacity-80`}>{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {["all", "appointment", "challenge"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                  filterType === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table / List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">No requests found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => {
              const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
              return (
                <button key={r.request_id} onClick={() => openRequest(r)}
                  className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-blue-200 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        r.type === "appointment" ? "bg-indigo-100" : "bg-orange-100"
                      }`}>
                        {r.type === "appointment"
                          ? <Calendar className="w-4 h-4 text-indigo-600" />
                          : <AlertCircle className="w-4 h-4 text-orange-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{r.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.student_name} · {r.student_admission} · {r.category.replace("_", " ")}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {r.request_number} · <span className={PRIORITY_COLOR[r.priority] ?? "text-gray-500"}>{r.priority}</span>
                          {r.unread_student_messages > 0 && (
                            <span className="ml-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                              {r.unread_student_messages} new
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      <span className="text-[11px] text-gray-400">{fmtDate(r.created_at)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail drawer overlay */}
      {(detailLoading || selected) && (
        <div className="fixed inset-0 bg-black/40 z-40 flex justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : selected ? (
              <>
                {/* Drawer header */}
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-xl hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{selected.subject}</p>
                    <p className="text-xs text-gray-400">{selected.request_number} · {selected.student_name}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${STATUS_CFG[selected.status]?.bg ?? "bg-gray-100"} ${STATUS_CFG[selected.status]?.text ?? "text-gray-600"}`}>
                    {STATUS_CFG[selected.status]?.label ?? selected.status}
                  </span>
                </div>

                <div className="flex-1 p-5 space-y-5">
                  {/* Request info */}
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400">Student</span><br /><span className="font-medium text-gray-800">{selected.student_name}</span></div>
                      <div><span className="text-gray-400">Admission</span><br /><span className="font-medium text-gray-800">{selected.student_admission}</span></div>
                      <div><span className="text-gray-400">Class</span><br /><span className="font-medium text-gray-800">{selected.student_class || "—"}</span></div>
                      <div><span className="text-gray-400">Category</span><br /><span className="font-medium text-gray-800 capitalize">{selected.category.replace("_", " ")}</span></div>
                    </div>
                    <div className="pt-1 border-t border-gray-200">
                      <p className="text-xs text-gray-400 mb-1">Message</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.body}</p>
                    </div>
                    {selected.type === "appointment" && selected.appointment_requested_at && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1 border-t border-gray-200">
                        <Clock className="w-3.5 h-3.5" />
                        Requested: {fmtDateTime(selected.appointment_requested_at)}
                      </div>
                    )}
                  </div>

                  {/* Thread */}
                  {selected.messages && selected.messages.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversation</p>
                      {selected.messages.map((msg) => {
                        const isAdmin = msg.sender_kind === "admin";
                        return (
                          <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                              isAdmin ? "bg-blue-600 text-white" : "bg-gray-100"
                            }`}>
                              <p className={`text-xs font-semibold mb-1 ${isAdmin ? "text-blue-200" : "text-gray-500"}`}>
                                {msg.sender_name || (isAdmin ? "You (Admin)" : "Student")}
                              </p>
                              <p className={`text-sm ${isAdmin ? "text-white" : "text-gray-800"}`}>{msg.body}</p>
                              <p className={`text-[11px] mt-1 ${isAdmin ? "text-blue-200" : "text-gray-400"}`}>
                                {fmtDateTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Respond form */}
                  <form onSubmit={handleRespond} className="space-y-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Respond</p>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">Update Status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["reviewing", "in_progress", "resolved", "rejected"].map((s) => (
                          <button key={s} type="button" onClick={() => setNewStatus(s)}
                            className={`py-2 rounded-xl text-xs font-medium transition capitalize ${
                              newStatus === s
                                ? `${STATUS_CFG[s]?.bg} ${STATUS_CFG[s]?.text}`
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}>
                            {STATUS_CFG[s]?.label ?? s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {selected.type === "appointment" && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Appointment Date & Time</label>
                          <input type="datetime-local" value={confirmDate}
                            onChange={(e) => setConfirmDate(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Location (optional)</label>
                          <input type="text" value={confirmLocation}
                            onChange={(e) => setConfirmLocation(e.target.value)}
                            placeholder="e.g. Principal's Office, Room 12"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Message to Student</label>
                      <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your response…"
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>

                    <button type="submit" disabled={responding}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                      {responding && <Loader2 className="w-4 h-4 animate-spin" />}
                      {responding ? "Sending…" : "Send Response"}
                    </button>
                  </form>
                </div>
              </>
            ) : null}
          </div>
          {/* Click outside to close */}
          <div className="flex-1" onClick={() => setSelected(null)} />
        </div>
      )}
    </DashboardShell>
  );
}
