"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Users, UserCheck, GraduationCap, Utensils,
  MapPin, Mail, Phone, CheckCircle2, ArrowRight, ShieldCheck,
  RefreshCw, X, Check, AlertCircle
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { multiSchool, SchoolItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// ─── Register School Modal ─────────────────────────────────────────────────────
function NewSchoolModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    if (!code) {
      const words = val.trim().split(/\s+/);
      if (words.length > 1) {
        setCode(words.map((w) => w[0]).join("").toUpperCase().slice(0, 4));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("School name and administrative email are required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await multiSchool.create({
        name: name.trim(),
        code: code.trim().toUpperCase() || undefined,
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      show("New school added to the IshuriHUB network!", "success");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create school node");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              Register New School Node
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Add another autonomous school to your multi-tenant network.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              School Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Kigali International Academy"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                School Code <span className="text-[10px] text-gray-400">(3-5 letters)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. KIA"
                maxLength={6}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono uppercase outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Phone Contact
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250 788 000 000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Administrative Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school.ishurihub.rw"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Physical Location / Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. KG 15 Ave, Gasabo, Kigali"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition disabled:opacity-60"
              style={{ background: "#FF7A22" }}
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              <span>Register School</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Multi-School Page Component ──────────────────────────────────────────
export default function SchoolsPage() {
  const router = useRouter();
  const { user, activeSchool, schoolsList, switchSchool, refreshSchools } = useAuth();
  const { show } = useToast();

  const [loading, setLoading] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [localSchools, setLocalSchools] = useState<SchoolItem[]>(schoolsList);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const res = await multiSchool.list();
      if (res.data) {
        setLocalSchools(res.data);
      }
    } catch {
      // Keep existing list from context
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schoolsList.length > 0) {
      setLocalSchools(schoolsList);
    } else {
      loadSchools();
    }
  }, [schoolsList]);

  const aggregates = useMemo(() => {
    const list = localSchools.length > 0 ? localSchools : schoolsList;
    return {
      totalSchools: list.length,
      totalStudents: list.reduce((acc, s) => acc + (s.student_count || 0), 0),
      totalWorkers: list.reduce((acc, s) => acc + (s.worker_count || 0), 0),
      totalClasses: list.reduce((acc, s) => acc + (s.class_count || 0), 0),
    };
  }, [localSchools, schoolsList]);

  const handleSwitch = async (school: SchoolItem) => {
    if (school.id === activeSchool?.id) return;
    setSwitchingId(school.id);
    try {
      show(`Switching active school context to ${school.name}...`, "info");
      await switchSchool(school.id);
      router.push("/");
    } catch (err: any) {
      show(err?.message || "Failed to switch school", "error");
      setSwitchingId(null);
    }
  };

  return (
    <DashboardShell>
      {showNewModal && (
        <NewSchoolModal
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            loadSchools();
            if (refreshSchools) refreshSchools();
          }}
        />
      )}

      <div className="space-y-3">
        {/* Header Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-800">
                Schools Network Hub
              </h1>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-[#FFD4B2]" style={{ background: "#FFF3EC", color: "#FF7A22" }}>
                7 School Nodes
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Control isolated school operations, monitor counts, and switch contexts with 1-click
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSchools}
              title="Refresh schools"
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shrink-0"
              style={{ background: "#FF7A22" }}
            >
              <Plus size={14} />
              <span>Register School</span>
            </button>
          </div>
        </div>

        {/* Network Metrics Overview - matching StatsCards.tsx */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1" style={{ background: "#FFF3EC" }}>
                <Building2 size={20} style={{ color: "#FF7A22" }} />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Schools in Network</p>
              <div className="text-base font-bold text-gray-800">{aggregates.totalSchools}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <Users size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Total Students</p>
              <div className="text-base font-bold text-gray-800">{aggregates.totalStudents}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <UserCheck size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Total Faculty & Staff</p>
              <div className="text-base font-bold text-gray-800">{aggregates.totalWorkers}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <GraduationCap size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Academic Classes</p>
              <div className="text-base font-bold text-gray-800">{aggregates.totalClasses}</div>
            </div>
          </div>
        </div>

        {/* 7 Schools Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {localSchools.map((school) => {
            const isActive = school.id === activeSchool?.id;
            const isSwitching = switchingId === school.id;

            return (
              <div
                key={school.id}
                className="bg-white rounded-2xl p-4 border transition duration-150 flex flex-col justify-between"
                style={isActive ? { borderColor: "#FF7A22" } : { borderColor: "#e5e5e5" }}
              >
                <div>
                  {/* Top line: School Code badge & Active indicator */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700">
                      {school.code}
                    </span>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-[#FFD4B2]" style={{ background: "#FFF3EC", color: "#FF7A22" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FF7A22" }} />
                        Active School
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[10px] font-medium">
                        {school.subscription_plan || "PREMIUM"}
                      </span>
                    )}
                  </div>

                  {/* School Title */}
                  <h3 className="text-sm font-bold text-gray-800 leading-snug">
                    {school.name}
                  </h3>

                  {/* School Address & Contact */}
                  <div className="mt-2 space-y-0.5 text-xs text-gray-400">
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin size={11} className="text-gray-400 shrink-0" />
                      <span>{school.address || "Kigali, Rwanda"}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail size={11} className="text-gray-400 shrink-0" />
                      <span>{school.email}</span>
                    </p>
                    {school.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone size={11} className="text-gray-400 shrink-0" />
                        <span>{school.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* 4 Data Counters Strip */}
                  <div className="grid grid-cols-4 gap-2 my-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">Students</p>
                      <p className="text-xs font-bold text-gray-800 mt-0.5">
                        {school.student_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">Workers</p>
                      <p className="text-xs font-bold text-gray-800 mt-0.5">
                        {school.worker_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">Classes</p>
                      <p className="text-xs font-bold text-gray-800 mt-0.5">
                        {school.class_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium uppercase">Canteen</p>
                      <p className="text-xs font-bold text-gray-800 mt-0.5">
                        {school.canteen_products_count ?? 6}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-2 border-t border-gray-100">
                  {isActive ? (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold cursor-default border border-[#FFD4B2]"
                      style={{ background: "#FFF3EC", color: "#FF7A22" }}
                    >
                      <Check size={13} />
                      <span>Current Workspace</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitch(school)}
                      disabled={isSwitching}
                      className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-white text-xs font-semibold transition disabled:opacity-60"
                      style={{ background: "#121212" }}
                    >
                      {isSwitching ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>Switching...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter School</span>
                          <ArrowRight size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
