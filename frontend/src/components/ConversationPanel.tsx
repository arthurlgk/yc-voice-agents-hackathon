import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "../lib/cn";
import CallButton from "./CallButton";
import TranscriptList from "./TranscriptList";
import EmptyState from "./EmptyState";
import { formatDuration } from "../lib/format";
import type { CallStatus, TranscriptTurn } from "../hooks/usePipecatCall";

type Props = {
  status: CallStatus;
  turns: TranscriptTurn[];
  error: string | null;
  onStart: () => void;
  onEnd: () => void;
};

export default function ConversationPanel({
  status,
  turns,
  error,
  onStart,
  onEnd,
}: Props) {
  const seconds = useCallSeconds(status === "live");
  const showTranscript =
    turns.length > 0 || status === "live" || status === "connecting";

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-cream bg-paper-raised/80 shadow-warm">
      <div className="flex items-center justify-between gap-3 border-b border-cream px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">Conversation</h2>
          <p className="text-xs text-ink-faint">
            Talk to the Lin Garden receptionist
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} seconds={seconds} />
          {status === "live" && (
            <CallButton
              size="sm"
              status={status}
              onStart={onStart}
              onEnd={onEnd}
            />
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {error && (
          <div className="mb-3 rounded-xl border border-lacquer-200 bg-lacquer-50 px-4 py-2.5 text-sm text-lacquer-700">
            {error}
          </div>
        )}
        {showTranscript ? (
          <TranscriptList turns={turns} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
            <div className="relative mb-6">
              <span className="absolute inset-0 animate-ping rounded-full bg-lacquer-400/25" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-lacquer-500 to-lacquer-700 text-white shadow-warm-lg">
                <Mic className="h-10 w-10" />
              </span>
            </div>
            <EmptyState
              title="Order by voice"
              description="Tap start and talk naturally, like calling the restaurant. Your order appears live on the right as you go."
              action={
                <CallButton status={status} onStart={onStart} onEnd={onEnd} />
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function useCallSeconds(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

function StatusBadge({
  status,
  seconds,
}: {
  status: CallStatus;
  seconds: number;
}) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-jade-50 px-2.5 py-1 text-xs font-semibold text-jade-600 ring-1 ring-jade-100">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jade-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-jade-500" />
        </span>
        Live · {formatDuration(seconds)}
      </span>
    );
  }

  const map: Record<Exclude<CallStatus, "live">, { label: string; cls: string }> =
    {
      idle: { label: "Ready", cls: "bg-cream text-ink-soft ring-cream" },
      connecting: {
        label: "Connecting…",
        cls: "bg-gold-200 text-gold-600 ring-gold-300",
      },
      error: {
        label: "Error",
        cls: "bg-lacquer-50 text-lacquer-700 ring-lacquer-200",
      },
    };
  const s = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}
