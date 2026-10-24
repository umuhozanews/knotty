"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Book, BookOpen, Plus, X, Search, AlertTriangle, CheckCircle,
  Loader2, CreditCard, RotateCcw, BookMarked, MapPin, Tag, Clock,
  Wifi, WifiOff, Users,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { library, LibraryBorrowRecord, LibraryBook } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = [
  "Mathematics", "Science", "Literature", "History", "Geography",
  "Religion", "French", "English", "Kinyarwanda", "Biology",
  "Chemistry", "Physics", "Computer Science", "Art", "Other",
];

type Tab = "home" | "catalog" | "add-book" | "lend-return";
type StudentInfo = { id: string; name: string; studentClass: string; card_number: string };
type BookOption = { id: string; title: string; author?: string | null; isbn?: string | null; location?: string | null; available_copies?: number; total_copies?: number; category?: string | null };

export default function LibraryPage() {
  const { loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { startListen, stopListen, listening, isSupported, error: nfcError } = useNFC();

  const [tab, setTab] = useState<Tab>("home");

  /* ── Stats & overview ──────────────────────────────────────── */
  const [stats, setStats] = useState({ totalBooks: 0, activeMembers: 0, overdueBooks: 0, pendingFees: 0 });
  const [recentBorrows, setRecentBorrows] = useState<LibraryBorrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [borrowFilter, setBorrowFilter] = useState<"all" | "overdue">("all");

  /* ── Pending fines modal ───────────────────────────────────── */
  const [showFinesModal, setShowFinesModal] = useState(false);
  const [finesLoading, setFinesLoading] = useState(false);
  const [finesRecords, setFinesRecords] = useState<Array<LibraryBorrowRecord & { days_overdue?: number; accrued_fine?: number }>>([]);
  const [waivingFineId, setWaivingFineId] = useState<string | null>(null);

  /* ── Catalog tab ───────────────────────────────────────────── */
  const [catalogBooks, setCatalogBooks] = useState<LibraryBook[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("All");

  /* ── Add Book ──────────────────────────────────────────────── */
  const [bookForm, setBookForm] = useState({
    book_number: "", title: "", author: "", category: "", location: "", total_copies: 1,
  });
  const [savingBook, setSavingBook] = useState(false);
  const [bookSaved, setBookSaved] = useState(false);

  /* ── Return flow (look up student by card) ─────────────────── */
  const [cardInput, setCardInput] = useState("");
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [studentBorrows, setStudentBorrows] = useState<LibraryBorrowRecord[]>([]);
  const [returning, setReturning] = useState<string | null>(null);

  /* ── Lend modal (standalone, no prior lookup needed) ───────── */
  const [showLendModal, setShowLendModal] = useState(false);
  const [modalCardInput, setModalCardInput] = useState("");
  const [modalStudent, setModalStudent] = useState<StudentInfo | null>(null);
  const [lookingUpModalStudent, setLookingUpModalStudent] = useState(false);

  /* ── Shared book search (used by both lend-in-panel & modal) ─ */
  const [showLendForm, setShowLendForm] = useState(false);
  const [bookSearch, setBookSearch] = useState("");
  const [bookResults, setBookResults] = useState<BookOption[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookOption | null>(null);
  const [searchingBook, setSearchingBook] = useState(false);
  const [dueDays, setDueDays] = useState(7);
  const [lending, setLending] = useState(false);

  /* ── Data load ─────────────────────────────────────────────── */
  const loadHome = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, borrowsRes] = await Promise.all([
        library.stats().catch(() => null),
        library.schoolBorrows({ status: "active", limit: 50 }).catch(() => ({ data: [] })),
      ]);
      if (statsRes?.data) setStats(s => ({ ...s, ...statsRes.data }));
      setRecentBorrows(borrowsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!authLoading) loadHome(); }, [authLoading, loadHome]);

  /* ── Load catalog ──────────────────────────────────────────── */
  const loadCatalog = useCallback(async (searchQuery = catalogSearch, category = catalogCategory) => {
    setCatalogLoading(true);
    try {
      const res = await library.books({
        search: searchQuery.trim() || undefined,
        category: category !== "All" ? category : undefined,
        limit: 100,
      });
      setCatalogBooks(res.data);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load catalog", "error");
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogSearch, catalogCategory, toast]);

  useEffect(() => {
    if (tab === "catalog") {
      loadCatalog();
    }
  }, [tab, loadCatalog]);

  async function openFinesModal() {
    setShowFinesModal(true);
    setFinesLoading(true);
    try {
      const res = await library.overdueReport(1, 50).catch(() => null);
      if (res?.data && res.data.length > 0) {
        setFinesRecords(res.data);
      } else {
        const computed = recentBorrows
          .filter(b => new Date(b.due_at) < new Date())
          .map(b => {
            const diffDays = Math.max(1, Math.ceil((Date.now() - new Date(b.due_at).getTime()) / 86400000));
            return { ...b, days_overdue: diffDays, accrued_fine: diffDays * 200 };
          });
        setFinesRecords(computed);
      }
    } catch {
      const computed = recentBorrows
        .filter(b => new Date(b.due_at) < new Date())
        .map(b => {
          const diffDays = Math.max(1, Math.ceil((Date.now() - new Date(b.due_at).getTime()) / 86400000));
          return { ...b, days_overdue: diffDays, accrued_fine: diffDays * 200 };
        });
      setFinesRecords(computed);
    } finally {
      setFinesLoading(false);
    }
  }

  async function handleWaiveFine(borrowId: string) {
    setWaivingFineId(borrowId);
    try {
      await library.waiveFine(borrowId);
      toast("Fine waived successfully", "success");
      setFinesRecords(prev => prev.filter(r => r.id !== borrowId));
      setStats(s => ({ ...s, pendingFees: Math.max(0, s.pendingFees - 200) }));
      loadHome();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to waive fine", "error");
    } finally {
      setWaivingFineId(null);
    }
  }

  function openLendForBook(bk: BookOption) {
    setSelectedBook(bk);
    setModalCardInput("");
    setModalStudent(null);
    setShowLendModal(true);
  }

  /* ── Return-tab card lookup ────────────────────────────────── */
  async function lookupCard(query: string) {
    if (!query.trim()) return;
    setLoadingStudent(true);
    setStudent(null);
    setStudentBorrows([]);
    setShowLendForm(false);
    try {
      const res = await library.lookupStudent(query.trim());
      const s = res.data;
      setStudent({ id: s.id, name: s.name, studentClass: s.class, card_number: s.card_number ?? query.trim() });
      const borrows = await library.studentHistory(s.id, 1, 30).catch(() => ({ data: [] }));
      setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Student not found", "error");
    } finally {
      setLoadingStudent(false);
    }
  }

  async function startNFC() {
    if (!isSupported) {
      toast("Web NFC requires Chrome on Android. Please use Virtual Tap or enter card number.", "info");
      return;
    }
    const ok = await startListen((result) => { stopListen(); setCardInput(result.value); lookupCard(result.value); });
    if (!ok) {
      toast("NFC scanner unavailable — use Virtual Card Tap below", "info");
    }
  }

  /* ── Modal student lookup ──────────────────────────────────── */
  async function lookupModalStudent(query: string) {
    if (!query.trim()) return;
    setLookingUpModalStudent(true);
    setModalStudent(null);
    setSelectedBook(null);
    setBookSearch("");
    setBookResults([]);
    try {
      const res = await library.lookupStudent(query.trim());
      const s = res.data;
      setModalStudent({ id: s.id, name: s.name, studentClass: s.class, card_number: s.card_number ?? query.trim() });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Student not found", "error");
    } finally {
      setLookingUpModalStudent(false);
    }
  }

  function openLendModal() {
    setShowLendModal(true);
    setModalCardInput("");
    setModalStudent(null);
    setSelectedBook(null);
    setBookSearch("");
    setBookResults([]);
    setDueDays(7);
  }

  /* ── Return ────────────────────────────────────────────────── */
  async function handleReturn(borrowId: string) {
    setReturning(borrowId);
    try {
      const res = await library.returnBook({ borrow_id: borrowId });
      const fine = res.data.fine_amount;
      toast(fine > 0
        ? `Returned — fine ${fine.toLocaleString()} RWF ${res.data.fine_charged_to_wallet ? "deducted from card" : "(settle manually)"}`
        : "Book returned successfully!", "success");
      if (student?.id) {
        const borrows = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
        setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
      }
      setStats(s => ({ ...s, activeMembers: Math.max(0, s.activeMembers - 1) }));
      setRecentBorrows(prev => prev.filter(b => b.id !== borrowId));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Return failed", "error");
    } finally {
      setReturning(null);
    }
  }

  /* ── Book search ───────────────────────────────────────────── */
  async function searchBooks(q: string) {
    if (!q.trim()) { setBookResults([]); return; }
    setSearchingBook(true);
    try {
      const res = await library.books({ search: q, limit: 8 });
      setBookResults(res.data as unknown as BookOption[]);
    } finally {
      setSearchingBook(false);
    }
  }

  /* ── Lend (panel, used from return-tab) ────────────────────── */
  async function handleLend() {
    if (!student || !selectedBook) return;
    setLending(true);
    try {
      await library.borrowBook({ book_id: selectedBook.id, student_id: student.id, due_days: dueDays });
      toast(`"${selectedBook.title}" lent to ${student.name}. Due in ${dueDays} days.`, "success");
      setShowLendForm(false);
      setSelectedBook(null);
      setBookSearch("");
      setBookResults([]);
      const borrows = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
      setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
      setStats(s => ({ ...s, activeMembers: s.activeMembers + 1 }));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lending failed", "error");
    } finally {
      setLending(false);
    }
  }

  /* ── Lend (modal) ──────────────────────────────────────────── */
  async function handleModalLend() {
    if (!modalStudent || !selectedBook) return;
    setLending(true);
    try {
      await library.borrowBook({ book_id: selectedBook.id, student_id: modalStudent.id, due_days: dueDays });
      toast(`"${selectedBook.title}" lent to ${modalStudent.name}. Due in ${dueDays} days.`, "success");
      setShowLendModal(false);
      setStats(s => ({ ...s, activeMembers: s.activeMembers + 1 }));
      // Refresh overview list
      library.schoolBorrows({ status: "active", limit: 50 }).then(r => setRecentBorrows(r.data)).catch(() => {});
    } catch (err) {
      toast(err instanceof Error ? err.message : "Lending failed", "error");
    } finally {
      setLending(false);
    }
  }

  /* ── Save book ─────────────────────────────────────────────── */
  async function handleSaveBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookForm.title || !bookForm.book_number) return;
    setSavingBook(true);
    try {
      await library.createBook({
        title: bookForm.title,
        author: bookForm.author || "Unknown",
        isbn: bookForm.book_number,
        category: bookForm.category || undefined,
        total_copies: bookForm.total_copies,
        location: bookForm.location || undefined,
      });
      setBookSaved(true);
      const addedCopies = bookForm.total_copies;
      setBookForm({ book_number: "", title: "", author: "", category: "", location: "", total_copies: 1 });
      setStats(s => ({ ...s, totalBooks: s.totalBooks + addedCopies }));
      setTimeout(() => setBookSaved(false), 4000);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save book", "error");
    } finally {
      setSavingBook(false);
    }
  }

  const now = new Date();
  const overdueItems = recentBorrows.filter(b => new Date(b.due_at) < now);

  /* ── Shared book search UI (used in both lend contexts) ─────── */
  function BookSearchUI({ onConfirm }: { onConfirm: () => void }) {
    return !selectedBook ? (
      <div>
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
          <input
            value={bookSearch}
            onChange={e => { setBookSearch(e.target.value); searchBooks(e.target.value); }}
            placeholder="Search book by title, number, or category…"
            autoFocus
            className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none"
          />
          {searchingBook && <Loader2 size={13} className="animate-spin absolute right-3.5 top-[11px] text-gray-400" />}
        </div>
        {bookResults.length > 0 && (
          <div className="mt-1.5 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            {bookResults.map(bk => {
              const avail = bk.available_copies ?? 0;
              return (
                <button key={bk.id} disabled={avail === 0}
                  onClick={() => { setSelectedBook(bk); setBookResults([]); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-50 last:border-0 transition disabled:opacity-40 hover:bg-gray-50"
                >
                  <div className="w-7 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FFF3EC" }}>
                    <Book size={13} style={{ color: "#FF7A22" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate" style={{ color: "#121212" }}>{bk.title}</p>
                    <p className="text-[10px] text-gray-400">{bk.isbn ?? ""}{bk.location ? ` · ${bk.location}` : ""}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${avail > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-400"}`}>
                    {avail} avail
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-3">
        <div className="flex items-center gap-2.5 p-3 rounded-2xl" style={{ background: "#FFF3EC" }}>
          <div className="w-8 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#FF7A22" }}>
            <Book size={14} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold" style={{ color: "#121212" }}>{selectedBook.title}</p>
            {selectedBook.location && (
              <p className="text-[10px] flex items-center gap-0.5" style={{ color: "#666" }}>
                <MapPin size={9} /> {selectedBook.location}
              </p>
            )}
          </div>
          <button onClick={() => setSelectedBook(null)}><X size={13} style={{ color: "#999" }} /></button>
        </div>

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: "#666" }}>Return deadline</label>
          <div className="flex gap-2">
            {[7, 14, 21].map(d => (
              <button key={d} type="button" onClick={() => setDueDays(d)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition"
                style={dueDays === d ? { background: "#FF7A22", color: "#fff" } : { background: "#F5F5F5", color: "#666" }}>
                {d} days
              </button>
            ))}
            <input type="number" min={1} max={60} value={dueDays}
              onChange={e => setDueDays(Math.max(1, Number(e.target.value)))}
              className="w-16 text-center border border-gray-200 rounded-xl text-xs outline-none py-1" title="Custom days" />
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: "#999" }}>
            Due: <strong>{new Date(Date.now() + dueDays * 86400000).toLocaleDateString("en-RW", { day: "numeric", month: "long", year: "numeric" })}</strong>
          </p>
        </div>

        <button onClick={onConfirm} disabled={lending}
          className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition"
          style={{ background: "#FF7A22" }}>
          {lending ? <Loader2 size={16} className="animate-spin" /> : <BookMarked size={16} />}
          Confirm Lend
        </button>
      </div>
    );
  }

  return (
    <DashboardShell>
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-3 md:px-4 pt-1 pb-3 flex-shrink-0">
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ color: "#121212" }}>Library</h1>
            <p className="text-xs" style={{ color: "#666666" }}>Register books · Lend · Return</p>
          </div>
          {!loading && (
            <div className="flex gap-2 flex-wrap justify-end">
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#FFF3EC", color: "#FF7A22" }}>
                {stats.totalBooks} Books
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#F5F5F5", color: "#666" }}>
                {stats.activeMembers} Active
              </span>
              {stats.overdueBooks > 0 && (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-600">
                  ⚠ {stats.overdueBooks} Overdue
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Overdue banner ───────────────────────────────────── */}
        {!loading && overdueItems.length > 0 && (
          <div className="mx-3 md:mx-4 mb-3 rounded-2xl p-3 flex gap-2 items-start flex-shrink-0"
            style={{ background: "#FFF1F1", border: "1px solid #FECACA" }}>
            <AlertTriangle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-red-700">
                {overdueItems.length} overdue {overdueItems.length === 1 ? "book" : "books"} — return deadline passed
              </p>
              <p className="text-[10px] text-red-400 mt-0.5 truncate">
                {overdueItems.slice(0, 3).map(b => {
                  const daysLate = Math.ceil((now.getTime() - new Date(b.due_at).getTime()) / 86400000);
                  return `${b.student?.user?.first_name ?? "?"} · "${b.copy?.book?.title ?? "?"}" (${daysLate}d late)`;
                }).join("  ·  ")}
              </p>
            </div>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────── */}
        <div className="flex gap-2 px-3 md:px-4 mb-3 flex-shrink-0">
          {(["home", "catalog", "add-book", "lend-return"] as Tab[]).map(t => {
            const labels: Record<Tab, string> = { home: "Overview", catalog: "Book Catalog", "add-book": "Add Book", "lend-return": "Lend & Return" };
            return (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
                style={tab === t ? { background: "#FF7A22", color: "#fff" } : { background: "#fff", color: "#666666" }}>
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* ── Tab body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4">

          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {tab === "home" && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={28} className="animate-spin" style={{ color: "#FF7A22" }} />
                </div>
              ) : (
                <>
                  {/* Interactive Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Total Books",
                        value: stats.totalBooks,
                        color: "#FF7A22",
                        bg: "#FFF3EC",
                        hint: "Click to view catalog →",
                        action: () => setTab("catalog"),
                      },
                      {
                        label: "Active Borrows",
                        value: stats.activeMembers,
                        color: "#121212",
                        bg: "#F5F5F5",
                        hint: borrowFilter === "all" ? "Showing active" : "Click to view active",
                        action: () => setBorrowFilter("all"),
                      },
                      {
                        label: "Overdue",
                        value: stats.overdueBooks,
                        color: "#EF4444",
                        bg: "#FEF2F2",
                        hint: borrowFilter === "overdue" ? "Showing overdue" : "Click to filter overdue",
                        action: () => setBorrowFilter("overdue"),
                      },
                      {
                        label: "Pending Fines",
                        value: `${stats.pendingFees.toLocaleString()} RWF`,
                        color: "#C62828",
                        bg: "#FFF1F1",
                        hint: "Click to manage fines →",
                        action: openFinesModal,
                      },
                    ].map(s => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={s.action}
                        className="bg-white rounded-2xl p-4 flex flex-col gap-1 text-left border border-transparent hover:border-gray-200 hover:shadow-sm transition active:scale-[0.98] group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#999" }}>{s.label}</p>
                          <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        </div>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[10px] text-gray-400 group-hover:text-gray-600 transition truncate mt-0.5">{s.hint}</p>
                      </button>
                    ))}
                  </div>

                  {/* Quick lend button on overview */}
                  <button onClick={openLendModal}
                    className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition active:scale-[.98] cursor-pointer"
                    style={{ background: "#FF7A22" }}>
                    <BookMarked size={16} /> Lend a Book to Student
                  </button>

                  {/* Students holding books list */}
                  <div className="bg-white rounded-3xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Users size={14} style={{ color: "#FF7A22" }} />
                        <span className="text-sm font-bold" style={{ color: "#121212" }}>Students Holding Books</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBorrowFilter("all")}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            borrowFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          All ({recentBorrows.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBorrowFilter("overdue")}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                            borrowFilter === "overdue" ? "bg-red-600 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                          }`}
                        >
                          Overdue ({overdueItems.length})
                        </button>
                      </div>
                    </div>
                    {recentBorrows.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-10">No active borrows</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {(borrowFilter === "overdue" ? overdueItems : recentBorrows).map(b => {
                          const overdue = new Date(b.due_at) < now;
                          const daysLeft = Math.ceil((new Date(b.due_at).getTime() - now.getTime()) / 86400000);
                          const borrowedDate = new Date(b.borrowed_at).toLocaleDateString("en-RW", { day: "numeric", month: "short" });
                          const dueDate = new Date(b.due_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
                          return (
                            <div key={b.id} className="px-4 py-3 flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-sm"
                                style={{ background: overdue ? "#FEF2F2" : "#FFF3EC", color: overdue ? "#EF4444" : "#FF7A22" }}>
                                {(b.student?.user?.first_name?.[0] ?? "?").toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold" style={{ color: "#121212" }}>
                                  {b.student?.user?.first_name} {b.student?.user?.last_name}
                                </p>
                                <p className="text-[11px] font-semibold truncate" style={{ color: "#444" }}>
                                  {b.copy?.book?.title ?? "Unknown book"}
                                  {(b.copy?.book as { location?: string })?.location
                                    ? <span className="text-gray-400 font-normal"> · {(b.copy?.book as { location?: string }).location}</span>
                                    : null}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] text-gray-400">Borrowed {borrowedDate}</span>
                                  <span className="text-gray-300 text-[9px]">·</span>
                                  <span className={`text-[9px] font-semibold ${overdue ? "text-red-500" : "text-gray-500"}`}>
                                    Return by {dueDate}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-1 ${
                                overdue ? "bg-red-100 text-red-600" : "bg-green-50 text-green-600"
                              }`}>
                                {overdue ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════════════ BOOK CATALOG ═══════════════ */}
          {tab === "catalog" && (
            <div className="space-y-3">
              {/* Search & Categories */}
              <div className="bg-white rounded-3xl p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3.5 top-[11px] text-gray-400" />
                    <input
                      value={catalogSearch}
                      onChange={e => {
                        setCatalogSearch(e.target.value);
                        loadCatalog(e.target.value, catalogCategory);
                      }}
                      placeholder="Search books by title, author, or ISBN…"
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={() => setTab("add-book")}
                    className="px-4 py-2 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                    style={{ background: "#FF7A22" }}
                  >
                    <Plus size={14} /> Add Book
                  </button>
                </div>

                {/* Category Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {["All", ...CATEGORIES].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCatalogCategory(cat);
                        loadCatalog(catalogSearch, cat);
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        catalogCategory === cat ? "bg-[#FF7A22] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Books List / Grid */}
              <div className="bg-white rounded-3xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} style={{ color: "#FF7A22" }} />
                    <span className="text-sm font-bold" style={{ color: "#121212" }}>Library Books Catalog</span>
                  </div>
                  <span className="text-xs text-gray-400 font-semibold">{catalogBooks.length} books listed</span>
                </div>

                {catalogLoading ? (
                  <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#FF7A22]" /></div>
                ) : catalogBooks.length === 0 ? (
                  <div className="py-12 text-center">
                    <Book size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-500">No books found</p>
                    <p className="text-xs text-gray-400 mt-1">Try another search or register a new book</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {catalogBooks.map(bk => {
                      const avail = bk.available_copies ?? bk.total_copies ?? 1;
                      return (
                        <div key={bk.id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#FFF3EC" }}>
                            <Book size={18} style={{ color: "#FF7A22" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate" style={{ color: "#121212" }}>{bk.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {bk.author || "Unknown Author"}
                              {bk.isbn && <span className="text-gray-400"> · ISBN: {bk.isbn}</span>}
                              {bk.category && <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-semibold">{bk.category}</span>}
                            </p>
                            {bk.location && (
                              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                <MapPin size={10} /> Shelf: {bk.location}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${avail > 0 ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-500 border border-red-100"}`}>
                              {avail} / {bk.total_copies} Avail
                            </span>
                            <button
                              disabled={avail === 0}
                              onClick={() => openLendForBook(bk)}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-40 flex items-center gap-1 shadow-sm transition active:scale-95 cursor-pointer"
                              style={{ background: "#FF7A22" }}
                            >
                              <BookMarked size={12} /> Lend
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════ ADD BOOK ═══════════════ */}
          {tab === "add-book" && (
            <div className="max-w-md mx-auto">
              <div className="bg-white rounded-3xl p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#FFF3EC" }}>
                    <Plus size={20} style={{ color: "#FF7A22" }} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: "#121212" }}>Register New Book</h2>
                    <p className="text-[11px]" style={{ color: "#666" }}>Add a book to the library catalog</p>
                  </div>
                </div>

                {bookSaved && (
                  <div className="mb-4 p-3 rounded-2xl flex items-center gap-2 bg-green-50 border border-green-100">
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-green-700">Book registered and added to catalog!</span>
                  </div>
                )}

                <form onSubmit={handleSaveBook} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Book Number / Identifier *</label>
                    <div className="relative">
                      <Tag size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                      <input value={bookForm.book_number} onChange={e => setBookForm(f => ({ ...f, book_number: e.target.value }))}
                        placeholder="e.g. BK-001 or 9780194338" required
                        className="w-full border rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none transition"
                        style={{ borderColor: bookForm.book_number ? "#FF7A22" : "#e5e7eb", color: "#121212" }} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "#999" }}>Barcode, ISBN, or your own numbering (BK-001, BK-002…)</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Book Title *</label>
                    <div className="relative">
                      <BookOpen size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                      <input value={bookForm.title} onChange={e => setBookForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Mathematics for Senior 3" required
                        className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none"
                        style={{ color: "#121212" }} />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Author</label>
                    <input value={bookForm.author} onChange={e => setBookForm(f => ({ ...f, author: e.target.value }))}
                      placeholder="e.g. REB Rwanda"
                      className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none"
                      style={{ color: "#121212" }} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Category</label>
                      <select value={bookForm.category} onChange={e => setBookForm(f => ({ ...f, category: e.target.value }))}
                        className="w-full border border-gray-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-white"
                        style={{ color: bookForm.category ? "#121212" : "#999" }}>
                        <option value="">Select…</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Shelf Location</label>
                      <div className="relative">
                        <MapPin size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                        <input value={bookForm.location} onChange={e => setBookForm(f => ({ ...f, location: e.target.value }))}
                          placeholder="A1, B3, C5…"
                          className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none"
                          style={{ color: "#121212" }} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider block mb-1.5" style={{ color: "#666" }}>Number of Copies</label>
                    <input type="number" min={1} max={99} value={bookForm.total_copies}
                      onChange={e => setBookForm(f => ({ ...f, total_copies: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none"
                      style={{ color: "#121212" }} />
                  </div>

                  <button type="submit" disabled={savingBook || !bookForm.title.trim() || !bookForm.book_number.trim()}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition"
                    style={{ background: "#FF7A22" }}>
                    {savingBook ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Register Book
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ═══════════════ LEND & RETURN ═══════════════ */}
          {tab === "lend-return" && (
            <div className="max-w-lg mx-auto space-y-3">

              {/* Big lend button */}
              <button onClick={openLendModal}
                className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition active:scale-[.98] shadow-sm"
                style={{ background: "#FF7A22" }}>
                <BookMarked size={18} /> Lend a Book to Student
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">or return a book</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Card lookup for returning */}
              <div className="bg-white rounded-3xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "#666" }}>
                  Scan student card to see their books
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <CreditCard size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                    <input value={cardInput} onChange={e => setCardInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") lookupCard(cardInput); }}
                      placeholder="Card number or student code (e.g. KMS001)…"
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none"
                      style={{ color: "#121212" }} />
                  </div>
                  {isSupported ? (
                    <button onClick={listening ? () => stopListen() : startNFC}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center transition flex-shrink-0"
                      style={{ background: listening ? "#FF7A22" : "#F5F5F5" }}>
                      <Wifi size={16} style={{ color: listening ? "#fff" : "#666" }} />
                    </button>
                  ) : (
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5F5F5" }}>
                      <WifiOff size={14} style={{ color: "#ccc" }} />
                    </div>
                  )}
                  <button onClick={() => lookupCard(cardInput)} disabled={loadingStudent || !cardInput.trim()}
                    className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0"
                    style={{ background: "#121212" }}>
                    {loadingStudent ? <Loader2 size={14} className="animate-spin" /> : "Look Up"}
                  </button>
                  <VirtualCardTap onTap={(cn) => { setCardInput(cn); lookupCard(cn); }} busy={loadingStudent} />
                </div>
                {nfcError && <p className="text-xs text-red-500 mt-2">{nfcError}</p>}
                {listening && (
                  <p className="text-[11px] mt-2.5 text-center font-semibold animate-pulse" style={{ color: "#FF7A22" }}>
                    Waiting for NFC card tap…
                  </p>
                )}
              </div>

              {/* Student panel */}
              {student && (
                <div className="bg-white rounded-3xl overflow-hidden">
                  <div className="px-4 py-3.5 flex items-center gap-3" style={{ background: "#FFF3EC" }}>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white text-base flex-shrink-0"
                      style={{ background: "#FF7A22" }}>
                      {student.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: "#121212" }}>{student.name}</p>
                      <p className="text-[11px]" style={{ color: "#666" }}>{student.studentClass}</p>
                    </div>
                    <button onClick={() => { setStudent(null); setStudentBorrows([]); setCardInput(""); setShowLendForm(false); setSelectedBook(null); setBookSearch(""); setBookResults([]); }}
                      className="p-1.5 rounded-xl hover:bg-white/60 transition">
                      <X size={15} style={{ color: "#666" }} />
                    </button>
                  </div>

                  <div className="px-4 pt-3 pb-1">
                    <p className="text-xs font-bold mb-3" style={{ color: "#121212" }}>
                      Books Taken
                      {studentBorrows.length > 0 && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px]"
                          style={{ background: "#FFF3EC", color: "#FF7A22" }}>
                          {studentBorrows.length}
                        </span>
                      )}
                    </p>

                    {studentBorrows.length === 0 ? (
                      <div className="py-6 text-center">
                        <BookOpen size={28} className="mx-auto mb-2 text-gray-200" />
                        <p className="text-sm font-semibold text-gray-400">No book taken</p>
                        <p className="text-[11px] text-gray-300 mt-0.5">This student has no active borrows</p>
                      </div>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {studentBorrows.map(b => {
                          const overdue = new Date(b.due_at) < now;
                          const daysLeft = Math.ceil((new Date(b.due_at).getTime() - now.getTime()) / 86400000);
                          const bookLoc = (b.copy?.book as { location?: string })?.location;
                          const borrowedDate = new Date(b.borrowed_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
                          const dueDate = new Date(b.due_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
                          return (
                            <div key={b.id} className="p-3 rounded-2xl space-y-2"
                              style={{ background: overdue ? "#FEF2F2" : "#F5F5F5", border: overdue ? "1px solid #FECACA" : "1px solid transparent" }}>
                              <div className="flex items-start gap-2">
                                <Book size={14} style={{ color: overdue ? "#EF4444" : "#FF7A22", flexShrink: 0, marginTop: 1 }} />
                                <p className="text-xs font-bold flex-1 min-w-0" style={{ color: "#121212" }}>
                                  {b.copy?.book?.title ?? "Unknown Book"}
                                </p>
                                {bookLoc && (
                                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-shrink-0">
                                    <MapPin size={9} /> {bookLoc}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 pl-5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Borrowed</span>
                                  <span className="text-[10px] font-semibold" style={{ color: "#121212" }}>{borrowedDate}</span>
                                </div>
                                <span className="text-gray-300 text-[10px]">→</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Return by</span>
                                  <span className={`text-[10px] font-bold ${overdue ? "text-red-600" : "text-gray-700"}`}>{dueDate}</span>
                                </div>
                                <span className={`ml-auto text-[10px] font-bold flex-shrink-0 ${overdue ? "text-red-600" : "text-green-600"}`}>
                                  {overdue ? `${Math.abs(daysLeft)}d late` : `${daysLeft}d left`}
                                </span>
                              </div>
                              <div className="flex justify-end pl-5">
                                <button onClick={() => handleReturn(b.id)} disabled={returning === b.id}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50"
                                  style={{ background: overdue ? "#EF4444" : "#121212" }}>
                                  {returning === b.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                                  Return Book
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Inline lend button */}
                  {!showLendForm && (
                    <div className="px-4 pb-4">
                      <button onClick={() => setShowLendForm(true)}
                        className="w-full py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition active:scale-95"
                        style={{ background: "#FF7A22" }}>
                        <BookMarked size={16} /> Lend a Book to {student.name.split(" ")[0]}
                      </button>
                    </div>
                  )}

                  {/* Inline lend form */}
                  {showLendForm && (
                    <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold" style={{ color: "#121212" }}>Lend a Book</p>
                        <button onClick={() => { setShowLendForm(false); setSelectedBook(null); setBookSearch(""); setBookResults([]); }}
                          className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                      <BookSearchUI onConfirm={handleLend} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════ LEND MODAL ═══════════════ */}
      {showLendModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowLendModal(false); }}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#FFF3EC" }}>
                <BookMarked size={18} style={{ color: "#FF7A22" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "#121212" }}>Lend a Book</p>
                <p className="text-[11px]" style={{ color: "#666" }}>Enter student info then pick a book</p>
              </div>
              <button onClick={() => setShowLendModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
                <X size={16} style={{ color: "#666" }} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">

              {/* Step 1 — Student */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: "#666" }}>
                  Step 1 — Student (card number or student code)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <CreditCard size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                    <input value={modalCardInput}
                      onChange={e => setModalCardInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") lookupModalStudent(modalCardInput); }}
                      placeholder="e.g. KMS001 or KNT-KMS-2026-00001"
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none"
                      style={{ color: "#121212" }} />
                  </div>
                  <button onClick={() => lookupModalStudent(modalCardInput)}
                    disabled={lookingUpModalStudent || !modalCardInput.trim()}
                    className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0"
                    style={{ background: "#121212" }}>
                    {lookingUpModalStudent ? <Loader2 size={14} className="animate-spin" /> : "Find"}
                  </button>
                  <VirtualCardTap onTap={(cn) => { setModalCardInput(cn); lookupModalStudent(cn); }} busy={lookingUpModalStudent} />
                </div>

                {modalStudent && (
                  <div className="mt-2 flex items-center gap-3 p-3 rounded-2xl" style={{ background: "#FFF3EC" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ background: "#FF7A22" }}>
                      {modalStudent.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "#121212" }}>{modalStudent.name}</p>
                      <p className="text-[11px]" style={{ color: "#666" }}>{modalStudent.studentClass}</p>
                    </div>
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  </div>
                )}
              </div>

              {/* Step 2 — Book (only after student is found) */}
              {modalStudent && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: "#666" }}>
                    Step 2 — Choose Book
                  </label>
                  <BookSearchUI onConfirm={handleModalLend} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══════════════ PENDING FINES MODAL ═══════════════ */}
      {showFinesModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowFinesModal(false); }}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: "#FEE2E2" }}>
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#121212" }}>Pending Library Fines</p>
                  <p className="text-xs text-gray-400">Overdue returns with accrued charges</p>
                </div>
              </div>
              <button onClick={() => setShowFinesModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer">
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-3">
              {finesLoading ? (
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#FF7A22]" /></div>
              ) : finesRecords.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                  <p className="text-sm font-bold text-green-700">No Pending Fines!</p>
                  <p className="text-xs text-gray-400 mt-1">All borrowed books are returned or within deadline.</p>
                </div>
              ) : (
                finesRecords.map(rec => {
                  const daysOver = rec.days_overdue ?? Math.max(1, Math.ceil((now.getTime() - new Date(rec.due_at).getTime()) / 86400000));
                  const fine = rec.accrued_fine ?? (daysOver * 200);
                  return (
                    <div key={rec.id} className="p-3.5 rounded-2xl border border-red-100 bg-red-50/40 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900">
                            {rec.student?.user?.first_name} {rec.student?.user?.last_name}
                          </p>
                          <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">
                            "{rec.copy?.book?.title ?? "Book"}"
                          </p>
                          <p className="text-[10px] text-red-500 font-semibold mt-1">
                            {daysOver} day{daysOver !== 1 ? "s" : ""} overdue · Due {new Date(rec.due_at).toLocaleDateString("en-RW", { day: "numeric", month: "short" })}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-red-600">{fine.toLocaleString()} RWF</p>
                          <p className="text-[10px] text-gray-400">accrued fine</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-red-100/60">
                        <button
                          type="button"
                          disabled={waivingFineId === rec.id}
                          onClick={() => handleWaiveFine(rec.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                        >
                          {waivingFineId === rec.id ? <Loader2 size={12} className="animate-spin" /> : "Waive Fine"}
                        </button>
                        <button
                          type="button"
                          disabled={returning === rec.id}
                          onClick={async () => {
                            await handleReturn(rec.id);
                            setFinesRecords(prev => prev.filter(r => r.id !== rec.id));
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-black disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                        >
                          {returning === rec.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                          Return Book
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
