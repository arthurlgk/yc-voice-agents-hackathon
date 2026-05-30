import { toNum } from "./orders";

/** "$12.30" from a string|number money value. */
export function formatMoney(v: string | number | null | undefined): string {
  return `$${toNum(v).toFixed(2)}`;
}

/** "1:05" from a count of seconds. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "May 30, 2026, 4:12 PM" (local time) from an ISO timestamp. */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
