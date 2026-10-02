"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, Plus, Search, Filter, Mail, Phone,
  Briefcase, GraduationCap, Utensils, Shield, Heart,
  BookOpen, Building2, MoreHorizontal, Edit, Trash2,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, X,
  Copy, Check, Eye, EyeOff, ShieldCheck, QrCode, ArrowRight,
  ChevronRight, Award, Lock
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { workers, WorkerItem, WorkerStats } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// ─── Role Configuration ────────────────────────────────────────────────────────
export const ROLE_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  TEACHER: {
    label: "Teacher",
    icon: GraduationCap,
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
  },
  CANTEEN: {
    label: "Cantinier",
    icon: Utensils,
    color: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
  },
  BURSAR: {
    label: "Bursar",
    icon: Briefcase,
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  NURSE: {
    label: "Nurse",
    icon: Heart,
    color: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800",
  },
  DISCIPLINE: {
    label: "Discipline Master",
    icon: Shield,
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
  },
  LIBRARIAN: {
    label: "Librarian",
    icon: BookOpen,
    color: "text-indigo-700 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  ADMIN: {
    label: "Administrator",
    icon: ShieldCheck,
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
  },
};

// ─── Avatar Component ──────────────────────────────────────────────────────────
function WorkerAvatar({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = (name.charCodeAt(0) * 41 + name.charCodeAt(1 || 0) * 19) % 360;

  return (
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0"
      style={{ background: `hsl(${hue}, 65%, 48%)` }}
    >
      {initials}
    </div>
  );
}

// ─── Add / Edit Worker Modal ──────────────────────────────────────────────────
interface WorkerFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  job_title: string;
  employee_code: string;
  password: string;
}

const DEFAULT_FORM: WorkerFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "TEACHER",
  department: "Sciences & Mathematics",
  job_title: "Instructor / Teacher",
  employee_code: "",
  password: "Staff@2024",
};

