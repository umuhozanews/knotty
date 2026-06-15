"use client";
import { useEffect, useState } from "react";
import { Loader2, Plus, Calendar, Clock, BookOpen, Users, Check, Trash2, Edit, CheckCircle, AlertCircle, FileText, UserCheck, Settings } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { academics, structure, students, StudentBase, ClassSection, TimetableEntry, Exam, AcademicTerm, Program, ExamResult, GradingScale } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AcademicsPage() {
  const { user, loading: authLoading } = useAuth();
  const role = user?.role ?? "STUDENT";
  const isAdmin = role === "ADMIN";
  const isTeacher = role === "TEACHER";
  const isStaff = isAdmin || isTeacher;

  // State
  const [activeTab, setActiveTab] = useState<"terms" | "sections" | "timetable" | "exams" | "grading">("sections");
  const [loading, setLoading] = useState(true);

  // Data
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradingScale, setGradingScale] = useState<GradingScale | null>(null);

  // Form toggles / Modals
  const [showTermModal, setShowTermModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showTimetableModal, setShowTimetableModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState<ClassSection | null>(null);

  // Grading manager
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [recordScores, setRecordScores] = useState<Record<string, string>>({});
  const [savingResults, setSavingResults] = useState(false);

  // Form fields
  const [termForm, setTermForm] = useState({ name: "", start_date: "", end_date: "" });
  const [progForm, setProgForm] = useState({ name: "" });
  const [sectionForm, setSectionForm] = useState({ name: "", program_id: "", academic_term_id: "", homeroom_staff_id: "", capacity: "40" });
  const [ttForm, setTtForm] = useState({ class_section_id: "", subject_id: "", staff_id: "", day_of_week: "1", start_time: "08:30", end_time: "09:30", room: "" });
  const [examForm, setExamForm] = useState({ name: "", subject_id: "", academic_term_id: "", exam_date: "", max_score: "100" });
  const [enrollForm, setEnrollForm] = useState({ student_id: "", class_section_id: "", academic_term_id: "" });

  // Options for dropdowns
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<StudentBase[]>([]);

  useEffect(() => {
    if (!authLoading) {
      loadData();
    }
  }, [authLoading, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "terms") {
        const r = await academics.terms();
        setTerms(r.data);
      } else if (activeTab === "sections") {
        const [rS, rP, rT] = await Promise.all([
          academics.sections(),
          academics.programs(),
          academics.terms(),
        ]);
        setSections(rS.data);
        setPrograms(rP.data);
        setTerms(rT.data);

        // Load staff list for homeroom teachers
        const staffRes = await structure.staff();
        setTeachersList(staffRes.data.filter((s) => s.role === "TEACHER" || s.role === "ADMIN"));
      } else if (activeTab === "timetable") {
        const [rS, rT, rSect] = await Promise.all([
          academics.timetable(),
          structure.staff(), // For teachers
          academics.sections(),
        ]);
        setTimetable(rS.data);
        setTeachersList(rT.data.filter((s) => s.role === "TEACHER" || s.role === "ADMIN"));
        setSections(rSect.data);

        // Fetch subjects
        setSubjects([
          { id: "sub-math", name: "Mathematics", code: "MATH" },
          { id: "sub-phy", name: "Physics", code: "PHYS" },
          { id: "sub-chem", name: "Chemistry", code: "CHEM" },
          { id: "sub-bio", name: "Biology", code: "BIOL" },
          { id: "sub-eng", name: "English", code: "ENGL" },
        ]);
      } else if (activeTab === "exams") {
        const [rE, rT, rSect] = await Promise.all([
          academics.exams(),
          academics.terms(),
          academics.sections(),
        ]);
        setExams(rE.data);
        setTerms(rT.data);
        setSections(rSect.data);
        setSubjects([
          { id: "sub-math", name: "Mathematics", code: "MATH" },
          { id: "sub-phy", name: "Physics", code: "PHYS" },
          { id: "sub-chem", name: "Chemistry", code: "CHEM" },
          { id: "sub-bio", name: "Biology", code: "BIOL" },
          { id: "sub-eng", name: "English", code: "ENGL" },
        ]);
      } else if (activeTab === "grading") {
        const rG = await academics.gradingScale();
        setGradingScale(rG.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Handle creations
  async function handleCreateTerm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.createTerm(termForm);
      setTermForm({ name: "", start_date: "", end_date: "" });
      setShowTermModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.createProgram(progForm);
      setProgForm({ name: "" });
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleCreateSection(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.createSection({
        ...sectionForm,
        capacity: Number(sectionForm.capacity),
      });
      setSectionForm({ name: "", program_id: "", academic_term_id: "", homeroom_staff_id: "", capacity: "40" });
      setShowSectionModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleCreateTimetable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.createTimetableEntry({
        ...ttForm,
        day_of_week: Number(ttForm.day_of_week),
      });
      setShowTimetableModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.createExam({
        ...examForm,
        max_score: Number(examForm.max_score),
      });
      setShowExamModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    try {
      await academics.enroll(enrollForm);
      setShowEnrollModal(false);
      loadData();
    } catch (err) { alert(err instanceof Error ? err.message : "Error"); }
  }

  async function openSectionDetails(sect: ClassSection) {
    setSelectedSection(null);
    try {
      const res = await academics.sectionDetails(sect.id);
      setSelectedSection(res.data);
    } catch (err) {
      alert("Error loading section details");
    }
  }

  // Load students search for enrollment
  useEffect(() => {
    if (showEnrollModal) {
      students.list({ limit: 100 }).then((r) => setAllStudents(r.data));
    }
  }, [showEnrollModal]);

  // Record exam grades manager
  async function selectExamForGrading(exam: Exam) {
    setActiveExam(exam);
    setRecordScores({});
    try {
      const resultsRes = await academics.examResults(exam.id);
      setExamResults(resultsRes.data);

      // Populate scores object
      const scores: Record<string, string> = {};
      resultsRes.data.forEach((r) => {
        scores[r.student_id] = String(r.score);
      });
      setRecordScores(scores);

      if (sections.length > 0) {
        const classSect = sections[0]; // fallback
        const details = await academics.sectionDetails(classSect.id);
        setSelectedSection(details.data);
      }
    } catch (err) {
      alert("Error loading exam results");
    }
  }

  async function saveGrades() {
    if (!activeExam) return;
    setSavingResults(true);
    try {
      const resultsPayload = Object.entries(recordScores).map(([student_id, scoreStr]) => ({
        student_id,
        score: parseFloat(scoreStr),
      }));

      await academics.recordResults(activeExam.id, resultsPayload);
      alert("Exam results saved and auto-graded!");
      setActiveExam(null);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving grades");
    } finally {
      setSavingResults(false);
    }
  }

  async function approveResult(resId: string) {
    try {
      await academics.approveResult(resId);
      alert("Grade approved successfully!");
      if (activeExam) selectExamForGrading(activeExam);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error approving grade");
    }
  }

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <DashboardShell>
      <div className="p-4 space-y-4">
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          
          /* Precision Design System overrides */
          .p-4.space-y-4 {
            padding: 24px !important;
            background-color: #fcf9f8 !important;
            font-family: 'Plus Jakarta Sans', sans-serif !important;
            min-height: 100vh;
          }
          
          .bg-white {
            background-color: #ffffff !important;
            border: 1px solid #dcd9d9 !important;
            border-radius: 8px !important;
            box-shadow: none !important;
          }
          
          .rounded-xl, .rounded-2xl, .rounded-3xl {
            border-radius: 8px !important;
          }
          
          .bg-indigo-600, .bg-indigo-500, .bg-blue-600, .bg-blue-500, .bg-green-600, .bg-teal-500 {
            background-color: #121212 !important;
            color: #ffffff !important;
            border-radius: 8px !important;
            border: 1px solid #121212 !important;
          }
          .bg-indigo-600:hover, .bg-indigo-500:hover, .bg-blue-600:hover, .bg-blue-500:hover, .bg-green-600:hover, .bg-teal-500:hover {
            background-color: #d9ff8c !important;
            color: #121212 !important;
            border-color: #d9ff8c !important;
          }
          
          .text-indigo-600, .text-blue-600, .text-indigo-500 {
            color: #121212 !important;
          }
          .border-indigo-600, .border-blue-600, .border-indigo-500 {
            border-color: #121212 !important;
          }
          
          .border-indigo-600.text-indigo-600 {
            border-color: #121212 !important;
            color: #121212 !important;
            font-weight: 800 !important;
          }
          
          .bg-gray-50 {
            background-color: #fcf9f8 !important;
            border-bottom: 1px solid #dcd9d9 !important;
          }
          
          .hover\\:shadow-md:hover, .hover\\:shadow-lg:hover {
            border-color: #d9ff8c !important;
            box-shadow: none !important;
          }
        ` }} />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Academics Portal</h1>
            <p className="text-sm text-gray-400">Manage terms, class sections, timetables, exams, and auto-grading</p>
          </div>
          {isAdmin && activeTab === "sections" && (
            <div className="flex gap-2">
              <button onClick={() => setShowEnrollModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                <UserCheck size={16} /> Enroll Student
              </button>
              <button onClick={() => setShowSectionModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
                <Plus size={16} /> New Class Section
              </button>
            </div>
          )}
          {isAdmin && activeTab === "terms" && (
            <button onClick={() => setShowTermModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} /> New Academic Term
            </button>
          )}
          {isAdmin && activeTab === "timetable" && (
            <button onClick={() => setShowTimetableModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} /> Schedule Slot
            </button>
          )}
          {isStaff && activeTab === "exams" && !activeExam && (
            <button onClick={() => setShowExamModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition">
              <Plus size={16} /> Create Exam
            </button>
          )}
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-100 gap-2">
          {[
            { id: "sections", label: "Class Sections & Programs", icon: Users },
            { id: "timetable", label: "Timetable Scheduler", icon: Clock },
            { id: "exams", label: "Examinations & Grading", icon: FileText },
            { id: "terms", label: "Academic Terms", icon: Calendar },
            { id: "grading", label: "Grading Scales", icon: Settings },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => { setActiveTab(t.id as any); setActiveExam(null); setSelectedSection(null); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all
                  ${active ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-indigo-600" size={32} /></div>
        ) : (
          <div className="space-y-4">
            
            {/* TABS 1: TERMS */}
            {activeTab === "terms" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800">Academic Terms Calendar</h3>
                  <div className="overflow-hidden border border-gray-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                          <th className="p-4">Term Name</th>
                          <th className="p-4">Start Date</th>
                          <th className="p-4">End Date</th>
                          <th className="p-4">Status</th>
                          {isAdmin && <th className="p-4 text-center">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {terms.map((t) => {
                          const isCurrent = new Date() >= new Date(t.start_date) && new Date() <= new Date(t.end_date);
                          return (
                            <tr key={t.id} className="hover:bg-gray-50/50">
                              <td className="p-4 font-semibold text-gray-700">{t.name}</td>
                              <td className="p-4 text-gray-500">{new Date(t.start_date).toLocaleDateString()}</td>
                              <td className="p-4 text-gray-500">{new Date(t.end_date).toLocaleDateString()}</td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                  ${isCurrent ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}
                                >
                                  {isCurrent ? "Active Term" : "Inactive"}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="p-4 flex justify-center gap-2">
                                  <button onClick={async () => {
                                    if (confirm("Delete this academic term?")) {
                                      await academics.deleteTerm(t.id);
                                      loadData();
                                    }
                                  }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition">
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800">Academic Programs</h3>
                  <form onSubmit={handleCreateProgram} className="flex gap-2">
                    <input required value={progForm.name} onChange={(e) => setProgForm({ name: e.target.value })}
                      placeholder="e.g. Senior 5, Grade 10" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                    <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">Add</button>
                  </form>
                  <div className="space-y-2">
                    {programs.map((p) => (
                      <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                        <span className="text-sm font-semibold text-gray-700">{p.name}</span>
                        {isAdmin && (
                          <button onClick={async () => {
                            if (confirm("Delete this program?")) {
                              await academics.deleteProgram(p.id);
                              loadData();
                            }
                          }} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TABS 2: CLASS SECTIONS */}
            {activeTab === "sections" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`${selectedSection ? "md:col-span-2" : "md:col-span-3"} bg-white rounded-3xl p-6 shadow-sm space-y-4`}>
                  <h3 className="font-bold text-gray-800">Current Class Sections</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sections.map((sect) => (
                      <div key={sect.id} onClick={() => openSectionDetails(sect)}
                        className={`p-4 rounded-2xl border cursor-pointer hover:shadow-md transition text-left space-y-2
                          ${selectedSection?.id === sect.id ? "border-indigo-600 bg-indigo-50/20" : "border-gray-100 bg-white"}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-lg font-bold text-gray-800">{sect.name}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sect.program?.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">Term: {sect.term?.name}</p>
                        <p className="text-xs text-gray-600">Homeroom: {sect.homeroom_teacher ? `${sect.homeroom_teacher.first_name} ${sect.homeroom_teacher.last_name}` : "None"}</p>
                        <div className="flex justify-between items-center text-xs text-indigo-600 font-semibold pt-1">
                          <span>Capacity: {sect.capacity ?? "N/A"}</span>
                          <span>Enrolled: {sect._count?.enrollments || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedSection && (
                  <div className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-800">Section details: {selectedSection.name}</h3>
                        <p className="text-xs text-gray-400">Total Enrolled: {selectedSection.enrollments?.length ?? 0} students</p>
                      </div>
                      <button onClick={() => setSelectedSection(null)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Enrolled Register</h4>
                      {selectedSection.enrollments?.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No students enrolled yet.</p>
                      ) : (
                        selectedSection.enrollments?.map((e: any) => (
                          <div key={e.id} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                            <div>
                              <p className="text-sm font-semibold text-gray-700">{e.student.user.first_name} {e.student.user.last_name}</p>
                              <p className="text-xs text-gray-400">{e.student.student_code}</p>
                            </div>
                            {isAdmin && (
                              <button onClick={async () => {
                                if (confirm("Withdraw student from this section?")) {
                                  await academics.unenroll(e.id);
                                  openSectionDetails(selectedSection);
                                }
                              }} className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TABS 3: TIMETABLE */}
            {activeTab === "timetable" && (() => {
              const getTodayDayOfWeek = () => {
                const day = new Date().getDay(); // 0-6 (Sun-Sat)
                return day === 0 ? 7 : day; // map Sunday to 7
              };

              const isSlotLiveNow = (slotDay: number, startTime: string, endTime: string) => {
                const today = getTodayDayOfWeek();
                if (slotDay !== today) return false;

                const now = new Date();
                const currentHours = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTotalMinutes = currentHours * 60 + currentMinutes;

                const [startH, startM] = startTime.split(":").map(Number);
                const startTotalMinutes = startH * 60 + startM;

                const [endH, endM] = endTime.split(":").map(Number);
                const endTotalMinutes = endH * 60 + endM;

                return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
              };

              const DAY_COLORS: Record<number, { bg: string; text: string; accent: string; badgeBg: string; badgeText: string }> = {
                1: { bg: "bg-[#b51822]/5", text: "text-[#b51822]", accent: "#b51822", badgeBg: "bg-[#b51822]/10", badgeText: "text-[#b51822]" }, // Monday (Coral Red)
                2: { bg: "bg-[#0d9488]/5", text: "text-[#0d9488]", accent: "#0d9488", badgeBg: "bg-[#0d9488]/10", badgeText: "text-[#0d9488]" }, // Tuesday (Teal)
                3: { bg: "bg-[#d97706]/5", text: "text-[#d97706]", accent: "#d97706", badgeBg: "bg-[#d97706]/10", badgeText: "text-[#d97706]" }, // Wednesday (Gold)
                4: { bg: "bg-[#0284c7]/5", text: "text-[#0284c7]", accent: "#0284c7", badgeBg: "bg-[#0284c7]/10", badgeText: "text-[#0284c7]" }, // Thursday (Sky Blue)
                5: { bg: "bg-[#64748b]/5", text: "text-[#64748b]", accent: "#64748b", badgeBg: "bg-[#64748b]/10", badgeText: "text-[#64748b]" }, // Friday (Steel Gray)
                6: { bg: "bg-[#f43f5e]/5", text: "text-[#f43f5e]", accent: "#f43f5e", badgeBg: "bg-[#f43f5e]/10", badgeText: "text-[#f43f5e]" }, // Saturday (Soft Peach)
                7: { bg: "bg-[#a855f7]/5", text: "text-[#a855f7]", accent: "#a855f7", badgeBg: "bg-[#a855f7]/10", badgeText: "text-[#a855f7]" }, // Sunday (Purple)
              };

              const todayDay = getTodayDayOfWeek();

              return (
                <div className="bg-[#f7fafc] rounded-3xl p-6 shadow-sm space-y-6 border border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-gray-800 text-base">Timetable Scheduler</h3>
                      <p className="text-xs text-gray-400">Color-coded daily planner and live class indicator</p>
                    </div>
                    {/* Live indicator details */}
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-white border border-gray-250 px-3.5 py-1.5 rounded-xl">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse inline-block" />
                      Live Now classes are highlighted
                    </div>
                  </div>

                  {/* Day Headers (Active solid, Inactive ghost-like) */}
                  <div className="grid grid-cols-7 gap-2">
                    {daysOfWeek.map((day, dIndex) => {
                      const dayIndex = dIndex + 1;
                      const isToday = dayIndex === todayDay;
                      const colorInfo = DAY_COLORS[dayIndex];
                      
                      return (
                        <div key={day} 
                          className={`text-center py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all
                            ${isToday 
                              ? `bg-[${colorInfo.accent}] text-white border-[${colorInfo.accent}] shadow-sm` 
                              : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50"}`}
                          style={isToday ? { backgroundColor: colorInfo.accent, borderColor: colorInfo.accent } : {}}
                        >
                          {day.substring(0, 3)}
                          {isToday && <span className="block text-[8px] font-extrabold mt-0.5 text-white/95">Today</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Timetable Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    {daysOfWeek.map((day, dIndex) => {
                      const dayIndex = dIndex + 1;
                      const slots = timetable.filter((slot) => slot.day_of_week === dayIndex);
                      const colorInfo = DAY_COLORS[dayIndex];
                      const isToday = dayIndex === todayDay;

                      return (
                        <div key={day} 
                          className={`rounded-2xl p-3 space-y-3 min-h-[350px] transition-all border
                            ${isToday ? "bg-white border-[#ebeef0] shadow-md shadow-gray-100/30 ring-1 ring-gray-100/50" : "bg-[#ebeef0]/40 border-gray-100/80"}`}
                        >
                          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest text-center border-b border-gray-200/50 pb-2 mb-1">{day}</p>
                          
                          {slots.length === 0 ? (
                            <div className="flex flex-col items-center justify-center pt-12 text-gray-300">
                              <BookOpen size={20} className="stroke-[1.5] opacity-50 mb-1" />
                              <p className="text-[10px] italic">No Sessions</p>
                            </div>
                          ) : (
                            slots.map((s) => {
                              const isLive = isSlotLiveNow(dayIndex, s.start_time, s.end_time);
                              const isLab = s.room?.toLowerCase().includes("lab");
                              
                              return (
                                <div key={s.id} 
                                  className={`p-3 bg-white border rounded-lg text-left space-y-2 relative group transition-all duration-200 hover:shadow-md
                                    ${isLive ? "border-red-500 shadow-sm ring-1 ring-red-400/50 scale-[1.02]" : "border-gray-200/70"}`}
                                  style={{ borderLeftWidth: "4px", borderLeftColor: colorInfo.accent }}
                                >
                                  {isLive && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-bounce uppercase shadow-sm">
                                      <span className="w-1 h-1 rounded-full bg-white animate-ping" /> Live
                                    </span>
                                  )}

                                  <div>
                                    <p className="text-xs font-bold text-gray-800 leading-tight tracking-tight">{s.subject?.name}</p>
                                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{s.class_section?.name}</p>
                                  </div>

                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600">
                                    <Clock size={11} className="text-gray-400" />
                                    <span>{s.start_time} - {s.end_time}</span>
                                  </div>

                                  <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-gray-50">
                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider truncate max-w-[80px]">Rm: {s.room || "N/A"}</span>
                                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider
                                      ${isLab ? "bg-teal-50 text-teal-700 border border-teal-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`}
                                    >
                                      {isLab ? "Lab" : "Lecture"}
                                    </span>
                                  </div>

                                  {isAdmin && (
                                    <button onClick={async () => {
                                      if (confirm("Delete this scheduled slot?")) {
                                        await academics.deleteTimetableEntry(s.id);
                                        loadData();
                                      }
                                    }} className="absolute -bottom-1 -right-1 p-1 text-red-500 bg-white border border-gray-100 shadow-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* TABS 4: EXAMS & RESULTS */}
            {activeTab === "exams" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 bg-white rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-800">Upcoming & Past Examinations</h3>
                  <div className="overflow-hidden border border-gray-100 rounded-2xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                          <th className="p-4">Exam Name</th>
                          <th className="p-4">Subject</th>
                          <th className="p-4">Term</th>
                          <th className="p-4">Max Score</th>
                          <th className="p-4">Exam Date</th>
                          <th className="p-4 text-center">Grades</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-sm">
                        {exams.map((exam) => (
                          <tr key={exam.id} className="hover:bg-gray-50/50">
                            <td className="p-4 font-semibold text-gray-700">{exam.name}</td>
                            <td className="p-4 text-gray-600">{exam.subject?.name}</td>
                            <td className="p-4 text-gray-500">{exam.term?.name}</td>
                            <td className="p-4 font-medium text-indigo-600">{exam.max_score} pts</td>
                            <td className="p-4 text-gray-500">{new Date(exam.exam_date).toLocaleDateString()}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => selectExamForGrading(exam)}
                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1 rounded-full text-xs font-semibold transition"
                              >
                                Manage Grades
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm space-y-4">
                  {activeExam ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-start border-b border-gray-100 pb-2">
                        <div>
                          <h3 className="font-bold text-indigo-700">{activeExam.name}</h3>
                          <p className="text-xs text-gray-500">Max Marks: {activeExam.max_score} pts · Subject: {activeExam.subject?.name}</p>
                        </div>
                        <button onClick={() => setActiveExam(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>

                      <div className="space-y-3 overflow-y-auto max-h-[380px] pr-1">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Enter Student Scores</h4>
                        {allStudents.map((st) => (
                          <div key={st.id} className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-xl">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-700 leading-tight">{st.user.first_name} {st.user.last_name}</p>
                              <p className="text-[10px] text-gray-400">{st.student_code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" min={0} max={activeExam.max_score} placeholder="Score"
                                value={recordScores[st.id] || ""}
                                onChange={(e) => setRecordScores({ ...recordScores, [st.id]: e.target.value })}
                                className="w-16 border border-gray-200 rounded-xl px-2 py-1 text-sm text-center outline-none focus:border-indigo-500" />
                              <span className="text-xs text-gray-400 font-semibold">/ {activeExam.max_score}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button onClick={saveGrades} disabled={savingResults}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-60"
                      >
                        {savingResults ? <Loader2 size={16} className="animate-spin" /> : "Save & Autograde"}
                      </button>

                      {/* Approvals check */}
                      {examResults.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                          <h4 className="text-xs font-bold text-gray-500 uppercase">Graded Scores & Approvals</h4>
                          <div className="space-y-1.5 text-xs max-h-[200px] overflow-y-auto pr-1">
                            {examResults.map((res) => (
                              <div key={res.id} className="flex justify-between items-center p-2 bg-indigo-50/50 rounded-xl">
                                <span className="font-semibold text-gray-700">{res.student?.user.first_name} · <strong className="text-indigo-600">{res.score}/{activeExam.max_score} ({res.grade_letter})</strong></span>
                                {res.approved_by ? (
                                  <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={12} /> Approved</span>
                                ) : isAdmin ? (
                                  <button onClick={() => approveResult(res.id)} className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg hover:bg-indigo-700">Approve</button>
                                ) : (
                                  <span className="text-amber-500 font-medium">Pending Approval</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-16 text-gray-400 space-y-2">
                      <AlertCircle size={28} className="mx-auto text-gray-300" />
                      <p className="text-sm">Select an exam to grade or view student grade approvals.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TABS 5: GRADING SCALE */}
            {activeTab === "grading" && (
              <div className="bg-white rounded-3xl p-6 shadow-sm max-w-2xl mx-auto space-y-4">
                <h3 className="font-bold text-gray-800">Grading System Setup</h3>
                {gradingScale ? (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Scale name: <strong>{gradingScale.name}</strong></p>
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase">
                            <th className="p-3">Min Percent</th>
                            <th className="p-3">Max Percent</th>
                            <th className="p-3">Letter Grade</th>
                            <th className="p-3">GPA Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                          {gradingScale.bands.map((b, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="p-3 font-semibold text-gray-700">{b.min}%</td>
                              <td className="p-3 text-gray-600">{b.max}%</td>
                              <td className="p-3 font-bold text-indigo-600">{b.letter}</td>
                              <td className="p-3 text-gray-500">{b.gpa.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-gray-400 space-y-2">
                    <AlertCircle size={28} className="mx-auto text-gray-300" />
                    <p className="text-sm">Default grading scale active (A: 90-100, B: 80-89, C: 70-79, D: 60-69, E: 50-59, F: &lt;50).</p>
                  </div>
                )}
              </div>
            )}
            
          </div>
        )}
      </div>

      {/* Term Modal */}
      {showTermModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Add Academic Term</h3>
            <form onSubmit={handleCreateTerm} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Term Name</label>
                <input required value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  placeholder="e.g. Term 1 2026" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                  <input required type="date" value={termForm.start_date} onChange={(e) => setTermForm({ ...termForm, start_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                  <input required type="date" value={termForm.end_date} onChange={(e) => setTermForm({ ...termForm, end_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTermModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Save Term</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Add Class Section</h3>
            <form onSubmit={handleCreateSection} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Section Name</label>
                <input required value={sectionForm.name} onChange={(e) => setFormFields(e, "name")}
                  placeholder="e.g. 10A, Physics Group" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Program</label>
                  <select required value={sectionForm.program_id} onChange={(e) => setFormFields(e, "program_id")} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select program</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Academic Term</label>
                  <select required value={sectionForm.academic_term_id} onChange={(e) => setFormFields(e, "academic_term_id")} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select term</option>
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Homeroom Teacher</label>
                <select value={sectionForm.homeroom_staff_id} onChange={(e) => setFormFields(e, "homeroom_staff_id")} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">None</option>
                  {teachersList.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Capacity</label>
                <input required type="number" min={1} value={sectionForm.capacity} onChange={(e) => setFormFields(e, "capacity")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSectionModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Save Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timetable Modal */}
      {showTimetableModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Add Timetable Slot</h3>
            <form onSubmit={handleCreateTimetable} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class Section</label>
                  <select required value={ttForm.class_section_id} onChange={(e) => setTtForm({ ...ttForm, class_section_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select section</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                  <select required value={ttForm.subject_id} onChange={(e) => setTtForm({ ...ttForm, subject_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select subject</option>
                    {subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Teacher</label>
                <select required value={ttForm.staff_id} onChange={(e) => setTtForm({ ...ttForm, staff_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">Select teacher</option>
                  {teachersList.map((t) => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Day</label>
                  <select value={ttForm.day_of_week} onChange={(e) => setTtForm({ ...ttForm, day_of_week: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    {daysOfWeek.map((day, idx) => <option key={day} value={idx + 1}>{day}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Time</label>
                  <input required placeholder="08:30" value={ttForm.start_time} onChange={(e) => setTtForm({ ...ttForm, start_time: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">End Time</label>
                  <input required placeholder="09:30" value={ttForm.end_time} onChange={(e) => setTtForm({ ...ttForm, end_time: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Room/Lab Name</label>
                <input value={ttForm.room} onChange={(e) => setTtForm({ ...ttForm, room: e.target.value })}
                  placeholder="e.g. Physics Lab, Rm 102" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTimetableModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Save Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam Modal */}
      {showExamModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Add Examination</h3>
            <form onSubmit={handleCreateExam} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Exam Title</label>
                <input required value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  placeholder="e.g. Mid-Term Physics Exam" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Subject</label>
                  <select required value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Academic Term</label>
                  <select required value={examForm.academic_term_id} onChange={(e) => setExamForm({ ...examForm, academic_term_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select term</option>
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Exam Date</label>
                  <input required type="date" value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Score (pts)</label>
                  <input required type="number" min={1} value={examForm.max_score} onChange={(e) => setExamForm({ ...examForm, max_score: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExamModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Save Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">Enroll Student in Class Section</h3>
            <form onSubmit={handleEnroll} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Student</label>
                <select required value={enrollForm.student_id} onChange={(e) => setEnrollForm({ ...enrollForm, student_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">Select student</option>
                  {allStudents.map((st) => (
                    <option key={st.id} value={st.id}>{st.user.first_name} {st.user.last_name} ({st.student_code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Class Section</label>
                  <select required value={enrollForm.class_section_id} onChange={(e) => setEnrollForm({ ...enrollForm, class_section_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select section</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Academic Term</label>
                  <select required value={enrollForm.academic_term_id} onChange={(e) => setEnrollForm({ ...enrollForm, academic_term_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="">Select term</option>
                    {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEnrollModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition">Confirm Enrollment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );

  function setFormFields(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>, fieldName: string) {
    setSectionForm({
      ...sectionForm,
      [fieldName]: e.target.value,
    });
  }
}
