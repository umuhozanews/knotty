"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Book, BookOpen, Plus, X, Search, AlertTriangle, CheckCircle,
  Loader2, CreditCard, RotateCcw, BookMarked, MapPin, Tag, Clock,
  Wifi, Users, RefreshCw, Sparkles, Check,
  History, ArrowRight, ChevronLeft,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import type { LibraryBorrowRecord, LibraryBook } from "@/lib/api";
import { supabaseLibraryService, supabaseCanteenService, supabaseStudentService } from "@/lib/supabase/services";
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

const LEVEL_CATEGORIES: Record<string, string[]> = {
  "S1": ["Mathematics S1", "Geography S1", "English S1", "Biology S1", "Chemistry S1", "Physics S1", "Computer Science S1", "French S1", "Kinyarwanda S1", "History S1", "Religion S1", "Literature S1"],
  "S2": ["Mathematics S2", "Geography S2", "English S2", "Biology S2", "Chemistry S2", "Physics S2", "Computer Science S2", "French S2", "Kinyarwanda S2", "History S2", "Religion S2", "Literature S2"],
  "S3": ["Mathematics S3", "Geography S3", "English S3", "Biology S3", "Chemistry S3", "Physics S3", "Computer Science S3", "French S3", "Kinyarwanda S3", "History S3", "Religion S3", "Literature S3"],
  "A-Level": ["Mathematics A", "Biology A", "Chemistry A", "Physics A", "Geography A", "History A", "Economics A", "Literature A", "Computer Science A", "French A", "Kinyarwanda A", "Entrepreneurship A"],
  "Other": ["Fiction", "Reference", "Textbook", "Other"],
};

