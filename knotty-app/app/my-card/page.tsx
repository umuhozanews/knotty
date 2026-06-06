"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

export default function MyCardPage() {
  const { loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    myAccount.profile().then((r) => setProfile(r.data as Record<string, unknown>)).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  const card = profile?.card as {
    card_number?: string; wallet_balance?: number; is_active?: boolean; is_frozen?: boolean; expires_at?: string;
  } | null;

  return (
    <DashboardShell>
      <div className="p-4 overflow-y-auto h-full space-y-4">
        <h1 className="text-xl font-bold text-gray-800">My Card & Wallet</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !card ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <CreditCard size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400">No card issued yet. Ask your admin to issue a card.</p>
          </div>
        ) : (
          <>
            {/* Card visual */}
            <div className="rounded-2xl p-5 text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #0f2040 100%)" }}>
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-green-400 via-emerald-300 to-green-400" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold tracking-widest opacity-60 uppercase">KNOTTY Smart Card</p>
                  <p className="text-[9px] opacity-40">School Management System</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${card.is_frozen ? "bg-blue-400/20 border-blue-300/30 text-blue-200" : card.is_active ? "bg-green-400/20 border-green-300/30 text-green-200" : "bg-red-400/20 border-red-300/30 text-red-200"}`}>
                  {card.is_frozen ? "FROZEN" : card.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs opacity-50 mb-0.5">Wallet Balance</p>
                <p className="text-3xl font-bold">{(card.wallet_balance ?? 0).toLocaleString()} <span className="text-base font-normal opacity-70">RWF</span></p>
              </div>
              <div className="mt-4 flex justify-between items-end">
                <div>
                  <p className="text-[8px] opacity-50 uppercase tracking-widest">Card Number</p>
                  <p className="text-sm font-mono tracking-[0.12em] mt-0.5">{card.card_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] opacity-50 uppercase tracking-widest">Expires</p>
                  <p className="text-xs mt-0.5">{card.expires_at ? new Date(card.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <TrendingUp size={20} className="mx-auto text-blue-500 mb-1" />
                <p className="text-xl font-bold text-gray-800">{(card.wallet_balance ?? 0).toLocaleString()}</p>
                <p className="text-xs text-gray-400">Balance (RWF)</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <ArrowUpRight size={20} className="mx-auto text-green-500 mb-1" />
                <p className="text-sm font-medium text-gray-700">Ask Admin</p>
                <p className="text-xs text-gray-400">Top Up via MoMo</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                <ArrowDownLeft size={20} className="mx-auto text-orange-500 mb-1" />
                <p className="text-sm font-medium text-gray-700">Canteen</p>
                <p className="text-xs text-gray-400">Tap to purchase</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">How Your Card Works</p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>🔵 <strong className="text-gray-700">Attendance:</strong> Tap your card at the gate every morning (Tap In) and when leaving (Tap Out).</p>
                <p>🟢 <strong className="text-gray-700">Canteen:</strong> Tap your card at the canteen counter. The purchase amount is deducted from your wallet.</p>
                <p>🟡 <strong className="text-gray-700">Top-up:</strong> Your parent or admin can load money via MTN MoMo or cash at the office.</p>
                <p>🔴 <strong className="text-gray-700">Lost card:</strong> Report to admin immediately — they will freeze it to protect your balance.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
