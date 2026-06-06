"use client";
import { useEffect, useState, useRef } from "react";
import { Smartphone, Loader2, Search, Wifi } from "lucide-react";
import { cards, KnottyCard } from "@/lib/api";

interface Props {
  /** Called when a virtual card is tapped — passes the card_number */
  onTap: (cardNumber: string) => void;
  /** While a scan is in-progress, disable tapping */
  busy?: boolean;
}

export default function VirtualCardTap({ onTap, busy }: Props) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<KnottyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tapping, setTapping] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function fetchCards() {
    setLoading(true);
    try {
      const res = await cards.list({ limit: 50 });
      setList(res.data.filter((c) => c.is_active && !c.is_frozen));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  function toggle() {
    if (!open) { setOpen(true); fetchCards(); }
    else setOpen(false);
  }

  async function tapCard(card: KnottyCard) {
    if (busy || tapping) return;
    setTapping(card.id);
    // Brief "tap" animation before firing
    await new Promise((r) => setTimeout(r, 200));
    onTap(card.card_number);
    setTapping(null);
    setOpen(false);
  }

  const filtered = list.filter((c) => {
    const name = `${c.student.user.first_name} ${c.student.user.last_name}`.toLowerCase();
    const code = c.card_number.toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || code.includes(q);
  });

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-blue-500 text-blue-600 text-xs font-medium hover:bg-blue-50 transition"
        title="Simulate NFC card tap for testing"
      >
        <Smartphone size={14} />
        Virtual Tap
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 right-0 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Wifi size={14} className="text-blue-600" />
              Virtual Card Tap
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Click a card to simulate NFC tap</p>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-50">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5">
              <Search size={12} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or card…"
                className="bg-transparent text-xs outline-none flex-1 text-gray-700"
                autoFocus
              />
            </div>
          </div>

          {/* Card list */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 size={20} className="animate-spin text-blue-600" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No active cards found</p>
            ) : (
              filtered.map((card) => {
                const name = `${card.student.user.first_name} ${card.student.user.last_name}`;
                const initials = name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
                const hue = name.charCodeAt(0) * 37 % 360;
                const isTapping = tapping === card.id;

                return (
                  <button
                    key={card.id}
                    onClick={() => tapCard(card)}
                    disabled={!!busy || !!tapping}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition text-left border-b border-gray-50 last:border-0 ${isTapping ? "bg-blue-50 scale-95" : ""}`}
                  >
                    {/* Avatar */}
                    {card.student.user.profile_photo ? (
                      <img src={card.student.user.profile_photo} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: `hsl(${hue}, 60%, 55%)` }}>
                        {initials}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                      <p className="text-xs text-gray-400 font-mono">{card.card_number}</p>
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${card.wallet_balance < 1000 ? "text-red-500" : "text-teal-600"}`}>
                        {card.wallet_balance.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400">RWF</p>
                    </div>

                    {/* Tap animation */}
                    {isTapping && (
                      <div className="flex-shrink-0">
                        <Loader2 size={14} className="animate-spin text-blue-600" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {filtered.length} active card{filtered.length !== 1 ? "s" : ""} · Testing only
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
