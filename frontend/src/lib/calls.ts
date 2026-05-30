import { supabase } from "./supabase";

// Read-only call log for the Calls & Orders tab. One row per call (tagged
// agent_id = 'yc_hackathon'), left-joined to its order. orders.call_id is not a
// declared FK to calls.id, so PostgREST embedded select is unavailable — we run
// two batched queries (calls, then their orders by call_id) and merge by call_id.

export type CallLogRow = {
  id: string;
  started_at: string;
  status: string; // call status (active/completed/...)
  caller_phone: string | null;
  // Merged from the call's order (null if no order was placed):
  customer_name: string | null;
  customer_phone: string | null;
  fulfillment_type: "pickup" | "delivery" | null;
  total: string | number | null;
};

type CallRow = {
  id: string;
  started_at: string;
  status: string;
  caller_phone: string | null;
};

type OrderRow = {
  call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  fulfillment_type: "pickup" | "delivery" | null;
  total: string | number | null;
};

const AGENT_ID = "yc_hackathon";

/** Fetch the most recent calls (newest first), each merged with its order. */
export async function fetchCallLog(limit = 100): Promise<CallLogRow[]> {
  const sb = supabase;
  if (!sb) return []; // Supabase not configured — log is disabled.

  const { data: calls, error: callsError } = await sb
    .from("calls")
    .select("id, started_at, status, caller_phone")
    .eq("agent_id", AGENT_ID)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (callsError) {
    console.warn("[calls] fetchCallLog (calls) failed:", callsError.message);
    return [];
  }
  if (!calls || calls.length === 0) return [];

  const ids = (calls as CallRow[]).map((c) => c.id);

  const { data: orders, error: ordersError } = await sb
    .from("orders")
    .select("call_id, customer_name, customer_phone, fulfillment_type, total")
    .in("call_id", ids);
  if (ordersError) {
    // Non-fatal: still show calls without the order-only columns.
    console.warn("[orders] fetchCallLog (orders) failed:", ordersError.message);
  }

  const byCall = new Map<string, OrderRow>();
  for (const o of (orders ?? []) as OrderRow[]) {
    if (o.call_id) byCall.set(o.call_id, o); // last write wins (≤1 per call)
  }

  return (calls as CallRow[]).map((c) => {
    const order = byCall.get(c.id);
    return {
      id: c.id,
      started_at: c.started_at,
      status: c.status,
      caller_phone: c.caller_phone,
      customer_name: order?.customer_name ?? null,
      customer_phone: order?.customer_phone ?? null,
      fulfillment_type: order?.fulfillment_type ?? null,
      total: order?.total ?? null,
    };
  });
}
