"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardCheck, CreditCard, ShoppingCart,
  Banknote, AlertTriangle, Settings, LogOut, ChevronRight,
  Heart, User, CalendarDays, Wallet, X, Library,
  UserCheck, Building2, Smartphone, Activity, Shield, Package,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isManagementRole } from "@/lib/roles";

// Every nav item and which roles can see it — only give a role what it actually needs
const ALL_NAV = [
  // ── Role dashboards (all staff land at "/") ──
  { icon: LayoutDashboard, label: "Dashboard",     href: "/",               roles: ["ADMIN","TEACHER","CANTEEN","NURSE","BURSAR","DISCIPLINE","LIBRARIAN","GATEKEEPER","MATERIALS"] },

  // ── Student roster — roles that work directly with students ──
  { icon: Users,           label: "Students",      href: "/students",       roles: ["ADMIN","TEACHER","BURSAR","DISCIPLINE","LIBRARIAN","NURSE"] },

  // ── Staff management — admin only ──
  { icon: UserCheck,       label: "Workers",       href: "/workers",        roles: ["ADMIN"] },
  { icon: Building2,       label: "Schools Hub",   href: "/schools",        roles: ["ADMIN"] },

  // ── Attendance — teacher and discipline mark it ──
  { icon: ClipboardCheck,  label: "Attendance",    href: "/attendance",     roles: ["ADMIN","TEACHER","DISCIPLINE"] },

  // ── Library — librarian manages; admin oversees ──
  { icon: Library,         label: "Library",       href: "/library",        roles: ["ADMIN","LIBRARIAN"] },

  // ── Discipline — teacher and discipline office log incidents ──
  { icon: AlertTriangle,   label: "Discipline",    href: "/discipline",     roles: ["ADMIN","TEACHER","DISCIPLINE"] },

  // ── Health — nurse only ──
  { icon: Heart,           label: "Health",        href: "/health",         roles: ["ADMIN","NURSE"] },

  // ── Cards — bursar issues/manages cards ──
  { icon: CreditCard,      label: "Cards",         href: "/cards",          roles: ["ADMIN","BURSAR"] },

  // ── Canteen — canteen staff ──
  { icon: ShoppingCart,    label: "Canteen",       href: "/canteen",        roles: ["ADMIN","CANTEEN"] },

  // ── Fees — bursar + student/parent (self-service) ──
  { icon: Banknote,        label: "Fees",          href: "/fees",           roles: ["ADMIN","BURSAR","STUDENT","PARENT"] },

  // ── Virtual Tap — canteen and bursar use it for payments ──
  { icon: Smartphone,      label: "Virtual Tap",   href: "/standalone-tap", roles: ["ADMIN","BURSAR","CANTEEN"] },

  // ── Gate — gatekeeper + discipline ──
  { icon: Shield,          label: "Gate",          href: "/gate",           roles: ["ADMIN","GATEKEEPER","DISCIPLINE"] },

  // ── Materials — materials staff ──
  { icon: Package,         label: "Materials",     href: "/materials",      roles: ["ADMIN","MATERIALS"] },

  // ── Student self-service ──
  { icon: LayoutDashboard, label: "My Dashboard",  href: "/",               roles: ["STUDENT","PARENT"] },
  { icon: User,            label: "My Profile",    href: "/my-profile",     roles: ["STUDENT"] },
  { icon: CalendarDays,    label: "My Attendance", href: "/my-attendance",  roles: ["STUDENT"] },
  { icon: Wallet,          label: "My Card",       href: "/my-card",        roles: ["STUDENT"] },
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
  LIBRARIAN:  "Librarian",
  GATEKEEPER: "Gatekeeper",
  MATERIALS:  "Materials Staff",
};

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, logout, activeSchool } = useAuth();

  const role     = user?.role ?? "STUDENT";
  const navItems = ALL_NAV.filter((n) => n.roles.includes(role) || (isManagementRole(role) && n.roles.includes("ADMIN")));

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  function handleLogout() { logout(); router.replace("/login"); }

  return (
    <aside className={`w-56 flex-shrink-0 bg-white rounded-3xl flex flex-col h-[calc(100vh-24px)] md:h-full shadow-sm overflow-hidden
      fixed md:static top-3 left-3 z-50 transition-transform duration-300 ease-in-out
      ${isOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)] md:translate-x-0"}`}
    >
      {/* Logo & Close */}
      <div className="flex items-center justify-between px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#DCFCE7" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#16A34A" />
              <path d="M2 17l10 5 10-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-bold text-lg text-gray-800">IshuriHUB</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        )}
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-5 mb-2">Menu</p>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = isActive(href);
          return (
            <Link key={href + label} href={href}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all text-sm font-medium
                ${active ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-[#121212]"}`}
              style={active ? { background: "#DCFCE7", color: "#16A34A" } : undefined}
            >
              <span className="flex items-center gap-3"><Icon size={16} />{label}</span>
              {active && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Role & Active School badge */}
      <div className="mx-3 mb-3 mt-2 rounded-2xl p-3" style={{ background: "#DCFCE7", border: "1px solid #BBF7D0" }}>
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className="text-xs font-bold truncate" style={{ color: "#121212" }}>
            {activeSchool?.name || "IshuriHUB Model School"}
          </p>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 shrink-0">
            {activeSchool?.code || "KMS"}
          </span>
        </div>
        <p className="text-[11px]" style={{ color: "#666666" }}>
          {activeSchool?.student_count ?? 53} Students • {activeSchool?.worker_count ?? 14} Workers
        </p>
        {user && (
          <p className="text-xs mt-1 font-semibold" style={{ color: "#16A34A" }}>{ROLE_LABELS[role] ?? role}</p>
        )}
      </div>


      {/* Bottom actions */}
      <div className="border-t border-gray-100 px-3 py-3 space-y-0.5">
        {isManagementRole(role) && (
          <>
            <Link href="/admin/system-tests"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition
                ${isActive("/admin/system-tests") ? "" : "text-gray-500 hover:bg-gray-50"}`}
              style={isActive("/admin/system-tests") ? { background: "#DCFCE7", color: "#16A34A" } : undefined}
            >
              <Activity size={16} />System Tests
            </Link>
            <Link href="/settings"
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition
                ${isActive("/settings") ? "" : "text-gray-500 hover:bg-gray-50"}`}
              style={isActive("/settings") ? { background: "#DCFCE7", color: "#16A34A" } : undefined}
            >
              <Settings size={16} />Settings
            </Link>
          </>
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
