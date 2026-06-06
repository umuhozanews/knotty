"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { health, HealthRecord } from "@/lib/api";
import { Loader2, Heart, AlertCircle, CheckCircle, Plus } from "lucide-react";
import Link from "next/link";

const SEVERITY_COLOR: Record<string, string> = {
  LOW:    "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH:   "bg-red-100 text-red-700",
};

const TYPE_COLOR: Record<string, string> = {
  ILLNESS:    "bg-blue-50 text-blue-600",
  INJURY:     "bg-orange-50 text-orange-600",
  MEDICATION: "bg-purple-50 text-purple-600",
  CHECKUP:    "bg-green-50 text-green-600",
  ALLERGY:    "bg-red-50 text-red-600",
};

export default function NurseDashboard() {
  const { user, loading: authLoading } = useAuth();

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Health Office</h1>
        <p className="text-sm text-gray-400">Welcome, Nurse {user?.first_name}</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/health" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 text-center transition">
          <Heart size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Health Records</p>
          <p className="text-xs opacity-80 mt-0.5">View & log incidents</p>
        </Link>
        <Link href="/students" className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-4 text-center transition">
          <Plus size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Find Student</p>
          <p className="text-xs opacity-80 mt-0.5">Search by name or code</p>
        </Link>
        <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
          <AlertCircle size={28} className="mx-auto text-red-400" />
          <p className="text-sm font-semibold mt-2 text-gray-700">Follow-ups</p>
          <p className="text-xs text-gray-400 mt-0.5">Check pending cases</p>
        </div>
      </div>

      {/* What nurses can do */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Your Access</p>
        <div className="space-y-2">
          {[
            { label: "Log health incidents (illness, injury, medication, checkup, allergy)", ok: true },
            { label: "View any student's health history", ok: true },
            { label: "Update and close health records", ok: true },
            { label: "Mark follow-up required", ok: true },
            { label: "View student directory (read-only)", ok: true },
            { label: "Create academic reports", ok: false },
            { label: "Record fee payments", ok: false },
            { label: "Mark attendance", ok: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {item.ok
                ? <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                : <AlertCircle size={15} className="text-gray-300 flex-shrink-0" />}
              <p className={`text-sm ${item.ok ? "text-gray-700" : "text-gray-300"}`}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
