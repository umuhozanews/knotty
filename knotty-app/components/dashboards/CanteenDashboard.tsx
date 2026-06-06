"use client";
import { useAuth } from "@/context/AuthContext";
import { ShoppingCart, CreditCard, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function CanteenDashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Canteen</h1>
        <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/canteen" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-5 text-center transition">
          <ShoppingCart size={32} className="mx-auto" />
          <p className="text-base font-bold mt-2">Process Sale</p>
          <p className="text-xs opacity-80 mt-0.5">Scan card & add items</p>
        </Link>
        <Link href="/canteen" className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-5 text-center transition">
          <TrendingUp size={32} className="mx-auto" />
          <p className="text-base font-bold mt-2">Today's Sales</p>
          <p className="text-xs opacity-80 mt-0.5">Revenue & transactions</p>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Your Access</p>
        <div className="space-y-2">
          {[
            { label: "Scan student card and process canteen purchases", ok: true },
            { label: "View today's revenue and transaction log", ok: true },
            { label: "Check student card wallet balance", ok: true },
            { label: "Add items to cart and deduct from wallet", ok: true },
            { label: "Top-up student wallets", ok: false },
            { label: "View student academic records", ok: false },
            { label: "Mark attendance or log discipline", ok: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {item.ok
                ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                : <AlertCircle size={15} className="text-gray-300 flex-shrink-0" />}
              <p className={`text-sm ${item.ok ? "text-gray-700" : "text-gray-300"}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
