import { supabase } from "./supabase";

// Shape mirrors the dashboard's order read. The hackathon agent writes orders
// via the place_order_atomic RPC keyed on (restaurant_id, call_id); items land
// in order_items. Modifiers stay empty for the simplified agent, but we keep the
// nested select so the card "just works" if structured modifiers are added.

export type SupabaseOrderItemModifier = {
  id: string;
  group_name: string | null;
  option_name: string | null;
  price_delta: string | number | null;
};

export type SupabaseOrderItem = {
  id: string;
  display_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
  order_item_modifiers: SupabaseOrderItemModifier[];
};

export type SupabaseOrder = {
  id: string;
  call_id: string | null;
  customer_name: string | null;
  fulfillment_type: "pickup" | "delivery" | "dine-in";
  status: string;
  subtotal: string | number;
  tax: string | number;
  total: string | number;
  notes: string | null;
  created_at: string;
  order_items: SupabaseOrderItem[];
};

const ORDER_SELECT =
  "id, call_id, customer_name, fulfillment_type, status, subtotal, tax, total, notes, created_at, order_items(id, display_name, variant_name, quantity, unit_price, line_total, order_item_modifiers(id, group_name, option_name, price_delta))";

/** Fetch the order for a given call (the agent writes at most one per call). */
export async function fetchOrder(callId: string): Promise<SupabaseOrder | null> {
  if (!supabase) return null; // Supabase not configured — order card is disabled.
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("call_id", callId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<SupabaseOrder>();
  if (error) {
    console.warn("[orders] fetchOrder failed:", error.message);
    return null;
  }
  return data;
}

export function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number.parseFloat(v);
}

/** Total item count across the order (for headers / badges). */
export function itemCount(order: SupabaseOrder): number {
  return order.order_items.reduce((n, i) => n + (i.quantity || 0), 0);
}
