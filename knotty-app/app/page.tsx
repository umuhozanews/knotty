"use client";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import dynamic from "next/dynamic";
import { isManagementRole } from "@/lib/roles";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function DashboardLoader() {
  return (
    <div className="flex items-center justify-center py-20 min-h-[300px]">
      <Loader2 className="animate-spin text-orange-500" size={28} />
    </div>
  );
}

const AdminDashboard = dynamic(() => import("@/components/dashboards/AdminDashboard"), { loading: DashboardLoader });
const TeacherDashboard = dynamic(() => import("@/components/dashboards/TeacherDashboard"), { loading: DashboardLoader });
const NurseDashboard = dynamic(() => import("@/components/dashboards/NurseDashboard"), { loading: DashboardLoader });
const DisciplineDashboard = dynamic(() => import("@/components/dashboards/DisciplineDashboard"), { loading: DashboardLoader });
const BursarDashboard = dynamic(() => import("@/components/dashboards/BursarDashboard"), { loading: DashboardLoader });
const CanteenDashboard = dynamic(() => import("@/components/dashboards/CanteenDashboard"), { loading: DashboardLoader });
const StudentDashboard = dynamic(() => import("@/components/dashboards/StudentDashboard"), { loading: DashboardLoader });
const ParentDashboard = dynamic(() => import("@/components/dashboards/ParentDashboard"), { loading: DashboardLoader });

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const role = user?.role ?? "";

  useEffect(() => {
    if (role === "LIBRARIAN") {
      router.replace("/library");
    }
  }, [role, router]);

  return (
    <DashboardShell>
      {(!role || isManagementRole(role)) && <AdminDashboard />}
      {role === "TEACHER"    && <TeacherDashboard />}
      {role === "NURSE"      && <NurseDashboard />}
      {role === "DISCIPLINE" && <DisciplineDashboard />}
      {role === "BURSAR"     && <BursarDashboard />}
      {role === "CANTEEN"    && <CanteenDashboard />}
      {role === "STUDENT"    && <StudentDashboard />}
      {role === "PARENT"     && <ParentDashboard />}
      {role === "LIBRARIAN"  && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-gray-700">Opening Library Management...</p>
        </div>
      )}
    </DashboardShell>
  );
}
