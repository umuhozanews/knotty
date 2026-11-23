"use client";
import { useState, useCallback } from "react";
import { Nfc, X, Wallet, GraduationCap, Bus, MoreHorizontal, Loader2, AlertCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useNFC } from "@/hooks/useNFC";
import { useAuth } from "@/context/AuthContext";
import { supabaseCanteenService } from "@/lib/supabase/services/canteenService";
import { supabaseFeesService } from "@/lib/supabase/services/feesService";

type StudentInfo = {
  card_assignment_id: string;
  card_number: string;
  student_id: string;
  legal_name: string;
  class_name: string;
  admission_number: string;
  profile_photo_path: string | null;
  wallet_balance: number;
};

type FeeSummaryRow = {
  fee_type: string; total_amount: number; amount_paid: number;
  balance: number; status: string; term_label: string | null;
};

const FEE_META: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  TUITION:      { label: "Tuition",      color: "#2563EB", bg: "#EFF6FF", Icon: GraduationCap },
  TRANSPORT:    { label: "Transport",    color: "#16A34A", bg: "#F0FDF4", Icon: Bus },
  POCKET_MONEY: { label: "Pocket Money", color: "#7C3AED", bg: "#F5F3FF", Icon: Wallet },
  OTHER:        { label: "Other",        color: "#EA580C", bg: "#FFF7ED", Icon: MoreHorizontal },
};

export default function NFCQuickCheck() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { scan, scanning } = useNFC();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [fees, setFees] = useState<FeeSummaryRow[]>([]);

  const schoolId = user?.school_id ?? "";
  const onFeesPage = pathname === "/fees" || pathname.startsWith("/fees/");

  const handleScan = useCallback(async () => {
    if (!schoolId) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setStudent(null);
    setFees([]);

    const result = await scan();
    if (!result) {
      setLoading(false);
      setError("No card detected or NFC not supported.");
      return;
    }

    try {
      let cardInfo: StudentInfo | null = null;

      if (result.type === "uid") {
        const r = await supabaseCanteenService.lookupCardHolderByNfcUid(schoolId, result.value);
        if (r) cardInfo = {
          card_assignment_id: r.card_assignment_id,
          card_number: r.card_number,
          student_id: r.student_id,
          legal_name: r.legal_name,
          class_name: r.class_name,
          admission_number: r.admission_number,
          profile_photo_path: r.profile_photo_path ?? null,
          wallet_balance: r.wallet_balance,
        };
      } else {
        const r = await supabaseCanteenService.lookupCardHolder(schoolId, result.value);
        if (r) cardInfo = {
          card_assignment_id: r.card_assignment_id,
          card_number: r.card_number,
          student_id: r.student_id,
          legal_name: r.legal_name,
          class_name: r.class_name,
          admission_number: r.admission_number,
          profile_photo_path: r.profile_photo_path ?? null,
          wallet_balance: r.wallet_balance,
        };
      }

      if (!cardInfo) {
        setError("Card not found or not assigned to a student.");
        setLoading(false);
        return;
      }

      setStudent(cardInfo);

      // Load fee summary on fees page or always for enriched view
      if (onFeesPage) {
        const feeSummary = await supabaseFeesService.getStudentFeeSummary(schoolId, cardInfo.student_id);
        setFees(feeSummary);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }, [schoolId, scan, onFeesPage]);

  return (
    <>
      {/* NFC button in header */}
      <button
        onClick={handleScan}
        disabled={scanning}
        title="Tap NFC card"
        className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition relative"
      >
        {scanning
          ? <Loader2 size={16} className="animate-spin text-green-600" />
          : <Nfc size={16} className="text-gray-600" />
        }
      </button>

      {/* Bottom sheet overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Nfc size={16} className="text-green-600" />
                <p className="font-bold text-sm text-gray-800">Card Check</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
                <X size={14} />
              </button>
            </div>

            <div className="p-5">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                    <Nfc size={24} className="text-green-600 animate-pulse" />
                  </div>
                  <p className="font-semibold text-gray-700">
                    {scanning ? "Hold card near device…" : "Looking up student…"}
                  </p>
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <AlertCircle size={32} className="text-red-400" />
                  <p className="text-sm text-red-500">{error}</p>
                  <button
                    onClick={handleScan}
                    className="mt-2 px-5 py-2 bg-green-600 text-white rounded-2xl text-sm font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {!loading && student && (
                <div className="space-y-4">
                  {/* Student card */}
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    {student.profile_photo_path ? (
                      <img src={student.profile_photo_path} className="w-14 h-14 rounded-2xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#16A34A,#2563EB)" }}>
                        {student.legal_name.split(" ").map(w => w[0]).slice(0, 2).join("")}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-extrabold text-gray-900 truncate">{student.legal_name}</p>
                      <p className="text-xs text-gray-500">{student.class_name} · {student.admission_number}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Wallet size={12} className="text-purple-600" />
                        <p className="text-sm font-bold text-purple-700">
                          {(student.wallet_balance ?? 0).toLocaleString()} RWF
                          <span className="text-xs font-normal text-gray-400 ml-1">pocket balance</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fee summary — shown on /fees page */}
                  {onFeesPage && fees.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Fee Status</p>
                      <div className="space-y-2">
                        {fees.map((f) => {
                          const meta = FEE_META[f.fee_type] ?? FEE_META.OTHER;
                          const Icon = meta.Icon;
                          const pct = f.total_amount > 0 ? Math.min(100, (f.amount_paid / f.total_amount) * 100) : 0;
                          return (
                            <div key={f.fee_type} className="p-3 rounded-2xl" style={{ background: meta.bg }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <Icon size={14} style={{ color: meta.color }} />
                                  <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                                  {f.term_label && <span className="text-[10px] text-gray-400">{f.term_label}</span>}
                                </div>
                                <span className="text-xs font-bold" style={{ color: meta.color }}>
                                  {f.amount_paid.toLocaleString()} / {f.total_amount.toLocaleString()} RWF
                                </span>
                              </div>
                              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {onFeesPage && fees.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">No fee invoices found for this student.</p>
                  )}

                  <button
                    onClick={handleScan}
                    className="w-full py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 flex items-center justify-center gap-2"
                  >
                    <Nfc size={15} /> Scan Another Card
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
