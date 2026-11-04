"use client";
import { useEffect, useState, useCallback } from "react";
import {
  X, Loader2, AlertTriangle, BookOpen, ShieldAlert,
  Wifi, StopCircle, User, Heart, Calendar, CreditCard,
} from "lucide-react";
import { useNFC, NFCResult } from "@/hooks/useNFC";
import VirtualCardTap from "@/components/VirtualCardTap";
import {
  supabaseCanteenService,
  supabaseDisciplineService,
  supabaseHealthService,
} from "@/lib/supabase/services";
import type { DisciplineRecord, HealthRecord } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";

export type NFCMode = "report" | "discipline" | "health";
type Phase = "scanning" | "loading" | "found" | "error";

const SEV_COLOR: Record<string, string> = {
  SERIOUS:  "bg-red-50 text-red-500",
  MODERATE: "bg-orange-50 text-orange-500",
  MINOR:    "bg-yellow-50 text-yellow-600",
};
const TYPE_COLOR: Record<string, string> = {
  WARNING:        "bg-yellow-50 text-yellow-600",
  SUSPENSION:     "bg-red-50 text-red-500",
  MISCONDUCT:     "bg-orange-50 text-orange-500",
  RULE_VIOLATION: "bg-purple-50 text-purple-500",
  OTHER:          "bg-gray-100 text-gray-500",
};
const HEALTH_SEV_COLOR: Record<string, string> = {
  HIGH:   "bg-orange-50 text-orange-500",
  MEDIUM: "bg-yellow-50 text-yellow-600",
  LOW:    "bg-green-50 text-green-600",
};
const HEALTH_TYPE_COLOR: Record<string, string> = {
  ILLNESS:    "bg-blue-50 text-blue-600",
  INJURY:     "bg-orange-50 text-orange-500",
  CHECKUP:    "bg-green-50 text-green-600",
  MEDICATION: "bg-purple-50 text-purple-500",
  ALLERGY:    "bg-red-50 text-red-500",
  OTHER:      "bg-gray-100 text-gray-500",
};

const MODE_CONFIG: Record<NFCMode, { title: string; iconBg: string; iconColor: string; Icon: React.ElementType }> = {
  report:     { title: "Student Report",     iconBg: "bg-blue-50",  iconColor: "text-blue-500",  Icon: BookOpen    },
  discipline: { title: "Discipline Records", iconBg: "bg-red-50",   iconColor: "text-red-500",   Icon: ShieldAlert },
  health:     { title: "Health Records",     iconBg: "bg-green-50", iconColor: "text-green-600", Icon: Heart       },
};

type ScannedStudent = {
  id: string;
  name: string;
  class: string;
  student_code: string;
  photo: string | null;
  wallet_balance: number;
  card_number: string;
  card_status: string;
};

type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

