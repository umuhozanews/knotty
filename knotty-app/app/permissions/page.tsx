"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  CreditCard, Wifi, Loader2, X, Clock, CheckCircle, AlertCircle,
  Home, LogOut, Stethoscope, FileText, Shield, User, Calendar,
  ChevronRight, RotateCcw, List,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useNFC } from "@/hooks/useNFC";
import { supabaseCanteenService } from "@/lib/supabase/services/canteenService";
import { supabaseLibraryService } from "@/lib/supabase/services/libraryService";
import {
  permissionsService,
  PERMISSION_LABELS,
  type PermissionType,
  type StudentPermission,
  type TodayPermissionRow,
} from "@/lib/supabase/services/permissionsService";

type Tab = "grant" | "check" | "today";

type StudentInfo = {
  id: string;
  name: string;
  studentClass: string;
  student_code: string;
  photo: string | null;
};

const TYPE_ICONS: Record<PermissionType, React.ReactNode> = {
  go_home: <Home size={14} />,
  go_out:  <LogOut size={14} />,
  medical: <Stethoscope size={14} />,
  other:   <FileText size={14} />,
};

const TYPE_COLORS: Record<PermissionType, string> = {
  go_home: "bg-blue-100 text-blue-700",
  go_out:  "bg-orange-100 text-orange-700",
  medical: "bg-red-100 text-red-700",
  other:   "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-green-100 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  revoked: "bg-red-100 text-red-600",
};

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-RW", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeUntil(ts: string): string {
  const diff = new Date(ts).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// Quick presets for valid_until
function preset(label: string, ms: number): { label: string; ms: number } {
  return { label, ms };
}
const PRESETS = [
  preset("30 min",   30 * 60 * 1000),
  preset("1 hour",   60 * 60 * 1000),
  preset("2 hours",  2 * 60 * 60 * 1000),
  preset("4 hours",  4 * 60 * 60 * 1000),
  preset("End of day", (() => {
    const eod = new Date(); eod.setHours(17, 0, 0, 0); return eod.getTime() - Date.now();
  })()),
];

function endOfDayMs() {
  const eod = new Date(); eod.setHours(17, 0, 0, 0); return eod.getTime() - Date.now();
}

