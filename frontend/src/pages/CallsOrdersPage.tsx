import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Search, SlidersHorizontal, ClipboardList } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { fetchCallLog, type CallLogRow } from "../lib/calls";
import { formatMoney, formatTimestamp } from "../lib/format";
import { cn } from "../lib/cn";

const GRID = "grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr]";

export default function CallsOrdersPage() {
  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch on mount. The route remounts on each navigation to this tab, so
  // switching away and back refreshes the log (no realtime needed).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCallLog().then((data) => {
      if (cancelled) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink">
              Calls &amp; Orders
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Every conversation and order, in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                disabled
                placeholder="Search name or phone…"
                className="w-56 cursor-not-allowed rounded-xl border border-cream bg-paper-raised py-2 pl-9 pr-3 text-sm text-ink-soft placeholder:text-ink-faint"
              />
            </div>
            <button
              disabled
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-cream bg-paper-raised px-3.5 py-2 text-sm font-medium text-ink-soft"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filter
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cream bg-paper-raised shadow-warm">
          <div
            className={cn(
              "hidden gap-4 border-b border-cream bg-cream/30 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint sm:grid",
              GRID,
            )}
          >
            <span>Customer</span>
            <span>Type</span>
            <span>Time</span>
            <span>Total</span>
            <span>Status</span>
          </div>

          {loading ? (
            <Skeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              className="py-20"
              icon={
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream">
                  <ClipboardList className="h-8 w-8 text-gold-600" />
                </div>
              }
              title="No calls or orders yet"
              description="Start a call from the Home page. Completed calls and their orders will be listed here."
            />
          ) : (
            <ul className="divide-y divide-cream">
              {rows.map((row) => (
                <CallRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CallRow({ row }: { row: CallLogRow }) {
  const phone = row.customer_phone ?? row.caller_phone;
  const hasCustomer = Boolean(row.customer_name || phone);

  return (
    <li className="grid grid-cols-1 gap-1.5 px-6 py-4 sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_0.8fr] sm:items-center sm:gap-4">
      {/* Customer */}
      <div className="min-w-0">
        {hasCustomer ? (
          <>
            <div className="truncate text-sm font-medium text-ink">
              {row.customer_name ?? "Unknown"}
            </div>
            {phone && (
              <div className="truncate text-xs text-ink-soft">{phone}</div>
            )}
          </>
        ) : (
          <span className="text-sm text-ink-faint">—</span>
        )}
      </div>

      {/* Type */}
      <div>
        {row.fulfillment_type ? (
          <Badge>{row.fulfillment_type}</Badge>
        ) : (
          <span className="text-sm text-ink-faint">—</span>
        )}
      </div>

      {/* Time */}
      <div className="text-sm text-ink-soft">
        {formatTimestamp(row.started_at)}
      </div>

      {/* Total */}
      <div className="font-mono text-sm text-ink">
        {row.total != null ? formatMoney(row.total) : <span className="text-ink-faint">—</span>}
      </div>

      {/* Status */}
      <div>
        <Badge tone="muted">{row.status}</Badge>
      </div>
    </li>
  );
}

function Badge({
  children,
  tone = "brand",
}: {
  children: ReactNode;
  tone?: "brand" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        tone === "brand"
          ? "bg-lacquer-50 text-lacquer-700 ring-1 ring-lacquer-100"
          : "bg-cream text-ink-soft",
      )}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <ul className="divide-y divide-cream">
      {[0, 1, 2].map((i) => (
        <li key={i} className={cn("hidden gap-4 px-6 py-4 sm:grid sm:items-center", GRID)}>
          <div className="h-4 w-3/4 animate-pulse rounded bg-cream" />
          <div className="h-4 w-16 animate-pulse rounded bg-cream" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-cream" />
          <div className="h-4 w-12 animate-pulse rounded bg-cream" />
          <div className="h-4 w-16 animate-pulse rounded bg-cream" />
        </li>
      ))}
    </ul>
  );
}
