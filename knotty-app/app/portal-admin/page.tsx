"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, RefreshCw, Loader2, ChevronRight, Send, X, CheckCheck } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  portalService,
  type AdminPortalRequest,
  type AdminPortalRequestDetail,
} from "@/lib/supabase/services/portalService";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

export default function PortalAdminPage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const { toast: showToast } = useToast();
  const router = useRouter();

  const [requests, setRequests] = useState<AdminPortalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminPortalRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const schoolId = activeSchool?.id ?? (user as any)?.school_id;

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const reqs = await portalService.adminListRequests(schoolId);
      setRequests(reqs);
    } catch (err: any) {
      showToast(err?.message || "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolId, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  async function openRequest(req: AdminPortalRequest) {
    if (!schoolId) return;
    setDetailLoading(true);
    try {
      const d = await portalService.adminGetRequest(schoolId, req.request_id);
      if (d) { setSelected(d); setReplyText(""); }
    } catch (err: any) {
      showToast(err?.message || "Failed to open", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !selected || !replyText.trim()) return;
    setSending(true);
    try {
      await portalService.adminRespond({
        schoolId,
        requestId: selected.request_id,
        status: selected.status === "pending" ? "reviewing" : selected.status,
        message: replyText.trim(),
      });
      setReplyText("");
      const refreshed = await portalService.adminGetRequest(schoolId, selected.request_id);
      if (refreshed) setSelected(refreshed);
      setRequests(prev => prev.map(r =>
        r.request_id === selected.request_id ? { ...r, status: selected.status === "pending" ? "reviewing" : selected.status } : r
      ));
    } catch (err: any) {
      showToast(err?.message || "Failed to send", "error");
    } finally {
      setSending(false);
    }
  }

  async function markResolved() {
    if (!schoolId || !selected) return;
    try {
      await portalService.adminRespond({
        schoolId,
        requestId: selected.request_id,
        status: "resolved",
      });
      setSelected(s => s ? { ...s, status: "resolved" } : s);
      setRequests(prev => prev.map(r =>
        r.request_id === selected.request_id ? { ...r, status: "resolved" } : r
      ));
      showToast("Marked as resolved", "success");
    } catch (err: any) {
      showToast(err?.message || "Failed", "error");
    }
  }

  if (authLoading) return null;
  if (!user) { router.replace("/login"); return null; }

  const unread = requests.filter(r => r.unread_student_messages > 0).length;

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Portal Inbox</h1>
            {unread > 0 && (
              <p className="text-xs text-orange-500 font-medium mt-0.5">{unread} new message{unread > 1 ? "s" : ""}</p>
            )}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Chat list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {requests.map((r) => {
              const isResolved = r.status === "resolved" || r.status === "rejected";
              return (
                <button key={r.request_id} onClick={() => openRequest(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-gray-50 transition text-left">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                    {initials(r.student_name)}
                  </div>
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">{r.student_name}</span>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(r.updated_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className={`text-xs truncate ${isResolved ? "text-gray-400" : "text-gray-600"}`}>
                        {r.subject}
                      </span>
                      {r.unread_student_messages > 0 ? (
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                          {r.unread_student_messages}
                        </span>
                      ) : isResolved ? (
                        <CheckCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat drawer */}
      {(detailLoading || selected) && (
        <div className="fixed inset-0 bg-black/40 z-40 flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl">
            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : selected ? (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
                  <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {initials(selected.student_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{selected.student_name}</p>
                    <p className="text-xs text-gray-400 truncate">{selected.subject}</p>
                  </div>
                  {selected.status !== "resolved" && selected.status !== "rejected" && (
                    <button onClick={markResolved}
                      className="text-xs text-green-600 font-semibold px-3 py-1.5 rounded-xl bg-green-50 hover:bg-green-100 transition flex-shrink-0">
                      Resolve
                    </button>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                  {/* Original message */}
                  <div className="flex justify-start">
                    <div className="max-w-[80%] bg-white rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
                      <p className="text-xs font-semibold text-blue-600 mb-1">{selected.student_name}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1 text-right">{msgTime(selected.created_at)}</p>
                    </div>
                  </div>

                  {/* Thread messages */}
                  {selected.messages.map((msg) => {
                    const isAdmin = msg.sender_kind === "admin";
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          isAdmin
                            ? "bg-blue-600 rounded-tr-sm"
                            : "bg-white rounded-tl-sm"
                        }`}>
                          {!isAdmin && (
                            <p className="text-xs font-semibold text-blue-600 mb-1">{msg.sender_name || selected.student_name}</p>
                          )}
                          <p className={`text-sm whitespace-pre-wrap ${isAdmin ? "text-white" : "text-gray-800"}`}>{msg.body}</p>
                          <p className={`text-[11px] mt-1 text-right ${isAdmin ? "text-blue-200" : "text-gray-400"}`}>
                            {msgTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Reply input */}
                {selected.status !== "resolved" && selected.status !== "rejected" ? (
                  <form onSubmit={sendReply} className="flex items-end gap-2 px-4 py-3 border-t border-gray-100 bg-white">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (replyText.trim()) sendReply(e as any); } }}
                      placeholder="Type a message…"
                      rows={1}
                      className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                      style={{ minHeight: "42px", maxHeight: "120px" }}
                    />
                    <button
                      type="submit"
                      disabled={sending || !replyText.trim()}
                      className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition flex-shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                ) : (
                  <div className="px-4 py-3 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">This conversation is {selected.status}</p>
                  </div>
                )}
              </>
            ) : null}
          </div>
          <div className="flex-1" onClick={() => setSelected(null)} />
        </div>
      )}
    </DashboardShell>
  );
}
