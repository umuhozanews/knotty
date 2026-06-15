"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { gateAccess, students, teachers, Campus, GateDevice, RestrictedZone, AccessLog, VisitorLog, Student, Teacher } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import {
  Loader2, Shield, Plus, X, Search, AlertCircle, CheckCircle, Clock,
  Fingerprint, DoorOpen, Users, Settings, Activity, Wifi, ShieldAlert,
  ArrowRight, ShieldCheck, HelpCircle
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function GateAccessPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"logs" | "devices" | "visitors">("logs");
  const [loading, setLoading] = useState(true);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [devices, setDevices] = useState<GateDevice[]>([]);
  const [zones, setZones] = useState<RestrictedZone[]>([]);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [visitors, setVisitors] = useState<VisitorLog[]>([]);

  // Simulator State
  const [showSimulator, setShowSimulator] = useState(false);
  const [simDevice, setSimDevice] = useState("");
  const [simCardNumber, setSimCardNumber] = useState("");
  const [simDirection, setSimDirection] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [simResult, setSimResult] = useState<{ decision: "GRANTED" | "DENIED"; reason?: string; ownerName?: string } | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Modal / Form States
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  const [selectedZone, setSelectedZone] = useState<RestrictedZone | null>(null);

  // Device Form
  const [deviceForm, setDeviceForm] = useState({ campus_id: "", name: "", location_type: "MAIN_GATE", zone_id: "" });
  // Zone Form
  const [zoneForm, setZoneForm] = useState({ campus_id: "", name: "", description: "" });
  // Grant Form
  const [grantForm, setGrantForm] = useState({ grantee_type: "ROLE" as "ROLE" | "USER", grantee_id: "TEACHER", valid_from: new Date().toISOString().substring(0, 16), valid_to: "" });
  // Visitor Form
  const [visitorForm, setVisitorForm] = useState({ campusId: "", visitor_name: "", id_document_ref: "", purpose: "", host_user_id: "", expected_checkout_at: "" });
  const [visitorSearchHost, setVisitorSearchHost] = useState("");
  const [hostSearchResults, setHostSearchResults] = useState<Teacher[]>([]);
  const [selectedHost, setSelectedHost] = useState<Teacher | null>(null);
  const [searchingHost, setSearchingHost] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    loadInitialData();
  }, [authLoading]);

  // Poll logs and visitors periodically if active
  useEffect(() => {
    if (authLoading) return;
    const interval = setInterval(() => {
      if (activeTab === "logs") {
        gateAccess.logs({ limit: 40 }).then(res => setLogs(res.data)).catch(console.error);
      } else if (activeTab === "visitors") {
        gateAccess.visitors({ limit: 30 }).then(res => setVisitors(res.data)).catch(console.error);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [authLoading, activeTab]);

  async function loadInitialData() {
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
        setDeviceForm(f => ({ ...f, campus_id: campRes.data[0].id }));
        setZoneForm(f => ({ ...f, campus_id: campRes.data[0].id }));
        setVisitorForm(f => ({ ...f, campusId: campRes.data[0].id }));
      }
      if (devRes.data.length > 0) {
        setSimDevice(devRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load gate access data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshDevicesAndZones() {
    try {
      const [devRes, zoneRes] = await Promise.all([gateAccess.devices(), gateAccess.zones()]);
      setDevices(devRes.data);
      setZones(zoneRes.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddDevice(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gateAccess.createDevice({
        campus_id: deviceForm.campus_id,
        name: deviceForm.name,
        location_type: deviceForm.location_type,
        zone_id: deviceForm.zone_id || undefined,
      });
      toast("Gate device registered successfully", "success");
      setShowDeviceModal(false);
      setDeviceForm(f => ({ ...f, name: "", zone_id: "" }));
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add device", "error");
    }
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    try {
      await gateAccess.createZone(zoneForm);
      toast("Restricted zone created successfully", "success");
      setShowZoneModal(false);
      setZoneForm(f => ({ ...f, name: "", description: "" }));
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create zone", "error");
    }
  }

  async function handleAddGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedZone) return;
    try {
      await gateAccess.createGrant(selectedZone.id, {
        grantee_type: grantForm.grantee_type,
        grantee_id: grantForm.grantee_id,
        valid_from: new Date(grantForm.valid_from).toISOString(),
        valid_to: grantForm.valid_to ? new Date(grantForm.valid_to).toISOString() : undefined,
      });
      toast("Access grant created successfully", "success");
      setShowGrantModal(false);
      setGrantForm(f => ({ ...f, grantee_id: "TEACHER" }));
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add grant", "error");
    }
  }

  async function handleDeleteDevice(id: string) {
    if (!confirm("Are you sure you want to delete this gate device?")) return;
    try {
      await gateAccess.deleteDevice(id);
      toast("Gate device deleted", "success");
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete device", "error");
    }
  }

  async function handleDeleteZone(id: string) {
    if (!confirm("Are you sure you want to delete this restricted zone?")) return;
    try {
      await gateAccess.deleteZone(id);
      toast("Restricted zone deleted", "success");
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete zone", "error");
    }
  }

  async function handleDeleteGrant(id: string) {
    if (!confirm("Are you sure you want to revoke this access grant?")) return;
    try {
      await gateAccess.deleteGrant(id);
      toast("Access grant revoked", "success");
      refreshDevicesAndZones();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to revoke grant", "error");
    }
  }

  async function handleRegisterVisitor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedHost) return;
    try {
      await gateAccess.createVisitor({
        campusId: visitorForm.campusId,
        visitor_name: visitorForm.visitor_name,
        id_document_ref: visitorForm.id_document_ref || undefined,
        purpose: visitorForm.purpose,
        host_user_id: selectedHost.user_id,
        expected_checkout_at: visitorForm.expected_checkout_at ? new Date(visitorForm.expected_checkout_at).toISOString() : undefined,
      });
      toast("Visitor logged and badge QR generated", "success");
      setShowVisitorModal(false);
      setVisitorForm(f => ({ ...f, visitor_name: "", id_document_ref: "", purpose: "", expected_checkout_at: "" }));
      setSelectedHost(null);
      setVisitorSearchHost("");
      const visRes = await gateAccess.visitors();
      setVisitors(visRes.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to log visitor", "error");
    }
  }

  async function handleCheckoutVisitor(id: string) {
    try {
      await gateAccess.checkoutVisitor(id);
      toast("Visitor checked out successfully", "success");
      const visRes = await gateAccess.visitors();
      setVisitors(visRes.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to check out visitor", "error");
    }
  }

  async function handleManualOverride(logId: string) {
    try {
      await gateAccess.override(logId);
      toast("Access bypass granted manually", "success");
      const logRes = await gateAccess.logs({ limit: 40 });
      setLogs(logRes.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to override", "error");
    }
  }

  async function handleSimulateScan(e: React.FormEvent) {
    e.preventDefault();
    if (!simDevice || !simCardNumber.trim()) return;
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await gateAccess.evaluate({
        deviceId: simDevice,
        cardNumber: simCardNumber.trim(),
        direction: simDirection,
      });
      setSimResult(res.data);
      if (res.data.decision === "GRANTED") {
        toast(`Access GRANTED for ${res.data.ownerName}`, "success");
      } else {
        toast(`Access DENIED: ${res.data.reason}`, "error");
      }
      // Reload logs
      const logRes = await gateAccess.logs({ limit: 40 });
      setLogs(logRes.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Simulation request failed", "error");
    } finally {
      setSimulating(false);
    }
  }

  async function searchHosts(q: string) {
    if (!q.trim()) { setHostSearchResults([]); return; }
    setSearchingHost(true);
    try {
      const res = await teachers.list({ search: q, limit: 6 });
      setHostSearchResults(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingHost(false);
    }
  }

  return (
    <DashboardShell>
      <div className="p-4 space-y-4 h-full flex flex-col overflow-hidden">
        
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-700 to-indigo-800 p-4 rounded-2xl shadow-lg text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Shield size={24} className="text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Gate Access & Restricted Zones</h1>
              <p className="text-xs text-blue-100">Configure campus boundaries, scan devices, and visitor registers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSimulator(!showSimulator)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${showSimulator ? "bg-white text-indigo-800 border-white" : "bg-transparent text-white border-white/20 hover:bg-white/10"}`}>
              <Wifi size={14} /> {showSimulator ? "Close Simulator" : "Simulator Panel"}
            </button>
            <button onClick={() => {
              if (activeTab === "devices") setShowDeviceModal(true);
              else if (activeTab === "visitors") setShowVisitorModal(true);
              else toast("Change tab to Devices or Visitors to perform actions", "info");
            }}
              className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-semibold hover:bg-emerald-600 shadow-md transition flex items-center gap-1.5">
              <Plus size={14} /> New Record
            </button>
          </div>
        </div>

        {/* Simulator Panel (Conditional Slide-Down) */}
        {showSimulator && (
          <div className="bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-inner flex flex-col md:flex-row gap-4 flex-shrink-0 animate-fadeIn">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Activity size={12} className="text-emerald-400" /> ACCESS SCAN SIMULATOR</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">Edge Node Emulation</span>
              </div>
              <form onSubmit={simulating ? undefined : handleSimulateScan} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-medium block mb-1">Target Device *</label>
                  <select value={simDevice} onChange={(e) => setSimDevice(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500">
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.location_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-medium block mb-1">Card / Tag Number *</label>
                  <input value={simCardNumber} onChange={(e) => setSimCardNumber(e.target.value)}
                    placeholder="e.g. KNT-12345 (check Students)" required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500 placeholder-slate-600" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-medium block mb-1">Direction</label>
                  <div className="flex bg-slate-800 border border-slate-700 rounded-xl p-0.5">
                    <button type="button" onClick={() => setSimDirection("ENTRY")}
                      className={`flex-1 py-1 text-[10px] rounded-lg font-bold transition ${simDirection === "ENTRY" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                      IN
                    </button>
                    <button type="button" onClick={() => setSimDirection("EXIT")}
                      className={`flex-1 py-1 text-[10px] rounded-lg font-bold transition ${simDirection === "EXIT" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}>
                      OUT
                    </button>
                  </div>
                </div>
                <div className="flex items-end">
                  <button type="submit" disabled={simulating}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 shadow-md">
                    {simulating ? <Loader2 size={12} className="animate-spin" /> : <Fingerprint size={14} />} Tap Smart Card
                  </button>
                </div>
              </form>
            </div>
            
            {/* Simulation Result Output */}
            <div className="w-full md:w-64 bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center justify-center min-h-[80px]">
              {simResult ? (
                <div className="text-center space-y-1">
                  {simResult.decision === "GRANTED" ? (
                    <div className="flex flex-col items-center">
                      <ShieldCheck className="text-emerald-400 animate-bounce mb-1" size={24} />
                      <p className="text-xs font-bold text-white">ACCESS GRANTED</p>
                      <p className="text-[10px] text-slate-400">{simResult.ownerName}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <ShieldAlert className="text-red-400 animate-pulse mb-1" size={24} />
                      <p className="text-xs font-bold text-red-400">ACCESS DENIED</p>
                      <p className="text-[10px] text-slate-300">Reason: {simResult.reason}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-xs text-slate-500 flex flex-col items-center gap-1">
                  <HelpCircle size={18} />
                  <span>Awaiting card tap simulation</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Controls & Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm flex-shrink-0">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "logs" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <Activity size={14} /> Live Access Feed
            </button>
            <button onClick={() => setActiveTab("devices")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "devices" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <Settings size={14} /> Devices & Zones
            </button>
            <button onClick={() => setActiveTab("visitors")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "visitors" ? "bg-emerald-50 text-emerald-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <Users size={14} /> Visitor Register
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
          ) : activeTab === "logs" ? (
            
            // TAB 1: LIVE ACCESS LOGS
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-400 font-bold border-b pb-2">
                <span>RECENT ATTEMPTS</span>
                <span>AUTO-REFRESH ACTIVE</span>
              </div>
              
              {logs.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                  <ShieldAlert size={36} className="mb-2 text-gray-200" />
                  <p className="text-xs">No gate access logs logged today</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {logs.map((log) => {
                    const student = log.card?.student;
                    const name = student ? `${student.user.first_name} ${student.user.last_name}` : "Unknown / Suspended User";
                    const isGranted = log.decision === "GRANTED";
                    return (
                      <div key={log.id} className={`p-4 border rounded-2xl flex items-start gap-3 transition shadow-sm ${isGranted ? "border-emerald-100 bg-emerald-50/20" : "border-red-100 bg-red-50/20"}`}>
                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${isGranted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {student?.user.profile_photo ? (
                            <img src={student.user.profile_photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            name[0]
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <p className="text-xs font-bold text-gray-800">{name}</p>
                              <p className="text-[10px] text-gray-400">{log.device?.name || "Gate Device"}</p>
                            </div>
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${isGranted ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                              {log.decision}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/50">
                            <span className="text-[9px] text-gray-400 flex items-center gap-1">
                              <Clock size={10} /> {new Date(log.occurred_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali" })}
                            </span>
                            {!isGranted && !log.overridden_by_user_id && (
                              <button onClick={() => handleManualOverride(log.id)}
                                className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-bold hover:bg-indigo-100 transition">
                                Bypass Deny
                              </button>
                            )}
                            {log.overrider && (
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                Bypassed by Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === "devices" ? (
            
            // TAB 2: DEVICES & RESTRICTED ZONES
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              
              {/* Devices Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Device Inventory ({devices.length})</h3>
                  <button onClick={() => setShowDeviceModal(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                    <Plus size={14} /> Add Device
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {devices.map(d => (
                    <div key={d.id} className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">{d.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{d.location_type}</p>
                        {d.restricted_zone && (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-100">
                            Zone: {d.restricted_zone.name}
                          </span>
                        )}
                      </div>
                      <button onClick={() => handleDeleteDevice(d.id)} className="text-gray-400 hover:text-red-500 transition">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Zones Section */}
              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Restricted Zones ({zones.length})</h3>
                  <button onClick={() => setShowZoneModal(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
                    <Plus size={14} /> Create Zone
                  </button>
                </div>
                
                <div className="space-y-3">
                  {zones.map(z => (
                    <div key={z.id} className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800">{z.name}</p>
                          <button onClick={() => handleDeleteZone(z.id)} className="text-slate-400 hover:text-red-500 transition">
                            <X size={12} />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">{z.description || "No description provided."}</p>
                      </div>

                      {/* Grants List */}
                      <div className="w-full md:w-96 bg-white border border-slate-100 rounded-xl p-3 space-y-2 shadow-sm">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span>ACCESS GRANTS</span>
                          <button onClick={() => { setSelectedZone(z); setShowGrantModal(true); }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5">
                            <Plus size={12} /> Grant Access
                          </button>
                        </div>
                        {z.access_grants && z.access_grants.length > 0 ? (
                          <div className="space-y-1.5 max-h-28 overflow-y-auto">
                            {z.access_grants.map(grant => (
                              <div key={grant.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-[10px] border border-slate-100">
                                <div>
                                  <span className="font-bold text-slate-700 capitalize">{grant.grantee_type.toLowerCase()}: </span>
                                  <span className="text-slate-500 font-medium">{grant.grantee_id}</span>
                                </div>
                                <button onClick={() => handleDeleteGrant(grant.id)} className="text-slate-400 hover:text-red-500 transition">
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic text-center py-2">No active access grants</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            
            // TAB 3: VISITOR REGISTRY
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase">ACTIVE VISITORS ({visitors.filter(v => !v.checked_out_at).length})</h3>
                <button onClick={() => setShowVisitorModal(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1">
                  <Plus size={14} /> Register Visitor
                </button>
              </div>

              {visitors.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                  <Users size={36} className="mb-2 text-gray-200" />
                  <p className="text-xs">No visitor check-ins recorded</p>
                </div>
              ) : (
                <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                        <th className="p-3">Visitor Name</th>
                        <th className="p-3">Purpose</th>
                        <th className="p-3">Host Staff</th>
                        <th className="p-3">Check In</th>
                        <th className="p-3">Check Out</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visitors.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{v.visitor_name}</td>
                          <td className="p-3 text-slate-500">{v.purpose}</td>
                          <td className="p-3 text-slate-600">{v.host?.first_name} {v.host?.last_name}</td>
                          <td className="p-3 text-slate-400">{new Date(v.checked_in_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali" })}</td>
                          <td className="p-3 text-slate-400">
                            {v.checked_out_at ? (
                              new Date(v.checked_out_at).toLocaleTimeString("en-RW", { timeZone: "Africa/Kigali" })
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Active</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!v.checked_out_at && (
                              <button onClick={() => handleCheckoutVisitor(v.id)}
                                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-600 rounded-xl font-bold transition">
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

      </div>

      {/* DEVICE MODAL */}
      {showDeviceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">Register Gate Device</h3>
              <button onClick={() => setShowDeviceModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddDevice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Device Name *</label>
                <input value={deviceForm.name} onChange={(e) => setDeviceForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Science Lab Entry" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus *</label>
                  <select value={deviceForm.campus_id} onChange={(e) => setDeviceForm(f => ({ ...f, campus_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Location Type *</label>
                  <select value={deviceForm.location_type} onChange={(e) => setDeviceForm(f => ({ ...f, location_type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="MAIN_GATE">MAIN GATE</option>
                    <option value="CLASSROOM">CLASSROOM</option>
                    <option value="LIBRARY">LIBRARY</option>
                    <option value="CAFETERIA">CAFETERIA</option>
                    <option value="DORMITORY">DORMITORY</option>
                    <option value="RESTRICTED_ZONE">RESTRICTED ZONE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Restricted Zone (Optional)</label>
                <select value={deviceForm.zone_id} onChange={(e) => setDeviceForm(f => ({ ...f, zone_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                  <option value="">None / Public Area</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
                Register Device
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ZONE MODAL */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">Create Restricted Zone</h3>
              <button onClick={() => setShowZoneModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Zone Name *</label>
                <input value={zoneForm.name} onChange={(e) => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Server Room" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus *</label>
                <select value={zoneForm.campus_id} onChange={(e) => setZoneForm(f => ({ ...f, campus_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                  {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                <textarea value={zoneForm.description} onChange={(e) => setZoneForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition">
                Create Zone
              </button>
            </form>
          </div>
        </div>
      )}

      {/* GRANT MODAL */}
      {showGrantModal && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-800 font-sans">Grant Access to Zone</h3>
                <p className="text-[11px] text-gray-400">{selectedZone.name}</p>
              </div>
              <button onClick={() => setShowGrantModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddGrant} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Grantee Type *</label>
                  <select value={grantForm.grantee_type} onChange={(e) => setGrantForm(f => ({ ...f, grantee_type: e.target.value as "ROLE" | "USER" }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="ROLE">SYSTEM ROLE</option>
                    <option value="USER">SPECIFIC USER</option>
                  </select>
                </div>
                <div>
                  {grantForm.grantee_type === "ROLE" ? (
                    <>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Target Role *</label>
                      <select value={grantForm.grantee_id} onChange={(e) => setGrantForm(f => ({ ...f, grantee_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                        <option value="TEACHER">TEACHER</option>
                        <option value="NURSE">NURSE</option>
                        <option value="BURSAR">BURSAR</option>
                        <option value="DISCIPLINE">DISCIPLINE</option>
                        <option value="LIBRARIAN">LIBRARIAN</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="STUDENT">STUDENT (Public Access)</option>
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">User UUID *</label>
                      <input value={grantForm.grantee_id} onChange={(e) => setGrantForm(f => ({ ...f, grantee_id: e.target.value }))}
                        placeholder="Paste User ID..." required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Valid From *</label>
                  <input type="datetime-local" value={grantForm.valid_from} onChange={(e) => setGrantForm(f => ({ ...f, valid_from: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Valid To (Optional)</label>
                  <input type="datetime-local" value={grantForm.valid_to} onChange={(e) => setGrantForm(f => ({ ...f, valid_to: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition">
                Create Grant
              </button>
            </form>
          </div>
        </div>
      )}

      {/* VISITOR MODAL */}
      {showVisitorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-800">Register Visitor Check-In</h3>
              <button onClick={() => setShowVisitorModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleRegisterVisitor} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Visitor Name *</label>
                <input value={visitorForm.visitor_name} onChange={(e) => setVisitorForm(f => ({ ...f, visitor_name: e.target.value }))}
                  placeholder="e.g. John Doe" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">ID Document Ref</label>
                  <input value={visitorForm.id_document_ref} onChange={(e) => setVisitorForm(f => ({ ...f, id_document_ref: e.target.value }))}
                    placeholder="National ID / Passport"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Campus *</label>
                  <select value={visitorForm.campusId} onChange={(e) => setVisitorForm(f => ({ ...f, campusId: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                    {campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Purpose of Visit *</label>
                <input value={visitorForm.purpose} onChange={(e) => setVisitorForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Parents Meeting, Maintenance" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              
              {/* Host Search */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Find Host Staff *</label>
                {!selectedHost ? (
                  <div className="relative">
                    <input value={visitorSearchHost} onChange={(e) => { setVisitorSearchHost(e.target.value); searchHosts(e.target.value); }}
                      placeholder="Type host name..." required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 pr-8" />
                    {searchingHost && <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                    {hostSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 border border-gray-200 rounded-xl bg-white shadow-lg max-h-40 overflow-y-auto z-10">
                        {hostSearchResults.map(h => (
                          <button key={h.id} type="button" onClick={() => { setSelectedHost(h); setHostSearchResults([]); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left border-b border-gray-50 last:border-0 text-xs">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">{h.user.first_name[0]}</div>
                            <div>
                              <p className="font-semibold text-gray-700">{h.user.first_name} {h.user.last_name}</p>
                              <p className="text-[10px] text-gray-400 capitalize">Teacher</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{selectedHost.user.first_name} {selectedHost.user.last_name}</p>
                      <p className="text-[10px] text-slate-500 capitalize font-medium text-slate-400">Teacher</p>
                    </div>
                    <button onClick={() => setSelectedHost(null)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Expected Checkout</label>
                <input type="datetime-local" value={visitorForm.expected_checkout_at} onChange={(e) => setVisitorForm(f => ({ ...f, expected_checkout_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>

              <button type="submit" disabled={!selectedHost}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white rounded-xl text-sm font-semibold transition mt-2 shadow-md">
                Register & Check In
              </button>
            </form>
          </div>
        </div>
      )}

    </DashboardShell>
  );
}
