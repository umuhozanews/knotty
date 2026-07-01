"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Plus, Download, FileText, CheckCircle, Search, Edit, Trash2,
  Users, ChevronRight, X, AlertCircle, BookOpen, Award, BarChart2, Eye, RefreshCw
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { reports, students, structure, Student, AcademicReport, Class, Level } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// ─── Grade helper ─────────────────────────────────────────────────────────────
function gradeFromPct(pct: number) {
  if (pct >= 80) return { letter: "A", color: "text-green-700 bg-green-50" };
  if (pct >= 75) return { letter: "B", color: "text-emerald-700 bg-emerald-50" };
  if (pct >= 70) return { letter: "C", color: "text-blue-700 bg-blue-50" };
  if (pct >= 65) return { letter: "D", color: "text-yellow-700 bg-yellow-50" };
  if (pct >= 50) return { letter: "E", color: "text-orange-700 bg-orange-50" };
  if (pct >= 40) return { letter: "S", color: "text-purple-700 bg-purple-50" };
  return { letter: "F", color: "text-red-700 bg-red-50" };
}

// ─── Create / Edit Report Modal ───────────────────────────────────────────────
interface SubjectRow { name: string; eu: string; pr: string; et: string }

const DEFAULT_SUBJECTS: SubjectRow[] = [
  { name: "Mathematics", eu: "", pr: "", et: "" },
  { name: "Physics", eu: "", pr: "", et: "" },
  { name: "Chemistry", eu: "", pr: "", et: "" },
  { name: "Biology", eu: "", pr: "", et: "" },
  { name: "English", eu: "", pr: "", et: "" },
];

function calcRow(eu: string, pr: string, et: string) {
  const e = parseFloat(eu) || 0;
  const p = parseFloat(pr) || 0;
  const t = parseFloat(et) || 0;
  const total = e + p + t;
  return { total, grade: gradeFromPct(total) };
}

