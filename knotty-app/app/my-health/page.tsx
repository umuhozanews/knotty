"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, Heart, Thermometer, Stethoscope } from "lucide-react";

type ClinicVisit = {
  visit_id: string;
  visit_datetime: string;
  presenting_complaint: string;
  treatment_notes: string | null;
  follow_up_required: boolean;
  recorder_name: string;
};

type HealthRecord = {
  record_id: string;
  type: string;
  title: string;
  description: string | null;
  treatment_given: string | null;
  severity: string;
  follow_up_required: boolean;
  resolved_at: string | null;
  recorded_at: string;
  recorder_name: string;
};

export default function MyHealthPage() {
  const { user, loading: authLoading } = useAuth();
  const [visits, setVisits] = useState<ClinicVisit[]>([]);
  const [conditions, setConditions] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    const client = getSafeBrowserClient();
    if (!client) { setLoading(false); return; }
    const schoolId = user.school_id;
    if (!schoolId) { setLoading(false); return; }

    async function load() {
      try {
        const { data: profileRows } = await client!.rpc("get_my_student_profile", { p_school_id: schoolId });
        const profile = (profileRows as any)?.[0];
        if (!profile?.student_id) return;

        const [visitsRes, conditionsRes] = await Promise.all([
          client!.rpc("list_student_clinic_visits", {
            p_school_id: schoolId,
            p_student_id: profile.student_id,
            p_limit: 30,
          }),
          client!.rpc("list_student_health_records", {
            p_school_id: schoolId,
            p_student_id: profile.student_id,
            p_limit: 30,
          }),
        ]);

        if (!visitsRes.error && visitsRes.data) setVisits((visitsRes.data as unknown) as ClinicVisit[]);
        if (!conditionsRes.error && conditionsRes.data) setConditions((conditionsRes.data as unknown) as HealthRecord[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight">My Health</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121212] rounded-lg p-4 text-[#fcf9f8] text-center">
            <p className="text-3xl font-extrabold text-[#d9ff8c]">{visits.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-1">Clinic Visits</p>
          </div>
          <div className="bg-white rounded-lg border border-[#dcd9d9] p-4 text-center">
            <p className="text-3xl font-extrabold text-[#121212]">{conditions.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Conditions on File</p>
          </div>
        </div>

        {/* Medical conditions */}
        {conditions.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Heart size={13} /> Health Records on File
            </p>
            {conditions.map((c) => (
              <div key={c.record_id} className="text-sm text-amber-900">
                <span className="font-semibold">{c.title}</span>
                {c.description && <span className="text-amber-700 ml-2 text-xs">— {c.description}</span>}
                {c.resolved_at && <span className="text-green-600 ml-2 text-xs">(Resolved)</span>}
              </div>
            ))}
          </div>
        )}

        {/* Clinic visits */}
        <div className="bg-white rounded-lg border border-[#dcd9d9] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Clinic Visit History</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : visits.length === 0 ? (
            <div className="text-center py-8">
              <Stethoscope size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No clinic visits recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <div key={v.visit_id} className="p-4 rounded-lg border border-[#dcd9d9] bg-[#fcf9f8] space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Thermometer size={14} className="text-blue-500 shrink-0" />
                    <p className="text-sm font-bold text-[#121212]">
                      {new Date(v.visit_datetime).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {v.recorder_name && <span className="text-xs text-gray-400 ml-auto">Nurse: {v.recorder_name}</span>}
                  </div>
                  {v.presenting_complaint && <p className="text-xs text-gray-600 ml-5"><span className="font-semibold">Complaint:</span> {v.presenting_complaint}</p>}
                  {v.treatment_notes && <p className="text-xs text-blue-600 ml-5"><span className="font-semibold">Treatment:</span> {v.treatment_notes}</p>}
                  {v.follow_up_required && <p className="text-xs text-orange-600 ml-5 font-medium">Follow-up required</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
