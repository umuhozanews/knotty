"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Scan } from "lucide-react";
import BottomTabs from "@/components/mobile/BottomTabs";
import { Home, Building2, MoreHorizontal } from "lucide-react";
import type { MobileTab } from "@/components/mobile/BottomTabs";

const TABS: MobileTab[] = [
  { label: "Today", href: "/mobile/admin", icon: <Home size={22} /> },
  { label: "School", href: "/mobile/admin/school", icon: <Building2 size={22} /> },
  { label: "More", href: "/mobile/admin/more", icon: <MoreHorizontal size={22} /> },
];

export default function AdminAttendancePage() {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-3 px-4 py-4 bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-xl active:bg-gray-100"
        >
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-semibold text-gray-800">Attendance</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Scan size={40} className="text-gray-300" />
        <p className="text-gray-500 text-sm">Attendance scanning is coming in Phase 2.</p>
      </div>
      <BottomTabs tabs={TABS} activeColor="#14532D" />
    </div>
  );
}
