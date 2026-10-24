"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Book, BookOpen, Plus, X, Search, AlertTriangle, CheckCircle,
  Loader2, CreditCard, RotateCcw, BookMarked, MapPin, Tag, Clock,
  Wifi, WifiOff, Users, RefreshCw, Sparkles, Check, ShieldCheck,
  History, ArrowRight,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import VirtualCardTap from "@/components/VirtualCardTap";
import { library, LibraryBorrowRecord, LibraryBook } from "@/lib/api";
import { useNFC } from "@/hooks/useNFC";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
}

function playErrorTone() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

const CATEGORIES = [
  "Mathematics", "Science", "Literature", "History", "Geography",
  "Religion", "French", "English", "Kinyarwanda", "Biology",
  "Chemistry", "Physics", "Computer Science", "Art", "Other",
];

type Tab = "home" | "catalog" | "add-book" | "lend-return";
type StudentInfo = {
  id: string;
  name: string;
  studentClass: string;
  card_number: string;
  wallet_balance?: number;
  student_code?: string;
  photo?: string | null;
  is_active?: boolean;
  is_frozen?: boolean;
  has_card?: boolean;
};
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
  const [studentHistoryList, setStudentHistoryList] = useState<LibraryBorrowRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [continuousMode, setContinuousMode] = useState(true);
  const [deskSubTab, setDeskSubTab] = useState<"card-desk" | "quick-return" | "check-book">("card-desk");
  const [returnTagInput, setReturnTagInput] = useState("");
  const [returningTag, setReturningTag] = useState(false);

  /* ── Check book in library ─────────────────────────────────── */
  const [bookCheckQuery, setBookCheckQuery] = useState("");
  const [bookCheckResults, setBookCheckResults] = useState<LibraryBook[]>([]);
  const [bookCheckLoading, setBookCheckLoading] = useState(false);

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

  /* ── NFC Routing & listener ────────────────────────────────── */
  const nfcTargetRef = useRef<"desk" | "modal">("desk");
  useEffect(() => {
    nfcTargetRef.current = showLendModal ? "modal" : "desk";
  }, [showLendModal]);

  const handleNfcCard = useCallback(async (val: string) => {
    playChime();
    if (nfcTargetRef.current === "modal") {
      setModalCardInput(val);
      await lookupModalStudent(val);
    } else {
      setCardInput(val);
      await lookupCard(val);
    }
  }, []);

  const handleNfcCardRef = useRef(handleNfcCard);
  handleNfcCardRef.current = handleNfcCard;

  const toggleNFC = useCallback(async () => {
    if (listening) {
      stopListen();
      toast("NFC scanner stopped", "info");
      return;
    }
    if (!isSupported) {
      toast("Web NFC requires Chrome on Android. For desktop testing or USB readers, use Virtual Card Tap or enter card number.", "info");
      return;
    }
    const ok = await startListen((result) => {
      handleNfcCardRef.current(result.value);
      if (!continuousMode) stopListen();
    });
    if (ok) {
      toast("NFC scanner active — tap student card against device", "success");
    }
  }, [listening, isSupported, continuousMode, startListen, stopListen, toast]);

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
    setStudentHistoryList([]);
    setShowLendForm(false);
    try {
      const res = await library.lookupStudent(query.trim());
      const s = res.data;
      setStudent({
        id: s.id,
        name: s.name,
        studentClass: s.class,
        card_number: s.card_number ?? query.trim(),
        wallet_balance: (s as any).wallet_balance ?? 0,
        student_code: s.student_code,
        photo: s.photo,
        is_active: (s as any).is_active ?? true,
        is_frozen: (s as any).is_frozen ?? false,
        has_card: s.has_card,
      });
      playChime();
      const historyRes = await library.studentHistory(s.id, 1, 30).catch(() => ({ data: [] }));
      setStudentBorrows(historyRes.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
      setStudentHistoryList(historyRes.data.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
    } catch (err) {
      // If student lookup failed, check if this is a book copy tag or barcode scanned to return
      try {
        const retRes = await library.returnBook({ copy_tag: query.trim() });
        playChime();
        const bkTitle = retRes.data.record?.copy?.book?.title ?? "Book";
        const stdUser = retRes.data.record?.student?.user;
        const stdName = stdUser ? `${stdUser.first_name} ${stdUser.last_name}` : "Student";
        const fine = retRes.data.fine_amount;
        toast(
          fine > 0
            ? `"${bkTitle}" returned for ${stdName}! Overdue fine: ${fine.toLocaleString()} RWF ${retRes.data.fine_charged_to_wallet ? "(deducted from card wallet)" : ""}`
            : `"${bkTitle}" returned successfully for ${stdName}!`,
          "success"
        );
        loadHome();
        setCardInput("");
        return;
      } catch {}

      playErrorTone();
      toast(err instanceof Error ? err.message : "Student or book tag not found — check card or student code", "error");
    } finally {
      setLoadingStudent(false);
    }
  }

  /* ── Modal student lookup ──────────────────────────────────── */
  async function lookupModalStudent(query: string) {
    if (!query.trim()) return;
    setLookingUpModalStudent(true);
    setModalStudent(null);
    if (!selectedBook) {
      setBookSearch("");
      setBookResults([]);
    }
    try {
      const res = await library.lookupStudent(query.trim());
      const s = res.data;
      setModalStudent({
        id: s.id,
        name: s.name,
        studentClass: s.class,
        card_number: s.card_number ?? query.trim(),
        wallet_balance: (s as any).wallet_balance ?? 0,
        student_code: s.student_code,
        photo: s.photo,
        is_active: (s as any).is_active ?? true,
        is_frozen: (s as any).is_frozen ?? false,
        has_card: s.has_card,
      });
      playChime();
      toast(`Selected: ${s.name}`, "info");
    } catch (err) {
      playErrorTone();
      toast(err instanceof Error ? err.message : "Student not found — check card or student code", "error");
    } finally {
      setLookingUpModalStudent(false);
    }
  }

  /* ── Renew loan ────────────────────────────────────────────── */
  async function handleRenew(borrowId: string) {
    setRenewingId(borrowId);
    try {
      const res = await library.renewBorrow(borrowId, 14);
      playChime();
      const newDue = new Date(res.data.due_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
      toast(`Loan renewed successfully! New return deadline: ${newDue}`, "success");
      if (student?.id) {
        const historyRes = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
        setStudentBorrows(historyRes.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(historyRes.data.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
      }
      library.schoolBorrows({ status: "active", limit: 50 }).then(r => setRecentBorrows(r.data)).catch(() => {});
    } catch (err) {
      playErrorTone();
      toast(err instanceof Error ? err.message : "Renewal failed", "error");
    } finally {
      setRenewingId(null);
    }
  }

  /* ── Check book in library ─────────────────────────────────── */
  async function searchBookCheck(q: string) {
    setBookCheckQuery(q);
    if (!q.trim()) {
      setBookCheckResults([]);
      return;
    }
    setBookCheckLoading(true);
    try {
      const res = await library.books({ search: q.trim(), limit: 12 });
      setBookCheckResults(res.data);
    } catch {
      setBookCheckResults([]);
    } finally {
      setBookCheckLoading(false);
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
      playChime();
      if (student?.id) {
        const borrows = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
        setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(borrows.data.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
      }
      setStats(s => ({ ...s, activeMembers: Math.max(0, s.activeMembers - 1) }));
      setRecentBorrows(prev => prev.filter(b => b.id !== borrowId));
      loadHome();
    } catch (err) {
      playErrorTone();
      toast(err instanceof Error ? err.message : "Return failed", "error");
    } finally {
      setReturning(null);
    }
  }

  /* ── Quick Return by Book Copy Tag ──────────────────────────── */
  async function handleQuickReturn(copyTag: string) {
    if (!copyTag.trim()) return;
    setReturningTag(true);
    try {
      const res = await library.returnBook({ copy_tag: copyTag.trim() });
      playChime();
      const bkTitle = res.data.record?.copy?.book?.title ?? "Book";
      const stdUser = res.data.record?.student?.user;
      const stdName = stdUser ? `${stdUser.first_name} ${stdUser.last_name}` : "Student";
      const fine = res.data.fine_amount;
      toast(
        fine > 0
          ? `"${bkTitle}" returned for ${stdName}! Overdue fine: ${fine.toLocaleString()} RWF ${res.data.fine_charged_to_wallet ? "(deducted from card wallet)" : ""}`
          : `"${bkTitle}" returned successfully for ${stdName}!`,
        "success"
      );
      setReturnTagInput("");
      loadHome();
      if (student?.id) {
        const borrows = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
        setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(borrows.data.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
      }
    } catch (err) {
      playErrorTone();
      toast(err instanceof Error ? err.message : "Failed to return book with this tag", "error");
    } finally {
      setReturningTag(false);
    }
  }

  /* ── Book search ───────────────────────────────────────────── */
  async function searchBooks(q: string) {
    setSearchingBook(true);
    try {
      const res = await library.books({ search: q.trim() || undefined, limit: 12 });
      setBookResults(res.data as unknown as BookOption[]);
    } catch {
      setBookResults([]);
    } finally {
      setSearchingBook(false);
    }
  }

  /* ── Lend (panel, used from return-tab) ────────────────────── */
  async function handleLend() {
    if (!student || !selectedBook) return;
    setLending(true);
    try {
      await library.borrowBook({
        book_id: selectedBook.id,
        student_id: student.id,
        card_number: student.card_number,
        student_code: student.student_code,
        due_days: dueDays,
      });
      playChime();
      toast(`"${selectedBook.title}" lent to ${student.name}. Due in ${dueDays} days.`, "success");
      setShowLendForm(false);
      setSelectedBook(null);
      setBookSearch("");
      setBookResults([]);
      const borrows = await library.studentHistory(student.id, 1, 30).catch(() => ({ data: [] }));
      setStudentBorrows(borrows.data.filter((b: LibraryBorrowRecord) => !b.returned_at));
      setStudentHistoryList(borrows.data.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
      setStats(s => ({ ...s, activeMembers: s.activeMembers + 1 }));
      loadHome();
    } catch (err) {
      playErrorTone();
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
      await library.borrowBook({
        book_id: selectedBook.id,
        student_id: modalStudent.id,
        card_number: modalStudent.card_number,
        student_code: modalStudent.student_code,
        due_days: dueDays,
      });
      playChime();
      toast(`"${selectedBook.title}" lent to ${modalStudent.name}. Due in ${dueDays} days.`, "success");
      setShowLendModal(false);
      setSelectedBook(null);
      setBookSearch("");
      setBookResults([]);
      setStats(s => ({ ...s, activeMembers: s.activeMembers + 1 }));
      loadHome();
      // Refresh overview list
      library.schoolBorrows({ status: "active", limit: 50 }).then(r => setRecentBorrows(r.data)).catch(() => {});
    } catch (err) {
      playErrorTone();
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
    useEffect(() => {
      if (!selectedBook && bookResults.length === 0) {
        searchBooks("");
      }
    }, [selectedBook]);

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
            <div className="max-w-2xl mx-auto space-y-4">

              {/* Sub-tab Switcher */}
              <div className="flex items-center justify-between gap-2 p-1.5 bg-gray-100 rounded-2xl">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDeskSubTab("card-desk")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      deskSubTab === "card-desk" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <CreditCard size={14} className={deskSubTab === "card-desk" ? "text-[#FF7A22]" : ""} />
                    Card Terminal
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeskSubTab("quick-return")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      deskSubTab === "quick-return" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <RotateCcw size={14} className={deskSubTab === "quick-return" ? "text-[#FF7A22]" : ""} />
                    Scan Book to Return
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeskSubTab("check-book")}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      deskSubTab === "check-book" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Search size={14} className={deskSubTab === "check-book" ? "text-[#FF7A22]" : ""} />
                    Check Book
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openLendModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#FF7A22] hover:bg-[#e0691b] flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <BookMarked size={14} /> Quick Lend
                </button>
              </div>

              {/* SUB-TAB 1: CARD TERMINAL (CHECK BOOKS / RETURN / LEND) */}
              {deskSubTab === "card-desk" && (
                <div className="space-y-3">
                  {/* Scanner Card */}
                  <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <Wifi size={16} className={listening ? "text-[#FF7A22] animate-pulse" : "text-gray-400"} />
                          Student NFC Card Terminal
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Tap card or enter student code to check borrowed books, return, or lend
                        </p>
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={continuousMode}
                          onChange={(e) => setContinuousMode(e.target.checked)}
                          className="rounded accent-[#FF7A22]"
                        />
                        Continuous Desk Mode
                      </label>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <div className="relative flex-1">
                        <CreditCard size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                        <input
                          value={cardInput}
                          onChange={(e) => setCardInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") lookupCard(cardInput); }}
                          placeholder="Tap card, scan barcode, or enter student code (e.g. KMS001)…"
                          className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#FF7A22] text-gray-900"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={toggleNFC}
                        title={listening ? "Stop NFC Reader" : "Start NFC Card Tap"}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer ${
                          listening
                            ? "bg-[#FF7A22] text-white shadow-md animate-pulse ring-2 ring-orange-200"
                            : "bg-orange-50 text-[#FF7A22] hover:bg-orange-100 border border-orange-200"
                        }`}
                      >
                        <Wifi size={15} />
                        {listening ? "Listening…" : "NFC"}
                      </button>

                      <button
                        type="button"
                        onClick={() => lookupCard(cardInput)}
                        disabled={loadingStudent || !cardInput.trim()}
                        className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0 bg-gray-900 hover:bg-black cursor-pointer"
                      >
                        {loadingStudent ? <Loader2 size={14} className="animate-spin" /> : "Check"}
                      </button>

                      <VirtualCardTap
                        onTap={(cn) => {
                          setCardInput(cn);
                          lookupCard(cn);
                        }}
                        busy={loadingStudent}
                      />
                    </div>

                    {/* Quick Student Card Tap Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Tap Card:</span>
                      {[
                        { name: "Hirwa Jean", code: "KNT-KMS-2026-90001", badge: "Physics" },
                        { name: "Uwase Marie", code: "KNT-KMS-2026-90002", badge: "Math" },
                        { name: "Nkurunziza Eric", code: "KNT-KMS-2026-00003", badge: "Overdue" },
                        { name: "Uwimana Grace", code: "KNT-KMS-2026-00006", badge: "Overdue" },
                        { name: "Habimana Patrick", code: "KNT-KMS-2026-00005", badge: "Biology" },
                      ].map(st => (
                        <button
                          key={st.code}
                          type="button"
                          onClick={() => { setCardInput(st.code); lookupCard(st.code); }}
                          className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-gray-50 hover:bg-orange-50 hover:text-[#FF7A22] border border-gray-200 text-gray-700 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                          <span>💳</span>
                          <span>{st.name}</span>
                          {st.badge === "Overdue" ? (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-red-100 text-red-600 font-extrabold">Overdue</span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-orange-100 text-orange-700">{st.badge}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {nfcError && <p className="text-xs text-red-500 mt-2 font-medium">{nfcError}</p>}

                    {listening && (
                      <div className="mt-3 p-2.5 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#FF7A22] flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A22] animate-ping inline-block" />
                          Waiting for student NFC card tap — hold card close to device
                        </span>
                        <button
                          type="button"
                          onClick={stopListen}
                          className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer"
                        >
                          Stop
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Student Loaded Section */}
                  {student ? (
                    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                      <div className="px-5 py-4 flex items-center gap-3.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0 bg-[#FF7A22] shadow-sm">
                          {student.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-gray-900 truncate">{student.name}</h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                              Card Verified
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 mt-0.5">
                            <span>Class: <strong>{student.studentClass || "General"}</strong></span>
                            {student.student_code && <span>ID: <strong>{student.student_code}</strong></span>}
                            <span>Card: <strong>{student.card_number}</strong></span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Card Wallet</p>
                          <p className="text-sm font-bold text-gray-900">{(student.wallet_balance ?? 0).toLocaleString()} RWF</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setStudent(null);
                            setStudentBorrows([]);
                            setStudentHistoryList([]);
                            setCardInput("");
                            setShowLendForm(false);
                            setSelectedBook(null);
                            setBookSearch("");
                            setBookResults([]);
                          }}
                          className="p-2 rounded-xl hover:bg-white/80 text-gray-500 hover:text-gray-800 transition cursor-pointer"
                          title="Clear and scan next student"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-[#FF7A22]" />
                            <h4 className="text-sm font-bold text-gray-900">
                              Books In Possession
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              studentBorrows.length > 0 ? "bg-orange-100 text-[#FF7A22]" : "bg-gray-100 text-gray-600"
                            }`}>
                              {studentBorrows.length} {studentBorrows.length === 1 ? "book" : "books"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {studentHistoryList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-xs font-semibold text-gray-500 hover:text-[#FF7A22] flex items-center gap-1 cursor-pointer"
                              >
                                <History size={13} />
                                {showHistory ? "Hide Past History" : `History (${studentHistoryList.length})`}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowLendForm(!showLendForm)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm ${
                                showLendForm ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "text-white bg-[#FF7A22] hover:bg-[#e0691b]"
                              }`}
                            >
                              {showLendForm ? <X size={13} /> : <Plus size={13} />} {showLendForm ? "Cancel Lend" : "Lend Book"}
                            </button>
                          </div>
                        </div>

                        {studentBorrows.length === 0 ? (
                          <div className="py-8 px-4 text-center rounded-2xl bg-green-50/50 border border-green-100 mb-4">
                            <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                            <p className="text-sm font-bold text-green-800">No Books Currently Checked Out</p>
                            <p className="text-xs text-green-600 mt-0.5">
                              This student does not owe any books or pending fines. All clear!
                            </p>
                            {!showLendForm && (
                              <button
                                type="button"
                                onClick={() => setShowLendForm(true)}
                                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#FF7A22] hover:bg-[#e0691b] inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <BookMarked size={14} /> Lend a Book to {student.name.split(" ")[0]}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2.5 mb-4">
                            {studentBorrows.map((b) => {
                              const overdue = new Date(b.due_at) < now;
                              const daysLeft = Math.ceil((new Date(b.due_at).getTime() - now.getTime()) / 86400000);
                              const bookLoc = (b.copy?.book as { location?: string })?.location;
                              const borrowedDate = new Date(b.borrowed_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
                              const dueDate = new Date(b.due_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
                              const diffDays = overdue ? Math.max(1, Math.ceil((now.getTime() - new Date(b.due_at).getTime()) / 86400000)) : 0;
                              const fineEstimate = diffDays * 200;

                              return (
                                <div
                                  key={b.id}
                                  className={`p-3.5 rounded-2xl border transition ${
                                    overdue ? "bg-red-50/60 border-red-200" : "bg-gray-50 border-gray-200/80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <Book size={16} className={`mt-0.5 flex-shrink-0 ${overdue ? "text-red-500" : "text-[#FF7A22]"}`} />
                                      <div>
                                        <p className="text-xs font-bold text-gray-900 leading-tight">
                                          {b.copy?.book?.title ?? "Unknown Book"}
                                        </p>
                                        {b.copy?.book?.author && (
                                          <p className="text-[11px] text-gray-500 mt-0.5">by {b.copy?.book?.author}</p>
                                        )}
                                        {bookLoc && (
                                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                            <MapPin size={10} /> Shelf: {bookLoc}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right flex-shrink-0">
                                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                        overdue ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                      }`}>
                                        {overdue ? `${diffDays}d OVERDUE` : `${daysLeft}d left`}
                                      </span>
                                      {overdue && (
                                        <p className="text-[10px] font-bold text-red-600 mt-1">Fine: {fineEstimate.toLocaleString()} RWF</p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 pl-6 mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                                    <span>Borrowed: <strong>{borrowedDate}</strong></span>
                                    <span>→</span>
                                    <span>Due: <strong className={overdue ? "text-red-600" : "text-gray-800"}>{dueDate}</strong></span>
                                    {b.renewed_count ? <span className="text-[10px] text-blue-600 font-semibold">(Renewed {b.renewed_count}x)</span> : null}
                                  </div>

                                  <div className="flex items-center justify-end gap-2 pl-6 mt-3">
                                    <button
                                      type="button"
                                      disabled={renewingId === b.id || (b.renewed_count ?? 0) >= 3}
                                      onClick={() => handleRenew(b.id)}
                                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                                      title={(b.renewed_count ?? 0) >= 3 ? "Max renewals reached" : "Extend loan deadline by 14 days"}
                                    >
                                      {renewingId === b.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                      Renew (+14d)
                                    </button>

                                    <button
                                      type="button"
                                      disabled={returning === b.id}
                                      onClick={() => handleReturn(b.id)}
                                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm ${
                                        overdue ? "bg-red-600 hover:bg-red-700" : "bg-gray-900 hover:bg-black"
                                      }`}
                                    >
                                      {returning === b.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                      Return Book
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Past history expanded */}
                        {showHistory && studentHistoryList.length > 0 && (
                          <div className="mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200">
                            <h5 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                              <History size={13} /> Past Borrowing History
                            </h5>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {studentHistoryList.map((h) => (
                                <div key={h.id} className="text-[11px] p-2 bg-white rounded-xl flex items-center justify-between border border-gray-100">
                                  <span className="font-semibold text-gray-800 truncate">{h.copy?.book?.title ?? "Book"}</span>
                                  <span className="text-gray-400 flex-shrink-0">
                                    Returned {h.returned_at ? new Date(h.returned_at).toLocaleDateString("en-RW", { day: "numeric", month: "short" }) : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inline Lend Form */}
                        {showLendForm && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-bold text-gray-900">Lend a Book to {student.name}</p>
                              <button
                                type="button"
                                onClick={() => { setShowLendForm(false); setSelectedBook(null); setBookSearch(""); setBookResults([]); }}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <X size={15} />
                              </button>
                            </div>
                            <BookSearchUI onConfirm={handleLend} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-gray-100">
                      <div className="w-14 h-14 rounded-2xl bg-orange-50 mx-auto flex items-center justify-center text-[#FF7A22] mb-3">
                        <BookMarked size={28} />
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">Library Desk Ready</h4>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                        Tap a student NFC card, scan their barcode, or enter student code above to check borrowed books, renew, or return.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5 max-w-md mx-auto text-left">
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-sm">💳</span>
                          <p className="text-xs font-bold text-gray-900 mt-1">1. Check Books</p>
                          <p className="text-[10px] text-gray-500">Tap card to see books in possession and deadlines.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-sm">🔄</span>
                          <p className="text-xs font-bold text-gray-900 mt-1">2. Return Books</p>
                          <p className="text-[10px] text-gray-500">Tap card, click Return to clear fine and update wallet.</p>
                        </div>
                        <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-sm">📚</span>
                          <p className="text-xs font-bold text-gray-900 mt-1">3. Lend Books</p>
                          <p className="text-[10px] text-gray-500">Pick book, set return days, and confirm loan.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: SCAN BOOK TAG TO RETURN */}
              {deskSubTab === "quick-return" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <RotateCcw size={16} className="text-[#FF7A22]" />
                      Scan Book Tag or Barcode to Return
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Scan book copy tag, barcode, or ISBN to immediately return the book, calculate fine, and update card wallet
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                        <input
                          value={returnTagInput}
                          onChange={(e) => setReturnTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleQuickReturn(returnTagInput); }}
                          placeholder="Scan or enter book tag (e.g. PHYS-S5-01, MATH-S4-01, LIT-TFA-01)…"
                          className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#FF7A22] text-gray-900"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        disabled={returningTag || !returnTagInput.trim()}
                        onClick={() => handleQuickReturn(returnTagInput)}
                        className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 bg-[#FF7A22] hover:bg-[#e0691b] cursor-pointer shadow-sm transition active:scale-95"
                      >
                        {returningTag ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Return Book
                      </button>
                    </div>

                    {/* Quick Return Chips for Active Borrows */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Click to Return Active Book Copy:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { tag: "PHYS-S5-01", title: "Principles of Physics S5", student: "Hirwa Jean" },
                          { tag: "MATH-S4-01", title: "New General Math S4", student: "Uwase Marie" },
                          { tag: "LIT-TFA-01", title: "Things Fall Apart", student: "Nkurunziza Eric", overdue: true },
                          { tag: "CHEM-ORG-01", title: "Organic Chemistry", student: "Uwimana Grace", overdue: true },
                          { tag: "BIO-CMP-01", title: "Campbell Biology", student: "Habimana Patrick" },
                        ].map(b => (
                          <button
                            key={b.tag}
                            type="button"
                            onClick={() => { setReturnTagInput(b.tag); handleQuickReturn(b.tag); }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                              b.overdue
                                ? "bg-red-50/70 border-red-200 text-red-800 hover:bg-red-100"
                                : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-orange-50 hover:text-[#FF7A22]"
                            }`}
                          >
                            <Tag size={11} className={b.overdue ? "text-red-500" : "text-gray-400"} />
                            <span className="font-bold">{b.tag}</span>
                            <span className="text-gray-500 text-[11px]">({b.student})</span>
                            {b.overdue && <span className="text-[9px] bg-red-100 text-red-600 font-extrabold px-1 rounded">Overdue</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: CHECK BOOK IN LIBRARY */}
              {deskSubTab === "check-book" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <Search size={16} className="text-[#FF7A22]" />
                      Check Book Availability in Library
                    </h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Search by book title, author, category, or ISBN to check shelf location and availability
                    </p>

                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                      <input
                        value={bookCheckQuery}
                        onChange={(e) => searchBookCheck(e.target.value)}
                        placeholder="Search by title, author, ISBN (e.g. Mathematics, BK-001)…"
                        className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#FF7A22] text-gray-900"
                        autoFocus
                      />
                      {bookCheckLoading && <Loader2 size={14} className="animate-spin absolute right-3.5 top-[13px] text-gray-400" />}
                    </div>
                  </div>

                  {bookCheckResults.length > 0 && (
                    <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                        Found {bookCheckResults.length} {bookCheckResults.length === 1 ? "book" : "books"}
                      </p>
                      {bookCheckResults.map((bk) => {
                        const avail = bk.available_copies ?? 0;
                        return (
                          <div key={bk.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{bk.title}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {bk.author ? `by ${bk.author}` : "Author unknown"} · {bk.category ?? "General"}
                              </p>
                              {bk.location && (
                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                  <MapPin size={10} /> Shelf: <strong>{bk.location}</strong>
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                avail > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                              }`}>
                                {avail} / {bk.total_copies} In Stock
                              </span>
                              <button
                                type="button"
                                disabled={avail === 0}
                                onClick={() => openLendForBook(bk as unknown as BookOption)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#FF7A22] hover:bg-[#e0691b] disabled:opacity-40 flex items-center gap-1 shadow-sm cursor-pointer"
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
                <p className="text-[11px]" style={{ color: "#666" }}>Tap student NFC card or enter code, then confirm book</p>
              </div>
              <button onClick={() => setShowLendModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                <X size={16} style={{ color: "#666" }} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">

              {/* Step 1 — Student with NFC and Virtual Card Tap */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: "#666" }}>
                  Step 1 — Identify Student (Tap NFC Card or enter student code)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <CreditCard size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                    <input
                      value={modalCardInput}
                      onChange={e => setModalCardInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") lookupModalStudent(modalCardInput); }}
                      placeholder="e.g. KMS001 or KNT-KMS-2026-00001"
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#FF7A22]"
                      style={{ color: "#121212" }}
                    />
                  </div>

                  {/* NFC Tap Button in Modal */}
                  <button
                    type="button"
                    onClick={toggleNFC}
                    title={listening ? "NFC active - click to stop" : "Tap NFC card"}
                    className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1 transition flex-shrink-0 cursor-pointer ${
                      listening
                        ? "bg-[#FF7A22] text-white shadow-md animate-pulse ring-2 ring-orange-200"
                        : "bg-orange-50 text-[#FF7A22] hover:bg-orange-100 border border-orange-200"
                    }`}
                  >
                    <Wifi size={14} />
                    {listening ? "Listening…" : "NFC"}
                  </button>

                  <button
                    onClick={() => lookupModalStudent(modalCardInput)}
                    disabled={lookingUpModalStudent || !modalCardInput.trim()}
                    className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0 cursor-pointer"
                    style={{ background: "#121212" }}
                  >
                    {lookingUpModalStudent ? <Loader2 size={14} className="animate-spin" /> : "Find"}
                  </button>

                  <VirtualCardTap
                    onTap={(cn) => {
                      setModalCardInput(cn);
                      lookupModalStudent(cn);
                    }}
                    busy={lookingUpModalStudent}
                  />
                </div>

                {/* Quick Student Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Pick:</span>
                  {[
                    { name: "Hirwa Jean", code: "KNT-KMS-2026-90001" },
                    { name: "Uwase Marie", code: "KNT-KMS-2026-90002" },
                    { name: "Nkurunziza Eric", code: "KNT-KMS-2026-00003" },
                    { name: "Habimana Patrick", code: "KNT-KMS-2026-00005" },
                    { name: "Uwimana Grace", code: "KNT-KMS-2026-00006" },
                  ].map(st => (
                    <button
                      key={st.code}
                      type="button"
                      onClick={() => { setModalCardInput(st.code); lookupModalStudent(st.code); }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-100 hover:bg-orange-50 hover:text-[#FF7A22] text-gray-700 transition cursor-pointer"
                    >
                      {st.name}
                    </button>
                  ))}
                </div>

                {listening && (
                  <div className="mt-2.5 p-2 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between text-xs text-[#FF7A22] font-semibold animate-pulse">
                    <span className="flex items-center gap-1.5">
                      <Wifi size={13} className="animate-bounce" />
                      Waiting for student NFC card tap…
                    </span>
                    <button type="button" onClick={stopListen} className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer">
                      Stop
                    </button>
                  </div>
                )}

                {modalStudent && (
                  <div className="mt-2.5 flex items-center gap-3 p-3 rounded-2xl border border-orange-100" style={{ background: "#FFF3EC" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ background: "#FF7A22" }}>
                      {modalStudent.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "#121212" }}>{modalStudent.name}</p>
                      <p className="text-[11px]" style={{ color: "#666" }}>
                        {modalStudent.studentClass} · Card: {modalStudent.card_number}
                        {modalStudent.wallet_balance !== undefined && (
                          <span className="ml-1 text-gray-700 font-semibold">({modalStudent.wallet_balance.toLocaleString()} RWF)</span>
                        )}
                      </p>
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
