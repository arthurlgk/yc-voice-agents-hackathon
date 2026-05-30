import { NavLink } from "react-router-dom";
import { Home, ClipboardList, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import Brandmark from "./Brandmark";

type NavItem = { name: string; to: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { name: "Home", to: "/", icon: Home },
  { name: "Calls & Orders", to: "/calls", icon: ClipboardList },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-paper-raised">
      {/* Brand */}
      <div className="flex h-20 items-center gap-3 px-6">
        <Brandmark size={42} />
        <div className="min-w-0">
          <div className="font-display text-xl font-bold leading-tight text-lacquer-700">
            Lin Garden
          </div>
          <div className="text-xs font-medium tracking-wide text-ink-faint">
            Order by voice
          </div>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto rounded-lg p-2 text-ink-soft hover:bg-cream lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-lacquer-600 text-white shadow-warm"
                  : "text-ink-soft hover:bg-cream hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive
                      ? "text-gold-300"
                      : "text-ink-faint group-hover:text-lacquer-600",
                  )}
                />
                <span className="truncate">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4">
        <div className="rounded-xl border border-cream bg-cream/40 px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jade-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-jade-500" />
            </span>
            <span className="text-xs font-semibold text-ink">Agent online</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-ink-faint">
            Nemotron · Pipecat · Gradium
          </p>
        </div>
      </div>
    </div>
  );
}
