"use client";
import { useAuth } from "@/context/AuthContext";
import { Smartphone } from "lucide-react";
import Link from "next/link";

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Teacher",
  CANTEEN: "Canteen",
  NURSE: "Nurse",
  PARENT: "Parent",
  STUDENT: "Student",
  LIBRARIAN: "Librarian",
  DISCIPLINE: "Discipline Office",
  BURSAR: "Bursar",
  GATE: "Gate",
};

export default function MobileComingSoon() {
  const { user, logout } = useAuth();
  const roleLabel = ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? "Your";

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
          <Smartphone size={32} className="text-gray-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Mobile portal coming soon</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            The {roleLabel} mobile portal is being built. Use the full site in the meantime.
          </p>
        </div>
        <Link
          href="/"
          className="min-h-[52px] px-8 rounded-2xl font-semibold text-[16px] flex items-center justify-center"
          style={{ backgroundColor: "#14532D", color: "white" }}
        >
          Open full site
        </Link>
        <button
          onClick={logout}
          className="text-sm text-gray-400 underline underline-offset-2 mt-1"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