type Tab = "home" | "overview" | "catalog" | "add-book" | "lend-return";
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
type NameResult = { id: string; name: string; studentCode: string; className: string; hasCard: boolean };

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
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
  const [catalogLevel, setCatalogLevel] = useState("All");

  /* ── Add Book ──────────────────────────────────────────────── */
  const [addBookLevel, setAddBookLevel] = useState("");
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
  const [deskSubTab, setDeskSubTab] = useState<"card-desk" | "name-search" | "quick-return" | "check-book">("card-desk");
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<NameResult[]>([]);
  const [nameSearching, setNameSearching] = useState(false);
  const [modalSearchMode, setModalSearchMode] = useState<"card" | "name">("card");
  const [modalNameQuery, setModalNameQuery] = useState("");
  const [modalNameResults, setModalNameResults] = useState<NameResult[]>([]);
  const [modalNameSearching, setModalNameSearching] = useState(false);
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

  // Stop NFC on unmount so the listener doesn't fire on other pages
  useEffect(() => () => stopListen(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNfcCard = useCallback(async (val: string, isUid = false) => {
    playChime();
    // Physical NFC taps deliver a raw UID — resolve it to a card_number first.
    let identifier = val;
    if (isUid && user?.school_id) {
      try {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, val);
        if (holder?.card_number) identifier = holder.card_number;
      } catch { /* fall through with raw val */ }
    }
    if (nfcTargetRef.current === "modal") {
      setModalCardInput(identifier);
      await lookupModalStudent(identifier);
    } else {
      setCardInput(identifier);
      await lookupCard(identifier);
    }
  }, [user?.school_id]);

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
      handleNfcCardRef.current(result.value, result.type === "uid");
      if (!continuousMode) stopListen();
    });
    if (ok) {
      toast("NFC scanner active — tap student card against device", "success");
    }
  }, [listening, isSupported, continuousMode, startListen, stopListen, toast]);

  /* ── Data load ─────────────────────────────────────────────── */
  const loadHome = useCallback(async () => {
    if (!user?.school_id) return;
    setLoading(true);
    try {
      const [statsData, borrowsData] = await Promise.all([
        supabaseLibraryService.getStats(user.school_id).catch(() => null),
        supabaseLibraryService.listSchoolBorrows(user.school_id, "active", 50).catch(() => []),
      ]);
      if (statsData) setStats(s => ({ ...s, ...statsData }));
      setRecentBorrows(borrowsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { if (!authLoading) loadHome(); }, [authLoading, loadHome]);

  /* ── Load catalog ──────────────────────────────────────────── */
  const loadCatalog = useCallback(async (searchQuery = catalogSearch, category = catalogCategory) => {
    if (!user?.school_id) return;
    setCatalogLoading(true);
    try {
      const books = await supabaseLibraryService.listBooks(
        user.school_id,
        searchQuery.trim() || null,
        category !== "All" ? category : null,
        100,
      );
      setCatalogBooks(books);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load catalog", "error");
    } finally {
      setCatalogLoading(false);
    }
  }, [user, catalogSearch, catalogCategory, toast]);

  useEffect(() => {
    if (tab === "catalog") {
      loadCatalog();
    }
  }, [tab, loadCatalog]);

  async function openFinesModal() {
    setShowFinesModal(true);
    setFinesLoading(true);
    try {
      const records = user?.school_id
        ? await supabaseLibraryService.listOverdueBorrows(user.school_id, 50).catch(() => null)
        : null;
      if (records && records.length > 0) {
        setFinesRecords(records);
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
      if (!user?.school_id) return;
      await supabaseLibraryService.waiveFine(user.school_id, borrowId);
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
    setModalSearchMode("card");
    setModalNameQuery("");
    setModalNameResults([]);
    setShowLendModal(true);
  }

  /* ── Return-tab card lookup ────────────────────────────────── */
  async function lookupCard(query: string) {
    if (!query.trim() || !user?.school_id) return;
    setLoadingStudent(true);
    setStudent(null);
    setStudentBorrows([]);
    setStudentHistoryList([]);
    setShowLendForm(false);
    const cleanQuery = query.trim();
    try {
      let s: Awaited<ReturnType<typeof supabaseLibraryService.lookupStudent>> | null = null;
      try {
        s = await supabaseLibraryService.lookupStudent(user.school_id, cleanQuery);
      } catch (origErr) {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cleanQuery).catch(() => null);
        if (holder) {
          s = {
            id: holder.student_id,
            name: holder.legal_name,
            class: holder.class_name || "",
            card_number: holder.card_number || null,
            has_card: Boolean(holder.card_number),
            student_code: holder.admission_number,
            photo: holder.profile_photo_path ?? null,
            is_active: holder.card_status === "active",
            is_frozen: holder.is_frozen ?? false,
          };
        } else {
          throw origErr;
        }
      }
      if (!s) throw new Error("Student or book tag not found");
      setStudent({
        id: s.id,
        name: s.name,
        studentClass: s.class,
        card_number: s.card_number ?? cleanQuery,
        wallet_balance: 0,
        student_code: s.student_code,
        photo: s.photo,
        is_active: s.is_active,
        is_frozen: s.is_frozen,
        has_card: s.has_card,
      });
      playChime();
      const history = await supabaseLibraryService.studentBorrowHistory(user.school_id, s.id, 30).catch(() => []);
      setStudentBorrows(history.filter((b: LibraryBorrowRecord) => !b.returned_at));
      setStudentHistoryList(history.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
    } catch (err) {
      // If student lookup failed, check if this is a book copy tag or barcode scanned to return
      try {
        const ret = await supabaseLibraryService.returnBook({ schoolId: user.school_id, copyTag: cleanQuery });
        playChime();
        toast(
          ret.fineAmount > 0
            ? `Book returned! Overdue fine: ${ret.fineAmount.toLocaleString()} RWF${ret.fineChargedToWallet ? " (deducted from card wallet)" : ""}`
            : "Book returned successfully!",
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
    if (!query.trim() || !user?.school_id) return;
    setLookingUpModalStudent(true);
    setModalStudent(null);
    if (!selectedBook) {
      setBookSearch("");
      setBookResults([]);
    }
    const cleanQuery = query.trim();
    try {
      let s: Awaited<ReturnType<typeof supabaseLibraryService.lookupStudent>> | null = null;
      try {
        s = await supabaseLibraryService.lookupStudent(user.school_id, cleanQuery);
      } catch (origErr) {
        const holder = await supabaseCanteenService.lookupCardHolderByNfcUid(user.school_id, cleanQuery).catch(() => null);
        if (holder) {
          s = {
            id: holder.student_id,
            name: holder.legal_name,
            class: holder.class_name || "",
            card_number: holder.card_number || null,
            has_card: Boolean(holder.card_number),
            student_code: holder.admission_number,
            photo: holder.profile_photo_path ?? null,
            is_active: holder.card_status === "active",
            is_frozen: holder.is_frozen ?? false,
          };
        } else {
          throw origErr;
        }
      }
      if (!s) throw new Error("Student not found — check card number or student code");
      setModalStudent({
        id: s.id,
        name: s.name,
        studentClass: s.class,
        card_number: s.card_number ?? cleanQuery,
        wallet_balance: 0,
        student_code: s.student_code,
        photo: s.photo,
        is_active: s.is_active,
        is_frozen: s.is_frozen,
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
    if (!user?.school_id) return;
    setRenewingId(borrowId);
    try {
      const dueAt = await supabaseLibraryService.renewBorrow(user.school_id, borrowId, 14);
      playChime();
      const newDue = new Date(dueAt).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" });
      toast(`Loan renewed successfully! New return deadline: ${newDue}`, "success");
      if (student?.id) {
        const history = await supabaseLibraryService.studentBorrowHistory(user.school_id, student.id, 30).catch(() => []);
        setStudentBorrows(history.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(history.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
      }
      supabaseLibraryService.listSchoolBorrows(user.school_id, "active", 50).then(r => setRecentBorrows(r)).catch(() => {});
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
    if (!user?.school_id) return;
    setBookCheckLoading(true);
    try {
      const books = await supabaseLibraryService.listBooks(user.school_id, q.trim(), null, 12);
      setBookCheckResults(books);
    } catch {
      setBookCheckResults([]);
    } finally {
      setBookCheckLoading(false);
    }
  }

  async function searchByName(q: string) {
    setNameQuery(q);
    if (!q.trim() || !user?.school_id) { setNameResults([]); return; }
    setNameSearching(true);
    try {
      const students = await supabaseStudentService.listSchoolStudents(user.school_id, null, q.trim());
      setNameResults(students.map(s => ({
        id: s.id,
        name: `${s.user.first_name} ${s.user.last_name}`.trim(),
        studentCode: s.student_code,
        className: s.class?.name ?? "",
        hasCard: s.card !== null,
      })));
    } catch {
      setNameResults([]);
    } finally {
      setNameSearching(false);
    }
  }

  async function searchModalByName(q: string) {
    setModalNameQuery(q);
    if (!q.trim() || !user?.school_id) { setModalNameResults([]); return; }
    setModalNameSearching(true);
    try {
      const students = await supabaseStudentService.listSchoolStudents(user.school_id, null, q.trim());
      setModalNameResults(students.map(s => ({
        id: s.id,
        name: `${s.user.first_name} ${s.user.last_name}`.trim(),
        studentCode: s.student_code,
        className: s.class?.name ?? "",
        hasCard: s.card !== null,
      })));
    } catch {
      setModalNameResults([]);
    } finally {
      setModalNameSearching(false);
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
    setModalSearchMode("card");
    setModalNameQuery("");
    setModalNameResults([]);
  }

  /* ── Return ────────────────────────────────────────────────── */
  async function handleReturn(borrowId: string) {
    if (!user?.school_id) return;
    setReturning(borrowId);
    try {
      const ret = await supabaseLibraryService.returnBook({ schoolId: user.school_id, borrowId });
      const fine = ret.fineAmount;
      toast(fine > 0
        ? `Returned — fine ${fine.toLocaleString()} RWF ${ret.fineChargedToWallet ? "deducted from card" : "(settle manually)"}`
        : "Book returned successfully!", "success");
      playChime();
      if (student?.id) {
        const history = await supabaseLibraryService.studentBorrowHistory(user.school_id, student.id, 30).catch(() => []);
        setStudentBorrows(history.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(history.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
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
    if (!copyTag.trim() || !user?.school_id) return;
    setReturningTag(true);
    try {
      const ret = await supabaseLibraryService.returnBook({ schoolId: user.school_id, copyTag: copyTag.trim() });
      playChime();
      toast(
        ret.fineAmount > 0
          ? `Book returned! Overdue fine: ${ret.fineAmount.toLocaleString()} RWF${ret.fineChargedToWallet ? " (deducted from card wallet)" : ""}`
          : "Book returned successfully!",
        "success"
      );
      setReturnTagInput("");
      loadHome();
      if (student?.id) {
        const history = await supabaseLibraryService.studentBorrowHistory(user.school_id, student.id, 30).catch(() => []);
        setStudentBorrows(history.filter((b: LibraryBorrowRecord) => !b.returned_at));
        setStudentHistoryList(history.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
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
    if (!user?.school_id) return;
    setSearchingBook(true);
    try {
      const books = await supabaseLibraryService.listBooks(user.school_id, q.trim() || null, null, 12);
      setBookResults(books as unknown as BookOption[]);
    } catch {
      setBookResults([]);
    } finally {
      setSearchingBook(false);
    }
  }

  /* ── Lend (panel, used from return-tab) ────────────────────── */
  async function handleLend() {
    if (!student || !selectedBook || !user?.school_id) return;
    setLending(true);
    try {
      await supabaseLibraryService.borrowBook({
        schoolId: user.school_id,
        bookId: selectedBook.id,
        studentId: student.id,
        dueDays,
      });
      playChime();
      toast(`"${selectedBook.title}" lent to ${student.name}. Due in ${dueDays} days.`, "success");
      setShowLendForm(false);
      setSelectedBook(null);
      setBookSearch("");
      setBookResults([]);
      const history = await supabaseLibraryService.studentBorrowHistory(user.school_id, student.id, 30).catch(() => []);
      setStudentBorrows(history.filter((b: LibraryBorrowRecord) => !b.returned_at));
      setStudentHistoryList(history.filter((b: LibraryBorrowRecord) => Boolean(b.returned_at)));
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
    if (!modalStudent || !selectedBook || !user?.school_id) return;
    setLending(true);
    try {
      await supabaseLibraryService.borrowBook({
        schoolId: user.school_id,
        bookId: selectedBook.id,
        studentId: modalStudent.id,
        dueDays,
      });
      playChime();
      toast(`"${selectedBook.title}" lent to ${modalStudent.name}. Due in ${dueDays} days.`, "success");
      setShowLendModal(false);
      setSelectedBook(null);
      setBookSearch("");
      setBookResults([]);
      setStats(s => ({ ...s, activeMembers: s.activeMembers + 1 }));
      loadHome();
      supabaseLibraryService.listSchoolBorrows(user.school_id, "active", 50).then(r => setRecentBorrows(r)).catch(() => {});
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
      if (!user?.school_id) throw new Error("Not authenticated");
      await supabaseLibraryService.createBook({
        schoolId: user.school_id,
        title: bookForm.title,
        author: bookForm.author || "Unknown",
        isbn: bookForm.book_number,
        category: bookForm.category || null,
        totalCopies: bookForm.total_copies,
        location: bookForm.location || null,
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
  const displayedCatalog = catalogLevel === "All" || catalogCategory !== "All"
    ? catalogBooks
    : catalogBooks.filter(bk => (LEVEL_CATEGORIES[catalogLevel] ?? []).includes(bk.category ?? ""));

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
                  <div className="w-7 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#DCFCE7" }}>
                    <Book size={13} style={{ color: "#16A34A" }} />
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
        <div className="flex items-center gap-2.5 p-3 rounded-2xl" style={{ background: "#DCFCE7" }}>
          <div className="w-8 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#16A34A" }}>
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
                style={dueDays === d ? { background: "#16A34A", color: "#fff" } : { background: "#F5F5F5", color: "#666" }}>
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
          style={{ background: "#16A34A" }}>
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
          {tab !== "home" && (
            <button onClick={() => setTab("home")}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition shrink-0">
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-800">
              {tab === "home" ? "Library"
               : tab === "overview" ? "Library Overview"
               : tab === "catalog" ? "Book Catalog"
               : tab === "add-book" ? "Add New Book"
               : "Lend & Return"}
            </h1>
            {tab === "home" && (
              <p className="text-xs text-gray-400 mt-0.5">
                {loading ? "Loading…" : `${stats.totalBooks} books · ${stats.activeMembers} active borrows`}
              </p>
            )}
          </div>
          {(tab === "home" || tab === "lend-return") && (
            <button onClick={openLendModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition shrink-0"
              style={{ background: "#16A34A" }}>
              <BookMarked size={14} />
              <span>{tab === "home" ? "Lend Book" : "Quick Lend"}</span>
            </button>
          )}
        </div>

        {/* ── Overdue banner (overview only) ───────────────────── */}
        {tab === "overview" && !loading && overdueItems.length > 0 && (
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

        {/* ── Tab body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-4">

          {/* ═══════════════ HOME BLOCKS ═══════════════ */}
          {tab === "home" && (
            loading ? (
              <div className="flex justify-center py-20">
                <Loader2 size={22} className="animate-spin" style={{ color: "#16A34A" }} />
              </div>
            ) : (
              <div className="space-y-3">
                {stats.overdueBooks > 0 && (
                  <div className="bg-red-50 rounded-2xl p-3 flex items-center gap-3 border border-red-100">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-xs font-semibold text-red-700 flex-1">{stats.overdueBooks} overdue book{stats.overdueBooks !== 1 ? "s" : ""} — return deadline passed</p>
                    <button onClick={() => setTab("overview")} className="text-xs font-bold text-red-600 underline shrink-0">View</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTab("overview")} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#F0FDF4" }}>
                      <BookOpen size={20} style={{ color: "#16A34A" }} />
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalBooks}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">Library Overview</p>
                    <p className="text-xs text-gray-400">{stats.activeMembers} books lent out</p>
                  </button>
                  <button onClick={() => setTab("catalog")} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#EFF6FF" }}>
                      <Book size={20} style={{ color: "#2563EB" }} />
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalBooks}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">Book Catalog</p>
                    <p className="text-xs text-gray-400">Browse all books</p>
                  </button>
                  <button onClick={() => setTab("add-book")} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#F5F3FF" }}>
                      <Plus size={20} style={{ color: "#7C3AED" }} />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 mt-1">Add New Book</p>
                    <p className="text-xs text-gray-400">Register to catalog</p>
                  </button>
                  <button onClick={() => setTab("lend-return")} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition text-left">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "#FFF7ED" }}>
                      <CreditCard size={20} style={{ color: "#EA580C" }} />
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.activeMembers}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-0.5">Lend & Return</p>
                    <p className="text-xs text-gray-400">NFC card terminal</p>
                  </button>
                </div>
              </div>
            )
          )}

          {/* ═══════════════ OVERVIEW ═══════════════ */}
          {tab === "overview" && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={28} className="animate-spin" style={{ color: "#16A34A" }} />
                </div>
              ) : (
                <>
                  {/* Interactive Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {
                        label: "Total Books",
                        value: stats.totalBooks,
                        color: "#16A34A",
                        bg: "#DCFCE7",
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
                    style={{ background: "#16A34A" }}>
                    <BookMarked size={16} /> Lend a Book to Student
                  </button>

                  {/* Students holding books list */}
                  <div className="bg-white rounded-3xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Users size={14} style={{ color: "#16A34A" }} />
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
                                style={{ background: overdue ? "#FEF2F2" : "#DCFCE7", color: overdue ? "#EF4444" : "#16A34A" }}>
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
                    style={{ background: "#16A34A" }}
                  >
                    <Plus size={14} /> Add Book
                  </button>
                </div>

                {/* Level Picker */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {["All", "S1", "S2", "S3", "A-Level", "Other"].map(lvl => (
                    <button key={lvl} type="button"
                      onClick={() => {
                        setCatalogLevel(lvl);
                        setCatalogCategory("All");
                        loadCatalog(catalogSearch, "All");
                      }}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        catalogLevel === lvl ? "bg-[#16A34A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      {lvl}
                    </button>
                  ))}
                </div>
                {/* Subject chips for selected level */}
                {catalogLevel !== "All" && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <button type="button"
                      onClick={() => { setCatalogCategory("All"); loadCatalog(catalogSearch, "All"); }}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                        catalogCategory === "All" ? "bg-black text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}>
                      All {catalogLevel}
                    </button>
                    {(LEVEL_CATEGORIES[catalogLevel] ?? []).map(cat => (
                      <button key={cat} type="button"
                        onClick={() => { setCatalogCategory(cat); loadCatalog(catalogSearch, cat); }}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                          catalogCategory === cat ? "bg-[#16A34A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Books List / Grid */}
              <div className="bg-white rounded-3xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} style={{ color: "#16A34A" }} />
                    <span className="text-sm font-bold" style={{ color: "#121212" }}>Library Books Catalog</span>
                  </div>
                  <span className="text-xs text-gray-400 font-semibold">{displayedCatalog.length} books listed</span>
                </div>

                {catalogLoading ? (
                  <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#16A34A]" /></div>
                ) : displayedCatalog.length === 0 ? (
                  <div className="py-12 text-center">
                    <Book size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-500">No books found</p>
                    <p className="text-xs text-gray-400 mt-1">Try another search or register a new book</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {displayedCatalog.map(bk => {
                      const avail = bk.available_copies ?? bk.total_copies ?? 1;
                      return (
                        <div key={bk.id} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#DCFCE7" }}>
                            <Book size={18} style={{ color: "#16A34A" }} />
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
                              style={{ background: "#16A34A" }}
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
            <div className="max-w-md mx-auto space-y-3">

              {bookSaved && (
                <div className="p-3.5 rounded-2xl flex items-center gap-3 bg-green-50 border border-green-200">
                  <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">Book added to catalog!</p>
                    <p className="text-xs text-green-600">Fill the form again to add another</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveBook} className="space-y-3">
                {/* Required fields */}
                <div className="bg-white rounded-3xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Required</p>
                  <div className="relative">
                    <Tag size={13} className="absolute left-3.5 top-[13px] text-gray-400" />
                    <input
                      value={bookForm.book_number}
                      onChange={e => setBookForm(f => ({ ...f, book_number: e.target.value }))}
                      placeholder="Book ID / ISBN — e.g. BK-001"
                      required
                      className="w-full border rounded-2xl pl-9 pr-3 py-3 text-sm outline-none transition font-medium"
                      style={{ borderColor: bookForm.book_number ? "#16A34A" : "#e5e7eb", color: "#121212" }}
                    />
                  </div>
                  <div className="relative">
                    <BookOpen size={13} className="absolute left-3.5 top-[13px] text-gray-400" />
                    <input
                      value={bookForm.title}
                      onChange={e => setBookForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Book title — e.g. Mathematics S3"
                      required
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-3 text-sm outline-none font-medium"
                      style={{ color: "#121212" }}
                    />
                  </div>
                </div>

                {/* Optional fields */}
                <div className="bg-white rounded-3xl p-4 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Optional</p>
                  <input
                    value={bookForm.author}
                    onChange={e => setBookForm(f => ({ ...f, author: e.target.value }))}
                    placeholder="Author — e.g. REB Rwanda"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none"
                    style={{ color: "#121212" }}
                  />
                  <div className="relative">
                    <MapPin size={13} className="absolute left-3.5 top-[13px] text-gray-400" />
                    <input
                      value={bookForm.location}
                      onChange={e => setBookForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="Shelf location — e.g. A1, B3"
                      className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-3 text-sm outline-none"
                      style={{ color: "#121212" }}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 mb-2">Category</p>
                    {/* Level picker */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.keys(LEVEL_CATEGORIES).map(lvl => (
                        <button key={lvl} type="button"
                          onClick={() => { setAddBookLevel(addBookLevel === lvl ? "" : lvl); setBookForm(f => ({ ...f, category: "" })); }}
                          className="px-3 py-1 rounded-xl text-xs font-semibold transition"
                          style={addBookLevel === lvl
                            ? { background: "#1D4ED8", color: "#fff" }
                            : { background: "#EFF6FF", color: "#1D4ED8" }}>
                          {lvl}
                        </button>
                      ))}
                    </div>
                    {/* Subject chips */}
                    {addBookLevel && (
                      <div className="flex flex-wrap gap-1.5">
                        {(LEVEL_CATEGORIES[addBookLevel] ?? []).map(c => (
                          <button key={c} type="button"
                            onClick={() => setBookForm(f => ({ ...f, category: f.category === c ? "" : c }))}
                            className="px-3 py-1 rounded-xl text-xs font-semibold transition"
                            style={bookForm.category === c
                              ? { background: "#16A34A", color: "#fff" }
                              : { background: "#F3F4F6", color: "#555" }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    {bookForm.category && (
                      <p className="text-[10px] text-[#16A34A] mt-1.5 font-semibold">{bookForm.category}</p>
                    )}
                  </div>
                </div>

                {/* Copies stepper */}
                <div className="bg-white rounded-3xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">Copies</p>
                    <p className="text-xs text-gray-400">How many does the library have?</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => setBookForm(f => ({ ...f, total_copies: Math.max(1, f.total_copies - 1) }))}
                      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold text-lg transition">
                      −
                    </button>
                    <span className="text-xl font-bold text-gray-900 w-8 text-center">{bookForm.total_copies}</span>
                    <button type="button"
                      onClick={() => setBookForm(f => ({ ...f, total_copies: Math.min(99, f.total_copies + 1) }))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-lg transition"
                      style={{ background: "#16A34A" }}>
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingBook || !bookForm.title.trim() || !bookForm.book_number.trim()}
                  className="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition active:scale-[.98]"
                  style={{ background: "#16A34A" }}>
                  {savingBook ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Add to Library
                </button>
              </form>
            </div>
          )}

          {/* ═══════════════ LEND & RETURN ═══════════════ */}
          {tab === "lend-return" && (
            <div className="max-w-2xl mx-auto space-y-4">

              {/* Sub-tab Switcher */}
              <div className="flex items-center justify-between gap-2 p-1.5 bg-gray-100 rounded-2xl">
                <div className="flex gap-1 overflow-x-auto scrollbar-none">
                  <button type="button" onClick={() => setDeskSubTab("card-desk")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      deskSubTab === "card-desk" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}>
                    <CreditCard size={13} className={deskSubTab === "card-desk" ? "text-[#16A34A]" : ""} />
                    Card / NFC
                  </button>
                  <button type="button" onClick={() => setDeskSubTab("name-search")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      deskSubTab === "name-search" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}>
                    <Users size={13} className={deskSubTab === "name-search" ? "text-[#16A34A]" : ""} />
                    Search by Name
                  </button>
                  <button type="button" onClick={() => setDeskSubTab("quick-return")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      deskSubTab === "quick-return" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}>
                    <RotateCcw size={13} className={deskSubTab === "quick-return" ? "text-[#16A34A]" : ""} />
                    Return Book
                  </button>
                  <button type="button" onClick={() => setDeskSubTab("check-book")}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                      deskSubTab === "check-book" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
                    }`}>
                    <Search size={13} className={deskSubTab === "check-book" ? "text-[#16A34A]" : ""} />
                    Check Book
                  </button>
                </div>
                <button type="button" onClick={openLendModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#16A34A] flex items-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer flex-shrink-0">
                  <BookMarked size={13} /> Lend
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
                          <Wifi size={16} className={listening ? "text-[#16A34A] animate-pulse" : "text-gray-400"} />
                          Card Terminal
                        </h3>
                      </div>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={continuousMode}
                          onChange={(e) => setContinuousMode(e.target.checked)}
                          className="rounded accent-[#16A34A]"
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
                          className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={toggleNFC}
                        title={listening ? "Stop NFC Reader" : "Start NFC Card Tap"}
                        className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer ${
                          listening
                            ? "bg-[#16A34A] text-white shadow-md animate-pulse ring-2 ring-orange-200"
                            : "bg-orange-50 text-[#16A34A] hover:bg-orange-100 border border-orange-200"
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
                    </div>


                    {nfcError && <p className="text-xs text-red-500 mt-2 font-medium">{nfcError}</p>}

                    {listening && (
                      <div className="mt-3 p-2.5 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#16A34A] flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-ping inline-block" />
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
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white text-lg flex-shrink-0 bg-[#16A34A] shadow-sm">
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
                            <BookOpen size={16} className="text-[#16A34A]" />
                            <h4 className="text-sm font-bold text-gray-900">
                              Books In Possession
                            </h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              studentBorrows.length > 0 ? "bg-orange-100 text-[#16A34A]" : "bg-gray-100 text-gray-600"
                            }`}>
                              {studentBorrows.length} {studentBorrows.length === 1 ? "book" : "books"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {studentHistoryList.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-xs font-semibold text-gray-500 hover:text-[#16A34A] flex items-center gap-1 cursor-pointer"
                              >
                                <History size={13} />
                                {showHistory ? "Hide Past History" : `History (${studentHistoryList.length})`}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowLendForm(!showLendForm)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm ${
                                showLendForm ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "text-white bg-[#16A34A] hover:bg-[#e0691b]"
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
                                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#e0691b] inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
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
                                      <Book size={16} className={`mt-0.5 flex-shrink-0 ${overdue ? "text-red-500" : "text-[#16A34A]"}`} />
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
                    <div className="bg-white rounded-3xl p-5 text-center shadow-sm border border-gray-100">
                      <div className="w-11 h-11 rounded-2xl bg-green-50 mx-auto flex items-center justify-center mb-3">
                        <BookMarked size={20} className="text-[#16A34A]" />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">Tap card or enter student code</p>
                      <p className="text-xs text-gray-400 mt-1">
                        No card?{" "}
                        <button type="button" onClick={() => setDeskSubTab("name-search")}
                          className="text-[#16A34A] font-semibold underline cursor-pointer">
                          Search by name
                        </button>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB: NAME SEARCH */}
              {deskSubTab === "name-search" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                      <input
                        value={nameQuery}
                        onChange={e => searchByName(e.target.value)}
                        placeholder="Type student name…"
                        className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900"
                        autoFocus
                      />
                      {nameSearching && <Loader2 size={14} className="animate-spin absolute right-3.5 top-[13px] text-gray-400" />}
                    </div>
                  </div>

                  {nameResults.length > 0 && (
                    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                      {nameResults.map(s => (
                        <button key={s.id} type="button"
                          onClick={async () => {
                            setDeskSubTab("card-desk");
                            setCardInput(s.studentCode);
                            await lookupCard(s.studentCode);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0 transition cursor-pointer">
                          <div className="w-9 h-9 rounded-xl bg-[#16A34A] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {s.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.className || "No class"} · {s.studentCode}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {s.hasCard && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Card</span>}
                            <ArrowRight size={14} className="text-gray-300" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {nameQuery.trim() && !nameSearching && nameResults.length === 0 && (
                    <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-gray-100">
                      <p className="text-sm text-gray-500">No students found for &quot;{nameQuery}&quot;</p>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: SCAN BOOK TAG TO RETURN */}
              {deskSubTab === "quick-return" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <RotateCcw size={16} className="text-[#16A34A]" />
                      Scan book tag or barcode
                    </h3>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Tag size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                        <input
                          value={returnTagInput}
                          onChange={(e) => setReturnTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleQuickReturn(returnTagInput); }}
                          placeholder="Scan or enter book tag (e.g. PHYS-S5-01, MATH-S4-01, LIT-TFA-01)…"
                          className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        disabled={returningTag || !returnTagInput.trim()}
                        onClick={() => handleQuickReturn(returnTagInput)}
                        className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 bg-[#16A34A] hover:bg-[#e0691b] cursor-pointer shadow-sm transition active:scale-95"
                      >
                        {returningTag ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Return Book
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* SUB-TAB 3: CHECK BOOK IN LIBRARY */}
              {deskSubTab === "check-book" && (
                <div className="space-y-3">
                  <div className="bg-white rounded-3xl p-4 md:p-5 shadow-sm border border-gray-100">
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-[13px] text-gray-400" />
                      <input
                        value={bookCheckQuery}
                        onChange={(e) => searchBookCheck(e.target.value)}
                        placeholder="Search by title, author, ISBN (e.g. Mathematics, BK-001)…"
                        className="w-full border border-gray-200 rounded-2xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A] text-gray-900"
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
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#16A34A] hover:bg-[#e0691b] disabled:opacity-40 flex items-center gap-1 shadow-sm cursor-pointer"
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
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "#DCFCE7" }}>
                <BookMarked size={18} style={{ color: "#16A34A" }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "#121212" }}>Lend a Book</p>
              </div>
              <button onClick={() => setShowLendModal(false)} className="p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer">
                <X size={16} style={{ color: "#666" }} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-4">

              {/* Student lookup */}
              <div>
                {/* Mode toggle */}
                <div className="flex gap-2 mb-2.5">
                  <button type="button" onClick={() => { setModalSearchMode("card"); setModalNameQuery(""); setModalNameResults([]); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${modalSearchMode === "card" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <CreditCard size={12} /> Card / Code
                  </button>
                  <button type="button" onClick={() => setModalSearchMode("name")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${modalSearchMode === "name" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                    <Users size={12} /> Search by Name
                  </button>
                </div>

                {modalSearchMode === "card" ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <CreditCard size={13} className="absolute left-3.5 top-[11px]" style={{ color: "#999" }} />
                      <input
                        value={modalCardInput}
                        onChange={e => setModalCardInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") lookupModalStudent(modalCardInput); }}
                        placeholder="e.g. KMS001 or KNT-KMS-2026-00001"
                        className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A]"
                        style={{ color: "#121212" }}
                      />
                    </div>
                    <button type="button" onClick={toggleNFC}
                      className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1 transition flex-shrink-0 cursor-pointer ${
                        listening ? "bg-[#16A34A] text-white shadow-md animate-pulse ring-2 ring-orange-200" : "bg-orange-50 text-[#16A34A] hover:bg-orange-100 border border-orange-200"
                      }`}>
                      <Wifi size={14} />
                      {listening ? "…" : "NFC"}
                    </button>
                    <button onClick={() => lookupModalStudent(modalCardInput)}
                      disabled={lookingUpModalStudent || !modalCardInput.trim()}
                      className="px-4 py-2.5 rounded-2xl text-white text-xs font-bold disabled:opacity-40 flex-shrink-0 cursor-pointer"
                      style={{ background: "#121212" }}>
                      {lookingUpModalStudent ? <Loader2 size={14} className="animate-spin" /> : "Find"}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3.5 top-[11px] text-gray-400" />
                      <input
                        value={modalNameQuery}
                        onChange={e => searchModalByName(e.target.value)}
                        placeholder="Type student name…"
                        autoFocus
                        className="w-full border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[#16A34A]"
                        style={{ color: "#121212" }}
                      />
                      {modalNameSearching && <Loader2 size={13} className="animate-spin absolute right-3.5 top-[11px] text-gray-400" />}
                    </div>
                    {modalNameResults.length > 0 && (
                      <div className="mt-1.5 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm max-h-48 overflow-y-auto">
                        {modalNameResults.map(s => (
                          <button key={s.id} type="button"
                            onClick={async () => {
                              setModalSearchMode("card");
                              setModalCardInput(s.studentCode);
                              await lookupModalStudent(s.studentCode);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer">
                            <div className="w-7 h-7 rounded-lg bg-[#16A34A] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                              {s.name[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-900 truncate">{s.name}</p>
                              <p className="text-[10px] text-gray-400">{s.className} · {s.studentCode}</p>
                            </div>
                            <ArrowRight size={13} className="text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {modalSearchMode === "card" && listening && (
                  <div className="mt-2.5 p-2 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-between text-xs text-[#16A34A] font-semibold animate-pulse">
                    <span className="flex items-center gap-1.5"><Wifi size={13} className="animate-bounce" /> Waiting for NFC tap…</span>
                    <button type="button" onClick={stopListen} className="text-[11px] font-bold text-gray-500 hover:text-gray-800 underline cursor-pointer">Stop</button>
                  </div>
                )}

                {modalStudent && (
                  <div className="mt-2.5 flex items-center gap-3 p-3 rounded-2xl border border-orange-100" style={{ background: "#DCFCE7" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0"
                      style={{ background: "#16A34A" }}>
                      {modalStudent.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: "#121212" }}>{modalStudent.name}</p>
                      <p className="text-[11px]" style={{ color: "#666" }}>
                        {modalStudent.studentClass} · Card: {modalStudent.card_number}
                        {modalStudent.wallet_balance !== undefined && (
                          <span className="ml-1 text-gray-700 font-semibold">({(modalStudent.wallet_balance ?? 0).toLocaleString()} RWF)</span>
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
                <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#16A34A]" /></div>
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
