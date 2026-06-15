"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { health, students, HealthRecord, Student, MedicalProfile, ImmunizationRecord, ClinicVisit } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import {
  Loader2, Heart, Plus, X, Search, AlertCircle, CheckCircle, Clock,
  ShieldAlert, Activity, User, Phone, Edit3, Trash2, Calendar
} from "lucide-react";
import { useToast } from "@/context/ToastContext";

const TYPES = ["ILLNESS", "INJURY", "MEDICATION", "CHECKUP", "ALLERGY"];
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"];
const SEV_COLOR: Record<string, string> = { LOW: "bg-green-100 text-green-700", MEDIUM: "bg-yellow-100 text-yellow-700", HIGH: "bg-red-100 text-red-700" };
const TYPE_COLOR: Record<string, string> = { ILLNESS: "bg-blue-50 text-blue-600", INJURY: "bg-orange-50 text-orange-600", MEDICATION: "bg-purple-50 text-purple-600", CHECKUP: "bg-green-50 text-green-600", ALLERGY: "bg-red-50 text-red-600" };

interface HealthRecordExt extends HealthRecord {
  student?: { user: { first_name: string; last_name: string } };
}

export default function HealthPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"incidents" | "visits" | "profiles">("incidents");
  const [loading, setLoading] = useState(true);

  // Search/Incidents States
  const [records, setRecords] = useState<HealthRecordExt[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });

  // Clinic Visits States
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({
    presenting_complaint: "",
    treatment_notes: "",
    follow_up_required: false,
    medications: [] as Array<{ medication_name: string; dosage: string }>
  });
  const [medForm, setMedForm] = useState({ name: "", dosage: "" });

  // Profiles States
  const [profileSearchQuery, setProfileSearchQuery] = useState("");
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile | null>(null);
  const [immunizations, setImmunizations] = useState<ImmunizationRecord[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    blood_type: "",
    emergency_contact_phone: "",
    allergiesInput: "",
    chronicInput: "",
    allergies: [] as string[],
    chronic_conditions: [] as string[],
  });
  const [newImmunizationForm, setNewImmunizationForm] = useState({ vaccine_name: "", date_administered: "" });
  const [showImmunizationForm, setShowImmunizationForm] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "incidents") {
        const sRes = await students.list({ limit: 100 });
        const recs: HealthRecordExt[] = [];
        await Promise.all(sRes.data.slice(0, 10).map(async (s) => {
          const h = await health.studentList(s.id);
          recs.push(...h.data.map((r) => ({ ...r, student: { user: { first_name: s.user.first_name, last_name: s.user.last_name } } })));
        }));
        recs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
        setRecords(recs.slice(0, 40));
      } else if (activeTab === "visits") {
        const res = await health.visits();
        setVisits(res.data);
      }
    } catch (err) {
      console.error(err);
      toast("Failed to load health records", "error");
    } finally {
      setLoading(false);
    }
  }

  async function searchStudents(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    students.list({ search: q, limit: 6 })
      .then((r) => setSearchResults(r.data))
      .catch(console.error)
      .finally(() => setSearching(false));
  }

  // Save legacy/incident record
  async function handleSaveIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const rec = await health.create({ student_id: selectedStudent.id, ...incidentForm });
      setRecords((prev) => [{
        ...rec.data,
        student: { user: { first_name: selectedStudent.user.first_name, last_name: selectedStudent.user.last_name } }
      }, ...prev]);
      setShowIncidentModal(false);
      setSelectedStudent(null);
      setIncidentForm({ type: "ILLNESS", title: "", description: "", treatment_given: "", severity: "LOW", follow_up_required: false });
      toast("Health incident logged", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  // Save new clinic visit
  async function handleSaveVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    try {
      await health.createVisit(selectedStudent.id, visitForm);
      toast("Clinic visit and medication logged successfully", "success");
      setShowVisitModal(false);
      setSelectedStudent(null);
      setVisitForm({ presenting_complaint: "", treatment_notes: "", follow_up_required: false, medications: [] });
      loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save clinic visit", "error");
    } finally {
      setSaving(false);
    }
  }

  // Add medication to current visit form
  function handleAddMedication() {
    if (!medForm.name.trim() || !medForm.dosage.trim()) return;
    setVisitForm(f => ({
      ...f,
      medications: [...f.medications, { medication_name: medForm.name.trim(), dosage: medForm.dosage.trim() }]
    }));
    setMedForm({ name: "", dosage: "" });
  }

  function handleRemoveMedication(index: number) {
    setVisitForm(f => ({
      ...f,
      medications: f.medications.filter((_, i) => i !== index)
    }));
  }

  // Fetch full student medical profile
  async function handleLoadStudentProfile(student: Student) {
    setProfileStudent(student);
    setIsEditingProfile(false);
    setShowImmunizationForm(false);
    try {
      const profRes = await health.getProfile(student.id);
      const immRes = await health.immunizations(student.id);
      setMedicalProfile(profRes.data);
      setImmunizations(immRes.data);
      
      setProfileForm({
        blood_type: profRes.data.blood_type || "",
        emergency_contact_phone: profRes.data.emergency_contact_phone || "",
        allergiesInput: "",
        chronicInput: "",
        allergies: profRes.data.allergies || [],
        chronic_conditions: profRes.data.chronic_conditions || [],
      });
    } catch (e) {
      console.error(e);
      toast("Failed to load medical profile", "error");
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileStudent || !medicalProfile) return;
    try {
      const res = await health.updateProfile(profileStudent.id, {
        blood_type: profileForm.blood_type || null,
        emergency_contact_phone: profileForm.emergency_contact_phone,
        allergies: profileForm.allergies,
        chronic_conditions: profileForm.chronic_conditions,
      });
      setMedicalProfile(res.data);
      setIsEditingProfile(false);
      toast("Medical profile updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update profile", "error");
    }
  }

  async function handleAddImmunization(e: React.FormEvent) {
    e.preventDefault();
    if (!profileStudent || !newImmunizationForm.vaccine_name || !newImmunizationForm.date_administered) return;
    try {
      const res = await health.addImmunization(profileStudent.id, newImmunizationForm);
      setImmunizations(prev => [res.data, ...prev]);
      setShowImmunizationForm(false);
      setNewImmunizationForm({ vaccine_name: "", date_administered: "" });
      toast("Immunization record added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add vaccine", "error");
    }
  }

  async function handleDeleteImmunization(id: string) {
    if (!confirm("Are you sure you want to delete this immunization record?")) return;
    try {
      await health.deleteImmunization(id);
      setImmunizations(prev => prev.filter(i => i.id !== id));
      toast("Immunization record deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete record", "error");
    }
  }

  return (
    <DashboardShell>
      <div className="p-4 space-y-4 h-full flex flex-col overflow-hidden">
        
        {/* Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-rose-600 to-pink-700 p-4 rounded-2xl shadow-lg text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Heart size={24} className="text-white fill-current animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Health & Medical Center</h1>
              <p className="text-xs text-rose-100">Student medical profiles, clinic check-ins, and vaccination trackers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              setSelectedStudent(null);
              if (activeTab === "incidents") {
                setShowIncidentModal(true);
              } else {
                setShowVisitModal(true);
              }
            }}
              className="px-4 py-2 bg-white text-rose-700 rounded-xl text-xs font-semibold hover:bg-rose-50 shadow-md transition flex items-center gap-1.5">
              <Plus size={14} /> {activeTab === "incidents" ? "Log Incident" : "New Clinic Visit"}
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-sm flex-shrink-0">
          <div className="flex gap-1">
            <button onClick={() => setActiveTab("incidents")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "incidents" ? "bg-rose-50 text-rose-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <Activity size={14} /> Incident Logs
            </button>
            <button onClick={() => setActiveTab("visits")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "visits" ? "bg-pink-50 text-pink-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <Clock size={14} /> Clinic Visits
            </button>
            <button onClick={() => setActiveTab("profiles")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${activeTab === "profiles" ? "bg-orange-50 text-orange-700" : "text-gray-500 hover:bg-gray-50"}`}>
              <User size={14} /> Medical Profiles
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500" size={28} /></div>
          ) : activeTab === "incidents" ? (
            
            // TAB 1: INCIDENT LOGS
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {records.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                  <ShieldAlert size={36} className="mb-2 text-gray-200" />
                  <p className="text-xs">No health incidents registered</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                  {records.map((rec) => (
                    <div key={rec.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_COLOR[rec.type] ?? "bg-gray-50 text-gray-500"}`}>
                          <Heart size={16} className="fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-gray-800">{rec.title}</p>
                              <p className="text-[10px] text-gray-400">{rec.student?.user.first_name} {rec.student?.user.last_name}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${SEV_COLOR[rec.severity]}`}>{rec.severity}</span>
                            </div>
                          </div>
                          {rec.description && <p className="text-[11px] text-gray-500 mt-2 bg-slate-50 p-2 rounded-xl">{rec.description}</p>}
                          {rec.treatment_given && (
                            <p className="text-[10px] text-emerald-600 mt-1.5 font-medium flex items-center gap-1">
                              <CheckCircle size={10} /> Treatment: {rec.treatment_given}
                            </p>
                          )}
                          {rec.follow_up_required && (
                            <p className="text-[10px] text-amber-500 mt-1 font-medium flex items-center gap-1">
                              <AlertCircle size={10} /> Follow-up scheduled
                            </p>
                          )}
                          <p className="text-[9px] text-gray-300 mt-2 flex items-center gap-1">
                            <Clock size={10} /> {new Date(rec.recorded_at).toLocaleString("en-RW", { timeZone: "Africa/Kigali" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : activeTab === "visits" ? (
            
            // TAB 2: CLINIC VISITS
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {visits.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-gray-400">
                  <Activity size={36} className="mb-2 text-gray-200" />
                  <p className="text-xs">No clinic visits recorded</p>
                </div>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  {visits.map(v => (
                    <div key={v.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex flex-col md:flex-row md:items-start gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800">{v.student?.user.first_name} {v.student?.user.last_name}</span>
                            <p className="text-[10px] text-slate-400">Recorded by {v.recorder?.first_name} {v.recorder?.last_name}</p>
                          </div>
                          <span className="text-[9px] text-slate-300 font-bold flex items-center gap-1"><Clock size={10} /> {new Date(v.visit_datetime).toLocaleString("en-RW", { timeZone: "Africa/Kigali" })}</span>
                        </div>
                        <div className="text-[11px] space-y-1 mt-2">
                          <p className="text-slate-700 font-medium"><span className="text-slate-400 font-normal">Complaint:</span> {v.presenting_complaint}</p>
                          {v.treatment_notes && <p className="text-slate-700 font-medium"><span className="text-slate-400 font-normal">Treatment:</span> {v.treatment_notes}</p>}
                        </div>
                        {v.follow_up_required && (
                          <span className="inline-flex items-center gap-1 text-[9px] bg-amber-50 border border-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold mt-2">
                            <AlertCircle size={10} /> Requires Follow-up
                          </span>
                        )}
                      </div>

                      {/* Medications Administered */}
                      <div className="w-full md:w-80 bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">MEDICATIONS DISPENSED</span>
                        {v.medications && v.medications.length > 0 ? (
                          <div className="space-y-1">
                            {v.medications.map(med => (
                              <div key={med.id} className="flex justify-between items-center p-2 bg-rose-50/30 border border-rose-100/50 rounded-lg text-[10px]">
                                <span className="font-bold text-slate-700">{med.medication_name}</span>
                                <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">{med.dosage}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic py-1">No medication administered</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : (
            
            // TAB 3: MEDICAL PROFILES
            <div className="flex-1 flex flex-col md:flex-row min-h-0">
              
              {/* Profile Sidebar Search */}
              <div className="w-full md:w-80 border-r border-gray-100 p-4 space-y-4 flex flex-col overflow-y-auto flex-shrink-0 bg-slate-50/50">
                <div>
                  <label className="text-xs font-semibold text-slate-500 mb-1 block">Find Student Profile</label>
                  <div className="relative">
                    <input value={profileSearchQuery} onChange={(e) => { setProfileSearchQuery(e.target.value); searchStudents(e.target.value); }}
                      placeholder="Type name or student number..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 bg-white pr-8" />
                    {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-slate-400" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 bg-white rounded-xl overflow-hidden shadow-lg">
                      {searchResults.map((s) => (
                        <button key={s.id} type="button" onClick={() => { handleLoadStudentProfile(s); setSearchResults([]); setProfileSearchQuery(""); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 text-left border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-600">{s.user.first_name[0]}</div>
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{s.user.first_name} {s.user.last_name}</p>
                            <p className="text-[10px] text-gray-400">{s.student_code}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {profileStudent && (
                  <div className="p-3 bg-rose-50 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-rose-700">{profileStudent.user.first_name} {profileStudent.user.last_name}</p>
                      <p className="text-[10px] text-rose-400">{profileStudent.student_code}</p>
                    </div>
                    <button onClick={() => { setProfileStudent(null); setMedicalProfile(null); }} className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
                  </div>
                )}
              </div>

              {/* Profile Detail Content */}
              <div className="flex-1 overflow-y-auto p-6 min-w-0">
                {!profileStudent ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <User size={40} className="mb-2 text-gray-200" />
                    <p className="text-xs">Search and select a student in the sidebar to manage their medical profile</p>
                  </div>
                ) : !medicalProfile ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-rose-500" size={24} /></div>
                ) : (
                  <div className="space-y-6 max-w-3xl animate-fadeIn">
                    
                    {/* Medical Profile Detail Card */}
                    <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Activity size={14} className="text-rose-500" /> STUDENT CLINICAL FILE</h3>
                        {!isEditingProfile ? (
                          <button onClick={() => setIsEditingProfile(true)}
                            className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1">
                            <Edit3 size={12} /> Edit Profile
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setIsEditingProfile(false)} className="text-xs text-slate-400 font-bold hover:text-slate-600">Cancel</button>
                            <button onClick={handleSaveProfile} className="text-xs text-rose-600 font-bold hover:text-rose-800">Save</button>
                          </div>
                        )}
                      </div>

                      {isEditingProfile ? (
                        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Blood Type</label>
                            <select value={profileForm.blood_type} onChange={(e) => setProfileForm(f => ({ ...f, blood_type: e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-rose-500">
                              <option value="">Unknown</option>
                              <option value="A+">A+</option>
                              <option value="A-">A-</option>
                              <option value="B+">B+</option>
                              <option value="B-">B-</option>
                              <option value="O+">O+</option>
                              <option value="O-">O-</option>
                              <option value="AB+">AB+</option>
                              <option value="AB-">AB-</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Emergency Contact Phone *</label>
                            <input value={profileForm.emergency_contact_phone} onChange={(e) => setProfileForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                              placeholder="e.g. +250788123456" required
                              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-rose-500" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Allergies (comma-separated)</label>
                            <input value={profileForm.allergiesInput} onChange={(e) => setProfileForm(f => ({ ...f, allergiesInput: e.target.value }))}
                              onBlur={() => {
                                if (!profileForm.allergiesInput.trim()) return;
                                const tags = profileForm.allergiesInput.split(",").map(t => t.trim()).filter(t => t.length > 0);
                                setProfileForm(f => ({ ...f, allergies: [...f.allergies, ...tags], allergiesInput: "" }));
                              }}
                              placeholder="Dust, Peanuts..."
                              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-rose-500" />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {profileForm.allergies.map((a, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[9px] font-bold">
                                  {a}
                                  <X size={8} className="cursor-pointer" onClick={() => setProfileForm(f => ({ ...f, allergies: f.allergies.filter((_, idx) => idx !== i) }))} />
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Chronic Conditions (comma-separated)</label>
                            <input value={profileForm.chronicInput} onChange={(e) => setProfileForm(f => ({ ...f, chronicInput: e.target.value }))}
                              onBlur={() => {
                                if (!profileForm.chronicInput.trim()) return;
                                const tags = profileForm.chronicInput.split(",").map(t => t.trim()).filter(t => t.length > 0);
                                setProfileForm(f => ({ ...f, chronic_conditions: [...f.chronic_conditions, ...tags], chronicInput: "" }));
                              }}
                              placeholder="Asthma, Diabetes..."
                              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-rose-500" />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {profileForm.chronic_conditions.map((c, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[9px] font-bold">
                                  {c}
                                  <X size={8} className="cursor-pointer" onClick={() => setProfileForm(f => ({ ...f, chronic_conditions: f.chronic_conditions.filter((_, idx) => idx !== i) }))} />
                                </span>
                              ))}
                            </div>
                          </div>
                        </form>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <Activity size={16} className="text-rose-500" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Blood Type</p>
                              <p className="font-semibold text-slate-800">{medicalProfile.blood_type || "Not Declared"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                            <Phone size={16} className="text-emerald-500" />
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Emergency Contact</p>
                              <p className="font-semibold text-slate-800">{medicalProfile.emergency_contact_phone || "No emergency contact logged"}</p>
                            </div>
                          </div>
                          <div className="border border-gray-100 p-3 rounded-xl col-span-1 sm:col-span-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">ALLERGIES ({medicalProfile.allergies?.length || 0})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {medicalProfile.allergies && medicalProfile.allergies.length > 0 ? (
                                medicalProfile.allergies.map((a, i) => (
                                  <span key={i} className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-0.5 rounded text-[10px] font-semibold">{a}</span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No allergies declared</span>
                              )}
                            </div>
                          </div>
                          <div className="border border-gray-100 p-3 rounded-xl col-span-1 sm:col-span-2">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">CHRONIC CONDITIONS ({medicalProfile.chronic_conditions?.length || 0})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {medicalProfile.chronic_conditions && medicalProfile.chronic_conditions.length > 0 ? (
                                medicalProfile.chronic_conditions.map((c, i) => (
                                  <span key={i} className="bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded text-[10px] font-semibold">{c}</span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">No chronic conditions declared</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Immunizations List Card */}
                    <div className="bg-white border border-gray-200 p-5 rounded-2xl shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Calendar size={14} className="text-rose-500" /> IMMUNIZATION RECORDS ({immunizations.length})</h3>
                        <button onClick={() => setShowImmunizationForm(!showImmunizationForm)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1">
                          <Plus size={14} /> Add Vaccine
                        </button>
                      </div>

                      {/* Add Immunization Form Slider */}
                      {showImmunizationForm && (
                        <form onSubmit={handleAddImmunization} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex flex-wrap gap-3 items-end">
                          <div className="flex-1 min-w-[150px]">
                            <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Vaccine Name *</label>
                            <input value={newImmunizationForm.vaccine_name} onChange={(e) => setNewImmunizationForm(f => ({ ...f, vaccine_name: e.target.value }))}
                              placeholder="e.g. BCG, COVID-19" required
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-rose-500" />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Date Administered *</label>
                            <input type="date" value={newImmunizationForm.date_administered} onChange={(e) => setNewImmunizationForm(f => ({ ...f, date_administered: e.target.value }))}
                              required
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-rose-500" />
                          </div>
                          <button type="submit" className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm">
                            Add Log
                          </button>
                        </form>
                      )}

                      {immunizations.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No immunization records logged for this student.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {immunizations.map(imm => (
                            <div key={imm.id} className="p-3 border border-gray-100 rounded-xl flex items-center justify-between shadow-sm bg-slate-50/20">
                              <div>
                                <span className="font-semibold text-slate-800">{imm.vaccine_name}</span>
                                <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5"><Calendar size={9} /> {new Date(imm.date_administered).toLocaleDateString("en-RW")}</p>
                              </div>
                              <button onClick={() => handleDeleteImmunization(imm.id)} className="text-slate-400 hover:text-red-500 transition">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

      {/* INCIDENT MODAL (LEGACY) */}
      {showIncidentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-gray-800">Log Health Incident</p>
              <button onClick={() => setShowIncidentModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {!selectedStudent ? (
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Find Student *</label>
                <div className="relative">
                  <input value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    placeholder="Type name or code..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 pr-8" />
                  {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-lg">
                    {searchResults.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setSelectedStudent(s); setSearchResults([]); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 text-left border-b border-gray-50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-600">{s.user.first_name[0]}</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{s.user.first_name} {s.user.last_name}</p>
                          <p className="text-[10px] text-gray-400">{s.student_code} · {s.level?.name} {s.class?.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-rose-50">
                <p className="text-sm font-semibold text-rose-700">{selectedStudent.user.first_name} {selectedStudent.user.last_name}</p>
                <button onClick={() => setSelectedStudent(null)} className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
              </div>
            )}

            <form onSubmit={handleSaveIncident} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Type *</label>
                  <select value={incidentForm.type} onChange={(e) => setIncidentForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500">
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Severity *</label>
                  <select value={incidentForm.severity} onChange={(e) => setIncidentForm((f) => ({ ...f, severity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500">
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Title *</label>
                <input value={incidentForm.title} onChange={(e) => setIncidentForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Fever 38.5°C" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label>
                <textarea value={incidentForm.description} onChange={(e) => setIncidentForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Treatment Given</label>
                <input value={incidentForm.treatment_given} onChange={(e) => setIncidentForm((f) => ({ ...f, treatment_given: e.target.value }))}
                  placeholder="e.g. Rested and paracetamol administered"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={incidentForm.follow_up_required} onChange={(e) => setIncidentForm((f) => ({ ...f, follow_up_required: e.target.checked }))}
                  className="w-4 h-4 rounded accent-rose-500" />
                <span className="text-xs text-gray-600 font-bold">Follow-up required</span>
              </label>
              <button type="submit" disabled={saving || !selectedStudent || !incidentForm.title}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-md">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Heart size={15} className="fill-current" />}
                Save Record
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CLINIC VISIT MODAL (ADVANCED) */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto animate-scaleUp">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold text-gray-800">Log Clinic Visit</p>
              <button onClick={() => setShowVisitModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {!selectedStudent ? (
              <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Find Student *</label>
                <div className="relative">
                  <input value={studentSearch} onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                    placeholder="Type name or code..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 pr-8" />
                  {searching && <Loader2 size={14} className="animate-spin absolute right-3 top-2.5 text-gray-400" />}
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl bg-white overflow-hidden shadow-lg">
                    {searchResults.map((s) => (
                      <button key={s.id} type="button" onClick={() => { setSelectedStudent(s); setSearchResults([]); }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-rose-50 text-left border-b border-gray-50 last:border-0">
                        <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center text-[10px] font-bold text-rose-600">{s.user.first_name[0]}</div>
                        <div>
                          <p className="text-xs font-semibold text-gray-700">{s.user.first_name} {s.user.last_name}</p>
                          <p className="text-[10px] text-gray-400">{s.student_code}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 flex items-center justify-between p-3 rounded-xl bg-rose-50">
                <p className="text-sm font-semibold text-rose-700">{selectedStudent.user.first_name} {selectedStudent.user.last_name}</p>
                <button onClick={() => setSelectedStudent(null)} className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
              </div>
            )}

            <form onSubmit={handleSaveVisit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Presenting Complaint *</label>
                <input value={visitForm.presenting_complaint} onChange={(e) => setVisitForm(f => ({ ...f, presenting_complaint: e.target.value }))}
                  placeholder="e.g. Persistent stomach ache" required
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Clinical Notes / Treatment Notes</label>
                <textarea value={visitForm.treatment_notes} onChange={(e) => setVisitForm(f => ({ ...f, treatment_notes: e.target.value }))}
                  rows={2} placeholder="Administered antacid, rested."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-rose-500 resize-none" />
              </div>

              {/* Medication Add Subsection */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">DISPENSE MEDICATIONS ({visitForm.medications.length})</span>
                
                {visitForm.medications.length > 0 && (
                  <div className="space-y-1 max-h-24 overflow-y-auto mb-2">
                    {visitForm.medications.map((m, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2 border border-slate-200 rounded-lg text-xs">
                        <div>
                          <span className="font-semibold text-slate-700">{m.medication_name}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({m.dosage})</span>
                        </div>
                        <button type="button" onClick={() => handleRemoveMedication(idx)} className="text-slate-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">MED NAME</label>
                    <input value={medForm.name} onChange={(e) => setMedForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Antacid"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-rose-500" />
                  </div>
                  <div className="w-24">
                    <label className="text-[9px] text-slate-400 font-bold block mb-0.5">DOSAGE</label>
                    <input value={medForm.dosage} onChange={(e) => setMedForm(f => ({ ...f, dosage: e.target.value }))}
                      placeholder="e.g. 10ml"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-rose-500" />
                  </div>
                  <button type="button" onClick={handleAddMedication}
                    className="px-3 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 font-bold rounded-lg text-xs transition">
                    Add
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input type="checkbox" checked={visitForm.follow_up_required} onChange={(e) => setVisitForm(f => ({ ...f, follow_up_required: e.target.checked }))}
                  className="w-4 h-4 rounded accent-rose-500" />
                <span className="text-xs text-gray-600 font-bold">Follow-up required</span>
              </label>

              <button type="submit" disabled={saving || !selectedStudent || !visitForm.presenting_complaint}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition mt-2 shadow-md flex items-center justify-center gap-1.5">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} />} Log Clinic Visit
              </button>
            </form>
          </div>
        </div>
      )}

    </DashboardShell>
  );
}
