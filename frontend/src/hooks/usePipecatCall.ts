import { useCallback, useRef, useState } from "react";
import {
  usePipecatClient,
  usePipecatClientTransportState,
  useRTVIClientEvent,
} from "@pipecat-ai/client-react";
import { RTVIEvent } from "@pipecat-ai/client-js";
import type { TransportState } from "@pipecat-ai/client-js";

export type TranscriptRole = "user" | "bot";

export type TranscriptTurn = {
  id: string;
  role: TranscriptRole;
  text: string;
  /** false while the turn is still streaming (interim / mid-speech). */
  final: boolean;
  at: number;
};

export type CallStatus = "idle" | "connecting" | "live" | "error";

type TranscriptData = { text?: string; final?: boolean };
type TextData = { text?: string };

function deriveStatus(s: TransportState, hadError: boolean): CallStatus {
  if (hadError) return "error";
  // Compare as a string so we stay robust to TransportState union differences
  // across SDK versions (e.g. an extra "authenticating" state).
  switch (s as string) {
    case "connected":
    case "ready":
      return "live";
    case "authenticating":
    case "authenticated":
    case "connecting":
    case "initializing":
    case "initialized":
      return "connecting";
    case "error":
      return "error";
    default:
      // "disconnected", "disconnecting", and any future state -> idle
      return "idle";
  }
}

// TTS text arrives as a stream of fragments. Join them so word-level fragments
// get a space but punctuation / leading-space fragments do not double up.
function joinSpoken(prev: string, next: string): string {
  if (!prev) return next;
  const needsSpace = !/\s$/.test(prev) && !/^[\s.,!?;:%)\]}'"]/.test(next);
  return prev + (needsSpace ? " " : "") + next;
}

// The server sends `{type: "call_id", call_id}` via RTVI send_server_message.
// Depending on SDK version the client hands us the payload directly or wrapped
// in one or two `{ data }` envelopes, so probe each plausible level.
function extractCallId(msg: unknown): string | null {
  const m = msg as { data?: unknown } | null;
  const candidates = [msg, m?.data, (m?.data as { data?: unknown })?.data];
  for (const c of candidates) {
    const p = c as { type?: string; call_id?: string } | null;
    if (p && p.type === "call_id" && p.call_id) return String(p.call_id);
  }
  return null;
}

/**
 * Owns a single voice call: connect / disconnect, the live transcript, the
 * transport status, and the session call_id (delivered by the bot over an RTVI
 * server message once the calls row is inserted). The order card subscribes to
 * Supabase once callId is known.
 */
export function usePipecatCall() {
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const [callId, setCallId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const pushOrMerge = useCallback(
    (role: TranscriptRole, text: string, final: boolean, merge: boolean) => {
      setTurns((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        const canMerge = last && last.role === role && !last.final;
        if (canMerge) {
          next[next.length - 1] = {
            ...last,
            text: merge ? joinSpoken(last.text, text) : text,
            final,
          };
        } else {
          next.push({
            id: `t${seq.current++}`,
            role,
            text,
            final,
            at: Date.now(),
          });
        }
        return next;
      });
    },
    [],
  );

  // call_id from the bot (handle envelope vs raw payload defensively).
  useRTVIClientEvent(
    RTVIEvent.ServerMessage,
    useCallback((msg: unknown) => {
      const id = extractCallId(msg);
      console.info("[order-rt] serverMessage", id ? `call_id=${id}` : msg);
      if (id) setCallId(id);
    }, []),
  );

  // User speech: replace the open interim user turn, commit on final.
  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    useCallback(
      (data: TranscriptData) => {
        const text = (data?.text ?? "").trim();
        if (!text) return;
        pushOrMerge("user", text, Boolean(data?.final), false);
      },
      [pushOrMerge],
    ),
  );

  // Bot spoken words: append fragments into the open bot turn.
  useRTVIClientEvent(
    RTVIEvent.BotTtsText,
    useCallback(
      (data: TextData) => {
        const text = data?.text ?? "";
        if (!text) return;
        pushOrMerge("bot", text, false, true);
      },
      [pushOrMerge],
    ),
  );

  // Bot finished speaking: close the open bot turn.
  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      setTurns((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last && last.role === "bot" && !last.final) {
          next[next.length - 1] = { ...last, final: true };
        }
        return next;
      });
    }, []),
  );

  useRTVIClientEvent(
    RTVIEvent.Error,
    useCallback((e: unknown) => {
      const msg =
        typeof e === "string"
          ? e
          : ((e as { message?: string })?.message ?? "Something went wrong.");
      setError(msg);
    }, []),
  );

  const connect = useCallback(async () => {
    if (!client) return;
    setError(null);
    setTurns([]);
    setCallId(null);
    try {
      // URL comes from the SmallWebRTC transport constructor (lib/pipecat.ts).
      await client.connect();
    } catch (e) {
      setError(
        (e as { message?: string })?.message ??
          "Could not reach the voice agent. Is it running on :7860?",
      );
    }
  }, [client]);

  const disconnect = useCallback(async () => {
    if (!client) return;
    try {
      await client.disconnect();
    } catch {
      // disconnect errors are not actionable for the user
    }
  }, [client]);

  return {
    connect,
    disconnect,
    transportState,
    status: deriveStatus(transportState, error != null),
    callId,
    turns,
    error,
    ready: client != null,
  };
}
