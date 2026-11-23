"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Bell, LogOut, MessageSquare, Calendar, AlertCircle,
  Clock, CheckCircle, XCircle, ChevronRight, Loader2, Eye, EyeOff,
} from "lucide-react";
import {
  portalService, getPortalToken, clearPortalToken,
  type PortalSession, type PortalRequest, type PortalNotification,
} from "@/lib/supabase/services/portalService";

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending:     { label: "Pending",     bg: "bg-amber-100",  text: "text-amber-800",  dot: "bg-amber-500" },
  reviewing:   { label: "Reviewing",   bg: "bg-blue-100",   text: "text-blue-800",   dot: "bg-blue-500" },
  in_progress: { label: "In Progress", bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  resolved:    { label: "Resolved",    bg: "bg-green-100",  text: "text-green-800",  dot: "bg-green-500" },
  rejected:    { label: "Rejected",    bg: "bg-red-100",    text: "text-red-800",    dot: "bg-red-500" },
};

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  low:    { label: "Low",    color: "text-gray-500" },
  medium: { label: "Medium", color: "text-blue-600" },
  high:   { label: "High",   color: "text-orange-600" },
  urgent: { label: "Urgent", color: "text-red-600" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  if (photo) {
    return <img src={photo} className="w-9 h-9 rounded-full object-cover" alt={name} />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-semibold">
      {initials}
    </div>
  );
}

function PortalDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const needsChangPin = searchParams.get("change_pin") === "1";

  const [session, setSession] = useState<PortalSession | null>(null);
  const [requests, setRequests] = useState<PortalRequest[]>([]);
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifs, setShowNotifs] = useState(false);

  // Change PIN modal
  const [showChangePin, setShowChangePin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showNewPin, setShowNewPin] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState("");

  const load = useCallback(async (token: string) => {
    const [sess, reqs, notifs] = await Promise.all([
      portalService.validateSession(token),
      portalService.listMyRequests(token),
      portalService.getNotifications(token),
    ]);
    if (!sess) {
      clearPortalToken();
      router.replace("/portal");
      return;
    }
    setSession(sess);
    setRequests(reqs);
    setNotifications(notifs);
    setLoading(false);
    if (needsChangPin || sess.must_change_pin) setShowChangePin(true);
  }, [needsChangPin, router]);

  useEffect(() => {
    const token = getPortalToken();
    if (!token) { router.replace("/portal"); return; }
    load(token);
  }, [load, router]);

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    if (newPin.length < 4) { setPinError("PIN must be at least 4 digits"); return; }
    if (newPin !== confirmPin) { setPinError("PINs don't match"); return; }
    setChangingPin(true);
    try {
      const token = getPortalToken()!;
      await portalService.changePin(token, newPin);
      setShowChangePin(false);
      setNewPin(""); setConfirmPin("");
      if (session) setSession({ ...session, must_change_pin: false });
    } catch (err: any) {
      setPinError(err?.message || "Failed to change PIN");
    } finally {
      setChangingPin(false);
    }
  }

  async function handleMarkRead() {
    const token = getPortalToken();
    if (!token) return;
    await portalService.markNotificationsRead(token);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function handleLogout() {
    const token = getPortalToken();
    if (token) await portalService.logout(token);
    router.replace("/portal");
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">Student Portal</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Notifications bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) handleMarkRead(); }}
                className="relative p-2 rounded-xl hover:bg-gray-100 transition"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-700">
                    Notifications
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No notifications yet</p>
                    ) : (
                      notifications.slice(0, 10).map(n => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? "bg-blue-50/50" : ""}`}
                          onClick={() => { setShowNotifs(false); if (n.request_id) router.push(`/portal/request/${n.request_id}`); }}
                        >
                          <p className="text-sm font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                          <p className="text-xs text-gray-400 mt-1">{fmtDate(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile + logout */}
            {session && <Avatar name={session.legal_name} photo={session.profile_photo_path} />}
            <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Hello, {session?.legal_name?.split(" ")[0]} 👋
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Track your requests and appointments</p>
        </div>

        {/* New request button */}
        <button
          onClick={() => router.push("/portal/new")}
          className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl px-5 py-4 hover:bg-blue-700 transition"
        >
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5" />
            <div className="text-left">
              <p className="font-semibold text-sm">New Request</p>
              <p className="text-xs text-blue-200">Appointment or report an issue</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-300" />
        </button>

        {/* Requests list */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">My Requests</h3>

          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
              <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No requests yet</p>
              <p className="text-xs text-gray-400 mt-1">Tap "New Request" to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
                const pr = PRIORITY_CFG[r.priority] ?? PRIORITY_CFG.medium;
                return (
                  <button
                    key={r.request_id}
                    onClick={() => router.push(`/portal/request/${r.request_id}`)}
                    className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:border-blue-200 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          r.type === "appointment" ? "bg-indigo-100" : "bg-orange-100"
                        }`}>
                          {r.type === "appointment"
                            ? <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            : <AlertCircle className="w-3.5 h-3.5 text-orange-600" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{r.subject}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {r.request_number} · {r.category.replace("_", " ")} · <span className={pr.color}>{pr.label}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                          {st.label}
                        </span>
                        <span className="text-[11px] text-gray-400">{fmtDate(r.created_at)}</span>
                      </div>
                    </div>

                    {r.type === "appointment" && r.appointment_confirmed_at && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Confirmed: {new Date(r.appointment_confirmed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Change PIN modal */}
      {showChangePin && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Set Your PIN</h3>
            <p className="text-sm text-gray-500 mb-5">
              {session?.must_change_pin
                ? "Your admin has set a temporary PIN. Please choose a new one."
                : "Change your portal PIN."}
            </p>

            {pinError && (
              <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{pinError}</div>
            )}

            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">New PIN (min 4 digits)</label>
                <div className="relative">
                  <input
                    type={showNewPin ? "text" : "password"}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    inputMode="numeric"
                    placeholder="Enter new PIN"
                    required
                    className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                  />
                  <button type="button" onClick={() => setShowNewPin(!showNewPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Confirm PIN</label>
                <input
                  type={showNewPin ? "text" : "password"}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  inputMode="numeric"
                  placeholder="Repeat new PIN"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                />
              </div>
              <div className="flex gap-2 pt-1">
                {!session?.must_change_pin && (
                  <button type="button" onClick={() => setShowChangePin(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                    Cancel
                  </button>
                )}
                <button type="submit" disabled={changingPin}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {changingPin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overlay for notifications panel */}
      {showNotifs && (
        <div className="fixed inset-0 z-20" onClick={() => setShowNotifs(false)} />
      )}
    </div>
  );
}

export default function PortalDashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PortalDashboardInner />
    </Suspense>
  );
}
