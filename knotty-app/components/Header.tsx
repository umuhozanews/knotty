"use client";
import { Sun, Moon, User, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { isManagementRole } from "@/lib/roles";

export default function Header({ onMenuClick, hideSidebarToggle }: { onMenuClick?: () => void; hideSidebarToggle?: boolean }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleLogout() { logout(); router.replace("/login"); }

  return (
    <header className="flex items-center justify-between gap-2 mb-2 md:mb-3">
      {/* Left: hamburger (mobile only) + IshuriHUB logo */}
      <div className="flex items-center gap-2">
        {onMenuClick && !hideSidebarToggle && (
          <button onClick={onMenuClick} className="md:hidden p-2 bg-white rounded-xl text-gray-600 hover:bg-gray-50 transition">
            <Menu size={18} />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "#DCFCE7" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#16A34A" />
              <path d="M2 17l10 5 10-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-extrabold text-2xl text-gray-800 tracking-tight">IshuriHUB</span>
        </div>
      </div>

      {/* Right: welcome text + theme toggle + account */}
      <div className="flex items-center gap-2">
        <span className="hidden sm:block text-sm text-gray-500">
          Welcome, <span className="font-semibold text-gray-800 capitalize">{user?.role?.toLowerCase().replace("_", " ")} {user?.first_name} {user?.last_name}</span>
        </span>

        <button
          onClick={toggle}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          className="w-8 h-8 md:w-9 md:h-9 bg-white rounded-full flex items-center justify-center hover:bg-gray-50 transition"
        >
          {theme === "dark" ? <Sun size={16} style={{ color: "#16A34A" }} /> : <Moon size={16} className="text-gray-500" />}
        </button>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center bg-white rounded-full p-1 hover:bg-gray-50 transition"
          >
            {user?.profile_photo ? (
              <img src={user.profile_photo} className="w-8 h-8 rounded-full object-cover" alt="avatar" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #16A34A, #2563EB)" }}>
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50 min-w-[160px]">
              <div className="px-4 py-2 border-b border-gray-50 mb-1">
                <p className="text-xs text-gray-400">Signed in as</p>
                <p className="text-xs font-medium text-gray-600 truncate">{user?.email}</p>
              </div>
              {isManagementRole(user?.role) && (
                <button
                  onClick={() => { router.push("/settings"); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  <User size={14} /> Settings
                </button>
              )}
              <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
