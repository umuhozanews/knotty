"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Download, FileText, CheckCircle, Search } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { reports, students, structure, Student, AcademicReport, Class } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function CreateReportModal({ schoolId, onClose, onSuccess }: { schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState({
    class_id: "", term: "TERM1", academic_year: "2025-2026",
    grades: "", total_marks: "", average: "", position_in_class: "",
    teacher_remarks: "", principal_remarks: "", conduct_grade: "A",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    structure.classes().then((r) => setClasses(r.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await students.list({ search, limit: 6 }); setResults(r.data); } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      let grades: unknown = {};
      try { grades = JSON.parse(form.grades || "{}"); } catch { grades = {}; }
      await reports.create({
        student_id: selected.id,
        school_id: schoolId,
        class_id: form.class_id || selected.class?.id || classes[0]?.id,
        term: form.term,
        academic_year: form.academic_year,
        grades,
        total_marks: form.total_marks ? parseInt(form.total_marks) : null,
        average: form.average ? parseFloat(form.average) : null,
        position_in_class: form.position_in_class ? parseInt(form.position_in_class) : null,
        teacher_remarks: form.teacher_remarks || null,
        principal_remarks: form.principal_remarks || null,
        conduct_grade: form.conduct_grade,
      });
      onSuccess(); onClose();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-800 mb-4">Create Academic Report</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Student</label>
            {selected ? (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
                <span className="text-sm font-medium text-blue-600">{selected.user.first_name} {selected.user.last_name} · {selected.student_code}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-gray-400">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                    {results.map((s) => <button key={s.id} type="button" onClick={() => { setSelected(s); setSearch(""); setResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s.user.first_name} {s.user.last_name}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Term</label>
              <select value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {["TERM1", "TERM2", "TERM3"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Academic Year</label>
              <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Class</label>
            <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="">Auto-detect from student</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.level.name} {c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Total Marks</label>
              <input type="number" value={form.total_marks} onChange={(e) => setForm({ ...form, total_marks: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Average (%)</label>
              <input type="number" step="0.1" value={form.average} onChange={(e) => setForm({ ...form, average: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Position</label>
              <input type="number" value={form.position_in_class} onChange={(e) => setForm({ ...form, position_in_class: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Grades (JSON)</label>
            <textarea value={form.grades} onChange={(e) => setForm({ ...form, grades: e.target.value })} placeholder='{"Math": 85, "English": 78}' rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Teacher Remarks</label>
              <textarea value={form.teacher_remarks} onChange={(e) => setForm({ ...form, teacher_remarks: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Principal Remarks</label>
              <textarea value={form.principal_remarks} onChange={(e) => setForm({ ...form, principal_remarks: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Conduct Grade</label>
            <select value={form.conduct_grade} onChange={(e) => setForm({ ...form, conduct_grade: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              {["A", "B", "C", "D", "F"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading || !selected} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reportList, setReportList] = useState<(AcademicReport & { student?: { user: { first_name: string; last_name: string }; student_code: string } })[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  async function loadReports(sid: string) {
    if (!sid) { setReportList([]); setTotal(0); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await reports.studentList(sid);
      setReportList(r.data as typeof reportList);
      const p = r.pagination as { total: number };
      setTotal(p.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!authLoading) loadReports(studentId); }, [studentId, authLoading]);

  useEffect(() => {
    if (authLoading || !search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await students.list({ search, limit: 6 }); setSearchResults(r.data); } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, authLoading]);

  async function downloadPDF(id: string) {
    try {
      const blob = await reports.downloadPDF(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `report-${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err instanceof Error ? err.message : "PDF failed"); }
  }

  async function publishReport(id: string) {
    try {
      await reports.publish(id);
      setReportList((r) => r.map((x) => x.id === id ? { ...x, is_published: true } : x));
    } catch (err) { alert(err instanceof Error ? err.message : "Publish failed"); }
  }

  return (
    <DashboardShell>
      {showModal && <CreateReportModal schoolId={user?.school_id ?? ""} onClose={() => setShowModal(false)} onSuccess={() => loadReports(studentId)} />}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Academic Reports</h1>
            <p className="text-sm text-gray-400">{total > 0 ? `${total} reports` : "Search a student to view reports"}</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Create Report
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="relative max-w-sm mb-4">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Search size={14} className="text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student to view reports…" className="outline-none bg-transparent text-sm flex-1" />
              {searching && <Loader2 size={13} className="animate-spin text-gray-400" />}
            </div>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                {searchResults.map((s) => (
                  <button key={s.id} onClick={() => { setStudentId(s.id); setSearch(`${s.user.first_name} ${s.user.last_name}`); setSearchResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                    {s.user.first_name} {s.user.last_name} <span className="text-gray-400 text-xs">{s.student_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!studentId ? (
            <div className="flex flex-col items-center py-16 text-gray-300">
              <FileText size={40} className="mb-2" />
              <p className="text-sm">Search for a student to see their reports</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
          ) : reportList.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No reports for this student</p>
          ) : (
            <div className="space-y-2">
              {reportList.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                      <FileText size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">{r.term} · {r.academic_year}</p>
                      <p className="text-xs text-gray-400">
                        {r.average != null ? `Average: ${r.average.toFixed(1)}%` : "No average"}
                        {r.position_in_class != null ? ` · Rank #${r.position_in_class}` : ""}
                        {r.conduct_grade ? ` · Conduct: ${r.conduct_grade}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${r.is_published ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      {r.is_published ? "Published" : "Draft"}
                    </span>
                    {!r.is_published && (
                      <button onClick={() => publishReport(r.id)} className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded-xl px-2.5 py-1 transition">
                        <CheckCircle size={11} /> Publish
                      </button>
                    )}
                    <button onClick={() => downloadPDF(r.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-xl px-2.5 py-1 transition">
                      <Download size={11} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
