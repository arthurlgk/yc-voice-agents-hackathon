import { cn } from "../lib/cn";

/**
 * The Lin Garden mark: the character 林 (lín — "garden / grove") set in a gold
 * roundel. Used in the sidebar, the agent avatar, and empty states.
 */
export default function Brandmark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-lacquer-800 shadow-warm ring-1 ring-gold-600/40",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="font-display font-bold leading-none"
        style={{ fontSize: size * 0.5 }}
      >
        林
      </span>
    </span>
  );
}
