"use client";
import { useAuth } from "@/context/AuthContext";
import { Users, Phone, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ParentDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Parent / Guardian Portal</h1>
        <p className="text-sm text-gray-400">Welcome, {user?.first_name} {user?.last_name}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Users size={24} className="text-blue-500" />
        </div>
        <h2 className="text-base font-bold text-gray-800 mb-2">Link your children&apos;s accounts</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-5">
          To view your children&apos;s attendance, card balance, and academic reports, ask your school administrator to send you a guardian invitation link.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600">
            <Phone size={14} className="text-gray-400" />
            Contact the school office
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-600">
            <Mail size={14} className="text-gray-400" />
            Or request via email
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { href: "/my-profile", label: "My Profile", sub: "View your account details" },
        ].map(({ href, label, sub }) => (
          <Link key={href} href={href}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:shadow-md transition group">
            <div>
              <p className="text-sm font-semibold text-gray-800">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
            <ArrowRight size={16} className="text-gray-200 group-hover:text-blue-500 transition" />
          </Link>
        ))}
      </div>
    </div>
  );
}
