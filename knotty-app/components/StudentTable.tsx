"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { students, Student } from "@/lib/api";

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = (score / total) * 100;
  return (
    <span className={`text-sm font-semibold ${pct >= 90 ? "text-teal-600" : pct >= 75 ? "text-blue-600" : "text-red-500"}`}>
      {score}/{total}
    </span>
  );
}

function Avatar({ student, index }: { student: Student; index: number }) {
  const initials = `${student.user.first_name[0]}${student.user.last_name[0]}`;
  if (student.user.profile_photo) {
    return <img src={student.user.profile_photo} className="w-8 h-8 rounded-full object-cover" alt={initials} />;
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
      style={{ background: `hsl(${(index * 67) % 360}, 65%, 55%)` }}
    >
      {initials}
    </div>
  );
}

export default function StudentTable() {
  const router = useRouter();
  const [data, setData] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 5;

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await students.list({ page, limit, search: query || undefined });
      setData(res.data);
      setTotal(res.pagination.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">
          Students
          {total > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">({total} total)</span>}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl px-3 py-1.5 text-xs text-gray-500">
            <Search size={12} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="outline-none bg-transparent w-36"
            />
          </div>
          <button className="flex items-center gap-1.5 text-xs text-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 hover:bg-blue-50 transition font-medium">
            Annual Exam <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-3 font-medium">Profile</th>
            <th className="text-left pb-3 font-medium">Name</th>
            <th className="text-left pb-3 font-medium">Student ID</th>
            <th className="text-left pb-3 font-medium">Class</th>
            <th className="text-left pb-3 font-medium">Wallet</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={6} className="py-8 text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto" size={20} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-xs text-gray-400">
                {query ? `No students matching "${query}"` : "No students found"}
              </td>
            </tr>
          ) : (
            data.map((s, i) => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="py-3"><Avatar student={s} index={i} /></td>
                <td className="py-3">
                  <p className="font-medium text-gray-800">
                    {s.user.first_name} {s.user.last_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {s.level?.name} {s.class?.name}
                  </p>
                </td>
                <td className="py-3 text-gray-500 font-mono text-xs">{s.student_code}</td>
                <td className="py-3 text-gray-500">{s.class?.name ?? "—"}</td>
                <td className="py-3">
                  {s.card ? (
                    <ScoreBadge score={s.card.wallet_balance} total={10000} />
                  ) : (
                    <span className="text-xs text-gray-300">No card</span>
                  )}
                </td>
                <td className="py-3">
                  <button
                    onClick={() => router.push(`/students/${s.id}`)}
                    className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
          <p className="text-xs text-gray-400">
            Page {page} of {pages}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
