"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Wifi, CheckCircle, XCircle, Clock, MinusCircle,
  Radio, StopCircle, CreditCard, Settings, X, LogIn, LogOut, AlertTriangle,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import KnottyCard from "@/components/KnottyCard";
import {
  attendance, cards, structure, Class,
  AttendanceTodaySummary, CardScanFull, AttendanceSettings,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";

type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type TapAction = "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "BLOCKED";

interface ScanLogEntry {
  id: string;
  name: string;
  className: string;
  action: TapAction;
  time: string;
  photo: string | null;
}

interface ClassStudent {
  id: string;
  student_code: string;
  user: { first_name: string; last_name: string; profile_photo: string | null };
  card: { wallet_balance: number; is_active: boolean } | null;
}

const STATUS_CFG: Record<AttStatus, { label: string; color: string; dot: string }> = {
  PRESENT: { label: "Present", color: "bg-green-500 text-white",   dot: "bg-green-500" },
  ABSENT:  { label: "Absent",  color: "bg-red-500 text-white",     dot: "bg-red-500" },
  LATE:    { label: "Late",    color: "bg-orange-500 text-white",  dot: "bg-orange-500" },
  EXCUSED: { label: "Excused", color: "bg-blue-500 text-white",   dot: "bg-blue-500" },
};

const ACTION_CFG: Record<TapAction, { label: string; color: string; bg: string; border: string; glow: "green" | "blue" | "orange" | "red" | null }> = {
  TAP_IN:      { label: "Tapped In",   color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  glow: "green"  },
  TAP_OUT:     { label: "Tapped Out",  color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   glow: "blue"   },
  ALREADY_OUT: { label: "Already Out", color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",   glow: null     },
  BLOCKED:     { label: "Too Early",   color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", glow: "orange" },
};

function Avatar({ name, photo, size = 8 }: { name: string; photo: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 37 % 360;
  if (photo) return <img src={photo} className={`w-${size} h-${size} rounded-full object-cover`} alt="" />;
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
      style={{ background: `hsl(${hue}, 60%, 55%)` }}>
      {initials}
    </div>
  );
}

function fmtTime(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
}

export default function AttendancePage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, error: nfcError, isSupported } = useNFC();

  const [mode, setMode] = useState<"tap" | "bulk">("tap");

  // ── Tap mode ─────────────────────────────────────────────────
  const [cardInput, setCardInput]   = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardData, setCardData]     = useState<CardScanFull | null>(null);
  const [tapLoading, setTapLoading] = useState(false);
  const [tapping, setTapping]       = useState(false);
  const [tapResult, setTapResult]   = useState<{ action: TapAction; message: string } | null>(null);
  const [glowColor, setGlowColor]   = useState<"green" | "blue" | "orange" | "red" | null>(null);
  const [scanLog, setScanLog]       = useState<ScanLogEntry[]>([]);
  const [todaySummary, setTodaySummary] = useState({ PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 });
  const [totalToday, setTotalToday] = useState(0);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Settings ──────────────────────────────────────────────────
  const [showSettings, setShowSettings]   = useState(false);
  const [settings, setSettings]           = useState<AttendanceSettings>({ tap_out_after_minutes: 180, school_start_time: "08:30" });
  const [savingSettings, setSavingSettings] = useState(false);

  // ── Bulk mode ────────────────────────────────────────────────
  const [classes, setClasses]             = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [date, setDate]                   = useState(new Date().toISOString().slice(0, 10));
  const [scanType, setScanType]           = useState<"IN" | "OUT">("IN");
  const [tapInStart, setTapInStart]       = useState("07:00");
  const [tapInEnd, setTapInEnd]           = useState("08:30");
  const [tapOutStart, setTapOutStart]     = useState("15:00");
  const [tapOutEnd, setTapOutEnd]         = useState("17:00");
  const [scanning, setScanning]           = useState(false);
  const qrScannerRef = useRef<any | null>(null);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [statuses, setStatuses]           = useState<Record<string, AttStatus>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  useEffect(() => {
    if (authLoading) return;
    structure.classes().then((r) => setClasses(r.data)).catch(console.error);
    loadTodaySummary();
    attendance.getSettings().then((r) => setSettings(r.data)).catch(() => {});
  }, [authLoading]);

  useEffect(() => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    structure.classStudents(selectedClass)
      .then((r) => { setClassStudents(r.data as ClassStudent[]); setStatuses({}); setSubmitted(false); })
      .catch(console.error)
      .finally(() => setLoadingStudents(false));
  }, [selectedClass]);

  function loadTodaySummary() {
    attendance.todaySummary().then((r) => {
      setTodaySummary(r.summary);
      setTotalToday(r.total);
    }).catch(() => {});
  }

  async function executeScan(cardNumber: string) {
    setCardLoading(true);
    setCardData(null);
    setTapResult(null);
    setGlowColor(null);

    const scanOptions = {
      type: scanType,
      date,
      tapInStart,
      tapInEnd,
      tapOutStart,
      tapOutEnd,
    };

    try {
      const res = await attendance.scan(cardNumber, scanOptions);
      const rec = res.data;
      const action = rec.action ?? "TAP_IN";

      const fresh = await cards.scan(cardNumber);
      setCardData(fresh.data);
      setGlowColor(ACTION_CFG[action].glow);
      setTapResult({
        action,
        message:
          action === "TAP_IN"
            ? `Tapped in at ${fmtTime(rec.check_in_time)}.`
            : action === "TAP_OUT"
            ? `Tapped out at ${fmtTime(rec.check_out_time)}.`
            : "Already tapped out for today.",
      });

      const name = fresh.data.student.name;
      const logEntry: ScanLogEntry = {
        id: Date.now().toString(),
        name,
        className: fresh.data.student.class,
        action,
        time: fmtTime(new Date().toISOString()),
        photo: fresh.data.student.photo,
      };
      setScanLog((l) => [logEntry, ...l.slice(0, 49)]);
      loadTodaySummary();
      toast(`${name} — ${ACTION_CFG[action].label}`, action === "TAP_IN" ? "success" : "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setGlowColor("red");
      toast(msg, "error");
    } finally {
      setCardLoading(false);
    }
  }

  async function lookupCard(num: string, isNfc = false) {
    const n = num.trim();
    if (!n) return;
    setCardLoading(true);
    setCardData(null);
    setTapResult(null);
    setGlowColor(null);

    const scanOptions = {
      type: scanType,
      date,
      tapInStart,
      tapInEnd,
      tapOutStart,
      tapOutEnd,
    };

    if (n.startsWith("eyJ")) {
      try {
        const res = await attendance.scanSecure(n, scanOptions);
        const rec = res.data;
        const action = rec.action ?? "TAP_IN";
        const card_number = rec.card_number;
        if (!card_number) {
          throw new Error("No card number returned from secure scan.");
        }

        // Fetch fresh card detail for visual presentation
        const fresh = await cards.scan(card_number);
        setCardData(fresh.data);
        setGlowColor(ACTION_CFG[action].glow);
        setTapResult({
          action,
          message:
            action === "TAP_IN"
              ? `Tapped in at ${fmtTime(rec.check_in_time)}.`
              : action === "TAP_OUT"
              ? `Tapped out at ${fmtTime(rec.check_out_time)}.`
              : "Already tapped out for today.",
        });

        const name = `${fresh.data.student.name}`;
        const logEntry: ScanLogEntry = {
          id: Date.now().toString(),
          name,
          className: fresh.data.student.class,
          action,
          time: fmtTime(new Date().toISOString()),
          photo: fresh.data.student.photo,
        };
        setScanLog((l) => [logEntry, ...l.slice(0, 49)]);
        loadTodaySummary();
        toast(`${name} — ${ACTION_CFG[action].label} (Secure Pass)`, action === "TAP_IN" ? "success" : "info");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Secure Scan failed";
        setGlowColor("red");
        toast(msg, "error");
      } finally {
        setCardLoading(false);
      }
      return;
    }

    try {
      const res = isNfc
        ? (await cards.scanNFC(n)) as unknown as { success: boolean; data: CardScanFull }
        : await cards.scan(n);
      setCardData(res.data);
      if (res.data.check_in_time && !res.data.check_out_time) setGlowColor("blue");
      if (isNfc) {
        await executeScan(res.data.card_number);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Card not found", "error");
    } finally {
      setCardLoading(false);
    }
  }

  async function doTap() {
    if (!cardData || tapLoading) return;
    setTapping(true);
    setTapLoading(true);
    setTapResult(null);
    await new Promise((r) => setTimeout(r, 120));

    const scanOptions = {
      type: scanType,
      date,
      tapInStart,
      tapInEnd,
      tapOutStart,
      tapOutEnd,
    };

    try {
      const res = await attendance.scan(cardData.card_number, scanOptions);
      const rec = res.data;
      const action = rec.action ?? "TAP_IN";

      setGlowColor(ACTION_CFG[action].glow);
      setTapResult({
        action,
        message:
          action === "TAP_IN"
            ? `Tapped in at ${fmtTime(rec.check_in_time)}.`
            : action === "TAP_OUT"
            ? `Tapped out at ${fmtTime(rec.check_out_time)}.`
            : "Already tapped out for today.",
      });

      const fresh = await cards.scan(cardData.card_number);
      setCardData(fresh.data);

      const logEntry: ScanLogEntry = {
        id: Date.now().toString(),
        name: cardData.student.name,
        className: cardData.student.class,
        action,
        time: fmtTime(new Date().toISOString()),
        photo: cardData.student.photo,
      };
      setScanLog((l) => [logEntry, ...l.slice(0, 49)]);
      loadTodaySummary();
      toast(`${cardData.student.name} — ${ACTION_CFG[action].label}`, action === "TAP_IN" ? "success" : "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tap failed";
      const isBlocked = msg.toLowerCase().includes("tap-out") || msg.toLowerCase().includes("come back");
      if (isBlocked) {
        setGlowColor("orange");
        setTapResult({ action: "BLOCKED", message: msg });
      } else {
        setGlowColor("red");
        toast(msg, "error");
      }
    } finally {
      setTapping(false);
      setTapLoading(false);
      if (glowTimer.current) clearTimeout(glowTimer.current);
      glowTimer.current = setTimeout(() => setGlowColor(null), 4000);
    }
  }

  const handleScanResult = useCallback(async (decodedText: string) => {
    let n = decodedText.trim();
    if (n.startsWith('"') && n.endsWith('"')) {
      n = n.slice(1, -1);
    }
    if (!n) return;
    if (n.startsWith("eyJ")) {
      await lookupCard(n);
    } else {
      await executeScan(n);
    }
  }, [scanType, date, tapInStart, tapInEnd, tapOutStart, tapOutEnd]);

  const startScanner = async () => {
    setScanning(true);
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
      } catch { /* ignore */ }
    }
    const { Html5Qrcode } = await import("html5-qrcode");
    const html5Qrcode = new Html5Qrcode("reader");
    qrScannerRef.current = html5Qrcode;

    try {
      await html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          }
        },
        async (decodedText) => {
          await handleScanResult(decodedText);
        },
        () => { /* ignore normal fail frames */ }
      );
    } catch (err) {
      toast("Camera access failed", "error");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch (err) {
        console.error(err);
      }
      qrScannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function toggleNFCListen() {
    if (listening) { stopListen(); toast("NFC scanner stopped", "info"); return; }
    const ok = await startListen(async (result) => {
      const num = result.value;
      setCardInput(num);
      await lookupCard(num, result.type === "uid");
    });
    if (ok) toast("NFC scanner active — tap a KNOTTY card", "info");
  }

  async function handleBulkSubmit() {
    if (!selectedClass) return;
    const records = classStudents.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? "ABSENT" }));
    setSubmitting(true);
    try {
      const res = await attendance.bulk(selectedClass, records);
      setSubmitted(true);
      toast(`Attendance saved — ${res.count} students marked`, "success");
      loadTodaySummary();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const res = await attendance.updateSettings(settings);
      setSettings(res.data);
      toast("Settings saved", "success");
      setShowSettings(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  const tapState = !cardData
    ? "idle"
    : cardData.is_frozen
    ? "frozen"
    : cardData.check_out_time
    ? "done"
    : cardData.check_in_time
    ? "tap_out"
    : "tap_in";

  return (
    <DashboardShell>
      <div className="p-2 sm:p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Attendance</h1>
            <p className="text-sm text-gray-400">Tap-in / Tap-out &amp; bulk marking</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border transition ${showSettings ? "bg-blue-50 border-blue-300/30 text-blue-600" : "bg-white border-gray-200 text-gray-400 hover:text-gray-600"}`}
            >
              <Settings size={16} />
            </button>
            <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm">
              <button onClick={() => setMode("tap")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${mode === "tap" ? "bg-blue-50 text-blue-600" : "text-gray-500"}`}>
                Tap Card
              </button>
              <button onClick={() => setMode("bulk")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${mode === "bulk" ? "bg-blue-50 text-blue-600" : "text-gray-500"}`}>
                Bulk Mark
              </button>
            </div>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="bg-white rounded-2xl shadow-sm p-4 border border-blue-200/60">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-700">Attendance Settings</p>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Tap-out delay (minutes)</label>
                <input
                  type="number" min={0} max={720}
                  value={settings.tap_out_after_minutes}
                  onChange={(e) => setSettings((s) => ({ ...s, tap_out_after_minutes: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Min time between tap-in and tap-out</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">School start time</label>
                <input
                  type="time"
                  value={settings.school_start_time}
                  onChange={(e) => setSettings((s) => ({ ...s, school_start_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Arrivals after this time are marked Late</p>
              </div>
            </div>
            <button
              onClick={saveSettings} disabled={savingSettings}
              className="mt-4 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2"
            >
              {savingSettings && <Loader2 size={14} className="animate-spin" />}
              Save Settings
            </button>
          </div>
        )}

        <div className="flex gap-4 flex-col lg:flex-row">
          {/* Left panel */}
          <div className="flex-1 min-w-0">
            {mode === "tap" ? (
              <div className="space-y-3">
                {/* Gate scan config controls */}
                <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Attendance Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Active Scan Mode</label>
                    <div className="flex bg-gray-100 rounded-xl p-1">
                      <button
                        onClick={() => setScanType("IN")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${scanType === "IN" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        TAP IN
                      </button>
                      <button
                        onClick={() => setScanType("OUT")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${scanType === "OUT" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        TAP OUT
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={scanning ? stopScanner : startScanner}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all border
                        ${scanning 
                          ? "bg-red-50 border-red-200 text-red-500 hover:bg-red-100" 
                          : "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"}`}
                    >
                      <div className={`w-2 h-2 rounded-full ${scanning ? "bg-red-500 animate-ping" : "bg-blue-500"}`} />
                      {scanning ? "STOP WEBCAM SCANNER" : "START WEBCAM SCANNER"}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tap-In Start</label>
                    <input
                      type="time"
                      value={tapInStart}
                      onChange={(e) => setTapInStart(e.target.value)}
                      className="w-full border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tap-In End</label>
                    <input
                      type="time"
                      value={tapInEnd}
                      onChange={(e) => setTapInEnd(e.target.value)}
                      className="w-full border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tap-Out Start</label>
                    <input
                      type="time"
                      value={tapOutStart}
                      onChange={(e) => setTapOutStart(e.target.value)}
                      className="w-full border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Tap-Out End</label>
                    <input
                      type="time"
                      value={tapOutEnd}
                      onChange={(e) => setTapOutEnd(e.target.value)}
                      className="w-full border border-gray-150 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {scanning && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-3">
                    <p className="text-xs font-semibold text-gray-500">Hold QR Pass up to the Camera</p>
                    <div id="reader" className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-100" />
                  </div>
                )}

                {/* Card search bar */}
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2">Scan or enter card number</p>
                  <form onSubmit={(e) => { e.preventDefault(); lookupCard(cardInput); }} className="flex gap-2">
                    <input
                      value={cardInput}
                      onChange={(e) => setCardInput(e.target.value)}
                      placeholder="KNT-XXX-2026-00001"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit" disabled={cardLoading || !cardInput.trim()}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {cardLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                      Lookup
                    </button>
                    {isSupported && (
                      <button
                        type="button" onClick={toggleNFCListen}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 border transition
                          ${listening
                            ? "bg-red-50 text-red-500 border-red-200"
                            : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                          }`}
                      >
                        {listening ? <StopCircle size={14} /> : <Wifi size={14} />}
                        {listening ? "Stop" : "NFC"}
                      </button>
                    )}
                  </form>
                  {listening && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-600">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                      NFC scanner active — tap a KNOTTY card
                    </div>
                  )}
                  {nfcError && <p className="mt-1 text-xs text-red-500">{nfcError}</p>}
                </div>

                {/* Card display + tap */}
                {cardLoading ? (
                  <div className="bg-white rounded-2xl shadow-sm p-10 flex justify-center">
                    <Loader2 size={28} className="animate-spin text-blue-600" />
                  </div>
                ) : cardData ? (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    {/* Virtual card */}
                    <div className="flex justify-center mb-5">
                      <KnottyCard card={cardData} glowColor={glowColor} tapping={tapping} />
                    </div>

                    {/* Result banner */}
                    {tapResult && (
                      <div className={`mb-4 flex items-start gap-3 p-3 rounded-xl border ${ACTION_CFG[tapResult.action].bg} ${ACTION_CFG[tapResult.action].border}`}>
                        {tapResult.action === "TAP_IN"      && <CheckCircle   size={16} className="text-green-500  mt-0.5 flex-shrink-0" />}
                        {tapResult.action === "TAP_OUT"     && <LogOut        size={16} className="text-blue-500   mt-0.5 flex-shrink-0" />}
                        {tapResult.action === "ALREADY_OUT" && <MinusCircle   size={16} className="text-gray-400   mt-0.5 flex-shrink-0" />}
                        {tapResult.action === "BLOCKED"     && <AlertTriangle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${ACTION_CFG[tapResult.action].color}`}>
                            {ACTION_CFG[tapResult.action].label}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{tapResult.message}</p>
                        </div>
                      </div>
                    )}

                    {/* TAP button */}
                    <button
                      onClick={doTap}
                      disabled={tapLoading || tapState === "idle" || tapState === "frozen" || tapState === "done"}
                      className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200
                        ${tapState === "tap_in"  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100" : ""}
                        ${tapState === "tap_out" ? "bg-blue-500  text-white hover:bg-blue-600  shadow-lg shadow-blue-100"   : ""}
                        ${tapState === "done"    ? "bg-gray-100  text-gray-400 cursor-not-allowed" : ""}
                        ${tapState === "frozen"  ? "bg-blue-50   text-blue-400 cursor-not-allowed" : ""}
                        ${tapState === "idle"    ? "bg-gray-50   text-gray-300 cursor-not-allowed" : ""}
                        ${tapping ? "scale-95" : "scale-100"}
                      `}
                    >
                      {tapLoading         ? <Loader2    size={20} className="animate-spin" /> :
                       tapState === "tap_in"  ? <><LogIn    size={20} />TAP IN</>  :
                       tapState === "tap_out" ? <><LogOut   size={20} />TAP OUT</> :
                       tapState === "done"    ? <><CheckCircle size={20} />Completed Today</> :
                       tapState === "frozen"  ? <><XCircle    size={20} />Card Frozen</> :
                                               <><CreditCard  size={20} />Scan a Card First</>}
                    </button>

                    {/* Status strip */}
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2">
                      <span>
                        Status:{" "}
                        <span className="font-medium text-gray-600">
                          {cardData.check_out_time ? "Tapped Out" : cardData.check_in_time ? "Tapped In" : "Not yet"}
                        </span>
                      </span>
                      {cardData.check_in_time && !cardData.check_out_time && cardData.tap_out_available_at && (
                        <span>Tap-out available at <span className="font-medium text-blue-600">{fmtTime(cardData.tap_out_available_at)}</span></span>
                      )}
                      {cardData.check_in_time  && <span>In: <span className="font-medium text-gray-600">{fmtTime(cardData.check_in_time)}</span></span>}
                      {cardData.check_out_time && <span>Out: <span className="font-medium text-gray-600">{fmtTime(cardData.check_out_time)}</span></span>}
                    </div>

                    <button
                      onClick={() => { setCardData(null); setCardInput(""); setTapResult(null); setGlowColor(null); }}
                      className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition"
                    >
                      Clear — scan another card
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                      <CreditCard size={36} className="text-gray-200" />
                    </div>
                    <p className="font-semibold text-gray-400 text-sm">No card loaded</p>
                    <p className="text-xs text-gray-300">
                      Type a card number above and click Lookup,<br />
                      or tap an NFC card to load automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Bulk mark mode */
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                <div className="flex gap-3">
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Select class...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.level?.name} {c.name}</option>)}
                  </select>
                  <input
                    type="date" value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                {loadingStudents ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
                ) : !selectedClass ? (
                  <p className="text-center py-8 text-sm text-gray-400">Select a class to mark attendance</p>
                ) : classStudents.length === 0 ? (
                  <p className="text-center py-8 text-sm text-gray-400">No students in this class</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {classStudents.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <Avatar name={`${s.user.first_name} ${s.user.last_name}`} photo={s.user.profile_photo} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{s.user.first_name} {s.user.last_name}</p>
                            <p className="text-xs text-gray-400">{s.student_code}</p>
                          </div>
                          <div className="flex gap-1">
                            {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttStatus[]).map((st) => (
                              <button
                                key={st}
                                onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: st }))}
                                className={`text-xs px-2.5 py-1 rounded-lg border transition ${statuses[s.id] === st ? STATUS_CFG[st].color + " border-transparent" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
                              >
                                {STATUS_CFG[st].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleBulkSubmit} disabled={submitting || submitted}
                      className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" />Saving...</>
                        : submitted
                        ? <><CheckCircle size={15} />Saved!</>
                        : `Save Attendance (${classStudents.length} students)`}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-64 flex-shrink-0 space-y-3">
            {/* Today summary */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-400 mb-3">Today&apos;s Summary</p>
              <div className="grid grid-cols-2 gap-2">
                {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttStatus[]).map((st) => (
                  <div key={st} className="bg-gray-50 rounded-xl p-2.5">
                    <div className={`w-2 h-2 rounded-full ${STATUS_CFG[st].dot} mb-1`} />
                    <p className="text-lg font-bold text-gray-800">{todaySummary[st] ?? 0}</p>
                    <p className="text-xs text-gray-400">{STATUS_CFG[st].label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between">
                <span className="text-xs text-gray-400">Total scanned</span>
                <span className="text-sm font-bold text-blue-600">{totalToday}</span>
              </div>
            </div>

            {/* Scan log */}
            {scanLog.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs font-medium text-gray-400 mb-3">Recent taps</p>
                <div className="space-y-2">
                  {scanLog.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2">
                      <Avatar name={entry.name} photo={entry.photo} size={7} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">{entry.name}</p>
                        <p className="text-xs text-gray-400">{entry.time}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${ACTION_CFG[entry.action].bg} ${ACTION_CFG[entry.action].color}`}>
                        {entry.action === "TAP_IN" ? "IN" : entry.action === "TAP_OUT" ? "OUT" : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings quick view */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-400">Tap Settings</p>
                <button onClick={() => setShowSettings(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Tap-out delay</span>
                  <span className="text-xs font-medium text-gray-700">{settings.tap_out_after_minutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">School starts</span>
                  <span className="text-xs font-medium text-gray-700">{settings.school_start_time}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
