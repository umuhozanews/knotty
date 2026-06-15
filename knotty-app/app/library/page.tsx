"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { library, students, LibraryBook, LibraryBookCopy, LibraryBorrowRecord, Student } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import {
  Loader2, Book, Plus, X, Search, AlertCircle, CheckCircle, Calendar, Bookmark, BookmarkCheck,
  TrendingUp, TrendingDown, BookOpen, AlertTriangle, HelpCircle, Bell, User, Users, UserPlus, DollarSign, Filter
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

const RECOMMENDATIONS_TOP = [
  { title: "Magnolia Palace", author: "Fiona Davis", category: "Historical Fiction" },
  { title: "The Midnight Library", author: "Matt Haig", category: "Fantasy" },
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", category: "Classics" },
  { title: "Atomic Habits", author: "James Clear", category: "Self-Help" },
];

const RECOMMENDATIONS_NEW = [
  { title: "Iron Flame", author: "Rebecca Yarros", category: "Fantasy" },
  { title: "The Covenant of Water", author: "Abraham Verghese", category: "Fiction" },
  { title: "Happy Place", author: "Emily Henry", category: "Romance" },
  { title: "A Court of Thorns and Roses", author: "Sarah J. Maas", category: "Fantasy" },
];

const CHECKOUT_CHART_DATA = [
  { day: "Mon", Borrowed: 45, Returned: 30 },
  { day: "Tue", Borrowed: 60, Returned: 45 },
  { day: "Wed", Borrowed: 85, Returned: 55 },
  { day: "Thu", Borrowed: 50, Returned: 65 },
  { day: "Fri", Borrowed: 70, Returned: 40 },
  { day: "Sat", Borrowed: 35, Returned: 20 },
  { day: "Sun", Borrowed: 15, Returned: 10 },
];

