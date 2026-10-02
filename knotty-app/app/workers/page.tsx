"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, Plus, Search, Mail, Phone,
  Briefcase, GraduationCap, Utensils, Shield, Heart,
  BookOpen, Building2, Edit, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, X, Copy, Check, QrCode,
  ShieldCheck
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { workers, WorkerItem, WorkerStats } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// ─── Role Labels ──────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  CANTEEN: "Cantinier",
  BURSAR: "Bursar",
  NURSE: "School Nurse",
  DISCIPLINE: "Discipline Master",
  LIBRARIAN: "Librarian",
  ADMIN: "Administrator",
};

// ─── Clean Avatar Component ───────────────────────────────────────────────────
function WorkerAvatar({ name, size = 9 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-orange-100 text-orange-700`}
      style={{ background: "#FFF3EC", color: "#FF7A22" }}
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
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 text-center max-w-md w-full border border-gray-200">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#FFF3EC" }}>
            <CheckCircle2 size={24} style={{ color: "#FF7A22" }} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            Worker Registered
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            Staff account created and scoped to active school. Provide these initial login credentials:
          </p>

          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2.5 mb-5 border border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Full Name</span>
              <span className="font-semibold text-gray-800">{credentials.name}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Role</span>
              <span className="font-semibold" style={{ color: "#FF7A22" }}>{credentials.role}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Staff ID</span>
              <span className="font-mono text-gray-700">{credentials.code}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Email</span>
              <span className="font-mono text-gray-800">{credentials.email}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Password</span>
              <span className="font-mono font-bold" style={{ color: "#FF7A22" }}>{credentials.password}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyCreds}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy Details"}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl text-white text-xs font-semibold transition"
              style={{ background: "#FF7A22" }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">
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
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                placeholder="e.g. Robert"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                placeholder="e.g. Kagabo"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Email Address {!existing && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                required={!existing}
                disabled={!!existing}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="robert@ishurihub.rw"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+250 788 123 456"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Staff Role
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ROLE_LABELS).map(([rKey, label]) => {
                const isSelected = form.role === rKey;
                return (
                  <button
                    key={rKey}
                    type="button"
                    onClick={() => handleRoleChange(rKey)}
                    className={`p-2 rounded-xl border text-center text-xs font-semibold transition ${
                      isSelected
                        ? "border-[#FF7A22] bg-[#FFF3EC] text-[#FF7A22]"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white"
                    }`}
                  >
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Department
              </label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Sciences & Tech"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Job Title
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                placeholder="e.g. Senior Math Teacher"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          {!existing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Employee Code <span className="text-[10px] text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                  placeholder="Auto-generated"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Initial Password
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Staff@2024"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono outline-none"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
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
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden border border-gray-200 text-center">
        {/* Card Header Top Graphic */}
        <div className="p-4 text-white relative" style={{ background: "#FF7A22" }}>
          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 p-1 rounded-full text-white/80 hover:text-white transition"
          >
            <X size={14} />
          </button>
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <ShieldCheck size={16} />
            <span className="font-bold text-xs tracking-wider uppercase">IshuriHUB Official Staff</span>
          </div>
          <p className="text-[10px] text-white/90 truncate">{schoolName}</p>
        </div>

        {/* Card Body */}
        <div className="p-5">
          <div className="flex justify-center -mt-9 mb-2">
            <div className="p-1 rounded-full bg-white shadow-xs">
              <WorkerAvatar name={worker.full_name} size={12} />
            </div>
          </div>

          <h3 className="text-base font-bold text-gray-800">{worker.full_name}</h3>
          <p className="text-xs font-semibold mt-0.5" style={{ color: "#FF7A22" }}>{worker.job_title}</p>
          <p className="text-[11px] text-gray-400">{worker.department}</p>

          <div className="my-3 py-1.5 px-3 rounded-xl bg-gray-50 inline-flex items-center gap-2 border border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">ID:</span>
            <span className="text-xs font-mono font-bold text-gray-700">
              {worker.employee_code}
            </span>
          </div>

          <div className="rounded-xl p-2.5 mb-4 flex items-center justify-between border border-[#FFD4B2]" style={{ background: "#FFF3EC" }}>
            <div className="text-left text-[11px]">
              <p className="font-semibold text-gray-800">NFC Badge Active</p>
              <p className="text-gray-500 text-[10px]">Gate access & POS enabled</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-gray-100">
              <QrCode size={16} style={{ color: "#FF7A22" }} />
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl text-white text-xs font-semibold transition"
            style={{ background: "#121212" }}
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

      <div className="space-y-3">
        {/* Top Header Bar with Segmented Switcher */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-800">
                Workers & Staff
              </h1>
              {activeSchool && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-[#FFD4B2]" style={{ background: "#FFF3EC", color: "#FF7A22" }}>
                  {activeSchool.name} ({activeSchool.code})
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage teachers, cantiniers, bursars, and administrative staff
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Student ↔ Worker Segmented Control */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => router.push("/students")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
              >
                <Users size={13} />
                <span>Students</span>
              </button>
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-gray-800 shadow-xs"
                style={{ color: "#FF7A22" }}
              >
                <UserCheck size={13} />
                <span>Workers</span>
              </button>
            </div>

            {/* Add Worker Action */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shrink-0"
              style={{ background: "#FF7A22" }}
            >
              <Plus size={14} />
              <span>Add Worker</span>
            </button>
          </div>
        </div>

        {/* Top Metric Cards - matching StatsCards.tsx */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1" style={{ background: "#FFF3EC" }}>
                <Users size={20} style={{ color: "#FF7A22" }} />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Total Staff</p>
              <div className="text-base font-bold text-gray-800">{stats.total_workers}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <GraduationCap size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Teachers</p>
              <div className="text-base font-bold text-gray-800">{stats.total_teachers}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <Utensils size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Cantiniers</p>
              <div className="text-base font-bold text-gray-800">{stats.total_cantiniers}</div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <Briefcase size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Support Staff</p>
              <div className="text-base font-bold text-gray-800">{stats.total_support}</div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gray-50 rounded-2xl p-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-1">
                <CheckCircle2 size={20} className="text-gray-700" />
              </div>
              <p className="text-xs text-gray-400 mt-2 mb-1">Active on Duty</p>
              <div className="text-base font-bold text-gray-800">{stats.active_workers}</div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 text-xs text-gray-500 w-full sm:w-80">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff by name, email, ID..."
                className="outline-none bg-transparent w-full text-xs text-gray-700"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status dropdown */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-gray-400">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-2.5 py-1 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <button
                onClick={fetchWorkers}
                title="Refresh list"
                className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 transition"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedRole("ALL")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 ${
                selectedRole === "ALL"
                  ? "text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              style={selectedRole === "ALL" ? { background: "#FF7A22" } : undefined}
            >
              All Workers ({stats.total_workers})
            </button>

            {Object.entries(ROLE_LABELS).map(([rKey, label]) => {
              const isSel = selectedRole === rKey;
              return (
                <button
                  key={rKey}
                  onClick={() => setSelectedRole(rKey)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition shrink-0 ${
                    isSel
                      ? "text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                  style={isSel ? { background: "#FF7A22" } : undefined}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Workers Table */}
        <div className="bg-white rounded-2xl p-4 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-gray-400" />
              <p className="text-xs text-gray-400">Loading worker directory...</p>
            </div>
          ) : workerList.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-center px-4">
              <Users size={36} className="text-gray-200 mb-1" />
              <h3 className="text-sm font-semibold text-gray-800">
                No workers found
              </h3>
              <p className="text-xs text-gray-400">
                {search || selectedRole !== "ALL" || selectedStatus !== "ALL"
                  ? "Try clearing filters to see more results."
                  : "No workers registered in this school yet."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 pb-3 font-medium">
                    <th className="pb-3 pl-1 font-medium">Profile</th>
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Department</th>
                    <th className="pb-3 font-medium">Staff ID</th>
                    <th className="pb-3 font-medium">Contact</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 pr-1 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {workerList.map((worker) => {
                    const roleLabel = ROLE_LABELS[worker.role] || worker.role;
                    return (
                      <tr
                        key={worker.id}
                        className="hover:bg-gray-50/70 transition"
                      >
                        {/* Profile avatar */}
                        <td className="py-3 pl-1">
                          <WorkerAvatar name={worker.full_name} size={8} />
                        </td>

                        {/* Name column */}
                        <td className="py-3">
                          <p className="font-semibold text-gray-800 text-xs">
                            {worker.full_name}
                          </p>
                          <p className="text-gray-400 text-[11px]">{worker.email}</p>
                        </td>

                        {/* Role column */}
                        <td className="py-3">
                          <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                            {roleLabel}
                          </span>
                        </td>

                        {/* Department column */}
                        <td className="py-3 text-xs text-gray-600">
                          {worker.department || "General Staff"}
                        </td>

                        {/* Staff ID column */}
                        <td className="py-3 font-mono text-xs text-gray-600">
                          {worker.employee_code}
                        </td>

                        {/* Phone column */}
                        <td className="py-3 text-xs text-gray-500">
                          {worker.phone || "—"}
                        </td>

                        {/* Status column */}
                        <td className="py-3">
                          {worker.is_active ? (
                            <span className="text-xs text-gray-700 flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              Active
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-1 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Badge */}
                            <button
                              onClick={() => setBadgeWorker(worker)}
                              title="View Staff ID Badge"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition"
                            >
                              <QrCode size={13} />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => setEditingWorker(worker)}
                              title="Edit Worker Info"
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition"
                            >
                              <Edit size={13} />
                            </button>

                            {/* Toggle Active */}
                            <button
                              onClick={() => handleToggleStatus(worker)}
                              disabled={deactivatingId === worker.id}
                              title={worker.is_active ? "Deactivate" : "Activate"}
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition"
                            >
                              {deactivatingId === worker.id ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : worker.is_active ? (
                                <XCircle size={13} className="text-gray-400" />
                              ) : (
                                <CheckCircle2 size={13} className="text-green-600" />
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
