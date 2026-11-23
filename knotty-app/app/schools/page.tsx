"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Users, UserCheck, Layers, BookOpen,
  Calendar, Clock, Settings, Trash2, ChevronLeft, AlertCircle, Check,
  RefreshCw, Loader2, Mail, Phone, MapPin, ArrowRight, X, ChevronRight,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import type { SchoolItem } from "@/lib/api";
import {
  supabaseSchoolService,
  supabaseAcademicService,
  supabaseStaffService,
  type AcademicYearRow,
  type AcademicTermRow,
  type EducationLevelRow,
  type ClassSectionRow,
} from "@/lib/supabase/services";
import { supabaseCardService } from "@/lib/supabase/services/cardService";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { isManagementRole } from "@/lib/roles";

type View = "home" | "manage";
type Section = "levels" | "classes" | "staff" | "years" | "terms" | "profile" | null;
type LocalClass = ClassSectionRow & { level: { id: string; name: string }; yearName?: string };
type LocalStaff = { id: string; name: string; email: string; role: string; is_active: boolean; code?: string };

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white";

// ─── Modal: Register School ────────────────────────────────────────────────────
function NewSchoolModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { show } = useToast();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(val: string) {
    setName(val);
    if (!code) {
      const words = val.trim().split(/\s+/);
      if (words.length > 1) setCode(words.map((w) => w[0]).join("").toUpperCase().slice(0, 4));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) { setError("School name and email are required."); return; }
    setSaving(true); setError("");
    try {
      await supabaseSchoolService.provisionSchool({
        organizationId: "00000000-0000-0000-0000-000000000001",
        name: name.trim(),
        code: code.trim().toUpperCase() || name.trim().slice(0, 4).toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      });
      show("School registered!", "success");
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Failed to register school"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Register New School</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3.5">
          {error && <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100"><AlertCircle size={14} className="shrink-0" /><span>{error}</span></div>}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">School Name <span className="text-red-500">*</span></label>
            <input required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="e.g. Kigali International Academy" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">School Code</label>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="e.g. KIA" className={`${inp} font-mono uppercase`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250 788 000 000" className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Administrative Email <span className="text-red-500">*</span></label>
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@school.rw" className={inp} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. KG 15 Ave, Kigali" className={inp} />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold transition disabled:opacity-60" style={{ background: "#16A34A" }}>
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Register School
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Level ───────────────────────────────────────────────────────
function CreateLevelModal({ schoolId, onClose, onSuccess }: { schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const code = form.name.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 7) + "_" + Date.now().toString(36).slice(-3).toUpperCase();
      await supabaseAcademicService.createEducationLevel({ schoolId, levelCode: code, name: form.name.trim(), stage: "lower_secondary", displayOrder: 1, framework: "REB CBC" });
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Error creating level"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Create Education Level</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Level Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior 1" className={inp} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Level
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Class ───────────────────────────────────────────────────────
function CreateClassModal({ levels, schoolId, academicYears, onClose, onSuccess }: { levels: EducationLevelRow[]; schoolId: string; academicYears: AcademicYearRow[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", level_id: levels[0]?.id ?? "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      if (academicYears.length === 0) throw new Error("Create and activate an Academic Year first.");
      if (!form.level_id) throw new Error("Create a Level first.");
      const activeYear = academicYears.find((y) => y.status === "active") || academicYears[0];
      const code = form.name.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 7) + "_" + Date.now().toString(36).slice(-3).toUpperCase();
      await supabaseAcademicService.createClassSection({ schoolId, academicYearId: activeYear.id, educationLevelId: form.level_id, sectionCode: code, name: form.name.trim() });
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Error creating class"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Create Class Section</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Level</label>
            <select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} className={inp}>
              {levels.length === 0 && <option value="">No levels yet</option>}
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Class Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A, Science, PCM" className={inp} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Class
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Staff (with password) ──────────────────────────────────────
function CreateStaffModal({ schoolId, actorId, onClose, onSuccess }: { schoolId: string; actorId: string; onClose: () => void; onSuccess: () => void }) {
  const { show } = useToast();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "TEACHER", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("First and last name are required."); return; }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.password.trim()) { setError("Set a temporary password."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/staff/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: schoolId,
          legal_name: `${form.first_name.trim()} ${form.last_name.trim()}`,
          email: form.email.trim(),
          role_key: form.role,
          password: form.password,
          actor_auth_user_id: actorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create staff");
      show(`Staff account created for ${form.first_name} ${form.last_name}`, "success");
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Add Staff Member</h3>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">First Name</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inp}>
              <option value="TEACHER">Teacher</option>
              <option value="BURSAR">Bursar / Accountant</option>
              <option value="DISCIPLINE">Discipline Officer</option>
              <option value="NURSE">School Nurse</option>
              <option value="LIBRARIAN">Librarian</option>
              <option value="CANTEEN">Canteen Staff</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Temporary Password</label>
            <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" className={inp} />
          </div>
          <p className="text-[11px] text-gray-400">Staff can log in immediately with this email and password.</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 text-sm text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Staff
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Academic Year ───────────────────────────────────────────────
function CreateAcademicYearModal({ schoolId, onClose, onSuccess }: { schoolId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "2026-2027", startDate: "2026-09-01", endDate: "2027-07-01" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      await supabaseSchoolService.createAcademicYear({ schoolId, name: form.name, startDate: form.startDate, endDate: form.endDate });
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Failed"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Create Academic Year</h3>
        <p className="text-xs text-gray-400 mb-4">Creates a new year in draft status.</p>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Year Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2026-2027" className={inp} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Start Date</label><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inp} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">End Date</label><input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inp} /></div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Year
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Academic Term ───────────────────────────────────────────────
function CreateAcademicTermModal({ schoolId, academicYears, onClose, onSuccess }: { schoolId: string; academicYears: AcademicYearRow[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ academicYearId: academicYears[0]?.id || "", name: "Term 1", sequence: 1, kind: "term" as const, startDate: "2026-09-01", endDate: "2026-12-15" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.academicYearId) { setError("Select an academic year."); return; }
    setLoading(true); setError("");
    try {
      await supabaseSchoolService.createAcademicTerm({ schoolId, academicYearId: form.academicYearId, name: form.name, sequence: form.sequence, kind: form.kind, startDate: form.startDate, endDate: form.endDate });
      onSuccess(); onClose();
    } catch (err: any) { setError(err?.message || "Failed"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Create Academic Term</h3>
        <p className="text-xs text-gray-400 mb-4">Adds a term inside an open academic year.</p>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Academic Year</label>
            <select value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })} className={inp}>
              {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name} ({y.status})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500 mb-1 block">Term Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Term 1" className={inp} /></div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Kind</label>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })} className={inp}>
                <option value="term">Term</option>
                <option value="semester">Semester</option>
                <option value="trimester">Trimester</option>
                <option value="quarter">Quarter</option>
              </select>
            </div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">Start Date</label><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inp} /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">End Date</label><input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inp} /></div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-green-600 text-sm text-white font-bold disabled:opacity-60 flex items-center justify-center gap-1.5">
              {loading && <Loader2 size={14} className="animate-spin" />} Create Term
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SchoolsPage() {
  const router = useRouter();
  const { user, activeSchool, schoolsList, switchSchool, refreshSchools } = useAuth();
  const { show } = useToast();

  const [localSchools, setLocalSchools] = useState<SchoolItem[]>([]);
  const [schoolCounts, setSchoolCounts] = useState<Record<string, { students: number; staff: number; classes: number }>>({});
  const [listLoading, setListLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // 3-level nav: home → manage (blocks) → section (detail)
  const [view, setView] = useState<View>("home");
  const [section, setSection] = useState<Section>(null);

  const [manageLoading, setManageLoading] = useState(false);
  const [levels, setLevels] = useState<EducationLevelRow[]>([]);
  const [classes, setClasses] = useState<LocalClass[]>([]);
  const [staff, setStaff] = useState<LocalStaff[]>([]);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = useState<AcademicTermRow[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [togglingStaff, setTogglingStaff] = useState<string | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<string | null>(null);

  const [modal, setModal] = useState<null | "school" | "level" | "class" | "staff" | "year" | "term">(null);

  const targetSchoolId = activeSchool?.id || user?.school_id || "";

  // ── Load schools list ──────────────────────────────────────────────────────
  const loadSchools = useCallback(async () => {
    setListLoading(true);
    try { await refreshSchools(); } catch {}
    finally { setListLoading(false); }
  }, [refreshSchools]);

  useEffect(() => { loadSchools(); }, []);

  useEffect(() => {
    if (schoolsList.length > 0) {
      setLocalSchools(schoolsList);
      loadRealCounts(schoolsList);
    }
  }, [schoolsList]);

  async function loadRealCounts(schools: SchoolItem[]) {
    const client = getSafeBrowserClient();
    if (!client || schools.length === 0) return;
    try {
      const results: Record<string, { students: number; staff: number; classes: number }> = {};
      await Promise.allSettled(schools.map(async (school) => {
        const [sRes, wRes, cRes] = await Promise.allSettled([
          client.from("students").select("id", { count: "exact", head: true }).eq("school_id", school.id),
          client.from("staff_records").select("id", { count: "exact", head: true }).eq("school_id", school.id),
          client.from("class_sections").select("id", { count: "exact", head: true }).eq("school_id", school.id),
        ]);
        results[school.id] = {
          students: sRes.status === "fulfilled" ? (sRes.value.count ?? 0) : 0,
          staff: wRes.status === "fulfilled" ? (wRes.value.count ?? 0) : 0,
          classes: cRes.status === "fulfilled" ? (cRes.value.count ?? 0) : 0,
        };
      }));
      setSchoolCounts(results);
    } catch {}
  }

  // ── Load manage data ───────────────────────────────────────────────────────
  const loadManageData = useCallback(async () => {
    if (!targetSchoolId) return;
    setManageLoading(true);
    try {
      const [lvlRes, clsRes, stfRes, yrRes, tmRes] = await Promise.allSettled([
        supabaseAcademicService.listEducationLevels(targetSchoolId),
        supabaseAcademicService.listClassSections(targetSchoolId),
        isManagementRole(user?.role) ? supabaseStaffService.listStaffMembers(targetSchoolId) : Promise.resolve([]),
        supabaseSchoolService.listAcademicYears(targetSchoolId),
        supabaseSchoolService.listAcademicTerms(targetSchoolId),
      ]);

      const lvlRows = lvlRes.status === "fulfilled" ? lvlRes.value : [];
      const clsRows = clsRes.status === "fulfilled" ? clsRes.value : [];
      const stfRows = stfRes.status === "fulfilled" ? (stfRes.value as any[]) : [];
      const yrRows = yrRes.status === "fulfilled" ? yrRes.value : [];
      const tmRows = tmRes.status === "fulfilled" ? tmRes.value : [];

      const levelMap: Record<string, string> = {};
      lvlRows.forEach((l) => { levelMap[l.id] = l.name; });
      const yearMap: Record<string, string> = {};
      yrRows.forEach((y) => { yearMap[y.id] = y.name; });

      setLevels(lvlRows);
      setClasses(clsRows.map((c) => ({
        ...c,
        level: { id: (c as any).education_level_id, name: levelMap[(c as any).education_level_id] ?? "" },
        yearName: yearMap[(c as any).academic_year_id] ?? "",
      })));
      setStaff(stfRows.map((r) => ({
        id: r.staff_record_id,
        name: r.legal_name ?? "Unknown",
        email: r.primary_email ?? "",
        role: r.primary_role_category ?? "",
        is_active: r.employment_status === "active",
        code: r.staff_number ?? "",
      })));
      setYears(yrRows);
      setTerms(tmRows);
    } catch {}
    finally { setManageLoading(false); }
  }, [targetSchoolId, user?.role]);

  useEffect(() => {
    if (view === "manage") loadManageData();
  }, [view, loadManageData]);

  // ── School switch ──────────────────────────────────────────────────────────
  async function handleSwitch(school: SchoolItem) {
    if (school.id === activeSchool?.id) return;
    setSwitchingId(school.id);
    try {
      show(`Switching to ${school.name}...`, "info");
      await switchSchool(school.id);
      router.push("/");
    } catch (err: any) {
      show(err?.message || "Failed to switch", "error");
      setSwitchingId(null);
    }
  }

  // ── Manage actions ─────────────────────────────────────────────────────────
  async function deleteLevel(id: string) {
    if (!confirm("Delete this level? All classes inside will be removed.")) return;
    setDeleting(id);
    const client = getSafeBrowserClient();
    try {
      if (client) {
        const { error } = await client.rpc("delete_education_level", { p_school_id: targetSchoolId, p_level_id: id });
        if (error) throw new Error(error.message);
      }
      show("Level deleted", "success");
      loadManageData();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
    finally { setDeleting(null); }
  }

  async function deleteClass(id: string) {
    if (!confirm("Delete this class section?")) return;
    setDeleting(id);
    const client = getSafeBrowserClient();
    try {
      if (client) {
        const { error } = await client.rpc("delete_class_section", { p_school_id: targetSchoolId, p_class_section_id: id });
        if (error) throw new Error(error.message);
      }
      show("Class deleted", "success");
      loadManageData();
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
    finally { setDeleting(null); }
  }

  async function toggleStaff(s: LocalStaff) {
    if (s.id === user?.id) { show("You cannot deactivate your own account.", "error"); return; }
    setTogglingStaff(s.id);
    try {
      const newStatus = s.is_active ? "suspended" : "active";
      await supabaseStaffService.updateStaffStatus(targetSchoolId, s.id, newStatus, "Toggled by admin");
      setStaff((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: !s.is_active } : x));
      show(`${s.name} ${s.is_active ? "deactivated" : "activated"}`, "success");
    } catch (err) { show(err instanceof Error ? err.message : "Error", "error"); }
    finally { setTogglingStaff(null); }
  }

  async function deleteStaff(s: LocalStaff) {
    if (s.id === user?.id) { show("You cannot delete your own account.", "error"); return; }
    if (!confirm(`Delete ${s.name}? This will terminate their account and remove their access.`)) return;
    setDeletingStaff(s.id);
    try {
      await supabaseStaffService.updateStaffStatus(targetSchoolId, s.id, "terminated", "Deleted by admin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "terminal" means already terminated — still remove from UI; they have no access anyway
      if (!msg.toLowerCase().includes("terminal")) {
        show(msg || "Error", "error");
        setDeletingStaff(null);
        return;
      }
    } finally {
      setDeletingStaff(null);
    }
    // Revoke any active NFC/card assignments so the physical card stops working immediately
    supabaseCardService.revokeStaffCards(targetSchoolId, s.id).catch(() => {});
    setStaff((prev) => prev.filter((x) => x.id !== s.id));
    show(`${s.name} has been removed.`, "success");
  }

  async function activateYear(yearId: string) {
    setActionId(yearId);
    try {
      await supabaseSchoolService.activateAcademicYear(targetSchoolId, yearId);
      show("Academic year activated!", "success");
      loadManageData();
    } catch (err: any) { show(err?.message || "Error", "error"); }
    finally { setActionId(null); }
  }

  async function closeYear(yearId: string) {
    if (!confirm("Close this academic year? Active terms must be closed first.")) return;
    setActionId(yearId);
    try {
      await supabaseSchoolService.closeAcademicYear(targetSchoolId, yearId);
      show("Academic year closed.", "info");
      loadManageData();
    } catch (err: any) { show(err?.message || "Error", "error"); }
    finally { setActionId(null); }
  }

  async function setTermStatus(termId: string, status: "active" | "closed") {
    setActionId(termId);
    try {
      await supabaseSchoolService.setAcademicTermStatus(targetSchoolId, termId, status);
      show(`Term marked ${status}!`, "success");
      loadManageData();
    } catch (err: any) { show(err?.message || "Error", "error"); }
    finally { setActionId(null); }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function yearStatusBadge(status: string) {
    if (status === "active") return "bg-green-50 text-green-700";
    if (status === "draft") return "bg-amber-50 text-amber-700";
    return "bg-gray-100 text-gray-500";
  }

  function termStatusBadge(status: string) {
    if (status === "active") return "bg-green-50 text-green-700";
    if (status === "scheduled") return "bg-amber-50 text-amber-700";
    return "bg-gray-100 text-gray-500";
  }

  const ROLE_COLORS: Record<string, string> = {
    ADMIN: "bg-purple-50 text-purple-700",
    TEACHER: "bg-blue-50 text-blue-700",
    BURSAR: "bg-yellow-50 text-yellow-700",
    NURSE: "bg-pink-50 text-pink-700",
    LIBRARIAN: "bg-indigo-50 text-indigo-700",
    CANTEEN: "bg-orange-50 text-orange-700",
    DISCIPLINE: "bg-red-50 text-red-700",
  };

  const BLOCKS = [
    { key: "levels" as Section,  label: "Education Levels", icon: Layers,    color: "#DCFCE7", iconColor: "#16A34A", count: levels.length },
    { key: "classes" as Section, label: "Class Sections",   icon: BookOpen,  color: "#EFF6FF", iconColor: "#2563EB", count: classes.length },
    { key: "staff" as Section,   label: "Staff & Workers",  icon: UserCheck, color: "#FFF7ED", iconColor: "#EA580C", count: staff.length },
    { key: "years" as Section,   label: "Academic Years",   icon: Calendar,  color: "#F5F3FF", iconColor: "#7C3AED", count: years.length },
    { key: "terms" as Section,   label: "Academic Terms",   icon: Clock,     color: "#FDF2F8", iconColor: "#BE185D", count: terms.length },
    { key: "profile" as Section, label: "School Profile",   icon: Settings,  color: "#F8FAFC", iconColor: "#475569", count: null },
  ];

  const totals = {
    students: Object.values(schoolCounts).reduce((s, c) => s + c.students, 0),
    staff: Object.values(schoolCounts).reduce((s, c) => s + c.staff, 0),
    classes: Object.values(schoolCounts).reduce((s, c) => s + c.classes, 0),
  };

  // Current section block config
  const currentBlock = section ? BLOCKS.find(b => b.key === section) : null;

  // ── Header navigation titles/actions ──────────────────────────────────────
  function HeaderLeft() {
    if (view === "home") {
      return (
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800">Schools</h1>
          <p className="text-xs text-gray-400 mt-0.5">School network overview</p>
        </div>
      );
    }
    if (view === "manage" && section === null) {
      return (
        <>
          <button onClick={() => setView("home")} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-800">Manage School</h1>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{activeSchool?.name ?? "School"}</p>
          </div>
        </>
      );
    }
    // Inside a section
    return (
      <>
        <button onClick={() => setSection(null)} className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0">
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-gray-800">{currentBlock?.label ?? ""}</h1>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{activeSchool?.name ?? "School"}</p>
        </div>
      </>
    );
  }

  function HeaderRight() {
    if (view === "home") {
      return (
        <button onClick={() => setModal("school")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shrink-0" style={{ background: "#16A34A" }}>
          <Plus size={14} /> Register School
        </button>
      );
    }
    if (view === "manage" && section !== null && section !== "profile") {
      const labels: Record<string, string> = { levels: "Add Level", classes: "Add Class", staff: "Add Staff", years: "Add Year", terms: "Add Term" };
      const modalKey = section === "levels" ? "level" : section === "classes" ? "class" : section === "staff" ? "staff" : section === "years" ? "year" : "term";
      return (
        <button onClick={() => setModal(modalKey as any)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shrink-0" style={{ background: "#16A34A" }}>
          <Plus size={14} /> {labels[section]}
        </button>
      );
    }
    return null;
  }

  return (
    <DashboardShell>
      {modal === "school" && <NewSchoolModal onClose={() => setModal(null)} onSuccess={loadSchools} />}
      {modal === "level" && <CreateLevelModal schoolId={targetSchoolId} onClose={() => setModal(null)} onSuccess={() => { loadManageData(); loadRealCounts(localSchools); }} />}
      {modal === "class" && <CreateClassModal schoolId={targetSchoolId} levels={levels} academicYears={years} onClose={() => setModal(null)} onSuccess={() => { loadManageData(); loadRealCounts(localSchools); }} />}
      {modal === "staff" && <CreateStaffModal schoolId={targetSchoolId} actorId={user?.id || ""} onClose={() => setModal(null)} onSuccess={() => { loadManageData(); loadRealCounts(localSchools); }} />}
      {modal === "year" && <CreateAcademicYearModal schoolId={targetSchoolId} onClose={() => setModal(null)} onSuccess={loadManageData} />}
      {modal === "term" && <CreateAcademicTermModal schoolId={targetSchoolId} academicYears={years} onClose={() => setModal(null)} onSuccess={loadManageData} />}

      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <HeaderLeft />
          <HeaderRight />
        </div>

        {/* ── HOME: schools list ─────────────────────────────────────────── */}
        {view === "home" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Schools",  value: localSchools.length, icon: Building2 },
                { label: "Students", value: totals.students,     icon: Users },
                { label: "Staff",    value: totals.staff,        icon: UserCheck },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white rounded-2xl p-3 shadow-sm text-center">
                  <Icon size={16} className="mx-auto text-gray-400 mb-1" />
                  <p className="text-lg font-bold text-gray-800">{value}</p>
                  <p className="text-[11px] text-gray-400">{label}</p>
                </div>
              ))}
            </div>

            {listLoading ? (
              <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : localSchools.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-gray-300">
                <Building2 size={36} className="mb-2" />
                <p className="text-sm">No schools yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {localSchools.map((school) => {
                  const isActive = school.id === activeSchool?.id;
                  const isSwitching = switchingId === school.id;
                  const counts = schoolCounts[school.id];
                  return (
                    <div key={school.id} className="bg-white rounded-2xl p-4 border transition"
                      style={isActive ? { borderColor: "#16A34A" } : { borderColor: "#e5e5e5" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700">{school.code}</span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-[#BBF7D0]" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#16A34A" }} /> Active
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-gray-800">{school.name}</h3>
                      <div className="mt-1 space-y-0.5 text-xs text-gray-400">
                        {school.address && <p className="flex items-center gap-1.5"><MapPin size={11} />{school.address}</p>}
                        <p className="flex items-center gap-1.5"><Mail size={11} />{school.email}</p>
                        {school.phone && <p className="flex items-center gap-1.5"><Phone size={11} />{school.phone}</p>}
                      </div>
                      <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-center">
                        {[["Students", counts?.students], ["Staff", counts?.staff], ["Classes", counts?.classes]].map(([lbl, val]) => (
                          <div key={lbl as string}>
                            <p className="text-[10px] text-gray-400 font-medium uppercase">{lbl}</p>
                            <p className="text-xs font-bold text-gray-800 mt-0.5">{val ?? "—"}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        {isActive ? (
                          <button onClick={() => { setView("manage"); setSection(null); }}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition"
                            style={{ background: "#DCFCE7", color: "#16A34A" }}>
                            <Settings size={14} /> Manage School
                          </button>
                        ) : (
                          <button onClick={() => handleSwitch(school)} disabled={isSwitching}
                            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white text-sm font-semibold transition disabled:opacity-60"
                            style={{ background: "#121212" }}>
                            {isSwitching ? <><RefreshCw size={13} className="animate-spin" /> Switching...</> : <><span>Enter School</span><ArrowRight size={13} /></>}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── MANAGE: 6 blocks (section === null) ───────────────────────── */}
        {view === "manage" && section === null && (
          manageLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : (
            <div className="space-y-2">
              {BLOCKS.map((b) => {
                const Icon = b.icon;
                return (
                  <button key={b.key} onClick={() => setSection(b.key)}
                    className="w-full bg-white rounded-2xl px-4 py-3.5 shadow-sm flex items-center gap-4 hover:shadow-md transition text-left border border-gray-100">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: b.color }}>
                      <Icon size={19} style={{ color: b.iconColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{b.label}</p>
                      {b.count !== null && (
                        <p className="text-xs text-gray-400 mt-0.5">{b.count} {b.count === 1 ? "record" : "records"}</p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )
        )}

        {/* ── SECTION VIEWS ─────────────────────────────────────────────── */}
        {view === "manage" && section !== null && (
          manageLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-gray-300" /></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

              {/* LEVELS */}
              {section === "levels" && (
                levels.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-gray-300">
                    <Layers size={28} className="mb-2" />
                    <p className="text-sm">No levels yet</p>
                    <p className="text-xs mt-1">Tap "Add Level" to create the first one</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {levels.map((l) => (
                      <div key={l.id} className="flex items-center justify-between px-4 py-3.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{l.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{classes.filter(c => c.level.id === l.id).length} class sections</p>
                        </div>
                        <button onClick={() => deleteLevel(l.id)} disabled={deleting === l.id}
                          className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition disabled:opacity-40">
                          {deleting === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* CLASSES */}
              {section === "classes" && (
                classes.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-gray-300">
                    <BookOpen size={28} className="mb-2" />
                    <p className="text-sm">No classes yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {classes.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.level.name} — {c.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.yearName || "—"}</p>
                        </div>
                        <button onClick={() => deleteClass(c.id)} disabled={deleting === c.id}
                          className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition disabled:opacity-40">
                          {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* STAFF */}
              {section === "staff" && (
                staff.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-gray-300">
                    <UserCheck size={28} className="mb-2" />
                    <p className="text-sm">No staff yet</p>
                    <p className="text-xs mt-1">Add staff with login credentials</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {staff.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ background: s.is_active ? "#16A34A" : "#9CA3AF" }}>
                          {s.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS[s.role] || "bg-gray-100 text-gray-600"}`}>{s.role}</span>
                            <span className="text-xs text-gray-400 truncate">{s.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => toggleStaff(s)} disabled={togglingStaff === s.id || deletingStaff === s.id}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition disabled:opacity-50 ${s.is_active ? "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700" : "bg-green-50 text-green-600 hover:bg-green-100"}`}>
                            {togglingStaff === s.id ? <Loader2 size={12} className="animate-spin" /> : s.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => deleteStaff(s)} disabled={deletingStaff === s.id || togglingStaff === s.id}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition disabled:opacity-40">
                            {deletingStaff === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* YEARS */}
              {section === "years" && (
                years.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-gray-300">
                    <Calendar size={28} className="mb-2" />
                    <p className="text-sm">No academic years yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {years.map((y) => (
                      <div key={y.id} className="px-4 py-3.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800">{y.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${yearStatusBadge(y.status)}`}>{y.status}</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2.5">
                          {new Date(y.start_date).toLocaleDateString("en-GB")} – {new Date(y.end_date).toLocaleDateString("en-GB")}
                        </p>
                        <div className="flex gap-2">
                          {y.status === "draft" && (
                            <button onClick={() => activateYear(y.id)} disabled={actionId === y.id}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50">
                              {actionId === y.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Activate
                            </button>
                          )}
                          {y.status === "active" && (
                            <button onClick={() => closeYear(y.id)} disabled={actionId === y.id}
                              className="text-xs px-3 py-1.5 rounded-xl bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition disabled:opacity-50 flex items-center gap-1">
                              {actionId === y.id && <Loader2 size={11} className="animate-spin" />} Close Year
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* TERMS */}
              {section === "terms" && (
                terms.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-gray-300">
                    <Clock size={28} className="mb-2" />
                    <p className="text-sm">No academic terms yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {terms.map((t) => (
                      <div key={t.id} className="px-4 py-3.5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-gray-800">{t.name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${termStatusBadge(t.status)}`}>{t.status}</span>
                        </div>
                        <p className="text-xs text-gray-400 mb-2.5">
                          {new Date(t.start_date).toLocaleDateString("en-GB")} – {new Date(t.end_date).toLocaleDateString("en-GB")}
                        </p>
                        <div className="flex gap-2">
                          {t.status === "scheduled" && (
                            <button onClick={() => setTermStatus(t.id, "active")} disabled={actionId === t.id}
                              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50">
                              {actionId === t.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Activate
                            </button>
                          )}
                          {t.status === "active" && (
                            <button onClick={() => setTermStatus(t.id, "closed")} disabled={actionId === t.id}
                              className="text-xs px-3 py-1.5 rounded-xl bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition disabled:opacity-50 flex items-center gap-1">
                              {actionId === t.id && <Loader2 size={11} className="animate-spin" />} End Term
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* PROFILE */}
              {section === "profile" && activeSchool && (
                <div className="p-5">
                  <div className="space-y-0">
                    {[
                      ["School Name", activeSchool.name],
                      ["School Code", activeSchool.code],
                      ["Email", activeSchool.email],
                      ["Phone", activeSchool.phone || "—"],
                      ["Address", activeSchool.address || "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-3 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-400">{k}</span>
                        <span className="text-xs font-medium text-gray-700 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 p-3.5 rounded-xl bg-green-50 border border-green-100">
                    <p className="text-xs font-semibold text-green-800 mb-1">Data Safety</p>
                    <p className="text-xs text-green-700 leading-relaxed">All school data is stored in Supabase PostgreSQL — a managed cloud database with automatic daily backups, point-in-time recovery, and 99.9% uptime SLA. Even if the app goes offline, your data remains safe and intact on the cloud database server.</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">To update school details, contact a platform administrator.</p>
                </div>
              )}

            </div>
          )
        )}
      </div>
    </DashboardShell>
  );
}
