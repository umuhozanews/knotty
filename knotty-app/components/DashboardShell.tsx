"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDashboardPath } from "@/context/AuthContext";
import { isManagementRole } from "@/lib/roles";
import Sidebar from "./Sidebar";
import Header from "./Header";

// Mirrors the Sidebar nav roles exactly — any path not listed is open to all authenticated users
const ROUTE_ACCESS: Array<{ path: string; roles: string[] }> = [
  { path: "/students",       roles: ["ADMIN","TEACHER","BURSAR","DISCIPLINE","LIBRARIAN","NURSE"] },
  { path: "/workers",        roles: ["ADMIN"] },
  { path: "/schools",        roles: ["ADMIN"] },
  { path: "/attendance",         roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { path: "/class-attendance",   roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { path: "/attendance/staff",   roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { path: "/library",        roles: ["ADMIN","LIBRARIAN"] },
  { path: "/discipline",     roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { path: "/health",         roles: ["ADMIN","NURSE"] },
  { path: "/cards",          roles: ["ADMIN","BURSAR"] },
  { path: "/canteen",        roles: ["ADMIN","CANTEEN"] },
  { path: "/fees",           roles: ["ADMIN","BURSAR","STUDENT","PARENT"] },
  { path: "/standalone-tap", roles: ["ADMIN","BURSAR","CANTEEN"] },
  { path: "/gate",           roles: ["ADMIN","GATEKEEPER","DISCIPLINE"] },
  { path: "/gate-access",    roles: ["ADMIN","GATEKEEPER"] },
  { path: "/materials",      roles: ["ADMIN","MATERIALS"] },
  { path: "/logs",           roles: ["ADMIN"] },
  { path: "/reports",        roles: ["ADMIN"] },
  { path: "/portal-admin",   roles: ["ADMIN"] },
  { path: "/admin",          roles: ["ADMIN"] },
  { path: "/platform",       roles: ["PLATFORM_ADMIN"] },
  { path: "/my-dashboard",   roles: ["STUDENT","PARENT"] },
  { path: "/my-profile",     roles: ["STUDENT"] },
  { path: "/my-attendance",  roles: ["STUDENT"] },
  { path: "/my-card",        roles: ["STUDENT","PARENT"] },
  { path: "/my-discipline",  roles: ["STUDENT"] },
  { path: "/my-library",     roles: ["STUDENT","LIBRARIAN"] },
  { path: "/my-health",      roles: ["STUDENT","NURSE"] },
  { path: "/my-reports",     roles: ["STUDENT","PARENT"] },
  { path: "/my-gate",        roles: ["STUDENT","PARENT"] },
];

function isRouteAllowed(pathname: string, role: string): boolean {
  const match = ROUTE_ACCESS.find(
    (r) => pathname === r.path || pathname.startsWith(r.path + "/")
  );
  // No entry = open to any authenticated user (covers "/", "/settings", "/api/*", etc.)
  if (!match) return true;
  return match.roles.includes(role);
}

export default function DashboardShell({
  children,
  hideHeader,
}: {
  children: React.ReactNode;
  hideHeader?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hideSidebar = isManagementRole(user?.role);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isRouteAllowed(pathname, user.role)) {
      router.replace(getDashboardPath(user.role));
    }
  }, [user, loading, router, mounted, pathname]);

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="animate-spin" size={32} style={{ color: "#16A34A" }} />
      </div>
    );
  }

  if (!user) return null;
  // Suppress content flash while redirect is in flight
  if (!isRouteAllowed(pathname, user.role)) return null;

  return (
    <div className="flex h-[100dvh] p-2 md:p-3 gap-2 md:gap-3 overflow-hidden relative" style={{ background: "var(--bg)" }}>
      {!hideSidebar && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      {!hideSidebar && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {!hideHeader && <Header onMenuClick={() => setSidebarOpen(true)} hideSidebarToggle={hideSidebar} />}
        <main className={`flex-1 overflow-auto${hideHeader ? "" : " mt-2 md:mt-3"}`}>{children}</main>
        <footer className="text-center py-1.5 text-[10px] text-gray-400">
          Built by <span className="font-bold" style={{ color: "#16A34A" }}>OrynTechltd</span>
        </footer>
      </div>
    </div>
  );
}
