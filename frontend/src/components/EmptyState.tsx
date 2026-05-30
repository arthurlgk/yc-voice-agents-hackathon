import type { ReactNode } from "react";
import { cn } from "../lib/cn";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** A centered, on-brand empty / placeholder state. */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        className,
      )}
    >
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="font-display text-xl font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
