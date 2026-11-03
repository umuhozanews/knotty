"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { supabaseCanteenService, CanteenTransactionRow } from "@/lib/supabase/services/canteenService";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp, ShoppingCart } from "lucide-react";

type MyCard = {
  card_assignment_id: string;
  card_number: string;
  card_status: string;
  wallet_balance: number;
  student_id: string;
};

export default function MyCardPage() {
  const { user, loading: authLoading } = useAuth();
  const [cardInfo, setCardInfo] = useState<MyCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CanteenTransactionRow[]>([]);

  useEffect(() => {
    if (authLoading || !user?.school_id) return;
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }
    const schoolId = user.school_id;

    async function load() {
      try {
        const { data: rows } = await client!.rpc("get_my_student_profile", { p_school_id: schoolId });
        const profile = (rows as any)?.[0];
        if (profile?.card_assignment_id) {
          setCardInfo({
            card_assignment_id: profile.card_assignment_id,
            card_number: profile.card_number,
            card_status: profile.card_status,
            wallet_balance: profile.wallet_balance ?? 0,
            student_id: profile.student_id,
          });
          const txs = await supabaseCanteenService.listStudentTransactions(schoolId, profile.student_id, 10);
          setTransactions(txs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-md mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Card & Wallet</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !cardInfo ? (
          <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-10 text-center">
            <CreditCard size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No card issued yet. Ask your admin to issue a card.</p>
          </div>
        ) : (
          <>
            {/* Card visual */}
            <div className="bg-[#121212] rounded-lg border border-[#dcd9d9]/20 p-5 text-[#fcf9f8] relative overflow-hidden shadow-none">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#d9ff8c]" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#d9ff8c] uppercase">IshuriHUB Smart Card</p>
                  <p className="text-[9px] opacity-50">School Management System</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-[#d9ff8c]/20 bg-[#d9ff8c]/10 text-[#d9ff8c]">
                  {cardInfo.card_status?.toUpperCase() ?? "ACTIVE"}
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs opacity-50 mb-0.5 font-semibold">Wallet Balance</p>
                <p className="text-3xl font-extrabold tracking-tight">
                  {cardInfo.wallet_balance.toLocaleString()} <span className="text-base font-normal opacity-70">RWF</span>
                </p>
              </div>
              <div className="mt-4">
                <p className="text-[8px] opacity-50 uppercase tracking-widest font-bold">Card Number</p>
                <p className="text-sm font-mono tracking-[0.12em] mt-0.5 text-white">{cardInfo.card_number}</p>
              </div>
            </div>

            {/* Info tiles */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center">
                <TrendingUp size={20} className="mx-auto text-[#121212] mb-1.5" />
                <p className="text-lg font-extrabold tracking-tight text-[#121212]">{cardInfo.wallet_balance.toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Balance (RWF)</p>
              </div>
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center">
                <ArrowUpRight size={20} className="mx-auto text-[#121212] mb-1.5" />
                <p className="text-xs font-bold text-[#121212]">Ask Admin</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Top Up Cash</p>
              </div>
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center">
                <ArrowDownLeft size={20} className="mx-auto text-[#121212] mb-1.5" />
                <p className="text-xs font-bold text-[#121212]">Canteen</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Tap to pay</p>
              </div>
            </div>

            {/* Canteen Transaction History */}
            <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart size={14} className="text-[#121212]" />
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recent Canteen Transactions</p>
              </div>
              {transactions.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No canteen transactions yet</p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const items = (tx.items as { name: string }[] | null) ?? [];
                    const label = items.length > 0 ? items.map((i) => i.name).join(", ") : "Canteen purchase";
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#dcd9d9] last:border-0">
                        <div>
                          <p className="text-xs font-bold text-[#121212]">{label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {new Date(tx.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <span className="text-sm font-extrabold text-red-500">-{(tx.total_amount ?? 0).toLocaleString()} RWF</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">How Your Card Works</p>
              <div className="space-y-2.5 text-xs text-gray-600 font-semibold">
                <p>🔵 <strong className="text-[#121212]">Attendance:</strong> Tap your card at the gate every morning (Tap In) and when leaving (Tap Out).</p>
                <p>🟢 <strong className="text-[#121212]">Canteen:</strong> Tap your card at the canteen counter. The purchase amount is deducted from your wallet.</p>
                <p>🟡 <strong className="text-[#121212]">Top-up:</strong> Your parent or admin can load money via MTN MoMo or cash at the office.</p>
                <p>🔴 <strong className="text-[#121212]">Lost card:</strong> Report to admin immediately — they will freeze it to protect your balance.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
