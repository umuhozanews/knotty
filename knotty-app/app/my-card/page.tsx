"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, cards } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp } from "lucide-react";

export default function MyCardPage() {
  const { loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<{ qr_code: string; expires_at: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (authLoading) return;
    myAccount.profile().then((r) => setProfile(r.data as unknown as Record<string, unknown>)).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  const card = profile?.card as {
    card_number?: string; wallet_balance?: number; is_active?: boolean; is_frozen?: boolean; expires_at?: string;
  } | null;

  const fetchQR = useCallback(() => {
    if (!card) return;
    setQrLoading(true);
    cards.getSecureQR()
      .then((res) => {
        setQrData({ qr_code: res.qr_code, expires_at: res.expires_at });
        const expires = new Date(res.expires_at).getTime();
        const diff = Math.max(0, Math.round((expires - Date.now()) / 1000));
        setTimeLeft(diff);
      })
      .catch(console.error)
      .finally(() => setQrLoading(false));
  }, [card]);

  useEffect(() => {
    if (authLoading || !card) return;
    fetchQR();
  }, [authLoading, card, fetchQR]);

  useEffect(() => {
    if (!qrData) return;
    const interval = setInterval(() => {
      const expires = new Date(qrData.expires_at).getTime();
      const diff = Math.max(0, Math.round((expires - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(interval);
        fetchQR();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [qrData, fetchQR]);

  return (
    <DashboardShell>
      <div className="p-4 overflow-y-auto h-full space-y-4 max-w-md mx-auto">
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

            {/* Secure Dynamic QR Code Section */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-gray-800 text-sm">Dynamic Attendance QR Pass</h3>
                <p className="text-xs text-gray-400">Scan at the school gate to record check-in/out</p>
              </div>

              {qrLoading && !qrData ? (
                <div className="w-48 h-48 rounded-2xl border border-gray-100 flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                </div>
              ) : qrData ? (
                <div className="relative">
                  <img src={qrData.qr_code} className="w-48 h-48 object-contain rounded-2xl border border-gray-100 p-3" alt="Attendance Pass" />
                  {qrLoading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-2xl">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-500">Failed to load attendance pass</p>
              )}

              {qrData && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>Regenerating in {timeLeft}s</span>
                    <button onClick={fetchQR} className="text-blue-500 hover:text-blue-700 font-semibold">Refresh Now</button>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-1000"
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                🔒 Protected by KNOTTY Secure-Scan Algorithm: refreshes automatically to prevent screenshot sharing or attendance fraud.
              </p>
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
