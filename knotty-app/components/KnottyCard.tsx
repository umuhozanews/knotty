"use client";
import { CardScanFull } from "@/lib/api";

interface Props {
  card: CardScanFull;
  glowColor?: "green" | "blue" | "orange" | "red" | null;
  tapping?: boolean;
}

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" });
}

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const letters = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center rounded-xl">
      <span className="text-white text-xl font-bold tracking-wide">{letters.toUpperCase()}</span>
    </div>
  );
}

// NFC contactless icon
function NFCIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 7c0-1.1.4-2 1-3" />
      <path d="M4 5C2.8 6.4 2 8.1 2 10s.8 3.6 2 5" />
      <path d="M8 9a3 3 0 0 1 0 6" />
      <path d="M10 12h4" />
      <path d="M14 9v6" />
      <path d="M18 7c0-1.1-.4-2-1-3" />
      <path d="M20 5c1.2 1.4 2 3.1 2 5s-.8 3.6-2 5" />
    </svg>
  );
}

export default function KnottyCard({ card, glowColor, tapping }: Props) {
  const glowClass =
    glowColor === "green"  ? "shadow-[0_0_32px_6px_rgba(34,197,94,0.55)]" :
    glowColor === "blue"   ? "shadow-[0_0_32px_6px_rgba(59,130,246,0.55)]" :
    glowColor === "orange" ? "shadow-[0_0_32px_6px_rgba(249,115,22,0.65)]" :
    glowColor === "red"    ? "shadow-[0_0_32px_6px_rgba(239,68,68,0.55)]"  :
    "shadow-[0_8px_40px_rgba(0,0,0,0.5)]";

  const isExpired = card.expires_at && new Date(card.expires_at) < new Date();
  const tapInTime  = fmtTime(card.check_in_time);
  const tapOutTime = fmtTime(card.check_out_time);

  return (
    <div
      className={`
        relative w-[350px] h-[215px] rounded-2xl overflow-hidden select-none
        transition-all duration-300
        ${glowClass}
        ${tapping ? "scale-95" : "scale-100"}
      `}
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0c1424 100%)" }}
    >
      {/* Blue/green accent stripe at top */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-emerald-400 to-blue-500" />

      {/* Subtle card texture dots */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "14px 14px" }} />

      {/* School logo / name — top left */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        {card.student.school_logo ? (
          <img src={card.student.school_logo} alt="school" className="w-7 h-7 rounded-md object-contain" />
        ) : (
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">K</div>
        )}
        <div>
          <p className="text-white text-[9px] font-bold leading-tight uppercase tracking-wider truncate max-w-[140px]">
            {card.student.school_name || "KNOTTY SCHOOL"}
          </p>
          <p className="text-blue-400 text-[7px] font-medium tracking-widest">SMART SCHOOL SYSTEM</p>
        </div>
      </div>

      {/* Status badge — top right */}
      <div className="absolute top-4 right-4">
        {card.is_frozen ? (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">FROZEN</span>
        ) : isExpired ? (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/30">EXPIRED</span>
        ) : (
          <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-400/30">ACTIVE</span>
        )}
      </div>

      {/* Divider line */}
      <div className="absolute top-[42px] left-4 right-4 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      {/* Main content row */}
      <div className="absolute top-[52px] left-4 right-4 flex gap-4">
        {/* Photo */}
        <div className="w-[68px] h-[68px] rounded-xl overflow-hidden flex-shrink-0 border-2 border-white/10">
          {card.student.photo ? (
            <img src={card.student.photo} alt={card.student.name} className="w-full h-full object-cover" />
          ) : (
            <Initials name={card.student.name} />
          )}
        </div>

        {/* Student info */}
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-white font-bold text-[13px] leading-tight tracking-wide truncate">
            {card.student.name.toUpperCase()}
          </p>
          <p className="text-[#94a3b8] text-[10px] mt-0.5 truncate">{card.student.class}</p>
          <p className="text-[#64748b] text-[9px] mt-0.5 font-mono">{card.student.student_code}</p>

          {/* Tap times */}
          <div className="flex gap-3 mt-2">
            {tapInTime && (
              <span className="text-[8.5px] text-green-400 font-medium">▶ IN {tapInTime}</span>
            )}
            {tapOutTime && (
              <span className="text-[8.5px] text-blue-400 font-medium">◀ OUT {tapOutTime}</span>
            )}
          </div>
        </div>
      </div>

      {/* Card number — embossed style */}
      <div className="absolute bottom-[38px] left-4 right-4">
        <p className="text-[#475569] text-[7px] font-medium mb-0.5 uppercase tracking-widest">Card Number</p>
        <p className="text-white font-mono text-[11px] font-semibold tracking-[0.15em]">
          {card.card_number}
        </p>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-0 left-0 right-0 h-[28px] flex items-center justify-between px-4"
        style={{ background: "rgba(59,130,246,0.08)", borderTop: "1px solid rgba(59,130,246,0.15)" }}>
        {/* NFC icon */}
        <div className="text-blue-400/70 flex items-center gap-1.5">
          <NFCIcon size={16} />
          <span className="text-[7px] text-[#64748b] uppercase tracking-wider">Contactless</span>
        </div>

        {/* Dates */}
        <div className="text-right">
          <p className="text-[#64748b] text-[7px]">
            <span className="text-[#475569]">ISS </span>{fmt(card.issued_at)}
            <span className="mx-1 text-[#334155]">·</span>
            <span className="text-[#475569]">EXP </span>{fmt(card.expires_at)}
          </p>
        </div>
      </div>

      {/* Tapping ripple overlay */}
      {tapping && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full border-2 border-blue-500 animate-ping opacity-60" />
        </div>
      )}
    </div>
  );
}
