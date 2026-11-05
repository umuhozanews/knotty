"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSafeBrowserClient } from "@/lib/supabase/client";
import DashboardShell from "@/components/DashboardShell";
import { Loader2, BookOpen, BookMarked, AlertCircle } from "lucide-react";

type BorrowRecord = {
  borrow_id: string;
  book_title: string;
  book_author: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  fine_amount: number;
  fine_waived: boolean;
  copy_tag: string;
};

export default function MyLibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const [borrows, setBorrows] = useState<BorrowRecord[]>([]);
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

        const { data, error } = await client!.rpc("student_borrow_history", {
          p_school_id: schoolId,
          p_student_id: profile.student_id,
          p_limit: 50,
        });
        if (!error && data) setBorrows((data as unknown) as BorrowRecord[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [authLoading, user]);

  const active = borrows.filter((b) => !b.returned_at).length;
  const overdue = borrows.filter((b) => !b.returned_at && new Date(b.due_at) < new Date()).length;

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto bg-[#fcf9f8] min-h-screen text-[#121212]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <h1 className="text-2xl font-extrabold tracking-tight">My Library</h1>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#121212] rounded-lg p-4 text-[#fcf9f8] text-center">
            <p className="text-3xl font-extrabold text-[#d9ff8c]">{active}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mt-1">Books Out</p>
          </div>
          <div className="bg-white rounded-lg border border-[#dcd9d9] p-4 text-center">
            <p className="text-3xl font-extrabold text-[#121212]">{borrows.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Total Borrowed</p>
          </div>
          <div className={`rounded-lg p-4 text-center border ${overdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-[#dcd9d9]"}`}>
            <p className={`text-3xl font-extrabold ${overdue > 0 ? "text-red-600" : "text-[#121212]"}`}>{overdue}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mt-1">Overdue</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#dcd9d9] p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Borrow History</p>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
          ) : borrows.length === 0 ? (
            <p className="text-center py-6 text-sm text-gray-400">No library records found</p>
          ) : (
            <div className="space-y-3">
              {borrows.map((b) => {
                const returned = !!b.returned_at;
                const isOverdue = !returned && new Date(b.due_at) < new Date();
                return (
                  <div key={b.borrow_id} className="flex items-center gap-3 p-3 rounded-lg border border-[#dcd9d9] bg-[#fcf9f8]">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${returned ? "bg-green-100 text-green-700" : isOverdue ? "bg-red-100 text-red-500" : "bg-blue-100 text-blue-600"}`}>
                      {isOverdue ? <AlertCircle size={14} /> : returned ? <BookMarked size={14} /> : <BookOpen size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#121212] truncate">{b.book_title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Borrowed: {new Date(b.borrowed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        {` · Due: ${new Date(b.due_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-md border ${returned ? "bg-green-50 text-green-700 border-green-200" : isOverdue ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
                      {returned ? "Returned" : isOverdue ? "Overdue" : "Active"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
