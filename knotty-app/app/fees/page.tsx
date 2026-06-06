"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, TrendingUp, Clock, CheckCircle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { fees, students, Student } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function CollectFeeModal({ schoolId, onClose, onSuccess }: { schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState({ amount: "", payment_type: "TUITION", payment_method: "CASH", term: "TERM1", academic_year: "2025-2026", phone: "" });
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
    try {
      await fees.pay({ ...form, amount: parseInt(form.amount), student_id: selected.id, school_id: schoolId });
      onSuccess(); onClose();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-bold text-gray-800 mb-4">Collect Fee Payment</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Student</label>
            {selected ? (
              <div className="flex items-center justify-between p-2.5 bg-blue-50 rounded-xl">
                <span className="text-sm font-medium text-blue-600">{selected.user.first_name} {selected.user.last_name} · {selected.student_code}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student by name or ID…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
                {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                    {results.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setSelected(s); setSearch(""); setResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition">
                        {s.user.first_name} {s.user.last_name} <span className="text-gray-400 text-xs">{s.student_code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                {["TUITION", "ACTIVITY", "UNIFORM", "OTHER"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Method</label>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="CASH">Cash</option>
                <option value="MOMO">MTN MoMo</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Amount (RWF)</label>
            <input type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
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
              <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          {form.payment_method === "MOMO" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">MoMo Phone Number</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="250780000000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading || !selected} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Collect Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FeesPage() {
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<{ total_collected: number; pending: number; by_type: { payment_type: string; _sum: { amount: number }; _count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  function loadReport() {
    setLoading(true);
    fees.schoolReport().then((r) => setReport(r.data as typeof report)).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { if (!authLoading) loadReport(); }, [authLoading]);

  return (
    <DashboardShell>
      {showModal && <CollectFeeModal schoolId={user?.school_id ?? ""} onClose={() => setShowModal(false)} onSuccess={loadReport} />}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Fee Management</h1>
            <p className="text-sm text-gray-400">Track and collect school fees</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Collect Fee
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
        ) : report && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle size={20} className="text-green-500" /></div>
                <p className="text-sm text-gray-500">Total Collected</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{report.total_collected.toLocaleString()} RWF</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center"><Clock size={20} className="text-yellow-500" /></div>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{report.pending.toLocaleString()} RWF</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><TrendingUp size={20} className="text-blue-500" /></div>
                <p className="text-sm text-gray-500">Total Revenue</p>
              </div>
              <p className="text-2xl font-bold text-gray-800">{(report.total_collected + report.pending).toLocaleString()} RWF</p>
            </div>

            {report.by_type.length > 0 && (
              <div className="col-span-3 bg-white rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">By Payment Type</h3>
                <div className="grid grid-cols-4 gap-3">
                  {report.by_type.map((item) => (
                    <div key={item.payment_type} className="p-4 bg-gray-50 rounded-xl text-center">
                      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{item.payment_type}</p>
                      <p className="text-lg font-bold text-gray-800">{item._sum.amount?.toLocaleString() ?? 0} RWF</p>
                      <p className="text-xs text-gray-400">{item._count} payment{item._count !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
