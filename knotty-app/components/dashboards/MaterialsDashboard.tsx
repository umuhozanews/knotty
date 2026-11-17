"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabaseMaterialsService, STOCK_CATEGORIES, type MaterialCategory } from "@/lib/supabase/services/materialsService";
import {
  Loader2, Package, AlertTriangle, ChevronRight,
  ChefHat, Utensils, Leaf, BookOpen, FlaskConical,
  Wrench, Trophy, Monitor, Bed, LucideIcon,
} from "lucide-react";
import Link from "next/link";

const CAT_ICON: Record<MaterialCategory, LucideIcon> = {
  kitchen: ChefHat, catering: Utensils, garden: Leaf, academics: BookOpen,
  laboratory: FlaskConical, maintenance: Wrench, sports: Trophy, it_office: Monitor, dormitory: Bed,
};

export default function MaterialsDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<Record<string, { total: number; low: number; out: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) { setLoading(false); return; }
    supabaseMaterialsService.getCategorySummary(user.school_id)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading, user?.school_id]);

  const totalItems = Object.values(summary).reduce((s, v) => s + v.total, 0);
  const totalLow   = Object.values(summary).reduce((s, v) => s + v.low + v.out, 0);

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
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
          <p className="text-2xl font-bold text-gray-800">{loading ? "—" : totalLow}</p>
          <p className="text-xs text-gray-400 mt-0.5">Low / out of stock</p>
        </div>
      </div>

      {!loading && (
        <div className="space-y-2">
          {STOCK_CATEGORIES.map((cat) => {
            const s = summary[cat.key] ?? { total: 0, low: 0, out: 0 };
            const Icon = CAT_ICON[cat.key];
            return (
              <Link key={cat.key} href="/materials"
                className="flex items-center gap-3 p-3 bg-white rounded-2xl shadow-sm hover:shadow-md transition">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cat.bg }}>
                  <Icon size={16} style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{cat.label}</p>
                  <p className="text-xs text-gray-400">
                    {s.total} items
                    {s.low > 0 ? ` · ${s.low} low` : ""}
                    {s.out > 0 ? ` · ${s.out} out` : ""}
                  </p>
                </div>
                <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
      {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={22} /></div>}
    </div>
  );
}
