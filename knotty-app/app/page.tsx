"use client";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import TeacherDashboard from "@/components/dashboards/TeacherDashboard";
import NurseDashboard from "@/components/dashboards/NurseDashboard";
import DisciplineDashboard from "@/components/dashboards/DisciplineDashboard";
import BursarDashboard from "@/components/dashboards/BursarDashboard";
import CanteenDashboard from "@/components/dashboards/CanteenDashboard";
import StudentDashboard from "@/components/dashboards/StudentDashboard";
import ParentDashboard from "@/components/dashboards/ParentDashboard";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
      {role === "ADMIN"      && <AdminDashboard />}
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
