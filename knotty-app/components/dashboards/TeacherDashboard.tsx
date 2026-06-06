"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { structure, Class } from "@/lib/api";
import { Loader2, Users, BookOpen, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function TeacherDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    structure.classes()
      .then((r) => setClasses(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authLoading]);

  const totalStudents = classes.reduce((s, c) => s + (c._count?.students ?? 0), 0);

  return (
    <div className="flex gap-3 h-full overflow-hidden">
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-0 pr-1">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Welcome, {user?.first_name}</h1>
          <p className="text-sm text-gray-400">Teacher Dashboard · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
              <Users size={17} className="text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{loading ? "—" : totalStudents}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total students</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <BookOpen size={17} className="text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-800">{loading ? "—" : classes.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Classes assigned</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
              <FileText size={17} className="text-purple-600" />
            </div>
            <Link href="/reports" className="text-sm font-semibold text-purple-600 hover:underline">Reports</Link>
            <p className="text-xs text-gray-400 mt-0.5">Academic</p>
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Your Classes</p>
            <Link href="/attendance" className="text-xs text-blue-600 hover:underline">Mark Attendance →</Link>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-blue-400" size={20} /></div>
          ) : classes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No classes assigned yet</p>
          ) : (
            <div className="space-y-2">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{cls.level?.name} — {cls.name}</p>
                    <p className="text-xs text-gray-400">{cls._count?.students ?? 0} students · {cls.academic_year}</p>
                  </div>
                  <div className="flex gap-2">
                    <Link href="/attendance"
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition">
                      Attendance
                    </Link>
                    <Link href="/reports"
                      className="text-xs px-2.5 py-1.5 rounded-xl bg-green-50 text-green-600 font-medium hover:bg-green-100 transition">
                      Reports
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: "/materials", icon: BookOpen,      label: "Class Materials",   sub: "Upload notes & slides",     bg: "bg-green-50",  ic: "text-green-600" },
            { href: "/discipline", icon: AlertTriangle, label: "Discipline Log",    sub: "Log a student incident",    bg: "bg-red-50",    ic: "text-red-500" },
          ].map(({ href, icon: Icon, label, sub, bg, ic }) => (
            <Link key={href} href={href}
              className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition group">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={18} className={ic} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 truncate">{sub}</p>
              </div>
              <ChevronRight size={14} className="text-gray-200 group-hover:text-blue-500 transition flex-shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
