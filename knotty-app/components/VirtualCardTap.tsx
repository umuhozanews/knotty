"use client";
import { useEffect, useState, useRef } from "react";
import { Smartphone, Loader2, Search, Wifi, Users, Briefcase } from "lucide-react";
import type { Student } from "@/lib/api";
import { supabaseStudentService, supabaseStaffService } from "@/lib/supabase/services";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";

interface Props {
  onTap: (cardNumber: string) => void;
  busy?: boolean;
}

type StaffTapItem = {
  id: string;
  name: string;
  code: string;
  role: string;
};

export default function VirtualCardTap({ onTap, busy }: Props) {
  const { user, activeSchool } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"students" | "staff">("students");
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<StaffTapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tapping, setTapping] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const schoolId = user?.school_id || activeSchool?.id;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function fetchCards() {
    if (!schoolId) return;
    setLoading(true);
    try {
      // 1. Fetch Students with active cards
      const stdList = await supabaseStudentService.listSchoolStudents(schoolId);
      setStudents(stdList.filter((s) => s.card?.is_active || s.card?.card_number));

      // 2. Fetch Active Staff members
      const client = getSafeBrowserClient();
      if (client) {
        const { data: staffData } = await client.rpc("list_school_staff_members", {
          p_school_id: schoolId,
        });
        if (Array.isArray(staffData)) {
          setStaff(
            staffData
              .filter((s: any) => s.employment_status === "active")
              .map((s: any) => ({
                id: s.staff_record_id,
                name: s.legal_name,
                code: s.staff_number || "STF-STAFF",
                role: s.job_title || "Staff Member",
              }))
          );
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!open) {
      setOpen(true);
      fetchCards();
    } else {
      setOpen(false);
    }
  }

  async function tapStudentCard(student: Student) {
    const val = student.card?.card_number || student.student_code;
    if (busy || tapping || !val) return;
    setTapping(student.id);
    await new Promise((r) => setTimeout(r, 180));
    onTap(val);
    setTapping(null);
    setOpen(false);
  }

  async function tapStaffCard(stf: StaffTapItem) {
    if (busy || tapping) return;
    setTapping(stf.id);
    await new Promise((r) => setTimeout(r, 180));
    onTap(stf.code);
    setTapping(null);
    setOpen(false);
  }

  const q = search.toLowerCase();

  const filteredStudents = students.filter((s) => {
    const name = `${s.user.first_name} ${s.user.last_name}`.toLowerCase();
    const code = (s.card?.card_number ?? s.student_code ?? "").toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  const filteredStaff = staff.filter((s) => {
    const name = s.name.toLowerCase();
    const code = s.code.toLowerCase();
    const role = s.role.toLowerCase();
    return name.includes(q) || code.includes(q) || role.includes(q);
  });

  return (
    <div className="relative inline-block" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-blue-500 text-blue-600 bg-blue-50/50 hover:bg-blue-50 text-xs font-semibold transition"
        title="Simulate NFC card tap for testing or when NFC hardware is disabled"
      >
        <Smartphone size={14} />
        <span>Virtual Tap</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden text-left">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Wifi size={14} className="text-blue-600" />
              <span>Virtual Card Tap</span>
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">Click any holder to simulate physical card tap</p>

            {/* Sub-tabs: Students vs Staff */}
            <div className="flex gap-1 bg-gray-200/60 p-0.5 rounded-xl mt-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab("students")}
                className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  tab === "students" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Users size={12} />
                <span>Students ({filteredStudents.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setTab("staff")}
                className={`flex-1 py-1 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  tab === "staff" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Briefcase size={12} />
                <span>Staff ({filteredStaff.length})</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-100">
              <Search size={12} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tab} by name or code…`}
                className="bg-transparent text-xs outline-none flex-1 text-gray-700 font-medium"
                autoFocus
              />
            </div>
          </div>

          {/* List items */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-blue-600" />
              </div>
            ) : tab === "students" ? (
              filteredStudents.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No active student cards found</p>
              ) : (
                filteredStudents.map((student) => {
                  const isTapping = tapping === student.id;
                  const name = `${student.user.first_name} ${student.user.last_name}`.trim();
                  const initials = name.split(" ").map((p) => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "ST";
                  const hue = name.charCodeAt(0) * 37 % 360;

                  return (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => tapStudentCard(student)}
                      disabled={!!busy || !!tapping}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/70 transition text-left ${
                        isTapping ? "bg-blue-50 scale-95" : ""
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full items-center justify-center text-white text-xs font-bold flex-shrink-0 flex shadow-xs"
                        style={{ background: `hsl(${hue}, 60%, 55%)` }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">
                          {student.card?.card_number || student.student_code}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-teal-600">
                          {(student.card?.wallet_balance ?? 0).toLocaleString()}
                        </p>
                        <p className="text-[9px] text-gray-400">RWF</p>
                      </div>

                      {isTapping && (
                        <div className="flex-shrink-0">
                          <Loader2 size={13} className="animate-spin text-blue-600" />
                        </div>
                      )}
                    </button>
                  );
                })
              )
            ) : (
              /* Staff Tab */
              filteredStaff.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No active staff members found</p>
              ) : (
                filteredStaff.map((stf) => {
                  const isTapping = tapping === stf.id;
                  const initials = stf.name.split(" ").map((p) => p[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "SF";
                  const hue = stf.name.charCodeAt(0) * 43 % 360;

                  return (
                    <button
                      type="button"
                      key={stf.id}
                      onClick={() => tapStaffCard(stf)}
                      disabled={!!busy || !!tapping}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/70 transition text-left ${
                        isTapping ? "bg-blue-50 scale-95" : ""
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-full items-center justify-center text-white text-xs font-bold flex-shrink-0 flex shadow-xs"
                        style={{ background: `hsl(${hue}, 55%, 50%)` }}
                      >
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{stf.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{stf.role}</p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-mono font-semibold">
                          {stf.code}
                        </span>
                      </div>

                      {isTapping && (
                        <div className="flex-shrink-0">
                          <Loader2 size={13} className="animate-spin text-blue-600" />
                        </div>
                      )}
                    </button>
                  );
                })
              )
            )}
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
            <span>Instant tap simulation</span>
            <span className="font-semibold text-blue-600">IshuriHUB NFC</span>
          </div>
        </div>
      )}
    </div>
  );
}
