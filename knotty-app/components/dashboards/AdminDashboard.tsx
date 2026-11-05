"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import StatsCards from "@/components/StatsCards";
import AttendanceChart from "@/components/AttendanceChart";
import StudentTable from "@/components/StudentTable";
import CourseStatistics from "@/components/CourseStatistics";
import { Building2, ChevronRight } from "lucide-react";

export default function AdminDashboard() {
  const { user, activeSchool } = useAuth();
  const router = useRouter();
  const schoolId = activeSchool?.id || user?.school_id || "";

  if (!schoolId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
          <Building2 size={28} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">No school selected</h2>
          <p className="text-sm text-gray-400 mt-1">Go to Schools to select the school you want to manage.</p>
        </div>
        <button
          onClick={() => router.push("/schools")}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-2xl text-sm font-semibold hover:bg-green-700 transition"
        >
          Go to Schools <ChevronRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-3 h-full overflow-hidden">
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-0 pr-1">
        {activeSchool && (
          <div className="flex items-center gap-2 px-1">
            <Building2 size={14} className="text-gray-400" />
            <p className="text-xs text-gray-500 font-medium">{activeSchool.name} ({activeSchool.code})</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <StatsCards schoolId={schoolId} />
          </div>
          <CourseStatistics schoolId={schoolId} />
        </div>
        <AttendanceChart schoolId={schoolId} />
        <StudentTable />
      </div>
    </div>
  );
}