export default function LibraryPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"dashboard" | "catalog" | "borrows">("dashboard");
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [borrows, setBorrows] = useState<LibraryBorrowRecord[]>([]);
  const [stats, setStats] = useState({
    borrowedBooks: 2405,
    returnedBooks: 783,
    overdueBooks: 45,
    missingBooks: 12,
    totalBooks: 32345,
    visitors: 1504,
    newMembers: 34,
    pendingFees: 765,
    borrowedTrend: "+23%",
    returnedTrend: "-14%",
    overdueTrend: "+11%",
    missingTrend: "+11%",
    totalTrend: "+11%",
    visitorsTrend: "+3%",
    newMembersTrend: "-10%",
    pendingFeesTrend: "+56%"
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [borrowFilter, setBorrowFilter] = useState<"active" | "returned" | "overdue">("active");
  const [recSubTab, setRecSubTab] = useState<"top" | "new">("top");
  const [dateFilter, setDateFilter] = useState("Last 6 months");

  // Add Book Modal
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [savingBook, setSavingBook] = useState(false);
  const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "", category: "", total_copies: 1, copy_tags: "" });

  // Borrow Modal
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [savingBorrow, setSavingBorrow] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchingStudent, setSearchingStudent] = useState(false);
  const [borrowForm, setBorrowForm] = useState({ copy_tag: "", due_days: 14 });

  // Return Modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [returnForm, setReturnForm] = useState({ copy_tag: "", fine_rate_per_day: 200 });
  const [returnResult, setReturnResult] = useState<{ fine_amount: number; fine_charged_to_wallet: boolean } | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, activeTab, borrowFilter, page]);

  async function loadData() {
    setLoading(true);
    try {
      // Load stats & borrows history for dashboard/activity components
      const statsRes = await library.stats().catch(() => null);
      if (statsRes && statsRes.success) {
        setStats(statsRes.data);
      }

      // Always load borrows to show in recent activities/logs
      const borrowsRes = await library.schoolBorrows(
        activeTab === "borrows" ? borrowFilter : undefined,
        activeTab === "borrows" ? page : 1,
        activeTab === "borrows" ? 15 : 6
      );
      setBorrows(borrowsRes.data);

      if (activeTab === "catalog") {
        const res = await library.books({ search: searchQuery, page, limit: 15 });
        setBooks(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.pages);
        }
      }
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "Failed to load library data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadData();
  }

  async function searchStudents(q: string) {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchingStudent(true);
    try {
      const res = await students.list({ search: q, limit: 6 });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingStudent(false);
    }
  }

  async function handleSaveBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookForm.title || !bookForm.author) return;
    setSavingBook(true);
    try {
      const copyTagsList = bookForm.copy_tags
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await library.createBook({
        title: bookForm.title,
        author: bookForm.author,
        isbn: bookForm.isbn || undefined,
        category: bookForm.category || undefined,
        total_copies: Number(bookForm.total_copies),
        copy_tags: copyTagsList.length > 0 ? copyTagsList : undefined,
      });

      toast("Book registered in catalog", "success");
      setShowAddBookModal(false);
      setBookForm({ title: "", author: "", isbn: "", category: "", total_copies: 1, copy_tags: "" });
      loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save book", "error");
    } finally {
      setSavingBook(false);
    }
  }

  async function handleSaveBorrow(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !borrowForm.copy_tag) return;
    setSavingBorrow(true);
    try {
      await library.borrowBook({
        copy_tag: borrowForm.copy_tag,
        student_code: selectedStudent.student_code,
        due_days: Number(borrowForm.due_days),
      });

      toast("Book checked out successfully", "success");
      setShowBorrowModal(false);
      setSelectedStudent(null);
      setStudentSearch("");
      setBorrowForm({ copy_tag: "", due_days: 14 });
      loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to check out book", "error");
    } finally {
      setSavingBorrow(false);
    }
  }

  async function handleReturnBook(e: React.FormEvent) {
    e.preventDefault();
    if (!returnForm.copy_tag) return;
    setSavingReturn(true);
    setReturnResult(null);
    try {
      const res = await library.returnBook({
        copy_tag: returnForm.copy_tag,
        fine_rate_per_day: Number(returnForm.fine_rate_per_day),
      });

      setReturnResult({
        fine_amount: res.data.fine_amount,
        fine_charged_to_wallet: res.data.fine_charged_to_wallet,
      });
      toast("Book returned successfully", "success");
      loadData();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to return book", "error");
    } finally {
      setSavingReturn(false);
    }
  }

  // Helper to resolve overdue entries dynamically based on database state
  const dbOverdues = borrows.filter(b => !b.returned_at && new Date(b.due_at) < new Date());
  const displayOverdues = dbOverdues.map(b => {
    const diffTime = Math.abs(Date.now() - new Date(b.due_at).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      memberId: b.student 
        ? `#${b.student.user.first_name[0] || ""}${b.student.user.last_name[0] || ""}-${b.id.substring(0, 3)}`.toUpperCase()
        : "#MEMBER",
      title: b.copy?.book?.title || "Unknown Book",
      isbn: b.copy?.book?.isbn || "—",
      dueDate: `${diffDays}d Overdue`,
      fine: `${b.fine_amount || diffDays * 200} RWF`
    };
  });

  // Helper to resolve recent checkouts
  const displayCheckouts = borrows.slice(0, 5).map(b => ({
    id: `#${b.id.substring(0, 4)}`,
    isbn: b.copy?.book?.isbn || "9780140449",
    title: b.copy?.book?.title || "Book Title",
    author: b.copy?.book?.author || "Author",
    member: b.student ? `${b.student.user.first_name} ${b.student.user.last_name}` : "Member",
    issuedDate: new Date(b.borrowed_at).toLocaleDateString("en-RW"),
    returnDate: b.returned_at ? new Date(b.returned_at).toLocaleDateString("en-RW") : new Date(b.due_at).toLocaleDateString("en-RW")
  }));

  const activeRecs = recSubTab === "top" ? RECOMMENDATIONS_TOP : RECOMMENDATIONS_NEW;

  return (
    <DashboardShell>
      <div className="flex flex-col h-full overflow-y-auto bg-[#F8F9FA] p-6 space-y-6">
        
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-5 shadow-sm">
          {/* Left: Branding & Module Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5EAD70]/10 rounded-xl flex items-center justify-center text-[#5EAD70]">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Library App Dashboard</h1>
              <p className="text-xs text-gray-400">Forest Green administrative interface for institutional inventory</p>
            </div>
          </div>

          {/* Center: Global Search Bar */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search Ex. ISBN, Title, Author, Member, etc"
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] focus:ring-2 focus:ring-[#5EAD70]/10 transition"
            />
            <Search size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
          </div>

          {/* Right: Date Filter, Profile & Notifications */}
          <div className="flex items-center gap-3 self-end md:self-auto">
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-100 text-xs font-semibold text-gray-500 rounded-2xl pl-4 pr-8 py-2.5 outline-none hover:bg-gray-100 transition cursor-pointer"
              >
                <option value="Last 6 months">Last 6 months</option>
                <option value="Last 30 days">Last 30 days</option>
                <option value="This Year">This Year</option>
              </select>
              <Filter size={12} className="absolute right-3.5 top-3.5 text-gray-400 pointer-events-none" />
            </div>

            <button className="w-10 h-10 rounded-2xl bg-gray-50 hover:bg-gray-100 transition flex items-center justify-center text-gray-500 relative">
              <Bell size={16} />
              <span className="w-1.5 h-1.5 rounded-full bg-[#E57373] absolute top-3 right-3" />
            </button>

            <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
              <div className="w-8 h-8 rounded-full bg-[#5EAD70] text-white flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-gray-800">Allison</p>
                <p className="text-[10px] text-gray-400">Head Librarian</p>
              </div>
            </div>
          </div>
        </div>

        {/* Persistent Module Tab Navigation & Quick Action Triggers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl shadow-sm">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "dashboard" ? "bg-[#5EAD70]/10 text-[#5EAD70]" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "catalog" ? "bg-[#5EAD70]/10 text-[#5EAD70]" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => setActiveTab("borrows")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition ${
                activeTab === "borrows" ? "bg-[#5EAD70]/10 text-[#5EAD70]" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Borrow Logs
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowReturnModal(true)}
              className="px-4 py-2.5 bg-red-50 text-[#E57373] hover:bg-red-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <BookmarkCheck size={14} /> Return Book
            </button>
            <button
              onClick={() => setShowBorrowModal(true)}
              className="px-4 py-2.5 bg-[#5EAD70]/10 text-[#5EAD70] hover:bg-[#5EAD70]/20  rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Bookmark size={14} /> Check Out
            </button>
            <button
              onClick={() => setShowAddBookModal(true)}
              className="px-4 py-2.5 bg-[#5EAD70] text-white hover:bg-[#5EAD70]/90 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-[#5EAD70]/25"
            >
              <Plus size={14} /> Add Book
            </button>
          </div>
        </div>

        {/* CONDITIONAL BODY RENDERING */}

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* 1. KPI Metric Cards (Stats Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Borrowed Books */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Borrowed Books</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#5EAD70] flex items-center justify-center"><BookOpen size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.borrowedBooks.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#5EAD70] bg-[#5EAD70]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.borrowedTrend}
                  </span>
                </div>
              </div>

              {/* Card 2: Returned Books */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Returned Books</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E57373] flex items-center justify-center"><BookmarkCheck size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.returnedBooks.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#E57373] bg-[#E57373]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingDown size={10} /> {stats.returnedTrend}
                  </span>
                </div>
              </div>

              {/* Card 3: Overdue Books */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Overdue Books</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E57373] flex items-center justify-center"><AlertTriangle size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.overdueBooks.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#E57373] bg-[#E57373]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.overdueTrend}
                  </span>
                </div>
              </div>

              {/* Card 4: Missing Books */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Missing Books</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E57373] flex items-center justify-center"><AlertCircle size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.missingBooks.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#E57373] bg-[#E57373]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.missingTrend}
                  </span>
                </div>
              </div>

              {/* Card 5: Total Books */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Books</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#5EAD70] flex items-center justify-center"><Book size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.totalBooks.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#5EAD70] bg-[#5EAD70]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.totalTrend}
                  </span>
                </div>
              </div>

              {/* Card 6: Visitors */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Visitors</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#5EAD70] flex items-center justify-center"><Users size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.visitors.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#5EAD70] bg-[#5EAD70]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.visitorsTrend}
                  </span>
                </div>
              </div>

              {/* Card 7: New Members */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">New Members</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E57373] flex items-center justify-center"><UserPlus size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">{stats.newMembers.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#E57373] bg-[#E57373]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingDown size={10} /> {stats.newMembersTrend}
                  </span>
                </div>
              </div>

              {/* Card 8: Pending Fees */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100/50 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Pending Fees</span>
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E57373] flex items-center justify-center"><DollarSign size={16} /></div>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-gray-800">${stats.pendingFees.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[#E57373] bg-[#E57373]/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                    <TrendingUp size={10} /> {stats.pendingFeesTrend}
                  </span>
                </div>
              </div>

            </div>

            {/* 2. Visualizations and Operational Lists Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left & Center: Charts & Log Tables (col-span-2) */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* 2.1 Check-out Statistics Line Chart */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Check-out Statistics</h3>
                      <p className="text-[11px] text-gray-400">Comparing books borrowed and returned this week</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-[#5EAD70] inline-block" /> Borrowed
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-[#E57373] inline-block" /> Returned
                      </div>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={CHECKOUT_CHART_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: "1px solid #f3f4f6" }} />
                      <Line type="monotone" dataKey="Borrowed" stroke="#5EAD70" strokeWidth={3} dot={{ r: 4, fill: "#5EAD70", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="Returned" stroke="#E57373" strokeWidth={3} dot={{ r: 4, fill: "#E57373", strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 2.2 Overdue's History Table */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/50">
                  <div className="flex items-center justify-between mb-3.5">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Overdue's History</h3>
                      <p className="text-[11px] text-gray-400">Outstanding overdue logs and fines</p>
                    </div>
                    <HelpCircle size={16} className="text-gray-300 cursor-pointer hover:text-gray-400" />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                          <th className="pb-3 pr-2">Member ID</th>
                          <th className="pb-3 pr-2">Book Title</th>
                          <th className="pb-3 pr-2">ISBN</th>
                          <th className="pb-3 pr-2">Due Date</th>
                          <th className="pb-3 text-right">Fine</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-gray-700">
                        {displayOverdues.length > 0 ? (
                          displayOverdues.map((item, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-2.5 font-bold text-[#5EAD70]">{item.memberId}</td>
                              <td className="py-2.5 font-medium text-gray-800">{item.title}</td>
                              <td className="py-2.5 font-mono text-[10px] text-gray-400">{item.isbn}</td>
                              <td className="py-2.5 text-[#E57373] font-semibold">{item.dueDate}</td>
                              <td className="py-2.5 text-right font-bold text-red-500">{item.fine}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-gray-400">
                              No overdue books currently logged
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2.3 Recent Check-out's Table */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/50">
                  <div className="mb-3.5">
                    <h3 className="font-bold text-gray-800 text-sm">Recent Check-out's</h3>
                    <p className="text-[11px] text-gray-400">Newly updated book borrowing activities</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase">
                          <th className="pb-3 pr-2">ID</th>
                          <th className="pb-3 pr-2">ISBN</th>
                          <th className="pb-3 pr-2">Title</th>
                          <th className="pb-3 pr-2">Author</th>
                          <th className="pb-3 pr-2">Member</th>
                          <th className="pb-3 pr-2">Issued Date</th>
                          <th className="pb-3 text-right">Return Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-gray-600">
                        {displayCheckouts.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-gray-400">No recent transactions.</td>
                          </tr>
                        ) : (
                          displayCheckouts.map((c, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-2.5 font-bold text-gray-400">{c.id}</td>
                              <td className="py-2.5 font-mono text-[10px] text-gray-400">{c.isbn}</td>
                              <td className="py-2.5 font-medium text-gray-800">{c.title}</td>
                              <td className="py-2.5">{c.author}</td>
                              <td className="py-2.5 font-medium text-gray-700">{c.member}</td>
                              <td className="py-2.5">{c.issuedDate}</td>
                              <td className="py-2.5 text-right font-medium text-[#5EAD70]">{c.returnDate}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Right Column: Recommendations & Discovery Card (col-span-1) */}
              <div className="lg:col-span-1 space-y-6">
                
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100/50">
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-800 text-sm">Book Recommendations</h3>
                    <p className="text-[11px] text-gray-400">Discover top catalog entries and new books</p>
                  </div>

                  {/* Discovery Sub-tabs */}
                  <div className="flex border-b border-gray-100 mb-4 text-xs font-semibold">
                    <button
                      onClick={() => setRecSubTab("top")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all ${
                        recSubTab === "top" ? "border-[#5EAD70] text-[#5EAD70]" : "border-transparent text-gray-400"
                      }`}
                    >
                      Top Books
                    </button>
                    <button
                      onClick={() => setRecSubTab("new")}
                      className={`flex-1 pb-2 border-b-2 text-center transition-all ${
                        recSubTab === "new" ? "border-[#5EAD70] text-[#5EAD70]" : "border-transparent text-gray-400"
                      }`}
                    >
                      New Arrivals
                    </button>
                  </div>

                  {/* Recommendations Vertical List */}
                  <div className="space-y-3">
                    {activeRecs.map((book, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 border border-gray-50 hover:bg-gray-50 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-9 rounded bg-[#5EAD70]/10 flex items-center justify-center text-[#5EAD70] flex-shrink-0">
                            <Book size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{book.title}</p>
                            <p className="text-[10px] text-gray-400 truncate">{book.author} · {book.category}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold text-[#5EAD70] bg-[#5EAD70]/10 px-2 py-0.5 rounded-full">
                          Available
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add action shortcut */}
                  <button
                    onClick={() => setShowBorrowModal(true)}
                    className="w-full mt-5 py-3 rounded-xl border border-dashed border-gray-200 text-[#5EAD70] hover:border-[#5EAD70] hover:bg-[#5EAD70]/5 transition text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Quick Checkout Book
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {/* 3. Book Catalog Tab */}
        {activeTab === "catalog" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-sm">Book Catalog</h3>
                <p className="text-xs text-gray-400">Search and filter active book records</p>
              </div>
              <form onSubmit={handleSearch} className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, author, isbn..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:border-[#5EAD70]"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden flex flex-col min-h-[400px]">
              {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#5EAD70]" size={28} /></div>
              ) : books.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <Book size={48} className="text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400 font-medium">No books found in the catalog.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase">
                        <th className="px-5 py-3.5">Title</th>
                        <th className="px-5 py-3.5">Author</th>
                        <th className="px-5 py-3.5">ISBN</th>
                        <th className="px-5 py-3.5">Category</th>
                        <th className="px-5 py-3.5 text-right">Total Copies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-600">
                      {books.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3.5 font-bold text-gray-800">{b.title}</td>
                          <td className="px-5 py-3.5 font-medium">{b.author}</td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{b.isbn || "—"}</td>
                          <td className="px-5 py-3.5">
                            {b.category ? (
                              <span className="bg-[#5EAD70]/10 text-[#5EAD70] px-2.5 py-0.5 rounded-full font-bold">{b.category}</span>
                            ) : "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-800">{b.total_copies}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-gray-50 flex items-center justify-between text-xs font-semibold text-gray-500">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Borrow Logs Tab */}
        {activeTab === "borrows" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm">
              <div className="flex-1">
                <h3 className="font-bold text-gray-800 text-sm">Borrowing Transactions</h3>
                <p className="text-xs text-gray-400">Track current loans, returns, and overdue fees</p>
              </div>
              <select
                value={borrowFilter}
                onChange={(e) => setBorrowFilter(e.target.value as "active" | "returned" | "overdue")}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#5EAD70] bg-white cursor-pointer"
              >
                <option value="active">Active Borrows</option>
                <option value="overdue">Overdue Items</option>
                <option value="returned">Returned Logs</option>
              </select>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden flex flex-col min-h-[400px]">
              {loading ? (
                <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#5EAD70]" size={28} /></div>
              ) : borrows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <Calendar size={48} className="text-gray-200 mb-2" />
                  <p className="text-sm text-gray-400 font-medium">No borrowing records found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase">
                        <th className="px-5 py-3.5">Student</th>
                        <th className="px-5 py-3.5">Book Title</th>
                        <th className="px-5 py-3.5">Copy Tag</th>
                        <th className="px-5 py-3.5">Borrowed At</th>
                        <th className="px-5 py-3.5">Due At</th>
                        <th className="px-5 py-3.5">Returned At</th>
                        <th className="px-5 py-3.5 text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-600">
                      {borrows.map((b) => {
                        const isOverdue = !b.returned_at && new Date(b.due_at) < new Date();
                        return (
                          <tr key={b.id} className={`hover:bg-gray-50/50 ${isOverdue ? "bg-red-50/10" : ""}`}>
                            <td className="px-5 py-3.5 font-bold text-gray-800">
                              {b.student?.user.first_name} {b.student?.user.last_name}
                            </td>
                            <td className="px-5 py-3.5 font-medium text-gray-700">{b.copy?.book?.title}</td>
                            <td className="px-5 py-3.5 font-mono text-xs text-gray-400">{b.copy?.copy_tag}</td>
                            <td className="px-5 py-3.5">{new Date(b.borrowed_at).toLocaleDateString("en-RW")}</td>
                            <td className="px-5 py-3.5">{new Date(b.due_at).toLocaleDateString("en-RW")}</td>
                            <td className="px-5 py-3.5 font-semibold">
                              {b.returned_at ? (
                                <span className="text-[#5EAD70]">{new Date(b.returned_at).toLocaleDateString("en-RW")}</span>
                              ) : isOverdue ? (
                                <span className="text-[#E57373] flex items-center gap-1 font-bold"><AlertCircle size={12} /> Overdue</span>
                              ) : (
                                <span className="text-blue-500">Checked Out</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right font-bold">
                              {b.fine_amount > 0 ? (
                                <span className="text-red-500">{b.fine_amount.toLocaleString()} RWF</span>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL WINDOWS */}

        {/* Add Book Modal */}
        {showAddBookModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">Add New Book to Catalog</p>
                <button onClick={() => setShowAddBookModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              <form onSubmit={handleSaveBook} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Book Title *</label>
                  <input
                    value={bookForm.title}
                    onChange={(e) => setBookForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Introduction to Organic Chemistry" required
                    className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Author *</label>
                  <input
                    value={bookForm.author}
                    onChange={(e) => setBookForm((f) => ({ ...f, author: e.target.value }))}
                    placeholder="e.g. Richard Feynman" required
                    className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">ISBN</label>
                    <input
                      value={bookForm.isbn}
                      onChange={(e) => setBookForm((f) => ({ ...f, isbn: e.target.value }))}
                      placeholder="e.g. 9780134015"
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Category</label>
                    <input
                      value={bookForm.category}
                      onChange={(e) => setBookForm((f) => ({ ...f, category: e.target.value }))}
                      placeholder="e.g. Science"
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3.5">
                  <div className="col-span-1">
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Total Copies</label>
                    <input
                      type="number" min={1}
                      value={bookForm.total_copies}
                      onChange={(e) => setBookForm((f) => ({ ...f, total_copies: Number(e.target.value) }))}
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Barcode Tags (optional)</label>
                    <input
                      value={bookForm.copy_tags}
                      onChange={(e) => setBookForm((f) => ({ ...f, copy_tags: e.target.value }))}
                      placeholder="TAG1, TAG2"
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={savingBook || !bookForm.title || !bookForm.author}
                  className="w-full py-3 rounded-2xl bg-[#5EAD70] text-white font-bold text-xs hover:bg-[#5EAD70]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-[#5EAD70]/20"
                >
                  {savingBook && <Loader2 size={13} className="animate-spin" />}
                  Register Book
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Borrow Modal */}
        {showBorrowModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">Check Out Book Copy</p>
                <button onClick={() => setShowBorrowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>

              {!selectedStudent ? (
                <div className="mb-4">
                  <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Find Student *</label>
                  <div className="relative">
                    <input
                      value={studentSearch}
                      onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                      placeholder="Type student name or student code..."
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] pr-10 transition"
                    />
                    {searchingStudent && <Loader2 size={14} className="animate-spin absolute right-3.5 top-3 text-gray-400" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto bg-white shadow-sm">
                      {searchResults.map((s) => (
                        <button
                          key={s.id} type="button"
                          onClick={() => { setSelectedStudent(s); setSearchResults([]); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#5EAD70]/5 text-left border-b border-gray-50 last:border-0 transition"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#5EAD70]/10 flex items-center justify-center text-xs font-bold text-[#5EAD70]">{s.user.first_name[0]}</div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{s.user.first_name} {s.user.last_name}</p>
                            <p className="text-[10px] text-gray-400">{s.student_code} · {s.level?.name} {s.class?.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 flex items-center justify-between p-3.5 rounded-2xl bg-[#5EAD70]/5 border border-[#5EAD70]/10">
                  <div>
                    <p className="text-xs font-bold text-[#5EAD70]">{selectedStudent.user.first_name} {selectedStudent.user.last_name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Code: {selectedStudent.student_code}</p>
                  </div>
                  <button onClick={() => setSelectedStudent(null)} className="text-[#E57373] hover:text-red-700 transition"><X size={14} /></button>
                </div>
              )}

              <form onSubmit={handleSaveBorrow} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Book Copy Tag / RFID Barcode *</label>
                  <input
                    value={borrowForm.copy_tag}
                    onChange={(e) => setBorrowForm((f) => ({ ...f, copy_tag: e.target.value }))}
                    placeholder="Scan barcode tag or type manually" required
                    className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Borrowing Duration (Days)</label>
                  <input
                    type="number" min={1}
                    value={borrowForm.due_days}
                    onChange={(e) => setBorrowForm((f) => ({ ...f, due_days: Number(e.target.value) }))}
                    className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingBorrow || !selectedStudent || !borrowForm.copy_tag}
                  className="w-full py-3 rounded-2xl bg-[#5EAD70] text-white font-bold text-xs hover:bg-[#5EAD70]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-[#5EAD70]/20"
                >
                  {savingBorrow && <Loader2 size={13} className="animate-spin" />}
                  Confirm Checkout
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Return Book Modal */}
        {showReturnModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-gray-800">Return Book Copy</p>
                <button onClick={() => { setShowReturnModal(false); setReturnResult(null); setReturnForm({ copy_tag: "", fine_rate_per_day: 200 }); }} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>

              {returnResult ? (
                <div className="space-y-4 text-center py-4">
                  <CheckCircle size={44} className="text-[#5EAD70] mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Book Returned Successfully!</p>
                    {returnResult.fine_amount > 0 ? (
                      <div className="mt-3 p-3.5 bg-red-50 border border-red-100 text-red-800 rounded-2xl text-xs inline-block text-left w-full">
                        <p className="font-bold flex items-center gap-1"><AlertTriangle size={14} className="text-red-500" /> Overdue Fine: {returnResult.fine_amount.toLocaleString()} RWF</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {returnResult.fine_charged_to_wallet 
                            ? "Fine balance was automatically deducted from the student's digital card wallet." 
                            : "Could not perform automatic card wallet deduction. Fine must be settled manually at the Bursary."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Returned on time. No overdue fines.</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setReturnResult(null); setReturnForm({ copy_tag: "", fine_rate_per_day: 200 }); }}
                    className="w-full py-3 bg-[#5EAD70] hover:bg-[#5EAD70]/90 text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    Return Another Book
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReturnBook} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Scan / Enter Copy Barcode *</label>
                    <input
                      value={returnForm.copy_tag}
                      onChange={(e) => setReturnForm((f) => ({ ...f, copy_tag: e.target.value }))}
                      placeholder="Scan copy barcode" required autoFocus
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 mb-1.5 block uppercase">Overdue Fine Rate per Day (RWF)</label>
                    <input
                      type="number" min={0}
                      value={returnForm.fine_rate_per_day}
                      onChange={(e) => setReturnForm((f) => ({ ...f, fine_rate_per_day: Number(e.target.value) }))}
                      className="w-full border border-gray-100 bg-gray-50 rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-[#5EAD70] transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingReturn || !returnForm.copy_tag}
                    className="w-full py-3 rounded-2xl bg-[#5EAD70] hover:bg-[#5EAD70]/90 text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-[#5EAD70]/20"
                  >
                    {savingReturn && <Loader2 size={13} className="animate-spin" />}
                    Confirm Return
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
