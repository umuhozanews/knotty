"use client";
import { Search, Sun, Moon, Bell, X, CheckCircle, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { students, notifications as notifApi, Student, Notification } from "@/lib/api";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/students": "Students",
  "/attendance": "Attendance",
  "/cards": "KNOTTY Cards",
  "/canteen": "Canteen",
  "/fees": "Fees",
  "/reports": "Reports",
  "/discipline": "Discipline",
  "/settings": "Settings",
};

export default function Header() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Search
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname === k || pathname.startsWith(k + "/"))?.[1] ?? "KNOTTY";

  // Load notifications
  const loadNotifs = useCallback(() => {
    notifApi.list().then((r) => {
      setNotifs(r.data as Notification[]);
      setUnreadCount((r.data as Notification[]).filter((n) => !n.is_read).length);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadNotifs(); }, [loadNotifs]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await students.list({ search: query, limit: 6 });
        setSearchResults(r.data);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function markRead(id: string) {
    await notifApi.markRead(id).catch(() => {});
    setNotifs((n) => n.map((x) => x.id === id ? { ...x, is_read: true } : x));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-400">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 shadow-sm w-64">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search students…"
              className="flex-1 text-sm outline-none text-gray-600 placeholder-gray-400 bg-transparent"
            />
            {query && (
              <button onClick={() => { setQuery(""); setSearchResults([]); }} className="text-gray-300 hover:text-gray-500">
                <X size={13} />
              </button>
            )}
            {searching && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 mt-1.5 z-50 overflow-hidden">
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { router.push(`/students/${s.id}`); setQuery(""); setSearchResults([]); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {s.user.first_name[0]}{s.user.last_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{s.user.first_name} {s.user.last_name}</p>
                    <p className="text-xs text-gray-400">{s.student_code} · {s.level?.name} {s.class?.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dark/Light toggle */}
        <button
          onClick={toggle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition"
        >
          {theme === "dark" ? <Sun size={16} className="text-blue-600" /> : <Moon size={16} className="text-gray-500" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotifs(); }}
            className="relative w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition"
          >
            <Bell size={16} className="text-gray-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 w-80 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 text-sm">Notifications</h3>
                <span className="text-xs text-gray-400">{unreadCount} unread</span>
              </div>
              {notifs.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-300">
                  <Bell size={28} className="mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition border-b border-gray-50 last:border-0 ${n.is_read ? "opacity-60" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${n.is_read ? "bg-gray-100" : "bg-blue-50"}`}>
                    <Bell size={14} className={n.is_read ? "text-gray-400" : "text-blue-600"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-gray-300 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 bg-white rounded-2xl px-3 py-1.5 shadow-sm hover:bg-gray-50 transition"
          >
            {user?.profile_photo ? (
              <img src={user.profile_photo} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-gray-400 leading-tight capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]">
              <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-xs font-medium text-gray-600 truncate">{user?.email}</p>
              </div>
              {user?.role === "ADMIN" && (
                <button
                  onClick={() => { router.push("/settings"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  <User size={14} /> Settings
                </button>
              )}
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
