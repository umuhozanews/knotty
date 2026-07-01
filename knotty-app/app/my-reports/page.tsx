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
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Academic Reports</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : data.length === 0 ? (
          <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-10 text-center">
            <GraduationCap size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No published reports yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.map((rep) => {
              const grades = rep.grades as Record<string, unknown>;
              const meta = (grades?._meta as { decision?: string }) ?? {};
              const subjects = Object.entries(grades).filter(([k]) => k !== "_meta") as [string, { total?: number; max_total?: number; grade?: string; percentage?: number }][];

              return (
                <div key={rep.id} className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-5 shadow-none">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-lg font-extrabold tracking-tight text-[#121212]">{TERM_LABEL[rep.term] ?? rep.term} · {rep.academic_year}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {meta.decision && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md border border-[#dcd9d9] bg-[#fcf9f8] text-[#121212]">
                            {meta.decision.replace("_", " ")}
                          </span>
                        )}
                        {rep.position_in_class && (
                          <span className="text-xs text-gray-500">Position: <span className="font-bold text-[#121212]">#{rep.position_in_class}</span></span>
                        )}
                        {rep.average !== null && rep.average !== undefined && (
                          <span className="text-xs text-gray-500">Average: <span className="font-bold text-[#121212]">{rep.average.toFixed(1)}%</span></span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(rep.id, rep.term, rep.academic_year)}
                      disabled={downloading === rep.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] hover:bg-[#dcd9d9] hover:text-[#121212] text-white rounded-lg text-xs font-bold transition duration-200 border border-[#121212] disabled:opacity-50"
                    >
                      {downloading === rep.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      Download PDF
                    </button>
                  </div>

                  {/* Subject table */}
                  <div className="rounded-lg overflow-hidden border border-[#dcd9d9]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#fcf9f8] border-b border-[#dcd9d9]">
                          <th className="text-left px-3 py-2 font-bold text-gray-500 uppercase tracking-wider">Subject</th>
                          <th className="text-center px-2 py-2 font-bold text-gray-500 uppercase tracking-wider">CAT</th>
                          <th className="text-center px-2 py-2 font-bold text-gray-500 uppercase tracking-wider">Exam</th>
                          <th className="text-center px-2 py-2 font-bold text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="text-center px-2 py-2 font-bold text-gray-500 uppercase tracking-wider">%</th>
                          <th className="text-center px-2 py-2 font-bold text-gray-500 uppercase tracking-wider">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map(([name, subData]) => {
                          const getSubjectDisplayData = (data: any) => {
                            if (!data || typeof data !== "object") return { cat: "—", exam: "—", total: "—", percentage: "—", grade: "—" };

                            if ("eu" in data || "pr" in data || "et" in data) {
                              const euVal = parseFloat(data.eu) || 0;
                              const prVal = parseFloat(data.pr) || 0;
                              const etVal = parseFloat(data.et) || 0;
                              
                              const total = euVal + prVal + etVal;
                              let grade = "F";
                              if (total >= 80) grade = "A";
                              else if (total >= 75) grade = "B";
                              else if (total >= 70) grade = "C";
                              else if (total >= 65) grade = "D";
                              else if (total >= 50) grade = "E";
                              else if (total >= 40) grade = "S";

                              return {
                                cat: `${(euVal + prVal).toFixed(1)} / 50`,
                                exam: `${etVal.toFixed(1)} / 50`,
                                total: total.toFixed(1),
                                percentage: `${total.toFixed(0)}%`,
                                grade
                              };
                            }

                            return {
                              cat: data.cat ?? "—",
                              exam: data.exam ?? "—",
                              total: data.total ?? "—",
                              percentage: data.percentage !== undefined ? `${data.percentage.toFixed(1)}%` : "—",
                              grade: data.grade ?? "—"
                            };
                          };

                          const display = getSubjectDisplayData(subData);

                          return (
                            <tr key={name} className="border-t border-[#dcd9d9] hover:bg-[#fcf9f8]/50 transition-colors">
                              <td className="px-3 py-2 font-bold text-[#121212]">{name}</td>
                              <td className="text-center px-2 py-2 text-gray-600 font-semibold">{display.cat}</td>
                              <td className="text-center px-2 py-2 text-gray-600 font-semibold">{display.exam}</td>
                              <td className="text-center px-2 py-2 text-[#121212] font-bold">{display.total}</td>
                              <td className="text-center px-2 py-2 text-[#121212] font-bold">{display.percentage}</td>
                              <td className="text-center px-2 py-2">
                                {display.grade && (
                                  <span className="font-bold px-2 py-0.5 rounded border border-[#dcd9d9] bg-[#ffffff] text-[#121212]">{display.grade}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {rep.principal_remarks && (
                    <div className="mt-3 bg-[#fcf9f8] p-3 rounded-lg border border-[#dcd9d9] text-xs text-gray-600 font-semibold italic">
                      "{rep.principal_remarks}"
                    </div>
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
