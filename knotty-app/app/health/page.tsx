"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { health, students, HealthRecord, Student } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, Heart, Plus, X, Search, AlertCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";

const TYPES = ["ILLNESS","INJURY","MEDICATION","CHECKUP","ALLERGY"];
const SEVERITIES = ["LOW","MEDIUM","HIGH"];
const SEV_COLOR: Record<string, string> = { LOW: "bg-green-100 text-green-700", MEDIUM: "bg-yellow-100 text-yellow-700", HIGH: "bg-red-100 text-red-700" };
const TYPE_COLOR: Record<string, string> = { ILLNESS: "bg-blue-50 text-blue-600", INJURY: "bg-orange-50 text-orange-600", MEDICATION: "bg-purple-50 text-purple-600", CHECKUP: "bg-green-50 text-green-600", ALLERGY: "bg-red-50 text-red-600" };

interface HealthRecordExt extends HealthRecord {
  student?: { user: { first_name: string; last_name: string } };
}

export default function HealthPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [records, setRecords] = useState<HealthRecordExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });

  useEffect(() => {
    if (authLoading) return;
    loadRecords();
  }, [authLoading]);

  async function loadRecords() {
    setLoading(true);
    try {
      // Load recent health records for the school (admin/nurse can see all)
      // We'll show recent records by loading a page of students first
      const sRes = await students.list({ limit: 200 });
      const recs: HealthRecordExt[] = [];
      await Promise.all(sRes.data.slice(0, 10).map(async (s) => {
        const h = await health.studentList(s.id);
        recs.push(...h.data.map((r) => ({ ...r, student: { user: { first_name: s.user.first_name, last_name: s.user.last_name } } })));
      }));
      recs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
      setRecords(recs.slice(0, 40));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function searchStudents(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    students.list({ search: q, limit: 6 }).then((r) => setSearchResults(r.data)).catch(console.error).finally(() => setSearching(false));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const rec = await health.create({ student_id: selectedStudent.id, ...form });
      setRecords((prev) => [{
        ...rec.data,
        student: { user: { first_name: selectedStudent.user.first_name, last_name: selectedStudent.user.last_name } }
      }, ...prev]);
      setShowModal(false);
      setSelectedStudent(null);
      setForm({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });
      toast("Health record saved", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally { setSaving(false); }
  }

  return (
    <DashboardShell>
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Health Records</h1>
            <p className="text-sm text-gray-400">Log and track student health incidents</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} />Log Incident
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <Heart size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No health records found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div key={rec.id} className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[rec.type] ?? "bg-gray-50 text-gray-500"}`}>
                    <Heart size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{rec.title}</p>
                        <p className="text-xs text-gray-500">{rec.student?.user.first_name} {rec.student?.user.last_name}</p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLOR[rec.type] ?? "bg-gray-50 text-gray-500"}`}>{rec.type}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEV_COLOR[rec.severity]}`}>{rec.severity}</span>
                      </div>
                    </div>
                    {rec.description && <p className="text-xs text-gray-500 mt-1">{rec.description}</p>}
                    {rec.treatment_given && <p className="text-xs text-green-600 mt-0.5">Treatment: {rec.treatment_given}</p>}
                    {rec.follow_up_required && <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-1"><AlertCircle size={11} />Follow-up required</p>}
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(rec.recorded_at).toLocaleString("en-GB")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-base font-bold text-gray-800">Log Health Incident</p>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>

              {/* Student search */}
              {!selectedStudent ? (
                <div className="mb-4">
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Find Student *</label>
                  <div className="relative">
                    <input value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                      placeholder="Type name or code..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 pr-8" />
                    {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-xl overflow-hidden">
                      {searchResults.map((s) => (
                        <button key={s.id} type="button" onClick={() => { setSelectedStudent(s); setSearchResults([]); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">{s.user.first_name[0]}</div>
                          <div>
                            <p className="text-sm font-medium text-gray-700">{s.user.first_name} {s.user.last_name}</p>
                            <p className="text-xs text-gray-400">{s.student_code} · {s.level?.name} {s.class?.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-blue-50">
                  <p className="text-sm font-medium text-blue-700">{selectedStudent.user.first_name} {selectedStudent.user.last_name}</p>
                  <button onClick={() => setSelectedStudent(null)} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Type *</label>
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                      {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Severity *</label>
                    <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500">
                      {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Title *</label>
                  <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Fever 38.5°C" required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Treatment Given</label>
                  <input value={form.treatment_given} onChange={(e) => setForm((f) => ({ ...f, treatment_given: e.target.value }))}
                    placeholder="e.g. Paracetamol 500mg"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.follow_up_required} onChange={(e) => setForm((f) => ({ ...f, follow_up_required: e.target.checked }))}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-sm text-gray-600">Follow-up required</span>
                </label>
                <button type="submit" disabled={saving || !selectedStudent || !form.title}
                  className="w-full py-3 rounded-2xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Heart size={15} />}
                  Save Record
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
