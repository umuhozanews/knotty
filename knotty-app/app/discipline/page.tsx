"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { discipline, students, Student, DisciplineRecord } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

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

function AddModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState({ type: "WARNING", title: "", description: "", action_taken: "", severity: "MINOR" });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

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
    try { await discipline.create({ ...form, student_id: selected.id }); onSuccess(); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-800 mb-4">New Discipline Record</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Student</label>
            {selected ? (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
                <span className="text-sm font-medium text-blue-600">{selected.user.first_name} {selected.user.last_name}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-gray-400">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                    {results.map((s) => <button key={s.id} type="button" onClick={() => { setSelected(s); setSearch(""); setResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s.user.first_name} {s.user.last_name} <span className="text-gray-400 text-xs">{s.student_code}</span></button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {["WARNING", "SUSPENSION", "MISCONDUCT", "RULE_VIOLATION", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Severity</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {["MINOR", "MODERATE", "SERIOUS"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Action Taken</label>
            <input value={form.action_taken} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading || !selected} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Save Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DisciplinePage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<DisciplineRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const limit = 20;

  const fetchData = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const res = await discipline.schoolList({ page, limit, search: query || undefined });
      setData(res.data as DisciplineRecord[]);
      const p = res.pagination as { total: number };
      setTotal(p.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, query, authLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setQuery(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);

  const pages = Math.ceil(total / limit);

  return (
    <DashboardShell>
      {showModal && <AddModal onClose={() => setShowModal(false)} onSuccess={fetchData} />}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Discipline</h1>
            <p className="text-sm text-gray-400">{total} records</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Add Record
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-4 max-w-xs">
            <Search size={14} className="text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records…" className="outline-none bg-transparent text-sm flex-1" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-300">
              <AlertTriangle size={36} className="mb-2" />
              <p className="text-sm">No discipline records</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((d) => (
                <div key={d.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer" onClick={() => d.student && router.push(`/students/${(d as { student_id?: string }).student_id}`)}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertTriangle size={14} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{d.title}</p>
                      {d.student && (
                        <p className="text-xs text-blue-600">{d.student.user.first_name} {d.student.user.last_name}</p>
                      )}
                      {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
                      {d.action_taken && <p className="text-xs text-blue-500 mt-0.5">Action: {d.action_taken}</p>}
                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(d.recorded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {d.recorder && ` · by ${d.recorder.first_name} ${d.recorder.last_name}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 ml-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEV_COLOR[d.severity] || "bg-gray-100 text-gray-500"}`}>{d.severity}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[d.type] || "bg-gray-100 text-gray-500"}`}>{d.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400">Page {page} of {pages}</p>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
