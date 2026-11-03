"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, User, Phone, Mail, MapPin, Calendar, CreditCard } from "lucide-react";

type MyProfile = {
  student_id: string;
  admission_number: string;
  legal_name: string;
  gender: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  student_status: string;
  profile_photo_path: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  class_section_name: string | null;
  education_level_name: string | null;
  card_assignment_id: string | null;
  card_number: string | null;
  card_status: string | null;
  wallet_balance: number;
};

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user?.school_id) return;
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }
    async function load() {
      try {
        const { data: rows } = await client!.rpc("get_my_student_profile", { p_school_id: user!.school_id });
        setProfile((rows as any)?.[0] ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  function field(icon: React.ElementType, label: string, val: string | undefined | null) {
    const Icon = icon;
    return (
      <div className="flex items-start gap-3 py-3 border-b border-[#dcd9d9] last:border-0">
        <div className="w-8 h-8 rounded-lg bg-[#121212]/5 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={14} className="text-[#121212]" />
        </div>
        <div>
          <p className="text-xs text-gray-500 font-semibold">{label}</p>
          <p className="text-sm font-extrabold tracking-tight text-[#121212]">{val || "—"}</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Profile</h1>
          <p className="text-xs text-gray-500 mt-0.5">View your personal and academic information</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !profile ? (
          <p className="text-gray-400 text-center py-8">Profile not found</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Photo Card */}
            <div className="bg-[#121212] rounded-lg p-6 text-[#fcf9f8] text-center flex flex-col items-center justify-center relative border border-[#dcd9d9]/20 shadow-none">
              <div className="relative mb-3">
                {profile.profile_photo_path ? (
                  <img src={profile.profile_photo_path} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-white/10" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/10">
                    <User size={40} className="text-white" />
                  </div>
                )}
              </div>
              <p className="text-xl font-bold">{profile.legal_name}</p>
              <p className="text-sm opacity-85 mt-0.5">{profile.education_level_name} · {profile.class_section_name}</p>
              <p className="text-xs text-[#d9ff8c] font-mono bg-white/10 px-2.5 py-1 rounded-md border border-[#d9ff8c]/20 mt-3 font-bold tracking-wider">{profile.admission_number}</p>
            </div>

            {/* Personal details */}
            <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-6 md:col-span-2 space-y-4 shadow-none">
              <div className="border-b border-[#dcd9d9] pb-3">
                <p className="font-extrabold tracking-tight text-[#121212]">Personal Information</p>
              </div>
              <div className="space-y-0">
                {field(User, "Full Name", profile.legal_name)}
                {field(Mail, "Email Address", profile.primary_email)}
                {field(Phone, "Phone Number", profile.primary_phone)}
                {field(Calendar, "Date of Birth", profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString("en-GB") : null)}
                {field(MapPin, "Nationality", profile.nationality)}
                {field(User, "Gender", profile.gender === "M" ? "Male" : profile.gender === "F" ? "Female" : profile.gender || "—")}
              </div>
            </div>

            {/* School & card details */}
            <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-6 space-y-4 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-6 shadow-none">
              <div>
                <p className="font-extrabold tracking-tight text-[#121212] border-b border-[#dcd9d9] pb-3 mb-2">School Details</p>
                {field(User, "Level", profile.education_level_name)}
                {field(User, "Class", profile.class_section_name)}
                {field(User, "Status", profile.student_status)}
              </div>

              {profile.card_number && (
                <div>
                  <p className="font-extrabold tracking-tight text-[#121212] border-b border-[#dcd9d9] pb-3 mb-2">My IshuriHUB Card</p>
                  {field(CreditCard, "Card Number", profile.card_number)}
                  {field(CreditCard, "Wallet Balance", `${(profile.wallet_balance ?? 0).toLocaleString()} RWF`)}
                  {field(User, "Card Status", profile.card_status ?? "—")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
