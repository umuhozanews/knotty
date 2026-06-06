"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Fallback: read demo user directly from localStorage so the dashboard
  // works even when AuthContext hasn't re-hydrated yet after a hard reload.
  const [demoUser, setDemoUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    if (localStorage.getItem("knotty_demo") === "true") {
      const saved = localStorage.getItem("knotty_demo_user");
      if (saved) setDemoUser(JSON.parse(saved));
    }
  }, []);

  const resolvedUser = user ?? demoUser;

  useEffect(() => {
    if (!loading && !resolvedUser) router.replace("/login");
  }, [resolvedUser, loading, router]);

  if (loading && !resolvedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!resolvedUser) return null;

  return (
    <div className="flex h-screen p-3 gap-3 overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-auto mt-3">{children}</main>
      </div>
    </div>
  );
}
