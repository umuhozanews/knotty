"use client";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, Users, Eye, Plus, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function DisciplineDashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Discipline Office</h1>
        <p className="text-sm text-gray-400">Welcome, {user?.first_name}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/discipline" className="bg-red-500 hover:bg-red-600 text-white rounded-2xl p-4 text-center transition">
          <AlertTriangle size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">All Incidents</p>
          <p className="text-xs opacity-80 mt-0.5">View & log cases</p>
        </Link>
        <Link href="/students" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 text-center transition">
          <Users size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Students</p>
          <p className="text-xs opacity-80 mt-0.5">Search student records</p>
        </Link>
        <Link href="/attendance" className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-4 text-center transition">
          <Eye size={28} className="mx-auto" />
          <p className="text-sm font-semibold mt-2">Attendance</p>
          <p className="text-xs opacity-80 mt-0.5">View today's records</p>
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Your Access</p>
        <div className="space-y-2">
          {[
            { label: "Log discipline incidents (warning, suspension, misconduct)", ok: true },
            { label: "View and update any incident", ok: true },
            { label: "View student directory (read-only)", ok: true },
            { label: "View attendance records", ok: true },
            { label: "Notify parents about incidents", ok: true },
            { label: "Create academic reports", ok: false },
            { label: "Record fee payments or canteen sales", ok: false },
            { label: "Issue or freeze cards", ok: false },
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
