"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, students } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, User, Phone, Mail, MapPin, Calendar, CreditCard, Edit3, Save, X, Camera } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function MyProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    gender: "M",
    date_of_birth: "",
    nationality: "",
    profile_photo: "",
  });

  function loadProfile() {
    setLoading(true);
    myAccount.profile()
      .then((r) => {
        const data = r.data as any;
        setProfile(data);
        if (data) {
          setForm({
            first_name: data.user?.first_name ?? "",
            last_name: data.user?.last_name ?? "",
            phone: data.user?.phone ?? "",
            gender: data.gender ?? "M",
            date_of_birth: data.date_of_birth ? data.date_of_birth.slice(0, 10) : "",
            nationality: data.nationality ?? "Rwandan",
            profile_photo: data.user?.profile_photo ?? "",
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!authLoading) loadProfile();
  }, [authLoading]);

  const s = profile as {
    id: string;
    student_code?: string; gender?: string; date_of_birth?: string; nationality?: string; enrollment_date?: string;
    user?: { first_name?: string; last_name?: string; email?: string; phone?: string; profile_photo?: string };
    level?: { name?: string }; class?: { name?: string };
    parent?: { first_name?: string; last_name?: string; phone?: string; email?: string };
    card?: { card_number?: string; wallet_balance?: number; is_active?: boolean; expires_at?: string };
  } | null;

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((f) => ({ ...f, profile_photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setSaving(true);
    try {
      await students.update(s.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        gender: form.gender,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        profile_photo: form.profile_photo || undefined,
      });
      show("Profile updated successfully", "success");
      setIsEditing(false);
      loadProfile();
    } catch (err) {
      show(err instanceof Error ? err.message : "Error saving changes", "error");
    } finally {
      setSaving(false);
    }
  }

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

  const inp = "w-full border border-[#dcd9d9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#121212] bg-[#ffffff] text-[#121212]";

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        `}} />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#121212]">My Profile</h1>
            <p className="text-xs text-gray-500 mt-0.5">View and update contact details</p>
          </div>
          {s && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#121212] hover:bg-[#dcd9d9] hover:text-[#121212] text-white rounded-lg text-xs font-bold transition duration-200 border border-[#121212]"
            >
              <Edit3 size={14} />
              Edit Profile
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-500" size={28} /></div>
        ) : !s ? (
          <p className="text-gray-400 text-center py-8">Profile not found</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Photo Card */}
              <div className="bg-[#121212] rounded-lg p-6 text-[#fcf9f8] text-center flex flex-col items-center justify-center relative border border-[#dcd9d9]/20 shadow-none">
                {isEditing ? (
                  <label className="relative cursor-pointer group mb-3">
                    <div className="w-24 h-24 rounded-full border-4 border-[#dcd9d9]/50 overflow-hidden relative flex items-center justify-center bg-black/20 hover:border-[#dcd9d9] transition">
                      {form.profile_photo ? (
                        <img src={form.profile_photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-white" />
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <Camera size={20} className="text-white" />
                      </div>
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                ) : (
                  <div className="relative mb-3">
                    {s.user?.profile_photo ? (
                      <img src={s.user.profile_photo} alt="" className="w-24 h-24 rounded-full object-cover border-4 border-white/10" />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center border-4 border-white/10">
                        <User size={40} className="text-white" />
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xl font-bold">{s.user?.first_name} {s.user?.last_name}</p>
                <p className="text-sm opacity-85 mt-0.5">{s.level?.name} · Class {s.class?.name}</p>
                <p className="text-xs text-[#d9ff8c] font-mono bg-white/10 px-2.5 py-1 rounded-md border border-[#d9ff8c]/20 mt-3 font-bold tracking-wider">{s.student_code}</p>
              </div>

              {/* Personal details / inputs */}
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-6 md:col-span-2 space-y-4 shadow-none">
                <div className="flex items-center justify-between border-b border-[#dcd9d9] pb-3">
                  <p className="font-extrabold tracking-tight text-[#121212]">Personal Information</p>
                  {isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="p-1.5 rounded-lg border border-[#dcd9d9] text-gray-500 hover:bg-gray-50 transition"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121212] hover:bg-[#dcd9d9] hover:text-[#121212] text-white rounded-lg text-xs font-bold disabled:opacity-60 transition border border-[#121212]"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">First Name</label>
                      <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Last Name</label>
                      <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Phone Number</label>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} placeholder="+250 7XX XXX XXX" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Gender</label>
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inp}>
                        <option value="M">Male</option>
                        <option value="F">Female</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Date of Birth</label>
                      <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={inp} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Nationality</label>
                      <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className={inp} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {field(User, "Full Name", `${s.user?.first_name} ${s.user?.last_name}`)}
                    {field(Mail, "Email Address", s.user?.email)}
                    {field(Phone, "Phone Number", s.user?.phone)}
                    {field(Calendar, "Date of Birth", s.date_of_birth ? new Date(s.date_of_birth).toLocaleDateString("en-GB") : null)}
                    {field(MapPin, "Nationality", s.nationality)}
                    {field(User, "Gender", s.gender === "M" ? "Male" : s.gender === "F" ? "Female" : s.gender || "—")}
                  </div>
                )}
              </div>

              {/* Cards, Parent info */}
              <div className="bg-[#ffffff] rounded-lg border border-[#dcd9d9] p-6 space-y-4 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 shadow-none">
                <div>
                  <p className="font-extrabold tracking-tight text-[#121212] border-b border-[#dcd9d9] pb-3 mb-2">School Details</p>
                  {field(User, "Level", s.level?.name)}
                  {field(User, "Class", s.class?.name)}
                  {field(Calendar, "Enrollment Date", s.enrollment_date ? new Date(s.enrollment_date).toLocaleDateString("en-GB") : null)}
                </div>

                {s.card && (
                  <div>
                    <p className="font-extrabold tracking-tight text-[#121212] border-b border-[#dcd9d9] pb-3 mb-2">My KNOTTY Card</p>
                    {field(CreditCard, "Card Number", s.card.card_number)}
                    {field(CreditCard, "Wallet Balance", `${(s.card.wallet_balance ?? 0).toLocaleString()} RWF`)}
                    {field(Calendar, "Expires", s.card.expires_at ? new Date(s.card.expires_at).toLocaleDateString("en-GB") : null)}
                  </div>
                )}

                {s.parent && (
                  <div>
                    <p className="font-extrabold tracking-tight text-[#121212] border-b border-[#dcd9d9] pb-3 mb-2">Parent / Guardian</p>
                    {field(User, "Guardian Name", `${s.parent.first_name} ${s.parent.last_name}`)}
                    {field(Phone, "Guardian Phone", s.parent.phone)}
                    {field(Mail, "Guardian Email", s.parent.email)}
                  </div>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardShell>
  );
}
