"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { Calendar } from "lucide-react";
import { schools, AttendanceTrendPoint } from "@/lib/api";
import { isDemoMode, DEMO_TREND } from "@/lib/demo";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload?.length) {
    return (
      <div className="bg-[#121212] text-white text-xs rounded-lg px-3 py-1.5 font-semibold border border-[#dcd9d9] shadow-none">
        {payload[0].value}
      </div>
    );
  }
  return null;
}

export default function AttendanceChart({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<AttendanceTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    schools.trend(schoolId, 9)
      .then((r) => setData(r.data))
      .catch(() => { if (isDemoMode()) setData(DEMO_TREND); })
      .finally(() => setLoading(false));
  }, [schoolId]);

  const peak = data.reduce((max, d) => Math.max(max, d.present), 0);

  return (
    <div className="bg-white rounded-lg border border-[#dcd9d9] p-5 shadow-none">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#121212]">Total Attendance Report</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-[#121212] inline-block" />Present
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full bg-[#dcd9d9] inline-block" />Absence
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <Calendar size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#121212] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="present" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#121212" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#121212" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="absence" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dcd9d9" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#dcd9d9" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#fcf9f8" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="present" stroke="#121212" strokeWidth={2.5} fill="url(#present)" dot={false} activeDot={{ r: 5, fill: "#121212" }} />
            <Area type="monotone" dataKey="absence" stroke="#dcd9d9" strokeWidth={2.5} fill="url(#absence)" dot={false} activeDot={{ r: 5, fill: "#dcd9d9" }} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!loading && peak === 0 && (
        <p className="text-center text-xs text-gray-400 -mt-2">No attendance data yet — run the seed and mark some attendance.</p>
      )}
    </div>
  );
}
