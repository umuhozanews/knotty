"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, reports, AcademicReport } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, FileText, Download, GraduationCap } from "lucide-react";

const DECISION_COLOR: Record<string, string> = {
  PROMOTED:       "bg-green-100 text-green-700",
  SECOND_SITTING: "bg-yellow-100 text-yellow-700",
  REPEAT:         "bg-red-100 text-red-700",
};

const TERM_LABEL: Record<string, string> = { TERM1: "Term 1", TERM2: "Term 2", TERM3: "Term 3" };

export default function MyReportsPage() {
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<AcademicReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    myAccount.reports(1, 10).then((r) => setData(r.data as AcademicReport[])).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  async function handleDownload(id: string, term: string, year: string) {
    setDownloading(id);
    try {
      const blob = await reports.downloadPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report-${term}-${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <DashboardShell>
      <div className="p-4 overflow-y-auto h-full space-y-4">
        <h1 className="text-xl font-bold text-gray-800">My Academic Reports</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <GraduationCap size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No published reports yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((rep) => {
              const grades = rep.grades as Record<string, unknown>;
              const meta = (grades?._meta as { decision?: string }) ?? {};
              const subjects = Object.entries(grades).filter(([k]) => k !== "_meta") as [string, { total?: number; max_total?: number; grade?: string; percentage?: number }][];

              return (
                <div key={rep.id} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-base font-bold text-gray-800">{TERM_LABEL[rep.term] ?? rep.term} · {rep.academic_year}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {meta.decision && (
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${DECISION_COLOR[meta.decision] ?? "bg-gray-100 text-gray-600"}`}>
                            {meta.decision.replace("_", " ")}
                          </span>
                        )}
                        {rep.position_in_class && (
                          <span className="text-xs text-gray-400">Position: <span className="font-medium text-gray-700">{rep.position_in_class}</span></span>
                        )}
                        {rep.average !== null && rep.average !== undefined && (
                          <span className="text-xs text-gray-400">Average: <span className="font-medium text-gray-700">{rep.average.toFixed(1)}%</span></span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(rep.id, rep.term, rep.academic_year)}
                      disabled={downloading === rep.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition disabled:opacity-50"
                    >
                      {downloading === rep.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      PDF
                    </button>
                  </div>

                  {/* Subject table */}
                  <div className="rounded-xl overflow-hidden border border-gray-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Subject</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-500">CAT</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-500">Exam</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-500">Total</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-500">%</th>
                          <th className="text-center px-2 py-2 font-semibold text-gray-500">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map(([name, data]) => (
                          <tr key={name} className="border-t border-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700">{name}</td>
                            <td className="text-center px-2 py-2 text-gray-600">{(data as { cat?: number }).cat ?? "—"}</td>
                            <td className="text-center px-2 py-2 text-gray-600">{(data as { exam?: number }).exam ?? "—"}</td>
                            <td className="text-center px-2 py-2 text-gray-600">{data.total ?? "—"}</td>
                            <td className="text-center px-2 py-2 text-gray-600">{data.percentage !== undefined ? `${data.percentage.toFixed(1)}%` : "—"}</td>
                            <td className="text-center px-2 py-2">
                              {data.grade && (
                                <span className={`font-bold px-1.5 py-0.5 rounded ${
                                  data.grade === "A" ? "text-green-700 bg-green-50" :
                                  data.grade === "B" ? "text-blue-700 bg-blue-50" :
                                  data.grade === "C" ? "text-yellow-700 bg-yellow-50" :
                                  data.grade === "F" ? "text-red-700 bg-red-50" : "text-gray-700 bg-gray-50"
                                }`}>{data.grade}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rep.principal_remarks && (
                    <p className="mt-3 text-xs text-gray-500 italic">"{rep.principal_remarks}"</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
