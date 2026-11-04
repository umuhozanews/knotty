"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export interface MobileTab {
  label: string;
  href: string;
  icon: ReactNode;
}

interface BottomTabsProps {
  tabs: MobileTab[];
  activeColor?: string;
}

export default function BottomTabs({ tabs, activeColor = "#14532D" }: BottomTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      className="bg-white border-t border-gray-200 shrink-0"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex">
        {tabs.map((tab) => {
          const isActive =
            tab.label === "More"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors"
              style={{ color: isActive ? activeColor : "#9CA3AF" }}
            >
              {tab.icon}
              <span className={`text-[11px] ${isActive ? "font-semibold" : "font-medium"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
