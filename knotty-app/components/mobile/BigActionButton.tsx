"use client";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface BigActionButtonProps {
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  variant?: "white" | "ghost";
}

export default function BigActionButton({
  label,
  href,
  onClick,
  loading,
  disabled,
  icon,
  variant = "white",
}: BigActionButtonProps) {
  const baseClass =
    "w-full min-h-[52px] rounded-2xl font-semibold text-[16px] flex items-center justify-center gap-2.5 transition active:scale-[0.97] select-none";

  const variantClass =
    variant === "white"
      ? "bg-white/90 text-gray-900 shadow-sm"
      : "bg-white/15 text-white border border-white/30";

  const disabledClass = disabled || loading ? "opacity-60" : "";

  const cls = `${baseClass} ${variantClass} ${disabledClass}`;

  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={cls}>
        {icon}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button onClick={onClick} disabled={disabled || loading} className={cls}>
      {loading ? <Loader2 size={18} className="animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}