export default function NFCStudentModal({ mode, onClose }: { mode: NFCMode; onClose: () => void }) {
  const { startListen, stopListen, listening, error: nfcError, isSupported } = useNFC();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<ScannedStudent | null>(null);
  const [disciplineData, setDisciplineData] = useState<DisciplineRecord[] | null>(null);
  const [healthData, setHealthData]         = useState<HealthRecord[] | null>(null);
  const [attendance, setAttendance]         = useState<AttendanceSummary | null>(null);

  const handleNFCTap = useCallback(async (result: NFCResult) => {
    if (!user?.school_id) {
      setErrorMsg("Not signed in — please log in and try again");
      setPhase("error");
      return;
    }
    stopListen();
    setPhase("loading");
    try {
      const cardHolder = await supabaseCanteenService.lookupCardHolderByNfcUid(
        user.school_id,
        result.value,
      );
      if (!cardHolder) {
        setErrorMsg("Card not registered or not assigned to any student");
        setPhase("error");
        return;
      }

      const scanned: ScannedStudent = {
        id:             cardHolder.student_id,
        name:           cardHolder.legal_name ?? "Unknown",
        class:          [cardHolder.education_level_name, cardHolder.class_name].filter(Boolean).join(" ") || "—",
        student_code:   cardHolder.admission_number ?? "—",
        photo:          cardHolder.profile_photo_path ?? null,
        wallet_balance: cardHolder.wallet_balance ?? 0,
        card_number:    cardHolder.card_number ?? "—",
        card_status:    cardHolder.card_status ?? "unknown",
      };
      setStudent(scanned);

      if (mode === "discipline") {
        const records = await supabaseDisciplineService.studentList(user.school_id, cardHolder.student_id);
        setDisciplineData(records.slice(0, 5));
      } else if (mode === "health") {
        const records = await supabaseHealthService.studentList(user.school_id, cardHolder.student_id);
        setHealthData(records.slice(0, 5));
      } else {
        const client = getSafeBrowserClient();
        if (client) {
          const { data } = await client
            .from("attendance_records")
            .select("status, attendance_date")
            .eq("school_id", user.school_id)
            .eq("student_id", cardHolder.student_id)
            .order("attendance_date", { ascending: false })
            .limit(60);
          const rows = data ?? [];
          const present = rows.filter(r => r.status === "present").length;
          const late    = rows.filter(r => r.status === "late").length;
          const absent  = rows.filter(r => r.status === "absent").length;
          setAttendance({
            total:   rows.length,
            present,
            late,
            absent,
            rate: rows.length > 0 ? Math.round(((present + late) / rows.length) * 100) : 0,
          });
        }
      }
      setPhase("found");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Card not found or lookup failed");
      setPhase("error");
    }
  }, [mode, stopListen, user]);

  const startScanning = useCallback(() => {
    if (isSupported) startListen(handleNFCTap);
  }, [isSupported, startListen, handleNFCTap]);

  useEffect(() => {
    startScanning();
    return () => { stopListen(); };
  }, []);

  function reset() {
    setPhase("scanning");
    setStudent(null);
    setDisciplineData(null);
    setHealthData(null);
    setAttendance(null);
    setErrorMsg(null);
    startScanning();
  }

  const { title, iconBg, iconColor, Icon } = MODE_CONFIG[mode];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon size={16} className={iconColor} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">{title}</p>
              <p className="text-xs text-gray-400">via NFC Card Tap</p>
            </div>
          </div>
          <button onClick={() => { stopListen(); onClose(); }} className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* Scanning */}
          {phase === "scanning" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {isSupported ? (
                <>
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                      <Wifi size={32} className="text-blue-500" />
                    </div>
                    {listening && (
                      <>
                        <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-60" />
                        <div className="absolute -inset-2 rounded-full border border-blue-200 animate-ping opacity-30" style={{ animationDelay: "0.3s" }} />
                      </>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">
                      {listening ? "Ready — tap an NFC card" : "Starting NFC scanner…"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Hold the NFC card near the back of your phone</p>
                  </div>
                  {nfcError && <p className="text-xs text-red-500 text-center px-4">{nfcError}</p>}
                  {listening && (
                    <button onClick={() => { stopListen(); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
                      <StopCircle size={14} /> Cancel
                    </button>
                  )}
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-400">Or use Virtual Tap:</p>
                    <VirtualCardTap onTap={(cn) => handleNFCTap({ type: "text", value: cn })} />
                  </div>
                </>
              ) : (
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle size={28} className="text-orange-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">NFC Hardware Unavailable</p>
                  <p className="text-xs text-gray-400">Web NFC requires Chrome on Android.</p>
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-500 font-medium">Test with virtual card tap:</p>
                    <VirtualCardTap onTap={(cn) => handleNFCTap({ type: "text", value: cn })} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 size={28} className="animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">Looking up student…</p>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle size={28} className="text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Card Not Found</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">{errorMsg}</p>
              </div>
              <button onClick={reset} className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                Scan Again
              </button>
            </div>
          )}

          {/* Found */}
          {phase === "found" && student && (
            <div className="space-y-4">
              {/* Student banner */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                {student.photo ? (
                  <img src={student.photo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-blue-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{student.name}</p>
                  <p className="text-xs text-gray-500">{student.class} · {student.student_code}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                    <CreditCard size={10} /> {student.card_number.slice(-8)}
                  </p>
                  <p className="text-xs font-bold text-blue-600">{student.wallet_balance.toLocaleString()} RWF</p>
                </div>
              </div>

              {/* Report mode: attendance summary */}
              {mode === "report" && attendance !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Calendar size={11} /> Attendance (last {attendance.total} records)
                  </p>
                  {attendance.total === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-400">No attendance records yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Rate",    value: `${attendance.rate}%`, color: attendance.rate >= 75 ? "text-green-600" : "text-red-500" },
                        { label: "Present", value: attendance.present,    color: "text-green-600" },
                        { label: "Late",    value: attendance.late,       color: "text-orange-500" },
                        { label: "Absent",  value: attendance.absent,     color: "text-red-500" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <p className={`text-lg font-bold ${color}`}>{value}</p>
                          <p className="text-xs text-gray-400">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Discipline */}
              {mode === "discipline" && disciplineData !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {disciplineData.length === 0 ? "No Records" : `${disciplineData.length} Recent Record${disciplineData.length > 1 ? "s" : ""}`}
                  </p>
                  {disciplineData.length === 0 ? (
                    <div className="text-center py-6 bg-green-50 rounded-xl">
                      <p className="text-sm font-medium text-green-600">Clean Record</p>
                      <p className="text-xs text-green-500 mt-1">No discipline issues found</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {disciplineData.map((d) => (
                        <div key={d.id} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-700">{d.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${SEV_COLOR[d.severity] || "bg-gray-100 text-gray-500"}`}>{d.severity}</span>
                          </div>
                          {d.description && <p className="text-xs text-gray-400 mt-1">{d.description}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[d.type] || "bg-gray-100 text-gray-500"}`}>{d.type}</span>
                            <span className="text-xs text-gray-300">{new Date(d.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Health */}
              {mode === "health" && healthData !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {healthData.length === 0 ? "No Records" : `${healthData.length} Recent Record${healthData.length > 1 ? "s" : ""}`}
                  </p>
                  {healthData.length === 0 ? (
                    <div className="text-center py-6 bg-green-50 rounded-xl">
                      <p className="text-sm font-medium text-green-600">No Health Issues</p>
                      <p className="text-xs text-green-500 mt-1">No clinic visits recorded</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {healthData.map((h) => (
                        <div key={h.id} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-gray-700">{h.title}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${HEALTH_SEV_COLOR[h.severity] || "bg-gray-100 text-gray-500"}`}>{h.severity}</span>
                          </div>
                          {h.description && <p className="text-xs text-gray-400 mt-1">{h.description}</p>}
                          {h.treatment_given && <p className="text-xs text-blue-600 mt-1">Treatment: {h.treatment_given}</p>}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${HEALTH_TYPE_COLOR[h.type] || "bg-gray-100 text-gray-500"}`}>{h.type}</span>
                            <div className="flex items-center gap-2">
                              {h.follow_up_required && <span className="text-xs text-orange-500 font-medium">Follow-up needed</span>}
                              {h.resolved_at && <span className="text-xs text-green-500">Resolved</span>}
                              <span className="text-xs text-gray-300">{new Date(h.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={reset} className="w-full py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2 transition">
                <Wifi size={14} /> Tap Another Card
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
