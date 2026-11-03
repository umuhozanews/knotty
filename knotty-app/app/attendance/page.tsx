"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Wifi, CheckCircle, XCircle, Clock, MinusCircle,
  Radio, StopCircle, CreditCard, Settings, X, LogIn, LogOut, AlertTriangle, Download, Search, Users, RefreshCw,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import KnottyCard from "@/components/KnottyCard";
import VirtualCardTap from "@/components/VirtualCardTap";
import { supabaseAttendanceService, supabaseCanteenService, supabaseAcademicService } from "@/lib/supabase/services";
import { getSafeBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
type CardScanFull = {
  card_number: string; wallet_balance: number; daily_limit: number | null;
  issued_at: string; expires_at: string; is_frozen: boolean;
  today_attendance: string | null; tap_out_available_at: string | null;
  check_in_time: string | null; check_out_time: string | null;
  student: { id: string; name: string; class: string; student_code: string; photo: string | null; school_name: string; school_logo: string | null };
};

type AttendanceSettings = { tap_out_after_minutes: number; school_start_time: string };
type Class = { id: string; name: string; section_code?: string; level?: { name: string } | null };
import { useAuth } from "@/context/AuthContext";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";

type AttStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
type TapAction = "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "BLOCKED";

interface ScanLogEntry {
  id: string;
  name: string;
  className: string;
  studentCode?: string;
  cardNumber?: string;
  action: TapAction;
  status?: string;
  time: string;
  rawTime?: string;
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

function CorrectAttendanceModal({
  schoolId,
  record,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  record: ScanLogEntry;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [status, setStatus] = useState<"present" | "absent" | "late" | "excused" | "early_departure">("present");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("An audit reason of at least 3 characters is required for attendance correction.");
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(record.id) || !uuidRegex.test(schoolId)) {
      setError("This attendance record was loaded from legacy storage and lacks a valid Supabase UUID.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await supabaseAttendanceService.correctStudentAttendance({
          schoolId,
          attendanceId: record.id,
          status,
          reason: reason.trim(),
        });
        onSuccess(`Attendance corrected to ${status} for ${record.name}`);
        onClose();
        return;
      }
      onSuccess(`Attendance updated for ${record.name}`);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to correct attendance");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-base mb-1">Correct Attendance Record</h3>
        <p className="text-xs text-gray-500 mb-4">
          Audit-trailed correction for <span className="font-semibold text-gray-700">{record.name}</span>
        </p>

        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Corrected Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
              <option value="early_departure">Early Departure</option>
              <option value="absent">Absent</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Audit Reason</label>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Card sensor missed tap / verified doctor note"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Save Correction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, error: nfcError, isSupported } = useNFC();

  const [mode, setMode] = useState<"tap" | "bulk">("tap");
  const [correctingRecord, setCorrectingRecord] = useState<ScanLogEntry | null>(null);

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
  const [date, setDate]                   = useState(() => new Date().toLocaleDateString('en-ZA', { timeZone: 'Africa/Kigali' }).replace(/\//g, '-'));
  const [scanType, setScanType]           = useState<"AUTO" | "IN" | "OUT">("AUTO");
  const [logFilter, setLogFilter]         = useState<"ALL" | "IN" | "OUT">("ALL");
  const [logSearch, setLogSearch]         = useState("");
  const [tapInStart, setTapInStart]       = useState("07:00");
  const [tapInEnd, setTapInEnd]           = useState("12:00");
  const [tapOutStart, setTapOutStart]     = useState("15:00");
  const [tapOutEnd, setTapOutEnd]         = useState("17:00");
  const [scanning, setScanning]           = useState(false);
  const qrScannerRef = useRef<any | null>(null);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [statuses, setStatuses]           = useState<Record<string, AttStatus>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadAttendancePDF() {
    toast("PDF export not available yet", "info");
  }

  const loadTodaySummary = useCallback((classId?: string) => {
    if (!activeSchool?.id) return;
    const today = new Date().toLocaleDateString("en-CA");
    supabaseAttendanceService.listAttendance({ schoolId: activeSchool.id, date: today }).then((rows) => {
      const filtered = classId ? rows : rows;
      const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
      filtered.forEach((r) => {
        const k = r.status.toUpperCase() as keyof typeof summary;
        if (k in summary) summary[k]++;
      });
      setTodaySummary(summary);
      setTotalToday(filtered.length);
    }).catch(() => {});
  }, [activeSchool?.id]);

  useEffect(() => {
    if (authLoading || !activeSchool?.id) return;
    supabaseAcademicService.listClassSections(activeSchool.id).then((rows) => {
      setClasses(rows.map((r) => ({ id: r.id, name: r.name, section_code: r.section_code })));
    }).catch(console.error);
    const client = getSafeBrowserClient();
    if (client) {
      Promise.resolve(client.from("school_settings").select("school_day_start").eq("school_id", activeSchool.id).single())
        .then(({ data }) => {
          if (data) setSettings((s) => ({ ...s, school_start_time: data.school_day_start?.slice(0, 5) ?? "08:30" }));
        }).catch(() => {});
    }
  }, [authLoading, activeSchool?.id]);

  useEffect(() => {
    loadTodaySummary(selectedClass);
  }, [selectedClass, loadTodaySummary]);

  useEffect(() => {
    if (!selectedClass || !activeSchool?.id) {
      setClassStudents([]);
      return;
    }
    setLoadingStudents(true);
    const client = getSafeBrowserClient();
    if (!client) { setLoadingStudents(false); return; }
    Promise.all([
      client.from("student_class_placements")
        .select("enrollment_id, student_enrollments!inner(student_id, student_records!inner(id, admission_number, profile_photo_path))")
        .eq("class_section_id", selectedClass)
        .eq("school_id", activeSchool.id)
        .eq("status", "active"),
      supabaseAttendanceService.listAttendance({ schoolId: activeSchool.id, date }),
    ]).then(([placementRes, attRows]) => {
      const placements = (placementRes.data || []) as any[];
      const studs: ClassStudent[] = placements.map((p: any) => {
        const enrollment = p.student_enrollments;
        const sr = enrollment?.student_records;
        return {
          id: sr?.id ?? enrollment?.student_id ?? p.enrollment_id,
          student_code: sr?.admission_number ?? "",
          user: { first_name: "", last_name: "", profile_photo: sr?.profile_photo_path ?? null },
          card: null,
        };
      }).filter((s: ClassStudent) => s.id);
      setClassStudents(studs);
      setSubmitted(false);
      const existing: Record<string, AttStatus> = {};
      attRows.filter((r) => r.status).forEach((r) => { existing[r.student_id] = r.status.toUpperCase() as AttStatus; });
      const defaults: Record<string, AttStatus> = {};
      studs.forEach((s) => { defaults[s.id] = existing[s.id] ?? "PRESENT"; });
      setStatuses(defaults);
    }).catch(console.error).finally(() => setLoadingStudents(false));
  }, [selectedClass, date, activeSchool?.id]);

  async function executeScan(cardNumber: string) {
    if (!activeSchool?.id) return;
    setCardLoading(true);
    setCardData(null);
    setTapResult(null);
    setGlowColor(null);
    try {
      const holder = await supabaseCanteenService.lookupCardHolder(activeSchool.id, cardNumber.trim());
      if (!holder) throw new Error("Card not found");
      if (holder.is_frozen) throw new Error("Card is frozen");

      const idempotencyKey = `${holder.student_id}-${Date.now()}`;
      const tapResult = await supabaseAttendanceService.recordVirtualStudentTap({
        schoolId: activeSchool.id,
        studentId: holder.student_id,
        idempotencyKey,
      }) as any;

      const action: TapAction = tapResult?.action === "TAP_OUT" ? "TAP_OUT" : "TAP_IN";
      const cardDataLocal: CardScanFull = {
        card_number: cardNumber,
        wallet_balance: holder.wallet_balance,
        daily_limit: null,
        issued_at: "",
        expires_at: "",
        is_frozen: holder.is_frozen,
        today_attendance: null,
        tap_out_available_at: tapResult?.tap_out_available_at ?? null,
        check_in_time: tapResult?.check_in_time ?? new Date().toISOString(),
        check_out_time: tapResult?.check_out_time ?? null,
        student: { id: holder.student_id, name: holder.legal_name, class: holder.class_name, student_code: holder.admission_number, photo: holder.profile_photo_path ?? null, school_name: activeSchool.name, school_logo: null },
      };
      setCardData(cardDataLocal);
      setGlowColor(ACTION_CFG[action].glow);
      setTapResult({
        action,
        message: action === "TAP_IN"
          ? `Tapped in at ${fmtTime(cardDataLocal.check_in_time)}.`
          : `Tapped out at ${fmtTime(cardDataLocal.check_out_time ?? new Date().toISOString())}.`,
      });

      const logEntry: ScanLogEntry = {
        id: tapResult?.id || Date.now().toString(),
        name: holder.legal_name,
        className: holder.class_name,
        studentCode: holder.admission_number,
        cardNumber,
        action,
        status: action === "TAP_IN" ? "PRESENT" : "PRESENT",
        time: fmtTime(new Date().toISOString()),
        rawTime: new Date().toISOString(),
        photo: holder.profile_photo_path ?? null,
      };
      setScanLog((l) => [logEntry, ...l.filter((x) => x.id !== logEntry.id).slice(0, 99)]);
      loadTodaySummary(selectedClass);
      toast(`${holder.legal_name} — ${ACTION_CFG[action].label}`, action === "TAP_IN" ? "success" : "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setGlowColor("red");
      toast(msg, "error");
    } finally {
      setCardLoading(false);
    }
  }

  async function lookupCard(num: string, _isNfc = false) {
    const n = num.trim();
    if (!n) return;
    await executeScan(n);
  }

  async function doTap() {
    if (!cardData || tapLoading) return;
    setTapping(true);
    setTapLoading(true);
    setTapResult(null);
    await new Promise((r) => setTimeout(r, 120));
    try {
      await executeScan(cardData.card_number);
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
    if (n.startsWith("eyJ") || n.startsWith("KS:")) {
      await lookupCard(n);
    } else {
      await executeScan(n);
    }
  }, [scanType, date, tapInStart, tapInEnd, tapOutStart, tapOutEnd, selectedClass]);

  const startScanner = async () => {
    setScanning(true);

    // Give React a moment to render and mount the reader container in the DOM
    await new Promise((resolve) => setTimeout(resolve, 150));

    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
      } catch { /* ignore */ }
    }
    const { Html5Qrcode } = await import("html5-qrcode");

    if (!document.getElementById("reader")) {
      toast("Scanner element not found in DOM", "error");
      setScanning(false);
      return;
    }

    const html5Qrcode = new Html5Qrcode("reader");
    qrScannerRef.current = html5Qrcode;

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error("No camera devices found.");
      }

      // Find back/rear camera or default to the first camera
      const backCam = devices.find(d => 
        /back|rear|environment|camera2\s+0/i.test(d.label)
      );
      const cameraId = backCam ? backCam.id : devices[0].id;

      await html5Qrcode.start(
        cameraId,
        {
          fps: 15,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.75;
            return { width: size, height: size };
          }
        },
        async (decodedText) => {
          await handleScanResult(decodedText);
        },
        () => { /* ignore normal fail frames */ }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access failed";
      toast(msg, "error");
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
    if (ok) toast("NFC scanner active — tap an IshuriHUB Card", "info");
  }

  async function handleBulkSubmit() {
    if (!selectedClass || !activeSchool?.id) return;
    const records = classStudents.map((s) => ({ student_id: s.id, status: statuses[s.id] ?? "ABSENT" }));
    setSubmitting(true);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      let count = 0;
      for (const r of records) {
        try {
          await supabaseAttendanceService.recordStudentAttendance({
            schoolId: activeSchool.id,
            studentId: r.student_id,
            attendanceDate: today,
            status: r.status.toLowerCase() as "present" | "absent" | "late" | "excused",
          });
          count++;
        } catch { /* skip already-recorded */ }
      }
      setSubmitted(true);
      toast(`Attendance saved — ${count} students marked`, "success");
      loadTodaySummary(selectedClass);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Submit failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveSettings() {
    if (!activeSchool?.id) return;
    setSavingSettings(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) throw new Error("Not connected");
      const { error } = await client
        .from("school_settings")
        .update({ school_day_start: settings.school_start_time + ":00" })
        .eq("school_id", activeSchool.id);
      if (error) throw new Error(error.message);
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
    : scanType === "IN"
    ? "tap_in"
    : scanType === "OUT"
    ? "tap_out"
    : cardData.check_in_time && !cardData.check_out_time
    ? "tap_out"
    : "tap_in";

  const filteredLogs = scanLog.filter((entry) => {
    if (logFilter === "IN" && entry.action !== "TAP_IN") return false;
    if (logFilter === "OUT" && entry.action !== "TAP_OUT") return false;
    if (logSearch.trim()) {
      const q = logSearch.toLowerCase();
      const matchName = (entry.name || "").toLowerCase().includes(q);
      const matchCode = (entry.studentCode || "").toLowerCase().includes(q);
      const matchClass = (entry.className || "").toLowerCase().includes(q);
      const matchCard = (entry.cardNumber || "").toLowerCase().includes(q);
      return matchName || matchCode || matchClass || matchCard;
    }
    return true;
  });

  return (
    <DashboardShell>
      {correctingRecord && (
        <CorrectAttendanceModal
          schoolId={activeSchool?.id || user?.school_id || "00000000-0000-0000-0000-000000000001"}
          record={correctingRecord}
          onClose={() => setCorrectingRecord(null)}
          onSuccess={(msg) => {
            toast(msg, "success");
            loadTodaySummary(selectedClass);
          }}
        />
      )}
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

        {/* Global Class & Date Selector Panel */}
        <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border border-blue-50/50">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Class Filter <span className="font-normal text-gray-400">(optional)</span></label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 font-medium text-gray-700 bg-white"
            >
              <option value="">All classes — tap any student card</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.level?.name} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Attendance Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 text-gray-700 bg-white"
            />
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
                {/* Gate scan config controls */}
                <div className="bg-white rounded-2xl shadow-sm p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-700 block">Active Scan Mode</label>
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {scanType === "AUTO" ? "⚡ Smart In/Out" : scanType === "IN" ? "Forced In" : "Forced Out"}
                      </span>
                    </div>
                    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
                      <button
                        onClick={() => setScanType("AUTO")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${scanType === "AUTO" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        ⚡ AUTO (In/Out)
                      </button>
                      <button
                        onClick={() => setScanType("IN")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${scanType === "IN" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <LogIn size={12} /> TAP IN
                      </button>
                      <button
                        onClick={() => setScanType("OUT")}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${scanType === "OUT" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                      >
                        <LogOut size={12} /> TAP OUT
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 leading-tight">
                      {scanType === "AUTO"
                        ? "✨ Auto mode smartly detects: checks IN arriving students, and checks OUT students who are already inside."
                        : scanType === "IN"
                        ? "Forces card scans to register as Arrival TAP IN."
                        : "Forces card scans to register as Departure TAP OUT."}
                    </p>
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
                    <VirtualCardTap onTap={(cn) => { setCardInput(cn); lookupCard(cn); }} busy={cardLoading} />
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
                      NFC scanner active — tap an IshuriHUB Card
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
                      disabled={tapLoading || tapState === "idle" || tapState === "frozen"}
                      className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200
                        ${tapState === "tap_in"  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100" : ""}
                        ${tapState === "tap_out" ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100" : ""}
                        ${tapState === "frozen"  ? "bg-red-50 text-red-400 cursor-not-allowed" : ""}
                        ${tapState === "idle"    ? "bg-gray-50 text-gray-300 cursor-not-allowed" : ""}
                        ${tapping ? "scale-95" : "scale-100"}
                      `}
                    >
                      {tapLoading             ? <Loader2   size={20} className="animate-spin" /> :
                       tapState === "tap_in"  ? <><LogIn   size={20} />TAP IN</>  :
                       tapState === "tap_out" ? <><LogOut  size={20} />TAP OUT</> :
                       tapState === "frozen"  ? <><XCircle size={20} />Card Frozen</> :
                                                <><CreditCard size={20} />Scan a Card First</>}
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

                {/* ── Who Tapped Today: Live Attendance Activity Log (Shown Down Below) ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <h3 className="font-bold text-gray-800 text-base">Students Who Tapped Today</h3>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {scanLog.length} recorded
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Live real-time feed of all card scans and attendance check-ins/outs
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Filter buttons */}
                      <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                          onClick={() => setLogFilter("ALL")}
                          className={`px-2.5 py-1 rounded-md transition ${logFilter === "ALL" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          All ({scanLog.length})
                        </button>
                        <button
                          onClick={() => setLogFilter("IN")}
                          className={`px-2.5 py-1 rounded-md transition ${logFilter === "IN" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Tapped In ({scanLog.filter((x) => x.action === "TAP_IN").length})
                        </button>
                        <button
                          onClick={() => setLogFilter("OUT")}
                          className={`px-2.5 py-1 rounded-md transition ${logFilter === "OUT" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                        >
                          Tapped Out ({scanLog.filter((x) => x.action === "TAP_OUT").length})
                        </button>
                      </div>

                      <button
                        onClick={() => loadTodaySummary(selectedClass)}
                        title="Refresh attendance log"
                        className="px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition text-xs flex items-center gap-1.5 font-medium"
                      >
                        <RefreshCw size={12} />
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Search bar inside list */}
                  <div className="p-3 border-b border-gray-100 bg-white">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Search who tapped by student name, code, class, or card number..."
                        className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                      />
                    </div>
                  </div>

                  {/* The List of who tapped */}
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-400 mx-auto flex items-center justify-center mb-2">
                        <CreditCard size={22} />
                      </div>
                      <p className="text-sm font-semibold text-gray-600">No attendance taps match</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                        Tap an NFC card or click Virtual Card Tap above to register attendance.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[460px] overflow-y-auto">
                      {filteredLogs.map((entry, idx) => {
                        const isTapIn = entry.action === "TAP_IN";
                        return (
                          <div
                            key={entry.id || idx}
                            className="p-3.5 hover:bg-gray-50/80 transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={entry.name} photo={entry.photo} size={10} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-gray-800 truncate">{entry.name}</p>
                                  {entry.studentCode && (
                                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                      {entry.studentCode}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                  {entry.className && <span>{entry.className}</span>}
                                  {entry.cardNumber && <span>• Card: {entry.cardNumber}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Tap direction badge */}
                              <div className="flex flex-col items-end">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border ${
                                    isTapIn
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  }`}
                                >
                                  {isTapIn ? <LogIn size={12} /> : <LogOut size={12} />}
                                  {isTapIn ? "TAPPED IN" : "TAPPED OUT"}
                                </span>
                                <span className="text-[11px] text-gray-400 mt-1 flex items-center gap-1 font-mono">
                                  <Clock size={10} /> {entry.time}
                                </span>
                              </div>

                              {/* Status tag */}
                              {entry.status && (
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    entry.status === "LATE"
                                      ? "bg-amber-100 text-amber-700"
                                      : entry.status === "PRESENT"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {entry.status}
                                </span>
                              )}

                              <button
                                onClick={() => setCorrectingRecord(entry)}
                                className="text-[11px] px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition"
                                title="Audit-trailed correction"
                              >
                                Correct
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Bulk mark mode */
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">

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
                    <p className="text-lg font-bold text-gray-800">{todaySummary?.[st] ?? 0}</p>
                    <p className="text-xs text-gray-400">{STATUS_CFG[st].label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between">
                <span className="text-xs text-gray-400">Total scanned</span>
                <span className="text-sm font-bold text-blue-600">{totalToday}</span>
              </div>
            </div>

            {/* PDF Download */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-medium text-gray-400 mb-2">Attendance PDF</p>
              <p className="text-xs text-gray-400 mb-3">
                {selectedClass ? `Download daily report for selected class & date` : "Select a class to generate PDF"}
              </p>
              <button
                onClick={downloadAttendancePDF}
                disabled={pdfLoading || !selectedClass}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-gray-700 disabled:opacity-50 transition"
              >
                {pdfLoading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {pdfLoading ? "Generating…" : "Download PDF"}
              </button>
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
