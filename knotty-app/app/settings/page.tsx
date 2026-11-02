"use client";
import { useEffect, useState } from "react";
import {
  Plus, Trash2, Loader2, Users, Layers, BookOpen, ToggleLeft, ToggleRight,
  Building2, Calendar, Check, AlertCircle, Clock, ShieldCheck
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { structure, Level, Class, StaffMember, Teacher, teachers } from "@/lib/api";
import {
  supabaseSchoolService,
  supabaseAcademicService,
  AcademicYearRow,
  AcademicTermRow,
  SchoolSettingsRow,
} from "@/lib/supabase/services";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { isManagementRole } from "@/lib/roles";
import { useToast } from "@/context/ToastContext";

type SettingsTab = "profile" | "years" | "terms" | "levels" | "classes" | "staff" | "teachers";

// ─── Modal: Create Level ───────────────────────────────────────────────────────
function CreateLevelModal({
  schoolId,
  onClose,
  onSuccess,
}: {
  schoolId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSupabaseConfigured() && schoolId) {
        const code = form.name.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 10) || "LVL";
        await supabaseAcademicService.createEducationLevel({
          schoolId,
          levelCode: code,
          name: form.name.trim(),
          stage: "lower_secondary",
          displayOrder: 1,
          framework: "REB CBC",
        });
      } else {
        await structure.createLevel({ name: form.name, description: form.description || undefined });
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Create Level</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Level Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior 1" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Class ───────────────────────────────────────────────────────
function CreateClassModal({
  levels,
  schoolId,
  academicYears = [],
  onClose,
  onSuccess,
}: {
  levels: Level[];
  schoolId?: string;
  academicYears?: AcademicYearRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ name: "", level_id: levels[0]?.id ?? "", academic_year: "2025-2026" });
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSupabaseConfigured() && schoolId && academicYears.length > 0) {
        const activeYear = academicYears.find((y) => y.status === "active") || academicYears[0];
        const code = form.name.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 10) || "CLS";
        await supabaseAcademicService.createClassSection({
          schoolId,
          academicYearId: activeYear.id,
          educationLevelId: form.level_id,
          sectionCode: code,
          name: form.name.trim(),
        });
      } else {
        await structure.createClass(form);
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Create Class</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Level</label>
            <select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Class Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A, Science, PCM" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Academic Year</label>
            <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Staff ───────────────────────────────────────────────────────
function CreateStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role: "TEACHER", password: "" });
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await structure.createStaff(form);
      onSuccess(); onClose();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-4">Add Staff Member</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">First Name</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Last Name</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
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
            <input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Academic Year ───────────────────────────────────────────────
