"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, Filter, Receipt, RotateCcw, Wallet, CreditCard, Calendar, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { fees, students, StudentBase, FeeStructure, Invoice, RefundRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Collect Legacy Fee Modal
function CollectFeeModal({ schoolId, onClose, onSuccess }: { schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<StudentBase[]>([]);
  const [selected, setSelected] = useState<StudentBase | null>(null);
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
        <h3 className="font-bold text-gray-800 mb-4">Record Fee Payment (Direct)</h3>
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
  const role = user?.role ?? "STUDENT";
  const isBursarOrAdmin = ["ADMIN", "BURSAR"].includes(role);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "structures" | "invoices" | "refunds">("overview");

  // State Lists
  const [report, setReport] = useState<any | null>(null);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showInvoiceGenModal, setShowInvoiceGenModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Invoice | null>(null);
  const [showRefundModal, setShowRefundModal] = useState<Invoice | null>(null);

  // Form states
  const [structureForm, setStructureForm] = useState({ name: "", applies_to: "", amount: "", currency: "RWF" });
  const [invoiceGenForm, setInvoiceGenForm] = useState({ fee_structure_id: "", due_date: "" });
  const [payForm, setPayForm] = useState({ amount: "", channel: "CASH", phone: "" });
  const [refundForm, setRefundForm] = useState({ reason: "" });

  // Loaders
  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "overview") {
        const r = await fees.schoolReport();
        setReport(r.data);
      } else if (activeTab === "structures") {
        const r = await fees.structures();
        setStructures(r.data);
      } else if (activeTab === "invoices") {
        const r = await fees.invoices();
        setInvoices(r.data);
      } else if (activeTab === "refunds") {
        const r = await fees.refunds();
        setRefunds(r.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) {
      // Direct student/parent users straight to Invoices
      if (!isBursarOrAdmin && activeTab === "overview") {
        setActiveTab("invoices");
      } else {
        loadData();
      }
    }
  }, [authLoading, activeTab]);

  // Operations
  async function handleCreateStructure(e: React.FormEvent) {
    e.preventDefault();
    try {
      const appliesArr = structureForm.applies_to ? structureForm.applies_to.split(",").map(s => s.trim()) : undefined;
      await fees.createStructure({
        name: structureForm.name,
        amount: parseFloat(structureForm.amount),
        applies_to: appliesArr,
      });
      setStructureForm({ name: "", applies_to: "", amount: "", currency: "RWF" });
      setShowStructureModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleGenerateInvoices(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fees.generateInvoices({
        fee_structure_id: invoiceGenForm.fee_structure_id,
        due_date: invoiceGenForm.due_date,
      });
      alert(`Successfully generated invoices for ${r.count} students!`);
      setShowInvoiceGenModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handlePayInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!showPayModal) return;
    try {
      const r = await fees.payInvoice({
        invoice_id: showPayModal.id,
        amount: parseFloat(payForm.amount),
        channel: payForm.channel,
        phone: payForm.channel === "MOMO" ? payForm.phone : undefined,
      });
      alert(r.message || "Payment processed successfully!");
      setShowPayModal(null);
      setPayForm({ amount: "", channel: "CASH", phone: "" });
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleRequestRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!showRefundModal) return;
    try {
      // Find the payment transaction ID to refund
      const paymentTx = showRefundModal.payments.find(p => p.status === "COMPLETED");
      if (!paymentTx || !paymentTx.wallet_transaction_id) {
        alert("No refundable wallet transaction found for this invoice.");
        return;
      }

      await fees.requestRefund({
        wallet_transaction_id: paymentTx.wallet_transaction_id,
        reason: refundForm.reason,
      });
      alert("Refund request submitted for Bursar review.");
      setShowRefundModal(null);
      setRefundForm({ reason: "" });
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleResolveRefund(id: string, status: "APPROVED" | "REJECTED") {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} this refund request?`)) return;
    try {
      const res = await fees.resolveRefund(id, status);
      alert(`Refund request marked as ${status}!`);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  return (
    <DashboardShell>
      {showCollectModal && <CollectFeeModal schoolId={user?.school_id ?? ""} onClose={() => setShowCollectModal(false)} onSuccess={loadData} />}
      
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Fee Management & Invoicing</h1>
            <p className="text-sm text-gray-400">Manage school fee structures, bill students, and approve refunds</p>
          </div>
          {isBursarOrAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setShowStructureModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
                <Plus size={16} /> New Structure
              </button>
              <button onClick={() => setShowCollectModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition">
                <Receipt size={16} /> Record Cash
              </button>
            </div>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-100 gap-2">
          {isBursarOrAdmin && (
            <button onClick={() => setActiveTab("overview")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === "overview" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              Overview
            </button>
          )}
          {isBursarOrAdmin && (
            <button onClick={() => setActiveTab("structures")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === "structures" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              Fee Structures
            </button>
          )}
          <button onClick={() => setActiveTab("invoices")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === "invoices" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
            Invoices & Billing
          </button>
          {isBursarOrAdmin && (
            <button onClick={() => setActiveTab("refunds")} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === "refunds" ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              Refunds Approval
            </button>
          )}
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600" size={28} /></div>
        ) : (
          <div className="space-y-4">
            
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && report && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <p className="text-sm text-gray-500">Pending Billing</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{report.pending.toLocaleString()} RWF</p>
                  </div>
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><TrendingUp size={20} className="text-blue-500" /></div>
                      <p className="text-sm text-gray-500">Gross Projected Revenue</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{(report.total_collected + report.pending).toLocaleString()} RWF</p>
                  </div>
                </div>

                {report.by_type && report.by_type.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Collected Fees Breakdown</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {report.by_type.map((item: any) => (
                        <div key={item.payment_type} className="p-4 bg-gray-50 rounded-xl text-center">
                          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{item.payment_type}</p>
                          <p className="text-lg font-bold text-gray-800">{item._sum.amount?.toLocaleString() ?? 0} RWF</p>
                          <p className="text-xs text-gray-400">{item._count} transaction{item._count !== 1 ? "s" : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STRUCTURES TAB */}
            {activeTab === "structures" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Defined Fee Structures</h3>
                  <button onClick={() => {
                    if (structures.length === 0) { alert("Please create a fee structure first."); return; }
                    setInvoiceGenForm({ fee_structure_id: structures[0].id, due_date: "" });
                    setShowInvoiceGenModal(true);
                  }} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-semibold transition">
                    Run Bulk Billing Run
                  </button>
                </div>
                <div className="overflow-hidden border border-gray-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                        <th className="p-4">Structure Name</th>
                        <th className="p-4">Billing Amount</th>
                        <th className="p-4">Applies To</th>
                        <th className="p-4">Created At</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {structures.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic">No fee structures defined yet.</td></tr>
                      ) : (
                        structures.map((s) => (
                          <tr key={s.id}>
                            <td className="p-4 font-semibold text-gray-700">{s.name}</td>
                            <td className="p-4 font-medium text-indigo-600">{s.amount.toLocaleString()} {s.currency}</td>
                            <td className="p-4">
                              {s.applies_to && s.applies_to.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {s.applies_to.map((x, i) => (
                                    <span key={i} className="bg-indigo-50 text-indigo-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">{x}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-xs">All Students</span>
                              )}
                            </td>
                            <td className="p-4 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-center">
                              <button onClick={async () => {
                                if (confirm("Delete this fee structure?")) {
                                  await fees.deleteStructure(s.id);
                                  loadData();
                                }
                              }} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === "invoices" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800">Student Invoices</h3>
                <div className="overflow-hidden border border-gray-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                        <th className="p-4">Invoice ID</th>
                        <th className="p-4">Student</th>
                        <th className="p-4">Class</th>
                        <th className="p-4">Total Amount</th>
                        <th className="p-4">Paid</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Due Date</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {invoices.length === 0 ? (
                        <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">No invoices found.</td></tr>
                      ) : (
                        invoices.map((inv) => {
                          const remaining = inv.total_amount - inv.amount_paid;
                          const isRefundable = inv.status === "PAID" || inv.status === "PARTIAL";
                          return (
                            <tr key={inv.id}>
                              <td className="p-4 font-mono text-xs text-gray-500">#{inv.id.substring(0, 8)}</td>
                              <td className="p-4">
                                <div className="font-semibold text-gray-700">{inv.student?.user.first_name} {inv.student?.user.last_name}</div>
                                <div className="text-[10px] text-gray-400">{inv.student?.student_code}</div>
                              </td>
                              <td className="p-4 text-gray-600">{inv.student?.class?.name || "Unassigned"}</td>
                              <td className="p-4 font-bold text-gray-800">{inv.total_amount.toLocaleString()} RWF</td>
                              <td className="p-4 font-medium text-green-600">{inv.amount_paid.toLocaleString()} RWF</td>
                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                                  ${inv.status === "PAID" ? "bg-green-50 text-green-600" :
                                    inv.status === "PARTIAL" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-500"}`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="p-4 text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                              <td className="p-4 text-center space-x-1.5">
                                {remaining > 0 ? (
                                  <button onClick={() => {
                                    setPayForm({ amount: String(remaining), channel: "CASH", phone: "" });
                                    setShowPayModal(inv);
                                  }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-2.5 py-1 rounded-lg transition">
                                    Record Payment
                                  </button>
                                ) : (
                                  <span className="text-xs text-green-600 font-semibold">Fully Cleared</span>
                                )}

                                {isBursarOrAdmin && isRefundable && (
                                  <button onClick={() => {
                                    setShowRefundModal(inv);
                                  }} className="bg-red-50 text-red-500 hover:bg-red-100 font-semibold text-xs px-2.5 py-1 rounded-lg transition">
                                    Request Refund
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* REFUNDS TAB */}
            {activeTab === "refunds" && (
              <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-gray-800">Pending & Resolved Refunds</h3>
                <div className="overflow-hidden border border-gray-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                        <th className="p-4">Request ID</th>
                        <th className="p-4">Student</th>
                        <th className="p-4">Transaction Details</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Requested By</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {refunds.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic">No refund requests logged.</td></tr>
                      ) : (
                        refunds.map((r) => (
                          <tr key={r.id}>
                            <td className="p-4 font-mono text-xs text-gray-500">#{r.id.substring(0, 8)}</td>
                            <td className="p-4 font-semibold text-gray-700">{r.wallet_transaction?.student?.user.first_name} {r.wallet_transaction?.student?.user.last_name}</td>
                            <td className="p-4">
                              <div className="font-bold text-gray-800">{r.wallet_transaction?.amount?.toLocaleString()} RWF</div>
                              <div className="text-[10px] text-gray-400 uppercase font-semibold">{r.wallet_transaction?.type} · {new Date(r.wallet_transaction?.created_at).toLocaleDateString()}</div>
                            </td>
                            <td className="p-4 text-gray-600">{r.reason}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
                                ${r.status === "APPROVED" ? "bg-green-50 text-green-600" :
                                  r.status === "PENDING" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-500"}`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="p-4 text-gray-500">{r.requester?.first_name} {r.requester?.last_name}</td>
                            <td className="p-4 text-center">
                              {r.status === "PENDING" ? (
                                <div className="flex justify-center gap-1">
                                  <button onClick={() => handleResolveRefund(r.id, "APPROVED")} className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs px-2 py-1 rounded-lg">Approve</button>
                                  <button onClick={() => handleResolveRefund(r.id, "REJECTED")} className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-2 py-1 rounded-lg">Reject</button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">Resolved by {r.approver?.first_name || "Bursar"}</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Structure Modal */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Add Fee Structure</h3>
            <form onSubmit={handleCreateStructure} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Structure Title</label>
                <input required value={structureForm.name} onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                  placeholder="e.g. Senior 5 Term 1 Tuition" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Applies To (Comma separated levels/classes)</label>
                <input value={structureForm.applies_to} onChange={(e) => setStructureForm({ ...structureForm, applies_to: e.target.value })}
                  placeholder="e.g. Senior 5, Senior 6 (Leave blank for all)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount (RWF)</label>
                <input required type="number" min={1} value={structureForm.amount} onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowStructureModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Save Structure</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Invoice Gen Modal */}
      {showInvoiceGenModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Generate Bulk Student Invoices</h3>
            <form onSubmit={handleGenerateInvoices} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Target Fee Structure</label>
                <select required value={invoiceGenForm.fee_structure_id} onChange={(e) => setInvoiceGenForm({ ...invoiceGenForm, fee_structure_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  {structures.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.amount.toLocaleString()} RWF)</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Due Date</label>
                <input required type="date" value={invoiceGenForm.due_date} onChange={(e) => setInvoiceGenForm({ ...invoiceGenForm, due_date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvoiceGenModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Run Billing Run</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Process Invoice Payment</h3>
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
              <p className="text-xs text-gray-500">Student</p>
              <p className="text-sm font-semibold text-indigo-700">{showPayModal.student?.user.first_name} {showPayModal.student?.user.last_name}</p>
              <p className="text-xs text-gray-500 mt-1">Remaining Balance</p>
              <p className="text-base font-bold text-gray-800">{(showPayModal.total_amount - showPayModal.amount_paid).toLocaleString()} RWF</p>
            </div>
            <form onSubmit={handlePayInvoice} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Channel</label>
                <select required value={payForm.channel} onChange={(e) => setPayForm({ ...payForm, channel: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="WALLET">Knotty Card Wallet balance</option>
                  <option value="MOMO">MTN MoMo</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Amount</label>
                <input required type="number" min={1} max={showPayModal.total_amount - showPayModal.amount_paid} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              {payForm.channel === "MOMO" && (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">MoMo Phone Number</label>
                  <input required placeholder="250780000000" value={payForm.phone} onChange={(e) => setPayForm({ ...payForm, phone: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Request Fee Refund</h3>
            <p className="text-xs text-gray-500">Refunds are reversed directly to the student's Knotty Card wallet and will adjust invoice totals accordingly.</p>
            <form onSubmit={handleRequestRefund} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Reason for Refund</label>
                <textarea required value={refundForm.reason} onChange={(e) => setRefundForm({ reason: e.target.value })}
                  placeholder="e.g. Duplicate payment, family withdrawal..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 h-20 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRefundModal(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