function WorkerModal({
  existing,
  onClose,
  onSuccess,
}: {
  existing?: WorkerItem | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { show } = useToast();
  const [form, setForm] = useState<WorkerFormState>(() => {
    if (existing) {
      return {
        first_name: existing.first_name,
        last_name: existing.last_name,
        email: existing.email,
        phone: existing.phone || "",
        role: existing.role,
        department: existing.department || "",
        job_title: existing.job_title || "",
        employee_code: existing.employee_code || "",
        password: "",
      };
    }
    return DEFAULT_FORM;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    code: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-update department suggestion when role changes
  const handleRoleChange = (newRole: string) => {
    let dept = "General Staff";
    let title = newRole;
    if (newRole === "TEACHER") {
      dept = "Sciences & Mathematics";
      title = "Teacher / Instructor";
    } else if (newRole === "CANTEEN") {
      dept = "Canteen & Catering Services";
      title = "Cantinier / POS Operator";
    } else if (newRole === "BURSAR") {
      dept = "Finance & Accounts";
      title = "School Bursar & Accountant";
    } else if (newRole === "NURSE") {
      dept = "Health & Infirmary";
      title = "Resident Medical Nurse";
    } else if (newRole === "DISCIPLINE") {
      dept = "Discipline & Student Welfare";
      title = "Discipline Master";
    } else if (newRole === "LIBRARIAN") {
      dept = "Library & Media Center";
      title = "Head Librarian";
    } else if (newRole === "ADMIN") {
      dept = "Executive School Administration";
      title = "Administrator";
    }
    setForm((f) => ({ ...f, role: newRole, department: dept, job_title: title }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("First name, last name, and email are required.");
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await workers.update(existing.id, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          department: form.department.trim(),
          job_title: form.job_title.trim(),
        });
        show("Worker updated successfully", "success");
        onSuccess();
        onClose();
      } else {
        const created = await workers.create({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          role: form.role,
          department: form.department.trim(),
          job_title: form.job_title.trim(),
          employee_code: form.employee_code.trim() || undefined,
          password: form.password || "Staff@2024",
        });
        show("New worker registered successfully", "success");
        setCredentials({
          name: `${form.first_name} ${form.last_name}`,
          email: form.email.trim().toLowerCase(),
          password: form.password || "Staff@2024",
          code: created.data.employee_code || "Generated",
          role: form.role,
        });
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save worker record");
    } finally {
      setSaving(false);
    }
  };

  const copyCreds = () => {
    if (!credentials) return;
    const text = `IshuriHUB Staff Credentials\nName: ${credentials.name}\nRole: ${credentials.role}\nStaff Code: ${credentials.code}\nEmail: ${credentials.email}\nTemporary Password: ${credentials.password}\nPortal: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (credentials) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-md p-6 text-center border border-gray-100 dark:border-gray-800">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Worker Registered!
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
            Staff account created and scoped to active school. Provide these initial login credentials:
          </p>

          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 text-left space-y-3 mb-5 border border-gray-100 dark:border-gray-700/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Full Name</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">{credentials.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Role</span>
              <span className="font-bold text-orange-600 dark:text-orange-400 uppercase">{credentials.role}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Staff ID</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{credentials.code}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Email</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{credentials.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400 font-medium">Password</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{credentials.password}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyCreds}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-200 transition"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Details"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition shadow-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {existing ? "Edit Staff Member" : "Register School Worker"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {existing
                ? `Update details for ${existing.full_name}`
                : "Add teacher, cantinier, nurse, or support personnel"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs border border-rose-200 dark:border-rose-800">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                First Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="e.g. Robert"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Last Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="e.g. Kagabo"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Email Address {!existing && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="email"
                required={!existing}
                disabled={!!existing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="robert@ishurihub.rw"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 disabled:opacity-60 transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+250 788 123 456"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Staff Role & Responsibility
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ROLE_CONFIG).map(([rKey, conf]) => {
                const Icon = conf.icon;
                const isSelected = form.role === rKey;
                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => handleRoleChange(rKey)}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border text-left text-xs font-semibold transition ${
                      isSelected
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 font-bold shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    <Icon size={14} className={isSelected ? "text-orange-600" : "text-gray-400"} />
                    <span className="truncate">{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Department
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Sciences & Tech"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="e.g. Senior Math Teacher"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
              />
            </div>
          </div>

          {!existing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Employee Code <span className="text-[10px] text-gray-400 lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Staff@2024"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono outline-none focus:border-orange-500 dark:focus:border-orange-500 transition"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
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
              <span>{existing ? "Save Changes" : "Create Worker"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Staff ID Badge Modal ──────────────────────────────────────────────────────
function StaffBadgeModal({
  worker,
  schoolName,
  onClose,
}: {
  worker: WorkerItem;
  schoolName: string;
  onClose: () => void;
}) {
  const conf = ROLE_CONFIG[worker.role] || ROLE_CONFIG.TEACHER;
  const RoleIcon = conf.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-gray-800 text-center">
        {/* Card Header Top Graphic */}
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-4 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition"
          >
            <X size={14} />
          </button>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <ShieldCheck size={16} />
            <span className="font-extrabold text-sm tracking-wide">IshuriHUB OFFICIAL STAFF</span>
          </div>
          <p className="text-[11px] text-white/90 truncate">{schoolName}</p>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="flex justify-center -mt-12 mb-3">
            <div className="p-1 rounded-3xl bg-white dark:bg-gray-900 shadow-lg">
              <WorkerAvatar name={worker.full_name} role={worker.role} />
            </div>
          </div>

          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{worker.full_name}</h3>
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mt-0.5">{worker.job_title}</p>
          <p className="text-[11px] text-gray-400">{worker.department}</p>

          <div className="my-4 py-2 px-3 rounded-2xl bg-gray-50 dark:bg-gray-800/80 inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700">
            <span className="text-[10px] text-gray-400 uppercase font-bold">STAFF ID:</span>
            <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
              {worker.employee_code}
            </span>
          </div>

          {/* QR & Security Pill */}
          <div className="bg-orange-50/70 dark:bg-orange-950/30 rounded-2xl p-3 border border-orange-100 dark:border-orange-900/40 mb-4 flex items-center justify-between">
            <div className="text-left text-[11px]">
              <p className="font-bold text-orange-900 dark:text-orange-200">NFC Smart Key Active</p>
              <p className="text-orange-700 dark:text-orange-400">Campus gate & POS enabled</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-xs">
              <QrCode size={20} className="text-orange-600" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-gray-900 dark:bg-gray-800 text-white text-xs font-bold hover:bg-gray-800 transition"
          >
            Close Badge
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Workers Page Component ───────────────────────────────────────────────
export default function WorkersPage() {
  const router = useRouter();
  const { user, activeSchool } = useAuth();
  const { show } = useToast();

  const [loading, setLoading] = useState(true);
  const [workerList, setWorkerList] = useState<WorkerItem[]>([]);
  const [stats, setStats] = useState<WorkerStats>({
    total_workers: 0,
    total_teachers: 0,
    total_cantiniers: 0,
    total_support: 0,
    active_workers: 0,
  });

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerItem | null>(null);
  const [badgeWorker, setBadgeWorker] = useState<WorkerItem | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  // Load Workers from Backend API
  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workers.list({
        role: selectedRole === "ALL" ? undefined : selectedRole,
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        search: search.trim() || undefined,
        limit: 100,
      });
      if (res.data) {
        setWorkerList(res.data);
      }
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error("Error loading workers:", err);
      show("Could not load workers list", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedRole, selectedStatus, search, show]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Toggle active status
  const handleToggleStatus = async (worker: WorkerItem) => {
    setDeactivatingId(worker.id);
    try {
      const newStatus = !worker.is_active;
      await workers.update(worker.id, { is_active: newStatus });
      setWorkerList((prev) =>
        prev.map((w) =>
          w.id === worker.id
            ? { ...w, is_active: newStatus, status: newStatus ? "ACTIVE" : "INACTIVE" }
            : w
        )
      );
      show(
        `Staff member ${worker.full_name} is now ${newStatus ? "Active" : "Inactive"}`,
        "success"
      );
    } catch (err: any) {
      show(err?.message || "Failed to update status", "error");
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <DashboardShell>
      {/* Add / Edit Modal */}
      {(showAddModal || editingWorker) && (
        <WorkerModal
          existing={editingWorker}
          onClose={() => {
            setShowAddModal(false);
            setEditingWorker(null);
          }}
          onSuccess={() => {
            fetchWorkers();
          }}
        />
      )}

      {/* Staff ID Badge Modal */}
      {badgeWorker && (
        <StaffBadgeModal
          worker={badgeWorker}
          schoolName={activeSchool?.name || "IshuriHUB School"}
          onClose={() => setBadgeWorker(null)}
        />
      )}

      <div className="space-y-4">
        {/* Top Header Bar with Segmented Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
                <UserCheck size={18} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Workers & Staff Management
              </h1>
              {activeSchool && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800/60">
                  {activeSchool.name} ({activeSchool.code})
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Manage teachers, cantiniers, bursars, nurses, and administrative personnel scoped to this school.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Student ↔ Worker Segmented Control */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl shrink-0">
              <button
                onClick={() => router.push("/students")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
              >
                <Users size={13} />
                <span>Students</span>
              </button>
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-gray-900 text-orange-600 dark:text-orange-400 shadow-xs"
              >
                <UserCheck size={13} />
                <span>Workers</span>
              </button>
            </div>

            {/* Add Worker Action */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition shrink-0"
            >
              <Plus size={15} />
              <span>Add Worker</span>
            </button>
          </div>
        </div>

        {/* Top 5 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Staff</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{stats.total_workers}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center shrink-0">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Teachers</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{stats.total_teachers}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
              <Utensils size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cantiniers</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{stats.total_cantiniers}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support Staff</p>
              <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">{stats.total_support}</p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Active on Duty</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.active_workers}</p>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-gray-900 p-3 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, staff ID..."
                className="w-full pl-9 pr-8 py-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-xs outline-none focus:border-orange-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-gray-400 font-semibold">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold outline-none text-gray-700 dark:text-gray-300"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <button
                onClick={fetchWorkers}
                title="Refresh list"
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 transition"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedRole("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedRole === "ALL"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              All Workers ({stats.total_workers})
            </button>

            {Object.entries(ROLE_CONFIG).map(([rKey, conf]) => {
              const Icon = conf.icon;
              const isSel = selectedRole === rKey;
              return (
                <button
                  key={rKey}
                  onClick={() => setSelectedRole(rKey)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                    isSel
                      ? "bg-orange-500 text-white shadow-sm font-bold"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon size={13} />
                  <span>{conf.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workers Table / Card View */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw size={28} className="animate-spin text-orange-500" />
              <p className="text-xs font-semibold text-gray-400">Loading worker directory...</p>
            </div>
          ) : workerList.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-4">
              <div className="w-14 h-14 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                <UserCheck size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
                No workers found
              </h3>
              <p className="text-xs text-gray-400 max-w-sm">
                {search || selectedRole !== "ALL" || selectedStatus !== "ALL"
                  ? "Try clearing your filters or search terms."
                  : "No workers registered in this school yet. Click 'Add Worker' above to get started."}
              </p>
              {(search || selectedRole !== "ALL" || selectedStatus !== "ALL") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setSelectedRole("ALL");
                    setSelectedStatus("ALL");
                  }}
                  className="px-4 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 text-gray-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Worker / Faculty</th>
                    <th className="py-3.5 px-4">Role & Function</th>
                    <th className="py-3.5 px-4">Employee ID</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {workerList.map((worker) => {
                    const conf = ROLE_CONFIG[worker.role] || ROLE_CONFIG.TEACHER;
                    const RoleIcon = conf.icon;
                    return (
                      <tr
                        key={worker.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/30 transition group"
                      >
                        {/* Worker column */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <WorkerAvatar name={worker.full_name} role={worker.role} />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
                                {worker.full_name}
                              </p>
                              <p className="text-gray-400 text-[11px] truncate flex items-center gap-1">
                                <Mail size={11} />
                                {worker.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role column */}
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${conf.bg} ${conf.color} ${conf.border}`}
                            >
                              <RoleIcon size={12} />
                              {conf.label}
                            </span>
                            <p className="text-gray-500 dark:text-gray-400 text-[11px] truncate max-w-[200px]">
                              {worker.job_title} • {worker.department}
                            </p>
                          </div>
                        </td>

                        {/* Code column */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-semibold px-2 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {worker.employee_code}
                          </span>
                        </td>

                        {/* Phone column */}
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {worker.phone ? (
                            <span className="flex items-center gap-1 text-[11px]">
                              <Phone size={11} className="text-gray-400" />
                              {worker.phone}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 italic">No phone</span>
                          )}
                        </td>

                        {/* Status column */}
                        <td className="py-3 px-4">
                          {worker.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-[11px] font-semibold">
                              <XCircle size={12} />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Badge */}
                            <button
                              onClick={() => setBadgeWorker(worker)}
                              title="View Staff ID Badge"
                              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition"
                            >
                              <QrCode size={13} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => setEditingWorker(worker)}
                              title="Edit Worker Info"
                              className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                            >
                              <Edit size={13} />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() => handleToggleStatus(worker)}
                              disabled={deactivatingId === worker.id}
                              title={worker.is_active ? "Deactivate Worker" : "Activate Worker"}
                              className={`p-1.5 rounded-xl border transition ${
                                worker.is_active
                                  ? "border-rose-200 dark:border-rose-800/60 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  : "border-emerald-200 dark:border-emerald-800/60 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                            >
                              {deactivatingId === worker.id ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : worker.is_active ? (
                                <XCircle size={13} />
                              ) : (
                                <CheckCircle2 size={13} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
