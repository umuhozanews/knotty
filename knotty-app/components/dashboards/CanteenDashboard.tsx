"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { canteen, CanteenTransaction } from "@/lib/api";
import { Loader2, ShoppingCart, TrendingUp, CreditCard, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function CanteenDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [report, setReport] = useState<{
    total_revenue: number;
    transaction_count: number;
    transactions: CanteenTransaction[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    canteen.dailyReport()
      .then((r) => setReport(r as { total_revenue: number; transaction_count: number; transactions: CanteenTransaction[] }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  const fmt = (n: number) => n.toLocaleString("en");

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Canteen</h1>
          <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
        </div>
        <Link href="/canteen"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
          <ShoppingCart size={15} />Process Sale
        </Link>
      </div>

      {/* Today stats */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Today</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-2">
              <TrendingUp size={17} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? <span className="h-5 w-20 bg-gray-100 rounded animate-pulse inline-block" /> : fmt(report?.total_revenue ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Revenue (RWF)</p>
          </div>
          <div>
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-2">
              <ShoppingCart size={17} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? <span className="h-5 w-12 bg-gray-100 rounded animate-pulse inline-block" /> : (report?.transaction_count ?? 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Transactions</p>
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Today's Transactions</p>
          <Link href="/canteen" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-400" size={22} /></div>
        ) : !report?.transactions?.length ? (
          <div className="text-center py-8">
            <ShoppingCart size={32} className="mx-auto text-gray-100 mb-2" />
            <p className="text-sm text-gray-400">No sales yet today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {report.transactions.slice(0, 10).map((tx) => {
              const s = tx.student as { user?: { first_name?: string; last_name?: string } } | undefined;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={14} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {s?.user?.first_name} {s?.user?.last_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(tx.items_purchased as Array<{ name: string }>)?.map((i) => i.name).join(", ")}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-800">{fmt(tx.total_amount)} <span className="text-xs font-normal text-gray-400">RWF</span></p>
                    <p className="text-[10px] text-gray-300">
                      {new Date(tx.transaction_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
