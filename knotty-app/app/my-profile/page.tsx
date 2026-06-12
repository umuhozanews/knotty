"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, User, Phone, Mail, MapPin, Calendar, CreditCard } from "lucide-react";

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    myAccount.profile().then((r) => setProfile(r.data as unknown as Record<string, unknown>)).catch(console.error).finally(() => setLoading(false));
  }, [authLoading]);

  const s = profile as {
    student_code?: string; gender?: string; date_of_birth?: string; nationality?: string; enrollment_date?: string;
    user?: { first_name?: string; last_name?: string; email?: string; phone?: string; profile_photo?: string };
    level?: { name?: string }; class?: { name?: string };
    parent?: { first_name?: string; last_name?: string; phone?: string; email?: string };
    card?: { card_number?: string; wallet_balance?: number; is_active?: boolean; expires_at?: string };
  } | null;

  function field(icon: React.ElementType, label: string, val: string | undefined | null) {
    const Icon = icon;
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={14} className="text-blue-500" />
        </div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-sm font-medium text-gray-800">{val || "—"}</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="p-2 sm:p-4 space-y-4">
        <h1 className="text-xl font-bold text-gray-800">My Profile</h1>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !s ? (
          <p className="text-gray-400 text-center py-8">Profile not found</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Photo + name card */}
            <div className="bg-gradient-to-br from-blue-600 to-green-600 rounded-2xl p-6 text-white text-center">
              {s.user?.profile_photo ? (
                <img src={s.user.profile_photo} alt="" className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-white/30 mb-3" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                  <User size={32} className="text-white" />
                </div>
              )}
              <p className="text-xl font-bold">{s.user?.first_name} {s.user?.last_name}</p>
              <p className="text-sm opacity-80 mt-0.5">{s.level?.name} · Class {s.class?.name}</p>
              <p className="text-xs opacity-60 mt-1 font-mono">{s.student_code}</p>
            </div>

            {/* Personal info */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-700 mb-1">Personal Information</p>
              {field(User, "Full Name", `${s.user?.first_name} ${s.user?.last_name}`)}
              {field(Mail, "Email", s.user?.email)}
              {field(Phone, "Phone", s.user?.phone)}
              {field(Calendar, "Date of Birth", s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("en-GB") : null)}
              {field(MapPin, "Nationality", s.nationality)}
              {field(User, "Gender", s.gender)}
            </div>

            {/* Academic + card + parent */}
            <div className="space-y-3">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">Academic</p>
                {field(User, "Level", s.level?.name)}
                {field(User, "Class", s.class?.name)}
                {field(Calendar, "Enrolled", s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString("en-GB") : null)}
              </div>

              {s.card && (
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">My KNOTTY Card</p>
                  {field(CreditCard, "Card Number", s.card.card_number)}
                  {field(CreditCard, "Wallet Balance", `${(s.card.wallet_balance ?? 0).toLocaleString()} RWF`)}
                  {field(CreditCard, "Status", s.card.is_active ? "Active" : "Inactive")}
                  {field(Calendar, "Expires", s.card.expires_at ? new Date(s.card.expires_at).toLocaleDateString("en-GB") : null)}
                </div>
              )}

              {s.parent && (
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Parent / Guardian</p>
                  {field(User, "Name", `${s.parent.first_name} ${s.parent.last_name}`)}
                  {field(Phone, "Phone", s.parent.phone)}
                  {field(Mail, "Email", s.parent.email)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
