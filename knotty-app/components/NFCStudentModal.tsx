"use client";
import { useEffect, useState, useCallback } from "react";
import { X, Loader2, AlertTriangle, BookOpen, ShieldAlert, Wifi, StopCircle, User, Heart } from "lucide-react";
import { useNFC, NFCResult } from "@/hooks/useNFC";
import { cards, discipline, reports, health, CardScanResult, DisciplineRecord, AcademicReport, HealthRecord } from "@/lib/api";

export type NFCMode = "report" | "discipline" | "health";
type Phase = "scanning" | "loading" | "found" | "error";

const SEV_COLOR: Record<string, string> = {
  SERIOUS: "bg-red-50 text-red-500",
  MODERATE: "bg-orange-50 text-orange-500",
  MINOR: "bg-yellow-50 text-yellow-600",
};

const TYPE_COLOR: Record<string, string> = {
  WARNING: "bg-yellow-50 text-yellow-600",
  SUSPENSION: "bg-red-50 text-red-500",
  MISCONDUCT: "bg-orange-50 text-orange-500",
  RULE_VIOLATION: "bg-purple-50 text-purple-500",
  OTHER: "bg-gray-100 text-gray-500",
};

const HEALTH_SEV_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-600",
  HIGH:     "bg-orange-50 text-orange-500",
  MODERATE: "bg-yellow-50 text-yellow-600",
  LOW:      "bg-green-50 text-green-600",
};

const HEALTH_TYPE_COLOR: Record<string, string> = {
  ILLNESS:   "bg-blue-50 text-blue-600",
  INJURY:    "bg-orange-50 text-orange-500",
  CHECKUP:   "bg-green-50 text-green-600",
  EMERGENCY: "bg-red-50 text-red-600",
  OTHER:     "bg-gray-100 text-gray-500",
};

function gradeColor(avg: number | null) {
  if (avg === null) return "text-gray-400";
  if (avg >= 80) return "text-green-600";
  if (avg >= 60) return "text-blue-600";
  if (avg >= 50) return "text-orange-500";
  return "text-red-500";
}

const MODE_CONFIG: Record<NFCMode, { title: string; iconBg: string; iconColor: string; Icon: React.ElementType }> = {
  report:     { title: "Student Report",      iconBg: "bg-blue-50",  iconColor: "text-blue-500",  Icon: BookOpen    },
  discipline: { title: "Discipline Records",  iconBg: "bg-red-50",   iconColor: "text-red-500",   Icon: ShieldAlert },
  health:     { title: "Health Records",      iconBg: "bg-green-50", iconColor: "text-green-600", Icon: Heart       },
};

export default function NFCStudentModal({ mode, onClose }: { mode: NFCMode; onClose: () => void }) {
  const { startListen, stopListen, listening, error: nfcError, isSupported } = useNFC();
  const [phase, setPhase] = useState<Phase>("scanning");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [student, setStudent] = useState<CardScanResult | null>(null);
  const [disciplineData, setDisciplineData] = useState<DisciplineRecord[] | null>(null);
  const [reportData, setReportData]         = useState<AcademicReport[]   | null>(null);
  const [healthData, setHealthData]         = useState<HealthRecord[]      | null>(null);

  const handleNFCTap = useCallback(async (result: NFCResult) => {
    stopListen();
    setPhase("loading");
    try {
      const cardRes = await cards.scanNFC(result.value);
      const studentInfo = cardRes.data;
      setStudent(studentInfo);

      if (mode === "discipline") {
        const res = await discipline.studentList(studentInfo.student.id, 1, 5);
        setDisciplineData(res.data as DisciplineRecord[]);
      } else if (mode === "report") {
        const res = await reports.studentList(studentInfo.student.id, 1, 3);
        setReportData(res.data as AcademicReport[]);
      } else {
        const res = await health.studentList(studentInfo.student.id);
        setHealthData((res.data as HealthRecord[]).slice(0, 5));
      }
      setPhase("found");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Card not found or not registered");
      setPhase("error");
    }
  }, [mode, stopListen]);

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
    setReportData(null);
    setHealthData(null);
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
                      {listening ? "Ready — tap a KNOTTY card" : "Starting NFC scanner…"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Hold the NFC card near the back of your phone</p>
                  </div>
                  {nfcError && <p className="text-xs text-red-500 text-center">{nfcError}</p>}
                  {listening && (
                    <button onClick={() => { stopListen(); onClose(); }} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
                      <StopCircle size={14} /> Cancel
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-3">
                    <AlertTriangle size={28} className="text-orange-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">NFC Not Available</p>
                  <p className="text-xs text-gray-400 mt-1">Web NFC requires Chrome on Android</p>
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
                <p className="text-xs text-gray-400 mt-1">{errorMsg}</p>
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
                {student.student.photo ? (
                  <img src={student.student.photo} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-blue-500" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-800">{student.student.name}</p>
                  <p className="text-xs text-gray-500">{student.student.class} · {student.student.student_code}</p>
                </div>
              </div>

              {/* Report */}
              {mode === "report" && reportData !== null && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {reportData.length === 0 ? "No Reports Yet" : "Recent Report Cards"}
                  </p>
                  {reportData.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-400">No report cards available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reportData.map((r) => (
                        <div key={r.id} className="p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-gray-700">{r.term} · {r.academic_year}</p>
                            {r.average !== null && (
                              <span className={`text-lg font-bold ${gradeColor(r.average)}`}>{r.average.toFixed(1)}%</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {r.position_in_class !== null && (
                              <div className="bg-white rounded-lg p-2">
                                <p className="text-xs text-gray-400">Position</p>
                                <p className="text-sm font-bold text-gray-700">#{r.position_in_class}</p>
                              </div>
                            )}
                            {r.total_marks !== null && (
                              <div className="bg-white rounded-lg p-2">
                                <p className="text-xs text-gray-400">Total Marks</p>
                                <p className="text-sm font-bold text-gray-700">{r.total_marks}</p>
                              </div>
                            )}
                          </div>
                          {r.conduct_grade && (
                            <div className="mt-2 flex items-center gap-1">
                              <span className="text-xs text-gray-400">Conduct:</span>
                              <span className="text-xs font-semibold text-blue-600">{r.conduct_grade}</span>
                            </div>
                          )}
                          {r.teacher_remarks && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{r.teacher_remarks}"</p>
                          )}
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
                          {h.treatment_given && (
                            <p className="text-xs text-blue-600 mt-1">Treatment: {h.treatment_given}</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${HEALTH_TYPE_COLOR[h.type] || "bg-gray-100 text-gray-500"}`}>{h.type}</span>
                            <div className="flex items-center gap-2">
                              {h.follow_up_required && (
                                <span className="text-xs text-orange-500 font-medium">Follow-up needed</span>
                              )}
                              {h.resolved_at && (
                                <span className="text-xs text-green-500">Resolved</span>
                              )}
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
