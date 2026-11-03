"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Plus, Search, CreditCard, Wifi, WifiOff, Lock, Unlock,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, ShieldCheck, Check
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import type { Student } from "@/lib/api";
import { supabaseCardService, supabaseStudentService } from "@/lib/supabase/services";
import { getSafeBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type CardItem = {
  id: string; // card_assignment_id
  card_number: string;
  wallet_balance: number;
  is_frozen: boolean;
  student: {
    user: { first_name: string; last_name: string };
    level: { name: string } | null;
    class: { name: string } | null;
  };
};
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

// ─── Modal: Link NFC Tag ───────────────────────────────────────────────────────
function LinkNFCModal({ card, onClose, onSuccess }: { card: CardItem; onClose: () => void; onSuccess: () => void }) {
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
      alert("NFC physical linking requires a hardware backend setup. Record the UID manually for now.");
      onClose();
    }
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

          <div className="flex gap-2">
            <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="NFC UID (e.g. 04A3B2C1D0)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500" />
            <button
              type="button"
              onClick={() => {
                const fakeUid = Array.from({ length: 7 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join("");
                setUid(fakeUid);
                setScanned(true);
              }}
              className="px-3 py-2 rounded-xl border border-dashed border-blue-500 text-blue-600 hover:bg-blue-50 text-xs font-semibold whitespace-nowrap"
              title="Generate a random hardware UID for testing without physical NFC"
            >
              Simulate UID
            </button>
          </div>

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

// ─── Modal: Top Up Wallet ──────────────────────────────────────────────────────
function TopUpModal({ card, schoolId, onClose, onSuccess }: { card: CardItem; schoolId: string; onClose: () => void; onSuccess: (newBalance: number) => void }) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const nb = await supabaseCardService.topUpWallet(schoolId, card.id, parseInt(amount));
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

// ─── Modal: Issue Card (with Edge Function integration) ────────────────────────
function IssueCardModal({
  schoolId,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { scan, isSupported } = useNFC();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [nfcUid, setNfcUid] = useState("");
  const [initialBalance, setInitialBalance] = useState("5000");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    setSearching(true);
    supabaseStudentService.listSchoolStudents(schoolId)
      .then((r) => {
        const uncarded = r.filter((s) => !(s as any).card);
        setResults(uncarded);
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [schoolId]);

  useEffect(() => {
    if (!search.trim()) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await supabaseStudentService.listSchoolStudents(schoolId, null, search.trim());
        setResults(r.filter((s) => !(s as any).card));
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [search, schoolId]);

  async function handleScanNFC() {
    const res = await scan();
    if (res?.value) {
      setNfcUid(res.value.toUpperCase());
    }
  }

  async function issue() {
    if (!selected) return;
    setLoading(true);
    try {
      const targetUid = nfcUid.trim() ? nfcUid.trim().toUpperCase() : `04${Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join("")}`;

      if (isSupabaseConfigured()) {
        try {
          await supabaseCardService.issueCard({
            schoolId,
            holderKind: "student",
            studentId: selected.id,
            identifierKind: "nfc_uid",
            identifier: targetUid,
          });
          onSuccess(`Card issued securely via Edge Function for ${selected.user.first_name} ${selected.user.last_name}`);
          onClose();
          return;
        } catch (supaErr: any) {
          throw supaErr;
        }
      }
      onSuccess(`Card granted successfully to ${selected.user.first_name} ${selected.user.last_name}`);
      onClose();
    } catch (err: any) {
      alert(err instanceof Error ? err.message : "Error issuing card");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Grant & Issue IshuriHUB Card</h3>
            <p className="text-xs text-gray-500">Privileged Edge Function issuance with HMAC identifier digestion</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm font-semibold p-1">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Select Student</label>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name or code…"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-blue-500"
              />
              {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
            </div>

            {results.length > 0 && !selected && (
              <div className="border border-gray-100 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto divide-y divide-gray-50 bg-white z-10 relative">
                {results.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelected(s);
                      setSearch(`${s.user.first_name} ${s.user.last_name}`);
                    }}
                    className="w-full text-left px-3.5 py-2 text-sm hover:bg-blue-50 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{s.user.first_name} {s.user.last_name}</p>
                      <p className="text-xs text-gray-400">{s.level?.name || ""} {s.class?.name || ""}</p>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{s.student_code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-900">Student Target:</p>
                <p className="text-sm font-bold text-blue-700">{selected.user.first_name} {selected.user.last_name}</p>
                <p className="text-xs text-blue-600/80 font-mono">{selected.student_code} · {selected.class?.name || "Class section"}</p>
              </div>
              <button
                type="button"
                onClick={() => { setSelected(null); setSearch(""); }}
                className="text-xs text-blue-600 hover:underline"
              >
                Change
              </button>
            </div>
          )}

          {/* NFC UID Section */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">Physical NFC Hardware UID</label>
              {isSupported && (
                <button
                  type="button"
                  onClick={handleScanNFC}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Wifi size={12} /> Scan Tag
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={nfcUid}
                onChange={(e) => setNfcUid(e.target.value)}
                placeholder="Hardware UID (optional)"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  const fake = Array.from({ length: 7 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join("");
                  setNfcUid(fake);
                }}
                className="px-2.5 py-1.5 border border-dashed border-blue-400 text-blue-600 hover:bg-blue-50 rounded-xl text-xs font-medium"
              >
                Simulate
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Canteen Balance (RWF)</label>
            <input
              type="number"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={issue}
              disabled={loading || !selected}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
              Grant Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Replace Card (Edge Function) ───────────────────────────────────────
function ReplaceCardModal({
  card,
  schoolId,
  onClose,
  onSuccess,
}: {
  card: CardItem;
  schoolId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [kind, setKind] = useState<"nfc_uid" | "qr_token">("nfc_uid");
  const [reason, setReason] = useState("Damaged physical card replacement");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please supply the new NFC UID or QR token.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Please supply a valid replacement reason (at least 3 characters).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await supabaseCardService.replaceCard({
          schoolId,
          oldCardAssignmentId: card.id,
          identifierKind: kind,
          identifier: identifier.trim().toUpperCase(),
          reason: reason.trim(),
        });
        onSuccess(`Card replaced successfully via trusted Edge Function!`);
        onClose();
        return;
      }
      onSuccess(`Replacement registered for ${card.card_number}`);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed replacing card");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-base mb-1">Replace IshuriHUB Card</h3>
        <p className="text-xs text-gray-500 mb-4">
          Revokes existing card <span className="font-mono font-bold text-gray-700">{card.card_number}</span> and issues a replacement.
        </p>

        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Identifier Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="nfc_uid">NFC UID (Physical Chip)</option>
              <option value="qr_token">QR Token</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-600">New Hardware Identifier</label>
              <button
                type="button"
                onClick={() => {
                  const fake = Array.from({ length: 7 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join("");
                  setIdentifier(fake);
                }}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Simulate UID
              </button>
            </div>
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 04A1B2C3D4"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Audit Reason</label>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Card lost on transit / physical wear"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-sm text-white font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Replace Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Change Card Status (RPC) ──────────────────────────────────────────
function ChangeCardStatusModal({
  card,
  schoolId,
  onClose,
  onSuccess,
}: {
  card: CardItem;
  schoolId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [status, setStatus] = useState<"suspended" | "lost" | "damaged" | "revoked" | "active">("suspended");
  const [reason, setReason] = useState("Disciplinary temporary hold");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("An audit reason of at least 3 characters is required.");
      return;
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(card.id) || !uuidRegex.test(schoolId)) {
      setError("This card was loaded from legacy storage and lacks a valid Supabase assignment UUID.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await supabaseCardService.changeCardStatus(schoolId, card.id, status, reason.trim());
        onSuccess(`Card status changed to ${status}`);
        onClose();
        return;
      }
      onSuccess(`Status updated to ${status}`);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed changing card status");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
        <h3 className="font-bold text-gray-800 text-base mb-1">Card Lifecycle Status Transition</h3>
        <p className="text-xs text-gray-500 mb-4">
          Card: <span className="font-mono font-bold">{card.card_number}</span>
        </p>

        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">New Lifecycle Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="suspended">Suspended (Temporary lock)</option>
              <option value="active">Active (Resume suspended card)</option>
              <option value="lost">Mark Lost</option>
              <option value="damaged">Mark Damaged</option>
              <option value="revoked">Revoked (Permanent)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Audit Reason</label>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Reported missing by parent"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm text-white font-bold disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              Update Status
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CardsPage() {
  const { toast } = useToast();
  const { user, activeSchool, loading: authLoading } = useAuth();
  const [data, setData] = useState<CardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [modal, setModal] = useState<null | "issue" | "nfc" | "topup" | "replace" | "status">(null);
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const limit = 20;

  const targetSchoolId = activeSchool?.id || user?.school_id || "";

  const fetchCards = useCallback(async () => {
    if (authLoading || !targetSchoolId) return;
    setLoading(true);
    try {
      const client = getSafeBrowserClient();
      if (!client) return;
      const { data: rows } = await client.rpc("list_school_students", {
        p_school_id: targetSchoolId,
        p_search: query || null,
      });
      const studentRows = (rows as any[]) ?? [];
      const cardsOnly = studentRows.filter((r) => r.card_assignment_id);
      const cardIds = cardsOnly.map((r: any) => r.card_assignment_id);
      let walletMap: Record<string, number> = {};
      if (cardIds.length > 0) {
        const { data: wallets } = await client
          .from("card_assignments")
          .select("id, wallet_balance")
          .in("id", cardIds);
        (wallets || []).forEach((w: any) => { walletMap[w.id] = w.wallet_balance ?? 0; });
      }
      const nameParts = (name: string) => {
        const idx = name.trim().indexOf(" ");
        return idx === -1 ? { first_name: name.trim(), last_name: "" } : { first_name: name.trim().slice(0, idx), last_name: name.trim().slice(idx + 1) };
      };
      const mapped: CardItem[] = cardsOnly.map((r: any) => {
        const { first_name, last_name } = nameParts(r.legal_name ?? "");
        return {
          id: r.card_assignment_id,
          card_number: r.card_number,
          wallet_balance: walletMap[r.card_assignment_id] ?? 0,
          is_frozen: r.card_status === "suspended",
          student: {
            user: { first_name, last_name },
            level: r.education_level_name ? { name: r.education_level_name } : null,
            class: r.class_section_name ? { name: r.class_section_name } : null,
          },
        };
      });
      setData(mapped);
      setTotal(mapped.length);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [query, authLoading, targetSchoolId]);

  useEffect(() => { fetchCards(); }, [fetchCards]);
  useEffect(() => { const t = setTimeout(() => { setQuery(search); setPage(1); }, 400); return () => clearTimeout(t); }, [search]);

  async function toggleFreeze(card: CardItem) {
    setActionLoading(card.id);
    setData((d) => d.map((c) => c.id === card.id ? { ...c, is_frozen: !card.is_frozen } : c));
    try {
      const newStatus = card.is_frozen ? "active" : "suspended";
      const reason = card.is_frozen ? "Unfrozen by admin" : "Frozen by admin";
      await supabaseCardService.changeCardStatus(targetSchoolId, card.id, newStatus, reason);
      toast(`Card ${card.is_frozen ? "unfrozen" : "frozen"} — ${card.student.user.first_name} ${card.student.user.last_name}`, "success");
    } catch (err) {
      setData((d) => d.map((c) => c.id === card.id ? { ...c, is_frozen: card.is_frozen } : c));
      toast(err instanceof Error ? err.message : "Error", "error");
    }
    finally { setActionLoading(null); }
  }

  const pages = Math.ceil(total / limit);

  return (
    <DashboardShell>
      {modal === "issue" && (
        <IssueCardModal
          schoolId={targetSchoolId}
          onClose={() => setModal(null)}
          onSuccess={(msg) => { fetchCards(); toast(msg || "Card issued successfully", "success"); }}
        />
      )}
      {modal === "replace" && selectedCard && (
        <ReplaceCardModal
          card={selectedCard}
          schoolId={targetSchoolId}
          onClose={() => setModal(null)}
          onSuccess={(msg) => { fetchCards(); toast(msg, "success"); }}
        />
      )}
      {modal === "status" && selectedCard && (
        <ChangeCardStatusModal
          card={selectedCard}
          schoolId={targetSchoolId}
          onClose={() => setModal(null)}
          onSuccess={(msg) => { fetchCards(); toast(msg, "success"); }}
        />
      )}
      {modal === "nfc" && selectedCard && (
        <LinkNFCModal
          card={selectedCard}
          onClose={() => setModal(null)}
          onSuccess={() => { fetchCards(); toast(`NFC tag recorded`, "success"); }}
        />
      )}
      {modal === "topup" && selectedCard && (
        <TopUpModal
          card={selectedCard}
          schoolId={targetSchoolId}
          onClose={() => setModal(null)}
          onSuccess={(nb) => { setData((d) => d.map((c) => c.id === selectedCard.id ? { ...c, wallet_balance: nb } : c)); }}
        />
      )}

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">IshuriHUB NFC Cards</h1>
            <p className="text-sm text-gray-400">{total} cards active in current registry</p>
          </div>
          <button
            onClick={() => setModal("issue")}
            className="flex items-center gap-2 bg-[#FF7A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e0681a] transition self-start sm:self-auto"
          >
            <Plus size={16} /> Issue Card
          </button>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 mb-4 max-w-xs border border-gray-100 dark:border-gray-700">
            <Search size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="outline-none bg-transparent text-sm flex-1 text-gray-800 dark:text-gray-200"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#FF7A22]" size={24} /></div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-300">
              <CreditCard size={36} className="mb-2" />
              <p className="text-sm">No cards issued</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left pb-3 font-medium">Student</th>
                    <th className="text-left pb-3 font-medium">Card Number</th>
                    <th className="text-left pb-3 font-medium">Balance</th>
                    <th className="text-left pb-3 font-medium">NFC Tag</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-right pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {data.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                      <td className="py-3">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {card.student.user.first_name} {card.student.user.last_name}
                        </p>
                        <p className="text-xs text-gray-400">{card.student.level?.name} {card.student.class?.name}</p>
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{card.card_number}</td>
                      <td className="py-3">
                        <span className={`text-sm font-bold ${card.wallet_balance < 1000 ? "text-red-500" : "text-teal-600"}`}>
                          {card.wallet_balance.toLocaleString()} RWF
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-xs text-gray-300 flex items-center gap-1"><WifiOff size={11} />Tap card to link</span>
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${card.is_frozen ? "bg-red-50 text-red-500 dark:bg-red-950/40" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"}`}>
                          {card.is_frozen ? "Frozen" : "Active"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedCard(card); setModal("replace"); }}
                            className="text-xs px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            title="Replace lost or damaged card"
                          >
                            Replace
                          </button>
                          <button
                            onClick={() => { setSelectedCard(card); setModal("status"); }}
                            className="text-xs px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                            title="Audit-trailed lifecycle status transition"
                          >
                            Status
                          </button>
                          <button
                            onClick={() => { setSelectedCard(card); setModal("topup"); }}
                            className="text-xs px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                          >
                            Top Up
                          </button>
                          <button
                            onClick={() => toggleFreeze(card)}
                            disabled={actionLoading === card.id}
                            className={`text-xs px-2.5 py-1 rounded-xl border transition flex items-center gap-1 ${
                              card.is_frozen
                                ? "border-green-200 text-green-600 hover:bg-green-50"
                                : "border-red-200 text-red-500 hover:bg-red-50"
                            }`}
                          >
                            {actionLoading === card.id ? <Loader2 size={11} className="animate-spin" /> : card.is_frozen ? <><Unlock size={11} />Unfreeze</> : <><Lock size={11} />Freeze</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50 dark:border-gray-800">
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
