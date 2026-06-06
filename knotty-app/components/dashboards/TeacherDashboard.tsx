"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { structure, reports, discipline, Class, AcademicReport } from "@/lib/api";
import { Loader2, Users, FileText, BookOpen, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";

function StatBox({ icon: Icon, label, value, color, href }: { icon: React.ElementType; label: string; value: number | string; color: string; href: string }) {
  return (
    <Link href={href} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 hover:shadow-md transition group">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300 group-hover:text-blue-500 transition" />
    </Link>
  );
}

export default function TeacherDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [recentReports, setRecentReports] = useState<AcademicReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    Promise.all([
      structure.classes(),
    ]).then(([cls]) => {
      setClasses(cls.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Welcome back, {user?.first_name}</h1>
        <p className="text-sm text-gray-400">Teacher Dashboard</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox icon={Users}         label="Total Classes"   value={classes.length}    color="bg-blue-500"   href="/students" />
        <StatBox icon={FileText}      label="Create Report"   value="+"                 color="bg-green-500"  href="/reports" />
        <StatBox icon={BookOpen}      label="Upload Notes"    value="+"                 color="bg-purple-500" href="/materials" />
        <StatBox icon={AlertTriangle} label="Discipline Log"  value="+"                 color="bg-blue-500" href="/discipline" />
      </div>

      {/* Classes */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Your Classes</p>
          <Link href="/attendance" className="text-xs text-blue-600 hover:underline">Mark Attendance</Link>
        </div>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No classes assigned yet</p>
        ) : (
          <div className="space-y-2">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-700">{cls.level?.name} — {cls.name}</p>
                  <p className="text-xs text-gray-400">{cls._count?.students ?? 0} students · {cls.academic_year}</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/attendance" className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition">Attendance</Link>
                  <Link href="/reports" className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-600 font-medium hover:bg-green-100 transition">Reports</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/attendance" className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-4 text-center transition">
          <ClipboardCheckIcon />
          <p className="text-sm font-semibold mt-2">Mark Attendance</p>
          <p className="text-xs opacity-80 mt-0.5">Bulk mark your class</p>
        </Link>
        <Link href="/materials" className="bg-green-600 hover:bg-green-700 text-white rounded-2xl p-4 text-center transition">
          <BookOpenIcon />
          <p className="text-sm font-semibold mt-2">Upload Notes</p>
          <p className="text-xs opacity-80 mt-0.5">PDF, Word, slides</p>
        </Link>
        <Link href="/reports" className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl p-4 text-center transition">
          <FileIcon />
          <p className="text-sm font-semibold mt-2">Create Report</p>
          <p className="text-xs opacity-80 mt-0.5">Enter CAT & Exam marks</p>
        </Link>
      </div>
    </div>
  );
}

function ClipboardCheckIcon() {
  return <svg className="w-7 h-7 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
}
function BookOpenIcon() {
  return <svg className="w-7 h-7 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
}
function FileIcon() {
  return <svg className="w-7 h-7 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}
