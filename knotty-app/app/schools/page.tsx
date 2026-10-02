"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Users, UserCheck, GraduationCap, Utensils,
  MapPin, Mail, Phone, CheckCircle2, ArrowRight, ShieldCheck,
  Award, Sparkles, RefreshCw, X, Check, AlertCircle, ExternalLink,
  ChevronRight, Laptop
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
      // Auto-suggest 3-4 letter acronym
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Register New School Node
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Add another autonomous school to your multi-tenant network.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border border-rose-200 dark:border-rose-800">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              School Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Kigali International Academy"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                School Code <span className="text-[10px] text-gray-400 lowercase">(3-5 chars)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. KIA"
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono uppercase outline-none focus:border-orange-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Phone Contact
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+250 788 000 000"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Administrative Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@school.ishurihub.rw"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 transition"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Physical Location / Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. KG 15 Ave, Gasabo, Kigali"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm disabled:opacity-60"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
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

  // Fetch / refresh schools
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

  // Aggregate totals
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

      <div className="space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Schools Network Hub
              </h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60">
                7 School Nodes Active
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Centralized multi-school oversight. Control isolated school nodes, monitor student & worker counts, and switch contexts with 1-click.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSchools}
              title="Refresh schools"
              className="p-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus size={15} />
              <span>Register New School</span>
            </button>
          </div>
        </div>

        {/* Network Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Schools in Network</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{aggregates.totalSchools}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Students</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{aggregates.totalStudents}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Faculty & Staff</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{aggregates.totalWorkers}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Academic Classes</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{aggregates.totalClasses}</p>
            </div>
          </div>
        </div>

        {/* 7 Schools Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localSchools.map((school) => {
            const isActive = school.id === activeSchool?.id;
            const isSwitching = switchingId === school.id;

            return (
              <div
                key={school.id}
                className={`bg-white dark:bg-gray-900 rounded-3xl p-5 border transition-all duration-200 shadow-sm flex flex-col justify-between ${
                  isActive
                    ? "border-orange-500 ring-2 ring-orange-500/20 shadow-md"
                    : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                }`}
              >
                <div>
                  {/* Top line: School Code badge & Active indicator */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                      {school.code}
                    </span>

                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 text-[10px] font-bold border border-orange-200 dark:border-orange-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        ACTIVE WORKSPACE
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-semibold">
                        {school.subscription_plan || "PREMIUM"}
                      </span>
                    )}
                  </div>

                  {/* School Title */}
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {school.name}
                  </h3>

                  {/* School Address & Contact */}
                  <div className="mt-2 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin size={12} className="text-gray-400 shrink-0" />
                      <span>{school.address || "Kigali, Rwanda"}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span className="font-mono">{school.email}</span>
                    </p>
                    {school.phone && (
                      <p className="flex items-center gap-1.5 truncate">
                        <Phone size={12} className="text-gray-400 shrink-0" />
                        <span>{school.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* 4 Data Counters Strip */}
                  <div className="grid grid-cols-4 gap-2 my-4 p-3 rounded-2xl bg-gray-50/70 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Students</p>
                      <p className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                        {school.student_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Workers</p>
                      <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {school.worker_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Classes</p>
                      <p className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {school.class_count ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Canteen</p>
                      <p className="text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
                        {school.canteen_products_count ?? 6}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  {isActive ? (
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-800/60 cursor-default"
                    >
                      <Check size={14} />
                      <span>Current Workspace</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSwitch(school)}
                      disabled={isSwitching}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-orange-500 dark:hover:bg-orange-500 dark:hover:text-white text-xs font-bold transition shadow-xs disabled:opacity-60"
                    >
                      {isSwitching ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Switching Node...</span>
                        </>
                      ) : (
                        <>
                          <span>Enter School Dashboard</span>
                          <ArrowRight size={13} />
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
