"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { gateAccess, teachers, Campus, GateDevice, RestrictedZone, AccessLog, VisitorLog, Teacher } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import {
  Loader2, Shield, Plus, X, CheckCircle, Clock,
  DoorOpen, Users, Settings, Activity, ShieldAlert,
  ShieldCheck, Key, Lock, Unlock, UserCheck, ChevronRight,
  AlertCircle, Eye, Scan
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

const DENIAL_LABELS: Record<string, string> = {
  CARD_NOT_FOUND: "Card not recognized",
  CARD_INACTIVE: "Card is deactivated",
  CARD_FROZEN: "Card is frozen (reported lost/stolen)",
  RESTRICTED_ZONE_DENIED: "Not authorized for this area",
};

const LOCATION_LABELS: Record<string, string> = {
  MAIN_GATE: "Main Gate",
  CLASSROOM: "Classroom",
  LIBRARY: "Library",
  CAFETERIA: "Cafeteria",
  DORMITORY: "Dormitory",
  RESTRICTED_ZONE: "Restricted Area",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrators",
  TEACHER: "All Teachers",
  STUDENT: "All Students",
  NURSE: "Medical Staff",
  BURSAR: "Finance Staff",
  DISCIPLINE: "Discipline Officers",
  LIBRARIAN: "Librarians",
};

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">{icon}</div>
        <div>
          <p className="text-sm font-bold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function GateAccessPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"logs" | "setup" | "visitors">("logs");
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [devices, setDevices] = useState<GateDevice[]>([]);
  const [zones, setZones] = useState<RestrictedZone[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);

  // Test Access panel
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testDevice, setTestDevice] = useState("");
  const [testCard, setTestCard] = useState("");
  const [testDir, setTestDir] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [testResult, setTestResult] = useState<{ decision: "GRANTED" | "DENIED"; reason?: string; ownerName?: string; photoUrl?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Modals
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<RestrictedZone | null>(null);

  // Forms
  const [deviceForm, setDeviceForm] = useState({ campus_id: "", name: "", location_type: "MAIN_GATE", zone_id: "" });
  const [zoneForm, setZoneForm] = useState({ campus_id: "", name: "", description: "" });
  const [grantType, setGrantType] = useState<"ROLE" | "USER">("ROLE");
  const [grantRole, setGrantRole] = useState("TEACHER");
  const [grantUser, setGrantUser] = useState<Teacher | null>(null);
  const [grantUserSearch, setGrantUserSearch] = useState("");
  const [grantUserResults, setGrantUserResults] = useState<Teacher[]>([]);
  const [grantValidFrom, setGrantValidFrom] = useState(new Date().toISOString().substring(0, 16));
  const [grantValidTo, setGrantValidTo] = useState("");
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [visitorForm, setVisitorForm] = useState({ campusId: "", visitor_name: "", id_document_ref: "", purpose: "", expected_checkout_at: "" });
  const [visitorHost, setVisitorHost] = useState<Teacher | null>(null);
  const [visitorHostSearch, setVisitorHostSearch] = useState("");
  const [visitorHostResults, setVisitorHostResults] = useState<Teacher[]>([]);
  const [searchingHost, setSearchingHost] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (activeTab === "logs") {
        gateAccess.logs({ limit: 40 }).then(res => setLogs(res.data)).catch(() => {});
      } else if (activeTab === "visitors") {
        gateAccess.visitors({ limit: 30 }).then(res => setVisitors(res.data)).catch(() => {});
      }
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authLoading, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      const [campRes, devRes, zoneRes, logRes, visRes] = await Promise.all([
        gateAccess.campuses(),
        gateAccess.devices(),
        gateAccess.zones(),
        gateAccess.logs({ limit: 40 }),
        gateAccess.visitors({ limit: 30 }),
      ]);
      setCampuses(campRes.data);
      setDevices(devRes.data);
      setZones(zoneRes.data);
      setLogs(logRes.data);
      setVisitors(visRes.data);
      if (campRes.data.length > 0) {
        const cid = campRes.data[0].id;
        setDeviceForm(f => ({ ...f, campus_id: cid }));
        setZoneForm(f => ({ ...f, campus_id: cid }));
        setVisitorForm(f => ({ ...f, campusId: cid }));
      }
      if (devRes.data.length > 0) setTestDevice(devRes.data[0].id);
    } catch {
      toast("Failed to load gate access data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshConfig() {
    const [devRes, zoneRes] = await Promise.all([gateAccess.devices(), gateAccess.zones()]).catch(() => [{ data: [] }, { data: [] }]) as any[];
    setDevices(devRes?.data ?? []);
    setZones(zoneRes?.data ?? []);
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gateAccess.createDevice({ campus_id: deviceForm.campus_id, name: deviceForm.name, location_type: deviceForm.location_type, zone_id: deviceForm.zone_id || undefined });
      toast("Scanner registered", "success");
      setShowDeviceModal(false);
      setDeviceForm(f => ({ ...f, name: "", zone_id: "" }));
      refreshConfig();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gateAccess.createZone(zoneForm);
      toast("Restricted area created", "success");
      setShowZoneModal(false);
      setZoneForm(f => ({ ...f, name: "", description: "" }));
      refreshConfig();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleAddGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedZone) return;
    const granteeId = grantType === "ROLE" ? grantRole : (grantUser?.user_id ?? "");
    if (!granteeId) { toast("Please select a person to grant access", "error"); return; }
    try {
      await gateAccess.createGrant(selectedZone.id, {
        grantee_type: grantType,
        grantee_id: granteeId,
        valid_from: new Date(grantValidFrom).toISOString(),
        valid_to: grantValidTo ? new Date(grantValidTo).toISOString() : undefined,
      });
      toast("Access granted", "success");
      setShowGrantModal(false);
      setGrantUser(null);
      setGrantUserSearch("");
      refreshConfig();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleRegisterVisitor(e: React.FormEvent) {
    e.preventDefault();
    if (!visitorHost) return;
    try {
      await gateAccess.createVisitor({
        campusId: visitorForm.campusId,
        visitor_name: visitorForm.visitor_name,
        id_document_ref: visitorForm.id_document_ref || undefined,
        purpose: visitorForm.purpose,
        host_user_id: visitorHost.user_id,
        expected_checkout_at: visitorForm.expected_checkout_at ? new Date(visitorForm.expected_checkout_at).toISOString() : undefined,
      });
      toast("Visitor checked in", "success");
      setShowVisitorModal(false);
      setVisitorForm(f => ({ ...f, visitor_name: "", id_document_ref: "", purpose: "", expected_checkout_at: "" }));
      setVisitorHost(null);
      setVisitorHostSearch("");
      const visRes = await gateAccess.visitors();
      setVisitors(visRes.data);
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleCheckoutVisitor(id: string) {
    try {
      await gateAccess.checkoutVisitor(id);
      toast("Visitor checked out", "success");
      const visRes = await gateAccess.visitors();
      setVisitors(visRes.data);
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleOverride(logId: string) {
    try {
      await gateAccess.override(logId);
      toast("Access manually granted", "success");
      const logRes = await gateAccess.logs({ limit: 40 });
      setLogs(logRes.data);
    } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); }
  }

  async function handleTestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!testDevice || !testCard.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await gateAccess.evaluate({ deviceId: testDevice, cardNumber: testCard.trim(), direction: testDir });
      setTestResult(res.data);
      const logRes = await gateAccess.logs({ limit: 40 });
      setLogs(logRes.data);
    } catch (err) { toast(err instanceof Error ? err.message : "Test failed", "error"); }
    finally { setTesting(false); }
  }

  async function searchUsers(q: string) {
    if (!q.trim()) { setGrantUserResults([]); return; }
    setSearchingUsers(true);
    try {
      const res = await teachers.list({ search: q, limit: 6 });
      setGrantUserResults(res.data);
    } finally { setSearchingUsers(false); }
  }

  async function searchHosts(q: string) {
    if (!q.trim()) { setVisitorHostResults([]); return; }
    setSearchingHost(true);
    try {
      const res = await teachers.list({ search: q, limit: 6 });
      setVisitorHostResults(res.data);
    } finally { setSearchingHost(false); }
  }

  const inp = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100";

  return (
    <DashboardShell>
      <div className="p-4 space-y-4 max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Shield size={20} className="text-blue-600" /> Gate Access Control
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Track who enters and exits campus — real time</p>
          </div>
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition ${showTestPanel ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"}`}
          >
            <Scan size={15} /> Test a Card
          </button>
        </div>

        {/* Test Access Panel */}
        {showTestPanel && (
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">Test Card Access</p>
                <p className="text-xs text-slate-400 mt-0.5">Check if a card would be allowed through any scanner — no physical tap needed</p>
              </div>
              <button onClick={() => setShowTestPanel(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <form onSubmit={handleTestAccess} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">Scanner</label>
                <select value={testDevice} onChange={e => setTestDevice(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500">
                  {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">Card Number</label>
                <input value={testCard} onChange={e => setTestCard(e.target.value)}
                  placeholder="e.g. KNT-KMS-2026-00001" required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 placeholder-slate-600" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase">Direction</label>
                <div className="flex bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <button type="button" onClick={() => setTestDir("ENTRY")}
                    className={`flex-1 py-2 text-xs font-bold transition ${testDir === "ENTRY" ? "bg-green-600 text-white" : "text-slate-400 hover:text-white"}`}>
                    Entry
                  </button>
                  <button type="button" onClick={() => setTestDir("EXIT")}
                    className={`flex-1 py-2 text-xs font-bold transition ${testDir === "EXIT" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                    Exit
                  </button>
                </div>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={testing || !testCard.trim()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2">
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <Key size={13} />}
                  Check Access
                </button>
              </div>
            </form>

            {testResult && (
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${testResult.decision === "GRANTED" ? "bg-green-900/40 border-green-700" : "bg-red-900/40 border-red-700"}`}>
                {testResult.decision === "GRANTED" ? (
                  <>
                    <ShieldCheck size={32} className="text-green-400 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-300">Access would be GRANTED</p>
                      {testResult.ownerName && <p className="text-xs text-slate-300 mt-0.5">{testResult.ownerName} can pass through</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={32} className="text-red-400 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-300">Access would be DENIED</p>
                      <p className="text-xs text-slate-300 mt-0.5">{DENIAL_LABELS[testResult.reason ?? ""] || testResult.reason}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Bar */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          {[
            { key: "logs", label: "Live Feed", icon: <Activity size={14} /> },
            { key: "setup", label: "Scanners & Areas", icon: <Settings size={14} /> },
            { key: "visitors", label: "Visitors", icon: <Users size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === t.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : activeTab === "logs" ? (

          /* ── LIVE FEED ─────────────────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent entries & exits</p>
              <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
                <DoorOpen size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No access events logged yet</p>
                <p className="text-xs text-gray-300 mt-1">Events will appear here when students or staff tap their cards</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {logs.map((log) => {
                  const student = log.card?.student;
                  const name = student ? `${student.user?.first_name ?? ""} ${student.user?.last_name ?? ""}`.trim() || "Unknown card" : "Unknown card";
                  const isGranted = log.decision === "GRANTED";
                  const timeStr = new Date(log.occurred_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={log.id} className={`p-4 rounded-2xl border flex items-start gap-3 ${isGranted ? "border-green-100 bg-green-50/30" : "border-red-100 bg-red-50/30"}`}>
                      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm ${isGranted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {student?.user?.profile_photo
                          ? <img src={student.user.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                          : name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-800 truncate">{name}</p>
                            <p className="text-xs text-gray-400">{log.device?.name ?? "Unknown scanner"}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isGranted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                              {isGranted ? "✓ Allowed" : "✗ Denied"}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${log.direction === "ENTRY" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                              {log.direction === "ENTRY" ? "→ Entry" : "← Exit"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80">
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock size={10} /> {timeStr}
                          </span>
                          {!isGranted && (
                            <div className="flex items-center gap-2">
                              {log.denial_reason && (
                                <span className="text-[9px] text-gray-500 italic">{DENIAL_LABELS[log.denial_reason] || log.denial_reason}</span>
                              )}
                              {!log.overridden_by_user_id && (
                                <button onClick={() => handleOverride(log.id)}
                                  className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-[9px] font-bold hover:border-blue-300 hover:text-blue-600 transition">
                                  Override
                                </button>
                              )}
                              {log.overridden_by_user_id && (
                                <span className="text-[9px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold border border-amber-100">Manually allowed</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        ) : activeTab === "setup" ? (

          /* ── SETUP ─────────────────────────────────────────── */
          <div className="space-y-5">

            {/* How it works */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4 items-start">
              <AlertCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 space-y-1">
                <p className="font-bold">How gate access works</p>
                <p>1. Register a <strong>Scanner</strong> (physical card reader at a door or gate).</p>
                <p>2. To restrict an area, create a <strong>Restricted Area</strong> and assign your scanner to it.</p>
                <p>3. <strong>Grant access</strong> to the area — by role (e.g. all teachers) or a specific person.</p>
                <p>Students and staff who haven't been granted access will be <strong>denied entry</strong> to restricted areas.</p>
              </div>
            </div>

            {/* Scanners */}
            <Section
              title={`Scanners (${devices.length})`}
              subtitle="Card readers installed at gates, doors, and restricted areas"
              icon={<Scan size={16} className="text-blue-600" />}
            >
              <div className="space-y-3">
                {devices.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No scanners registered yet. Add your first card reader below.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {devices.map(d => (
                    <div key={d.id} className="p-3 border border-gray-100 rounded-xl flex items-start justify-between bg-gray-50">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{d.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{LOCATION_LABELS[d.location_type] ?? d.location_type}</p>
                        {d.restricted_zone && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100">
                            <Lock size={9} /> {d.restricted_zone.name}
                          </span>
                        )}
                        {!d.restricted_zone && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-100">
                            <Unlock size={9} /> Open area — all cards allowed
                          </span>
                        )}
                      </div>
                      <button onClick={() => gateAccess.deleteDevice(d.id).then(refreshConfig).catch(() => {})} className="text-gray-300 hover:text-red-400 transition ml-2 flex-shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowDeviceModal(true)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-800 transition">
                  <Plus size={15} /> Add a Scanner
                </button>
              </div>
            </Section>

            {/* Restricted Areas */}
            <Section
              title={`Restricted Areas (${zones.length})`}
              subtitle="Areas that require explicit access permission — only authorized people can enter"
              icon={<Lock size={16} className="text-blue-600" />}
            >
              <div className="space-y-3">
                {zones.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">No restricted areas created yet. Create one to start controlling access.</p>
                )}
                {zones.map(z => (
                  <div key={z.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="flex items-start justify-between p-4 bg-slate-50">
                      <div>
                        <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                          <Lock size={13} className="text-amber-500" /> {z.name}
                        </p>
                        {z.description && <p className="text-xs text-gray-400 mt-1">{z.description}</p>}
                      </div>
                      <button onClick={() => gateAccess.deleteZone(z.id).then(refreshConfig).catch(() => {})} className="text-gray-300 hover:text-red-400 transition ml-3">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="p-4">
                      <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Who has access</p>
                      {(!z.access_grants || z.access_grants.length === 0) ? (
                        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
                          <ShieldAlert size={14} className="text-red-400" />
                          <p className="text-xs text-red-600">Nobody has been granted access yet — everyone will be denied</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {z.access_grants.map(grant => (
                            <div key={grant.id} className="flex items-center justify-between p-2.5 bg-green-50 rounded-xl border border-green-100">
                              <div className="flex items-center gap-2">
                                <UserCheck size={13} className="text-green-600" />
                                <div>
                                  <span className="text-xs font-bold text-gray-700">
                                    {grant.grantee_type === "ROLE"
                                      ? (ROLE_LABELS[grant.grantee_id] ?? grant.grantee_id)
                                      : grant.grantee_id}
                                  </span>
                                  {grant.valid_to && (
                                    <span className="ml-2 text-[10px] text-gray-400">until {new Date(grant.valid_to).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                              <button onClick={() => gateAccess.deleteGrant(grant.id).then(refreshConfig).catch(() => {})}
                                className="text-gray-300 hover:text-red-400 transition">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => { setSelectedZone(z); setGrantUser(null); setGrantUserSearch(""); setGrantType("ROLE"); setGrantRole("TEACHER"); setShowGrantModal(true); }}
                        className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:text-blue-800 transition"
                      >
                        <Plus size={13} /> Grant access to someone
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setShowZoneModal(true)}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition">
                  <Plus size={15} /> Create a Restricted Area
                </button>
              </div>
            </Section>
          </div>

        ) : (

          /* ── VISITORS ────────────────────────────────────────── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-700">Visitor Register</p>
                <p className="text-xs text-gray-400 mt-0.5">Log external visitors — parents, contractors, officials</p>
              </div>
              <button onClick={() => setShowVisitorModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition">
                <Plus size={14} /> Check In Visitor
              </button>
            </div>

            {visitors.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
                <Users size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No visitors logged today</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-3 font-bold text-gray-500">Visitor</th>
                      <th className="p-3 font-bold text-gray-500">Purpose</th>
                      <th className="p-3 font-bold text-gray-500">Visiting</th>
                      <th className="p-3 font-bold text-gray-500">Checked In</th>
                      <th className="p-3 font-bold text-gray-500">Checked Out</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visitors.map(v => (
                      <tr key={v.id} className={v.checked_out_at ? "opacity-60" : ""}>
                        <td className="p-3 font-semibold text-gray-800">{v.visitor_name}</td>
                        <td className="p-3 text-gray-500">{v.purpose}</td>
                        <td className="p-3 text-gray-600">{v.host?.first_name} {v.host?.last_name}</td>
                        <td className="p-3 text-gray-400">{new Date(v.checked_in_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="p-3">
                          {v.checked_out_at
                            ? <span className="text-gray-400">{new Date(v.checked_out_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" })}</span>
                            : <span className="bg-green-50 text-green-600 font-bold px-2 py-0.5 rounded-full border border-green-100">On campus</span>}
                        </td>
                        <td className="p-3 text-right">
                          {!v.checked_out_at && (
                            <button onClick={() => handleCheckoutVisitor(v.id)}
                              className="px-3 py-1 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:border-red-200 hover:text-red-600 transition">
                              Check Out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* MODAL: Add Scanner */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800">Register a Scanner</h3>
                <p className="text-xs text-gray-400 mt-0.5">A scanner is a physical card reader at a door or gate</p>
              </div>
              <button onClick={() => setShowDeviceModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Scanner Name *</label>
                <input value={deviceForm.name} onChange={e => setDeviceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Gate Reader, Science Lab Door" required className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus *</label>
                  <select value={deviceForm.campus_id} onChange={e => setDeviceForm(f => ({ ...f, campus_id: e.target.value }))} className={inp}>
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Location Type *</label>
                  <select value={deviceForm.location_type} onChange={e => setDeviceForm(f => ({ ...f, location_type: e.target.value }))} className={inp}>
                    {Object.entries(LOCATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Link to Restricted Area (optional)</label>
                <select value={deviceForm.zone_id} onChange={e => setDeviceForm(f => ({ ...f, zone_id: e.target.value }))} className={inp}>
                  <option value="">None — everyone with a valid card can pass</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Link to an area if this scanner guards a restricted space</p>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
                Register Scanner
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create Restricted Area */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800">Create Restricted Area</h3>
                <p className="text-xs text-gray-400 mt-0.5">A place that only authorized people can access</p>
              </div>
              <button onClick={() => setShowZoneModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Area Name *</label>
                <input value={zoneForm.name} onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Server Room, Staff Office, Chemistry Lab" required className={inp} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus</label>
                <select value={zoneForm.campus_id} onChange={e => setZoneForm(f => ({ ...f, campus_id: e.target.value }))} className={inp}>
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                <textarea value={zoneForm.description} onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Why is this area restricted?" className={`${inp} resize-none`} />
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
                Create Restricted Area
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Grant Access */}
      {showGrantModal && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-gray-800">Grant Access</h3>
                <p className="text-xs text-gray-400 mt-0.5">Area: <span className="font-semibold text-gray-600">{selectedZone.name}</span></p>
              </div>
              <button onClick={() => setShowGrantModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddGrant} className="space-y-4 mt-4">
              {/* Who gets access */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block">Who should get access?</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setGrantType("ROLE")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${grantType === "ROLE" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
                    A group / role
                  </button>
                  <button type="button" onClick={() => setGrantType("USER")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${grantType === "USER" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-500 hover:border-blue-300"}`}>
                    A specific person
                  </button>
                </div>
              </div>

              {grantType === "ROLE" ? (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Select group *</label>
                  <select value={grantRole} onChange={e => setGrantRole(e.target.value)} className={inp}>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Search for a person *</label>
                  {grantUser ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{grantUser.user.first_name} {grantUser.user.last_name}</p>
                        <p className="text-xs text-gray-400">Staff member</p>
                      </div>
                      <button type="button" onClick={() => { setGrantUser(null); setGrantUserSearch(""); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input value={grantUserSearch}
                        onChange={e => { setGrantUserSearch(e.target.value); searchUsers(e.target.value); }}
                        placeholder="Type name to search staff..." className={inp} />
                      {searchingUsers && <Loader2 size={13} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                      {grantUserResults.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 border border-gray-200 rounded-xl bg-white shadow-lg z-10 overflow-hidden">
                          {grantUserResults.map(h => (
                            <button key={h.id} type="button" onClick={() => { setGrantUser(h); setGrantUserResults([]); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 text-xs">
                              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">{h.user.first_name[0]}</div>
                              <span className="font-semibold text-gray-700">{h.user.first_name} {h.user.last_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Access starts *</label>
                  <input type="datetime-local" value={grantValidFrom} onChange={e => setGrantValidFrom(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Access expires (optional)</label>
                  <input type="datetime-local" value={grantValidTo} onChange={e => setGrantValidTo(e.target.value)} className={inp} />
                  <p className="text-[10px] text-gray-400 mt-1">Leave blank for permanent access</p>
                </div>
              </div>

              <button type="submit" className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition">
                Grant Access
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Visitor Check-In */}
      {showVisitorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800">Check In Visitor</h3>
                <p className="text-xs text-gray-400 mt-0.5">Log an external visitor arriving on campus</p>
              </div>
              <button onClick={() => setShowVisitorModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleRegisterVisitor} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Visitor Name *</label>
                <input value={visitorForm.visitor_name} onChange={e => setVisitorForm(f => ({ ...f, visitor_name: e.target.value }))}
                  placeholder="Full name" required className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">ID / Passport Ref</label>
                  <input value={visitorForm.id_document_ref} onChange={e => setVisitorForm(f => ({ ...f, id_document_ref: e.target.value }))}
                    placeholder="Optional" className={inp} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus</label>
                  <select value={visitorForm.campusId} onChange={e => setVisitorForm(f => ({ ...f, campusId: e.target.value }))} className={inp}>
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Purpose of Visit *</label>
                <input value={visitorForm.purpose} onChange={e => setVisitorForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Parent meeting, Equipment delivery, Official inspection" required className={inp} />
              </div>

              {/* Host search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Who are they visiting? *</label>
                {visitorHost ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{visitorHost.user.first_name} {visitorHost.user.last_name}</p>
                      <p className="text-xs text-gray-400">Staff member</p>
                    </div>
                    <button type="button" onClick={() => { setVisitorHost(null); setVisitorHostSearch(""); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={visitorHostSearch}
                      onChange={e => { setVisitorHostSearch(e.target.value); searchHosts(e.target.value); }}
                      placeholder="Type staff name to search..." className={inp} />
                    {searchingHost && <Loader2 size={13} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                    {visitorHostResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 border border-gray-200 rounded-xl bg-white shadow-lg z-10 overflow-hidden">
                        {visitorHostResults.map(h => (
                          <button key={h.id} type="button" onClick={() => { setVisitorHost(h); setVisitorHostResults([]); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 text-xs">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600">{h.user.first_name[0]}</div>
                            <span className="font-semibold text-gray-700">{h.user.first_name} {h.user.last_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Expected departure (optional)</label>
                <input type="datetime-local" value={visitorForm.expected_checkout_at}
                  onChange={e => setVisitorForm(f => ({ ...f, expected_checkout_at: e.target.value }))} className={inp} />
              </div>

              <button type="submit" disabled={!visitorHost}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl text-sm font-semibold transition">
                Check In Visitor
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
