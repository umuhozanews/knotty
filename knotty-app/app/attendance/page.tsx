"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Loader2, Wifi, StopCircle, CreditCard,
  LogIn, LogOut, CheckCircle, MinusCircle, AlertTriangle, XCircle, Clock,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import KnottyCard from "@/components/KnottyCard";
import VirtualCardTap from "@/components/VirtualCardTap";
import { supabaseAttendanceService, supabaseCanteenService } from "@/lib/supabase/services";
import { useAuth } from "@/context/AuthContext";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";

type CardScanFull = {
  card_number: string; wallet_balance: number; daily_limit: number | null;
  issued_at: string; expires_at: string; is_frozen: boolean;
  today_attendance: string | null; tap_out_available_at: string | null;
  check_in_time: string | null; check_out_time: string | null;
  student: { id: string; name: string; class: string; student_code: string; photo: string | null; school_name: string; school_logo: string | null };
};

type TapAction = "TAP_IN" | "TAP_OUT" | "ALREADY_OUT" | "BLOCKED";

interface ScanLogEntry {
  id: string;
  name: string;
  className: string;
  studentCode?: string;
  action: TapAction;
  time: string;
  photo: string | null;
}

const ACTION_CFG: Record<TapAction, { label: string; color: string; bg: string; border: string; glow: "green" | "blue" | "orange" | "red" | null }> = {
  TAP_IN:      { label: "Tapped In",   color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  glow: "green"  },
  TAP_OUT:     { label: "Tapped Out",  color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200",   glow: "blue"   },
  ALREADY_OUT: { label: "Already Out", color: "text-gray-500",   bg: "bg-gray-50",   border: "border-gray-200",   glow: null     },
  BLOCKED:     { label: "Too Early",   color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", glow: "orange" },
};

function Avatar({ name, photo, size = 8 }: { name: string; photo: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = name.charCodeAt(0) * 37 % 360;
  if (photo) return <img src={photo} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} alt="" />;
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
  const { activeSchool, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, error: nfcError, isSupported } = useNFC();

  const [cardInput, setCardInput]     = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardData, setCardData]       = useState<CardScanFull | null>(null);
  const [tapLoading, setTapLoading]   = useState(false);
  const [tapping, setTapping]         = useState(false);
  const [tapResult, setTapResult]     = useState<{ action: TapAction; message: string } | null>(null);
  const [glowColor, setGlowColor]     = useState<"green" | "blue" | "orange" | "red" | null>(null);
  const [scanLog, setScanLog]         = useState<ScanLogEntry[]>([]);
  const [scanType, setScanType]       = useState<"AUTO" | "IN" | "OUT">("AUTO");
  const [scanning, setScanning]       = useState(false);
  const [tapInEnd, setTapInEnd]       = useState("12:00");
  const [tapOutEnd, setTapOutEnd]     = useState("17:00");

  const glowTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrScannerRef = useRef<any | null>(null);

  async function executeScan(identifier: string, isNfcUid = false) {
    if (!activeSchool?.id) return;
    setCardLoading(true);
    setCardData(null);
    setTapResult(null);
    setGlowColor(null);
    try {
      const holder = isNfcUid
        ? await supabaseCanteenService.lookupCardHolderByNfcUid(activeSchool.id, identifier.trim())
        : await supabaseCanteenService.lookupCardHolder(activeSchool.id, identifier.trim());
      if (!holder) throw new Error("Card not found");
      if (holder.is_frozen) throw new Error("Card is frozen");
      const cardNumber = holder.card_number ?? identifier;

      const idempotencyKey = `${holder.student_id}-${Date.now()}`;
      const direction: "auto" | "in" | "out" = scanType === "IN" ? "in" : scanType === "OUT" ? "out" : "auto";
      const tapRes = await supabaseAttendanceService.recordVirtualStudentTapV2({
        schoolId: activeSchool.id,
        studentId: holder.student_id,
        idempotencyKey,
        direction,
      });

      const action: TapAction = tapRes.action === "TAP_OUT" ? "TAP_OUT"
        : tapRes.action === "ALREADY_OUT" ? "ALREADY_OUT"
        : "TAP_IN";

      const cardDataLocal: CardScanFull = {
        card_number: cardNumber,
        wallet_balance: holder.wallet_balance,
        daily_limit: null,
        issued_at: "",
        expires_at: "",
        is_frozen: holder.is_frozen,
        today_attendance: null,
        tap_out_available_at: null,
        check_in_time: tapRes.check_in_time,
        check_out_time: tapRes.check_out_time,
        student: {
          id: holder.student_id,
          name: holder.legal_name,
          class: holder.class_name,
          student_code: holder.admission_number,
          photo: holder.profile_photo_path ?? null,
          school_name: activeSchool.name,
          school_logo: null,
        },
      };
      setCardData(cardDataLocal);
      setGlowColor(ACTION_CFG[action].glow);

      const totalPts = tapRes.tap_in_points + tapRes.tap_out_points;
      const ptsLabel = totalPts > 0 ? ` · ${totalPts}/4 pts` : "";
      setTapResult({
        action,
        message: action === "TAP_IN"
          ? `Tapped in at ${fmtTime(tapRes.check_in_time)} (+2 pts)`
          : action === "TAP_OUT"
          ? `Tapped out at ${fmtTime(tapRes.check_out_time)} (+2 pts)`
          : `Already tapped out today${ptsLabel}`,
      });

      setScanLog((l) => [{
        id: tapRes.attendance_record_id || Date.now().toString(),
        name: holder.legal_name,
        className: holder.class_name,
        studentCode: holder.admission_number,
        action,
        time: fmtTime(new Date().toISOString()),
        photo: holder.profile_photo_path ?? null,
      }, ...l.slice(0, 9)]);

      toast(`${holder.legal_name} — ${ACTION_CFG[action].label}${ptsLabel}`, action === "TAP_IN" ? "success" : "info");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      setGlowColor("red");
      toast(msg, "error");
    } finally {
      setCardLoading(false);
    }
  }

  async function lookupCard(num: string, isNfcUid = false) {
    const n = num.trim();
    if (!n) return;
    await executeScan(n, isNfcUid);
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
    if (n.startsWith('"') && n.endsWith('"')) n = n.slice(1, -1);
    if (!n) return;
    await executeScan(n);
  }, [scanType, activeSchool?.id]);

  const startScanner = async () => {
    setScanning(true);
    await new Promise((r) => setTimeout(r, 150));
    if (qrScannerRef.current) {
      try { if (qrScannerRef.current.isScanning) await qrScannerRef.current.stop(); } catch { /* ignore */ }
    }
    const { Html5Qrcode } = await import("html5-qrcode");
    if (!document.getElementById("reader")) {
      toast("Scanner element not found", "error");
      setScanning(false);
      return;
    }
    const html5Qrcode = new Html5Qrcode("reader");
    qrScannerRef.current = html5Qrcode;
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices?.length) throw new Error("No camera found");
      const backCam = devices.find((d: any) => /back|rear|environment/i.test(d.label));
      await html5Qrcode.start(
        backCam ? backCam.id : devices[0].id,
        { fps: 15, qrbox: (w: number, h: number) => { const s = Math.min(w, h) * 0.75; return { width: s, height: s }; } },
        async (text: string) => { await handleScanResult(text); },
        () => {},
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Camera failed", "error");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try { if (qrScannerRef.current.isScanning) await qrScannerRef.current.stop(); } catch { /* ignore */ }
      qrScannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { qrScannerRef.current?.stop().catch(() => {}); };
  }, []);

  async function toggleNFCListen() {
    if (listening) { stopListen(); toast("NFC stopped", "info"); return; }
    const ok = await startListen(async (result) => {
      setCardInput(result.value);
      await lookupCard(result.value, result.type === "uid");
    });
    if (ok) toast("NFC active — tap a card", "info");
  }

  const tapState = !cardData
    ? "idle"
    : cardData.is_frozen ? "frozen"
    : scanType === "IN"  ? "tap_in"
    : scanType === "OUT" ? "tap_out"
    : cardData.check_in_time && !cardData.check_out_time ? "tap_out"
    : "tap_in";

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Attendance</h1>
          <p className="text-sm text-gray-400">
            {new Date().toLocaleDateString("en-RW", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Time window */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Tap Window</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Tap-in closes</label>
              <input
                type="time" value={tapInEnd}
                onChange={(e) => setTapInEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Tap-out closes</label>
              <input
                type="time" value={tapOutEnd}
                onChange={(e) => setTapOutEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Mode */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">Mode</p>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setScanType("IN")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5
                ${scanType === "IN" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LogIn size={15} /> TAP IN
            </button>
            <button
              onClick={() => setScanType("AUTO")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5
                ${scanType === "AUTO" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              AUTO
            </button>
            <button
              onClick={() => setScanType("OUT")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-1.5
                ${scanType === "OUT" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LogOut size={15} /> TAP OUT
            </button>
          </div>
        </div>

        {/* Scan area */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); lookupCard(cardInput); }} className="flex gap-2">
            <input
              value={cardInput}
              onChange={(e) => setCardInput(e.target.value)}
              placeholder="Card number or scan QR"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500"
            />
            <button
              type="submit" disabled={cardLoading || !cardInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {cardLoading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              Lookup
            </button>
          </form>

          <div className="flex gap-2">
            <VirtualCardTap onTap={(cn) => { setCardInput(cn); lookupCard(cn); }} busy={cardLoading} />

            {isSupported && (
              <button
                onClick={toggleNFCListen}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition
                  ${listening
                    ? "bg-red-50 text-red-500 border-red-200"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"}`}
              >
                {listening ? <><StopCircle size={14} />Stop NFC</> : <><Wifi size={14} />NFC</>}
              </button>
            )}

            <button
              onClick={scanning ? stopScanner : startScanner}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border transition
                ${scanning
                  ? "bg-red-50 text-red-500 border-red-200"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"}`}
            >
              <span className={`w-2 h-2 rounded-full ${scanning ? "bg-red-500 animate-ping" : "bg-gray-400"}`} />
              {scanning ? "Stop Camera" : "Camera"}
            </button>
          </div>

          {listening && (
            <div className="flex items-center gap-2 text-xs text-blue-600">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              NFC active — tap a card
            </div>
          )}
          {nfcError && <p className="text-xs text-red-500">{nfcError}</p>}

          {scanning && (
            <div id="reader" className="w-full overflow-hidden rounded-2xl border border-gray-100" />
          )}
        </div>

        {/* Card result */}
        {cardLoading ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex justify-center">
            <Loader2 size={28} className="animate-spin text-blue-600" />
          </div>
        ) : cardData ? (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex justify-center">
              <KnottyCard card={cardData} glowColor={glowColor} tapping={tapping} />
            </div>

            {tapResult && (
              <div className={`flex items-start gap-3 p-3 rounded-xl border ${ACTION_CFG[tapResult.action].bg} ${ACTION_CFG[tapResult.action].border}`}>
                {tapResult.action === "TAP_IN"      && <CheckCircle   size={16} className="text-green-500 mt-0.5 shrink-0" />}
                {tapResult.action === "TAP_OUT"     && <LogOut        size={16} className="text-blue-500 mt-0.5 shrink-0" />}
                {tapResult.action === "ALREADY_OUT" && <MinusCircle   size={16} className="text-gray-400 mt-0.5 shrink-0" />}
                {tapResult.action === "BLOCKED"     && <AlertTriangle size={16} className="text-orange-500 mt-0.5 shrink-0" />}
                <div>
                  <p className={`text-sm font-bold ${ACTION_CFG[tapResult.action].color}`}>{ACTION_CFG[tapResult.action].label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tapResult.message}</p>
                </div>
              </div>
            )}

            <button
              onClick={doTap}
              disabled={tapLoading || tapState === "idle" || tapState === "frozen"}
              className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-200
                ${tapState === "tap_in"  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100" : ""}
                ${tapState === "tap_out" ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100" : ""}
                ${tapState === "frozen"  ? "bg-red-50 text-red-400 cursor-not-allowed" : ""}
                ${tapState === "idle"    ? "bg-gray-50 text-gray-300 cursor-not-allowed" : ""}
                ${tapping ? "scale-95" : "scale-100"}`}
            >
              {tapLoading             ? <Loader2   size={20} className="animate-spin" /> :
               tapState === "tap_in"  ? <><LogIn   size={20} />TAP IN</>  :
               tapState === "tap_out" ? <><LogOut  size={20} />TAP OUT</> :
               tapState === "frozen"  ? <><XCircle size={20} />Card Frozen</> :
                                        <><CreditCard size={20} />Scan a Card First</>}
            </button>

            <button
              onClick={() => { setCardData(null); setCardInput(""); setTapResult(null); setGlowColor(null); }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition"
            >
              Clear — scan another card
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
              <CreditCard size={36} className="text-gray-200" />
            </div>
            <p className="font-semibold text-gray-400 text-sm">Waiting for card scan</p>
          </div>
        )}

        {/* Recent scans */}
        {scanLog.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 mb-3">Recent scans</p>
            <div className="space-y-2">
              {scanLog.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <Avatar name={entry.name} photo={entry.photo} size={8} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{entry.name}</p>
                    <p className="text-xs text-gray-400">{entry.className}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border
                      ${entry.action === "TAP_IN"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : entry.action === "TAP_OUT"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-gray-50 text-gray-500 border-gray-200"}`}
                    >
                      {entry.action === "TAP_IN" ? "IN" : entry.action === "TAP_OUT" ? "OUT" : "—"}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />{entry.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
