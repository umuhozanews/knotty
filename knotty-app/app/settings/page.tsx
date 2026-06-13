"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Users, Layers, BookOpen, ToggleLeft, ToggleRight, Eye, EyeOff } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { structure, Level, Class, StaffMember, Teacher, teachers } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type SettingsTab = "levels" | "classes" | "staff" | "teachers";

function CreateLevelModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await structure.createLevel({ name: form.name, description: form.description || undefined });
      onSuccess(); onClose();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
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

function CreateClassModal({ levels, onClose, onSuccess }: { levels: Level[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", level_id: levels[0]?.id ?? "", academic_year: "2025-2026" });
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await structure.createClass(form);
      onSuccess(); onClose();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
    finally { setLoading(false); }
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

function CreateStaffModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", role: "TEACHER", password: "" });
  const [showPwd, setShowPwd] = useState(false);
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
          <div className="grid grid-cols-2 gap-3">
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
            <input type="text" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="TEACHER">Teacher</option>
              <option value="CANTEEN">Canteen Staff</option>
              <option value="NURSE">Nurse</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Password</label>
            <div className="relative">
              <input type={showPwd ? "text" : "password"} required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 pr-9" />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium disabled:opacity-60">
              {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Add Staff"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssignClassesModal({ teacher, classes, levels, onClose, onSuccess }: { teacher: Teacher; classes: Class[]; levels: Level[]; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<Array<{ class_id: string; class_name: string; subject: string }>>(() => {
    return teacher.subjects_taught ?? [];
  });

  const [lvlId, setLvlId] = useState(levels[0]?.id ?? "");
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");

  const filtered = lvlId ? classes.filter((c) => c.level.id === lvlId) : classes;

  useEffect(() => {
    if (filtered.length > 0) setClassId(filtered[0].id);
    else setClassId("");
  }, [lvlId]);

  function add() {
    if (!classId || !subject.trim()) return;
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    const lvlName = levels.find((l) => l.id === lvlId)?.name ?? "";
    const class_name = `${lvlName} ${cls.name}`;
    
    if (list.some((x) => x.class_id === classId && x.subject.toLowerCase() === subject.trim().toLowerCase())) {
      alert("This class and subject assignment already exists.");
      return;
    }

    setList([...list, { class_id: classId, class_name, subject: subject.trim() }]);
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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving");
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
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<SettingsTab>("levels");
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "level" | "class" | "staff">(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);
  const [togglingStaff, setTogglingStaff] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [l, c, s, tList] = await Promise.all([
        structure.levels(),
        structure.classes(),
        user?.role === "ADMIN" ? structure.staff() : Promise.resolve({ success: true, data: [] as StaffMember[] }),
        user?.role === "ADMIN" ? teachers.list() : Promise.resolve({ success: true, data: [] as Teacher[] }),
      ]);
      setLevels(l.data);
      setClasses(c.data);
      setStaff(s.data);
      setTeachersList(tList.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (!authLoading && user) loadAll(); }, [user?.id, authLoading]);

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
    { key: "levels", label: "Levels", icon: Layers },
    { key: "classes", label: "Classes", icon: BookOpen },
    ...(user?.role === "ADMIN" ? [
      { key: "staff" as SettingsTab, label: "Staff & Roles", icon: Users },
      { key: "teachers" as SettingsTab, label: "Teacher Assignments", icon: Users }
    ] : []),
  ];

  return (
    <DashboardShell>
      {modal === "level" && <CreateLevelModal onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "class" && <CreateClassModal levels={levels} onClose={() => setModal(null)} onSuccess={loadAll} />}
      {modal === "staff" && <CreateStaffModal onClose={() => setModal(null)} onSuccess={loadAll} />}
      {assignTeacher && (
        <AssignClassesModal
          teacher={assignTeacher}
          classes={classes}
          levels={levels}
          onClose={() => setAssignTeacher(null)}
          onSuccess={loadAll}
        />
      )}

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Settings</h1>
            <p className="text-sm text-gray-400">Manage school structure and staff access</p>
          </div>
          <button
            onClick={() => setModal(tab === "levels" ? "level" : tab === "classes" ? "class" : "staff")}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <Plus size={16} />
            {tab === "levels" ? "Add Level" : tab === "classes" ? "Add Class" : "Add Staff"}
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === key ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-600" size={28} /></div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* LEVELS */}
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

            {/* CLASSES */}
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

            {/* STAFF */}
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

            {/* TEACHERS */}
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