function CreateAcademicYearModal({
  schoolId,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("2026-2027");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2027-07-01");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.createAcademicYear({
          schoolId,
          name,
          startDate,
          endDate,
        });
      } else {
        await structure.createClass({ name: "Demo Year", level_id: "l1", academic_year: name });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed creating academic year");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Create Academic Year</h3>
        <p className="text-xs text-gray-400 mb-4">Creates a new year node in 'draft' status.</p>
        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Academic Year Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 2026-2027"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End Date</label>
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#FF7A22] text-sm text-white font-bold disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create Year"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Create Academic Term ───────────────────────────────────────────────
function CreateAcademicTermModal({
  schoolId,
  academicYears,
  onClose,
  onSuccess,
}: {
  schoolId: string;
  academicYears: AcademicYearRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [academicYearId, setAcademicYearId] = useState(academicYears[0]?.id || "");
  const [name, setName] = useState("Term 1");
  const [sequence, setSequence] = useState(1);
  const [kind, setKind] = useState<"term" | "semester" | "trimester" | "quarter">("term");
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-12-15");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!academicYearId) {
      setError("Please select an academic year.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.createAcademicTerm({
          schoolId,
          academicYearId,
          name,
          sequence,
          kind,
          startDate,
          endDate,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed creating academic term");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-bold text-gray-800 mb-1">Create Academic Term</h3>
        <p className="text-xs text-gray-400 mb-4">Adds a term inside an open academic year.</p>
        {error && (
          <div className="p-3 mb-3 rounded-xl bg-red-50 text-red-600 text-xs border border-red-100 flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Academic Year</label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Term Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Term 1"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sequence #</label>
              <input
                required
                type="number"
                min={1}
                max={6}
                value={sequence}
                onChange={(e) => setSequence(parseInt(e.target.value, 10))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Term Kind</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as any)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              >
                <option value="term">Term</option>
                <option value="semester">Semester</option>
                <option value="trimester">Trimester</option>
                <option value="quarter">Quarter</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End Date</label>
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-[#FF7A22] text-sm text-white font-bold disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Create Term"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Assign Teacher Classes ─────────────────────────────────────────────
function AssignClassesModal({
  teacher,
  classes,
  levels,
  onClose,
  onSuccess,
}: {
  teacher: Teacher;
  classes: Class[];
  levels: Level[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [list, setList] = useState(teacher.subjects_taught || []);
  const [lvlId, setLvlId] = useState(levels[0]?.id || "");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = classes.filter((c) => c.level.id === lvlId || (c as any).level_id === lvlId);

  useEffect(() => {
    if (filtered.length > 0 && !classId) {
      setClassId(filtered[0].id);
    }
  }, [filtered, classId]);

  function add() {
    if (!classId || !subject.trim()) return;
    const c = classes.find((x) => x.id === classId);
    setList([...list, { class_id: classId, class_name: c ? c.name : "", subject: subject.trim() }]);
    setSubject("");
  }

  function remove(idx: number) {
    setList(list.filter((_, i) => i !== idx));
  }

  async function save() {
    setLoading(true);
    try {
      await teachers.update(teacher.id, { subjects_taught: list });
      onSuccess();
      onClose();
    } catch (e: any) {
      alert(e?.message || "Failed to update assignments");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl w-full max-w-md p-6 max-h-[90vh] flex flex-col">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-1">Assign Classes & Lessons</h3>
        <p className="text-xs text-gray-400 mb-4">Teacher: {teacher.user.first_name} {teacher.user.last_name} ({teacher.employee_code})</p>

        <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 dark:border-gray-800 rounded-2xl p-3 space-y-2 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Assignments</p>
          {list.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-6">No classes assigned yet.</p>
          ) : (
            list.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-800 px-3 py-2 rounded-xl shadow-xs border border-gray-100 dark:border-gray-700/50">
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.class_name}</p>
                  <p className="text-xs text-blue-500 font-medium">{item.subject}</p>
                </div>
                <button onClick={() => remove(idx)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add New Assignment</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">Level</label>
              <select value={lvlId} onChange={(e) => setLvlId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs dark:bg-gray-850">
                {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-2.5 py-1.5 text-xs dark:bg-gray-850">
                {filtered.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-0.5 block">Subject / Lesson Name</label>
            <div className="flex gap-2">
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics, Chemistry" className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-500 dark:bg-gray-800" />
              <button type="button" onClick={add} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs transition">Add</button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-5 border-t border-gray-100 dark:border-gray-800 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">Cancel</button>
          <button type="button" onClick={save} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60 flex items-center justify-center">
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Save Assignments"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "bg-purple-50 text-purple-600",
  TEACHER: "bg-blue-50 text-blue-600",
  CANTEEN: "bg-green-50 text-green-600",
  NURSE: "bg-pink-50 text-pink-600",
};

export default function SettingsPage() {
  const { user, activeSchool, loading: authLoading } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<SettingsTab>("levels");

  // Core data states
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([]);
  const [academicTerms, setAcademicTerms] = useState<AcademicTermRow[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettingsRow | null>(null);

  // Settings form states
  const [settingsForm, setSettingsForm] = useState({
    timezone: "Africa/Kigali",
    locale: "en-RW",
    currency: "RWF",
    framework: "REB CBC",
    dayStart: "08:00",
    weekStartsOn: 1,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "level" | "class" | "staff" | "year" | "term">(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionYearId, setActionYearId] = useState<string | null>(null);
  const [actionTermId, setActionTermId] = useState<string | null>(null);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [togglingStaff, setTogglingStaff] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const targetSchoolId = activeSchool?.id || user?.school_id || "00000000-0000-0000-0000-000000000001";
    try {
      const [l, c, s, tList] = await Promise.all([
        structure.levels(),
        structure.classes(),
        isManagementRole(user?.role) ? structure.staff() : Promise.resolve({ success: true, data: [] as StaffMember[] }),
        isManagementRole(user?.role) ? teachers.list() : Promise.resolve({ success: true, data: [] as Teacher[] }),
      ]);
      setLevels(l.data);
      setClasses(c.data);
      setStaff(s.data);
      setTeachersList(tList.data);

      // Try fetching Supabase academic years & settings if configured
      if (isSupabaseConfigured()) {
        try {
          const [years, terms, settings] = await Promise.all([
            supabaseSchoolService.listAcademicYears(targetSchoolId),
            supabaseSchoolService.listAcademicTerms(targetSchoolId),
            supabaseSchoolService.getSchoolSettings(targetSchoolId),
          ]);
          setAcademicYears(years);
          setAcademicTerms(terms);
          if (settings) {
            setSchoolSettings(settings);
            setSettingsForm({
              timezone: settings.timezone || "Africa/Kigali",
              locale: settings.locale || "en-RW",
              currency: settings.default_currency || "RWF",
              framework: settings.curriculum_framework || "REB CBC",
              dayStart: settings.school_day_start || "08:00",
              weekStartsOn: settings.week_starts_on || 1,
            });
          }
        } catch (supaErr) {
          console.warn("Supabase settings query skipped or blocked:", supaErr);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) loadAll();
  }, [user?.id, activeSchool?.id, authLoading]);

  async function handleSaveSchoolSettings(e: React.FormEvent) {
    e.preventDefault();
    const targetSchoolId = activeSchool?.id || user?.school_id;
    if (!targetSchoolId) return;

    setSavingSettings(true);
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.updateSchoolSettings(targetSchoolId, {
          timezone: settingsForm.timezone,
          locale: settingsForm.locale,
          currency: settingsForm.currency,
          curriculumFramework: settingsForm.framework,
          schoolDayStart: settingsForm.dayStart,
          weekStartsOn: Number(settingsForm.weekStartsOn),
        });
        show("School settings updated via Supabase RPC!", "success");
      } else {
        show("Settings saved (local fallback mode)", "info");
      }
    } catch (err: any) {
      show(err?.message || "Failed saving settings", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleActivateYear(yearId: string) {
    const targetSchoolId = activeSchool?.id || user?.school_id;
    if (!targetSchoolId) return;
    setActionYearId(yearId);
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.activateAcademicYear(targetSchoolId, yearId);
        show("Academic year activated!", "success");
        await loadAll();
      }
    } catch (err: any) {
      show(err?.message || "Failed activating academic year", "error");
    } finally {
      setActionYearId(null);
    }
  }

  async function handleCloseYear(yearId: string) {
    if (!confirm("Are you sure you want to close this academic year? Active terms must be closed first.")) return;
    const targetSchoolId = activeSchool?.id || user?.school_id;
    if (!targetSchoolId) return;
    setActionYearId(yearId);
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.closeAcademicYear(targetSchoolId, yearId);
        show("Academic year closed.", "info");
        await loadAll();
      }
    } catch (err: any) {
      show(err?.message || "Failed closing academic year", "error");
    } finally {
      setActionYearId(null);
    }
  }

  async function handleSetTermStatus(termId: string, status: "active" | "closed") {
    const targetSchoolId = activeSchool?.id || user?.school_id;
    if (!targetSchoolId) return;
    setActionTermId(termId);
    try {
      if (isSupabaseConfigured()) {
        await supabaseSchoolService.setAcademicTermStatus(targetSchoolId, termId, status);
        show(`Academic term marked ${status}!`, "success");
        await loadAll();
      }
    } catch (err: any) {
      show(err?.message || "Failed updating term status", "error");
    } finally {
      setActionTermId(null);
    }
  }

  async function deleteLevel(id: string) {
    if (!confirm("Delete this level? All classes inside will be deleted.")) return;
    setDeleting(id);
    try { await structure.deleteLevel(id); await loadAll(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setDeleting(null); }
  }

  async function deleteClass(id: string) {
    if (!confirm("Delete this class?")) return;
    setDeleting(id);
    try { await structure.deleteClass(id); await loadAll(); }
    catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setDeleting(null); }
  }

  async function toggleStaff(id: string) {
    if (id === user?.id) {
      alert("You cannot deactivate or modify your own active status to prevent accidental lockout.");
      return;
    }
    setTogglingStaff(id);
    try {
      const r = await structure.toggleStaff(id);
      setStaff((s) => s.map((x) => x.id === id ? { ...x, is_active: r.data.is_active } : x));
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setTogglingStaff(null); }
  }

  const TABS: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    ...(isManagementRole(user?.role) ? [
      { key: "profile" as SettingsTab, label: "School Profile & Settings", icon: Building2 },
      { key: "years" as SettingsTab, label: "Academic Years", icon: Calendar },
      { key: "terms" as SettingsTab, label: "Academic Terms", icon: Clock },
    ] : []),
    { key: "levels", label: "Levels", icon: Layers },
    { key: "classes", label: "Classes", icon: BookOpen },
    ...(isManagementRole(user?.role) ? [
      { key: "staff" as SettingsTab, label: "Staff & Roles", icon: Users },
      { key: "teachers" as SettingsTab, label: "Teacher Assignments", icon: Users }
    ] : []),
  ];

  const targetSchoolId = activeSchool?.id || user?.school_id || "00000000-0000-0000-0000-000000000001";

  return (
    <DashboardShell>
      {modal === "level" && <CreateLevelModal schoolId={targetSchoolId} onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "class" && <CreateClassModal schoolId={targetSchoolId} academicYears={academicYears} levels={levels} onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "staff" && <CreateStaffModal onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "year" && <CreateAcademicYearModal schoolId={targetSchoolId} onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "term" && <CreateAcademicTermModal schoolId={targetSchoolId} academicYears={academicYears} onClose={() => setModal(null)} onSuccess={loadAll} />}
      {assignTeacher && (
        <AssignClassesModal
          teacher={assignTeacher}
          classes={classes}
          levels={levels}
          onClose={() => setAssignTeacher(null)}
          onSuccess={loadAll}
        />
      )}

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Settings & Academics</h1>
            <p className="text-sm text-gray-400">Manage school profile, academic calendar, structure and staff</p>
          </div>
          {tab !== "profile" && (
            <button
              onClick={() => {
                if (tab === "levels") setModal("level");
                else if (tab === "classes") setModal("class");
                else if (tab === "staff") setModal("staff");
                else if (tab === "years") setModal("year");
                else if (tab === "terms") setModal("term");
              }}
              className="flex items-center gap-2 bg-[#FF7A22] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e0681a] transition self-start sm:self-auto"
            >
              <Plus size={16} />
              {tab === "levels"
                ? "Add Level"
                : tab === "classes"
                ? "Add Class"
                : tab === "years"
                ? "Add Academic Year"
                : tab === "terms"
                ? "Add Academic Term"
                : "Add Staff"}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white dark:bg-gray-900 rounded-2xl p-1.5 shadow-sm overflow-x-auto max-w-full">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                tab === key
                  ? "bg-[#FFF3EC] text-[#FF7A22] dark:bg-orange-950/40 dark:text-orange-300"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#FF7A22]" size={28} /></div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-800">
            {/* 1. SCHOOL PROFILE & SETTINGS */}
            {tab === "profile" && (
              <div className="p-6 max-w-3xl space-y-6">
                <div>
                  <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">School Profile & Institutional Settings</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Scaped to active school: {activeSchool?.name || "IshuriHUB Model School"}</p>
                </div>

                <form onSubmit={handleSaveSchoolSettings} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Timezone</label>
                      <input
                        value={settingsForm.timezone}
                        onChange={(e) => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF7A22] dark:bg-gray-800"
                        placeholder="e.g. Africa/Kigali"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Locale</label>
                      <input
                        value={settingsForm.locale}
                        onChange={(e) => setSettingsForm({ ...settingsForm, locale: e.target.value })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF7A22] dark:bg-gray-800"
                        placeholder="e.g. en-RW or rw-RW"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Default Currency (ISO)</label>
                      <input
                        maxLength={3}
                        value={settingsForm.currency}
                        onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value.toUpperCase() })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-[#FF7A22] dark:bg-gray-800"
                        placeholder="RWF"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Curriculum Framework</label>
                      <input
                        value={settingsForm.framework}
                        onChange={(e) => setSettingsForm({ ...settingsForm, framework: e.target.value })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF7A22] dark:bg-gray-800"
                        placeholder="e.g. REB CBC"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">School Day Start</label>
                      <input
                        type="time"
                        value={settingsForm.dayStart}
                        onChange={(e) => setSettingsForm({ ...settingsForm, dayStart: e.target.value })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF7A22] dark:bg-gray-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 block">Week Starts On</label>
                      <select
                        value={settingsForm.weekStartsOn}
                        onChange={(e) => setSettingsForm({ ...settingsForm, weekStartsOn: parseInt(e.target.value, 10) })}
                        className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none dark:bg-gray-800"
                      >
                        <option value={1}>Monday (1)</option>
                        <option value={0}>Sunday (0)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-5 py-2.5 rounded-xl bg-[#FF7A22] text-white text-xs font-bold hover:bg-[#e0681a] transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      Save Institutional Settings
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. ACADEMIC YEARS */}
            {tab === "years" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Year Name</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Start Date</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">End Date</th>
                    <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Status</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {academicYears.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-sm text-gray-400">
                        No academic years found. Click "Add Academic Year" to create one.
                      </td>
                    </tr>
                  ) : (
                    academicYears.map((y) => (
                      <tr key={y.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{y.name}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400">{y.start_date}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400">{y.end_date}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              y.status === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : y.status === "draft"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {y.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5">
                          {y.status === "draft" && (
                            <button
                              onClick={() => handleActivateYear(y.id)}
                              disabled={actionYearId === y.id}
                              className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition disabled:opacity-50"
                            >
                              {actionYearId === y.id ? "Activating..." : "Activate"}
                            </button>
                          )}
                          {y.status === "active" && (
                            <button
                              onClick={() => handleCloseYear(y.id)}
                              disabled={actionYearId === y.id}
                              className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold transition disabled:opacity-50"
                            >
                              {actionYearId === y.id ? "Closing..." : "Close Year"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. ACADEMIC TERMS */}
            {tab === "terms" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Term Name</th>
                    <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Seq</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Kind</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Start Date</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">End Date</th>
                    <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Status</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {academicTerms.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-sm text-gray-400">
                        No academic terms found. Create terms inside an open academic year.
                      </td>
                    </tr>
                  ) : (
                    academicTerms.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                        <td className="px-5 py-3.5 font-semibold text-sm text-gray-800 dark:text-gray-200">{t.name}</td>
                        <td className="px-5 py-3.5 text-center text-xs text-gray-500 font-mono">#{t.sequence_number}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500 uppercase">{t.term_kind}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400">{t.start_date}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 dark:text-gray-400">{t.end_date}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              t.status === "active"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : t.status === "scheduled"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5">
                          {t.status === "scheduled" && (
                            <button
                              onClick={() => handleSetTermStatus(t.id, "active")}
                              disabled={actionTermId === t.id}
                              className="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition disabled:opacity-50"
                            >
                              Activate
                            </button>
                          )}
                          {t.status === "active" && (
                            <button
                              onClick={() => handleSetTermStatus(t.id, "closed")}
                              disabled={actionTermId === t.id}
                              className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold transition disabled:opacity-50"
                            >
                              Close
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. LEVELS */}
            {tab === "levels" && (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100"><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Name</th><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Description</th><th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Classes</th><th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Students</th><th className="px-5 py-3" /></tr></thead>
                <tbody>
                  {levels.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">No levels yet — add one</td></tr>
                  )}
                  {levels.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><Layers size={14} className="text-blue-600" /></div>
                          <span className="text-sm font-semibold text-gray-700">{l.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-400">{l.description ?? "—"}</td>
                      <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-600">{l._count?.classes ?? 0}</td>
                      <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-600">{l._count?.students ?? 0}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => deleteLevel(l.id)} disabled={deleting === l.id} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40">
                          {deleting === l.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 5. CLASSES */}
            {tab === "classes" && (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100"><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Class</th><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Level</th><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Academic Year</th><th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Students</th><th className="px-5 py-3" /></tr></thead>
                <tbody>
                  {classes.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">No classes yet — add one</td></tr>
                  )}
                  {classes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><BookOpen size={14} className="text-blue-500" /></div>
                          <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{c.level.name}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-400">{c.academic_year ?? "—"}</td>
                      <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-600">{c._count?.students ?? 0}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => deleteClass(c.id)} disabled={deleting === c.id} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-500 transition disabled:opacity-40">
                          {deleting === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 6. STAFF */}
            {tab === "staff" && (
              <table className="w-full">
                <thead><tr className="border-b border-gray-100"><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Name</th><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Email</th><th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Role</th><th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Last Login</th><th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Active</th></tr></thead>
                <tbody>
                  {staff.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">No staff members found</td></tr>
                  )}
                  {staff.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 text-white text-xs font-bold flex items-center justify-center">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{s.first_name} {s.last_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{s.email}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[s.role] ?? "bg-gray-100 text-gray-500"}`}>{s.role}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-400">
                        {s.last_login ? new Date(s.last_login).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button onClick={() => toggleStaff(s.id)} disabled={togglingStaff === s.id} title={s.is_active ? "Deactivate" : "Activate"} className="text-gray-400 hover:text-blue-600 transition disabled:opacity-50">
                          {togglingStaff === s.id ? (
                            <Loader2 size={22} className="animate-spin text-blue-600" />
                          ) : s.is_active ? (
                            <ToggleRight size={22} className="text-blue-600" />
                          ) : (
                            <ToggleLeft size={22} />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 7. TEACHERS */}
            {tab === "teachers" && (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Teacher</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Code</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Email</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Assignments</th>
                    <th className="text-center px-5 py-3 text-xs text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersList.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-12 text-sm text-gray-400">No teachers found</td></tr>
                  )}
                  {teachersList.map((t) => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {t.user.first_name} {t.user.last_name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-gray-500 dark:text-gray-400">{t.employee_code}</td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{t.user.email}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {!t.subjects_taught || t.subjects_taught.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No assignments</span>
                          ) : (
                            t.subjects_taught.map((item, idx) => (
                              <span key={idx} className="inline-flex flex-col px-2 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg text-[10px]">
                                <span className="font-semibold text-blue-700 dark:text-blue-400">{item.class_name}</span>
                                <span className="text-gray-500 dark:text-gray-300">{item.subject}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => setAssignTeacher(t)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl text-xs font-semibold transition"
                        >
                          Assign Classes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
