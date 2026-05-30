import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import type { CallStatus } from "../hooks/usePipecatCall";

type Props = {
  status: CallStatus;
  onStart: () => void;
  onEnd: () => void;
  size?: "lg" | "sm";
};

export default function CallButton({
  status,
  onStart,
  onEnd,
  size = "lg",
}: Props) {
  const isLg = size === "lg";
  const base = cn(
    "inline-flex select-none items-center justify-center gap-2.5 font-semibold transition-all disabled:cursor-not-allowed",
    isLg ? "rounded-2xl px-8 py-4 text-lg" : "rounded-xl px-5 py-2.5 text-sm",
  );
  const icon = isLg ? "h-5 w-5" : "h-4 w-4";

  if (status === "live") {
    return (
      <button
        type="button"
        onClick={onEnd}
        className={cn(
          base,
          "bg-white text-lacquer-700 shadow-warm ring-1 ring-lacquer-200 hover:-translate-y-0.5 hover:bg-lacquer-50",
        )}
      >
        <PhoneOff className={icon} />
        End Call
      </button>
    );
  }

  const connecting = status === "connecting";
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={connecting}
      className={cn(
        base,
        "bg-gradient-to-br from-lacquer-500 to-lacquer-700 text-white shadow-warm-lg",
        connecting
          ? "opacity-90"
          : "hover:-translate-y-0.5 hover:from-lacquer-600 hover:to-lacquer-800",
      )}
    >
      {connecting ? (
        <Loader2 className={cn(icon, "animate-spin")} />
      ) : (
        <Phone className={icon} />
      )}
      {connecting ? "Connecting…" : "Start Call"}
    </button>
  );
}
