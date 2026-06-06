"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Plus, Search, CreditCard, Wifi, WifiOff, Lock, Unlock, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { cards, students, Student, KnottyCard } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

function LinkNFCModal({ card, onClose, onSuccess }: { card: KnottyCard; onClose: () => void; onSuccess: () => void }) {
  const { scan, scanning, error: nfcError, isSupported } = useNFC();
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState(false);

  async function handleScan() {
    const result = await scan();
    if (result) { setUid(result.value); setScanned(true); }
  }

  async function link() {
    if (!uid.trim()) return;
    setLoading(true);
    try {
      await cards.linkNFC(card.id, uid.trim());
      onSuccess();
      onClose();
    }
    catch (err) { alert(err instanceof Error ? err.message : "Link failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Link NFC Tag</h3>
        <p className="text-xs text-gray-400 mb-4">
          Card: <span className="font-mono">{card.card_number}</span><br />
          Student: {card.student.user.first_name} {card.student.user.last_name}
        </p>

        <div className="space-y-3">
          {isSupported ? (
            <button onClick={handleScan} disabled={scanning} className={`w-full py-4 rounded-2xl flex flex-col items-center gap-2 transition ${scanning ? "bg-blue-50 text-blue-600 border-2 border-dashed border-blue-500" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
              {scanning ? <><Loader2 className="animate-spin" size={24} /><span className="text-sm">Hold NFC tag to phone…</span></> : <><Wifi size={24} /><span className="font-medium">Scan NFC Tag</span></>}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-400"><WifiOff size={16} />Web NFC requires Chrome on Android</div>
          )}
          {nfcError && <p className="text-xs text-red-500">{nfcError}</p>}
          {scanned && <p className="text-xs text-green-600 font-medium">✓ NFC tag read successfully</p>}

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or enter UID manually</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="NFC UID (e.g. 04:A3:B2:...)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button onClick={link} disabled={loading || !uid.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60 transition">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Link Tag"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopUpModal({ card, onClose, onSuccess }: { card: KnottyCard; onClose: () => void; onSuccess: (newBalance: number) => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await cards.topUpCash(card.id, parseInt(amount)) as { new_balance?: number };
      const nb = res?.new_balance ?? (card.wallet_balance + parseInt(amount));
      toast(`Topped up ${parseInt(amount).toLocaleString()} RWF · New balance: ${nb.toLocaleString()} RWF`, "success");
      onSuccess(nb); onClose();
    }
    catch (err) { toast(err instanceof Error ? err.message : "Top-up failed", "error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Top Up Wallet</h3>
        <p className="text-xs text-gray-400 mb-4">Card: <span className="font-mono">{card.card_number}</span> · Current: {card.wallet_balance.toLocaleString()} RWF</p>
        <form onSubmit={submit} className="space-y-3">
          <input type="number" min={100} required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (RWF)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Top Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueCardModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { const r = await students.list({ search, limit: 6 }); setResults(r.data.filter((s) => !s.card)); } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function issue() {
    if (!selected) return;
    setLoading(true);
    try { await cards.issue(selected.id); onSuccess(); onClose(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Issue KNOTTY Card</h3>
        <div className="space-y-3">
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student without a card…" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            {searching && <Loader2 size={13} className="animate-spin absolute right-3 top-3 text-gray-400" />}
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                {results.map((s) => <button key={s.id} onClick={() => { setSelected(s); setSearch(`${s.user.first_name} ${s.user.last_name}`); setResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s.user.first_name} {s.user.last_name} <span className="text-gray-400 text-xs">{s.student_code}</span></button>)}
              </div>
            )}
          </div>
          {selected && <p className="text-sm text-blue-600 font-medium">→ {selected.user.first_name} {selected.user.last_name}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button onClick={issue} disabled={loading || !selected} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Issue Card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardsPage() {
  const { toast } = useToast();
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<KnottyCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "issue" | "nfc" | "topup">(null);
  const [selectedCard, setSelectedCard] = useState<KnottyCard | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const fetchCards = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    try {
      const res = await cards.list({ page, limit, search: query || undefined });
      setData(res.data);
      const p = res.pagination as { total: number };
      setTotal(p.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, query, authLoading]);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => { const t = setTimeout(() => { setQuery(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);

  async function toggleFreeze(card: KnottyCard) {
    setActionLoading(card.id);
    // Optimistic update
    setData((d) => d.map((c) => c.id === card.id ? { ...c, is_frozen: !card.is_frozen } : c));
    try {
      if (card.is_frozen) await cards.unfreeze(card.id); else await cards.freeze(card.id);
      toast(`Card ${card.is_frozen ? "unfrozen" : "frozen"} — ${card.student.user.first_name} ${card.student.user.last_name}`, "success");
    } catch (err) {
      // Revert on error
      setData((d) => d.map((c) => c.id === card.id ? { ...c, is_frozen: card.is_frozen } : c));
      toast(err instanceof Error ? err.message : "Error", "error");
    }
    finally { setActionLoading(null); }
  }

  const pages = Math.ceil(total / limit);

  return (
    <DashboardShell>
      {modal === "issue" && <IssueCardModal onClose={() => setModal(null)} onSuccess={() => { fetchCards(); toast("Card issued successfully", "success"); }} />}
      {modal === "nfc" && selectedCard && <LinkNFCModal card={selectedCard} onClose={() => setModal(null)} onSuccess={() => { fetchCards(); toast(`NFC linked — ${selectedCard.student.user.first_name}`, "success"); }} />}
      {modal === "topup" && selectedCard && <TopUpModal card={selectedCard} onClose={() => setModal(null)} onSuccess={(nb) => { setData((d) => d.map((c) => c.id === selectedCard.id ? { ...c, wallet_balance: nb } : c)); }} />}

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">KNOTTY Cards</h1>
            <p className="text-sm text-gray-400">{total} cards issued</p>
          </div>
          <button onClick={() => setModal("issue")} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition">
            <Plus size={16} /> Issue Card
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 mb-4 max-w-xs">
            <Search size={14} className="text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cards…" className="outline-none bg-transparent text-sm flex-1" />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-300"><CreditCard size={36} className="mb-2" /><p className="text-sm">No cards</p></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-3 font-medium">Student</th>
                  <th className="text-left pb-3 font-medium">Card Number</th>
                  <th className="text-left pb-3 font-medium">Balance</th>
                  <th className="text-left pb-3 font-medium">NFC</th>
                  <th className="text-left pb-3 font-medium">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((card) => (
                  <tr key={card.id} className="hover:bg-gray-50 transition">
                    <td className="py-3">
                      <p className="font-medium text-gray-700">{card.student.user.first_name} {card.student.user.last_name}</p>
                      <p className="text-xs text-gray-400">{card.student.level?.name} {card.student.class?.name}</p>
                    </td>
                    <td className="py-3 font-mono text-xs text-gray-500">{card.card_number}</td>
                    <td className="py-3">
                      <span className={`text-sm font-semibold ${card.wallet_balance < 1000 ? "text-red-500" : "text-teal-600"}`}>
                        {card.wallet_balance.toLocaleString()} RWF
                      </span>
                    </td>
                    <td className="py-3">
                      {card.nfc_uid ? (
                        <span className="text-xs text-green-600 flex items-center gap-1"><Wifi size={11} />Linked</span>
                      ) : (
                        <span className="text-xs text-gray-300 flex items-center gap-1"><WifiOff size={11} />Not linked</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${card.is_frozen ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                        {card.is_frozen ? "Frozen" : "Active"}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => { setSelectedCard(card); setModal("topup"); }} className="text-xs px-2.5 py-1 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition">
                          Top Up
                        </button>
                        <button onClick={() => { setSelectedCard(card); setModal("nfc"); }} className="text-xs px-2.5 py-1 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition flex items-center gap-1">
                          <Wifi size={11} />NFC
                        </button>
                        <button onClick={() => toggleFreeze(card)} disabled={actionLoading === card.id} className={`text-xs px-2.5 py-1 rounded-xl border transition flex items-center gap-1 ${card.is_frozen ? "border-green-200 text-green-600 hover:bg-green-50" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
                          {actionLoading === card.id ? <Loader2 size={11} className="animate-spin" /> : card.is_frozen ? <><Unlock size={11} />Unfreeze</> : <><Lock size={11} />Freeze</>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
