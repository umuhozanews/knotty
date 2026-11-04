"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Plus, Search, CreditCard, Wifi, WifiOff, Lock, Unlock,
  ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, ShieldCheck, Check
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import type { Student } from "@/lib/api";
import { supabaseCardService, supabaseStudentService, supabaseStaffService } from "@/lib/supabase/services";
import { getSafeBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type CardItem = {
  id: string;
  card_number: string;
  wallet_balance: number;
  is_frozen: boolean;
  holder_kind: "student" | "staff";
  holder_name: string;
  holder_subtitle: string;
};
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

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

// ─── Modal: Issue Card ─────────────────────────────────────────────────────────
function IssueCardModal({
  schoolId,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { scan, scanning, isSupported } = useNFC();
  const [holderKind, setHolderKind] = useState<"student" | "staff">("student");

  type StaffItem = { staff_record_id: string; legal_name: string; job_title: string; department: string | null; employment_status: string };

  const [studentSearch, setStudentSearch]     = useState("");
  const [studentResults, setStudentResults]   = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearching, setStudentSearching] = useState(false);

  const [staffAll, setStaffAll]               = useState<StaffItem[]>([]);
  const [staffSearch, setStaffSearch]         = useState("");
  const [selectedStaff, setSelectedStaff]     = useState<StaffItem | null>(null);
  const [staffLoading, setStaffLoading]       = useState(false);
  const [assignedStaffIds, setAssignedStaffIds] = useState<Set<string>>(new Set());

  const [nfcUid, setNfcUid]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (holderKind !== "student") return;
    setStudentSearching(true);
    const t = setTimeout(() => {
      supabaseStudentService.listSchoolStudents(schoolId, null, studentSearch.trim() || null)
        .then((r) => setStudentResults(r.filter((s) => !s.card)))
        .catch(() => {})
        .finally(() => setStudentSearching(false));
    }, studentSearch.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [schoolId, studentSearch, holderKind]);

  useEffect(() => {
    if (holderKind !== "staff") return;
    setStaffLoading(true);
    const client = getSafeBrowserClient();
    Promise.all([
      supabaseStaffService.listStaffMembers(schoolId),
      client
        ? client.from("card_assignments").select("staff_record_id, status").eq("school_id", schoolId).eq("holder_kind", "staff")
        : Promise.resolve({ data: [] as { staff_record_id: string; status: string }[] }),
    ]).then(([members, cardsRes]) => {
      const cards = (cardsRes as any)?.data ?? [];
      const ids = new Set<string>(
        (cards as { staff_record_id: string; status: string }[])
          .filter((c) => c.status !== "revoked" && c.status !== "replaced")
          .map((c) => c.staff_record_id)
      );
      setAssignedStaffIds(ids);
      setStaffAll(members as StaffItem[]);
    }).catch(() => {}).finally(() => setStaffLoading(false));
  }, [schoolId, holderKind]);

  const filteredStaff = staffAll.filter(
    (s) => !assignedStaffIds.has(s.staff_record_id) &&
      (!staffSearch.trim() || s.legal_name.toLowerCase().includes(staffSearch.toLowerCase()))
  );

  async function handleScanNFC() {
    setError("");
    const res = await scan();
    if (res?.value) setNfcUid(res.value.toUpperCase());
  }

  async function issue() {
    setError("");
    if (holderKind === "student" && !selectedStudent) { setError("Select a student first."); return; }
    if (holderKind === "staff" && !selectedStaff)     { setError("Select a staff member first."); return; }
    if (!nfcUid.trim()) { setError("Tap a physical NFC card first — the card UID is required."); return; }

    setLoading(true);
    try {
      if (holderKind === "student" && selectedStudent) {
        await supabaseCardService.issueCard({
          schoolId,
          holderKind: "student",
          studentId: selectedStudent.id,
          identifierKind: "nfc_uid",
          identifier: nfcUid.trim().toUpperCase(),
        });
        onSuccess(`Card issued for ${selectedStudent.user.first_name} ${selectedStudent.user.last_name}`);
      } else if (holderKind === "staff" && selectedStaff) {
        await supabaseCardService.issueCard({
          schoolId,
          holderKind: "staff",
          staffRecordId: selectedStaff.staff_record_id,
          identifierKind: "nfc_uid",
          identifier: nfcUid.trim().toUpperCase(),
        });
        onSuccess(`Card issued for ${selectedStaff.legal_name}`);
      }
      onClose();
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Card issuance failed");
    } finally {
      setLoading(false);
    }
  }

  const holderSelected = holderKind === "student" ? !!selectedStudent : !!selectedStaff;
  const canIssue = holderSelected && !!nfcUid.trim();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-lg">Issue Card</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />{error}
          </div>
        )}

        <div className="space-y-5">
          {/* Step 1: Who */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Step 1 — Select person</p>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3">
              <button type="button" onClick={() => { setHolderKind("student"); setSelectedStudent(null); setStudentSearch(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${holderKind === "student" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                Student
              </button>
              <button type="button" onClick={() => { setHolderKind("staff"); setSelectedStaff(null); setStaffSearch(""); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${holderKind === "staff" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}>
                Staff
              </button>
            </div>

            {holderKind === "student" && !selectedStudent && (
              <div className="relative">
                <input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search student name or code…"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500" />
                {studentSearching && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                {studentResults.length > 0 && (
                  <div className="border border-gray-100 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto divide-y divide-gray-50 bg-white absolute w-full z-10">
                    {studentResults.map((s) => (
                      <button key={s.id} type="button"
                        onClick={() => { setSelectedStudent(s); setStudentSearch(""); }}
                        className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-blue-50 transition flex items-center justify-between">
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
            )}
            {holderKind === "student" && selectedStudent && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800">{selectedStudent.user.first_name} {selectedStudent.user.last_name}</p>
                  <p className="text-xs text-green-600 font-mono">{selectedStudent.student_code} · {selectedStudent.class?.name || ""}</p>
                </div>
                <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-green-700 hover:underline">Change</button>
              </div>
            )}

            {holderKind === "staff" && !selectedStaff && (
              <div className="relative">
                <input value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search staff name…"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500" />
                {staffLoading && <Loader2 size={14} className="animate-spin absolute right-3 top-3 text-gray-400" />}
                {!staffLoading && filteredStaff.length > 0 && (
                  <div className="border border-gray-100 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto divide-y divide-gray-50 bg-white absolute w-full z-10">
                    {filteredStaff.map((s) => (
                      <button key={s.staff_record_id} type="button"
                        onClick={() => { setSelectedStaff(s); setStaffSearch(""); }}
                        className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-blue-50 transition">
                        <p className="font-medium text-gray-800">{s.legal_name}</p>
                        <p className="text-xs text-gray-400">{[s.job_title, s.department].filter(Boolean).join(" · ")}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {holderKind === "staff" && selectedStaff && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-green-800">{selectedStaff.legal_name}</p>
                  <p className="text-xs text-green-600">{[selectedStaff.job_title, selectedStaff.department].filter(Boolean).join(" · ")}</p>
                </div>
                <button type="button" onClick={() => setSelectedStaff(null)} className="text-xs text-green-700 hover:underline">Change</button>
              </div>
            )}
          </div>

          {/* Step 2: NFC Card */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Step 2 — Tap the physical NFC card</p>

            {nfcUid ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Card ready</p>
                    <p className="text-xs font-mono text-green-600">{nfcUid}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setNfcUid("")} className="text-xs text-green-700 hover:underline">Rescan</button>
              </div>
            ) : (
              <div className="space-y-2">
                {isSupported ? (
                  <button type="button" onClick={handleScanNFC} disabled={scanning}
                    className={`w-full py-5 rounded-2xl flex flex-col items-center gap-2 border-2 transition font-medium
                      ${scanning
                        ? "border-blue-400 bg-blue-50 text-blue-600 border-dashed"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"}`}>
                    {scanning
                      ? <><Loader2 size={24} className="animate-spin" /><span className="text-sm">Hold NFC card to phone…</span></>
                      : <><Wifi size={24} /><span className="text-sm">Tap NFC Card Here</span><span className="text-xs text-gray-400">Hold the physical card to your phone</span></>}
                  </button>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                    <WifiOff size={14} className="shrink-0 mt-0.5" />
                    <span>Web NFC requires Chrome on Android. Enter the card UID manually below.</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">or enter UID manually</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <input value={nfcUid} onChange={(e) => setNfcUid(e.target.value.toUpperCase())}
                  placeholder="e.g. 04A3B2C1D0E5F6"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="button" onClick={issue} disabled={loading || !canIssue}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-sm text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
              Issue Card
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
        <h3 className="font-bold text-gray-800 text-base mb-1">Replace Card</h3>
        <p className="text-xs text-gray-500 mb-4">
          {card.holder_name} · <span className="font-mono">{card.card_number}</span>
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
            <label className="text-xs font-semibold text-gray-600 mb-1 block">New Card UID</label>
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
        <h3 className="font-bold text-gray-800 text-base mb-1">Change Status</h3>
        <p className="text-xs text-gray-500 mb-4">
          {card.holder_name} · <span className="font-mono">{card.card_number}</span>
        </p>

        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              <option value="suspended">Suspended</option>
              <option value="active">Active</option>
              <option value="lost">Lost</option>
              <option value="damaged">Damaged</option>
              <option value="revoked">Revoked</option>
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
  const [modal, setModal] = useState<null | "issue" | "topup" | "replace" | "status">(null);
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

      // Load student cards, staff card assignments, and staff names in parallel
      const [studentRes, staffCardRes, staffMembersRes] = await Promise.all([
        client.rpc("list_school_students", { p_school_id: targetSchoolId, p_search: query || null }),
        client.from("card_assignments")
          .select("id, card_number, status, staff_record_id, wallet_balance")
          .eq("school_id", targetSchoolId)
          .eq("holder_kind", "staff"),
        supabaseStaffService.listStaffMembers(targetSchoolId),
      ]);

      // ── Student cards ──────────────────────────────────────────────
      const studentRows = ((studentRes.data as any[]) ?? []).filter((r) => r.card_assignment_id);
      const cardIds = studentRows.map((r: any) => r.card_assignment_id as string);
      let walletMap: Record<string, number> = {};
      if (cardIds.length > 0) {
        const { data: wallets } = await client
          .from("card_assignments")
          .select("id, wallet_balance")
          .in("id", cardIds);
        (wallets || []).forEach((w: any) => { walletMap[w.id] = w.wallet_balance ?? 0; });
      }
      const studentCardItems: CardItem[] = studentRows.map((r: any) => ({
        id: r.card_assignment_id,
        card_number: r.card_number,
        wallet_balance: walletMap[r.card_assignment_id] ?? 0,
        is_frozen: r.card_status === "suspended",
        holder_kind: "student" as const,
        holder_name: r.legal_name ?? "",
        holder_subtitle: [r.education_level_name, r.class_section_name].filter(Boolean).join(" · ") || "Student",
      }));

      // ── Staff cards ───────────────────────────────────────────────
      const staffMap = new Map(((staffMembersRes as any[]) || []).map((s: any) => [s.staff_record_id, s]));
      const qLower = query.trim().toLowerCase();
      const staffCardItems: CardItem[] = ((staffCardRes.data as any[]) ?? [])
        .filter((c) => c.status !== "revoked" && c.status !== "replaced")
        .filter((c) => {
          if (!qLower) return true;
          const staff: any = staffMap.get(c.staff_record_id);
          return staff?.legal_name?.toLowerCase().includes(qLower) ?? false;
        })
        .map((c) => {
          const staff: any = staffMap.get(c.staff_record_id);
          return {
            id: c.id,
            card_number: c.card_number,
            wallet_balance: c.wallet_balance ?? 0,
            is_frozen: c.status === "suspended",
            holder_kind: "staff" as const,
            holder_name: staff?.legal_name ?? "Unknown Staff",
            holder_subtitle: [staff?.job_title, staff?.department].filter(Boolean).join(" · ") || "Staff",
          };
        });

      const allCards = [...studentCardItems, ...staffCardItems];
      setData(allCards);
      setTotal(allCards.length);
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
      toast(`Card ${card.is_frozen ? "unfrozen" : "frozen"} — ${card.holder_name}`, "success");
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
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cards</h1>
            <p className="text-sm text-gray-400">{total} issued</p>
          </div>
          <button
            onClick={() => setModal("issue")}
            className="flex items-center gap-2 bg-[#16A34A] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e0681a] transition self-start sm:self-auto"
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
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#16A34A]" size={24} /></div>
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
                    <th className="text-left pb-3 font-medium">Holder</th>
                    <th className="text-left pb-3 font-medium">Card Number</th>
                    <th className="text-left pb-3 font-medium">Balance</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-right pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {data.map((card) => (
                    <tr key={card.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition">
                      <td className="py-3">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{card.holder_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${card.holder_kind === "staff" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                            {card.holder_kind === "staff" ? "Staff" : "Student"}
                          </span>
                          <span className="text-xs text-gray-400 truncate">{card.holder_subtitle}</span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{card.card_number}</td>
                      <td className="py-3">
                        <span className={`text-sm font-bold ${card.wallet_balance < 1000 ? "text-red-500" : "text-teal-600"}`}>
                          {card.wallet_balance.toLocaleString()} RWF
                        </span>
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
                            title="Change status"
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
