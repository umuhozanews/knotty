import { ReactNode } from "react";

interface PortalHeaderProps {
  color: string;
  title: string;
  subtitle?: string;
  sentence: ReactNode;
  attentionRow?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function PortalHeader({
  color,
  title,
  subtitle,
  sentence,
  attentionRow,
  action,
  className = "",
}: PortalHeaderProps) {
  return (
    <div
      className={`relative overflow-hidden flex flex-col justify-between ${className}`}
      style={{ backgroundColor: color }}
    >
      {/* Chevron pattern overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: 0.07 }}
      >
        <defs>
          <pattern
            id="ishuri-chevrons"
            x="0"
            y="0"
            width="48"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <polyline
              points="0,18 12,0 24,18 36,0 48,18"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <polyline
              points="0,36 12,18 24,36 36,18 48,36"
              fill="none"
              stroke="white"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ishuri-chevrons)" />
      </svg>

      {/* Top: school name */}
      <div
        className="relative z-10 px-5"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 44px)" }}
      >
        {subtitle && (
          <p
            className="text-xs font-medium uppercase tracking-widest mb-1.5"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {subtitle}
          </p>
        )}
        <h1
          className="text-[27px] font-bold leading-tight text-white"
          style={{ fontFamily: "var(--font-bricolage, var(--font-sans, sans-serif))" }}
        >
          {title}
        </h1>
      </div>

      {/* Bottom: sentence + optional rows + action */}
      <div className="relative z-10 px-5 pb-6 flex flex-col gap-3">
        <p className="text-[17px] leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
          {sentence}
        </p>
        {attentionRow}
        {action}
      </div>
    </div>
  );
}
