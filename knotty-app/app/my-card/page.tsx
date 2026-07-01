"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, cards, canteen, CanteenTransaction } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, CreditCard, ArrowUpRight, ArrowDownLeft, TrendingUp, ShoppingCart } from "lucide-react";

export default function MyCardPage() {
  const { loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<{ qr_code: string; expires_at: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [transactions, setTransactions] = useState<CanteenTransaction[]>([]);

  useEffect(() => {
    if (authLoading) return;
    Promise.all([
      myAccount.profile(),
      canteen.myTransactions(1, 10).catch(() => ({ data: [] })),
    ]).then(([p, t]) => {
      setProfile(p.data as unknown as Record<string, unknown>);
      setTransactions((t.data as CanteenTransaction[]) ?? []);
    }).catch(console.error).finally(() => setLoading(false));
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
      <div className="p-4 sm:p-6 space-y-6 max-w-md mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Card & Wallet</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !card ? (
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
                  <p className="text-[10px] font-bold tracking-widest text-[#d9ff8c] uppercase">KNOTTY Smart Card</p>
                  <p className="text-[9px] opacity-50">School Management System</p>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-[#d9ff8c]/20 bg-[#d9ff8c]/10 text-[#d9ff8c]">
                  {card.is_frozen ? "FROZEN" : card.is_active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs opacity-50 mb-0.5 font-semibold">Wallet Balance</p>
                <p className="text-3xl font-extrabold tracking-tight">{(card.wallet_balance ?? 0).toLocaleString()} <span className="text-base font-normal opacity-70">RWF</span></p>
              </div>
              <div className="mt-4 flex justify-between items-end">
                <div>
                  <p className="text-[8px] opacity-50 uppercase tracking-widest font-bold">Card Number</p>
                  <p className="text-sm font-mono tracking-[0.12em] mt-0.5 text-white">{card.card_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] opacity-50 uppercase tracking-widest font-bold">Expires</p>
                  <p className="text-xs mt-0.5 text-white">{card.expires_at ? new Date(card.expires_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            </div>

            {/* Secure Dynamic QR Code Section */}
            <div className="bg-[#ffffff] rounded-lg p-5 border border-[#dcd9d9] flex flex-col items-center text-center space-y-4 shadow-none">
              <div className="space-y-1">
                <h3 className="font-extrabold text-[#121212] tracking-tight text-sm uppercase">Dynamic Attendance QR Pass</h3>
                <p className="text-xs text-gray-500 font-semibold">Scan at the school gate to record check-in/out</p>
              </div>

              {qrLoading && !qrData ? (
                <div className="w-48 h-48 rounded-lg border border-[#dcd9d9] flex items-center justify-center bg-[#fcf9f8]">
                  <Loader2 className="animate-spin text-blue-500" size={24} />
                </div>
              ) : qrData ? (
                <div className="relative">
                  <img src={qrData.qr_code} className="w-48 h-48 object-contain rounded-lg border border-[#dcd9d9] p-3 bg-white" alt="Attendance Pass" />
                  {qrLoading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                      <Loader2 className="animate-spin text-blue-500" size={20} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-500 font-bold">Failed to load attendance pass</p>
              )}

              {qrData && (
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
                    <span>Regenerating in {timeLeft}s</span>
                    <button onClick={fetchQR} className="text-[#121212] hover:text-black font-bold border-b border-gray-400">Refresh Now</button>
                  </div>
                  <div className="w-full h-1.5 bg-[#dcd9d9] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#121212] transition-all duration-1000"
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 bg-[#fcf9f8] px-3 py-2 rounded-lg border border-[#dcd9d9] font-semibold">
                🔒 Protected by KNOTTY Secure-Scan Algorithm: refreshes automatically to prevent screenshot sharing or attendance fraud.
              </p>
            </div>

            {/* Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center hover:border-[#dcd9d9] transition duration-200">
                <TrendingUp size={20} className="mx-auto text-[#121212] mb-1.5" />
                <p className="text-lg font-extrabold tracking-tight text-[#121212]">{(card.wallet_balance ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Balance (RWF)</p>
              </div>
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center hover:border-[#dcd9d9] transition duration-200">
                <ArrowUpRight size={20} className="mx-auto text-[#121212] mb-1.5" />
                <p className="text-xs font-bold text-[#121212]">Ask Admin</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Top Up Cash</p>
              </div>
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-4 text-center hover:border-[#dcd9d9] transition duration-200">
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
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-[#dcd9d9] last:border-0">
                      <div>
                        <p className="text-xs font-bold text-[#121212]">
                          {Array.isArray(tx.items_purchased) && tx.items_purchased.length > 0
                            ? tx.items_purchased.map((i) => i.name).join(", ")
                            : "Canteen purchase"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(tx.transaction_time).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <span className="text-sm font-extrabold text-red-500">-{(tx.total_amount ?? 0).toLocaleString()} RWF</span>
                    </div>
                  ))}
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