function ReportModal({
  student, report: existing, schoolId, onClose, onSuccess,
}: {
  student: Student;
  report?: AcademicReport | null;
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SubjectRow[]>(() => {
    if (existing?.grades && typeof existing.grades === "object") {
      const gm = existing.grades as Record<string, { eu?: number | null; pr?: number | null; et?: number | null }>;
      const parsed = Object.entries(gm).map(([name, v]) => ({
        name,
        eu: v.eu != null ? String(v.eu) : "",
        pr: v.pr != null ? String(v.pr) : "",
        et: v.et != null ? String(v.et) : "",
      }));
      if (parsed.length > 0) return parsed;
    }
    return DEFAULT_SUBJECTS;
  });
  const [form, setForm] = useState({
    term: existing?.term ?? "TERM1",
    academic_year: existing?.academic_year ?? "2025-2026",
    conduct_grade: existing?.conduct_grade ?? "38",
    position_in_class: existing?.position_in_class ? String(existing.position_in_class) : "",
    teacher_remarks: existing?.teacher_remarks ?? "",
    principal_remarks: existing?.principal_remarks ?? "",
  });
  const [loading, setLoading] = useState(false);

  const totalMarks = subjects.reduce((s, r) => s + calcRow(r.eu, r.pr, r.et).total, 0);
  const average = subjects.length > 0 ? totalMarks / subjects.length : 0;

  function setSubj(i: number, field: keyof SubjectRow, val: string) {
    setSubjects((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const gradesPayload: Record<string, { eu: number | null; pr: number | null; et: number | null }> = {};
      subjects.forEach((s) => {
        if (s.name.trim()) {
          gradesPayload[s.name.trim()] = {
            eu: s.eu ? parseFloat(s.eu) : null,
            pr: s.pr ? parseFloat(s.pr) : null,
            et: s.et ? parseFloat(s.et) : null,
          };
        }
      });

      const payload = {
        student_id: student.id,
        school_id: schoolId,
        class_id: student.class?.id,
        term: form.term,
        academic_year: form.academic_year,
        grades: gradesPayload,
        total_marks: Math.round(totalMarks),
        average: parseFloat(average.toFixed(1)),
        position_in_class: form.position_in_class ? parseInt(form.position_in_class) : null,
        teacher_remarks: form.teacher_remarks || null,
        principal_remarks: form.principal_remarks || null,
        conduct_grade: form.conduct_grade || "38",
      };

      if (existing) {
        await reports.update(existing.id, payload);
        toast("Report updated", "success");
      } else {
        await reports.create(payload);
        toast("Report card created", "success");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save report", "error");
    } finally {
      setLoading(false);
    }
  }

  const inp2 = "w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 bg-white text-center";

  return (
    <div className="fixed inset-0 bg-black/55 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800 text-base">
              {existing ? "Edit Report Card" : "Create Report Card"}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {student.user.first_name} {student.user.last_name} · {student.student_code} · {student.class?.name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={submit}>
          {/* Term / Year / Conduct row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b border-gray-50 bg-gray-50/50">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Term</label>
              <select
                value={form.term}
                onChange={(e) => setForm((f) => ({ ...f, term: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white"
              >
                {["TERM1", "TERM2", "TERM3"].map((t) => (
                  <option key={t} value={t}>{t.replace("TERM", "Term ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Academic Year</label>
              <input
                value={form.academic_year}
                onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Conduct (Max 40)</label>
              <input
                type="number" min="0" max="40" step="0.5"
                value={form.conduct_grade}
                onChange={(e) => setForm((f) => ({ ...f, conduct_grade: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white text-center"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Class Rank</label>
              <input
                type="number" min="1"
                value={form.position_in_class}
                onChange={(e) => setForm((f) => ({ ...f, position_in_class: e.target.value }))}
                placeholder="e.g. 3"
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white text-center"
              />
            </div>
          </div>

          {/* Subject marks table */}
          <div className="p-5">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-3 py-2.5">Subject</th>
                    <th className="px-3 py-2.5 text-center w-24">EU /25</th>
                    <th className="px-3 py-2.5 text-center w-24">PR /25</th>
                    <th className="px-3 py-2.5 text-center w-24">ET /50</th>
                    <th className="px-3 py-2.5 text-center w-20">Total</th>
                    <th className="px-3 py-2.5 text-center w-14">Grade</th>
                    <th className="px-3 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {subjects.map((row, i) => {
                    const { total, grade } = calcRow(row.eu, row.pr, row.et);
                    return (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="p-1.5">
                          <input
                            value={row.name}
                            onChange={(e) => setSubj(i, "name", e.target.value)}
                            placeholder="Subject name"
                            className="w-full px-2.5 py-1.5 border border-transparent hover:border-gray-200 focus:border-blue-500 focus:bg-white rounded-lg outline-none text-sm font-medium transition"
                          />
                        </td>
                        <td className="p-1.5">
                          <input type="number" min="0" max="25" step="0.1" value={row.eu}
                            onChange={(e) => setSubj(i, "eu", e.target.value)}
                            placeholder="—" className={inp2} />
                        </td>
                        <td className="p-1.5">
                          <input type="number" min="0" max="25" step="0.1" value={row.pr}
                            onChange={(e) => setSubj(i, "pr", e.target.value)}
                            placeholder="—" className={inp2} />
                        </td>
                        <td className="p-1.5">
                          <input type="number" min="0" max="50" step="0.1" value={row.et}
                            onChange={(e) => setSubj(i, "et", e.target.value)}
                            placeholder="—" className={inp2} />
                        </td>
                        <td className="p-1.5 text-center font-bold text-sm text-gray-700">
                          {(row.eu || row.pr || row.et) ? total.toFixed(1) : "—"}
                        </td>
                        <td className="p-1.5 text-center">
                          {(row.eu || row.pr || row.et) && (
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${grade.color}`}>
                              {grade.letter}
                            </span>
                          )}
                        </td>
                        <td className="p-1.5 text-center">
                          <button type="button" onClick={() => setSubjects((s) => s.filter((_, idx) => idx !== i))}
                            className="text-gray-300 hover:text-red-500 transition">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer: add row + totals */}
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50/50 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSubjects((s) => [...s, { name: "", eu: "", pr: "", et: "" }])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus size={12} /> Add Subject
                </button>
                <div className="flex gap-5 text-xs font-semibold text-gray-500 mr-2">
                  <span>Total: <strong className="text-gray-800">{totalMarks.toFixed(1)}</strong></span>
                  <span>Average: <strong className={`text-sm ${gradeFromPct(average).color.split(" ")[0]}`}>{average.toFixed(1)}%</strong></span>
                  <span className={`px-2 py-0.5 rounded font-bold ${gradeFromPct(average).color}`}>
                    {gradeFromPct(average).letter}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Teacher Remarks</label>
                <textarea
                  value={form.teacher_remarks}
                  onChange={(e) => setForm((f) => ({ ...f, teacher_remarks: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 bg-white"
                  placeholder="e.g. Excellent performance this term."
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Headteacher Remarks</label>
                <textarea
                  value={form.principal_remarks}
                  onChange={(e) => setForm((f) => ({ ...f, principal_remarks: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-blue-500 bg-white"
                  placeholder="e.g. Keep up the high standard."
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-5 pb-5 pt-2 border-t border-gray-100 justify-end">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium transition">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-60 transition flex items-center gap-2 min-w-32 justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {existing ? "Save Changes" : "Create Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Student Report Card Row ──────────────────────────────────────────────────
function StudentReportRow({
  student, term, academicYear, onCreateReport, onEditReport, onViewReport, onDownloadPDF, onPublish,
}: {
  student: Student & { reports?: AcademicReport[] };
  term: string;
  academicYear: string;
  onCreateReport: (s: Student) => void;
  onEditReport: (s: Student, r: AcademicReport) => void;
  onViewReport: (s: Student, r: AcademicReport) => void;
  onDownloadPDF: (id: string) => void;
  onPublish: (id: string) => void;
}) {
  const report = student.reports?.find((r) => r.term === term && r.academic_year === academicYear) ?? null;
  const name = `${student.user.first_name} ${student.user.last_name}`;
  const avg = report?.average;
  const grade = avg != null ? gradeFromPct(avg) : null;

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-gray-50 rounded-xl transition group border border-transparent hover:border-gray-100">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 flex-shrink-0">
        {name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
      </div>

      {/* Name & code */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{name}</p>
        <p className="text-xs text-gray-400 font-mono">{student.student_code}</p>
      </div>

      {/* Report status */}
      <div className="flex items-center gap-3">
        {report ? (
          <>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">{avg != null ? `${avg.toFixed(1)}%` : "—"}</p>
              {report.position_in_class && (
                <p className="text-xs text-gray-400">Rank #{report.position_in_class}</p>
              )}
            </div>
            {grade && (
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold ${grade.color}`}>
                {grade.letter}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              report.is_published ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
            }`}>
              {report.is_published ? "Published" : "Draft"}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              {!report.is_published && (
                <button onClick={() => onEditReport(student, report)}
                  title="Edit"
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition">
                  <Edit size={12} />
                </button>
              )}
              {!report.is_published && (
                <button onClick={() => onPublish(report.id)}
                  title="Publish"
                  className="p-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition">
                  <CheckCircle size={12} />
                </button>
              )}
              <button onClick={() => onDownloadPDF(report.id)}
                title="Download PDF"
                className="p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                <Download size={12} />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => onCreateReport(student)}
            className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-xl transition font-medium"
          >
            <Plus size={12} /> Create Report
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [studentReports, setStudentReports] = useState<Record<string, AcademicReport[]>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState("TERM1");
  const [selectedYear, setSelectedYear] = useState("2025-2026");
  const [search, setSearch] = useState("");

  const [modalStudent, setModalStudent] = useState<Student | null>(null);
  const [editingReport, setEditingReport] = useState<AcademicReport | null>(null);

  // Search panel for finding students across all classes
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState<Student[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load structure
  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([structure.levels(), structure.classes()])
      .then(([lvls, clss]) => {
        const sorted = [...lvls.data].sort((a, b) => a.name.localeCompare(b.name));
        setLevels(sorted);
        setClasses(clss.data);
        if (sorted.length > 0) {
          setSelectedLevel(sorted[0].id);
          const first = clss.data.find((c) => c.level.id === sorted[0].id);
          if (first) setSelectedClass(first.id);
        }
      })
      .catch(console.error);
  }, [user?.id, authLoading]);

  // Load students for selected class
  useEffect(() => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    setClassStudents([]);
    setStudentReports({});
    students.list({ classId: selectedClass, limit: 100 })
      .then((res) => {
        setClassStudents(res.data);
        return res.data;
      })
      .then(async (studs) => {
        // Load reports for each student (parallel)
        setLoadingReports(true);
        const results = await Promise.all(
          studs.map((s) =>
            reports.studentList(s.id).then((r) => ({ id: s.id, reports: r.data })).catch(() => ({ id: s.id, reports: [] }))
          )
        );
        const map: Record<string, AcademicReport[]> = {};
        results.forEach(({ id, reports: rs }) => { map[id] = rs; });
        setStudentReports(map);
      })
      .catch(console.error)
      .finally(() => { setLoadingStudents(false); setLoadingReports(false); });
  }, [selectedClass]);

  // Global student search
  useEffect(() => {
    if (!globalSearch.trim()) { setGlobalResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setGlobalSearching(true);
      try {
        const r = await students.list({ search: globalSearch, limit: 8 });
        setGlobalResults(r.data);
      } catch { /* ignore */ }
      finally { setGlobalSearching(false); }
    }, 300);
  }, [globalSearch]);

  function refreshClass() {
    if (!selectedClass) return;
    setLoadingStudents(true);
    students.list({ classId: selectedClass, limit: 100 })
      .then(async (res) => {
        setClassStudents(res.data);
        setLoadingReports(true);
        const results = await Promise.all(
          res.data.map((s) =>
            reports.studentList(s.id).then((r) => ({ id: s.id, reports: r.data })).catch(() => ({ id: s.id, reports: [] }))
          )
        );
        const map: Record<string, AcademicReport[]> = {};
        results.forEach(({ id, reports: rs }) => { map[id] = rs; });
        setStudentReports(map);
      })
      .catch(console.error)
      .finally(() => { setLoadingStudents(false); setLoadingReports(false); });
  }

  async function downloadPDF(id: string) {
    try {
      const blob = await reports.downloadPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast("PDF downloaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "PDF download failed", "error");
    }
  }

  async function publishReport(id: string) {
    try {
      await reports.publish(id);
      toast("Report published — students can now view it", "success");
      refreshClass();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to publish", "error");
    }
  }

  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const currentLevelClasses = selectedLevel ? classes.filter((c) => c.level.id === selectedLevel) : [];

  const filtered = search.trim()
    ? classStudents.filter((s) =>
        `${s.user.first_name} ${s.user.last_name} ${s.student_code}`.toLowerCase().includes(search.toLowerCase())
      )
    : classStudents;

  // Stats for the selected term / year
  const withReport = classStudents.filter((s) =>
    studentReports[s.id]?.some((r) => r.term === selectedTerm && r.academic_year === selectedYear)
  );
  const published = withReport.filter((s) =>
    studentReports[s.id]?.find((r) => r.term === selectedTerm && r.academic_year === selectedYear)?.is_published
  );
  const avgOfClass =
    withReport.length > 0
      ? withReport.reduce((sum, s) => {
          const rep = studentReports[s.id]?.find((r) => r.term === selectedTerm && r.academic_year === selectedYear);
          return sum + (rep?.average ?? 0);
        }, 0) / withReport.length
      : null;

  return (
    <DashboardShell>
      <div className="flex flex-col md:flex-row h-[calc(100dvh-4rem)]">
        {/* ── Mobile class picker ──────────────────────────────────── */}
        <div className="md:hidden flex overflow-x-auto gap-2 p-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => { setSelectedClass(cls.id); setSelectedLevel(cls.level.id); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${selectedClass === cls.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
            >
              {cls.level?.name} {cls.name}
            </button>
          ))}
        </div>

        {/* ── Sidebar (desktop only) ────────────────────────────────── */}
        <div className="hidden md:block w-56 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Classes</h2>
            {levels.map((level) => {
              const levelClasses = classes.filter((c) => c.level.id === level.id);
              const isOpen = selectedLevel === level.id;
              return (
                <div key={level.id} className="mb-1">
                  <button
                    onClick={() => {
                      setSelectedLevel(level.id);
                      if (!isOpen && levelClasses.length > 0) setSelectedClass(levelClasses[0].id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${
                      isOpen ? "bg-blue-600/10 text-blue-700" : "text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    <span>{level.name}</span>
                    <span className="text-xs font-normal text-gray-400">{levelClasses.length}</span>
                  </button>
                  {isOpen && levelClasses.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls.id)}
                      className={`w-full flex items-center justify-between pl-6 pr-3 py-1.5 rounded-xl text-xs transition ${
                        selectedClass === cls.id
                          ? "bg-blue-600 text-white font-medium"
                          : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <span>Class {cls.name}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main Panel ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap">
            <div className="flex-1 min-w-0">
              {selectedClassObj && (
                <div>
                  <h1 className="text-base font-bold text-gray-800 dark:text-gray-100">
                    {levels.find((l) => l.id === selectedLevel)?.name} — Class {selectedClassObj.name}
                  </h1>
                  <p className="text-xs text-gray-400">{classStudents.length} students</p>
                </div>
              )}
            </div>

            {/* Term / Year selectors */}
            <div className="flex items-center gap-2">
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 font-medium"
              >
                {["TERM1", "TERM2", "TERM3"].map((t) => (
                  <option key={t} value={t}>{t.replace("TERM", "Term ")}</option>
                ))}
              </select>
              <input
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 w-24"
              />
              <button onClick={refreshClass} title="Refresh" className="p-1.5 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition">
                <RefreshCw size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-1.5 min-w-40">
              <Search size={12} className="text-gray-400 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter students…"
                className="bg-transparent text-xs outline-none flex-1 text-gray-700 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Stats bar */}
          {classStudents.length > 0 && (
            <div className="flex items-center gap-6 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50 dark:bg-gray-800/50 text-xs text-gray-500">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-blue-500" />
                <span>{classStudents.length} students</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText size={12} className="text-green-500" />
                <span>{withReport.length} reports created</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={12} className="text-emerald-500" />
                <span>{published.length} published</span>
              </div>
              {avgOfClass != null && (
                <div className="flex items-center gap-1.5">
                  <BarChart2 size={12} className="text-purple-500" />
                  <span>Class avg: <strong>{avgOfClass.toFixed(1)}%</strong></span>
                </div>
              )}
              {loadingReports && <Loader2 size={11} className="animate-spin text-gray-400 ml-auto" />}
            </div>
          )}

          {/* Student list */}
          <div className="flex-1 overflow-y-auto">
            {!selectedClass ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <BookOpen size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">Select a class from the sidebar</p>
              </div>
            ) : loadingStudents ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-500 text-sm font-medium">No students in this class</p>
              </div>
            ) : (
              <div className="p-4 space-y-0.5">
                {filtered.map((s) => (
                  <StudentReportRow
                    key={s.id}
                    student={{ ...s, reports: studentReports[s.id] ?? [] }}
                    term={selectedTerm}
                    academicYear={selectedYear}
                    onCreateReport={(st) => { setModalStudent(st); setEditingReport(null); }}
                    onEditReport={(st, r) => { setModalStudent(st); setEditingReport(r); }}
                    onViewReport={(st, r) => { setModalStudent(st); setEditingReport(r); }}
                    onDownloadPDF={downloadPDF}
                    onPublish={publishReport}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalStudent && (
        <ReportModal
          student={modalStudent}
          report={editingReport}
          schoolId={user?.school_id ?? ""}
          onClose={() => { setModalStudent(null); setEditingReport(null); }}
          onSuccess={refreshClass}
        />
      )}
    </DashboardShell>
  );
}
