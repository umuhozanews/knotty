"use client";

import React, { useState, useEffect } from "react";
import DashboardShell from "@/components/DashboardShell";
import { useNFC } from "@/hooks/useNFC";
import { 
  Wifi, 
  CreditCard, 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  Search, 
  FileSpreadsheet, 
  Code,
  LogIn,
  LogOut,
  UserCheck
} from "lucide-react";

interface LocalStudent {
  id: string;
  first_name: string;
  last_name: string;
  student_code: string;
  class_name: string;
  card_number: string;
  nfc_uid: string | null;
  wallet_balance: number;
  is_frozen: boolean;
}

interface AttendanceLog {
  id: string;
  student_id: string;
  student_name: string;
  card_number: string;
  action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT";
  status: "PRESENT" | "LATE";
  check_in_time: string;
  check_out_time: string | null;
  timestamp: string;
}

const INITIAL_STUDENTS: LocalStudent[] = [
  { id: "1", first_name: "Jean", last_name: "Mugabo", student_code: "STU-2026-001", class_name: "Senior 4 Science A", card_number: "KNT-8492-1001", nfc_uid: "04A3B2C1D0", wallet_balance: 5000, is_frozen: false },
  { id: "2", first_name: "Aline", last_name: "Uwase", student_code: "STU-2026-002", class_name: "Senior 4 Science A", card_number: "KNT-8492-1002", nfc_uid: "04F5E6D7C8", wallet_balance: 12000, is_frozen: false },
  { id: "3", first_name: "Eric", last_name: "Manzi", student_code: "STU-2026-003", class_name: "Senior 5 Arts B", card_number: "KNT-8492-1003", nfc_uid: "0411223344", wallet_balance: 1500, is_frozen: false },
];

