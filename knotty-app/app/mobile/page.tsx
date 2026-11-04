"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isManagementRole } from "@/lib/roles";

const PORTAL: Record<string, string> = {
  TEACHER: "/mobile/teacher",
  CANTEEN: "/mobile/canteen",
  NURSE: "/mobile/nurse",
  PARENT: "/mobile/parent",
  STUDENT: "/mobile/student",
  LIBRARIAN: "/mobile/librarian",
  DISCIPLINE: "/mobile/discipline",
  BURSAR: "/mobile/bursar",
  GATE: "/mobile/gate",
};

export default function MobileIndexPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (isManagementRole(user.role)) {
      router.replace("/mobile/admin");
      return;
    }
    // Portals for Phase 6–8: redirect to coming-soon until they are built
    const dest = PORTAL[user.role] ?? "/mobile/coming-soon";
    router.replace(dest);
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center h-full">
      <div
        className="w-8 h-8 rounded-full border-[2.5px] border-t-transparent animate-spin"
        style={{ borderColor: "#14532D", borderTopColor: "transparent" }}
      />
    </div>
  );
}
