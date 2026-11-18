"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Send, Loader2, Calendar, AlertCircle,
  CheckCircle, Clock, User, MapPin,
} from "lucide-react";
import {
  portalService, getPortalToken,
  type PortalRequestDetail,
} from "@/lib/supabase/services/portalService";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: "Pending",     bg: "bg-amber-100",  text: "text-amber-800" },
  reviewing:   { label: "Reviewing",   bg: "bg-blue-100",   text: "text-blue-800" },
  in_progress: { label: "In Progress", bg: "bg-purple-100", text: "text-purple-800" },
  resolved:    { label: "Resolved",    bg: "bg-green-100",  text: "text-green-800" },
  rejected:    { label: "Rejected",    bg: "bg-red-100",    text: "text-red-800" },
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function PortalRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<PortalRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const token = getPortalToken();
    if (!token) { router.replace("/portal"); return; }
    const d = await portalService.getRequestDetail(token, id);
    if (!d) { router.replace("/portal/dashboard"); return; }
    setDetail(d);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading, detail?.messages?.length]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const token = getPortalToken();
    if (!token) return;
    setSending(true);
    setError("");
    try {
      await portalService.addMessage(token, id, replyText.trim());
      setReplyText("");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!detail) return null;

  const st = STATUS_CFG[detail.status] ?? STATUS_CFG.pending;
  const isClosed = detail.status === "resolved" || detail.status === "rejected";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 truncate">{detail.subject}</p>
            <p className="text-xs text-gray-400">{detail.request_number}</p>
          </div>
          <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex-1 space-y-4">
        {/* Request meta */}
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              detail.type === "appointment" ? "bg-indigo-100" : "bg-orange-100"
            }`}>
              {detail.type === "appointment"
                ? <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                : <AlertCircle className="w-3.5 h-3.5 text-orange-600" />}
            </div>
            <span className="text-sm font-medium text-gray-700 capitalize">
              {detail.type} · {detail.category.replace("_", " ")} · {detail.priority} priority
            </span>
          </div>

          <p className="text-sm text-gray-700">{detail.body}</p>
          <p className="text-xs text-gray-400">{fmtDateTime(detail.created_at)}</p>

          {detail.assigned_staff_name && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <User className="w-3.5 h-3.5" />
              Assigned to: {detail.assigned_staff_name}
            </div>
          )}

          {detail.type === "appointment" && (
            <div className="space-y-1.5">
              {detail.appointment_requested_at && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  Requested: {fmtDateTime(detail.appointment_requested_at)}
                </div>
              )}
              {detail.appointment_confirmed_at && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2.5 py-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Confirmed: {fmtDateTime(detail.appointment_confirmed_at)}
                  {detail.appointment_location && (
                    <span className="ml-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {detail.appointment_location}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thread */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversation</p>
          {(detail.messages ?? []).map((msg) => {
            const isAdmin = msg.sender_kind === "admin";
            return (
              <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  isAdmin ? "bg-white border border-gray-100" : "bg-blue-600 text-white"
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${isAdmin ? "text-gray-500" : "text-blue-200"}`}>
                    {msg.sender_name || (isAdmin ? "Admin" : "You")}
                  </p>
                  <p className={`text-sm leading-relaxed ${isAdmin ? "text-gray-800" : "text-white"}`}>
                    {msg.body}
                  </p>
                  <p className={`text-[11px] mt-1.5 ${isAdmin ? "text-gray-400" : "text-blue-200"}`}>
                    {fmtDateTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Reply bar */}
      {!isClosed && (
        <div className="sticky bottom-0 bg-white border-t border-gray-100">
          <div className="max-w-2xl mx-auto px-4 py-3">
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a follow-up message…"
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={sending || !replyText.trim()}
                className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      )}

      {isClosed && (
        <div className={`sticky bottom-0 border-t text-center py-3 text-sm font-medium ${
          detail.status === "resolved"
            ? "bg-green-50 text-green-700 border-green-100"
            : "bg-red-50 text-red-700 border-red-100"
        }`}>
          {detail.status === "resolved" ? "✓ This request has been resolved" : "✗ This request was rejected"}
        </div>
      )}
    </div>
  );
}
