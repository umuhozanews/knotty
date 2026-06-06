"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardCheck, CreditCard, ShoppingCart,
  Banknote, FileText, AlertTriangle, Settings, LogOut, ChevronRight,
  Heart, BookOpen, User, CalendarDays, GraduationCap, Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Every nav item and which roles can see it
const ALL_NAV = [
  // ── Shared dashboard ──
  { icon: LayoutDashboard, label: "Dashboard",    href: "/",              roles: ["ADMIN","TEACHER","CANTEEN","NURSE","BURSAR","DISCIPLINE"] },

  // ── Student self-service ──
  { icon: LayoutDashboard, label: "My Dashboard", href: "/",              roles: ["STUDENT"] },
  { icon: User,            label: "My Profile",   href: "/my-profile",    roles: ["STUDENT"] },
  { icon: CalendarDays,    label: "My Attendance",href: "/my-attendance", roles: ["STUDENT"] },
  { icon: GraduationCap,   label: "My Reports",   href: "/my-reports",    roles: ["STUDENT"] },
  { icon: Wallet,          label: "My Card",      href: "/my-card",       roles: ["STUDENT"] },
  { icon: BookOpen,        label: "Materials",     href: "/materials",     roles: ["STUDENT"] },

  // ── Admin / Teacher / Staff shared ──
  { icon: Users,           label: "Students",     href: "/students",      roles: ["ADMIN","TEACHER","NURSE","BURSAR","DISCIPLINE"] },
  { icon: ClipboardCheck,  label: "Attendance",   href: "/attendance",    roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { icon: BookOpen,        label: "Materials",    href: "/materials",     roles: ["ADMIN","TEACHER"] },
  { icon: FileText,        label: "Reports",      href: "/reports",       roles: ["ADMIN","TEACHER"] },
  { icon: AlertTriangle,   label: "Discipline",   href: "/discipline",    roles: ["ADMIN","TEACHER","DISCIPLINE"] },
  { icon: Heart,           label: "Health",       href: "/health",        roles: ["ADMIN","NURSE"] },
  { icon: CreditCard,      label: "Cards",        href: "/cards",         roles: ["ADMIN","BURSAR"] },
  { icon: ShoppingCart,    label: "Canteen",      href: "/canteen",       roles: ["ADMIN","CANTEEN"] },
  { icon: Banknote,        label: "Fees",         href: "/fees",          roles: ["ADMIN","BURSAR"] },
];

// Pretty display name for each role
const ROLE_LABELS: Record<string, string> = {
  ADMIN:      "Administrator",
  TEACHER:    "Teacher",
  STUDENT:    "Student",
  NURSE:      "School Nurse",
  BURSAR:     "Bursar",
  DISCIPLINE: "Discipline Office",
  CANTEEN:    "Canteen Staff",
  PARENT:     "Parent",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout } = useAuth();

  const role     = user?.role ?? "STUDENT";
  const navItems = ALL_NAV.filter((n) => n.roles.includes(role));

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  function handleLogout() { logout(); router.replace("/login"); }

  return (
    <aside className="w-56 flex-shrink-0 bg-white rounded-3xl flex flex-col h-full shadow-sm overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 pt-6 pb-4">
        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#1d4ed8" />
            <path d="M2 17l10 5 10-5" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 12l10 5 10-5" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <span className="font-bold text-lg text-gray-800">KNOTTY</span>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 mb-2">Menu</p>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = isActive(href);
          return (
            <Link key={href + label} href={href}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all text-sm font-medium
                ${active ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}`}
            >
              <span className="flex items-center gap-3"><Icon size={16} />{label}</span>
              {active && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Role badge */}
      <div className="mx-3 mb-3 mt-2 rounded-2xl bg-gradient-to-br from-blue-50 to-green-50 p-3">
        <p className="text-xs font-semibold text-gray-700 mb-0.5">KNOTTY Smart School</p>
        <p className="text-xs text-gray-400">Card-based management</p>
        {user && (
          <p className="text-xs text-blue-700 mt-1 font-medium">{ROLE_LABELS[role] ?? role}</p>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-0.5">
        {role === "ADMIN" && (
          <Link href="/settings"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition
              ${isActive("/settings") ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Settings size={16} />Settings
          </Link>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-gray-500 hover:bg-red-50 hover:text-red-500 text-sm font-medium transition"
        >
          <LogOut size={16} />Log out
        </button>
      </div>
    </aside>
  );
}
