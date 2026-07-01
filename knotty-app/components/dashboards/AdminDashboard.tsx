"use client";
import { useAuth } from "@/context/AuthContext";
import StatsCards from "@/components/StatsCards";
import AttendanceChart from "@/components/AttendanceChart";
import StudentTable from "@/components/StudentTable";
import CourseStatistics from "@/components/CourseStatistics";

export default function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="flex gap-3 h-full overflow-hidden">
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-0 pr-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <StatsCards schoolId={user?.school_id ?? ""} />
          </div>
          <CourseStatistics schoolId={user?.school_id ?? ""} />
        </div>
        <AttendanceChart schoolId={user?.school_id ?? ""} />
        <StudentTable />
      </div>
    </div>
  );
}
