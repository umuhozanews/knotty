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

const AdminDashboard      = dynamic(() => import("@/components/dashboards/AdminDashboard"),      { ssr: false, loading: DashboardLoader });
const TeacherDashboard    = dynamic(() => import("@/components/dashboards/TeacherDashboard"),    { ssr: false, loading: DashboardLoader });
const NurseDashboard      = dynamic(() => import("@/components/dashboards/NurseDashboard"),      { ssr: false, loading: DashboardLoader });
const DisciplineDashboard = dynamic(() => import("@/components/dashboards/DisciplineDashboard"), { ssr: false, loading: DashboardLoader });
const BursarDashboard     = dynamic(() => import("@/components/dashboards/BursarDashboard"),     { ssr: false, loading: DashboardLoader });
const CanteenDashboard    = dynamic(() => import("@/components/dashboards/CanteenDashboard"),    { ssr: false, loading: DashboardLoader });
const GatekeeperDashboard = dynamic(() => import("@/components/dashboards/GatekeeperDashboard"), { ssr: false, loading: DashboardLoader });
const MaterialsDashboard  = dynamic(() => import("@/components/dashboards/MaterialsDashboard"),  { ssr: false, loading: DashboardLoader });
const StudentDashboard    = dynamic(() => import("@/components/dashboards/StudentDashboard"),    { ssr: false, loading: DashboardLoader });
const ParentDashboard     = dynamic(() => import("@/components/dashboards/ParentDashboard"),     { ssr: false, loading: DashboardLoader });

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const role = user?.role ?? "";

  useEffect(() => {
    if (role === "LIBRARIAN") router.replace("/library");
    if (role === "STUDENT")   router.replace("/my-dashboard");
  }, [role, router]);

  return (
    <DashboardShell>
      {(!role || isManagementRole(role)) && <AdminDashboard />}
      {role === "TEACHER"     && <TeacherDashboard />}
      {role === "NURSE"       && <NurseDashboard />}
      {role === "DISCIPLINE"  && <DisciplineDashboard />}
      {role === "BURSAR"      && <BursarDashboard />}
      {role === "CANTEEN"     && <CanteenDashboard />}
      {role === "GATEKEEPER"  && <GatekeeperDashboard />}
      {role === "MATERIALS"   && <MaterialsDashboard />}
      {role === "STUDENT"     && <StudentDashboard />}
      {role === "PARENT"      && <ParentDashboard />}
      {role === "LIBRARIAN"   && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-gray-700">Opening Library...</p>
        </div>
      )}
    </DashboardShell>
  );
}
