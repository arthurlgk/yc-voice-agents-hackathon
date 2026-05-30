import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Whether the browser has what it needs to read Supabase. The live order card
 * depends on this; the voice call + transcript do NOT. We degrade gracefully
 * (rather than crash the whole app) when the publishable key is absent, so the
 * core demo still runs. Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 * (the publishable/anon key, never the secret key) to enable the order card.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

if (!isSupabaseConfigured) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_PUBLISHABLE_KEY not set — the live order card is disabled. The voice call and transcript still work.",
  );
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