export default function PermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported } = useNFC();

  const [tab, setTab] = useState<Tab>("grant");
  const [cardInput, setCardInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [permissions, setPermissions] = useState<StudentPermission[]>([]);
  const [loadingPerms, setLoadingPerms] = useState(false);

  // Grant form
  const [permType, setPermType] = useState<PermissionType>("go_out");
  const [reason, setReason] = useState("");
  const [presetMs, setPresetMs] = useState<number | null>(60 * 60 * 1000);
  const [customUntil, setCustomUntil] = useState("");
  const [granting, setGranting] = useState(false);

  // Today list
  const [todayList, setTodayList] = useState<TodayPermissionRow[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadTodayList = useCallback(async () => {
    if (!user?.school_id) return;
    setTodayLoading(true);
    try {
      const rows = await permissionsService.listTodayPermissions(user.school_id, 100);
      setTodayList(rows);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load today's list", "error");
    } finally {
      setTodayLoading(false);
    }
  }, [user?.school_id, toast]);

  useEffect(() => {
    if (tab === "today") loadTodayList();
  }, [tab, loadTodayList]);

  useEffect(() => () => stopListen(), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function lookupStudent(query: string) {
    if (!query.trim() || !user?.school_id) return;
    setLookingUp(true);
    setStudent(null);
    setPermissions([]);
    try {
      let identifier = query.trim();
      // If it looks like an NFC UID (all hex, no dashes, 8+ chars) resolve via canteen lookup
      const isUid = /^[0-9A-Fa-f]{6,}$/.test(identifier) && !identifier.includes("-");
      if (isUid) {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, identifier).catch(() => null);
        if (holder?.card_number && (holder as any).holder_kind !== "staff") {
          identifier = holder.card_number;
        } else if ((holder as any)?.holder_kind === "staff") {
          toast("Staff cards cannot be looked up here", "error");
          return;
        }
      }
      const s = await supabaseLibraryService.lookupStudent(user.school_id, identifier);
      setStudent({ id: s.id, name: s.name, studentClass: s.class, student_code: s.student_code, photo: s.photo });
      await loadStudentPermissions(s.id);
      if (tab === "check") {
        // Auto show any active permissions with toast
        const perms = await permissionsService.getStudentPermissions(user.school_id, s.id).catch(() => []);
        const active = perms.filter(p => p.status === "active");
        if (active.length > 0) {
          toast(`${s.name} has ${active.length} active permission${active.length > 1 ? "s" : ""}`, "success");
        } else {
          toast(`${s.name} — no active permissions`, "info");
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Student not found", "error");
    } finally {
      setLookingUp(false);
    }
  }

  async function loadStudentPermissions(studentId: string) {
    if (!user?.school_id) return;
    setLoadingPerms(true);
    try {
      const perms = await permissionsService.getStudentPermissions(user.school_id, studentId);
      setPermissions(perms);
    } catch {
      setPermissions([]);
    } finally {
      setLoadingPerms(false);
    }
  }

  const handleNfcScan = useCallback((val: string) => {
    setCardInput(val);
    lookupStudent(val);
  }, [user?.school_id, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNfcRef = useRef(handleNfcScan);
  handleNfcRef.current = handleNfcScan;

  async function toggleNFC() {
    if (listening) { stopListen(); return; }
    if (!isSupported) {
      toast("Web NFC requires Chrome on Android", "info");
      return;
    }
    const ok = await startListen((r) => handleNfcRef.current(r.value));
    if (ok) toast("NFC active — tap student card", "success");
  }

  function computeValidUntil(): string | null {
    if (customUntil) return new Date(customUntil).toISOString();
    if (presetMs !== null) return new Date(Date.now() + presetMs).toISOString();
    return null;
  }

  async function handleGrant() {
    if (!student || !user?.school_id) return;
    if (!reason.trim()) { toast("Please fill in the reason", "error"); return; }
    setGranting(true);
    try {
      await permissionsService.grantPermission({
        schoolId: user.school_id,
        studentRecordId: student.id,
        permissionType: permType,
        reason: reason.trim(),
        validUntil: computeValidUntil(),
      });
      const label = PERMISSION_LABELS[permType];
      const untilStr = computeValidUntil()
        ? ` until ${fmtTime(computeValidUntil()!)}`
        : "";
      toast(`${label} granted to ${student.name}${untilStr}`, "success");
      setReason("");
      await loadStudentPermissions(student.id);
      if (tab === "today") loadTodayList();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to grant permission", "error");
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(permId: string) {
    if (!user?.school_id) return;
    setRevoking(permId);
    try {
      await permissionsService.revokePermission(user.school_id, permId);
      toast("Permission revoked", "success");
      if (student) await loadStudentPermissions(student.id);
      if (tab === "today") loadTodayList();
      setTodayList(prev => prev.map(r => r.id === permId ? { ...r, status: "revoked" as const } : r));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to revoke", "error");
    } finally {
      setRevoking(null);
    }
  }

  function clearStudent() {
    setStudent(null);
    setPermissions([]);
    setCardInput("");
    setReason("");
  }

  const activePerms = permissions.filter(p => p.status === "active");

  return (
    <DashboardShell>
      <div className="h-full flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">Student Permissions</h1>
            <p className="text-xs text-gray-400 mt-0.5">Grant, check, and manage student exit passes</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mx-3 md:mx-4 mb-3 p-1 bg-gray-100 rounded-2xl flex-shrink-0">
          {(["grant", "check", "today"] as Tab[]).map((t) => {
            const labels: Record<Tab, string> = { grant: "Grant Permission", check: "Check Student", today: "Today's List" };
            const icons: Record<Tab, React.ReactNode> = {
              grant: <Shield size={13} />,
              check: <User size={13} />,
              today: <List size={13} />,
            };
            return (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}>
                {icons[t]} {labels[t]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4 space-y-3">

          {/* ══════════ TODAY'S LIST ══════════ */}
          {tab === "today" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Permissions granted today</span>
                <button onClick={loadTodayList} className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
                  <RotateCcw size={13} className={`text-gray-400 ${todayLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
              {todayLoading ? (
                <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
              ) : todayList.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                  <Shield size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-500">No permissions granted today</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 divide-y divide-gray-50">
                  {todayList.map(row => (
                    <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                      {row.profile_photo_path ? (
                        <img src={row.profile_photo_path} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 flex-shrink-0">
                          {(row.student_name[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 truncate">{row.student_name}</p>
                          {row.class_name && <span className="text-[9px] font-semibold text-gray-400">{row.class_name}</span>}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${TYPE_COLORS[row.permission_type]}`}>
                            {TYPE_ICONS[row.permission_type]} {PERMISSION_LABELS[row.permission_type]}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[row.status]}`}>
                            {row.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{row.reason}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                          <span>By {row.granted_by_name}</span>
                          <span>·</span>
                          <span>{fmtTime(row.granted_at)}</span>
                          {row.valid_until && (
                            <>
                              <span>·</span>
                              <span className={row.status === "active" ? "text-orange-500 font-semibold" : ""}>
                                {row.status === "active" ? timeUntil(row.valid_until) : `until ${fmtTime(row.valid_until)}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {row.status === "active" && (
                        <button
                          onClick={() => handleRevoke(row.id)}
                          disabled={revoking === row.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                          title="Revoke permission"
                        >
                          {revoking === row.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════ GRANT + CHECK MODES ══════════ */}
          {(tab === "grant" || tab === "check") && (
            <>
              {/* NFC Scanner */}
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <CreditCard size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                    <input
                      value={cardInput}
                      onChange={e => setCardInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") lookupStudent(cardInput); }}
                      placeholder="Tap NFC card or type student code / card number…"
                      className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900"
                    />
                  </div>
                  <button onClick={toggleNFC}
                    className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer ${
                      listening
                        ? "bg-[#16A34A] text-white animate-pulse ring-2 ring-green-200"
                        : "bg-green-50 text-[#16A34A] hover:bg-green-100 border border-green-200"
                    }`}>
                    <Wifi size={15} /> {listening ? "Listening…" : "NFC"}
                  </button>
                  <button
                    onClick={() => lookupStudent(cardInput)}
                    disabled={lookingUp || !cardInput.trim()}
                    className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 bg-gray-900 hover:bg-black cursor-pointer flex-shrink-0">
                    {lookingUp ? <Loader2 size={14} className="animate-spin" /> : "Check"}
                  </button>
                </div>
              </div>

              {/* Student Card */}
              {student && (
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
                    {student.photo ? (
                      <img src={student.photo} className="w-11 h-11 rounded-2xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-[#16A34A] flex items-center justify-center font-bold text-white text-base flex-shrink-0">
                        {(student.name[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{student.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {student.studentClass && <span>Class: <strong>{student.studentClass}</strong></span>}
                        <span>ID: <strong>{student.student_code}</strong></span>
                      </div>
                    </div>
                    {activePerms.length > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-100 text-green-700 flex-shrink-0">
                        {activePerms.length} Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 flex-shrink-0">
                        No pass
                      </span>
                    )}
                    <button onClick={clearStudent} className="p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer text-gray-400 hover:text-gray-700">
                      <X size={15} />
                    </button>
                  </div>

                  {/* Active permissions for this student */}
                  {loadingPerms ? (
                    <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
                  ) : permissions.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                      {permissions.map(p => (
                        <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                          <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${TYPE_COLORS[p.permission_type]}`}>
                            {TYPE_ICONS[p.permission_type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900">{PERMISSION_LABELS[p.permission_type]}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[p.status]}`}>
                                {p.status === "active" && p.valid_until ? timeUntil(p.valid_until) : p.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-0.5">{p.reason}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400">
                              <Clock size={9} />
                              <span>{fmtDateTime(p.granted_at)}</span>
                              {p.valid_until && (
                                <>
                                  <ChevronRight size={9} />
                                  <span>{fmtDateTime(p.valid_until)}</span>
                                </>
                              )}
                              <span>· By {p.granted_by_name}</span>
                            </div>
                          </div>
                          {p.status === "active" && (
                            <button
                              onClick={() => handleRevoke(p.id)}
                              disabled={revoking === p.id}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                              title="Revoke">
                              {revoking === p.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-4 flex items-center gap-2 text-sm text-gray-400">
                      <CheckCircle size={16} className="text-green-400" />
                      No permissions in the last 24 hours
                    </div>
                  )}
                </div>
              )}

              {/* Grant Form — only shown in grant tab, only when student is selected */}
              {tab === "grant" && student && (
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">New Permission</p>

                  {/* Type selector */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-2">Permission type</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["go_home", "go_out", "medical", "other"] as PermissionType[]).map(t => (
                        <button key={t} type="button" onClick={() => setPermType(t)}
                          className={`flex items-center gap-2 p-2.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                            permType === t
                              ? "border-[#16A34A] bg-green-50 text-[#16A34A]"
                              : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                          }`}>
                          {TYPE_ICONS[t]}
                          {PERMISSION_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">Reason</p>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Parent requested early pickup, dental appointment…"
                      rows={2}
                      className="w-full border border-gray-200 rounded-2xl px-3.5 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900 resize-none"
                    />
                  </div>

                  {/* Valid until */}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-2">Valid until (optional)</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <button type="button" onClick={() => { setPresetMs(null); setCustomUntil(""); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          presetMs === null && !customUntil ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>No limit</button>
                      {[
                        { label: "30 min", ms: 30 * 60 * 1000 },
                        { label: "1 hour", ms: 60 * 60 * 1000 },
                        { label: "2 hours", ms: 2 * 60 * 60 * 1000 },
                        { label: "4 hours", ms: 4 * 60 * 60 * 1000 },
                        { label: "End of day", ms: endOfDayMs() },
                      ].map(p => (
                        <button key={p.label} type="button" onClick={() => { setPresetMs(p.ms); setCustomUntil(""); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                            presetMs === p.ms && !customUntil ? "bg-[#16A34A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}>{p.label}</button>
                      ))}
                    </div>
                    <input type="datetime-local"
                      value={customUntil}
                      onChange={e => { setCustomUntil(e.target.value); setPresetMs(null); }}
                      className="w-full border border-gray-200 rounded-2xl px-3.5 py-2 text-sm outline-none focus:border-[#16A34A] text-gray-700"
                    />
                    {(presetMs !== null || customUntil) && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Expires: <strong className="text-gray-700">{fmtDateTime(computeValidUntil()!)}</strong>
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleGrant}
                    disabled={granting || !reason.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition active:scale-[.98] cursor-pointer"
                    style={{ background: "#16A34A" }}>
                    {granting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    Grant Permission to {student.name.split(" ")[0]}
                  </button>
                </div>
              )}

              {/* Grant tab — no student yet */}
              {tab === "grant" && !student && (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                  <div className="w-12 h-12 rounded-2xl bg-green-50 mx-auto flex items-center justify-center mb-3">
                    <Shield size={22} className="text-[#16A34A]" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Tap a student card to grant permission</p>
                  <p className="text-xs text-gray-400 mt-1">Or type the student code and press Enter</p>
                </div>
              )}

              {/* Check tab — no student yet */}
              {tab === "check" && !student && (
                <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 mx-auto flex items-center justify-center mb-3">
                    <User size={22} className="text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Tap a student card to check permissions</p>
                  <p className="text-xs text-gray-400 mt-1">Shows all permissions granted in the last 24 hours</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
