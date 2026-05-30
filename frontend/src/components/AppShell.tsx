import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { cn } from "../lib/cn";
import Sidebar from "./Sidebar";
import Brandmark from "./Brandmark";

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* Subtle warm wash behind everything */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 80% -10%, rgba(212,165,55,0.10), transparent 60%), radial-gradient(50rem 40rem at -10% 110%, rgba(155,28,28,0.08), transparent 55%)",
        }}
      />

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-cream shadow-warm-lg transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onNavigate={close} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar */}
        <header className="flex h-16 items-center gap-3 border-b border-cream bg-paper-raised px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-ink-soft hover:bg-cream"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Brandmark size={28} />
          <span className="font-display text-lg font-bold text-lacquer-700">
            Lin Garden
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
