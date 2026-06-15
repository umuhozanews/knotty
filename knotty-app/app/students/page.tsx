"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, Loader2, CreditCard, User, Trash2, Edit2,
  ChevronRight, Users, AlertCircle, X, Eye, EyeOff
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { students, structure, cards, health, Level, Class, Student } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, photo, size = 9 }: { name: string; photo?: string | null; size?: number }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const hue = (name.charCodeAt(0) * 37 + name.charCodeAt(1) * 13) % 360;
  const cls = `w-${size} h-${size} rounded-full flex-shrink-0`;
  if (photo) return <img src={photo} className={`${cls} object-cover`} alt={initials} />;
  return (
    <div className={`${cls} flex items-center justify-center text-white text-xs font-bold`} style={{ background: `hsl(${hue},60%,52%)` }}>
      {initials}
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
const inp = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100";

// ─── Add / Edit Student Modal ─────────────────────────────────────────────────
interface StudentForm {
  first_name: string; last_name: string; email: string; phone: string;
  password: string; gender: string; level_id: string; class_id: string;
  date_of_birth: string; nationality: string;
  guardian_name: string; guardian_phone: string; guardian_email: string;
  medical_notes: string; initial_balance: string;
  profile_photo: string;
}
const BLANK: StudentForm = {
  first_name: "", last_name: "", email: "", phone: "", password: "Knotty@2024",
  gender: "M", level_id: "", class_id: "", date_of_birth: "", nationality: "Rwandan",
  guardian_name: "", guardian_phone: "", guardian_email: "", medical_notes: "", initial_balance: "",
  profile_photo: "",
};

function StudentModal({
  existing, levels, classes, onClose, onSuccess,
}: {
  existing?: Student | null;
  levels: Level[];
  classes: Class[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const isEdit = !!existing;

  const [form, setForm] = useState<StudentForm>(() => {
    if (existing) {
      return {
        ...BLANK,
        first_name: existing.user.first_name,
        last_name: existing.user.last_name,
        email: existing.user.email,
        phone: existing.user.phone ?? "",
        gender: existing.gender ?? "M",
        level_id: existing.level?.id ?? "",
        class_id: existing.class?.id ?? "",
        date_of_birth: existing.date_of_birth ? existing.date_of_birth.slice(0, 10) : "",
        nationality: existing.nationality ?? "Rwandan",
        profile_photo: existing.user.profile_photo ?? "",
      };
    }
    return { ...BLANK };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [tab, setTab] = useState<"basic" | "guardian" | "medical">("basic");

  useEffect(() => {
    if (isEdit && existing) {
      students.getOne(existing.id).then((res) => {
        const fullStudent = res.data as any;
        if (fullStudent.parent) {
          setForm((f) => ({
            ...f,
            guardian_name: `${fullStudent.parent.first_name} ${fullStudent.parent.last_name}`.trim(),
            guardian_phone: fullStudent.parent.phone ?? "",
          }));
        }
      }).catch(console.error);
    }
  }, [existing, isEdit]);

  const filteredClasses = form.level_id ? classes.filter((c) => c.level.id === form.level_id) : classes;
  const set = (k: keyof StudentForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

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
    if (!form.first_name || !form.last_name || !form.email || !form.class_id || !form.level_id) {
      setError("First name, last name, email, level and class are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isEdit && existing) {
        await students.update(existing.id, {
          first_name: form.first_name, last_name: form.last_name,
          phone: form.phone || undefined,
          gender: form.gender, date_of_birth: form.date_of_birth || undefined,
          nationality: form.nationality || undefined,
          level_id: form.level_id, class_id: form.class_id,
          profile_photo: form.profile_photo || undefined,
          guardian_name: form.guardian_name || undefined,
          guardian_phone: form.guardian_phone || undefined,
        });
        if (form.medical_notes.trim()) {
          await health.create({
            student_id: existing.id, type: "ILLNESS", severity: "LOW",
            title: "Medical Notes", description: form.medical_notes,
          });
        }
        show("Student updated successfully", "success");
      } else {
        // Create student
        const payload: Record<string, unknown> = {
          first_name: form.first_name, last_name: form.last_name,
          email: form.email, phone: form.phone || undefined,
          password: form.password || undefined, gender: form.gender,
          level_id: form.level_id, class_id: form.class_id,
          date_of_birth: form.date_of_birth || undefined,
          nationality: form.nationality || undefined,
          profile_photo: form.profile_photo || undefined,
          guardian_name: form.guardian_name || undefined,
          guardian_phone: form.guardian_phone || undefined,
        };

        const created = await students.create(payload);
        const studentId = created.data.id;

        // Auto-issue card
        try {
          const cardRes = await cards.issue(studentId);
          const cardId = (cardRes.data as { id: string }).id;

          // Top up initial balance
          const bal = parseInt(form.initial_balance, 10);
          if (bal > 0) {
            await cards.topUpCash(cardId, bal);
          }
        } catch {
          // Card may already exist
        }

        // Save medical notes
        if (form.medical_notes.trim()) {
          await health.create({
            student_id: studentId, type: "ILLNESS", severity: "LOW",
            title: "Medical Notes (Initial)", description: form.medical_notes,
          });
        }

        show(`${form.first_name} ${form.last_name} enrolled & card issued`, "success");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save student");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              {isEdit ? "Edit Student" : "Enroll New Student"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? "Update student information" : "Fill in details to enroll a new student"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
          {(["basic", "guardian", "medical"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-4 text-xs font-medium border-b-2 transition capitalize -mb-px ${tab === t ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
            >
              {t === "basic" ? "Basic Info" : t === "guardian" ? "Parent/Guardian" : "Medical"}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          <div className="p-6 space-y-4">
            {tab === "basic" && (
              <>
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
                    </div>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" required><input required value={form.first_name} onChange={set("first_name")} className={inp} placeholder="e.g. Ange" /></Field>
                  <Field label="Last Name" required><input required value={form.last_name} onChange={set("last_name")} className={inp} placeholder="e.g. Uwimana" /></Field>
                </div>
                <Field label="Email Address" required>
                  <input type="text" required value={form.email} onChange={set("email")} className={inp} placeholder="student@school.rw" disabled={isEdit} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone">
                    <input value={form.phone} onChange={set("phone")} className={inp} placeholder="+250 7XX XXX XXX" />
                  </Field>
                  <Field label="Gender" required>
                    <select value={form.gender} onChange={set("gender")} className={inp}>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date of Birth">
                    <input type="date" value={form.date_of_birth} onChange={set("date_of_birth")} className={inp} />
                  </Field>
                  <Field label="Nationality">
                    <input value={form.nationality} onChange={set("nationality")} className={inp} placeholder="Rwandan" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Level" required>
                    <select value={form.level_id} onChange={(e) => setForm((f) => ({ ...f, level_id: e.target.value, class_id: "" }))} className={inp}>
                      <option value="">Select level</option>
                      {levels.sort((a,b)=>(a.name>b.name?1:-1)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Class" required>
                    <select value={form.class_id} onChange={set("class_id")} className={inp}>
                      <option value="">Select class</option>
                      {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                </div>
                {!isEdit && (
                  <div className="grid grid-cols-2 gap-3">
                    {user?.role !== "TEACHER" ? (
                      <>
                        <Field label="Initial Wallet Balance (RWF)">
                          <input type="number" min="0" value={form.initial_balance} onChange={set("initial_balance")} className={inp} placeholder="0" />
                        </Field>
                        <Field label="Login Password">
                          <div className="relative">
                            <input type={showPass ? "text" : "password"} value={form.password} onChange={set("password")} className={`${inp} pr-10`} />
                            <button type="button" onClick={() => setShowPass((p) => !p)} className="absolute right-3 top-2 text-gray-400">
                              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </Field>
                      </>
                    ) : (
                      <div className="col-span-2">
                        <Field label="Login Password">
                          <div className="relative">
                            <input type={showPass ? "text" : "password"} value={form.password} onChange={set("password")} className={`${inp} pr-10`} />
                            <button type="button" onClick={() => setShowPass((p) => !p)} className="absolute right-3 top-2 text-gray-400">
                              {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </Field>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {tab === "guardian" && (
              <>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-xs text-blue-600 dark:text-blue-400">
                  A parent account will be created automatically. Parents will use the student credentials to log in.
                </div>
                <Field label="Guardian Full Name">
                  <input value={form.guardian_name} onChange={set("guardian_name")} className={inp} placeholder="e.g. Jean Baptiste Nkusi" />
                </Field>
                <Field label="Guardian Phone">
                  <input value={form.guardian_phone} onChange={set("guardian_phone")} className={inp} placeholder="+250 7XX XXX XXX" />
                </Field>
              </>
            )}

            {tab === "medical" && (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400">
                  Medical notes will be saved as a health record. You can add more conditions from the student profile.
                </div>
                <Field label="Medical Conditions / Notes">
                  <textarea
                    value={form.medical_notes}
                    onChange={set("medical_notes")}
                    rows={5}
                    className={`${inp} resize-none`}
                    placeholder="e.g. Asthmatic, allergic to penicillin, requires inhaler..."
                  />
                </Field>
              </>
            )}
          </div>

          {error && (
            <div className="mx-6 mb-4 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 p-6 pt-0">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-sm text-white font-medium hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {loading ? "Saving…" : isEdit ? "Save Changes" : "Enroll Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ student, onClose, onConfirm, loading }: { student: Student; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const name = `${student.user.first_name} ${student.user.last_name}`;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={20} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100">Remove Student?</h3>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{name}</strong> will be deactivated. Their records will be preserved.
            </p>
          </div>
          <div className="flex gap-3 w-full mt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm text-white font-medium hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────
function StudentRow({ s, idx, onEdit, onDelete, onIssue, issuing, isClassTeacher }: {
  s: Student; idx: number;
  onEdit: () => void; onDelete: () => void;
  onIssue: () => void; issuing: boolean;
  isClassTeacher: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const name = `${s.user.first_name} ${s.user.last_name}`;
  const dob = s.date_of_birth ? new Date(s.date_of_birth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition group cursor-pointer"
      onClick={() => router.push(`/students/${s.id}`)}>
      <Avatar name={name} photo={s.user.profile_photo} size={10} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{name}</p>
          {s.gender && <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${s.gender === "M" ? "bg-blue-50 text-blue-500" : "bg-pink-50 text-pink-500"}`}>{s.gender === "M" ? "M" : "F"}</span>}
        </div>
        <p className="text-xs text-gray-400 font-mono">{s.student_code}{age ? ` · ${age}y` : ""}</p>
        {user?.role !== "TEACHER" && (
          s.card ? (
            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 sm:hidden">
              Balance: {s.card.wallet_balance.toLocaleString()} RWF
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5 sm:hidden">No card</p>
          )
        )}
      </div>
      <div className="hidden sm:block text-right min-w-0">
        {s.card && (
          <p className={`text-xs ${s.card.is_frozen ? "text-amber-500" : s.card.is_active ? "text-green-500" : "text-red-400"}`}>
            {s.card.is_frozen ? "Frozen" : s.card.is_active ? "Active" : "Inactive"}
          </p>
        )}
        {user?.role !== "TEACHER" ? (
          s.card ? (
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {s.card.wallet_balance.toLocaleString()} <span className="text-[10px] font-normal text-blue-500/70 dark:text-blue-400/70">RWF</span>
            </p>
          ) : <p className="text-xs text-gray-300">No card</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
        {!s.card && user?.role !== "TEACHER" && (
          <button onClick={onIssue} disabled={issuing} title="Issue Card"
            className="p-1.5 rounded-lg border border-blue-500 text-blue-600 hover:bg-blue-50 transition text-xs flex items-center gap-1">
            {issuing ? <Loader2 size={11} className="animate-spin" /> : <CreditCard size={11} />}
          </button>
        )}
        {(user?.role === "ADMIN" || (user?.role === "TEACHER" && isClassTeacher)) && (
          <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition">
            <Edit2 size={12} />
          </button>
        )}
        {(user?.role === "ADMIN" || (user?.role === "TEACHER" && isClassTeacher)) && (
          <button onClick={onDelete} title="Remove" className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition">
            <Trash2 size={12} />
          </button>
        )}
        <button onClick={() => router.push(`/students/${s.id}`)} title="Profile" className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition">
          <User size={12} />
        </button>
      </div>
      <ChevronRight size={14} className="text-gray-300 flex-shrink-0 opacity-0 group-hover:opacity-100 transition" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { show } = useToast();
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({});
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [issuing, setIssuing] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load levels and classes
  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([structure.levels(), structure.classes()]).then(([lvls, clss]) => {
      const sorted = [...lvls.data].sort((a, b) => a.name.localeCompare(b.name));
      setLevels(sorted);
      setClasses(clss.data);
      if (sorted.length > 0) {
        setSelectedLevel(sorted[0].id);
        const firstClass = clss.data.find((c) => c.level.id === sorted[0].id);
        if (firstClass) setSelectedClass(firstClass.id);
      }
    }).catch(console.error);
  }, [user?.id, authLoading]);

  // Load students for selected class
  const loadStudents = useCallback(async (classId: string | null) => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await students.list({ classId, limit: 100, search: search || undefined });
      setStudentsByClass((prev) => ({ ...prev, [classId]: res.data }));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => loadStudents(selectedClass), 300);
  }, [selectedClass, search, loadStudents]);

  const currentClassStudents = selectedClass ? (studentsByClass[selectedClass] ?? []) : [];
  const currentLevelClasses = selectedLevel ? classes.filter((c) => c.level.id === selectedLevel) : [];
  const selectedClassObj = classes.find((c) => c.id === selectedClass);
  const isClassTeacher = !selectedClassObj || user?.role !== 'TEACHER' || selectedClassObj.class_teacher_id === user?.id;
  const totalSelected = classes.reduce((acc, c) => {
    const n = studentsByClass[c.id]?.length ?? (c._count?.students ?? 0);
    return acc + n;
  }, 0);

  async function handleIssue(studentId: string) {
    setIssuing(studentId);
    try {
      await cards.issue(studentId);
      show("Card issued successfully", "success");
      loadStudents(selectedClass);
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to issue card", "error");
    } finally {
      setIssuing(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await students.remove(deleteTarget.id);
      show(`${deleteTarget.user.first_name} removed`, "success");
      setDeleteTarget(null);
      loadStudents(selectedClass);
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to remove", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <DashboardShell>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── Left Sidebar ─────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto">
          <div className="p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Classes</h2>
            {levels.map((level) => {
              const levelClasses = classes.filter((c) => c.level.id === level.id);
              const isLevelOpen = selectedLevel === level.id;
              return (
                <div key={level.id} className="mb-1">
                  <button
                    onClick={() => {
                      setSelectedLevel(level.id);
                      if (levelClasses.length > 0 && selectedLevel !== level.id) {
                        setSelectedClass(levelClasses[0].id);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-semibold transition ${isLevelOpen ? "bg-blue-600/10 text-blue-700" : "text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-400"}`}
                  >
                    <span>{level.name}</span>
                    <span className={`text-xs font-normal ${isLevelOpen ? "text-blue-600/70" : "text-gray-400"}`}>
                      {level._count?.students ?? 0}
                    </span>
                  </button>
                  {isLevelOpen && levelClasses.map((cls) => (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls.id)}
                      className={`w-full flex items-center justify-between pl-6 pr-3 py-1.5 rounded-xl text-xs transition ${selectedClass === cls.id ? "bg-blue-600 text-white font-medium" : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                    >
                      <span>Class {cls.name}</span>
                      <span className={`${selectedClass === cls.id ? "text-white/80" : "text-gray-400"}`}>
                        {studentsByClass[cls.id]?.length ?? cls._count?.students ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main Content ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex-1">
              {selectedClass && (
                <div>
                  <h1 className="text-base font-bold text-gray-800 dark:text-gray-100">
                    {levels.find((l) => l.id === selectedLevel)?.name} — Class {classes.find((c) => c.id === selectedClass)?.name}
                  </h1>
                  <p className="text-xs text-gray-400">{currentClassStudents.length} students</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 min-w-48">
              <Search size={13} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students…"
                className="bg-transparent text-sm outline-none flex-1 text-gray-700 dark:text-gray-200"
              />
            </div>
            {isClassTeacher && (
              <button
                onClick={() => { setEditStudent(null); setShowModal(true); }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
              >
                <Plus size={15} /> Add Student
              </button>
            )}
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
            ) : !selectedClass ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-400 text-sm">Select a class from the sidebar</p>
              </div>
            ) : currentClassStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-600 dark:text-gray-300 font-medium">No students in this class</p>
                <p className="text-sm text-gray-400 mt-1">
                  {isClassTeacher ? 'Click "Add Student" to enroll the first student.' : 'Contact the class teacher or admin to enroll students.'}
                </p>
                {isClassTeacher && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="mt-4 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
                  >
                    <Plus size={14} /> Enroll First Student
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {currentClassStudents.map((s, i) => (
                  <StudentRow
                    key={s.id} s={s} idx={i}
                    onEdit={() => { setEditStudent(s); setShowModal(true); }}
                    onDelete={() => setDeleteTarget(s)}
                    onIssue={() => handleIssue(s.id)}
                    issuing={issuing === s.id}
                    isClassTeacher={isClassTeacher}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 flex items-center gap-4 text-xs text-gray-400">
            <span>{levels.length} levels · {classes.length} classes</span>
            <span>·</span>
            <span>{totalSelected} total students</span>
            {selectedClass && <span>· {currentClassStudents.filter((s) => s.card?.is_active).length} with active cards</span>}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <StudentModal
          existing={editStudent}
          levels={levels}
          classes={classes}
          onClose={() => { setShowModal(false); setEditStudent(null); }}
          onSuccess={() => loadStudents(selectedClass)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          student={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </DashboardShell>
  );
}
