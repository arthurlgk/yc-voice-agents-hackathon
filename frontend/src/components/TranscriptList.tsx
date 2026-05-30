import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "../lib/cn";
import Brandmark from "./Brandmark";
import type { TranscriptTurn } from "../hooks/usePipecatCall";

export default function TranscriptList({ turns }: { turns: TranscriptTurn[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Keep pinned to the newest message while the user hasn't scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !atBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, atBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scroll-warm absolute inset-0 space-y-5 overflow-y-auto px-1 py-2"
      >
        {turns.map((t) => (
          <Bubble key={t.id} turn={t} />
        ))}
      </div>

      {!atBottom && (
        <button
          type="button"
          onClick={() => setAtBottom(true)}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white shadow-warm-lg"
        >
          <ArrowDown className="h-3.5 w-3.5" /> Jump to latest
        </button>
      )}
    </div>
  );
}

function Bubble({ turn }: { turn: TranscriptTurn }) {
  const isBot = turn.role === "bot";
  return (
    <div
      className={cn(
        "flex animate-slide-up gap-3",
        isBot ? "justify-start" : "justify-end",
      )}
    >
      {isBot && <Brandmark size={32} className="mt-5 shrink-0" />}
      <div className="max-w-[78%]">
        <div
          className={cn(
            "mb-1 text-[11px] font-semibold uppercase tracking-wide",
            isBot ? "text-gold-600" : "text-right text-ink-faint",
          )}
        >
          {isBot ? "Lin Garden" : "You"}
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-warm",
            isBot
              ? "rounded-tl-sm bg-paper-raised text-ink"
              : "rounded-tr-sm bg-lacquer-600 text-white",
          )}
        >
          {turn.text}
          {!turn.final && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current align-middle opacity-60" />
          )}
        </div>
      </div>
    </div>
  );
}
