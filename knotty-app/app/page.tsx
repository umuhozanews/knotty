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

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";

  return (
    <DashboardShell>
      {role === "ADMIN"      && <AdminDashboard />}
      {role === "TEACHER"    && <TeacherDashboard />}
      {role === "NURSE"      && <NurseDashboard />}
      {role === "DISCIPLINE" && <DisciplineDashboard />}
      {role === "BURSAR"     && <BursarDashboard />}
      {role === "CANTEEN"    && <CanteenDashboard />}
      {role === "STUDENT"    && <StudentDashboard />}
    </DashboardShell>
  );
}
