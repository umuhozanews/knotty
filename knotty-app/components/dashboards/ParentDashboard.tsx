"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { myAccount, students } from "@/lib/api";
import { Loader2, CreditCard, CalendarDays, GraduationCap, User, Edit3, Save, X, Camera } from "lucide-react";
import { useToast } from "@/context/ToastContext";

interface ChildEditModalProps {
  child: any;
  onClose: () => void;
  onSuccess: () => void;
}

function ChildEditModal({ child, onClose, onSuccess }: ChildEditModalProps) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: child.user?.first_name ?? "",
    last_name: child.user?.last_name ?? "",
    phone: child.user?.phone ?? "",
    gender: child.gender ?? "M",
    date_of_birth: child.date_of_birth ? child.date_of_birth.slice(0, 10) : "",
    nationality: child.nationality ?? "Rwandan",
    profile_photo: child.user?.profile_photo ?? "",
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((f) => ({ ...f, profile_photo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await students.update(child.id, {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        gender: form.gender,
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        profile_photo: form.profile_photo || undefined,
      });
      show("Child information updated successfully", "success");
      onSuccess();
      onClose();
    } catch (err) {
      show(err instanceof Error ? err.message : "Error saving changes", "error");
    } finally {
      setLoading(false);
    }
  }

  const inp = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-4">Edit Child Information</h3>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex justify-center mb-4">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden hover:border-blue-500 transition">
                {form.profile_photo ? (
                  <img src={form.profile_photo} className="w-full h-full object-cover" alt="Avatar" />
                ) : (
                  <div className="text-center p-2">
                    <User className="mx-auto text-gray-400 group-hover:text-blue-500 transition" size={24} />
                    <span className="text-[10px] text-gray-400 block mt-0.5">Upload Photo</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Camera size={14} className="text-white" />
                </div>
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">First Name</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Last Name</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Phone Number</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} placeholder="+250 7XX XXX XXX" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Gender</label>
              <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inp}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nationality</label>
              <input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={inp} />
          </div>

          <div className="flex gap-3 pt-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60 flex items-center justify-center">
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [editChild, setEditChild] = useState<any | null>(null);

  function loadChildren() {
    setLoading(true);
    myAccount.parentChildren()
      .then((r) => {
        setChildren(r.data);
        if (r.data.length > 0) {
          // Keep selection if updated, otherwise default to first
          setSelectedChild((prev: any) => r.data.find((c: any) => c.id === prev?.id) || r.data[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadChildren();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="animate-spin text-blue-500" size={28} /></div>;

  return (
    <div className="space-y-6">
      {/* Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm p-4 flex items-center gap-3 overflow-x-auto">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">My Children:</p>
        {children.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-1">No children linked to this parent account.</p>
        ) : (
          children.map((c) => {
            const isSelected = selectedChild?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedChild(c)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition flex-shrink-0 ${isSelected ? "bg-blue-600 text-white shadow-xs" : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              >
                {c.user?.profile_photo ? (
                  <img src={c.user.profile_photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center"><User size={10} /></div>
                )}
                {c.user?.first_name} {c.user?.last_name}
              </button>
            );
          })
        )}
      </div>

      {selectedChild && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className="bg-gradient-to-br from-blue-600 to-green-600 rounded-3xl p-6 text-white shadow-md relative flex flex-col justify-between min-h-[160px]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-80 uppercase tracking-wider font-semibold">Student Profile</span>
                <button
                  onClick={() => setEditChild(selectedChild)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
                  title="Edit child profile"
                >
                  <Edit3 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-4">
                {selectedChild.user?.profile_photo ? (
                  <img src={selectedChild.user.profile_photo} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white/30" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-white/25 flex items-center justify-center border-2 border-white/30"><User size={24} /></div>
                )}
                <div>
                  <h2 className="text-lg font-bold">{selectedChild.user?.first_name} {selectedChild.user?.last_name}</h2>
                  <p className="text-xs opacity-80">{selectedChild.level?.name} · {selectedChild.class?.name}</p>
                </div>
              </div>
            </div>
            <p className="text-[11px] opacity-60 font-mono mt-4">ID: {selectedChild.student_code}</p>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm p-6 lg:col-span-2 grid grid-cols-3 gap-4 text-center">
            <div className="flex flex-col justify-center items-center p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10">
              <CreditCard size={20} className="text-blue-500 mb-1" />
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {selectedChild.card ? `${(selectedChild.card.wallet_balance ?? 0).toLocaleString()} RWF` : "No Card"}
              </p>
              <p className="text-xs text-gray-400">Card Balance</p>
            </div>
            <div className="flex flex-col justify-center items-center p-3 rounded-2xl bg-green-50/50 dark:bg-green-900/10">
              <CalendarDays size={20} className="text-green-500 mb-1" />
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {selectedChild.card?.is_active ? "Active" : "Inactive"}
              </p>
              <p className="text-xs text-gray-400">Card Status</p>
            </div>
            <div className="flex flex-col justify-center items-center p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-900/10">
              <GraduationCap size={20} className="text-purple-500 mb-1" />
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {selectedChild.nationality || "Rwandan"}
              </p>
              <p className="text-xs text-gray-400">Nationality</p>
            </div>
          </div>

          {/* More details */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm p-6 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 border-b border-gray-50 dark:border-gray-800 pb-2 mb-2">Personal Details</p>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between text-sm"><span className="text-gray-400">Email:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.user?.email}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Phone:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.user?.phone || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Gender:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.gender === "M" ? "Male" : selectedChild.gender === "F" ? "Female" : selectedChild.gender || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">DOB:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.date_of_birth ? new Date(selectedChild.date_of_birth).toLocaleDateString("en-GB") : "—"}</span></div>
              </div>
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100 border-b border-gray-50 dark:border-gray-800 pb-2 mb-2">Smart Card Details</p>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between text-sm"><span className="text-gray-400">Card Number:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.card?.card_number || "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">NFC Tag Linked:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.card?.nfc_uid ? "Yes" : "No"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Card Blocked:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.card?.is_frozen ? "Yes (Frozen)" : "No"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">Expires:</span> <span className="font-medium text-gray-700 dark:text-gray-200">{selectedChild.card?.expires_at ? new Date(selectedChild.card.expires_at).toLocaleDateString("en-GB") : "—"}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editChild && (
        <ChildEditModal
          child={editChild}
          onClose={() => setEditChild(null)}
          onSuccess={loadChildren}
        />
      )}
    </div>
  );
}