export default function StandaloneTapPage() {
  const { scan, isSupported } = useNFC();

  const [tab, setTab] = useState<"terminal" | "grant" | "logs" | "api">("terminal");
  const [students, setStudents] = useState<LocalStudent[]>(INITIAL_STUDENTS);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [cardInput, setCardInput] = useState("");
  const [lastTapResult, setLastTapResult] = useState<any>(null);
  const [webhookLogs, setWebhookLogs] = useState<string[]>([]);

  // Registration state
  const [regForm, setRegForm] = useState({
    fname: "",
    lname: "",
    code: "",
    className: "",
    wallet: "5000",
    nfcUid: ""
  });

  const [dirSearch, setDirSearch] = useState("");

  useEffect(() => {
    const savedSt = localStorage.getItem("ishuri_standalone_students") || localStorage.getItem("knotty_standalone_students");
    const savedLog = localStorage.getItem("ishuri_standalone_logs") || localStorage.getItem("knotty_standalone_logs");
    if (savedSt) setStudents(JSON.parse(savedSt));
    if (savedLog) setLogs(JSON.parse(savedLog));
  }, []);

  const saveState = (updatedStudents: LocalStudent[], updatedLogs: AttendanceLog[]) => {
    setStudents(updatedStudents);
    setLogs(updatedLogs);
    localStorage.setItem("ishuri_standalone_students", JSON.stringify(updatedStudents));
    localStorage.setItem("ishuri_standalone_logs", JSON.stringify(updatedLogs));
  };

  // Sound Synthesizer
  const playChime = (type: "IN" | "OUT" | "ERROR") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "IN") {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      } else if (type === "OUT") {
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        osc.frequency.setValueAtTime(440.00, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      } else {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  };

  // Core Tap Processing Logic
  const handleTap = (query: string) => {
    const term = query.trim().toUpperCase();
    if (!term) return;

    const student = students.find(
      (s) => s.card_number.toUpperCase() === term || (s.nfc_uid && s.nfc_uid.toUpperCase() === term)
    );

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    if (!student) {
      playChime("ERROR");
      setLastTapResult({ error: "CARD_NOT_FOUND", term });
      logWebhook({ error: "CARD_NOT_FOUND", query: term });
      return;
    }

    if (student.is_frozen) {
      playChime("ERROR");
      setLastTapResult({ error: "CARD_FROZEN", student });
      logWebhook({ error: "CARD_FROZEN", card_number: student.card_number, student_id: student.id });
      return;
    }

    const existingLog = logs.find((l) => l.student_id === student.id);
    let action: "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" = "TAP_IN";
    let punctuality: "PRESENT" | "LATE" = "PRESENT";

    let updatedLogs = [...logs];

    if (!existingLog) {
      const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() >= 30);
      punctuality = isLate ? "LATE" : "PRESENT";
      action = "TAP_IN";

      const newLog: AttendanceLog = {
        id: Date.now().toString(),
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        card_number: student.card_number,
        action: "TAP_IN",
        status: punctuality,
        check_in_time: timeStr,
        check_out_time: null,
        timestamp: now.toISOString(),
      };
      updatedLogs = [newLog, ...logs];
      playChime("IN");
    } else if (existingLog && !existingLog.check_out_time) {
      action = "TAP_OUT";
      updatedLogs = logs.map((l) =>
        l.student_id === student.id ? { ...l, check_out_time: timeStr, action: "TAP_OUT" as const } : l
      );
      playChime("OUT");
    } else {
      action = "ALREADY_OUT";
      playChime("ERROR");
    }

    saveState(students, updatedLogs);
    setLastTapResult({ student, action, punctuality, timeStr });
    logWebhook({
      event: "CARD_TAP_EVENT",
      action,
      student_id: student.id,
      student_name: `${student.first_name} ${student.last_name}`,
      card_number: student.card_number,
      nfc_uid: student.nfc_uid,
      timestamp: now.toISOString(),
    });
  };

  const logWebhook = (data: any) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${JSON.stringify(data)}`;
    setWebhookLogs((prev) => [entry, ...prev.slice(0, 20)]);
  };

  const triggerNFCScan = async () => {
    const res = await scan();
    if (res) handleTap(res.value);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCardNo = `KNT-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newStudent: LocalStudent = {
      id: Date.now().toString(),
      first_name: regForm.fname,
      last_name: regForm.lname,
      student_code: regForm.code,
      class_name: regForm.className,
      card_number: newCardNo,
      nfc_uid: regForm.nfcUid.toUpperCase() || null,
      wallet_balance: parseInt(regForm.wallet) || 0,
      is_frozen: false,
    };

    const updatedStudents = [newStudent, ...students];
    saveState(updatedStudents, logs);

    setRegForm({ fname: "", lname: "", code: "", className: "", wallet: "5000", nfcUid: "" });
    setTab("terminal");
    handleTap(newCardNo);
  };

  const toggleFreeze = (id: string) => {
    const updated = students.map((s) => (s.id === id ? { ...s, is_frozen: !s.is_frozen } : s));
    saveState(updated, logs);
  };

  const tapIns = logs.filter((l) => l.action === "TAP_IN").length;
  const tapOuts = logs.filter((l) => l.action === "TAP_OUT").length;
  const lates = logs.filter((l) => l.status === "LATE").length;

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        {/* Header Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-white/10 text-white">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="text-blue-400" /> Ishuri hub Standalone Tap Terminal & Card Granting
            </h1>
            <p className="text-xs text-gray-400">Self-contained card registration, tap-in / tap-out state machine, & logs</p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10 text-xs font-semibold">
            <button
              onClick={() => setTab("terminal")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${tab === "terminal" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <Wifi size={14} /> Tap Terminal
            </button>
            <button
              onClick={() => setTab("grant")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${tab === "grant" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <UserPlus size={14} /> Grant Card
            </button>
            <button
              onClick={() => setTab("logs")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${tab === "logs" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <Clock size={14} /> Attendance Logs
            </button>
            <button
              onClick={() => setTab("api")}
              className={`px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition ${tab === "api" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              <Code size={14} /> 3rd-Party Specs
            </button>
          </div>
        </div>

        {/* KPI Counter Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Total Cards Granted</p>
              <p className="text-2xl font-bold text-white mt-1">{students.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
          </div>

          <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Today's Tap-Ins</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{tapIns}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <LogIn size={20} />
            </div>
          </div>

          <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Today's Tap-Outs</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{tapOuts}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <LogOut size={20} />
            </div>
          </div>

          <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Late Arrivals Today</p>
              <p className="text-2xl font-bold text-rose-400 mt-1">{lates}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* TAB 1: TAP TERMINAL */}
        {tab === "terminal" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Wifi className="text-blue-400" /> Live Gate Reader Terminal
                    </h2>
                    <p className="text-xs text-gray-400">Scan card number, NFC hardware UID, or test with quick cards below</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">
                    Terminal Ready
                  </span>
                </div>

                <div className="p-8 border-2 border-dashed border-blue-500/30 bg-slate-950/60 rounded-2xl flex flex-col items-center text-center space-y-4">
                  <button
                    onClick={triggerNFCScan}
                    className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 transition"
                  >
                    <Wifi size={32} />
                  </button>
                  <p className="text-sm font-semibold text-white">Tap Card / Scan Hardware Reader</p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleTap(cardInput);
                      setCardInput("");
                    }}
                    className="w-full max-w-md flex gap-2"
                  >
                    <input
                      type="text"
                      value={cardInput}
                      onChange={(e) => setCardInput(e.target.value)}
                      placeholder="Scan Card # (e.g. KNT-8492-1001)..."
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none focus:border-blue-500"
                    />
                    <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl">
                      Tap
                    </button>
                  </form>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <span className="text-xs text-gray-500">Quick Test Cards:</span>
                    {students.slice(0, 4).map((st) => (
                      <button
                        key={st.id}
                        onClick={() => handleTap(st.card_number)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-gray-300 rounded-lg border border-white/10"
                      >
                        {st.first_name} ({st.card_number})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Webhook JSON Stream */}
              <div className="bg-slate-900 border border-white/10 p-4 rounded-2xl space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  External System Real-time Webhook Event Stream
                </h3>
                <div className="h-32 bg-slate-950 p-3 rounded-xl border border-white/5 font-mono text-xs text-gray-300 overflow-y-auto space-y-1">
                  {webhookLogs.length === 0 ? (
                    <p className="text-gray-600">// Webhook payloads will stream here on card tap...</p>
                  ) : (
                    webhookLogs.map((log, idx) => <p key={idx}>{log}</p>)
                  )}
                </div>
              </div>
            </div>

            {/* Tap Result Display */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl h-full flex flex-col justify-between">
                {lastTapResult ? (
                  lastTapResult.error ? (
                    <div className="text-center py-10 space-y-3 my-auto">
                      <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                        <AlertTriangle size={28} />
                      </div>
                      <h3 className="text-lg font-bold text-white">Tap Error: {lastTapResult.error}</h3>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          {lastTapResult.action === "TAP_IN" ? "CHECKED IN (TAP IN)" : "CHECKED OUT (TAP OUT)"}
                        </span>
                        <span className="text-xs font-mono text-gray-400">{lastTapResult.timeStr}</span>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white">
                          {lastTapResult.student.first_name} {lastTapResult.student.last_name}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {lastTapResult.student.class_name} · <span className="font-mono text-blue-400">{lastTapResult.student.student_code}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-950 rounded-xl border border-white/5">
                          <p className="text-gray-400">Card Number</p>
                          <p className="font-mono font-bold text-white mt-1">{lastTapResult.student.card_number}</p>
                        </div>
                        <div className="p-3 bg-slate-950 rounded-xl border border-white/5">
                          <p className="text-gray-400">Wallet Balance</p>
                          <p className="font-mono font-bold text-emerald-400 mt-1">{lastTapResult.student.wallet_balance.toLocaleString()} RWF</p>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-center py-12 text-gray-400 space-y-2 my-auto">
                    <UserCheck size={36} className="mx-auto text-gray-600" />
                    <p className="text-sm font-semibold text-white">Awaiting Card Tap</p>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">Tap any student card to trigger real-time tap-in/tap-out attendance check.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GRANT CARD */}
        {tab === "grant" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="text-blue-400" /> Register Student & Issue Ishuri hub Card
              </h2>

              <form onSubmit={handleRegisterSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  required
                  placeholder="First Name"
                  value={regForm.fname}
                  onChange={(e) => setRegForm({ ...regForm, fname: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Last Name"
                  value={regForm.lname}
                  onChange={(e) => setRegForm({ ...regForm, lname: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Student Code (e.g. STU-2026-010)"
                  value={regForm.code}
                  onChange={(e) => setRegForm({ ...regForm, code: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  required
                  placeholder="Class / Grade"
                  value={regForm.className}
                  onChange={(e) => setRegForm({ ...regForm, className: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <input
                  type="text"
                  placeholder="Physical NFC Hardware UID (Optional)"
                  value={regForm.nfcUid}
                  onChange={(e) => setRegForm({ ...regForm, nfcUid: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none focus:border-blue-500"
                />
                <input
                  type="number"
                  placeholder="Initial Wallet Balance (RWF)"
                  value={regForm.wallet}
                  onChange={(e) => setRegForm({ ...regForm, wallet: e.target.value })}
                  className="bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono outline-none focus:border-blue-500"
                />
                <div className="md:col-span-2">
                  <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition">
                    Grant Card & Register Student
                  </button>
                </div>
              </form>
            </div>

            {/* Issued Cards Directory */}
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Issued Cards Directory</h3>
                <input
                  type="text"
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                  placeholder="Search students..."
                  className="bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-white/10 uppercase">
                      <th className="pb-3">Student</th>
                      <th className="pb-3">Card Number</th>
                      <th className="pb-3">NFC Hardware UID</th>
                      <th className="pb-3">Balance</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {students
                      .filter((s) => s.first_name.toLowerCase().includes(dirSearch.toLowerCase()) || s.card_number.toLowerCase().includes(dirSearch.toLowerCase()))
                      .map((s) => (
                        <tr key={s.id}>
                          <td className="py-3 font-medium text-white">{s.first_name} {s.last_name}</td>
                          <td className="py-3 font-mono text-blue-400">{s.card_number}</td>
                          <td className="py-3 font-mono text-emerald-400">{s.nfc_uid || "Not linked"}</td>
                          <td className="py-3 font-mono">{s.wallet_balance.toLocaleString()} RWF</td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.is_frozen ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                              {s.is_frozen ? "Frozen" : "Active"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button onClick={() => toggleFreeze(s.id)} className="px-2.5 py-1 text-xs border rounded-lg border-white/10 hover:bg-white/5">
                              {s.is_frozen ? "Unfreeze" : "Freeze"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LOGS */}
        {tab === "logs" && (
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">Today's Tap History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-white/10 uppercase">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Student Name</th>
                    <th className="pb-3">Card Number</th>
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300 font-mono">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">No attendance taps recorded today yet.</td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id}>
                        <td className="py-3 text-gray-400">{l.check_in_time}</td>
                        <td className="py-3 font-sans font-semibold text-white">{l.student_name}</td>
                        <td className="py-3 text-blue-400">{l.card_number}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.action === "TAP_IN" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                            {l.action}
                          </span>
                        </td>
                        <td className="py-3 text-emerald-400">{l.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: API SPECS */}
        {tab === "api" && (
          <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl space-y-4">
            <h2 className="text-lg font-bold text-white">3rd-Party System Integration Specs</h2>
            <p className="text-xs text-gray-400">External gate hardware or POS terminals scan cards via <code className="text-blue-400">POST /api/v1/cards/scan-external</code></p>
            <pre className="bg-slate-950 p-4 rounded-xl border border-white/5 text-xs font-mono text-gray-300 overflow-x-auto">
{`// Sample External Card Scan Payload
{
  "card_identifier": "04A3B2C1D0", // Can be nfc_uid OR card_number
  "reader_location": "GATE_TURNSTILE_1",
  "requested_action": "AUTO"
}`}
            </pre>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
