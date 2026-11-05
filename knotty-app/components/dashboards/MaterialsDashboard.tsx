"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabaseMaterialsService, type SchoolMaterialItem, type MaterialTransaction } from "@/lib/supabase/services/materialsService";
import { Loader2, Package, AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

export default function MaterialsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SchoolMaterialItem[]>([]);
  const [recentTx, setRecentTx] = useState<MaterialTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) { setLoading(false); return; }

    Promise.all([
      supabaseMaterialsService.listMaterials(user.school_id),
      supabaseMaterialsService.listTransactions(user.school_id),
    ])
      .then(([itemsData, txData]) => {
        setItems(itemsData);
        setRecentTx(txData.slice(0, 10));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, user?.school_id]);

  const lowStock = items.filter((i) => i.status === "low_stock" || i.status === "out_of_stock").length;
  const totalItems = items.length;

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Materials & Inventory</h1>
          <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
        </div>
        <Link href="/materials"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-medium hover:bg-blue-700 transition">
          <Plus size={15} />Manage Inventory
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
            <Package size={17} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : totalItems}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total items</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center mb-3">
            <AlertTriangle size={17} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : lowStock}</p>
          <p className="text-xs text-gray-400 mt-0.5">Low stock</p>
        </div>
      </div>

      {/* Low stock alert */}
      {!loading && lowStock > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">{lowStock} item{lowStock > 1 ? "s" : ""} running low</p>
            <p className="text-xs text-red-500 mt-0.5">Review inventory and reorder as needed.</p>
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Recent Transactions</p>
          <Link href="/materials" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-400" size={22} /></div>
        ) : recentTx.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="mx-auto text-gray-100 mb-2" />
            <p className="text-sm text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentTx.slice(0, 8).map((tx) => {
              const isOut = tx.transaction_type === "stock_out" || tx.transaction_type === "damage_disposal";
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isOut ? "bg-red-50" : "bg-green-50"}`}>
                    {isOut
                      ? <ArrowUpRight size={14} className="text-red-500" />
                      : <ArrowDownRight size={14} className="text-green-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.material_name ?? "Item"}</p>
                    <p className="text-xs text-gray-400 capitalize">{tx.transaction_type} · qty {tx.quantity}</p>
                  </div>
                  <p className="text-[10px] text-gray-300 flex-shrink-0">
                    {new Date(tx.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
